// Support requests, including counselling requests (data-model §4.2 with D77, D79, D80, D83). Types only.

import type {
  AgeBand,
  CaseDoc,
  ConsentStamp,
  ContactMethod,
  CountryCode,
  Millis,
  Money,
  ProgrammeId,
  ReferralOutcome,
  ReferralType,
  Relationship,
  Sealed,
  SupportCategory,
  Uid,
  Urgency3,
} from "../enums";
import type { SupportStatus } from "../status";

/** A referral to an outside service (D83). `partnerId` points at the referral directory when known. */
export interface SupportReferral {
  id: string;
  partnerId: string | null;
  toName: string;
  toType: ReferralType;
  /** The person agreed that their details may be shared with this service. Required to save. */
  consentToShare: boolean;
  outcome: ReferralOutcome;
  outcomeAt: Millis | null;
  note: string | null;
  at: Millis;
  by: Uid;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayPeriod = "morning" | "afternoon" | "evening";

export type SupportClosureReason =
  | "completed"
  | "declined"
  | "no_response"
  | "duplicate"
  | "spam"
  | "withdrawn"
  | "moved_to_safeguarding"
  | "other";

export interface SupportRequest extends CaseDoc<SupportStatus> {
  /** Never `child_protection`: those submissions are written only as concerns (D79). */
  category: SupportCategory;
  /** Derived from the category (SUPPORT_CATEGORY_PROGRAMME). */
  programmeId: ProgrammeId;
  applicant: {
    fullName: string;
    relationship: Relationship;
    relationshipOther: string | null;
    email: string | null;
    emailLower: string | null;
    /** Loose E.164: + and 6–20 digits. */
    phone: string | null;
    country: CountryCode;
    /** "Town or region". Never a street address. */
    locality: string | null;
    preferredContact: ContactMethod;
    /** "Is it safe for us to contact you on these details?" */
    safeToContact: boolean;
    /** "Best time or way to reach you safely". */
    bestTimes: string | null;
  };
  /** No child names, ever. */
  child: { ageBand: AgeBand; numberOfChildren: number | null } | null;
  /** The "brief explanation", ≤ 2000 characters, sealed. */
  explanation: Sealed;
  urgency: Urgency3;
  /** Always false here: true is routed to safeguardingConcerns (D79). */
  immediateDanger: false;
  consentToContact: ConsentStamp;
  privacyAcknowledged: ConsentStamp;
  counselling: {
    forWhom: "child" | "parent_or_caregiver" | "family";
    ageBand: AgeBand;
    /** Free text ≤ 40 ("Wolof", "Hindi", "Arabic"…). */
    language: string;
    format: "video" | "phone" | "either";
    preferredDays: Weekday[];
    preferredPeriods: DayPeriod[];
    preferredTimes: string | null;
    /** The client's IANA timezone when known, for booking in both timezones. */
    timezone: string | null;
  } | null;
  education: {
    level: "pre_school" | "primary" | "secondary" | "vocational" | "other";
    needs: ("fees" | "uniform" | "materials" | "hygiene" | "nutrition" | "bedding" | "devices")[];
    amountNeeded: Money | null;
  } | null;
  medical: { need: "referral" | "treatment_cost" | "supplies" | "information" } | null;
  legal: { matter: "custody_guardianship" | "documentation" | "abuse_proceedings" | "inheritance" | "other" } | null;
  food: { householdSize: number | null; childrenInHousehold: number | null } | null;
  triage: {
    eligibility: "eligible" | "ineligible" | "unclear" | null;
    /** §6 "checked and verified": required before `approved`. */
    verification: { status: "not_started" | "in_progress" | "verified" | "failed"; method: string | null; by: Uid | null; at: Millis | null };
  };
  /** Auto-closes at dueAt + 16 days (30 days in total). */
  moreInfo: { requestedAt: Millis; dueAt: Millis; channel: ContactMethod } | null;
  referrals: SupportReferral[];
  decision: { kind: "approved" | "declined"; reasonCode: string | null; note: string | null; by: Uid; at: Millis } | null;
  /** Required to complete; ≤ 500 characters, non-identifying. */
  outcome: { summary: string; at: Millis; by: Uid } | null;
  closureReason: SupportClosureReason | null;
  /** Shown as "Moved to safeguarding" to non-safeguarding roles; the value only to SO/SA. */
  linkedConcernRef: string | null;
  attachmentCount: number;
}
