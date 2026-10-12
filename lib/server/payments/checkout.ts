import "server-only";

// Stripe Checkout for the donate endpoint (integrations §3.3–3.4, PLAN D37, D65–D67). The intent was
// written first (D67); this creates the hosted Checkout Session (payment or subscription mode) with
// the haven_* metadata contract and a deterministic product per cause, then records the session id on
// the intent. Idempotent by intent id: a double submit returns the same session. Returns null when
// card payment is off, which tells POST /api/donations to record a pledge instead.

import type Stripe from "stripe";
import type { AllocationTarget, Frequency, Money } from "@/lib/model/enums";
import { targetKey } from "@/lib/model/enums";
import { FREQUENCY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { attachCheckoutSession } from "@/lib/server/giving/intents";
import { log } from "@/lib/server/log";
import type { HavenMeta } from "./metadata";
import { ensureCauseProduct } from "./products";
import type { DonationRequest } from "./schemas";
import { getStripe } from "./stripe";

const INTERVAL: Record<Exclude<Frequency, "one_time">, { interval: "month" | "year"; interval_count: number }> = {
  monthly: { interval: "month", interval_count: 1 },
  quarterly: { interval: "month", interval_count: 3 },
  annual: { interval: "year", interval_count: 1 },
};

export type CheckoutContext = {
  intentId: string;
  baseUrl: string;
  cause: { slug: string; title: string };
  /** After cover fees (what is charged) and before (what the donor chose). */
  amount: Money;
  baseAmount: Money;
  target: AllocationTarget;
  sponsorRef: string | null;
};

function isIdempotencyError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { type?: string }).type === "StripeIdempotencyError";
}

/**
 * Starts a hosted Checkout Session for a cash gift and returns its URL, or null when card payment is
 * off. Throws when Stripe refuses or can't be reached (the caller offers "pledge now, pay later").
 */
export async function startCheckout(req: DonationRequest & { mode: "cash" }, ctx: CheckoutContext): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const recurring = req.frequency !== "one_time";
  const meta: HavenMeta = {
    haven_v: "1",
    haven_intent: ctx.intentId,
    haven_kind: recurring ? "recurring" : "one_time",
    haven_frequency: req.frequency,
    haven_target: targetKey(ctx.target),
    haven_cause: ctx.cause.slug,
    ...(ctx.sponsorRef ? { haven_sponsor_ref: ctx.sponsorRef } : {}),
    haven_cover_fees: req.coverFees ? "1" : "0",
    haven_base_minor: String(ctx.baseAmount.amountMinor),
  };
  const product = await ensureCauseProduct(stripe, ctx.cause);
  const cancel = `${ctx.baseUrl}${routes.donate(ctx.cause.slug, { amount: req.amount, currency: req.currency, frequency: req.frequency })}`;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: recurring ? "subscription" : "payment",
    ...(recurring ? {} : { submit_type: "donate" as const }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: ctx.amount.currency.toLowerCase(),
          unit_amount: ctx.amount.amountMinor,
          product,
          ...(recurring ? { recurring: INTERVAL[req.frequency as Exclude<Frequency, "one_time">] } : {}),
        },
      },
    ],
    customer_email: req.donor.email,
    client_reference_id: ctx.intentId,
    metadata: meta,
    ...(recurring
      ? { subscription_data: { metadata: meta, description: `${FREQUENCY_LABEL[req.frequency]} gift to Haven: ${ctx.cause.title}`.slice(0, 500) } }
      : { payment_intent_data: { metadata: meta, description: `Gift to Haven: ${ctx.cause.title}`.slice(0, 500) } }),
    // The donor picked the currency deliberately.
    adaptive_pricing: { enabled: false },
    billing_address_collection: "auto",
    locale: "auto",
    custom_text: { submit: { message: "Haven will email your receipt. Card details are handled by Stripe and never stored by Haven." } },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    success_url: `${ctx.baseUrl}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${cancel}${cancel.includes("?") ? "&" : "?"}cancelled=1`,
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(params, { idempotencyKey: `checkout:${ctx.intentId}` });
  } catch (e) {
    // Same key, different parameters (the donor went back and changed something): one fresh try.
    if (!isIdempotencyError(e)) throw e;
    session = await stripe.checkout.sessions.create(params, { idempotencyKey: `checkout:${ctx.intentId}:${Date.now().toString(36)}` });
  }
  if (!session.url) throw new Error("Stripe returned a session without a URL.");
  try {
    await attachCheckoutSession(ctx.intentId, session.id);
  } catch (err) {
    // The session simply expires if the intent can't record it; the webhook still finds it by metadata.
    log.warn("stripe.checkout.attach_failed", { err });
  }
  return { url: session.url };
}
