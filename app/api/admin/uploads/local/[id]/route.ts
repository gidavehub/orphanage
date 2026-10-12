// PUT /api/admin/uploads/local/<token> (PLAN D97): the practice-mode stand-in for a signed storage
// URL. The signed token names the quarantine path, the content type and the size limit (15 minutes);
// the body is written as-is and checked later by /api/admin/uploads/complete. 404 off local storage.

import type { NextRequest } from "next/server";
import { putLocalUpload } from "@/lib/server/uploads/staff";

const HEADERS = { "Cache-Control": "no-store" };

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  let token = "";
  try {
    token = decodeURIComponent(id);
  } catch {
    token = "";
  }
  const r = await putLocalUpload(token, request.headers.get("content-type"), Number(request.headers.get("content-length") ?? 0), async () => Buffer.from(await request.arrayBuffer()));
  if (r.status === 200) return new Response(null, { status: 200, headers: HEADERS });
  return r.message ? Response.json({ message: r.message }, { status: r.status, headers: HEADERS }) : new Response(null, { status: r.status, headers: HEADERS });
}
