import "server-only";

// Stripe → Haven's gift ledger (integrations §3.5–3.7; data-model §4.3/§5.2; PLAN D36, D67–D69).
// Every function here is idempotent and safe to call from the webhook, the return route and the tick
// sweeper:
//   - the Stripe event id is marked processed in the same transaction (stripeEvents/{id});
//   - domain keys stop double money across different triggers of the same session: an intent with a
//     donationRef / recurringGiftRef is done, a recurring gift remembers its latest invoice, statuses
//     only move forward.
// Money that has arrived is received, then (with receipt.autoSend) thanked with a gap-free receipt
// number and, unless it is for "where it's needed most", placed with its cause, all in one commit.
// Test-mode gifts (livemode false) never touch public or donor totals.

import type Stripe from "stripe";
import type { Donation, DonationIntent, Donor, DonorSnapshot, RecurringGift } from "@/lib/model/domain/giving";
import type { AllocationTarget, Currency, Frequency, Millis, Money } from "@/lib/model/enums";
import { CURRENCIES, PROGRAMME_SLUG, parseTargetKey } from "@/lib/model/enums";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/routes";
import { auditTx } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import { F, type Tx, type WithId } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx, type EventInput } from "@/lib/server/events";
import { donorIdOf, donorPath, readDonorTx, upsertDonorTx } from "@/lib/server/giving/donors";
import { intentPath } from "@/lib/server/giving/intents";
import { buildDonation, donationPath } from "@/lib/server/giving/ledger";
import { log } from "@/lib/server/log";
import { notifyTx, recipientsFor } from "@/lib/server/notify";
import { getPaymentSettings } from "@/lib/server/public/settings";
import { allocateReference, nextReceiptNumber } from "@/lib/server/references";
import { signTokenFor } from "@/lib/server/security/hmac";
import { absolute } from "@/lib/server/url";
import type { Enrichment } from "./enrich";
import { at, eventOpenTx, markEventTx, type EventRef, type Scope } from "./events";
import { parseHavenMeta, type HavenMeta } from "./metadata";
import { portalLink, RECEIPT_PORTAL_TTL } from "./portal";

const YEAR = 365 * 86_400_000;
const STRIPE = { kind: "stripe" as const };

export type ApplyOpts = {
  source: "webhook" | "return" | "sweeper" | "selftest";
  event?: EventRef;
  scope?: Scope;
  enrichment?: Enrichment | null;
};

export type ApplyOutcome = {
  result: "created" | "updated" | "noop" | "duplicate" | "ignored";
  donationRef?: string | null;
  recurringRef?: string | null;
  /** Public cause totals changed (the caller expires the totals cache tag). */
  touchedTotals: boolean;
  detail?: string;
};

const duplicate: ApplyOutcome = { result: "duplicate", touchedTotals: false };

/* ── Small helpers ─────────────────────────────────────────────────────── */

const idOf = (x: string | { id: string } | null | undefined): string | null => (typeof x === "string" ? x : (x?.id ?? null));

function currencyOf(c: string | null | undefined): Currency | null {
  const u = (c ?? "").toUpperCase();
  return (CURRENCIES as readonly string[]).includes(u) ? (u as Currency) : null;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "";
}

function totalsSlug(t: AllocationTarget): string {
  if (t.type === "general") return "general";
  if (t.type === "programme") return PROGRAMME_SLUG[t.programmeId];
  return t.causeSlug;
}

function stripped<T extends { id?: string }>(doc: T): Omit<T, "id"> {
  const { id: _id, ...rest } = doc;
  void _id;
  return rest;
}

async function settings(): Promise<{ autoSend: boolean }> {
  try {
    const s = await getPaymentSettings();
    return { autoSend: s.receipt?.autoSend !== false };
  } catch {
    return { autoSend: true };
  }
}

function frequencyOf(meta: HavenMeta | null, fallback: Frequency): Frequency {
  return meta?.haven_frequency ?? fallback;
}

/** Records the change on public cause totals (money gifts in live mode only). */
async function totalsTx(tx: Tx, scope: Scope | undefined, slug: string, currency: Currency, minor: number, gifts: number, now: Millis): Promise<void> {
  if (!minor && !gifts) return;
  const path = at(scope, docPath("causeTotals", slug));
  const existing = await tx.get<Record<string, unknown>>(path);
  if (existing) tx.update(path, { [`${currency}.raisedMinor`]: F.increment(minor), [`${currency}.gifts`]: F.increment(gifts), updatedAt: now });
  else tx.set(path, { [currency]: { raisedMinor: Math.max(0, minor), gifts: Math.max(0, gifts) }, updatedAt: now });
}

/** Lifetime donor totals (money that arrived, live mode only). */
function donorTotalsTx(tx: Tx, scope: Scope | undefined, donor: WithId<Donor> | null, donorId: string, m: Money, giftsDelta: number, now: Millis): void {
  const cur = donor?.totals?.[m.currency];
  tx.update(at(scope, donorPath(donorId)), {
    [`totals.${m.currency}.lifetimeMinor`]: Math.max(0, (cur?.lifetimeMinor ?? 0) + m.amountMinor),
    [`totals.${m.currency}.gifts`]: Math.max(0, (cur?.gifts ?? 0) + giftsDelta),
    lastGiftAt: now,
    updatedAt: now,
  });
}

