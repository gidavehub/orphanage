// System settings documents in `settings/{id}` (data-model §4.7 with PLAN D51, D63, D71, D83,
// D105, D109, D131; integrations §3.2, §4.5). Client-safe types and defaults: the public readers
// (lib/server/public/settings.ts) fall back to these when a document is absent.

import type { EmailTemplateId } from "../email";
import type { Currency, LocalPaymentMethod, Millis, RetentionPolicyId, Uid } from "../enums";

export const SETTINGS_DOC_IDS = ["payment", "org", "notifications", "forms", "retention", "emailCopy", "seed"] as const;
export type SettingsDocId = (typeof SETTINGS_DOC_IDS)[number];

/* ── settings/payment (Settings › Giving, finance) ─────────────────────── */

export type PaymentRoute = "stripe" | "local";

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
  sortCode?: string;
  iban?: string;
  swift?: string;
  /** What donors should put as the payment reference ("your DN reference"). */
  referenceHint?: string;
}

export interface MobileMoneyAccount {
  provider: "wave" | "afrimoney" | "qmoney";
  name: string;
  number: string;
}

/** How to pay one currency on the local (pledge) route. Values are CLIENT input. */
export interface PaymentInstruction {
  /** Methods offered as chips in the donate widget, in order. */
  methods: LocalPaymentMethod[];
  bank: BankDetails | null;
  mobileMoney: MobileMoneyAccount[];
  note: string | null;
}

export interface ReceiptSettings {
  legalName: string;
  registration: string;
  /** Print the "no goods or services were provided" line. */
  goodsServicesStatement: boolean;
  signatory: string;
  footer: string;
  /** Send the thank-you and receipt automatically for online gifts. */
  autoSend: boolean;
}

/** Payment configuration (D63). Display config (presets, minimums, in-kind list) is the content doc `donate.config`. */
export interface PaymentSettings {
  /** The admin's choice per currency; Stripe also needs a key and STRIPE_CURRENCIES (effectiveRoutes). */
  routes: Record<Currency, PaymentRoute>;
  instructions: Partial<Record<Currency, PaymentInstruction>>;
  /** Units per 1 USD, admin-set, for display hints and to prefill the finance field only (D38). */
  fx: Record<Currency, number>;
  coverFeesPercent: number;
  /** Major units. Above this, card is refused politely and bank transfer offered (D71). */
  maxOnline: Record<Currency, number>;
  receipt: ReceiptSettings;
  updatedAt?: Millis;
  updatedBy?: Uid;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  routes: { GMD: "local", USD: "stripe", GBP: "stripe", EUR: "stripe" },
  // CLIENT: accounts and numbers come from finance (HANDOFF open items).
  instructions: {
    GMD: { methods: ["wave", "afrimoney", "qmoney", "bank_transfer"], bank: null, mobileMoney: [], note: null },
    USD: { methods: ["bank_transfer", "card_link"], bank: null, mobileMoney: [], note: null },
    GBP: { methods: ["bank_transfer", "card_link"], bank: null, mobileMoney: [], note: null },
    EUR: { methods: ["bank_transfer", "card_link"], bank: null, mobileMoney: [], note: null },
  },
  // CLIENT: placeholder helper rates; finance sets these in Settings › Giving.
  fx: { USD: 1, GBP: 0.75, EUR: 0.86, GMD: 72 },
  coverFeesPercent: 3.5,
  maxOnline: { USD: 10_000, GBP: 8_000, EUR: 9_000, GMD: 700_000 },
  receipt: {
    legalName: "Haven",
    registration: "",
    goodsServicesStatement: true,
    signatory: "",
    footer: "",
    autoSend: true,
  },
};

/* ── settings/org ──────────────────────────────────────────────────────── */

/** Only these three fields remain on settings/org (D51). */
export interface OrgSettings {
  timezone: string;
  /** 1 = January. */
  financialYearStartMonth: number;
  /** High or immediate-risk concerns need a second safeguarding officer to close (D83; owner question). */
  concernTwoPersonClose: boolean;
  updatedAt?: Millis;
  updatedBy?: Uid;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  timezone: "Africa/Banjul",
  financialYearStartMonth: 1,
  concernTwoPersonClose: true,
};

/* ── settings/notifications ────────────────────────────────────────────── */

export const NOTIFY_ROUTE_IDS = [
  "support_new",
  "donation_new",
  "inkind_new",
  "report_request_new",
  "volunteer_new",
  "partnership_new",
  "contact_new",
  "story_new",
  "data_request_new",
] as const;
export type NotifyRouteId = (typeof NOTIFY_ROUTE_IDS)[number];

export interface NotificationSettings {
  /** Default (empty uids): every active safeguarding officer; super admins if none exist (D109). */
  concernAlert: { uids: Uid[]; fallbackEmail: string | null; realertAfterMin: number };
  /** Empty = everyone holding the owning role. */
  routes: Partial<Record<NotifyRouteId, Uid[]>>;
  updatedAt?: Millis;
  updatedBy?: Uid;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  concernAlert: { uids: [], fallbackEmail: null, realertAfterMin: 120 },
  routes: {},
};

