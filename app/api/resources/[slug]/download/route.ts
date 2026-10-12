// GET /api/resources/<slug>/download (PLAN D101): the public library download. Counts the download,
// then answers 302 with the content-hashed file at /m/public/resources/…. Anything that is not a
// published, public resource with a file goes back to its page (or the library), never to a file.

import { NextResponse, type NextRequest } from "next/server";
import { publicDownload } from "@/lib/server/public/downloads";

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  let decoded = "";
  try {
    decoded = decodeURIComponent(slug ?? "");
  } catch {
    decoded = "";
  }
  const target = await publicDownload(decoded);
  return NextResponse.redirect(new URL(target.url, request.url), { status: 302, headers: { "Cache-Control": "no-store" } });
}