function stripeFields(base: Partial<NonNullable<NonNullable<Donation["cash"]>["stripe"]>>, e: Enrichment | null | undefined, livemode: boolean): NonNullable<NonNullable<Donation["cash"]>["stripe"]> {
  return {
    checkoutSessionId: base.checkoutSessionId ?? null,
    paymentIntentId: e?.paymentIntentId ?? base.paymentIntentId ?? null,
    chargeId: e?.chargeId ?? null,
    customerId: base.customerId ?? null,
    subscriptionId: base.subscriptionId ?? null,
    invoiceId: base.invoiceId ?? null,
    balanceTransactionId: e?.balanceTransactionId ?? null,
    fee: e?.fee ?? null,
    net: e?.net ?? null,
    livemode,
  };
}

/**
 * Money arrived on `d` (status received): thank the donor with the next receipt number and, unless the
 * gift is for "where it's needed most", place it with its cause. Mutates `d`; returns the timeline lines
 * and whether public totals moved.
 */
async function settleTx(
  tx: Tx,
  scope: Scope | undefined,
  ref: string,
  d: Donation,
  o: { autoSend: boolean; template: "donation_acknowledgement" | "recurring_receipt"; now: Millis },
): Promise<{ events: EventInput[]; touchedTotals: boolean }> {
  const events: EventInput[] = [];
  if (!o.autoSend || !d.cash) return { events, touchedTotals: false };
  const number = await nextReceiptNumber(tx, undefined, { root: scope?.root, now: o.now });
  d.receipt = { number, issuedAt: o.now, pdfPath: null };
  d.acknowledgement = { at: o.now, by: "system", outboxId: `${o.template}~${number}` };
  d.status = "acknowledged";
  d.statusChangedAt = o.now;
  events.push({ type: "status_changed", actor: { kind: "system", job: "stripe" }, from: "received", to: "acknowledged", summary: `Haven sent the thank-you and receipt ${number}`, at: o.now });
  if (d.donor.email) {
    const link = o.template === "recurring_receipt" ? portalLink(d.donorId, RECEIPT_PORTAL_TTL) : absolute(routes.receipt(ref, signTokenFor("receipt", ref, YEAR)));
    await enqueueEmailTx(tx, {
      template: o.template,
      to: [d.donor.email],
      vars: {
        reference: ref,
        receiptNumber: number,
        firstName: d.recognition === "anonymous" ? "" : firstName(d.donor.fullName),
        amount: formatMoney(d.cash.amount),
        date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Banjul" }).format(d.receivedAt ?? o.now),
        link,
      },
      related: { path: donationPath(ref), reference: ref },
      dedupeKey: number,
      root: scope?.root,
    });
  }
  let touchedTotals = false;
  if (d.preferredTarget.type !== "general") {
    d.allocations = [{ id: `al-${o.now.toString(36)}-0`, target: d.preferredTarget, amount: d.cash.amount, at: o.now, by: "system", note: null }];
    d.status = "allocated";
    d.statusChangedAt = o.now;
    events.push({ type: "status_changed", actor: { kind: "system", job: "stripe" }, from: "acknowledged", to: "allocated", summary: "Placed with the cause the donor chose", at: o.now });
    if (d.cash.stripe?.livemode !== false) {
      await totalsTx(tx, scope, totalsSlug(d.preferredTarget), d.cash.amount.currency, d.cash.amount.amountMinor, 1, o.now);
      touchedTotals = true;
    }
  }
  return { events, touchedTotals };
}

function writeEvents(tx: Tx, path: string, events: EventInput[]): void {
  for (const e of events) addEventTx(tx, path, e);
}

/* ── Checkout sessions ─────────────────────────────────────────────────── */

export type SessionLike = Pick<
  Stripe.Checkout.Session,
  "id" | "mode" | "status" | "payment_status" | "metadata" | "customer" | "subscription" | "payment_intent" | "livemode" | "amount_total" | "currency" | "customer_details" | "invoice"
>;

/**
 * A completed Checkout Session (webhook, return route or sweeper). One-time: the Donation (received →
 * thanked → placed, or pending for slow methods). Subscription: the RecurringGift only; the first
 * invoice.paid records the first gift.
 */
