// GET /api/admin/search?q= (admin-ux §3.5): Find's record results for the signed-in person. The
// server decides what may be seen; concerns appear only by exact reference, with a lock.

import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/server/auth/session";
import { searchAll } from "@/lib/server/dal/search";

const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest): Promise<Response> {
  const v = await getViewer();
  if (!v) return Response.json({ error: "signed_out" }, { status: 401, headers: HEADERS });
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  return Response.json({ hits: await searchAll(q) }, { headers: HEADERS });
}
