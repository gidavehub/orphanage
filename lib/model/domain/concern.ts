// Child-protection concerns: restricted (data-model §4.2.2 with D76, D79, D83, D108). Types only.
// Only safeguarding officers and super admins may read these. Narratives and identities are sealed.

import type { AgeBand, CaseDoc, ConcernType, ConsentStamp, CountryCode, Millis, Relationship, Sealed, Uid, YesNoUnsure } from "../enums";
import type { ConcernStatus, RiskLevel } from "../status";

export type ConcernClosureReason = "resolved" | "referred_out" | "no_concern" | "duplicate" | "spam" | "other";

export type EscalationTarget = "police" | "social_welfare" | "health" | "child_protection_authority" | "other";

export interface SafeguardingConcern extends CaseDoc<ConcernStatus> {
  // reference = doc id = "HVN-XXXX-XXXX" (random)
  reporter: {
    anonymous: boolean;
    /** { name, email, phone } JSON, sealed. Null when anonymous. */
    identity: Sealed | null;
    /** HMAC(emailLower) for privacy-request search; sealed fields aren't searchable. */
    lookupHash: string | null;
    relationship: Relationship;
    /** { method, times, notes }: "safe method and time for follow-up", sealed. */
    safeFollowUp: Sealed | null;
    /** Default false. The reporter email is sent only when the method is email and this is ticked (D108). */
    emailConfirmationAllowed: boolean;
  };
  child: {
    ageBand: AgeBand;
    /** Plaintext for safeguarding statistics. */
    country: CountryCode;
    /** { area, details }: free-text location, sealed. */
    location: Sealed;
  };
  concernTypes: ConcernType[];
  /** "Nature of the concern", ≤ 5000 characters, sealed. */
  narrative: Sealed;
  inDangerNow: YesNoUnsure;
  authoritiesContacted: YesNoUnsure;
  authorityDetails: Sealed | null;
  consent: ConsentStamp;
  /** Null = "Not yet assessed" (D76). */
  riskLevel: RiskLevel | null;
  risk: { assessedBy: Uid; assessedAt: Millis; rationale: Sealed } | null;
  escalation: { at: Millis; by: Uid; to: EscalationTarget; externalRef: Sealed | null } | null;
  /** First time a safeguarding officer opened it (stops re-alerts). */
  acknowledgedAt: Millis | null;
  realertCount: number;
  /** Honeypot or time-trap hits are kept and flagged, never discarded (D94). */
  suspectedSpam: boolean;
  closureReason: ConcernClosureReason | null;
  /**
   * Closing detail. High or immediate risk needs a second safeguarding officer's sign-off while
   * settings/org.concernTwoPersonClose is true (D83).
   */
  closure: {
    by: Uid;
    at: Millis;
    reason: ConcernClosureReason;
    secondSignOffBy: Uid | null;
    secondSignOffAt: Millis | null;
  } | null;
  /** A support request the safeguarding officer created from this concern (D79). */
  linkedSupportRef: string | null;
}