export async function applyCheckoutSession(session: SessionLike, opts: ApplyOpts): Promise<ApplyOutcome> {
  if (session.status && session.status !== "complete") return { result: "ignored", touchedTotals: false, detail: "not complete" };
  const meta = parseHavenMeta(session.metadata as Record<string, string> | null);
  if (!meta) return applyForeignSession(session, opts);
  if (meta.haven_donation_ref) return applyPayLater(session, meta, opts);
  if (!meta.haven_intent) return { result: "ignored", touchedTotals: false, detail: "no intent" };
  const scope = opts.scope;
  const { autoSend } = await settings();
  const intentId = meta.haven_intent;

  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    const ip = at(scope, intentPath(intentId));
    const intent = await tx.get<DonationIntent>(ip);
    if (!intent) {
      markEventTx(tx, opts.event, null, now, scope);
      log.warn("stripe.apply.intent_missing", { session: session.id });
      return { result: "ignored", touchedTotals: false, detail: "intent missing" };
    }
    if (intent.donationRef || intent.recurringGiftRef) {
      markEventTx(tx, opts.event, intent.donationRef, now, scope);
      return { result: "noop", donationRef: intent.donationRef, recurringRef: intent.recurringGiftRef, touchedTotals: false };
    }
    const donorId = donorIdOf(intent.donor.email);
    const donor = await readDonorTx(tx, donorId, scope?.root);
    const customerId = idOf(session.customer);

    if (session.mode === "subscription") {
      const rgRef = await allocateReference(tx, "recurringGifts", { root: scope?.root, now });
      const rg = newRecurringGift(rgRef, now, {
        donorId,
        donor: intent.donor,
        amount: intent.amount,
        frequency: intent.frequency === "one_time" ? "monthly" : intent.frequency,
        target: intent.preferredTarget,
        causeSlug: intent.causeSlug,
        customerId: customerId ?? "",
        subscriptionId: idOf(session.subscription) ?? "",
        status: session.payment_status === "paid" ? "active" : "incomplete",
      });
      tx.create(at(scope, docPath("recurringGifts", rgRef)), rg);
      upsertDonorTx(tx, donor, { donorId, snapshot: intent.donor, recognition: intent.recognition, updatesConsent: intent.updatesConsent, now, root: scope?.root });
      tx.update(at(scope, donorPath(donorId)), { ...(customerId && !donor?.stripeCustomerId ? { stripeCustomerId: customerId } : {}), activeRecurring: (donor?.activeRecurring ?? 0) + 1 });
      tx.update(ip, { status: "completed", recurringGiftRef: rgRef });
      auditTx(tx, { actor: STRIPE, action: "recurring.create", area: "donations", summary: `A regular gift started by card (${rgRef})`, feed: true, targetPath: docPath("recurringGifts", rgRef), targetRef: rgRef }, { root: scope?.root });
      markEventTx(tx, opts.event, null, now, scope);
      return { result: "created", recurringRef: rgRef, touchedTotals: false };
    }

    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const ref = await allocateReference(tx, "donations", { root: scope?.root, now });
    const path = at(scope, donationPath(ref));
    const d = buildDonation(ref, now, {
      kind: "cash",
      status: paid ? "received" : "pending",
      source: "stripe",
      donorId,
      donor: intent.donor,
      recognition: intent.recognition,
      frequency: intent.frequency,
      preferredTarget: intent.preferredTarget,
      causeSlug: intent.causeSlug,
      sponsorRef: intent.sponsorRef,
      comments: intent.comments,
      updatesConsent: intent.updatesConsent,
      attribution: intent.attribution,
      cash: {
        amount: intent.amount,
        baseAmount: intent.baseAmount,
        coverFees: intent.coverFees,
        method: "stripe",
        localMethod: null,
        stripe: stripeFields({ checkoutSessionId: session.id, paymentIntentId: idOf(session.payment_intent), customerId }, opts.enrichment, session.livemode),
      },
      receivedAt: paid ? now : null,
    });
    upsertDonorTx(tx, donor, { donorId, snapshot: intent.donor, recognition: intent.recognition, updatesConsent: intent.updatesConsent, now, root: scope?.root });
    if (customerId && !donor?.stripeCustomerId) tx.update(at(scope, donorPath(donorId)), { stripeCustomerId: customerId });
    if (paid && session.livemode !== false) donorTotalsTx(tx, scope, donor, donorId, intent.amount, 1, now);
    const s = paid ? await settleTx(tx, scope, ref, d, { autoSend, template: "donation_acknowledgement", now }) : { events: [], touchedTotals: false };
    tx.create(path, d);
    tx.update(ip, { status: "completed", donationRef: ref });
    addEventTx(tx, path, { type: "created", actor: STRIPE, summary: paid ? "Paid by card through Stripe" : "Started by card; waiting for the bank to confirm", at: now });
    writeEvents(tx, path, s.events);
    auditTx(tx, { actor: STRIPE, action: "donation.stripe", area: "donations", summary: `A card gift arrived through Stripe (${ref})`, feed: true, targetPath: donationPath(ref), targetRef: ref }, { root: scope?.root });
    if (!scope?.root) notifyTx(tx, { recipientUids: await financeUids(), kind: "new_case", title: `New card gift ${ref}`, href: `/admin/giving/${ref}` });
    markEventTx(tx, opts.event, ref, now, scope);
    return { result: "created", donationRef: ref, touchedTotals: s.touchedTotals };
  });
}

let financeCache: { at: number; uids: string[] } | null = null;
async function financeUids(): Promise<string[]> {
  if (financeCache && Date.now() - financeCache.at < 60_000) return financeCache.uids;
  const uids = await recipientsFor("finance_alert").catch(() => []);
  financeCache = { at: Date.now(), uids };
  return uids;
}

/** A card payment link for an existing pledge (haven_donation_ref): the pledge becomes received. */
async function applyPayLater(session: SessionLike, meta: HavenMeta, opts: ApplyOpts): Promise<ApplyOutcome> {
  const ref = meta.haven_donation_ref!;
  const scope = opts.scope;
  const { autoSend } = await settings();
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    const path = at(scope, donationPath(ref));
    const cur = await tx.get<Donation>(path);
    if (!cur || cur.kind !== "cash" || !cur.cash || !["pledged", "pending"].includes(cur.status) || (cur.status === "pending" && !paid)) {
      markEventTx(tx, opts.event, cur ? ref : null, now, scope);
      return { result: "noop", donationRef: cur ? ref : null, touchedTotals: false };
    }
    const donor = await readDonorTx(tx, cur.donorId, scope?.root);
    const d: Donation = stripped(cur) as Donation;
    const from = d.status;
    d.cash = { ...d.cash!, method: "stripe", stripe: stripeFields({ checkoutSessionId: session.id, paymentIntentId: idOf(session.payment_intent), customerId: idOf(session.customer) }, opts.enrichment, session.livemode) };
    d.status = paid ? "received" : "pending";
    d.statusChangedAt = now;
    d.receivedAt = paid ? now : null;
    d.version = (cur.version ?? 0) + 1;
    d.updatedAt = now;
    d.lastActivityAt = now;
    if (paid && session.livemode !== false && donor) donorTotalsTx(tx, scope, donor, cur.donorId, d.cash.amount, 1, now);
    const s = paid ? await settleTx(tx, scope, ref, d, { autoSend, template: "donation_acknowledgement", now }) : { events: [], touchedTotals: false };
    tx.set(path, d);
    addEventTx(tx, path, { type: "status_changed", actor: STRIPE, from, to: paid ? "received" : "pending", summary: paid ? "Paid by card through the secure link" : "Card payment started; waiting for the bank", at: now });
    writeEvents(tx, path, s.events);
    markEventTx(tx, opts.event, ref, now, scope);
    return { result: "updated", donationRef: ref, touchedTotals: s.touchedTotals };
  });
}

