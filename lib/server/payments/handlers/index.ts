import "server-only";

// Webhook event dispatch (integrations §3.6; PLAN D68, D69). Reads from Stripe happen first, outside
// any transaction (enrichment), then one domain transaction per event applies the change and marks
// the event processed. Unknown types are acknowledged and logged by type only (never payloads).

import type Stripe from "stripe";
import { log } from "@/lib/server/log";
import {
  applyAsyncResult,
  applyChargeRefunded,
  applyCheckoutSession,
  applyDispute,
  applyInvoiceFailed,
  applyInvoicePaid,
  applySessionExpired,
  applySubscription,
  type ApplyOutcome,
  type ChargeLike,
  type InvoiceLike,
  type SessionLike,
  type SubscriptionLike,
} from "../apply";
import { enrichPaymentIntent, paymentIntentForInvoice, type Enrichment } from "../enrich";
import type { Scope } from "../events";

export type DispatchOpts = {
  scope?: Scope;
  /** Selftests: never call Stripe for enrichment. */
  offline?: boolean;
  source?: "webhook" | "selftest";
};

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
] as const;

const idOf = (x: string | { id: string } | null | undefined): string | null => (typeof x === "string" ? x : (x?.id ?? null));

/** Applies one Stripe event. Throws on a domain failure (the webhook answers 500 and Stripe retries). */
export async function dispatch(event: Stripe.Event, opts: DispatchOpts = {}): Promise<ApplyOutcome> {
  const ref = { id: event.id, type: event.type };
  const base = { source: opts.source ?? ("webhook" as const), event: ref, scope: opts.scope };
  const enrich = async (pi: string | null): Promise<Enrichment | null> => (opts.offline ? null : enrichPaymentIntent(pi));
  const obj = event.data.object as unknown;

  switch (event.type) {
    case "checkout.session.completed": {
      const s = obj as SessionLike;
      const enrichment = s.mode === "payment" && s.payment_status === "paid" ? await enrich(idOf(s.payment_intent)) : null;
      return applyCheckoutSession(s, { ...base, enrichment });
    }
    case "checkout.session.async_payment_succeeded": {
      const s = obj as SessionLike;
      return applyAsyncResult(s, true, { ...base, enrichment: await enrich(idOf(s.payment_intent)) });
    }
    case "checkout.session.async_payment_failed":
      return applyAsyncResult(obj as SessionLike, false, base);
    case "checkout.session.expired":
      return applySessionExpired(obj as SessionLike, base);
    case "invoice.paid": {
      const inv = obj as InvoiceLike;
      const pi = opts.offline ? null : await paymentIntentForInvoice(inv.id);
      return applyInvoicePaid(inv, { ...base, enrichment: pi ? await enrich(pi) : null });
    }
    case "invoice.payment_failed":
      return applyInvoiceFailed(obj as InvoiceLike, base);
    case "customer.subscription.updated":
      return applySubscription(obj as SubscriptionLike, false, base);
    case "customer.subscription.deleted":
      return applySubscription(obj as SubscriptionLike, true, base);
    case "charge.refunded":
      return applyChargeRefunded(obj as ChargeLike, base);
    case "charge.dispute.created":
      return applyDispute(obj as { id: string; payment_intent: string | null }, base);
    default:
      log.info("stripe.webhook.unhandled", { type: event.type });
      return { result: "ignored", touchedTotals: false, detail: "unhandled type" };
  }
}
