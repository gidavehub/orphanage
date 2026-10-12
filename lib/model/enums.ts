// Shared primitive types and enumerations (client-safe; imports nothing).
// The single home of every enum used across forms, storage, admin and public pages (PLAN D19).
// Labels live in lib/model/labels.ts; statuses in lib/model/status.ts.
//
// Conventions (data-model §2, PLAN D30):
// - every persisted field whose name ends in `At` is epoch-ms `Millis`, in records and content alike;
// - money is an integer number of minor units plus a currency, never summed across currencies;
// - enum ids are snake_case; URL tokens use the same ids (except frequency `once`, see lib/routes.ts).

/** Epoch milliseconds, UTC. Haven's org timezone is Africa/Banjul (UTC+0, no DST). */
export type Millis = number;
/** Firebase uid, or `loc_<id>` in local (practice) mode. */
export type Uid = string;
/** Lowercase ISO 3166-1 alpha-2 (as in content/world.ts and lib/countries.ts), or `"other"`. */
export type CountryCode = string;

/**
 * Valid document ids in both storage adapters (PLAN D29): letters, digits, `_ ~ . -`, 1–128
 * characters, no leading dot and no `..`. Dots allow content ids (`home.hero`), `~` allows retention
 * ids (`collection~id`), a leading `-` or `_` allows base64url hashes. `/` is never allowed.
 */
export const DOCUMENT_ID_RE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9_~.-]{1,128}$/;
export function isValidDocumentId(id: unknown): id is string {
  return typeof id === "string" && DOCUMENT_ID_RE.test(id);
}

/* ── Money ─────────────────────────────────────────────────────────────── */

