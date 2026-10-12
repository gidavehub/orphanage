import "server-only";

// Public case uploads (data-model §10.6, PLAN D96). One file per request through the function:
//   same origin → storage on? → body ≤ 4 MB → 20 per hour per IP hash → magic bytes (PDF, JPEG, PNG,
//   WebP; the browser's claimed type is ignored) → images re-encoded by sharp (rotation applied,
//   EXIF and GPS stripped); PDFs must not be encrypted → quarantine/{uploadId} → an HMAC upload token
//   { sub: uploadId, d: { sha256, mime, size, name }, exp: +2 h }.
// The form submits the tokens (at most 5). Intake verifies each one (`verifyUploadTokens`), writes
// attachments/{id} in the record's transaction (`attachmentWrites`) and then moves the files to
// private/cases/{collection}/{docId}/{attId}.{ext} (`moveAttachmentFiles`). Unclaimed quarantine files
// expire after a day (bucket lifecycle or the local sweep). Files never pass through a Server Action.

import sharp from "sharp";
import { ALLOWED_MIMES, type AllowedMime, type AttachmentLabel, type AttachmentMeta } from "@/lib/model/domain/case";
import type { Millis } from "@/lib/model/enums";
import { newId } from "@/lib/server/db/convert";
import { subDocPath, type CollectionKey } from "@/lib/server/db/collections";
import type { Tx } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";
import { ipHash, sha256Hex, signTokenFor, tokensAvailable, verifyToken } from "@/lib/server/security/hmac";
import { sameOriginGuard } from "@/lib/server/security/origin";
import { rateLimit } from "@/lib/server/security/ratelimit";
import { sanitiseFileName } from "@/lib/server/security/sanitise";
import { clientIp } from "@/lib/server/security/spam";
import { BLOB_PATH, blobStoreAvailable, getBlobStore } from "@/lib/server/storage";

/** 4 MB per file: below Vercel's 4.5 MB request body limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Multipart overhead allowed on top of the file itself. */
const BODY_SLACK = 64 * 1024;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TOKENS = 5;
/** Decompression-bomb guard: no photo needs more than 50 megapixels. */
const MAX_PIXELS = 50_000_000;

const EXT: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MSG = {
  unavailable: "Uploads aren't switched on yet. If documents are needed, our team will ask you for them securely.",
  tooBig: "This file is bigger than 4 MB. Please choose a smaller file, or take a photo of the page instead.",
  type: "This type of file can't be accepted. Please use a PDF, JPG, PNG or WebP file.",
  encrypted: "This PDF is password-protected, so our team couldn't open it. Please remove the password or upload a photo instead.",
  unreadable: "We couldn't read this file. Please try another copy, or a photo of the document.",
  rateLimited: "Too many uploads for now. Please wait a few minutes and try again.",
  missing: "Please choose one file to upload.",
  server: "This file didn't upload. Please try again.",
} as const;

/** True when the request form may offer FileDrop (storage connected and tokens can be signed). */
export function publicUploadsAvailable(): boolean {
  return blobStoreAvailable() && tokensAvailable();
}

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

/** The real type from the first bytes, never from the browser's claim or the file name. */
export function sniffMime(buf: Buffer): AllowedMime | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Encrypted PDFs carry an /Encrypt entry in their trailer dictionary. */
function isEncryptedPdf(buf: Buffer): boolean {
  return buf.includes(Buffer.from("/Encrypt", "latin1"));
}

/** Re-encodes a photo: orientation applied, every metadata block (EXIF, GPS, XMP, ICC) dropped. */
async function reencode(buf: Buffer, mime: Exclude<AllowedMime, "application/pdf">): Promise<Buffer> {
  const img = sharp(buf, { failOn: "error", limitInputPixels: MAX_PIXELS }).rotate();
  if (mime === "image/jpeg") return img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  if (mime === "image/png") return img.png({ compressionLevel: 9 }).toBuffer();
  return img.webp({ quality: 85 }).toBuffer();
}

function fileNameFor(original: string, mime: AllowedMime): string {
  const base = sanitiseFileName(original || "document", "document").replace(/\.[a-z0-9]{1,5}$/, "") || "document";
  return `${base.slice(0, 70)}.${EXT[mime]}`;
}

