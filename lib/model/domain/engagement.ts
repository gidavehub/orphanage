// Volunteers, partners, messages, newsletter, story submissions and the referral directory
// (data-model §4.4 with PLAN D58, D78, D81, D83, D103). Types only.

import type {
  BaseDoc,
  CaseDoc,
  ConsentStamp,
  ContactCategory,
  CountryCode,
  HeardFrom,
  Millis,
  PartnerKind,
  PartnershipType,
  ProgrammeId,
  ReferralType,
  RetentionInfo,
  Sealed,
  StorySubmitterRole,
  Uid,
  VolunteerDay,
  VolunteerHours,
  VolunteerInterest,
  VolunteerMode,
} from "../enums";
import type { ContactStatus, PartnershipStatus, StorySubmissionStatus, VolunteerStatus } from "../status";

export interface OnboardingStep {
  id: string;
  label: string;
  doneAt: Millis | null;
  doneBy: Uid | null;
}

export interface VolunteerApplication extends CaseDoc<VolunteerStatus> {
  applicant: {
    fullName: string;
    email: string;
    emailLower: string;
    phone: string | null;
    country: CountryCode;
    locality: string | null;
  };
  /** "I am 18 or older": required (safeguarding). */
  isAdult: true;
  /** At least one. */
  interests: VolunteerInterest[];
  /** Profession or skills, ≤ 1000. */
  skills: string | null;
  /** ≤ 6. */
  languages: string[];
  availability: { hoursPerWeek: VolunteerHours; mode: VolunteerMode; days: VolunteerDay[] };
  /** ≤ 1500. */
  motivation: string | null;
  workedWithChildren: boolean;
  workedWithChildrenNote: string | null;
  /** Consent to a check if the role involves children. */
  backgroundCheckConsent: boolean;
  /** Outcome only; check documents are handled offline, never uploaded. */
  safeguardingCheck: { status: "not_required" | "pending" | "cleared" | "not_cleared"; at: Millis | null; by: Uid | null } | null;
  interview: { at: Millis | null; by: Uid | null; outcomeNote: string | null } | null;
  heardFrom: HeardFrom | null;
  /** Onboarding tasks ticked off by programme officers (D83). */
  onboardingChecklist: OnboardingStep[];
  consentToContact: ConsentStamp;
  privacyAcknowledged: ConsentStamp;
  safeguardingAcknowledged: ConsentStamp;
  declineReasonCode: string | null;
}

export interface PartnershipEnquiry extends CaseDoc<PartnershipStatus> {
  organisation: {
    name: string;
    kind: PartnerKind;
    website: string | null;
    country: CountryCode;
  };
  contact: { fullName: string; role: string | null; email: string; emailLower: string; phone: string | null };
  partnershipType: PartnershipType;
  programmeId: ProgrammeId | null;
  /** Proposal summary, ≤ 3000. */
  message: string;
  heardFrom: HeardFrom | null;
  consentToContact: ConsentStamp;
}

export interface ContactMessage extends CaseDoc<ContactStatus> {
  fullName: string;
  email: string;
  emailLower: string;
  phone: string | null;
  country: CountryCode;
  /** ≤ 150. */
  subject: string;
  category: ContactCategory;
  /** Set when category is programme_info. */
  programmeId: ProgrammeId | null;
  /** ≤ 3000. */
  message: string;
  consent: ConsentStamp;
  /** Reply text lives in the outbox (purged after 90 days). */
  replies: Array<{ at: Millis; by: Uid; byName: string; outboxId: string }>;
  linkedConcernRef: string | null;
}

/** newsletterSubscribers/{emailHash}: double opt-in (D103). */
export interface NewsletterSubscriber extends BaseDoc {
  /** Null after the PII purge of an unsubscribed record. */
  email: string | null;
  emailLower: string | null;
  firstName: string | null;
  status: "pending" | "confirmed" | "unsubscribed";
  source: "footer" | "join_section" | "donation" | "volunteer" | "post" | "admin_import";
  interests: ProgrammeId[];
  consent: ConsentStamp;
  /** sha256 of the emailed token (expires after 7 days). */
  confirmTokenHash: string | null;
  confirmedAt: Millis | null;
  unsubscribedAt: Millis | null;
  retention: RetentionInfo;
}

/**
 * storySubmissions/{HVN-SS-YYYY-NNNN}: stories and testimonials offered through /stories/share (D58).
 * Content managers triage them in the Inbox; "Turn into story / testimonial" creates a draft item
 * with consent `missing`.
 */
export interface StorySubmission extends CaseDoc<StorySubmissionStatus> {
  submitterRole: StorySubmitterRole;
  publishWithoutName: boolean;
  /** The name they are happy to be published under, or null. */
  displayName: string | null;
  country: CountryCode;
  programmeId: ProgrammeId | null;
  /** The story itself, 50–1500 characters. */
  story: string;
  /** { name, email, phone } JSON, sealed: used only to confirm before publishing. */
  contact: Sealed;
  /** HMAC(emailLower) for privacy-request search. */
  contactLookupHash: string | null;
  publishConsent: ConsentStamp;
  privacyAcknowledged: ConsentStamp;
  /** The story is about the submitter's own child and they are the parent or legal guardian. */
  parentOrGuardian: boolean;
  /** Adult-only photo through the quarantine upload. */
  attachmentCount: number;
  /** The draft created from this submission, if any. */
  createdItem: { collection: "stories" | "testimonials"; id: string } | null;
  declineReason: string | null;
}

/** referralPartners/{id}: outside services staff refer people to (admin-ux People › Directory, D83). */
export interface ReferralPartner extends BaseDoc {
  name: string;
  type: ReferralType;
  /** What they offer, ≤ 300. */
  services: string;
  country: CountryCode;
  locality: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  /** Internal notes, ≤ 1000; never personal data about clients. */
  notes: string | null;
  programmeIds: ProgrammeId[];
  active: boolean;
  createdBy: Uid;
  searchTokens: string[];
}
