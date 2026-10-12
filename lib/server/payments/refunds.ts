import "server-only";

// Card refunds from the admin (integrations §3.9). Finance asks Stripe for the refund (idempotency key
// refund:<ref>:<amount>); Stripe's charge.refunded event then updates the gift, the totals and tells
// the donor, so there is one code path whichever way a refund starts. Gifts paid outside Stripe use
// the gift's own "Record refund" step.

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, audit } from "@/lib/server/audit";
import { readDonation } from "@/lib/server/giving/ledger";
import { log } from "@/lib/server/log";
import { getStripe } from "./stripe";

export const REFUNDS_UNAVAILABLE = "Card refunds aren't switched on yet. Please refund in the Stripe Dashboard, then record it here.";

/** Refunds a card gift in full (amountMinor null) or in part. */
export async function refundDonation(ref: string, amountMinor: number | null, v: Viewer): Promise<ActionResult<{ requested: number }>> {
  const stripe = getStripe();
  if (!stripe) return actionError({ kind: "unavailable", message: REFUNDS_UNAVAILABLE });
  const d = await readDonation(ref);
  const pi = d?.cash?.stripe?.paymentIntentId;
  if (!d || !d.cash || !pi) return actionError({ kind: "not_allowed", message: "This gift wasn't paid by card through Haven. Use “Record refund” instead." });
  if (!["received", "acknowledged", "allocated", "completed"].includes(d.status)) return actionError({ kind: "not_allowed", message: "Only gifts that have arrived can be refunded." });
  const already = d.refund?.amount.amountMinor ?? 0;
  const left = d.cash.amount.amountMinor - already;
  const amount = amountMinor === null ? left : Math.round(amountMinor);
  if (!(amount > 0) || amount > left) return actionError({ kind: "validation", fields: { amount: `Enter an amount up to ${(left / 100).toFixed(2)} ${d.cash.amount.currency}.` } });
  try {
    await stripe.refunds.create(
      { payment_intent: pi, ...(amount < left || already ? { amount } : {}), reason: "requested_by_customer", metadata: { haven_donation_ref: ref } },
      { idempotencyKey: `refund:${ref}:${already + amount}` },
    );
    await audit({ actor: actorOf(v), action: "donation.refund_request", area: "donations", summary: `${v.displayName} asked Stripe to refund ${ref}`, feed: true, sensitive: true, targetPath: `donations/${ref}`, targetRef: ref });
    return actionOk({ requested: amount });
  } catch (err) {
    log.warn("stripe.refund_failed", { err });
    const message = (err as { message?: string })?.message?.includes("already been refunded") ? "Stripe says this gift is already refunded." : "Stripe couldn't make the refund just now. Please try again, or refund in the Stripe Dashboard.";
    return actionError({ kind: "unavailable", message });
  }
}