/**
 * A session without our metadata (for example a Payment Link a staff member made in the Dashboard):
 * a general cash gift from what Stripe collected, tagged `stripe-external` for finance to review.
 */
async function applyForeignSession(session: SessionLike, opts: ApplyOpts): Promise<ApplyOutcome> {
  const scope = opts.scope;
  const currency = currencyOf(session.currency);
  const email = session.customer_details?.email ?? null;
  if (session.mode !== "payment" || session.payment_status !== "paid" || !currency || !session.amount_total || !email) {
    return { result: "ignored", touchedTotals: false, detail: "foreign session without a usable payment" };
  }
  const { autoSend } = await settings();
  const marker: EventRef = { id: session.id, type: "checkout.session.external" };
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope)) || !(await eventOpenTx(tx, marker, scope))) return duplicate;
    const name = session.customer_details?.name?.trim() || email.split("@")[0];
    const snapshot: DonorSnapshot = { fullName: name.slice(0, 100), donorType: "individual", organisationName: null, email, emailLower: email.toLowerCase(), phone: session.customer_details?.phone ?? null, country: ((session.customer_details?.address?.country ?? "").toLowerCase() || "gm") as DonorSnapshot["country"] };
    const donorId = donorIdOf(email);
    const donor = await readDonorTx(tx, donorId, scope?.root);
    const ref = await allocateReference(tx, "donations", { root: scope?.root, now });
    const path = at(scope, donationPath(ref));
    const amount: Money = { amountMinor: session.amount_total!, currency };
    const d = buildDonation(ref, now, {
      kind: "cash",
      status: "received",
      source: "stripe",
      donorId,
      donor: snapshot,
      recognition: "named",
      frequency: "one_time",
      preferredTarget: { type: "general" },
      causeSlug: null,
      sponsorRef: null,
      comments: null,
      updatesConsent: null,
      attribution: null,
      cash: { amount, baseAmount: amount, coverFees: false, method: "stripe", localMethod: null, stripe: stripeFields({ checkoutSessionId: session.id, paymentIntentId: idOf(session.payment_intent), customerId: idOf(session.customer) }, opts.enrichment, session.livemode) },
      receivedAt: now,
    });
    d.tags = ["stripe-external"];
    upsertDonorTx(tx, donor, { donorId, snapshot, recognition: "named", updatesConsent: null, now, root: scope?.root });
    if (session.livemode !== false) donorTotalsTx(tx, scope, donor, donorId, amount, 1, now);
    const s = await settleTx(tx, scope, ref, d, { autoSend, template: "donation_acknowledgement", now });
    tx.create(path, d);
    addEventTx(tx, path, { type: "created", actor: STRIPE, summary: "Paid by card through a Stripe link made outside Haven: please check where it goes", at: now });
    writeEvents(tx, path, s.events);
    auditTx(tx, { actor: STRIPE, action: "donation.stripe_external", area: "donations", summary: `A card gift arrived through a Stripe link made outside Haven (${ref})`, feed: true, targetPath: donationPath(ref), targetRef: ref }, { root: scope?.root });
    markEventTx(tx, opts.event, ref, now, scope);
    markEventTx(tx, marker, ref, now, scope);
    return { result: "created", donationRef: ref, touchedTotals: s.touchedTotals };
  });
}

