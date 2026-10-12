import "server-only";

// Staff file uploads (PLAN D97; data-model §10.6): large files never pass through a Server Action.
//   1. POST /api/admin/uploads/sign      → a quarantine path, a mediaUploads/{uploadId} record and a
//      signed PUT URL (GCS v4, or /api/admin/uploads/local/<token> in practice mode), 15 minutes.
//   2. The browser PUTs the file there.
//   3. POST /api/admin/uploads/complete  → magic bytes and size checked, sha256 computed; the record
//      is ready to be claimed by the action that saves the resource (`claimPdfUpload`).
// Only PDFs up to 25 MB here (resource files); photos go through /api/admin/media/upload (A7).

import { createHash } from "node:crypto";
import type { MediaUpload } from "@/lib/model/domain/media";
import type { Millis } from "@/lib/model/enums";
import type { Viewer } from "@/lib/model/viewer";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import type { Tx } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";
import { sanitiseFileName } from "@/lib/server/security/sanitise";
import { BLOB_PATH, blobStoreAvailable, getBlobStore, localUploadTarget } from "@/lib/server/storage";

export const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;
const SIGN_TTL_SEC = 15 * 60;
const DAY = 86_400_000;

export type SignResult = { ok: true; uploadId: string; url: string; method: "PUT"; headers: Record<string, string> } | { ok: false; status: number; message: string };
export type CompleteResult = { ok: true; uploadId: string; sizeBytes: number; pageCount: number | null; fileName: string } | { ok: false; status: number; message: string };

const MSG = {
  unavailable: "File storage isn't switched on yet, so files can't be added here.",
  type: "Please choose a PDF file.",
  tooBig: "This file is bigger than 25 MB. Please make it smaller (for example, “Reduce file size” when saving the PDF).",
  missing: "The file didn't arrive. Please try again.",
  notPdf: "This isn't a PDF we can read. Please export it as a PDF and try again.",
  encrypted: "This PDF is password-protected. Please save a copy without a password and try again.",
  notYours: "This upload belongs to someone else.",
} as const;

/** Step 1: a quarantine slot and where to PUT the file. */
export async function signPdfUpload(v: Viewer, input: { fileName?: unknown; contentType?: unknown; sizeBytes?: unknown }): Promise<SignResult> {
  if (!blobStoreAvailable()) return { ok: false, status: 503, message: MSG.unavailable };
  if (input.contentType !== "application/pdf") return { ok: false, status: 415, message: MSG.type };
  const size = Number(input.sizeBytes);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, status: 400, message: MSG.missing };
  if (size > MAX_RESOURCE_BYTES) return { ok: false, status: 413, message: MSG.tooBig };
  const uploadId = newId();
  const tempPath = BLOB_PATH.quarantine(uploadId);
  const now = Date.now();
  const record: MediaUpload = {
    createdAt: now,
    expireAt: now + DAY,
    uploadedBy: v.uid,
    kind: "pdf",
    mime: "application/pdf",
    sizeBytes: 0,
    sha256: "",
    width: null,
    height: null,
    tempPath,
    metadataStripped: false,
    fileName: sanitiseFileName(typeof input.fileName === "string" ? input.fileName : "document.pdf"),
    status: "pending",
    claimedAt: null,
    mediaId: null,
  };
  await getStore().create(docPath("mediaUploads", uploadId), record);
  const target = await getBlobStore().signedUploadUrl(tempPath, { contentType: "application/pdf", maxBytes: MAX_RESOURCE_BYTES, ttlSec: SIGN_TTL_SEC });
  return { ok: true, uploadId, ...target };
}

/**
 * Step 2 in practice mode: PUT /api/admin/uploads/local/<token>. The token names the quarantine path,
 * the type and the size limit. Returns the HTTP status and, on failure, a sentence.
 */
