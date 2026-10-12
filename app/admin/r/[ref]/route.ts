// GET /admin/r/<ref> (PLAN D74): the short link in emails and notifications. It only redirects to
// the record's home (signed out → sign-in); that page checks access again.

import { NextResponse, type NextRequest } from "next/server";
import { adminHrefOfRef, kindOfRef, normaliseRef } from "@/lib/model/refs";
import { getViewer } from "@/lib/server/auth/session";

export async function GET(request: NextRequest, ctx: { params: Promise<{ ref: string }> }): Promise<Response> {
  const { ref: raw } = await ctx.params;
  let decoded = "";
  try {
    decoded = decodeURIComponent(raw ?? "");
  } catch {
    decoded = "";
  }
  const ref = normaliseRef(decoded);
  const target = ref ? adminHrefOfRef(ref, kindOfRef(ref) ?? undefined) : "/admin";
  const v = await getViewer();
  const href = v ? target : `/admin/login?next=${encodeURIComponent(target)}`;
  return NextResponse.redirect(new URL(href, request.url), { status: 307, headers: { "Cache-Control": "private, no-store" } });
}
