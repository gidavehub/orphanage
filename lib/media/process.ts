import "server-only";

// Staff photo uploads (PLAN D53, D97; admin-ux §6.13): POST /api/admin/media/upload takes one photo
// (≤ 4 MB) through the function: magic bytes checked (JPEG, PNG, WebP; the claimed type is ignored),
// re-encoded by sharp to WebP (rotation applied, at most 2400 px, EXIF and GPS removed because sharp
// drops metadata unless asked to keep it), written to quarantine/{uploadId} with a mediaUploads record.
// createMediaAsset (lib/content/media-actions) then claims it with the safeguarding answers.

import { createHash } from "node:crypto";
import sharp from "sharp";
import type { MediaUpload } from "@/lib/model/domain/media";
import type { Viewer } from "@/lib/model/viewer";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import { log } from "@/lib/server/log";
import { sanitiseFileName } from "@/lib/server/security/sanitise";
import { BLOB_PATH, blobStoreAvailable, getBlobStore } from "@/lib/server/storage";

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2400;
const MAX_PIXELS = 60_000_000;

export type PhotoUploadResult =
  | { ok: true; uploadId: string; width: number; height: number; sizeBytes: number; preview: string; fileName: string }
  | { ok: false; status: number; message: string };

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

export async function processPhotoUpload(v: Viewer, file: File | null): Promise<PhotoUploadResult> {
  if (!blobStoreAvailable()) return { ok: false, status: 503, message: "Photo uploads switch on once storage is connected." };
  if (!file || typeof file.arrayBuffer !== "function") return { ok: false, status: 400, message: "Please choose one photo." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, status: 413, message: "This photo is bigger than 4 MB. Please choose a smaller one." };
  const input = Buffer.from(await file.arrayBuffer());
  if (!sniff(input)) return { ok: false, status: 415, message: "Please choose a JPG, PNG or WebP photo." };
  let out: { data: Buffer; info: { width: number; height: number } };
  try {
    out = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    log.warn("media.upload_decode_failed", { err });
    return { ok: false, status: 422, message: "We couldn't read this photo. Please try another copy." };
  }
  const uploadId = `up-${newId(16)}`;
  const tempPath = BLOB_PATH.quarantine(uploadId);
  const sha256 = createHash("sha256").update(out.data).digest("hex");
  const now = Date.now();
  await getBlobStore().put(tempPath, out.data, "image/webp");
  const record: MediaUpload = {
    createdAt: now,
    expireAt: now + 86_400_000,
    uploadedBy: v.uid,
    kind: "image",
    mime: "image/webp",
    sizeBytes: out.data.length,
    sha256,
    width: out.info.width,
    height: out.info.height,
    tempPath,
    metadataStripped: true,
    fileName: sanitiseFileName(file.name || "photo.jpg"),
    status: "pending",
    claimedAt: null,
    mediaId: null,
  };
  await getStore().create(`${C.mediaUploads}/${uploadId}`, record);
  const thumb = await sharp(out.data).resize({ width: 480, height: 480, fit: "inside" }).webp({ quality: 70 }).toBuffer();
  return { ok: true, uploadId, width: out.info.width, height: out.info.height, sizeBytes: out.data.length, preview: `data:image/webp;base64,${thumb.toString("base64")}`, fileName: record.fileName };
}
