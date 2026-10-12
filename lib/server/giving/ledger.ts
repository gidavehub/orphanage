import "server-only";

// The gift ledger (data-model §4.3 with PLAN D36–D38, D65, D67, D72): how a Donation record is built
// and read. Pledges (P3) create a `pledged` Donation at once; Stripe gifts create theirs only when the
// money is real (I1 calls buildDonation from the webhook, the return route and the sweeper). A4's
// finance views read and move the same records. Only this module builds a Donation document.

import type { Attribution, Donation, DonorSnapshot } from "@/lib/model/domain/giving";
import {
  targetKey,
  type AllocationTarget,
  type ConsentStamp,
  type Frequency,
  type Handover,
  type InKindCategory,
  type InKindCondition,
  type IntakeSource,
  type LocalPaymentMethod,
  type Millis,
  type Money,
  type PaymentMethod,
  type ProgrammeId,
} from "@/lib/model/enums";
import type { DonationStatus } from "@/lib/model/status";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import type { WithId } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";

export function donationPath(reference: string): string {
  return docPath("donations", reference);
}

/** What a gift from a cause page is meant for (the donor's "preferred programme"). */
export function preferredTargetOf(cause: { slug: string; kind: string; programmeId?: ProgrammeId }): AllocationTarget {
  if (cause.kind === "general" || cause.slug === "general") return { type: "general" };
  if (cause.kind === "programme" && cause.programmeId) return { type: "programme", programmeId: cause.programmeId };
  return { type: "cause", causeSlug: cause.slug };
}

/** Stripe metadata / reporting key of a target (re-exported for I1). */
export { targetKey };

/** How a pledge-route method is recorded on the gift. */
export function paymentMethodOf(local: LocalPaymentMethod | null): { method: PaymentMethod; payLater?: "card_link" } {
  switch (local) {
    case "wave":
    case "afrimoney":
    case "qmoney":
      return { method: "mobile_money" };
    case "card_link":
      return { method: "other", payLater: "card_link" };
    case "bank_transfer":
    case null:
    default:
      return { method: "bank_transfer" };
  }
}

export type NewDonationInput = {
  kind: "cash" | "in_kind";
  status: DonationStatus;
  source: IntakeSource;
  donorId: string;
  donor: DonorSnapshot;
  recognition: Donation["recognition"];
  frequency: Frequency;
  preferredTarget: AllocationTarget;
  causeSlug: string | null;
  sponsorRef: string | null;
  comments: string | null;
  updatesConsent: ConsentStamp | null;
  attribution: Attribution | null;
  cash?: {
    amount: Money;
    baseAmount: Money;
    coverFees: boolean;
    method: PaymentMethod;
    localMethod: LocalPaymentMethod | null;
    payLater?: "card_link";
    stripe?: NonNullable<Donation["cash"]>["stripe"];
  };
  inKind?: {
    categories: InKindCategory[];
    description: string;
    estimatedValue: Money | null;
    condition: InKindCondition | null;
    delivery: Handover;
    locality: string | null;
  };
  receivedAt?: Millis | null;
  recurringGiftRef?: string | null;
};

/** Builds a complete Donation document (the reference is also its id). Fields are set one by one. */
export function buildDonation(reference: string, now: Millis, d: NewDonationInput): Donation {
  const pledged = d.status === "pledged" || d.status === "pending";
  return {
    reference,
    status: d.status,
    statusChangedAt: now,
    assignedTo: null,
    assignedName: null,
    assignedAt: null,
    followUpAt: null,
    snoozedUntil: null,
    seenBy: [],
    lastActivityAt: now,
    closedAt: null,
    archived: false,
    archivedAt: null,
    tags: [],
    searchTokens: buildSearchTokens({
      reference,
      email: d.donor.email,
      names: [d.donor.fullName, d.donor.organisationName],
      phone: d.donor.phone,
      extra: d.sponsorRef ? [d.sponsorRef.toLowerCase()] : [],
    }),
    retention: { policy: pledged ? "donation.unfulfilled" : "donation.financial", retainUntil: null, legalHold: false },
    source: d.source,
    createdAt: now,
    updatedAt: now,
    version: 1,

    kind: d.kind,
    donorId: d.donorId,
    donor: {
      fullName: d.donor.fullName,
      donorType: d.donor.donorType,
      organisationName: d.donor.organisationName,
      email: d.donor.email,
      emailLower: d.donor.emailLower,
      phone: d.donor.phone,
      country: d.donor.country,
    },
    recognition: d.recognition,
    frequency: d.kind === "in_kind" ? "one_time" : d.frequency,
    preferredTarget: d.preferredTarget,
    causeSlug: d.causeSlug,
    sponsorRef: d.sponsorRef,
    comments: d.comments,
    updatesConsent: d.updatesConsent,
    attribution: d.attribution,
    cash:
      d.kind === "cash" && d.cash
        ? {
            amount: d.cash.amount,
            baseAmount: d.cash.baseAmount,
            coverFees: d.cash.coverFees,
            method: d.cash.method,
            localMethod: d.cash.localMethod,
            ...(d.cash.payLater ? { payLater: d.cash.payLater } : {}),
            stripe: d.cash.stripe ?? null,
            externalRef: null,
          }
        : null,
    inKind:
      d.kind === "in_kind" && d.inKind
        ? {
            categories: d.inKind.categories,
            description: d.inKind.description,
            estimatedValue: d.inKind.estimatedValue,
            quantity: null,
            condition: d.inKind.condition,
            delivery: d.inKind.delivery,
            availableFrom: null,
            locality: d.inKind.locality,
            received: [],
          }
        : null,
    allocations: [],
    acknowledgement: null,
    receipt: null,
    recurringGiftRef: d.recurringGiftRef ?? null,
    receivedAt: d.receivedAt ?? null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    refund: null,
  };
}

/** One Donation by reference, or null (no viewer check: callers verify a signed token first). */
export async function readDonation(reference: string): Promise<WithId<Donation> | null> {
  try {
    return await getStore().get<Donation>(donationPath(reference));
  } catch (err) {
    log.error("giving.donation_read_failed", { err });
    return null;
  }
}
