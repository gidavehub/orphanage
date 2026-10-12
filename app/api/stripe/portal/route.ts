import type { NextRequest } from "next/server";
import { routes } from "@/lib/routes";
import { portalSessionFor, stripeGiftsOf } from "@/lib/server/payments/portal";
import { verifyToken } from "@/lib/server/security/hmac";
import { baseUrl } from "@/lib/server/url";

// GET /api/stripe/portal?t=&c= (integrations §3.7): opens Stripe's Customer Portal for the donor in
// the signed link. One card gift → straight to the portal; several → the chooser; an expired link or
// no card gift → back to /donate/manage. Always 303, never cached.

const NO_STORE = { "Cache-Control": "no-store" };

function go(url: string, request: NextRequest): Response {
  return new Response(null, { status: 303, headers: { Location: new URL(url, request.url).toString(), ...NO_STORE } });
}

export async function GET(request: NextRequest): Promise<Response> {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const c = request.nextUrl.searchParams.get("c");
  const claim = verifyToken(t, "portal");
  if (!claim) return go(`${routes.manage()}?expired=1`, request);
  const idx = c !== null && /^\d{1,2}$/.test(c) ? Number(c) : null;
  if (idx === null) {
    const gifts = await stripeGiftsOf(claim.sub).catch(() => []);
    if (gifts.length > 1) return go(`/donate/manage/choose?t=${encodeURIComponent(t)}`, request);
  }
  const url = await portalSessionFor(claim.sub, idx, baseUrl(request));
  return url ? go(url, request) : go(routes.manage(), request);
}
