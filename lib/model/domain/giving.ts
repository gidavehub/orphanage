// Giving records (data-model §4.3 with PLAN D36, D37, D65, D67–D72). Types only.
// Stripe gifts create a donationIntents doc at checkout; the Donation exists only once money is
// real (webhook, return route or sweeper). Pledges create a `pledged` Donation immediately.

import type {
  AllocationTarget,
  BaseDoc,
  CaseDoc,
  ConsentStamp,
  CountryCode,
  Currency,
  Frequency,
  Handover,
  InKindCategory,
  InKindCondition,
  LocalPaymentMethod,
  Millis,
  Money,
  PaymentMethod,
  RetentionInfo,
  Uid,
} from "../enums";
import type { DonationStatus, RecurringStatus } from "../status";

/** Campaign attribution stored on gifts (D65). No personal data. */
export type Attribution = { utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string };

/** The donor as they were at gift time (receipts never change retroactively). */
export interface DonorSnapshot {
  fullName: string;
  donorType: "individual" | "organisation";
  organisationName: string | null;
  email: string;
  emailLower: string;
  phone: string | null;
  country: CountryCode;
}

/** One line of "where this gift went". Sum ≤ amount (or estimated value), same currency as the gift. */
export interface DonationAllocation {
  id: string;
  target: AllocationTarget;
  amount: Money;
  at: Millis;
  by: Uid;
  note: string | null;
}

export type DonationCancelReason = "checkout_failed" | "refunded" | "pledge_withdrawn" | "duplicate" | "other";

export interface Donation extends CaseDoc<DonationStatus> {
  kind: "cash" | "in_kind";
  /** donors/{emailHash}. */
  donorId: string;
  donor: DonorSnapshot;
  /** Anonymous recognition affects public lists only. */
  recognition: "named" | "anonymous";
  /** one_time for in-kind. */
  frequency: Frequency;
  /** The donor's choice ("preferred programme"). */
  preferredTarget: AllocationTarget;
  /** The cause page the donor gave from (attribution; may differ from allocation). */
  causeSlug: string | null;
  /** Sponsorship profile code (HVN-SP-NNNN) when the gift came from a profile. */
  sponsorRef: string | null;
  /** ≤ 1000. */
  comments: string | null;
  updatesConsent: ConsentStamp | null;
  attribution: Attribution | null;
  cash: {
    /** What was charged or pledged (after any cover-fees top-up). */
    amount: Money;
    /** What the donor chose before cover fees. */
    baseAmount: Money;
    coverFees: boolean;
    method: PaymentMethod;
    /** The pledge-route method the donor picked (Wave, bank transfer…). */
    localMethod: LocalPaymentMethod | null;
    /** The donor asked for a card link once card payments are switched on. */
    payLater?: "card_link";
    /** Card data is never stored; Stripe Checkout hosts the card form. */
    stripe: {
      checkoutSessionId: string | null;
      paymentIntentId: string | null;
      chargeId: string | null;
      customerId: string | null;
      subscriptionId: string | null;
      invoiceId: string | null;
      balanceTransactionId: string | null;
      /** From the balance transaction (settlement currency). */
      fee: Money | null;
      net: Money | null;
      /** Test-mode gifts are excluded from totals. */
      livemode: boolean;
    } | null;
    /** Bank or mobile-money reference typed by finance. */
    externalRef: string | null;
  } | null;
  inKind: {
    categories: InKindCategory[];
    /** ≤ 1000. */
    description: string;
    estimatedValue: Money | null;
    /** Free text ≤ 80 ("40 school bags"). */
    quantity: string | null;
    condition: InKindCondition | null;
    delivery: Handover;
    availableFrom: Millis | null;
    /** City or region for collection planning, ≤ 80. */
    locality: string | null;
    received: Array<{ description: string; quantity: string; value: Money | null; receivedAt: Millis; by: Uid }>;
  } | null;
  allocations: DonationAllocation[];
  acknowledgement: { at: Millis; by: Uid | "system"; outboxId: string } | null;
  /** private/receipts/{yyyy}/{number}.pdf when generated. */
  receipt: { number: string; issuedAt: Millis; pdfPath: string | null } | null;
  recurringGiftRef: string | null;
  receivedAt: Millis | null;
  completedAt: Millis | null;
  cancelledAt: Millis | null;
  cancelReason: DonationCancelReason | null;
  refund: { amount: Money; at: Millis; stripeRefundId: string | null } | null;
}

