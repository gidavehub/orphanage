import "server-only";

// Checkout intents (PLAN D67; integrations §3.4): donationIntents/{intentId} records a card gift that is
// on its way to Stripe. It is written BEFORE the Checkout Session is created, so nothing the donor
// typed is lost if Stripe fails; I1's startCheckout attaches the session id. The Donation itself is
// created later by the webhook, /api/stripe/return or the sweeper (never here). Intents expire after
// 48 hours. The id comes from the widget's submissionId, so a double submit reuses the same intent.

import type { Attribution, DonationIntent, DonorSnapshot } from "@/lib/model/domain/giving";
import type { AllocationTarget, ConsentStamp, Frequency, Millis, Money } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";
import { sha256Hex } from "@/lib/server/security/hmac";

const INTENT_TTL_MS = 48 * 60 * 60 * 1000;

/** sha256(submissionId), 20 hex characters: the same submission always maps to the same intent. */
export function intentIdFrom(submissionId: string): string {
  return sha256Hex(`intent|${submissionId}`).slice(0, 20);
}

export function intentPath(intentId: string): string {
  return docPath("donationIntents", intentId);
}

export type NewIntent = {
  submissionId: string;
  amount: Money;
  baseAmount: Money;
  coverFees: boolean;
  frequency: Frequency;
  preferredTarget: AllocationTarget;
  causeSlug: string | null;
  sponsorRef: string | null;
  donor: DonorSnapshot;
  recognition: DonationIntent["recognition"];
  comments: string | null;
  updatesConsent: ConsentStamp | null;
  attribution: Attribution | null;
};

/**
 * Writes (or refreshes) the open intent for this submission and returns its id. A completed intent is
 * never overwritten: the caller gets `completed: true` and should not start another checkout.
 */
export async function writeIntent(intentId: string, i: NewIntent, now: Millis = Date.now()): Promise<{ intentId: string; completed: boolean }> {
  return getStore().runTransaction(async (tx) => {
    const path = intentPath(intentId);
    const existing = await tx.get<DonationIntent>(path);
    if (existing && existing.status === "completed") return { intentId, completed: true };
    const doc: DonationIntent = {
      createdAt: existing?.createdAt ?? now,
      expireAt: now + INTENT_TTL_MS,
      submissionId: i.submissionId,
      amount: i.amount,
      baseAmount: i.baseAmount,
      coverFees: i.coverFees,
      frequency: i.frequency,
      preferredTarget: i.preferredTarget,
      causeSlug: i.causeSlug,
      sponsorRef: i.sponsorRef,
      donor: i.donor,
      recognition: i.recognition,
      comments: i.comments,
      updatesConsent: i.updatesConsent,
      attribution: i.attribution,
      // Filled in by startCheckout (I1) once Stripe returns the session.
      checkoutSessionId: existing?.checkoutSessionId ?? "",
      status: "open",
      donationRef: null,
      recurringGiftRef: null,
    };
    tx.set(path, doc);
    return { intentId, completed: false };
  });
}

/** Records the Checkout Session on the intent (I1 calls this right after creating it). */
export async function attachCheckoutSession(intentId: string, checkoutSessionId: string): Promise<void> {
  await getStore().update(intentPath(intentId), { checkoutSessionId });
}

/** The intent for a Checkout Session id (the thank-you page's `session_id`), or null. */
export async function readIntentBySession(checkoutSessionId: string): Promise<WithId<DonationIntent> | null> {
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(checkoutSessionId)) return null;
  try {
    const page = await getStore().list<DonationIntent>(C.donationIntents, {
      where: [{ field: "checkoutSessionId", op: "==", value: checkoutSessionId }],
      // Ordering by the equality field needs only the automatic single-field index.
      orderBy: { field: "checkoutSessionId", dir: "asc" },
      limit: 1,
    });
    return page.items[0] ?? null;
  } catch (err) {
    log.error("giving.intent_read_failed", { err });
    return null;
  }
}
