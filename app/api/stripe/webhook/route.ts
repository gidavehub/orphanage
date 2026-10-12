import Stripe from "stripe";
import { revalidateTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import { drainAfterResponse } from "@/lib/server/email/outbox";
import { env, features } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { isEventProcessed, recordEventError } from "@/lib/server/payments/events";
import { dispatch } from "@/lib/server/payments/handlers";

// POST /api/stripe/webhook (integrations §3.6; PLAN D68, D69). The RAW body is verified with the
// signing secret before anything else; duplicates short-circuit on stripeEvents/{id}; each event is
// applied in one domain transaction. A failure answers 500 so Stripe retries (for up to 3 days).
// Logs carry event ids and types only, never payloads. Node is the only runtime in Next 16 (and
// `runtime` is not allowed with cacheComponents), so the raw body and firebase-admin both work.

export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const secret = env.stripe.webhookSecret;
  if (!secret) return new Response("Payments are not configured.", { status: 503, headers: NO_STORE });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature.", { status: 400, headers: NO_STORE });
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return new Response("Invalid signature.", { status: 400, headers: NO_STORE });
  }

  if (features.stripe && event.livemode !== features.stripeLive) {
    log.warn("stripe.webhook.mode_mismatch", { id: event.id });
    return Response.json({ received: true, ignored: "mode" }, { headers: NO_STORE });
  }
  if (await isEventProcessed(event.id)) return Response.json({ received: true, duplicate: true }, { headers: NO_STORE });

  try {
    const outcome = await dispatch(event);
    if (outcome.touchedTotals) revalidateTag(TAG.donationTotals, "max");
    drainAfterResponse();
    log.info("stripe.webhook.applied", { id: event.id, type: event.type, result: outcome.result });
    return Response.json({ received: true, result: outcome.result }, { headers: NO_STORE });
  } catch (err) {
    log.error("stripe.webhook.failed", { id: event.id, type: event.type, err });
    await recordEventError({ id: event.id, type: event.type }, err);
    return new Response("Retry later.", { status: 500, headers: NO_STORE });
  }
}