export async function putLocalUpload(token: string, contentType: string | null, declaredBytes: number, read: () => Promise<Buffer>): Promise<{ status: number; message?: string }> {
  const store = getBlobStore();
  if (store.kind !== "local") return { status: 404 };
  const target = localUploadTarget(token);
  if (!target) return { status: 403, message: "This upload link has expired. Please choose the file again." };
  if ((contentType ?? "").split(";")[0]!.trim() !== target.contentType) return { status: 415, message: MSG.type };
  if (declaredBytes > target.maxBytes) return { status: 413, message: MSG.tooBig };
  const body = await read();
  if (body.length === 0) return { status: 400, message: MSG.missing };
  if (body.length > target.maxBytes) return { status: 413, message: MSG.tooBig };
  await store.put(target.path, body, target.contentType);
  return { status: 200 };
}

/** Pages in a PDF, counted from its page objects (good enough for the "12 pages" line), or null. */
function pageCountOf(buf: Buffer): number | null {
  const text = buf.toString("latin1");
  const n = (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  return n > 0 && n < 100_000 ? n : null;
}

/** Step 3: checks what arrived and readies it to be claimed. */
export async function completePdfUpload(v: Viewer, uploadId: string): Promise<CompleteResult> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(uploadId)) return { ok: false, status: 400, message: MSG.missing };
  const path = docPath("mediaUploads", uploadId);
  const rec = await getStore().get<MediaUpload>(path);
  if (!rec || rec.status !== "pending") return { ok: false, status: 404, message: MSG.missing };
  if (rec.uploadedBy !== v.uid) return { ok: false, status: 403, message: MSG.notYours };
  const blob = await getBlobStore().get(rec.tempPath);
  if (!blob) return { ok: false, status: 404, message: MSG.missing };
  if (blob.size > MAX_RESOURCE_BYTES) {
    await getBlobStore().delete(rec.tempPath).catch(() => undefined);
    return { ok: false, status: 413, message: MSG.tooBig };
  }
  const head = blob.body.subarray(0, 1024).toString("latin1");
  if (!head.includes("%PDF-")) {
    await getBlobStore().delete(rec.tempPath).catch(() => undefined);
    return { ok: false, status: 415, message: MSG.notPdf };
  }
  if (/\/Encrypt\s/.test(blob.body.subarray(Math.max(0, blob.body.length - 4096)).toString("latin1"))) {
    await getBlobStore().delete(rec.tempPath).catch(() => undefined);
    return { ok: false, status: 422, message: MSG.encrypted };
  }
  const sha256 = createHash("sha256").update(blob.body).digest("hex");
  const pageCount = pageCountOf(blob.body);
  await getStore().update(path, { sizeBytes: blob.size, sha256, pageCount });
  return { ok: true, uploadId, sizeBytes: blob.size, pageCount, fileName: rec.fileName };
}

export type ClaimedFile = { storagePath: string; sizeBytes: number; pageCount: number | null; sha256: string; fileName: string };

/**
 * Claims a completed upload for a resource inside the saving transaction (marks it claimed) and
 * returns where the file will live. Call `moveClaimedFile` after the commit.
 */
export async function claimPdfUploadTx(tx: Tx, v: Viewer, uploadId: string, dest: (sha12: string) => string, now: Millis): Promise<(ClaimedFile & { tempPath: string }) | string> {
  const path = docPath("mediaUploads", uploadId);
  const rec = await tx.get<MediaUpload>(path);
  if (!rec) return "The file has expired. Please choose it again.";
  if (rec.uploadedBy !== v.uid) return MSG.notYours;
  if (rec.status !== "pending") return "This file has already been used.";
  if (!rec.sha256) return "The file is still uploading. Please wait a moment and try again.";
  tx.update(path, { status: "claimed", claimedAt: now });
  return { storagePath: dest(rec.sha256.slice(0, 12)), sizeBytes: rec.sizeBytes, pageCount: rec.pageCount ?? null, sha256: rec.sha256, fileName: rec.fileName, tempPath: rec.tempPath };
}

/** Moves a claimed file from quarantine to its final path. Logs (never throws) on failure. */
export async function moveClaimedFile(from: string, to: string): Promise<boolean> {
  try {
    await getBlobStore().move(from, to);
    return true;
  } catch (err) {
    log.error("uploads.move_failed", { from, to, err });
    return false;
  }
}
