import "server-only";

// Local BlobStore driver (data-model §8.4, PLAN §4.7, D96–D100): files under .data/storage using the
// same keys as the bucket (public/…, private/…, quarantine/…). Each file has a sidecar
// "<file>.meta.json" with its content type, size and hash. Signed URLs are /api/dev/files/<path>?t=
// (HMAC, 60 s by default); staff signed PUTs point at /api/admin/uploads/local/<token> (A5's route),
// whose DAL reads the target with localUploadTarget(token). Never used on Vercel.

import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { DOCUMENT_ID_RE } from "@/lib/model/enums";
import { dataPath, readFileOrNull, removePath, withFsRetry, writeFilesAtomic } from "@/lib/server/db/local-fs";
import { signToken, verifyToken } from "@/lib/server/security/hmac";
import type { BlobStore } from "./index";

export const BLOB_ROOTS = ["public", "private", "quarantine"] as const;
const META_SUFFIX = ".meta.json";

type BlobMeta = { contentType: string; size: number; sha256: string; createdAt: number };

/**
 * Validates a storage key and returns its segments: a known root, then segments that are valid
 * document ids (no "/", no "..", no leading dot), never a sidecar name.
 */
export function assertBlobPath(key: string): string[] {
  if (typeof key !== "string" || !key || key.length > 512) throw new Error("Invalid storage path.");
  const segments = key.split("/");
  if (!(BLOB_ROOTS as readonly string[]).includes(segments[0]) || segments.length < 2) throw new Error("Invalid storage path.");
  for (const s of segments) if (!DOCUMENT_ID_RE.test(s)) throw new Error("Invalid storage path.");
  if (key.endsWith(META_SUFFIX)) throw new Error("Invalid storage path.");
  return segments;
}

const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  ics: "text/calendar; charset=utf-8",
};

/** Content type from a key's extension (fallback application/octet-stream). */
export function contentTypeFor(key: string): string {
  const ext = key.split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? "application/octet-stream";
}

function fileOf(key: string): string {
  return dataPath("storage", ...assertBlobPath(key));
}

async function readMeta(file: string): Promise<BlobMeta | null> {
  const raw = await readFileOrNull(`${file}${META_SUFFIX}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8")) as BlobMeta;
  } catch {
    return null;
  }
}

async function countFiles(dir: string): Promise<number> {
  let n = 0;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (e.isDirectory()) n += await countFiles(path.join(dir, e.name));
    else if (!e.name.endsWith(META_SUFFIX) && !e.name.endsWith(".tmp")) n++;
  }
  return n;
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** The target of a local signed PUT (A5's /api/admin/uploads/local/[id] route verifies it), or null. */
export function localUploadTarget(token: string): { path: string; contentType: string; maxBytes: number } | null {
  const v = verifyToken(token, "staff_upload");
  if (!v || !v.d) return null;
  const contentType = typeof v.d.contentType === "string" ? v.d.contentType : null;
  const maxBytes = typeof v.d.maxBytes === "number" ? v.d.maxBytes : null;
  if (!contentType || !maxBytes) return null;
  try {
    assertBlobPath(v.sub);
  } catch {
    return null;
  }
  return { path: v.sub, contentType, maxBytes };
}

/** Verifies a /api/dev/files token for `key`; returns the requested disposition, or null. */
export function verifyDevFileToken(key: string, token: string | null): { disposition: "inline" | "attachment" } | null {
  const v = verifyToken(token, "dev_file");
  if (!v || v.sub !== key) return null;
  return { disposition: v.d?.disposition === "attachment" ? "attachment" : "inline" };
}

export const localBlobStore: BlobStore = {
  kind: "local",

  async put(key, body, contentType) {
    const file = fileOf(key);
    const meta: BlobMeta = { contentType, size: body.length, sha256: createHash("sha256").update(body).digest("hex"), createdAt: Date.now() };
    await writeFilesAtomic([
      [file, body],
      [`${file}${META_SUFFIX}`, JSON.stringify(meta)],
    ]);
  },

  async get(key) {
    const file = fileOf(key);
    const body = await readFileOrNull(file);
    if (!body) return null;
    const meta = await readMeta(file);
    return { body, contentType: meta?.contentType ?? contentTypeFor(key), size: body.length };
  },

  async stream(key) {
    const file = fileOf(key);
    let size: number;
    try {
      size = (await withFsRetry(() => fs.stat(file))).size;
    } catch {
      return null;
    }
    const meta = await readMeta(file);
    const stream = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream;
    return { stream, contentType: meta?.contentType ?? contentTypeFor(key), size };
  },

  async move(from, to) {
    const src = fileOf(from);
    const dest = fileOf(to);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await withFsRetry(() => fs.rename(src, dest));
    try {
      await withFsRetry(() => fs.rename(`${src}${META_SUFFIX}`, `${dest}${META_SUFFIX}`));
    } catch {
      // older file without a sidecar: the content type falls back to the extension
    }
  },

  async delete(key) {
    const file = fileOf(key);
    await removePath(file);
    await removePath(`${file}${META_SUFFIX}`);
  },

  async deletePrefix(prefix) {
    const clean = prefix.replace(/\/+$/, "");
    const target = fileOf(clean);
    let stat;
    try {
      stat = await fs.stat(target);
    } catch {
      return 0;
    }
    if (stat.isDirectory()) {
      const n = await countFiles(target);
      await removePath(target);
      return n;
    }
    await removePath(target);
    await removePath(`${target}${META_SUFFIX}`);
    return 1;
  },

  async signedUrl(key, opts) {
    assertBlobPath(key);
    const token = signToken({ p: "dev_file", sub: key, exp: Date.now() + Math.max(1, opts.ttlSec) * 1000, d: { disposition: opts.disposition ?? "inline" } });
    return `/api/dev/files/${encodeKey(key)}?t=${encodeURIComponent(token)}`;
  },

  async signedUploadUrl(key, opts) {
    assertBlobPath(key);
    const token = signToken({
      p: "staff_upload",
      sub: key,
      exp: Date.now() + Math.max(1, opts.ttlSec) * 1000,
      d: { contentType: opts.contentType, maxBytes: opts.maxBytes },
    });
    return { url: `/api/admin/uploads/local/${encodeURIComponent(token)}`, method: "PUT", headers: { "Content-Type": opts.contentType } };
  },
};
