import "server-only";

// Pay-later card links (integrations §3.11): donors who pledged "card: email me a secure link" while
// card payments were off. When cards go live, finance sends `card_payment_link` (a signed 14-day `pay`
// link). Opening it creates a fresh Checkout Session for the EXISTING pledged gift
// (metadata.haven_donation_ref), so paying moves that gift to received and no second record is made.

import type { Donation } from "@/lib/model/domain/giving";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, audit } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { drainAfterResponse, enqueueEmail } from "@/lib/server/email/outbox";
import { readDonation } from "@/lib/server/giving/ledger";
import { log } from "@/lib/server/log";
import { getPaymentSettings } from "@/lib/server/public/settings";
import { signTokenFor, utcDay } from "@/lib/server/security/hmac";
import { absolute } from "@/lib/server/url";
import type { HavenMeta } from "./metadata";
import { ensureCauseProduct } from "./products";
import { effectiveRoutes } from "./routing";
import { getStripe } from "./stripe";

const PAY_TTL = 14 * 86_400_000;

/** Pledges still waiting whose donors asked to pay by card. */
export async function payLaterPledges(): Promise<Array<{ ref: string; amount: string; name: string; createdAt: number }>> {
  const page = await getStore().list<Donation>(C.donations, { where: [{ field: "status", op: "==", value: "pledged" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
  return page.items
    .filter((d) => d.kind === "cash" && d.cash?.payLater === "card_link" && d.donor.email && !(d as { isSample?: boolean }).isSample)
    .map((d) => ({ ref: d.id, amount: `${d.cash!.amount.currency} ${(d.cash!.amount.amountMinor / 100).toFixed(2)}`, name: d.donor.fullName, createdAt: d.createdAt }));
}

/** A Checkout URL that completes pledged gift `ref`, or null when Stripe is off or the gift isn't payable. */
export async function payLinkSession(ref: string, base: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const d = await readDonation(ref);
  if (!d || d.kind !== "cash" || !d.cash || d.status !== "pledged") return null;
  const settings = await getPaymentSettings();
  if (effectiveRoutes(settings)[d.cash.amount.currency] !== "stripe") return null;
  const slug = d.causeSlug ?? "general";
  const product = await ensureCauseProduct(stripe, { slug, title: slug === "general" ? "Where it's needed most" : slug.replace(/-/g, " ") });
  const meta: HavenMeta = {
    haven_v: "1",
    haven_donation_ref: ref,
    haven_kind: "one_time",
    haven_frequency: "one_time",
    haven_target: d.preferredTarget.type === "general" ? "general" : d.preferredTarget.type === "programme" ? `programme:${d.preferredTarget.programmeId}` : `cause:${d.preferredTarget.causeSlug}`,
    haven_cause: slug,
    ...(d.sponsorRef ? { haven_sponsor_ref: d.sponsorRef } : {}),
    haven_cover_fees: d.cash.coverFees ? "1" : "0",
    haven_base_minor: String(d.cash.baseAmount.amountMinor),
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      submit_type: "donate",
      line_items: [{ quantity: 1, price_data: { currency: d.cash.amount.currency.toLowerCase(), unit_amount: d.cash.amount.amountMinor, product } }],
      customer_email: d.donor.email,
      client_reference_id: ref,
      metadata: meta,
      payment_intent_data: { metadata: meta, description: `Gift to Haven (${ref})` },
      adaptive_pricing: { enabled: false },
      locale: "auto",
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      success_url: `${base}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/donate/thank-you?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(signTokenFor("thanks", ref, 7 * 86_400_000))}`,
    },
    { idempotencyKey: `pay:${ref}:${utcDay()}` },
  );
  return session.url ?? null;
}

/** Queues `card_payment_link` for pledged gifts whose donors asked for a card link. */
export async function sendCardPaymentLinks(refs: string[], v: Viewer): Promise<{ queued: number }> {
  if (!getStripe()) return { queued: 0 };
  let queued = 0;
  for (const ref of refs.slice(0, 100)) {
    const d = await readDonation(ref);
    if (!d || d.status !== "pledged" || d.cash?.payLater !== "card_link" || !d.donor.email) continue;
    try {
      const link = absolute(`/api/donations/pay?t=${encodeURIComponent(signTokenFor("pay", ref, PAY_TTL))}`);
      const r = await enqueueEmail({ template: "card_payment_link", to: [d.donor.email], vars: { reference: ref, firstName: d.recognition === "anonymous" ? "" : d.donor.fullName.split(/\s+/)[0] ?? "", link }, dedupeKey: `${ref}~paylink`, related: { path: `${C.donations}/${ref}`, reference: ref } });
      if (!r.deduped) queued++;
    } catch (err) {
      log.warn("pay.link_failed", { err });
    }
  }
  if (queued) {
    await audit({ actor: actorOf(v), action: "donation.pay_links", area: "donations", summary: `${v.displayName} sent ${queued} card payment link${queued === 1 ? "" : "s"}`, feed: true });
    drainAfterResponse();
  }
  return { queued };
}
