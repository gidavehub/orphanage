import "server-only";

// Google Cloud Storage driver (data-model §7.2, §10.6; PLAN D96–D100) for the private Firebase bucket
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET. Uniform bucket-level access, public access prevention enforced:
// nothing is public. `public/` objects are streamed by app/m/[...path]; private ones by audited admin
// routes or 60-second v4 signed URLs. Compiled now, exercised when credentials exist (I8).

import { Readable } from "node:stream";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/server/db/firestore";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { env } from "@/lib/server/env";
import type { BlobStore } from "./index";
import { assertBlobPath, contentTypeFor } from "./local";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

function bucket(): Bucket {
  const name = env.firebase.storageBucket;
  if (!name) throw new BackendUnavailableError("File storage is not configured (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).");
  return getStorage(adminApp()).bucket(name);
}

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 404 || code === "404";
}

function cacheControlFor(key: string): string {
  if (key.startsWith("public/resources/")) return "public, max-age=31536000, immutable";
  if (key.startsWith("public/")) return "public, max-age=86400";
  return "private, no-store";
}

function dispositionHeader(key: string, disposition: "inline" | "attachment"): string {
  const name = (key.split("/").pop() ?? "file").replace(/[^A-Za-z0-9._-]/g, "_");
  return `${disposition}; filename="${name}"`;
}

export const gcsBlobStore: BlobStore = {
  kind: "gcs",

  async put(key, body, contentType) {
    assertBlobPath(key);
    await bucket().file(key).save(body, { resumable: false, contentType, metadata: { contentType, cacheControl: cacheControlFor(key) } });
  },

  async get(key) {
    assertBlobPath(key);
    const file = bucket().file(key);
    try {
      const [[body], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
      return { body, contentType: meta.contentType ?? contentTypeFor(key), size: Number(meta.size ?? body.length) };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  },

  async stream(key) {
    assertBlobPath(key);
    const file = bucket().file(key);
    let meta;
    try {
      [meta] = await file.getMetadata();
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
    const stream = Readable.toWeb(file.createReadStream()) as unknown as ReadableStream;
    return { stream, contentType: meta.contentType ?? contentTypeFor(key), size: Number(meta.size ?? 0) };
  },

  async move(from, to) {
    assertBlobPath(from);
    assertBlobPath(to);
    const b = bucket();
    await b.file(from).move(b.file(to));
  },

  async delete(key) {
    assertBlobPath(key);
    await bucket().file(key).delete({ ignoreNotFound: true });
  },

  async deletePrefix(prefix) {
    const clean = prefix.replace(/\/+$/, "");
    assertBlobPath(clean);
    const [files] = await bucket().getFiles({ prefix: `${clean}` });
    const matching = files.filter((f) => f.name === clean || f.name.startsWith(`${clean}/`));
    await Promise.all(matching.map((f) => f.delete({ ignoreNotFound: true })));
    return matching.length;
  },

  async signedUrl(key, opts) {
    assertBlobPath(key);
    const [url] = await bucket()
      .file(key)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + Math.max(1, opts.ttlSec) * 1000,
        ...(opts.disposition ? { responseDisposition: dispositionHeader(key, opts.disposition) } : {}),
      });
    return url;
  },

  async signedUploadUrl(key, opts) {
    assertBlobPath(key);
    const range = `0,${Math.max(1, Math.floor(opts.maxBytes))}`;
    const [url] = await bucket()
      .file(key)
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + Math.max(1, opts.ttlSec) * 1000,
        contentType: opts.contentType,
        extensionHeaders: { "x-goog-content-length-range": range },
      });
    return { url, method: "PUT", headers: { "Content-Type": opts.contentType, "x-goog-content-length-range": range } };
  },
};
