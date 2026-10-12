import { handlePublicUpload } from "@/lib/server/intake/upload";

// POST /api/uploads: public case uploads, one file per request (PLAN D96, data-model §10.6). The
// work (same-origin check, rate limit, magic bytes, sharp re-encode, quarantine, HMAC token) lives in
// lib/server/intake/upload.ts. Answers `{ uploadToken, name, size, mime }` or `{ message }`.
export async function POST(request: Request): Promise<Response> {
  return handlePublicUpload(request);
}
