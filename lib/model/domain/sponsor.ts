// Anonymous sponsorship profiles (data-model §4.6 with PLAN D55, D82). Types only.
// Public profiles show only the code, a broad age band and category, the need and programme-level
// updates: never names, precise places or medical history.

import type { AgeBand, BaseDoc, CountryCode, Millis, Money, ProgrammeId, SupportCategory, Uid } from "../enums";
import type { SponsorProfileStatus } from "../status";

export interface SponsorProfile extends BaseDoc {
  /** "HVN-SP-0012" (also the doc id). */
  code: string;
  status: SponsorProfileStatus;
  ageBand: AgeBand;
  supportCategory: SupportCategory;
  programmeId: ProgrammeId;
  /** Broad country only, or null. */
  country: CountryCode | null;
  /** description ≤ 300. */
  need: { amount: Money; period: "one_off" | "per_term" | "per_month" | "per_year"; description: string };
  funded: Money;
  sponsorsNeeded: number;
  sponsorsCurrent: number;
  /** Programme officers and super admins only; NEVER in the public DTO. */
  linkedSupportRef: string | null;
  /** The publish lint passed and the reviewer ticked "No names, precise locations or medical history". */
  review: { by: Uid; at: Millis } | null;
  publishedAt: Millis | null;
  publishedBy: Uid | null;
}

/** sponsorProfiles/{code}/updates/{id}: programme-level updates only. */
export interface SponsorUpdate {
  at: Millis;
  /** ≤ 500. */
  text: string;
  by: Uid;
  published: boolean;
}
