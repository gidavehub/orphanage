// POST /api/admin/uploads/complete (PLAN D97): checks the uploaded PDF (magic bytes, size, no
// password), records its sha256 and page count, and readies it to be claimed by the resource save.
// Body: { uploadId }. Only the person who started the upload.

import type { NextRequest } from "next/server";
import { has } from "@/lib/server/auth/permissions";
import { getViewer } from "@/lib/server/auth/session";
import { isSameOrigin } from "@/lib/server/security/origin";
import { completePdfUpload } from "@/lib/server/uploads/staff";

const HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return Response.json({ message: "Please use the Haven team site." }, { status: 403, headers: HEADERS });
  const v = await getViewer();
  if (!v) return Response.json({ message: "Please sign in again." }, { status: 401, headers: HEADERS });
  if (!has(v, "resource.manage")) return Response.json({ message: "You can't add files here." }, { status: 403, headers: HEADERS });
  let uploadId = "";
  try {
    uploadId = String(((await request.json()) as { uploadId?: unknown }).uploadId ?? "");
  } catch {
    uploadId = "";
  }
  const r = await completePdfUpload(v, uploadId);
  return r.ok ? Response.json(r, { headers: HEADERS }) : Response.json({ message: r.message }, { status: r.status, headers: HEADERS });
}