export const CURRENCIES = ["GMD", "USD", "GBP", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** Integer minor units (butut, cents, pence) plus the currency. */
export type Money = { amountMinor: number; currency: Currency };

export const FREQUENCIES = ["one_time", "monthly", "quarterly", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export function isFrequency(v: unknown): v is Frequency {
  return typeof v === "string" && (FREQUENCIES as readonly string[]).includes(v);
}

/* ── Programmes ────────────────────────────────────────────────────────── */

/** Programme ids (= ProgrammeIconName in components/art/ProgrammeIcons.tsx). */
export const PROGRAMME_IDS = ["protection", "education", "medical", "psychological", "legal", "family"] as const;
export type ProgrammeId = (typeof PROGRAMME_IDS)[number];
export function isProgrammeId(v: unknown): v is ProgrammeId {
  return typeof v === "string" && (PROGRAMME_IDS as readonly string[]).includes(v);
}

/** Public URL slugs of the six programme pages; each programme also has a `kind: 'programme'` cause with the same slug (D40). */
export const PROGRAMME_SLUGS = ["child-protection", "education", "medical", "counselling", "legal", "family-community"] as const;
export type ProgrammeSlug = (typeof PROGRAMME_SLUGS)[number];
export function isProgrammeSlug(v: unknown): v is ProgrammeSlug {
  return typeof v === "string" && (PROGRAMME_SLUGS as readonly string[]).includes(v);
}

export const PROGRAMME_SLUG: Record<ProgrammeId, ProgrammeSlug> = {
  protection: "child-protection",
  education: "education",
  medical: "medical",
  psychological: "counselling",
  legal: "legal",
  family: "family-community",
};

export function programmeIdOfSlug(slug: string): ProgrammeId | null {
  for (const id of PROGRAMME_IDS) if (PROGRAMME_SLUG[id] === slug) return id;
  return null;
}

/* ── People and contact ────────────────────────────────────────────────── */

export const CONTACT_METHODS = ["email", "phone", "whatsapp", "sms"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

/** One age band for support, concern, appointment and sponsor records (D82). */
export const AGE_BANDS = ["0-4", "5-9", "10-14", "15-17", "18+", "unknown"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Relationship of the person asking to the child (data-model §4.2 + D81 extensions). */
export const RELATIONSHIPS = [
  "self",
  "parent",
  "guardian",
  "grandparent",
  "relative",
  "teacher",
  "social_worker",
  "professional",
  "community_member",
  "young_person",
  "institution",
  "other",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const YES_NO_UNSURE = ["yes", "no", "unsure"] as const;
export type YesNoUnsure = (typeof YES_NO_UNSURE)[number];

/** Stored urgency of a support request. The admin's "immediate" is derived (D83). */
export const URGENCY3 = ["low", "medium", "high"] as const;
export type Urgency3 = (typeof URGENCY3)[number];

/** "How did you hear about us?" on the volunteer and partnership forms (D81). */
export const HEARD_FROM = [
  "search_engine",
  "social_media",
  "friend_or_colleague",
  "event",
  "news_or_media",
  "partner_organisation",
  "haven_staff",
  "other",
] as const;
export type HeardFrom = (typeof HEARD_FROM)[number];

/* ── Records: shared shapes ────────────────────────────────────────────── */

/** AES-256-GCM envelope with base64url fields. Opened only inside the DAL after the permission check. */
export type Sealed = { $sealed: 1; kid: string; iv: string; tag: string; ct: string };

/** A consent or acknowledgement tick, stamped with the notice version the person saw (e.g. "privacy-2026-10"). */
export type ConsentStamp = { at: Millis; noticeVersion: string };

export interface BaseDoc {
  createdAt: Millis;
  updatedAt: Millis;
  /** +1 on every write; admin edits send `expectedVersion` (optimistic concurrency). */
  version: number;
}

export const INTAKE_SOURCES = ["web_form", "staff_entry", "moved_from_support", "moved_from_contact", "stripe", "import"] as const;
export type IntakeSource = (typeof INTAKE_SOURCES)[number];

/** Retention policy ids (data-model §11.4). Values live in `settings/retention`. */
export const RETENTION_POLICY_IDS = [
  "support.unsupported",
  "support.supported",
  "appointment",
  "concern",
  "donation.financial",
  "donation.unfulfilled",
  "donor.profile",
  "volunteer.declined",
  "volunteer.former",
  "partnership",
  "contact",
  "report_request",
  "newsletter.unconfirmed",
  "newsletter.unsubscribed",
  "data_request",
  "story_submission",
  "audit",
  "outbox",
  "ephemeral",
  "media.consent",
] as const;
export type RetentionPolicyId = (typeof RETENTION_POLICY_IDS)[number];

export type RetentionInfo = {
  policy: RetentionPolicyId;
  /** Set when the record reaches a terminal state. */
  retainUntil: Millis | null;
  /** Blocks deletion (set by a super admin or safeguarding officer, with the reason audited). */
  legalHold: boolean;
};

/** Shared shape of every workflow record ("case"). The reference is also the document id. */
export interface CaseDoc<S extends string> extends BaseDoc {
  /** Sequenced `HVN-PP-YYYY-NNNN`; concerns use a random `HVN-XXXX-XXXX`. */
  reference: string;
  status: S;
  statusChangedAt: Millis;
  assignedTo: Uid | null;
  /** Denormalised for lists; refreshed on staff rename. */
  assignedName: string | null;
  assignedAt: Millis | null;
  /** "Remind me" date shown on the owner's Today. */
  followUpAt: Millis | null;
  /** Inbox "Later" (D83). */
  snoozedUntil: Millis | null;
  /** Staff who opened the record since its last change (D83). */
  seenBy: Uid[];
  lastActivityAt: Millis;
  closedAt: Millis | null;
  /** Hides from queues; status unchanged. */
  archived: boolean;
  archivedAt: Millis | null;
  tags: string[];
  /** Lowercase tokens: reference, email, name words, phone last 6 digits. NEVER sealed or narrative text. */
  searchTokens: string[];
  retention: RetentionInfo;
  source: IntakeSource;
  /** Seeded demo data (practice mode); excluded from exports and stats. */
  isSample?: true;
}

/* ── Giving ────────────────────────────────────────────────────────────── */

export type AllocationTarget =
  | { type: "general" }
  | { type: "programme"; programmeId: ProgrammeId }
  | { type: "cause"; causeSlug: string };

/** Stable string key of an allocation target: `general`, `programme:education`, `cause:eid-clothes-gifts`. Also Stripe `haven_target`. */
export function targetKey(t: AllocationTarget): string {
  switch (t.type) {
    case "general":
      return "general";
    case "programme":
      return `programme:${t.programmeId}`;
    case "cause":
      return `cause:${t.causeSlug}`;
  }
}

/** Inverse of `targetKey`; returns null for anything malformed. */
export function parseTargetKey(key: string): AllocationTarget | null {
  if (key === "general") return { type: "general" };
  const [kind, value, ...rest] = key.split(":");
  if (rest.length || !value) return null;
  if (kind === "programme") return isProgrammeId(value) ? { type: "programme", programmeId: value } : null;
  if (kind === "cause") return /^[a-z0-9][a-z0-9-]{0,79}$/.test(value) ? { type: "cause", causeSlug: value } : null;
  return null;
}

export const IN_KIND_CATEGORIES = [
  "school_materials",
  "clothing",
  "bedding",
  "food_supplies",
  "medical_supplies",
  "computers_devices",
  "furniture",
  "professional_services",
  "other",
] as const;
export type InKindCategory = (typeof IN_KIND_CATEGORIES)[number];

/** Condition of offered items (data-model + D81 `mixed`). */
export const IN_KIND_CONDITIONS = ["new", "good", "used", "mixed"] as const;
export type InKindCondition = (typeof IN_KIND_CONDITIONS)[number];

/** How in-kind items reach Haven. `to_arrange` is a staff value; the public form offers the first three. */
export const HANDOVERS = ["drop_off", "collection", "shipping", "to_arrange"] as const;
export type Handover = (typeof HANDOVERS)[number];

/** Pledge-route payment methods offered by the donate widget (integrations §3.2). */
export const LOCAL_PAYMENT_METHODS = ["wave", "afrimoney", "qmoney", "bank_transfer", "card_link"] as const;
export type LocalPaymentMethod = (typeof LOCAL_PAYMENT_METHODS)[number];

/** How a received cash gift was paid (data-model §4.3). */
export const PAYMENT_METHODS = ["stripe", "bank_transfer", "mobile_money", "cash", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/* ── Support, safeguarding and counselling ────────────────────────────── */

/** Stored support-request categories; also the `?type=` URL token (D80). */
export const SUPPORT_CATEGORIES = ["education", "medical", "counselling", "legal", "food_supplies", "family_support", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export function isSupportCategory(v: unknown): v is SupportCategory {
  return typeof v === "string" && (SUPPORT_CATEGORIES as readonly string[]).includes(v);
}

/** Form-only: `child_protection` never reaches `supportRequests`; it is written as a concern (D79). */
export const SUPPORT_FORM_CATEGORIES = [...SUPPORT_CATEGORIES, "child_protection"] as const;
export type SupportFormCategory = SupportCategory | "child_protection";
export function isSupportFormCategory(v: unknown): v is SupportFormCategory {
  return typeof v === "string" && (SUPPORT_FORM_CATEGORIES as readonly string[]).includes(v);
}

/** Programme that owns each support category (data-model §4.2 `programmeId` derivation). */
export const SUPPORT_CATEGORY_PROGRAMME: Record<SupportCategory, ProgrammeId> = {
  education: "education",
  medical: "medical",
  counselling: "psychological",
  legal: "legal",
  food_supplies: "family",
  family_support: "family",
  other: "family",
};

/** Concern types (data-model + D81: child_labour, bullying, harmful_practice replace child_marriage). */
export const CONCERN_TYPES = [
  "physical",
  "sexual",
  "emotional",
  "neglect",
  "exploitation",
  "child_labour",
  "trafficking",
  "harmful_practice",
  "online",
  "bullying",
  "other",
] as const;
export type ConcernType = (typeof CONCERN_TYPES)[number];

/* ── Engagement ────────────────────────────────────────────────────────── */

/** Contact form categories (D104: no `privacy`; privacy requests have their own page). */
export const CONTACT_CATEGORIES = [
  "general",
  "donation",
  "partnership",
  "volunteering",
  "media",
  "programme_info",
  "resource_request",
  "technical_support",
] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];
export function isContactCategory(v: unknown): v is ContactCategory {
  return typeof v === "string" && (CONTACT_CATEGORIES as readonly string[]).includes(v);
}

export const VOLUNTEER_INTERESTS = [
  "community_outreach",
  "education_support",
  "counselling_psychosocial",
  "medical_assistance",
  "legal_assistance",
  "fundraising",
  "communications",
  "research",
  "administration",
  "technology_support",
] as const;
export type VolunteerInterest = (typeof VOLUNTEER_INTERESTS)[number];

/** Interests that involve children and therefore need a safeguarding check before approval (data-model §5.4). */
export const CHILD_FACING_INTERESTS: readonly VolunteerInterest[] = [
  "community_outreach",
  "education_support",
  "counselling_psychosocial",
  "medical_assistance",
];

export const VOLUNTEER_DAYS = ["weekdays", "weekends", "evenings"] as const;
export type VolunteerDay = (typeof VOLUNTEER_DAYS)[number];

export const VOLUNTEER_HOURS = ["1-3", "4-8", "9-16", "17+"] as const;
export type VolunteerHours = (typeof VOLUNTEER_HOURS)[number];

export const VOLUNTEER_MODES = ["remote", "in_person", "either"] as const;
export type VolunteerMode = (typeof VOLUNTEER_MODES)[number];

export const PARTNERSHIP_TYPES = [
  "programme",
  "corporate_sponsorship",
  "technical_assistance",
  "institutional_referral",
  "research_collaboration",
  "donation_partnership",
  "awareness_campaign",
  "other",
] as const;
export type PartnershipType = (typeof PARTNERSHIP_TYPES)[number];

/** Organisation kinds on the partnership form (data-model + D81 extensions). */
export const PARTNER_KINDS = [
  "ngo",
  "orphanage_childrens_home",
  "company",
  "school",
  "university",
  "faith_org",
  "health_provider",
  "legal_practice",
  "government",
  "other",
] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

/** Who is sharing a story or testimonial (public-pages §3.14). */
export const STORY_SUBMITTER_ROLES = ["beneficiary", "donor", "volunteer", "partner", "professional"] as const;
export type StorySubmitterRole = (typeof STORY_SUBMITTER_ROLES)[number];

/** Kinds of outside service in the referral directory and on referrals. */
export const REFERRAL_TYPES = ["health", "legal", "education", "protection", "psychosocial", "community", "government", "other"] as const;
export type ReferralType = (typeof REFERRAL_TYPES)[number];

export const REFERRAL_OUTCOMES = ["waiting", "accepted", "declined", "completed"] as const;
export type ReferralOutcome = (typeof REFERRAL_OUTCOMES)[number];

/* ── Resources ─────────────────────────────────────────────────────────── */

export const RESOURCE_CATEGORIES = [
  "child_safeguarding",
  "child_rights",
  "parenting",
  "mental_health",
  "education",
  "medical_information",
  "legal_information",
  "organisational_policies",
  "annual_reports",
  "research",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export function isResourceCategory(v: unknown): v is ResourceCategory {
  return typeof v === "string" && (RESOURCE_CATEGORIES as readonly string[]).includes(v);
}

/** `public` downloads immediately; `controlled` goes through a request and approval (§9). */
export const RESOURCE_ACCESS = ["public", "controlled"] as const;
export type ResourceAccess = (typeof RESOURCE_ACCESS)[number];

/* ── Media consent (D53) ───────────────────────────────────────────────── */

export const CONSENT_STATES = ["not_required", "valid", "missing", "expired", "withdrawn"] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

export type ConsentScope = { website: boolean; social: boolean; print: boolean; story: boolean; image: boolean; video: boolean };