/** checkout.session.async_payment_succeeded / _failed: a pending gift arrives or is cancelled. */
export async function applyAsyncResult(session: SessionLike, succeeded: boolean, opts: ApplyOpts): Promise<ApplyOutcome> {
  const meta = parseHavenMeta(session.metadata as Record<string, string> | null);
  const scope = opts.scope;
  let ref = meta?.haven_donation_ref ?? null;
  if (!ref && meta?.haven_intent) ref = (await getStore().get<DonationIntent>(at(scope, intentPath(meta.haven_intent))))?.donationRef ?? null;
  if (!ref) {
    // The completion event hasn't been applied yet: apply it now (it sees the paid status).
    return succeeded ? applyCheckoutSession({ ...session, payment_status: "paid" }, opts) : { result: "ignored", touchedTotals: false, detail: "no gift yet" };
  }
  const { autoSend } = await settings();
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    const path = at(scope, donationPath(ref!));
    const cur = await tx.get<Donation>(path);
    if (!cur || cur.status !== "pending" || !cur.cash) {
      markEventTx(tx, opts.event, ref, now, scope);
      return { result: "noop", donationRef: ref, touchedTotals: false };
    }
    const d: Donation = stripped(cur) as Donation;
    d.version = (cur.version ?? 0) + 1;
    d.updatedAt = now;
    d.lastActivityAt = now;
    d.statusChangedAt = now;
    let s = { events: [] as EventInput[], touchedTotals: false };
    if (succeeded) {
      d.status = "received";
      d.receivedAt = now;
      if (opts.enrichment && d.cash) d.cash = { ...d.cash, stripe: stripeFields({ ...d.cash.stripe }, opts.enrichment, d.cash.stripe?.livemode ?? session.livemode) };
      const donor = await readDonorTx(tx, cur.donorId, scope?.root);
      if (d.cash!.stripe?.livemode !== false && donor) donorTotalsTx(tx, scope, donor, cur.donorId, d.cash!.amount, 1, now);
      s = await settleTx(tx, scope, ref!, d, { autoSend, template: "donation_acknowledgement", now });
    } else {
      d.status = "cancelled";
      d.cancelledAt = now;
      d.cancelReason = "checkout_failed";
      d.closedAt = now;
    }
    tx.set(path, d);
    addEventTx(tx, path, { type: "status_changed", actor: STRIPE, from: "pending", to: succeeded ? "received" : "cancelled", summary: succeeded ? "The bank confirmed the payment" : "The payment didn't go through", at: now });
    writeEvents(tx, path, s.events);
    markEventTx(tx, opts.event, ref, now, scope);
    return { result: "updated", donationRef: ref, touchedTotals: s.touchedTotals };
  });
}

/** checkout.session.expired: the intent stops waiting (a pay-later link needs nothing). */
export async function applySessionExpired(session: SessionLike, opts: ApplyOpts): Promise<ApplyOutcome> {
  const meta = parseHavenMeta(session.metadata as Record<string, string> | null);
  const scope = opts.scope;
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    if (meta?.haven_intent) {
      const ip = at(scope, intentPath(meta.haven_intent));
      const intent = await tx.get<DonationIntent>(ip);
      if (intent && intent.status === "open" && !intent.donationRef && !intent.recurringGiftRef) tx.update(ip, { status: "expired" });
    }
    markEventTx(tx, opts.event, null, now, scope);
    return { result: "updated", touchedTotals: false };
  });
}

/* ── Recurring gifts ───────────────────────────────────────────────────── */

