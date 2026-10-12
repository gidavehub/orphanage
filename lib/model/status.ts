// Workflow statuses (client-safe). data-model owns case statuses (§4, §5); posts use
// content-model §7.1's five states (D42); story submissions per D58; sponsor profiles per D55.
// Edges live in lib/model/flows.ts, labels in lib/model/labels.ts, tones in lib/model/status-meta.ts.

export const SUPPORT_STATUSES = [
  "new",
  "under_review",
  "more_info_required",
  "assigned",
  "referred",
  "approved",
  "support_in_progress",
  "completed",
  "declined",
  "closed",
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const CONCERN_STATUSES = ["received", "screening", "risk_assessed", "escalated", "referred", "monitoring", "closed"] as const;
export type ConcernStatus = (typeof CONCERN_STATUSES)[number];

/** Risk level of a concern. `null` on the record means "Not yet assessed" (D76). */
export const RISK_LEVELS = ["immediate", "high", "medium", "low", "no_concern"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const APPOINTMENT_STATUSES = ["scheduled", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Cash and in-kind gifts (D72: in-kind uses the same ids with helper labels). */
export const DONATION_STATUSES = ["pledged", "pending", "received", "acknowledged", "allocated", "completed", "cancelled"] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

/** Mirrors Stripe subscription states; manual plans use active/paused/cancelled. */
export const RECURRING_STATUSES = ["incomplete", "active", "past_due", "paused", "cancelled"] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

export const VOLUNTEER_STATUSES = ["submitted", "screening", "interview", "approved", "onboarding", "active", "inactive", "declined"] as const;
export type VolunteerStatus = (typeof VOLUNTEER_STATUSES)[number];

export const PARTNERSHIP_STATUSES = ["new", "under_review", "in_discussion", "agreed", "active", "declined", "closed"] as const;
export type PartnershipStatus = (typeof PARTNERSHIP_STATUSES)[number];

export const CONTACT_STATUSES = ["new", "replied", "closed", "spam"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const REPORT_REQUEST_STATUSES = ["new", "under_review", "approved", "sent", "declined", "closed"] as const;
export type ReportRequestStatus = (typeof REPORT_REQUEST_STATUSES)[number];

export const DATA_REQUEST_STATUSES = ["unverified", "verified", "in_progress", "completed", "rejected"] as const;
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

export const POST_STATUSES = ["draft", "in_review", "scheduled", "published", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const STORY_SUBMISSION_STATUSES = ["new", "reviewing", "published", "declined", "closed"] as const;
export type StorySubmissionStatus = (typeof STORY_SUBMISSION_STATUSES)[number];

export const SPONSOR_PROFILE_STATUSES = ["draft", "published", "fully_funded", "archived"] as const;
export type SponsorProfileStatus = (typeof SPONSOR_PROFILE_STATUSES)[number];

/** Resource (library item) publication state. */
export const RESOURCE_STATUSES = ["draft", "published", "archived"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const WORKFLOWS = [
  "support",
  "concern",
  "appointment",
  "donation",
  "inkind",
  "recurring",
  "volunteer",
  "partnership",
  "contact",
  "reportRequest",
  "dataRequest",
  "post",
  "storySubmission",
] as const;
export type Workflow = (typeof WORKFLOWS)[number];

type StatusMap = {
  support: SupportStatus;
  concern: ConcernStatus;
  appointment: AppointmentStatus;
  donation: DonationStatus;
  inkind: DonationStatus;
  recurring: RecurringStatus;
  volunteer: VolunteerStatus;
  partnership: PartnershipStatus;
  contact: ContactStatus;
  reportRequest: ReportRequestStatus;
  dataRequest: DataRequestStatus;
  post: PostStatus;
  storySubmission: StorySubmissionStatus;
};

export type StatusOf<W extends Workflow> = StatusMap[W];

/** Every status of a workflow, in journey order. */
export const STATUSES: { [W in Workflow]: readonly StatusOf<W>[] } = {
  support: SUPPORT_STATUSES,
  concern: CONCERN_STATUSES,
  appointment: APPOINTMENT_STATUSES,
  donation: DONATION_STATUSES,
  inkind: DONATION_STATUSES,
  recurring: RECURRING_STATUSES,
  volunteer: VOLUNTEER_STATUSES,
  partnership: PARTNERSHIP_STATUSES,
  contact: CONTACT_STATUSES,
  reportRequest: REPORT_REQUEST_STATUSES,
  dataRequest: DATA_REQUEST_STATUSES,
  post: POST_STATUSES,
  storySubmission: STORY_SUBMISSION_STATUSES,
};

/**
 * Statuses that still need work ("open"). Queues, "Needs you", Inbox and the "any open state"
 * edges (Move to safeguarding, Close case, Decline) use these. Everything else is finished.
 */
export const OPEN_STATUSES: { [W in Workflow]: readonly StatusOf<W>[] } = {
  support: ["new", "under_review", "more_info_required", "assigned", "referred", "approved", "support_in_progress"],
  concern: ["received", "screening", "risk_assessed", "escalated", "referred", "monitoring"],
  appointment: ["scheduled"],
  donation: ["pledged", "pending", "received", "acknowledged", "allocated"],
  inkind: ["pledged", "pending", "received", "acknowledged", "allocated"],
  recurring: ["incomplete", "active", "past_due", "paused"],
  volunteer: ["submitted", "screening", "interview", "approved", "onboarding"],
  partnership: ["new", "under_review", "in_discussion", "agreed"],
  contact: ["new", "replied"],
  reportRequest: ["new", "under_review", "approved"],
  dataRequest: ["unverified", "verified", "in_progress"],
  post: ["draft", "in_review", "scheduled"],
  storySubmission: ["new", "reviewing"],
};

export function isStatusOf<W extends Workflow>(w: W, s: unknown): s is StatusOf<W> {
  return typeof s === "string" && (STATUSES[w] as readonly string[]).includes(s);
}

export function isOpenStatus<W extends Workflow>(w: W, s: StatusOf<W>): boolean {
  return (OPEN_STATUSES[w] as readonly string[]).includes(s);
}
