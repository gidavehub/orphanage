import "server-only";

// Blob storage (data-model §7.2, §8.4, §10.6; PLAN D96–D100).
//   local       → .data/storage (signed URLs through /api/dev/files, HMAC 60 s)
//   firestore   → the private Firebase bucket (v4 signed URLs)
//   unavailable → "none": reads find nothing, writes throw BackendUnavailableError, so upload UIs show
//                 "our team will ask you securely" instead.
//
// Key layout (D98): public/media/{mediaId}/{sha256-12}.webp, public/resources/{id}/{sha256-12}.pdf,
// private/resources/…, private/cases/{collection}/{docId}/{attId}.{ext}, private/consents/…,
// private/receipts/{yyyy}/{n}.pdf, quarantine/{uploadId}. Only `public/` is ever served (via /m).

import { isValidDocumentId } from "@/lib/model/enums";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { env, resolveBackend } from "@/lib/server/env";
import { gcsBlobStore } from "./gcs";
import { localBlobStore } from "./local";

export { assertBlobPath, contentTypeFor, localUploadTarget, verifyDevFileToken } from "./local";

export interface BlobStore {
  readonly kind: "gcs" | "local" | "none";
  put(path: string, body: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<{ body: Buffer; contentType: string; size: number } | null>;
  stream(path: string): Promise<{ stream: ReadableStream; contentType: string; size: number } | null>;
  move(from: string, to: string): Promise<void>;
  delete(path: string): Promise<void>;
  /** Number of objects removed. */
  deletePrefix(prefix: string): Promise<number>;
  /** Local: /api/dev/files/<path>?t=<hmac, 60 s>. GCS: a v4 signed URL. */
  signedUrl(path: string, opts: { ttlSec: number; disposition?: "inline" | "attachment" }): Promise<string>;
  signedUploadUrl(
    path: string,
    opts: { contentType: string; maxBytes: number; ttlSec: number },
  ): Promise<{ url: string; method: "PUT"; headers: Record<string, string> }>;
}

function refuse(): never {
  throw new BackendUnavailableError("File storage is not switched on yet.");
}

const none: BlobStore = {
  kind: "none",
  put: async () => refuse(),
  get: async () => null,
  stream: async () => null,
  move: async () => refuse(),
  delete: async () => refuse(),
  deletePrefix: async () => 0,
  signedUrl: async () => refuse(),
  signedUploadUrl: async () => refuse(),
};

/** The process-wide blob store. Never throws. */
export function getBlobStore(): BlobStore {
  let backend;
  try {
    backend = resolveBackend();
  } catch {
    return none;
  }
  if (backend === "local") return localBlobStore;
  if (backend === "firestore" && env.firebase.storageBucket) return gcsBlobStore;
  return none;
}

/** True when files can be stored (uploads offered). */
export function blobStoreAvailable(): boolean {
  return getBlobStore().kind !== "none";
}

function id(value: string): string {
  if (!isValidDocumentId(value)) throw new Error("Invalid storage path segment.");
  return value;
}

function sha12(value: string): string {
  if (!/^[a-f0-9]{12}$/.test(value)) throw new Error("Invalid content hash (expected 12 lowercase hex characters).");
  return value;
}

function ext(value: string): string {
  if (!/^[a-z0-9]{1,5}$/.test(value)) throw new Error("Invalid file extension.");
  return value;
}

/** Builders for every storage key; segments are validated so a path can never escape its prefix. */
export const BLOB_PATH = {
  media: (mediaId: string, hash: string, extension: string) => `public/media/${id(mediaId)}/${sha12(hash)}.${ext(extension)}`,
  publicResource: (resourceId: string, hash: string) => `public/resources/${id(resourceId)}/${sha12(hash)}.pdf`,
  privateResource: (resourceId: string, hash: string) => `private/resources/${id(resourceId)}/${sha12(hash)}.pdf`,
  caseAttachment: (collection: string, docId: string, attId: string, extension: string) =>
    `private/cases/${id(collection)}/${id(docId)}/${id(attId)}.${ext(extension)}`,
  consent: (consentId: string, attId: string, extension: string) => `private/consents/${id(consentId)}/${id(attId)}.${ext(extension)}`,
  receipt: (year: number, n: string) => `private/receipts/${Math.trunc(year)}/${id(n)}.pdf`,
  quarantine: (uploadId: string) => `quarantine/${id(uploadId)}`,
} as const;

/** The same-origin URL of a public blob: "/m/public/media/…". Only `public/` paths may be served. */
export function publicUrl(path: string): string {
  if (!path.startsWith("public/") || path.includes("..") || path.includes("\\")) {
    throw new Error("Only public/ storage paths have a public URL.");
  }
  return `/m/${path}`;
}
