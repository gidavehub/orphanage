import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { TAG } from "@/lib/cache/tags";
import { routes } from "@/lib/routes";
import { drainAfterResponse } from "@/lib/server/email/outbox";
import { log } from "@/lib/server/log";
import { applyCheckoutSession } from "@/lib/server/payments/apply";
import { getStripe } from "@/lib/server/payments/stripe";

// GET /api/stripe/return?session_id= (integrations §3.5): Stripe sends the donor here after paying.
// The session is read from Stripe's API (never trusted from the query string) and applied with the
// same idempotent function as the webhook, so the thank-you page is right even before the webhook
// arrives. Never blocks the thank-you page: any problem is logged and the donor moves on (303).

export const maxDuration = 30;

export async function GET(request: NextRequest): Promise<Response> {
  const id = request.nextUrl.searchParams.get("session_id") ?? "";
  const stripe = getStripe();
  if (stripe && /^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    try {
      const session = await stripe.checkout.sessions.retrieve(id);
      if (session.status === "complete") {
        const outcome = await applyCheckoutSession(session, { source: "return" });
        if (outcome.touchedTotals) revalidateTag(TAG.donationTotals, "max");
        drainAfterResponse();
      }
    } catch (err) {
      log.warn("stripe.return.reconcile_failed", { err });
    }
  }
  return new Response(null, { status: 303, headers: { Location: new URL(routes.thankYou({ sessionId: id || undefined }), request.url).toString(), "Cache-Control": "no-store" } });
}