function newRecurringGift(
  ref: string,
  now: Millis,
  r: { donorId: string; donor: DonorSnapshot; amount: Money; frequency: Exclude<Frequency, "one_time">; target: AllocationTarget; causeSlug: string | null; customerId: string; subscriptionId: string; status: RecurringGift["status"] },
): RecurringGift {
  return {
    reference: ref,
    donorId: r.donorId,
    donor: { fullName: r.donor.fullName, email: r.donor.email, emailLower: r.donor.emailLower, country: r.donor.country },
    amount: r.amount,
    frequency: r.frequency,
    target: r.target,
    causeSlug: r.causeSlug,
    provider: "stripe",
    stripe: { customerId: r.customerId, subscriptionId: r.subscriptionId, latestInvoiceId: null },
    status: r.status,
    startedAt: now,
    currentPeriodEnd: null,
    cancelAt: null,
    cancelledAt: null,
    cancelReason: null,
    giftCount: 0,
    lastPaymentAt: null,
    lastFailureAt: null,
    searchTokens: buildSearchTokens({ reference: ref, email: r.donor.email, names: [r.donor.fullName] }),
    retention: { policy: "donation.financial", retainUntil: null, legalHold: false },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/** The recurring gift for a subscription id, read outside any transaction. */
export async function findRecurringBySubscription(subscriptionId: string, scope?: Scope): Promise<string | null> {
  if (!subscriptionId) return null;
  const page = await getStore().list<RecurringGift>(at(scope, C.recurringGifts), {
    where: [{ field: "stripe.subscriptionId", op: "==", value: subscriptionId }],
    orderBy: { field: "stripe.subscriptionId", dir: "asc" },
    limit: 1,
  });
  return page.items[0]?.id ?? null;
}

export type InvoiceLike = {
  id: string;
  amount_paid: number;
  currency: string;
  livemode: boolean;
  customer: string | { id: string } | null;
  /** API 2025+: the subscription and its metadata snapshot live under parent. */
  parent?: { subscription_details?: { subscription?: string | { id: string } | null; metadata?: Record<string, string> | null } | null } | null;
  /** Older API versions. */
  subscription?: string | { id: string } | null;
  lines?: { data?: Array<{ period?: { end?: number } }> };
};

function subscriptionOf(inv: InvoiceLike): string | null {
  return idOf(inv.parent?.subscription_details?.subscription ?? null) ?? idOf(inv.subscription ?? null);
}

/**
 * invoice.paid: a recurring payment arrived. Finds (or, racing the session event, creates from the
 * intent) the RecurringGift, records the gift with a recurring receipt and moves the gift count on.
 */
export async function applyInvoicePaid(inv: InvoiceLike, opts: ApplyOpts): Promise<ApplyOutcome> {
  if (!(inv.amount_paid > 0)) return { result: "ignored", touchedTotals: false, detail: "nothing paid" };
  const sub = subscriptionOf(inv);
  if (!sub) return { result: "ignored", touchedTotals: false, detail: "not a subscription invoice" };
  const scope = opts.scope;
  const meta = parseHavenMeta(inv.parent?.subscription_details?.metadata ?? null);
  const known = await findRecurringBySubscription(sub, scope);
  const { autoSend } = await settings();
  const currency = currencyOf(inv.currency);
  if (!currency) return { result: "ignored", touchedTotals: false, detail: "currency" };

  // One gift per invoice, whichever event or retry carries it.
  const marker: EventRef = { id: inv.id, type: "invoice.paid.applied" };
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    if (!(await eventOpenTx(tx, marker, scope))) {
      markEventTx(tx, opts.event, null, now, scope);
      return { result: "noop", recurringRef: known, touchedTotals: false };
    }
    let rgRef = known;
    let rg: RecurringGift | null = rgRef ? await tx.get<RecurringGift>(at(scope, docPath("recurringGifts", rgRef))) : null;
    let intent: DonationIntent | null = null;
    const ip = meta?.haven_intent ? at(scope, intentPath(meta.haven_intent)) : null;
    if (!rg && ip) {
      intent = await tx.get<DonationIntent>(ip);
      if (intent?.recurringGiftRef) {
        rgRef = intent.recurringGiftRef;
        rg = await tx.get<RecurringGift>(at(scope, docPath("recurringGifts", rgRef)));
      }
    }
    if (rg && rg.stripe?.latestInvoiceId === inv.id) {
      markEventTx(tx, opts.event, null, now, scope);
      return { result: "noop", recurringRef: rgRef, touchedTotals: false };
    }
    const donorId = rg?.donorId ?? (intent ? donorIdOf(intent.donor.email) : null);
    if (!donorId) {
      markEventTx(tx, opts.event, null, now, scope);
      log.warn("stripe.invoice.no_recurring_gift", { invoice: inv.id });
      return { result: "ignored", touchedTotals: false, detail: "unknown subscription" };
    }
    const donor = await readDonorTx(tx, donorId, scope?.root);
    const snapshot: DonorSnapshot = intent?.donor ?? {
      fullName: donor?.fullName ?? rg!.donor.fullName,
      donorType: donor?.donorType ?? "individual",
      organisationName: donor?.organisationName ?? null,
      email: donor?.email ?? rg!.donor.email,
      emailLower: donor?.emailLower ?? rg!.donor.emailLower,
      phone: donor?.phone ?? null,
      country: donor?.country ?? rg!.donor.country,
    };
    const customerId = idOf(inv.customer);
    const periodEnd = inv.lines?.data?.[0]?.period?.end ? inv.lines.data[0].period!.end! * 1000 : null;
    let created = false;
    if (!rg) {
      // Racing the session event: create the recurring gift from the intent now.
      rgRef = await allocateReference(tx, "recurringGifts", { root: scope?.root, now });
      rg = newRecurringGift(rgRef, now, {
        donorId,
        donor: snapshot,
        amount: intent!.amount,
        frequency: intent!.frequency === "one_time" ? "monthly" : intent!.frequency,
        target: intent!.preferredTarget,
        causeSlug: intent!.causeSlug,
        customerId: customerId ?? "",
        subscriptionId: sub,
        status: "active",
      });
      created = true;
      upsertDonorTx(tx, donor, { donorId, snapshot, recognition: intent!.recognition, updatesConsent: intent!.updatesConsent, now, root: scope?.root });
      tx.update(at(scope, donorPath(donorId)), { ...(customerId && !donor?.stripeCustomerId ? { stripeCustomerId: customerId } : {}), activeRecurring: (donor?.activeRecurring ?? 0) + 1 });
      tx.update(ip!, { status: "completed", recurringGiftRef: rgRef });
    }
    const amount: Money = { amountMinor: inv.amount_paid, currency };
    const ref = await allocateReference(tx, "donations", { root: scope?.root, now });
    const path = at(scope, donationPath(ref));
    const target = rg.target ?? (meta ? parseTargetKey(meta.haven_target) : null) ?? { type: "general" as const };
    const d = buildDonation(ref, now, {
      kind: "cash",
      status: "received",
      source: "stripe",
      donorId,
      donor: snapshot,
      recognition: donor?.recognition ?? intent?.recognition ?? "named",
      frequency: frequencyOf(meta, rg.frequency),
      preferredTarget: target,
      causeSlug: rg.causeSlug,
      sponsorRef: meta?.haven_sponsor_ref ?? null,
      comments: null,
      updatesConsent: null,
      attribution: null,
      cash: { amount, baseAmount: amount, coverFees: meta?.haven_cover_fees === "1", method: "stripe", localMethod: null, stripe: stripeFields({ customerId, subscriptionId: sub, invoiceId: inv.id }, opts.enrichment, inv.livemode) },
      receivedAt: now,
      recurringGiftRef: rgRef,
    });
    if (inv.livemode !== false) donorTotalsTx(tx, scope, donor, donorId, amount, 1, now);
    const s = await settleTx(tx, scope, ref, d, { autoSend, template: "recurring_receipt", now });
    tx.create(path, d);
    const rgPath = at(scope, docPath("recurringGifts", rgRef!));
    const rgNext: RecurringGift = { ...(stripped(rg as RecurringGift & { id?: string }) as RecurringGift), giftCount: (rg.giftCount ?? 0) + 1, lastPaymentAt: now, status: "active", currentPeriodEnd: periodEnd ?? rg.currentPeriodEnd, stripe: { customerId: rg.stripe?.customerId || customerId || "", subscriptionId: sub, latestInvoiceId: inv.id }, updatedAt: now, version: (rg.version ?? 0) + 1 };
    if (created) tx.create(rgPath, rgNext);
    else tx.set(rgPath, rgNext);
    addEventTx(tx, path, { type: "created", actor: STRIPE, summary: `Regular gift payment ${rgNext.giftCount} by card (${rgRef})`, at: now });
    writeEvents(tx, path, s.events);
    auditTx(tx, { actor: STRIPE, action: "donation.stripe_recurring", area: "donations", summary: `A regular card gift arrived (${ref}, ${rgRef})`, feed: true, targetPath: donationPath(ref), targetRef: ref }, { root: scope?.root });
    markEventTx(tx, opts.event, ref, now, scope);
    markEventTx(tx, marker, ref, now, scope);
    return { result: "created", donationRef: ref, recurringRef: rgRef, touchedTotals: s.touchedTotals };
  });
}

