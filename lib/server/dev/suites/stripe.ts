import "server-only";

// Selftest suite "stripe" (PLAN §6.3 I1): fixture events fed straight to dispatch() under a scratch
// root, offline (no Stripe calls, no real outbox, no real totals). Covers: one-time card gift →
// exactly one Donation, thanked and placed; duplicates and the return route add nothing; subscription
// → RecurringGift, then one gift per invoice.paid; out-of-order events converge; pending bank
// payments; refunds (full and part); failed and cancelled regular gifts; links made outside Haven;
// GMD never routed to Stripe.

import type Stripe from "stripe";
import type { Donation, DonationIntent, RecurringGift } from "@/lib/model/domain/giving";
import { DEFAULT_PAYMENT_SETTINGS } from "@/lib/model/domain/settings";
import type { OutboxEmail } from "@/lib/model/domain/system";
import { getStore } from "@/lib/server/db";
import type { WithId } from "@/lib/server/db/store";
import { applyCheckoutSession } from "@/lib/server/payments/apply";
import { dispatch } from "@/lib/server/payments/handlers";
import { effectiveRoutes } from "@/lib/server/payments/routing";
import { caseRecorder, dropScratch, scratchRoot } from "../selftest";
import type { Suite } from "../types";

let seq = 0;
const uid = (p: string) => `${p}_selftest${Date.now().toString(36)}${(seq++).toString(36)}`;

function event(type: string, object: Record<string, unknown>, id = uid("evt")): Stripe.Event {
  return { id, object: "event", type, api_version: "selftest", created: Math.floor(Date.now() / 1000), livemode: Boolean(object.livemode), pending_webhooks: 0, request: null, data: { object } } as unknown as Stripe.Event;
}

function intentDoc(o: { frequency: DonationIntent["frequency"]; amountMinor: number; email: string; target: DonationIntent["preferredTarget"]; cause: string }): DonationIntent {
  const now = Date.now();
  const money = { amountMinor: o.amountMinor, currency: "USD" as const };
  return {
    createdAt: now,
    expireAt: now + 48 * 3_600_000,
    submissionId: uid("sub"),
    amount: money,
    baseAmount: money,
    coverFees: false,
    frequency: o.frequency,
    preferredTarget: o.target,
    causeSlug: o.cause,
    sponsorRef: null,
    donor: { fullName: "Aminata Selftest", donorType: "individual", organisationName: null, email: o.email, emailLower: o.email, phone: null, country: "gm" },
    recognition: "named",
    comments: null,
    updatesConsent: null,
    attribution: null,
    checkoutSessionId: "",
    status: "open",
    donationRef: null,
    recurringGiftRef: null,
  };
}

function meta(intentId: string, frequency: string, target: string, cause: string, amountMinor: number) {
  return { haven_v: "1", haven_intent: intentId, haven_kind: frequency === "one_time" ? "one_time" : "recurring", haven_frequency: frequency, haven_target: target, haven_cause: cause, haven_cover_fees: "0", haven_base_minor: String(amountMinor) };
}