/** POST /api/uploads: one file (multipart field `file`) → `{ uploadToken, name, size, mime }`. */
export async function handlePublicUpload(request: Request): Promise<Response> {
  const denied = sameOriginGuard(request);
  if (denied) return denied;
  if (!publicUploadsAvailable()) return reply(503, { message: MSG.unavailable });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + BODY_SLACK) return reply(413, { message: MSG.tooBig });

  const now = Date.now();
  const rl = await rateLimit("upload", ipHash(clientIp(request.headers), now), now);
  if (!rl.ok) return reply(429, { message: MSG.rateLimited });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, { message: MSG.missing });
  }
  const files = form.getAll("file");
  const file = files[0];
  if (files.length !== 1 || !(file instanceof File) || file.size === 0) return reply(400, { message: MSG.missing });
  if (file.size > MAX_UPLOAD_BYTES) return reply(413, { message: MSG.tooBig });

  const original = Buffer.from(await file.arrayBuffer());
  if (original.length > MAX_UPLOAD_BYTES) return reply(413, { message: MSG.tooBig });
  const mime = sniffMime(original);
  if (!mime) return reply(415, { message: MSG.type });

  let out: Buffer;
  if (mime === "application/pdf") {
    if (isEncryptedPdf(original)) return reply(415, { message: MSG.encrypted });
    out = original;
  } else {
    try {
      out = await reencode(original, mime);
    } catch {
      return reply(415, { message: MSG.unreadable });
    }
    if (out.length > MAX_UPLOAD_BYTES) return reply(413, { message: MSG.tooBig });
  }

  try {
    const uploadId = newId(24);
    const sha256 = sha256Hex(out);
    await getBlobStore().put(BLOB_PATH.quarantine(uploadId), out, mime);
    const name = fileNameFor(file.name, mime);
    const uploadToken = signTokenFor("upload", uploadId, TOKEN_TTL_MS, { sha256, mime, size: out.length, name });
    return reply(200, { uploadToken, name, size: out.length, mime });
  } catch (err) {
    log.error("upload.store_failed", { err });
    return reply(500, { message: MSG.server });
  }
}

/* ── Claiming uploads inside a record's create flow ─────────────────────────────────────────── */

export type VerifiedUpload = { uploadId: string; sha256: string; mime: AllowedMime; size: number; name: string };

function isAllowedMime(v: unknown): v is AllowedMime {
  return typeof v === "string" && (ALLOWED_MIMES as readonly string[]).includes(v);
}

/**
 * Verifies upload tokens (signature, purpose, expiry) and that each quarantined file is still there
 * with the same hash. Bad, expired, duplicate or already-claimed tokens are skipped (logged), never
 * fatal: the request itself must not be lost because of a file.
 */
export async function verifyUploadTokens(tokens: readonly string[]): Promise<VerifiedUpload[]> {
  if (!tokens.length || !publicUploadsAvailable()) return [];
  const out: VerifiedUpload[] = [];
  const seen = new Set<string>();
  const store = getBlobStore();
  for (const token of tokens.slice(0, MAX_TOKENS)) {
    const v = verifyToken(token, "upload");
    const d = v?.d;
    if (!v || !d || seen.has(v.sub) || !isAllowedMime(d.mime) || typeof d.sha256 !== "string" || typeof d.size !== "number") {
      log.warn("upload.token_rejected", { reason: v ? "data" : "signature" });
      continue;
    }
    seen.add(v.sub);
    try {
      const blob = await store.get(BLOB_PATH.quarantine(v.sub));
      if (!blob || sha256Hex(blob.body) !== d.sha256) {
        log.warn("upload.quarantine_missing", {});
        continue;
      }
    } catch (err) {
      log.warn("upload.quarantine_unreadable", { err });
      continue;
    }
    out.push({ uploadId: v.sub, sha256: d.sha256, mime: d.mime, size: d.size, name: typeof d.name === "string" ? d.name : `document.${EXT[d.mime]}` });
  }
  return out;
}

export type AttachmentMove = { from: string; to: string };

/**
 * Writes attachments/{id} for each verified upload inside the record's transaction and returns the
 * file moves to run once it has committed.
 */
export function attachmentWritesTx(
  tx: Tx,
  uploads: readonly VerifiedUpload[],
  target: { collection: Extract<CollectionKey, "supportRequests" | "safeguardingConcerns">; docId: string; label: AttachmentLabel; now: Millis },
): AttachmentMove[] {
  const moves: AttachmentMove[] = [];
  for (const u of uploads) {
    const attId = newId();
    const storagePath = BLOB_PATH.caseAttachment(target.collection, target.docId, attId, EXT[u.mime]);
    const meta: AttachmentMeta = {
      fileName: u.name,
      mime: u.mime,
      sizeBytes: u.size,
      sha256: u.sha256,
      storagePath,
      label: u.mime === "application/pdf" ? target.label : target.label === "other" ? "photo" : target.label,
      uploadedBy: { kind: "public" },
      uploadedAt: target.now,
      imageSanitised: u.mime !== "application/pdf",
      scan: { status: "not_scanned", at: null },
      deletedAt: null,
    };
    tx.create(subDocPath(target.collection, target.docId, "attachments", attId), meta);
    moves.push({ from: BLOB_PATH.quarantine(u.uploadId), to: storagePath });
  }
  return moves;
}

/** Moves claimed files out of quarantine after the record exists. Failures are logged, never thrown. */
export async function moveAttachmentFiles(moves: readonly AttachmentMove[]): Promise<void> {
  const store = getBlobStore();
  for (const m of moves) {
    try {
      await store.move(m.from, m.to);
    } catch (err) {
      log.error("upload.claim_move_failed", { err });
    }
  }
}
