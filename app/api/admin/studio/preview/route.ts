// GET /api/admin/studio/preview?path=/about (PLAN D62; admin-ux §6.10): the website studio's iframe
// starts here. Staff who can read the website get the Draft Mode cookie and are sent to the page with
// `?studio=1`, where drafts show and the StudioBridge outlines the editable sections. Only same-site
// page paths are allowed (never /admin or /api), so this can't be used to bounce anyone elsewhere.

import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { has } from "@/lib/server/auth/permissions";
import { getViewer } from "@/lib/server/auth/session";

const NO_STORE = { "Cache-Control": "no-store" };

function safePath(raw: string | null): string {
  const p = (raw ?? "/").trim();
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\") || /^\/(admin|api|_next)(\/|$)/.test(p) || p.length > 300) return "/";
  return p.split("#")[0]!;
}

export async function GET(request: NextRequest): Promise<Response> {
  const v = await getViewer();
  if (!v || !(has(v, "content.read") || has(v, "content.edit"))) return new Response("Not found.", { status: 404, headers: NO_STORE });
  (await draftMode()).enable();
  const target = new URL(safePath(request.nextUrl.searchParams.get("path")), request.url);
  target.searchParams.set("studio", "1");
  return NextResponse.redirect(target, { status: 307, headers: NO_STORE });
}
