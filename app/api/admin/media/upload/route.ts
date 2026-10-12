// POST /api/admin/media/upload (PLAN D97; admin-ux §6.13): one photo (≤ 4 MB, multipart field `file`)
// re-encoded to WebP without EXIF or GPS, waiting in quarantine for createMediaAsset to claim it with
// the safeguarding answers. Staff who manage media only.

import type { NextRequest } from "next/server";
import { processPhotoUpload } from "@/lib/media/process";
import { has } from "@/lib/server/auth/permissions";
import { getViewer } from "@/lib/server/auth/session";
import { isSameOrigin } from "@/lib/server/security/origin";

const HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return Response.json({ message: "Please use the Haven team site." }, { status: 403, headers: HEADERS });
  const v = await getViewer();
  if (!v) return Response.json({ message: "Please sign in again." }, { status: 401, headers: HEADERS });
  if (!has(v, "media.manage")) return Response.json({ message: "You can't add photos." }, { status: 403, headers: HEADERS });
  if (Number(request.headers.get("content-length") ?? 0) > 4.5 * 1024 * 1024) return Response.json({ message: "This photo is bigger than 4 MB. Please choose a smaller one." }, { status: 413, headers: HEADERS });
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    file = null;
  }
  const r = await processPhotoUpload(v, file);
  return r.ok ? Response.json(r, { headers: HEADERS }) : Response.json({ message: r.message }, { status: r.status, headers: HEADERS });
}
