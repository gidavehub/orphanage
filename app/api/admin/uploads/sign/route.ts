// POST /api/admin/uploads/sign (PLAN D97): a quarantine slot and a signed PUT URL for a resource PDF
// (≤ 25 MB). Staff who manage the library only. Body: { fileName, contentType, sizeBytes }.

import type { NextRequest } from "next/server";
import { has } from "@/lib/server/auth/permissions";
import { getViewer } from "@/lib/server/auth/session";
import { isSameOrigin } from "@/lib/server/security/origin";
import { signPdfUpload } from "@/lib/server/uploads/staff";

const HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return Response.json({ message: "Please use the Haven team site." }, { status: 403, headers: HEADERS });
  const v = await getViewer();
  if (!v) return Response.json({ message: "Please sign in again." }, { status: 401, headers: HEADERS });
  if (!has(v, "resource.manage")) return Response.json({ message: "You can't add files here." }, { status: 403, headers: HEADERS });
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ message: "Please choose a file." }, { status: 400, headers: HEADERS });
  }
  const r = await signPdfUpload(v, body);
  return r.ok ? Response.json(r, { headers: HEADERS }) : Response.json({ message: r.message }, { status: r.status, headers: HEADERS });
}
