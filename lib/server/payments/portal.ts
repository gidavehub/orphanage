import "server-only";

// Stripe Customer Portal by magic link (integrations §3.7, PLAN D70). Donors have no accounts: they
// ask at /donate/manage, get a 60-minute link by email (or a 7-day one in their receipts), and the
// link opens Stripe's portal for their card. Several Stripe customers (a donor who gave by card more
// than once) get a chooser. We never prefill Checkout from an unauthenticated email.

import type { RecurringGift } from "@/lib/model/domain/giving";
import { FREQUENCY_LABEL } from "@/lib/model/labels";
import { formatMoney } from "@/lib/money";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { signTokenFor } from "@/lib/server/security/hmac";
import { absolute } from "@/lib/server/url";
import { getStripe } from "./stripe";

export const MANAGE_LINK_TTL = 60 * 60_000;
export const RECEIPT_PORTAL_TTL = 7 * 86_400_000;

export type PortalChoice = { index: number; label: string };

/** The donor's card regular gifts, one entry per Stripe customer (newest first). */
export async function stripeGiftsOf(donorId: string): Promise<Array<{ customerId: string; label: string }>> {
  const page = await getStore().list<RecurringGift>(C.recurringGifts, { where: [{ field: "donorId", op: "==", value: donorId }], orderBy: { field: "createdAt", dir: "desc" }, limit: 20 });
  const seen = new Map<string, string>();
  for (const g of page.items) {
    if (g.provider !== "stripe" || !g.stripe?.customerId || seen.has(g.stripe.customerId)) continue;
    const status = g.status === "cancelled" ? " (stopped)" : g.status === "past_due" ? " (payment needs updating)" : "";
    seen.set(g.stripe.customerId, `${formatMoney(g.amount)} ${FREQUENCY_LABEL[g.frequency].toLowerCase()}${g.causeSlug && g.causeSlug !== "general" ? ` · ${g.causeSlug.replace(/-/g, " ")}` : ""}${status}`);
  }
  return [...seen].map(([customerId, label]) => ({ customerId, label }));
}

/** The signed link to the portal (60 minutes from /donate/manage, 7 days in receipts). */
export function portalLink(donorId: string, ttlMs: number = MANAGE_LINK_TTL): string {
  return absolute(`/api/stripe/portal?t=${encodeURIComponent(signTokenFor("portal", donorId, ttlMs))}`);
}

/**
 * A Customer Portal URL for the donor's gift number `idx` (null when they have one), returning to
 * `base`/donate/manage. Null when Stripe is off or the donor has no card gift.
 */
export async function portalSessionFor(donorId: string, idx: number | null, base: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const gifts = await stripeGiftsOf(donorId);
  const pick = idx === null ? (gifts.length === 1 ? gifts[0] : null) : (gifts[idx] ?? null);
  if (!pick) return null;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: pick.customerId,
      return_url: `${base}/donate/manage?done=1`,
      ...(env.stripe.portalConfigId ? { configuration: env.stripe.portalConfigId } : {}),
    });
    return session.url;
  } catch (err) {
    log.warn("stripe.portal_failed", { err });
    return null;
  }
}
