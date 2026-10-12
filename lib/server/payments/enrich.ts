import "server-only";

// Payment details read from Stripe OUTSIDE any transaction (integrations §3.6 step 2): the charge,
// card brand and last 4 (shown to finance only), Stripe's receipt URL, and the fee and net from the
// balance transaction (in the settlement currency). If this fails the gift is still recorded with
// nulls, and the tick's enrichPending() fills them in later.

import type Stripe from "stripe";
import type { Donation } from "@/lib/model/domain/giving";
import { CURRENCIES, type Currency, type Money } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";
import { getStripe } from "./stripe";

export type Enrichment = {
  paymentIntentId: string;
  chargeId: string | null;
  balanceTransactionId: string | null;
  fee: Money | null;
  net: Money | null;
};

function money(minor: number | null | undefined, currency: string | null | undefined): Money | null {
  const c = (currency ?? "").toUpperCase();
  if (typeof minor !== "number" || !(CURRENCIES as readonly string[]).includes(c)) return null;
  return { amountMinor: minor, currency: c as Currency };
}

/** Charge and balance details for a PaymentIntent, or null without Stripe or on any error. */
export async function enrichPaymentIntent(paymentIntentId: string | null | undefined): Promise<Enrichment | null> {
  const stripe = getStripe();
  if (!stripe || !paymentIntentId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
    const charge = typeof pi.latest_charge === "object" ? (pi.latest_charge as Stripe.Charge | null) : null;
    const bt = charge && typeof charge.balance_transaction === "object" ? (charge.balance_transaction as Stripe.BalanceTransaction | null) : null;
    return {
      paymentIntentId,
      chargeId: charge?.id ?? (typeof pi.latest_charge === "string" ? pi.latest_charge : null),
      balanceTransactionId: bt?.id ?? null,
      fee: bt ? money(bt.fee, bt.currency) : null,
      net: bt ? money(bt.net, bt.currency) : null,
    };
  } catch (err) {
    log.warn("stripe.enrich_failed", { err });
    return null;
  }
}

/** The PaymentIntent behind a paid invoice (subscription renewals), or null. */
export async function paymentIntentForInvoice(invoiceId: string | null | undefined): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe || !invoiceId) return null;
  try {
    const list = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 1 });
    const p = list.data[0]?.payment;
    const pi = p && "payment_intent" in p ? p.payment_intent : null;
    return typeof pi === "string" ? pi : (pi?.id ?? null);
  } catch (err) {
    log.warn("stripe.invoice_payment_lookup_failed", { err });
    return null;
  }
}

/**
 * Fills in charge, fee and net on recent card gifts recorded without them (enrichment failed at the
 * time). Run by the tick. Returns how many were completed.
 */
export async function enrichPending(limit = 25): Promise<number> {
  if (!getStripe()) return 0;
  const store = getStore();
  const page = await store.list<Donation>(C.donations, { where: [{ field: "status", op: "==", value: "allocated" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
  const recent = await store.list<Donation>(C.donations, { where: [{ field: "status", op: "==", value: "acknowledged" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
  const todo = [...page.items, ...recent.items].filter((d) => d.cash?.stripe?.paymentIntentId && !d.cash.stripe.chargeId).slice(0, limit);
  let done = 0;
  for (const d of todo) {
    const e = await enrichPaymentIntent(d.cash!.stripe!.paymentIntentId);
    if (!e?.chargeId) continue;
    await store.update(docPath("donations", d.id), {
      "cash.stripe.chargeId": e.chargeId,
      "cash.stripe.balanceTransactionId": e.balanceTransactionId,
      "cash.stripe.fee": e.fee,
      "cash.stripe.net": e.net,
    });
    done++;
  }
  return done;
}