export const suite: Suite = {
  name: "stripe",
  async run() {
    const t = caseRecorder();
    const store = getStore();
    const root = scratchRoot();
    const scope = { root };
    const opts = { scope, offline: true, source: "selftest" as const };
    const list = async <T>(c: string) => (await store.list<T>(`${root}/${c}`, { orderBy: { field: "createdAt", dir: "asc" }, limit: 100 })).items as Array<WithId<T>>;
    const get = <T>(c: string, id: string) => store.get<T>(`${root}/${c}/${id}`);
    const outbox = async () => (await store.list<OutboxEmail>(`${root}/emailOutbox`, { orderBy: { field: "createdAt", dir: "asc" }, limit: 100 })).items;
    const putIntent = async (id: string, doc: DonationIntent) => store.set(`${root}/donationIntents/${id}`, doc);

    try {
      /* One-time gift */
      const i1 = uid("int");
      await putIntent(i1, intentDoc({ frequency: "one_time", amountMinor: 5000, email: "one@example.org", target: { type: "programme", programmeId: "education" }, cause: "education" }));
      const s1 = { id: uid("cs_test"), object: "checkout.session", mode: "payment", status: "complete", payment_status: "paid", livemode: true, customer: "cus_selftest1", subscription: null, payment_intent: "pi_selftest_one", amount_total: 5000, currency: "usd", customer_details: { email: "one@example.org", name: "Aminata Selftest" }, invoice: null, metadata: meta(i1, "one_time", "programme:education", "education", 5000) };
      const e1 = event("checkout.session.completed", s1);
      let ref1 = "";

      await t.check("a paid one-time session creates one gift, thanked and placed", async () => {
        const out = await dispatch(e1, opts);
        const gifts = await list<Donation>("donations");
        const d = gifts[0];
        ref1 = d?.id ?? "";
        const intent = await get<DonationIntent>("donationIntents", i1);
        const ok = out.result === "created" && gifts.length === 1 && d.status === "allocated" && d.source === "stripe" && d.cash?.method === "stripe" && /^HVN-RC-\d{4}-\d{4}$/.test(d.receipt?.number ?? "") && d.allocations.length === 1 && intent?.status === "completed" && intent.donationRef === d.id && out.touchedTotals;
        if (!ok) throw new Error(`result=${out.result} gifts=${gifts.length} status=${d?.status} receipt=${d?.receipt?.number} intent=${intent?.status}`);
        return true;
      });

      await t.check("the thank-you email with the receipt is queued", async () => {
        const mail = (await outbox()).filter((m) => m.template === "donation_acknowledgement");
        return mail.length === 1 && mail[0].to[0] === "one@example.org" ? true : `found ${mail.length}`;
      });

      await t.check("cause and donor totals move by the gift", async () => {
        const totals = await get<Record<string, { raisedMinor: number; gifts: number }>>("causeTotals", "education");
        const donors = await list<{ totals: Record<string, { lifetimeMinor: number; gifts: number }> }>("donors");
        const ok = totals?.USD?.raisedMinor === 5000 && totals.USD.gifts === 1 && donors.length === 1 && donors[0].totals?.USD?.lifetimeMinor === 5000;
        if (!ok) throw new Error(`cause=${JSON.stringify(totals?.USD)} donor=${JSON.stringify(donors[0]?.totals)}`);
        return true;
      });

      await t.check("the same event delivered twice adds nothing", async () => {
        const out = await dispatch(e1, opts);
        const gifts = await list<Donation>("donations");
        return out.result === "duplicate" && gifts.length === 1 ? true : `result=${out.result} gifts=${gifts.length}`;
      });

      await t.check("the return route for the same session adds nothing", async () => {
        const out = await applyCheckoutSession(s1 as never, { source: "return", scope });
        const again = await dispatch(event("checkout.session.completed", s1), opts);
        const gifts = await list<Donation>("donations");
        return out.result === "noop" && again.result === "noop" && gifts.length === 1 ? true : `return=${out.result} event=${again.result} gifts=${gifts.length}`;
      });

      /* Subscription */
      const i2 = uid("int");
      await putIntent(i2, intentDoc({ frequency: "monthly", amountMinor: 2000, email: "monthly@example.org", target: { type: "general" }, cause: "general" }));
      const sub2 = uid("sub_selftest");
      const s2 = { id: uid("cs_test"), object: "checkout.session", mode: "subscription", status: "complete", payment_status: "paid", livemode: false, customer: "cus_selftest2", subscription: sub2, payment_intent: null, amount_total: 2000, currency: "usd", customer_details: { email: "monthly@example.org" }, invoice: null, metadata: meta(i2, "monthly", "general", "general", 2000) };
      const invoice = (n: number, sub: string, m: Record<string, string>) => ({ id: uid(`in_selftest${n}`), object: "invoice", amount_paid: 2000, currency: "usd", livemode: false, customer: "cus_selftest2", parent: { subscription_details: { subscription: sub, metadata: m } }, lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 30 * 86400 } }] } });

      await t.check("a subscription session creates a regular gift and no gift yet", async () => {
        const before = (await list<Donation>("donations")).length;
        const out = await dispatch(event("checkout.session.completed", s2), opts);
        const rgs = await list<RecurringGift>("recurringGifts");
        const after = (await list<Donation>("donations")).length;
        const rg = rgs[0];
        return out.result === "created" && rgs.length === 1 && rg.stripe?.subscriptionId === sub2 && rg.status === "active" && after === before ? true : `result=${out.result} rgs=${rgs.length} gifts ${before}→${after}`;
      });

      await t.check("each invoice.paid records one gift with a recurring receipt", async () => {
        const m = meta(i2, "monthly", "general", "general", 2000);
        const inv1 = invoice(1, sub2, m);
        await dispatch(event("invoice.paid", inv1), opts);
        await dispatch(event("invoice.paid", invoice(2, sub2, m)), opts);
        const again = await dispatch(event("invoice.paid", inv1), opts);
        const gifts = (await list<Donation>("donations")).filter((d) => d.recurringGiftRef);
        const rg = (await list<RecurringGift>("recurringGifts"))[0];
        const receipts = (await outbox()).filter((x) => x.template === "recurring_receipt");
        const ok = gifts.length === 2 && rg.giftCount === 2 && again.result === "noop" && receipts.length === 2 && gifts.every((d) => d.status === "acknowledged");
        if (!ok) throw new Error(`gifts=${gifts.length} count=${rg.giftCount} again=${again.result} receipts=${receipts.length}`);
        return true;
      });

      await t.check("an invoice before its session converges on one regular gift", async () => {
        const i3 = uid("int");
        await putIntent(i3, intentDoc({ frequency: "quarterly", amountMinor: 2000, email: "early@example.org", target: { type: "general" }, cause: "general" }));
        const sub3 = uid("sub_selftest");
        const m = meta(i3, "quarterly", "general", "general", 2000);
        const first = await dispatch(event("invoice.paid", invoice(3, sub3, m)), opts);
        const late = await dispatch(event("checkout.session.completed", { ...s2, id: uid("cs_test"), subscription: sub3, metadata: m }), opts);
        const rgs = (await list<RecurringGift>("recurringGifts")).filter((r) => r.stripe?.subscriptionId === sub3);
        return first.result === "created" && late.result === "noop" && rgs.length === 1 && rgs[0].giftCount === 1 ? true : `first=${first.result} late=${late.result} rgs=${rgs.length}`;
      });

      await t.check("a failed renewal marks the gift past due and emails the donor", async () => {
        const out = await dispatch(event("invoice.payment_failed", invoice(4, sub2, {})), opts);
        const rg = (await list<RecurringGift>("recurringGifts")).find((r) => r.stripe?.subscriptionId === sub2);
        const mail = (await outbox()).filter((x) => x.template === "recurring_failed");
        return out.result === "updated" && rg?.status === "past_due" && mail.length === 1 ? true : `status=${rg?.status} mail=${mail.length}`;
      });

      await t.check("a cancelled subscription stops the regular gift", async () => {
        const out = await dispatch(event("customer.subscription.deleted", { id: sub2, object: "subscription", status: "canceled", cancellation_details: { reason: "cancellation_requested" } }), opts);
        const rg = (await list<RecurringGift>("recurringGifts")).find((r) => r.stripe?.subscriptionId === sub2);
        const mail = (await outbox()).filter((x) => x.template === "recurring_cancelled");
        return out.result === "updated" && rg?.status === "cancelled" && rg.cancelReason === "cancellation_requested" && mail.length === 1 ? true : `status=${rg?.status} mail=${mail.length}`;
      });

      /* Refunds */
      await t.check("a part refund keeps the gift and records the amount", async () => {
        const out = await dispatch(event("charge.refunded", { id: "ch_selftest_one", object: "charge", amount: 5000, amount_refunded: 2000, currency: "usd", payment_intent: "pi_selftest_one", refunds: { data: [{ id: "re_selftest_1" }] } }), opts);
        const d = await get<Donation>("donations", ref1);
        const totals = await get<Record<string, { raisedMinor: number }>>("causeTotals", "education");
        return out.result === "updated" && d?.status === "allocated" && d.refund?.amount.amountMinor === 2000 && totals?.USD?.raisedMinor === 3000 ? true : `status=${d?.status} refund=${d?.refund?.amount.amountMinor} raised=${totals?.USD?.raisedMinor}`;
      });

      await t.check("a full refund cancels the gift and reverses the totals", async () => {
        const out = await dispatch(event("charge.refunded", { id: "ch_selftest_one", object: "charge", amount: 5000, amount_refunded: 5000, currency: "usd", payment_intent: "pi_selftest_one", refunds: { data: [{ id: "re_selftest_2" }] } }), opts);
        const d = await get<Donation>("donations", ref1);
        const totals = await get<Record<string, { raisedMinor: number; gifts: number }>>("causeTotals", "education");
        const mail = (await outbox()).filter((x) => x.template === "refund_notice");
        const ok = out.result === "updated" && d?.status === "cancelled" && d.cancelReason === "refunded" && totals?.USD?.raisedMinor === 0 && totals.USD.gifts === 0 && mail.length === 2;
        if (!ok) throw new Error(`status=${d?.status} raised=${totals?.USD?.raisedMinor} gifts=${totals?.USD?.gifts} mail=${mail.length}`);
        return true;
      });

      /* Bank payments that confirm later */
      await t.check("a slow bank payment waits as pending, then arrives", async () => {
        const i4 = uid("int");
        await putIntent(i4, intentDoc({ frequency: "one_time", amountMinor: 3000, email: "bank@example.org", target: { type: "general" }, cause: "general" }));
        const s4 = { ...s1, id: uid("cs_test"), payment_status: "unpaid", livemode: false, payment_intent: "pi_selftest_bank", metadata: meta(i4, "one_time", "general", "general", 3000) };
        await dispatch(event("checkout.session.completed", s4), opts);
        const ref = (await get<DonationIntent>("donationIntents", i4))?.donationRef ?? "";
        const pending = await get<Donation>("donations", ref);
        await dispatch(event("checkout.session.async_payment_succeeded", { ...s4, payment_status: "paid" }), opts);
        const after = await get<Donation>("donations", ref);
        return pending?.status === "pending" && after?.status === "acknowledged" && Boolean(after.receivedAt) ? true : `pending=${pending?.status} after=${after?.status}`;
      });

      await t.check("a link made outside Haven becomes a general gift for review", async () => {
        const out = await dispatch(event("checkout.session.completed", { id: uid("cs_test"), object: "checkout.session", mode: "payment", status: "complete", payment_status: "paid", livemode: false, customer: null, subscription: null, payment_intent: "pi_selftest_ext", amount_total: 1500, currency: "gbp", customer_details: { email: "outside@example.org", name: "Outside Donor" }, invoice: null, metadata: {} }), opts);
        const d = out.donationRef ? await get<Donation>("donations", out.donationRef) : null;
        return out.result === "created" && d?.tags.includes("stripe-external") && d.preferredTarget.type === "general" && d.cash?.amount.currency === "GBP" ? true : `result=${out.result} tags=${d?.tags}`;
      });

      await t.check("GMD never goes to Stripe, even when chosen", async () => {
        const routes = effectiveRoutes({ ...DEFAULT_PAYMENT_SETTINGS, routes: { GMD: "stripe", USD: "stripe", GBP: "stripe", EUR: "stripe" } });
        return routes.GMD === "local" ? true : `GMD=${routes.GMD}`;
      });

      await t.check("unknown event types are acknowledged and ignored", async () => {
        const out = await dispatch(event("customer.created", { id: "cus_selftest_x" }), opts);
        return out.result === "ignored";
      });
    } finally {
      await dropScratch(root);
    }
    return t.cases;
  },
};
