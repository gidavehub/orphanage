import type { NextRequest } from "next/server";
import { routes } from "@/lib/routes";
import { log } from "@/lib/server/log";
import { payLinkSession } from "@/lib/server/payments/pay";
import { signTokenFor, verifyToken } from "@/lib/server/security/hmac";
import { baseUrl } from "@/lib/server/url";

// GET /api/donations/pay?t= (integrations §3.11): the link in "Card payments are now open". Verifies
// the 14-day `pay` token, then opens a fresh Stripe Checkout for the SAME pledged gift. A gift that is
// no longer waiting (already paid) goes to its thank-you page; a bad or expired link to /link-expired.

const NO_STORE = { "Cache-Control": "no-store" };

const go = (url: string, request: NextRequest) => new Response(null, { status: 303, headers: { Location: new URL(url, request.url).toString(), ...NO_STORE } });

export async function GET(request: NextRequest): Promise<Response> {
  const claim = verifyToken(request.nextUrl.searchParams.get("t"), "pay");
  if (!claim) return go("/link-expired", request);
  try {
    const url = await payLinkSession(claim.sub, baseUrl(request));
    if (url) return go(url, request);
  } catch (err) {
    log.warn("pay.session_failed", { err });
  }
  return go(routes.thankYou({ ref: claim.sub, t: signTokenFor("thanks", claim.sub, 7 * 86_400_000) }), request);
}