/* ── settings/forms ────────────────────────────────────────────────────── */

/** Pause intake without a deploy. */
export interface FormsSettings {
  supportOpen: boolean;
  counsellingOpen: boolean;
  /** Shown instead of a paused form (with the contact details). */
  closedMessage: string | null;
  updatedAt?: Millis;
  updatedBy?: Uid;
}

export const DEFAULT_FORMS_SETTINGS: FormsSettings = {
  supportOpen: true,
  counsellingOpen: true,
  closedMessage: null,
};

/* ── settings/retention (D105) ─────────────────────────────────────────── */

export type RetentionMode = "auto_delete" | "auto_anonymise" | "review" | "ttl" | "linked";

export interface RetentionPolicySetting {
  /** Days after the policy's starting point (closure, financial-year end, last gift…). */
  days: number;
  mode: RetentionMode;
}

export interface RetentionSettings {
  policies: Record<RetentionPolicyId, RetentionPolicySetting>;
  updatedAt?: Millis;
  updatedBy?: Uid;
}

/** Starting policy from data-model §11.4. Needs professional and legal review before launch. */
export const DEFAULT_RETENTION_SETTINGS: RetentionSettings = {
  policies: {
    "support.unsupported": { days: 730, mode: "auto_delete" },
    "support.supported": { days: 2555, mode: "review" },
    appointment: { days: 0, mode: "linked" },
    concern: { days: 2555, mode: "review" },
    "donation.financial": { days: 2555, mode: "auto_anonymise" },
    "donation.unfulfilled": { days: 730, mode: "auto_delete" },
    "donor.profile": { days: 730, mode: "auto_anonymise" },
    "volunteer.declined": { days: 365, mode: "auto_delete" },
    "volunteer.former": { days: 2190, mode: "review" },
    partnership: { days: 1095, mode: "auto_delete" },
    contact: { days: 730, mode: "auto_delete" },
    report_request: { days: 730, mode: "auto_delete" },
    "newsletter.unconfirmed": { days: 30, mode: "auto_delete" },
    "newsletter.unsubscribed": { days: 30, mode: "auto_anonymise" },
    data_request: { days: 1095, mode: "auto_delete" },
    story_submission: { days: 730, mode: "auto_delete" },
    audit: { days: 2555, mode: "auto_delete" },
    outbox: { days: 365, mode: "ttl" },
    ephemeral: { days: 1, mode: "ttl" },
    "media.consent": { days: 2190, mode: "review" },
  },
};

/** What Settings › Data may change per policy. Concerns stay review-only and can never shorten below 7 years. */
export const RETENTION_LIMITS: Record<RetentionPolicyId, { minDays: number; maxDays: number; modes: readonly RetentionMode[] }> = {
  "support.unsupported": { minDays: 365, maxDays: 2555, modes: ["auto_delete", "review"] },
  "support.supported": { minDays: 1095, maxDays: 3650, modes: ["review"] },
  appointment: { minDays: 0, maxDays: 0, modes: ["linked"] },
  concern: { minDays: 2555, maxDays: 9125, modes: ["review"] },
  "donation.financial": { minDays: 2190, maxDays: 3650, modes: ["auto_anonymise", "review"] },
  "donation.unfulfilled": { minDays: 365, maxDays: 2555, modes: ["auto_delete", "review"] },
  "donor.profile": { minDays: 365, maxDays: 2555, modes: ["auto_anonymise", "review"] },
  "volunteer.declined": { minDays: 180, maxDays: 1095, modes: ["auto_delete", "review"] },
  "volunteer.former": { minDays: 1095, maxDays: 3650, modes: ["review"] },
  partnership: { minDays: 365, maxDays: 2555, modes: ["auto_delete", "review"] },
  contact: { minDays: 365, maxDays: 2555, modes: ["auto_delete", "review"] },
  report_request: { minDays: 365, maxDays: 2555, modes: ["auto_delete", "review"] },
  "newsletter.unconfirmed": { minDays: 7, maxDays: 90, modes: ["auto_delete"] },
  "newsletter.unsubscribed": { minDays: 7, maxDays: 90, modes: ["auto_anonymise"] },
  data_request: { minDays: 1095, maxDays: 2555, modes: ["auto_delete", "review"] },
  story_submission: { minDays: 365, maxDays: 2555, modes: ["auto_delete", "review"] },
  audit: { minDays: 2555, maxDays: 3650, modes: ["auto_delete"] },
  outbox: { minDays: 90, maxDays: 365, modes: ["ttl"] },
  ephemeral: { minDays: 1, maxDays: 1, modes: ["ttl"] },
  "media.consent": { minDays: 2190, maxDays: 3650, modes: ["review"] },
};

/* ── settings/emailCopy (integrations §4.5) ────────────────────────────── */

/** Staff-editable wording per template. Only {firstName} and {ref} placeholders are allowed. */
export type EmailCopySettings = Partial<Record<EmailTemplateId, { greeting?: string; main?: string; signOff?: string }>>;