/** invoice.payment_failed: the regular gift is past due; the donor gets a link to update their card. */
export async function applyInvoiceFailed(inv: InvoiceLike, opts: ApplyOpts): Promise<ApplyOutcome> {
  const sub = subscriptionOf(inv);
  const scope = opts.scope;
  const rgRef = sub ? await findRecurringBySubscription(sub, scope) : null;
  if (!rgRef) return { result: "ignored", touchedTotals: false, detail: "unknown subscription" };
  const finance = scope?.root ? [] : await financeUids();
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    const path = at(scope, docPath("recurringGifts", rgRef));
    const rg = await tx.get<RecurringGift>(path);
    if (!rg) {
      markEventTx(tx, opts.event, null, now, scope);
      return { result: "ignored", touchedTotals: false };
    }
    tx.update(path, { status: "past_due", lastFailureAt: now, updatedAt: now, version: (rg.version ?? 0) + 1 });
    if (rg.donor.email) {
      await enqueueEmailTx(tx, {
        template: "recurring_failed",
        to: [rg.donor.email],
        vars: { reference: rgRef, firstName: firstName(rg.donor.fullName), link: portalLink(rg.donorId, RECEIPT_PORTAL_TTL) },
        dedupeKey: `${rgRef}~${inv.id}`,
        related: { path: docPath("recurringGifts", rgRef), reference: rgRef },
        root: scope?.root,
      });
    }
    if (finance.length) notifyTx(tx, { recipientUids: finance, kind: "system", title: `A regular gift payment failed (${rgRef})`, href: "/admin/giving" });
    markEventTx(tx, opts.event, null, now, scope);
    return { result: "updated", recurringRef: rgRef, touchedTotals: false };
  });
}

export type SubscriptionLike = {
  id: string;
  status: string;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean;
  canceled_at?: number | null;
  cancellation_details?: { reason?: string | null } | null;
  items?: { data?: Array<{ current_period_end?: number }> };
};

const SUB_STATUS: Record<string, RecurringGift["status"]> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "incomplete",
  incomplete_expired: "cancelled",
  paused: "paused",
  canceled: "cancelled",
};

/** customer.subscription.updated / .deleted: mirror the status, cancel date and period end. */
export async function applySubscription(sub: SubscriptionLike, deleted: boolean, opts: ApplyOpts): Promise<ApplyOutcome> {
  const scope = opts.scope;
  const rgRef = await findRecurringBySubscription(sub.id, scope);
  if (!rgRef) return { result: "ignored", touchedTotals: false, detail: "unknown subscription" };
  const finance = deleted && !scope?.root ? await financeUids() : [];
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    const path = at(scope, docPath("recurringGifts", rgRef));
    const rg = await tx.get<RecurringGift>(path);
    if (!rg) {
      markEventTx(tx, opts.event, null, now, scope);
      return { result: "ignored", touchedTotals: false };
    }
    const status = deleted ? "cancelled" : (SUB_STATUS[sub.status] ?? rg.status);
    const periodEnd = sub.items?.data?.[0]?.current_period_end ? sub.items.data[0].current_period_end! * 1000 : rg.currentPeriodEnd;
    const cancelAt = sub.cancel_at ? sub.cancel_at * 1000 : sub.cancel_at_period_end && periodEnd ? periodEnd : null;
    const becameCancelled = status === "cancelled" && rg.status !== "cancelled";
    tx.update(path, {
      status,
      currentPeriodEnd: periodEnd ?? null,
      cancelAt,
      ...(becameCancelled ? { cancelledAt: now, cancelReason: sub.cancellation_details?.reason ?? null } : {}),
      updatedAt: now,
      version: (rg.version ?? 0) + 1,
    });
    if (becameCancelled) {
      const donor = await readDonorTx(tx, rg.donorId, scope?.root);
      if (donor) tx.update(at(scope, donorPath(rg.donorId)), { activeRecurring: Math.max(0, (donor.activeRecurring ?? 1) - 1) });
      if (rg.donor.email) {
        await enqueueEmailTx(tx, {
          template: "recurring_cancelled",
          to: [rg.donor.email],
          vars: { reference: rgRef, firstName: firstName(rg.donor.fullName) },
          related: { path: docPath("recurringGifts", rgRef), reference: rgRef },
          root: scope?.root,
        });
      }
      if (finance.length) notifyTx(tx, { recipientUids: finance, kind: "system", title: `A regular gift was stopped (${rgRef})`, href: "/admin/giving" });
    }
    markEventTx(tx, opts.event, null, now, scope);
    return { result: "updated", recurringRef: rgRef, touchedTotals: false };
  });
}

/* ── Refunds and disputes ──────────────────────────────────────────────── */

