// GET /r/<token> (PLAN D59, D112): the link in the `report_delivery` email. A valid link for an
// approved request is sent (302) to a 60-second signed URL for the file, so the storage path is never
// exposed; anything else, including garbage, lands on the friendly /link-expired page. Never cached.

import { NextResponse, type NextRequest } from "next/server";
import { deliveryDownload } from "@/lib/server/public/downloads";

const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  let decoded = "";
  try {
    decoded = decodeURIComponent(token ?? "");
  } catch {
    decoded = "";
  }
  const url = decoded ? await deliveryDownload(decoded) : null;
  return NextResponse.redirect(new URL(url ?? "/link-expired", request.url), { status: 302, headers: NO_STORE });
}