/** donationIntents/{id}: a Stripe Checkout in progress (TTL 48 h via expireAt). */
export interface DonationIntent {
  createdAt: Millis;
  expireAt: Millis;
  /** Idempotency key from the widget (double-submit returns the same session). */
  submissionId: string;
  amount: Money;
  baseAmount: Money;
  coverFees: boolean;
  frequency: Frequency;
  preferredTarget: AllocationTarget;
  causeSlug: string | null;
  sponsorRef: string | null;
  donor: DonorSnapshot;
  recognition: "named" | "anonymous";
  comments: string | null;
  updatesConsent: ConsentStamp | null;
  attribution: Attribution | null;
  checkoutSessionId: string;
  status: "open" | "completed" | "expired";
  /** Set in the same transaction that creates the Donation (idempotency). */
  donationRef: string | null;
  recurringGiftRef: string | null;
}

/** donors/{emailHash}: emailHash = HMAC-SHA256(HAVEN_LOOKUP_SECRET, emailLower), base64url, 32 chars. */
export interface Donor extends BaseDoc {
  email: string;
  emailLower: string;
  fullName: string;
  donorType: "individual" | "organisation";
  organisationName: string | null;
  country: CountryCode;
  phone: string | null;
  /** Latest preference. */
  recognition: "named" | "anonymous";
  updatesConsent: ConsentStamp | null;
  updatesWithdrawnAt: Millis | null;
  stripeCustomerId: string | null;
  /** Received gifts only, net of refunds. */
  totals: Partial<Record<Currency, { lifetimeMinor: number; gifts: number }>>;
  firstGiftAt: Millis | null;
  lastGiftAt: Millis | null;
  activeRecurring: number;
  searchTokens: string[];
  retention: RetentionInfo;
}

export interface RecurringGift extends BaseDoc {
  /** HVN-RG-… (also the doc id). */
  reference: string;
  donorId: string;
  donor: Pick<DonorSnapshot, "fullName" | "email" | "emailLower" | "country">;
  amount: Money;
  /** Stripe: month×1, month×3, year×1. */
  frequency: Exclude<Frequency, "one_time">;
  target: AllocationTarget;
  causeSlug: string | null;
  /** manual = bank standing order recorded by finance. */
  provider: "stripe" | "manual";
  stripe: { customerId: string; subscriptionId: string; latestInvoiceId: string | null } | null;
  status: RecurringStatus;
  startedAt: Millis;
  currentPeriodEnd: Millis | null;
  cancelAt: Millis | null;
  cancelledAt: Millis | null;
  cancelReason: string | null;
  giftCount: number;
  lastPaymentAt: Millis | null;
  lastFailureAt: Millis | null;
  searchTokens: string[];
  retention: RetentionInfo;
}

/** stripeEvents/{stripeEventId}: written inside the domain transaction (D69). */
export interface StripeEventRecord {
  type: string;
  receivedAt: Millis;
  processedAt: Millis | null;
  donationRef: string | null;
  error: string | null;
  /** TTL +90 days. */
  expireAt: Millis;
}

/**
 * causeTotals/{slug}: per-currency totals incremented inside allocation transactions (D36), kept
 * off the content cause doc so money writes never collide with an editor's version.
 */
export type CauseTotals = Partial<Record<Currency, { raisedMinor: number; gifts: number }>> & { updatedAt?: Millis };