/** The Donation paid by a PaymentIntent, read outside any transaction. */
export async function findDonationByPaymentIntent(pi: string, scope?: Scope): Promise<string | null> {
  if (!pi) return null;
  const page = await getStore().list<Donation>(at(scope, C.donations), {
    where: [{ field: "cash.stripe.paymentIntentId", op: "==", value: pi }],
    orderBy: { field: "cash.stripe.paymentIntentId", dir: "asc" },
    limit: 1,
  });
  return page.items[0]?.id ?? null;
}

export type ChargeLike = {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  payment_intent: string | { id: string } | null;
  refunds?: { data?: Array<{ id: string }> } | null;
};

/**
 * charge.refunded: full refund → cancelled (refunded), partial → status kept with the cumulative refund.
 * Donor and public totals move by the change since the last refund event. The donor is told.
 */
export async function applyChargeRefunded(charge: ChargeLike, opts: ApplyOpts): Promise<ApplyOutcome> {
  const scope = opts.scope;
  const pi = idOf(charge.payment_intent);
  const ref = pi ? await findDonationByPaymentIntent(pi, scope) : null;
  if (!ref) return { result: "ignored", touchedTotals: false, detail: "no matching gift" };
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    const path = at(scope, donationPath(ref));
    const cur = await tx.get<Donation>(path);
    if (!cur?.cash) {
      markEventTx(tx, opts.event, ref, now, scope);
      return { result: "ignored", touchedTotals: false };
    }
    const currency = cur.cash.amount.currency;
    const before = cur.refund?.amount.amountMinor ?? 0;
    const delta = Math.max(0, charge.amount_refunded - before);
    if (!delta) {
      markEventTx(tx, opts.event, ref, now, scope);
      return { result: "noop", donationRef: ref, touchedTotals: false };
    }
    const full = charge.amount_refunded >= charge.amount;
    const live = cur.cash.stripe?.livemode !== false;
    const donor = await readDonorTx(tx, cur.donorId, scope?.root);
    let touched = false;
    if (live && donor) donorTotalsTx(tx, scope, donor, cur.donorId, { amountMinor: -delta, currency }, full ? -1 : 0, now);
    if (live && cur.allocations.length) {
      if (full) {
        for (const a of cur.allocations) await totalsTx(tx, scope, totalsSlug(a.target), a.amount.currency, -(a.amount.amountMinor - (before && a === cur.allocations[0] ? Math.min(before, a.amount.amountMinor) : 0)), -1, now);
      } else {
        await totalsTx(tx, scope, totalsSlug(cur.allocations[0].target), currency, -delta, 0, now);
      }
      touched = true;
    }
    const refund = { amount: { amountMinor: charge.amount_refunded, currency }, at: now, stripeRefundId: charge.refunds?.data?.[0]?.id ?? null };
    tx.update(path, {
      refund,
      ...(full ? { status: "cancelled", statusChangedAt: now, cancelledAt: now, cancelReason: "refunded", closedAt: now, allocations: [] } : {}),
      updatedAt: now,
      lastActivityAt: now,
      version: (cur.version ?? 0) + 1,
    });
    addEventTx(tx, path, { type: full ? "status_changed" : "field_updated", actor: STRIPE, ...(full ? { from: cur.status, to: "cancelled" } : {}), summary: full ? "Refunded in full through Stripe" : `Part refunded through Stripe (${formatMoney({ amountMinor: charge.amount_refunded, currency })} in total)`, at: now });
    if (cur.donor.email) {
      await enqueueEmailTx(tx, {
        template: "refund_notice",
        to: [cur.donor.email],
        vars: { reference: ref, firstName: cur.recognition === "anonymous" ? "" : firstName(cur.donor.fullName), amount: formatMoney({ amountMinor: charge.amount_refunded, currency }) },
        dedupeKey: `${ref}~${charge.amount_refunded}`,
        related: { path: donationPath(ref), reference: ref },
        root: scope?.root,
      });
    }
    auditTx(tx, { actor: STRIPE, action: "donation.refund", area: "donations", summary: `${full ? "A full" : "A part"} refund was recorded on ${ref}`, feed: true, targetPath: donationPath(ref), targetRef: ref }, { root: scope?.root });
    markEventTx(tx, opts.event, ref, now, scope);
    return { result: "updated", donationRef: ref, touchedTotals: touched };
  });
}

/** charge.dispute.created: an urgent note for finance and a line on the gift's timeline. */
export async function applyDispute(dispute: { id: string; payment_intent: string | { id: string } | null }, opts: ApplyOpts): Promise<ApplyOutcome> {
  const scope = opts.scope;
  const pi = idOf(dispute.payment_intent);
  const ref = pi ? await findDonationByPaymentIntent(pi, scope) : null;
  const finance = scope?.root ? [] : await financeUids();
  return getStore().runTransaction(async (tx) => {
    const now = Date.now();
    if (!(await eventOpenTx(tx, opts.event, scope))) return duplicate;
    if (ref) addEventTx(tx, at(scope, donationPath(ref)), { type: "field_updated", actor: STRIPE, summary: "Card payment disputed: Stripe will ask for evidence", at: now });
    if (finance.length) notifyTx(tx, { recipientUids: finance, kind: "system", priority: "urgent", title: ref ? `A card payment was disputed (${ref})` : "A card payment was disputed", href: ref ? `/admin/giving/${ref}` : "/admin/giving" });
    markEventTx(tx, opts.event, ref, now, scope);
    return { result: "updated", donationRef: ref, touchedTotals: false };
  });
}

