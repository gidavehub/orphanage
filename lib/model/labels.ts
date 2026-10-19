// Plain-English labels for every enum (client-safe). The only place labels are defined (PLAN §7.6).
// Status wording follows admin-ux §7/§12 with D76–D78; public form wording follows public-pages §3.

import type { EmailTemplateId } from "./email";
import type {
  AgeBand,
  ConcernType,
  ConsentState,
  ContactCategory,
  ContactMethod,
  Currency,
  Frequency,
  Handover,
  HeardFrom,
  InKindCategory,
  InKindCondition,
  IntakeSource,
  LocalPaymentMethod,
  PartnerKind,
  PartnershipType,
  PaymentMethod,
  ProgrammeId,
  ReferralOutcome,
  ReferralType,
  Relationship,
  ResourceAccess,
  ResourceCategory,
  RetentionPolicyId,
  StorySubmitterRole,
  SupportCategory,
  SupportFormCategory,
  Urgency3,
  VolunteerDay,
  VolunteerHours,
  VolunteerInterest,
  VolunteerMode,
  YesNoUnsure,
} from "./enums";
import type { Role, ViewerScope } from "./permissions";
import type { DonationStatus, ResourceStatus, RiskLevel, SponsorProfileStatus, StatusOf, Workflow } from "./status";

/* ── Statuses ──────────────────────────────────────────────────────────── */

const DONATION_LABELS: Record<DonationStatus, string> = {
  pledged: "Pledged",
  pending: "Pending",
  received: "Received",
  acknowledged: "Acknowledged",
  allocated: "Allocated",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_LABEL: { [W in Workflow]: Record<StatusOf<W>, string> } = {
  support: {
    new: "New",
    under_review: "Under review",
    more_info_required: "More information required",
    assigned: "Assigned",
    referred: "Referred",
    approved: "Approved",
    support_in_progress: "Support in progress",
    completed: "Completed",
    declined: "Declined",
    closed: "Closed",
  },
  concern: {
    received: "New",
    screening: "Screening",
    risk_assessed: "Reviewed",
    escalated: "Escalated",
    referred: "Services or authorities contacted",
    monitoring: "Following up",
    closed: "Closed",
  },
  appointment: {
    scheduled: "Scheduled",
    completed: "Attended",
    no_show: "Missed",
    cancelled: "Cancelled",
  },
  donation: DONATION_LABELS,
  inkind: DONATION_LABELS,
  recurring: {
    incomplete: "Not started",
    active: "Active",
    past_due: "Payment failed",
    paused: "Paused",
    cancelled: "Stopped",
  },
  volunteer: {
    submitted: "Submitted",
    screening: "Screening",
    interview: "Interview",
    approved: "Approved",
    onboarding: "Onboarding",
    active: "Active",
    inactive: "Inactive",
    declined: "Declined",
  },
  partnership: {
    new: "New",
    under_review: "Under review",
    in_discussion: "Talking",
    agreed: "Agreement",
    active: "Active",
    declined: "Declined",
    closed: "Closed",
  },
  contact: {
    new: "New",
    replied: "Replied",
    closed: "Done",
    spam: "Spam",
  },
  reportRequest: {
    new: "New",
    under_review: "Under review",
    approved: "Approved",
    sent: "Sent",
    declined: "Declined",
    closed: "Closed",
  },
  dataRequest: {
    unverified: "Not verified yet",
    verified: "Verified",
    in_progress: "In progress",
    completed: "Completed",
    rejected: "Rejected",
  },
  post: {
    draft: "Draft",
    in_review: "In review",
    scheduled: "Scheduled",
    published: "Live",
    archived: "Archived",
  },
  storySubmission: {
    new: "New",
    reviewing: "Reviewing",
    published: "Published",
    declined: "Declined",
    closed: "Closed",
  },
};

export function statusLabel<W extends Workflow>(w: W, s: StatusOf<W>): string {
  return (STATUS_LABEL[w] as Record<string, string>)[s] ?? s;
}

/** Helper subtitles for in-kind offers, which share DonationStatus ids (D72, admin-ux §7). */
export const INKIND_STATUS_HELPER: Record<DonationStatus, string> = {
  pledged: "Offered",
  pending: "Arranging pickup or drop-off",
  received: "Items arrived",
  acknowledged: "Thanked",
  allocated: "Given to a programme",
  completed: "Distributed",
  cancelled: "Not going ahead",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  immediate: "Immediate risk",
  high: "High",
  medium: "Medium",
  low: "Low",
  no_concern: "No concern",
};
/** Shown when a concern's `riskLevel` is null (D76). */
export const RISK_UNASSESSED_LABEL = "Not yet assessed";

export const SPONSOR_PROFILE_STATUS_LABEL: Record<SponsorProfileStatus, string> = {
  draft: "Draft",
  published: "Live",
  fully_funded: "Fully sponsored",
  archived: "Archived",
};

export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  draft: "Draft",
  published: "Live",
  archived: "Archived",
};

export const WORKFLOW_LABEL: Record<Workflow, string> = {
  support: "Request",
  concern: "Concern",
  appointment: "Session",
  donation: "Gift",
  inkind: "In-kind offer",
  recurring: "Regular gift",
  volunteer: "Volunteer",
  partnership: "Partner",
  contact: "Message",
  reportRequest: "Report request",
  dataRequest: "Privacy request",
  post: "Post",
  storySubmission: "Story",
};

/* ── Programmes and money ──────────────────────────────────────────────── */

export const PROGRAMME_LABEL: Record<ProgrammeId, string> = {
  protection: "Child Protection",
  education: "Education Assistance",
  medical: "Medical Support",
  psychological: "Psychological Support",
  legal: "Legal Support",
  family: "Family & Community",
};

export const CURRENCY_NAME: Record<Currency, string> = {
  GMD: "Dalasi",
  USD: "US dollars",
  GBP: "Pounds",
  EUR: "Euros",
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  one_time: "One-time",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export const IN_KIND_CATEGORY_LABEL: Record<InKindCategory, string> = {
  school_materials: "School materials",
  clothing: "Clothing",
  bedding: "Bedding",
  food_supplies: "Food supplies",
  medical_supplies: "Medical supplies",
  computers_devices: "Computers or learning devices",
  furniture: "Furniture",
  professional_services: "Professional services",
  other: "Other approved items",
};

export const IN_KIND_CONDITION_LABEL: Record<InKindCondition, string> = {
  new: "New",
  good: "Good used",
  used: "Used",
  mixed: "Mixed",
};

export const HANDOVER_LABEL: Record<Handover, string> = {
  drop_off: "Drop off at an office",
  collection: "Request collection",
  shipping: "Ship to us",
  to_arrange: "To arrange",
};

export const LOCAL_PAYMENT_METHOD_LABEL: Record<LocalPaymentMethod, string> = {
  wave: "Wave",
  afrimoney: "Afrimoney",
  qmoney: "QMoney",
  bank_transfer: "Bank transfer",
  card_link: "Card: email me a secure link",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  stripe: "Card (online)",
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

/* ── People, forms and engagement ──────────────────────────────────────── */

export const ROLE_LABEL: Record<Role, { name: string; oneLine: string }> = {
  super_admin: { name: "Super admin", oneLine: "Can open everything and manages the team." },
  content_manager: { name: "Content manager", oneLine: "Looks after the website, posts and photos." },
  programme_officer: { name: "Programme officer", oneLine: "Handles requests for support, sessions, volunteers and partners." },
  safeguarding_officer: { name: "Safeguarding officer", oneLine: "Handles child-protection concerns and consent records." },
  finance_officer: { name: "Finance officer", oneLine: "Records and thanks gifts, and keeps the giving figures right." },
  counsellor: { name: "Counsellor", oneLine: "Sees their own counselling sessions." },
  report_manager: { name: "Report manager", oneLine: "Looks after reports, resources and report requests." },
  viewer: { name: "Viewer", oneLine: "Can look around the parts they are given, without changing anything." },
};

export const VIEWER_SCOPE_LABEL: Record<ViewerScope, string> = {
  support_summary: "Support requests (summary only)",
  donations_summary: "Giving totals",
  donations_detail: "Gifts (without contact details)",
  engagement: "Volunteers and partners (summary only)",
  content: "Website, posts and resources",
  audit: "Activity log",
};

export const CONTACT_CATEGORY_LABEL: Record<ContactCategory, string> = {
  general: "General enquiry",
  donation: "Donations",
  partnership: "Partnerships",
  volunteering: "Volunteering",
  media: "Media",
  programme_info: "Programme information",
  resource_request: "Resource request",
  technical_support: "Technical support",
};

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  education: "Education",
  medical: "Medical",
  counselling: "Counselling",
  legal: "Legal",
  food_supplies: "Food and supplies",
  family_support: "Family support",
  other: "Something else",
};

/** Request form options, including the form-only child-protection choice (D79). */
export const SUPPORT_FORM_CATEGORY_LABEL: Record<SupportFormCategory, string> = {
  ...SUPPORT_CATEGORY_LABEL,
  child_protection: "Child protection concern",
};

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  "0-4": "Under 5",
  "5-9": "5 to 9",
  "10-14": "10 to 14",
  "15-17": "15 to 17",
  "18+": "18 or over",
  unknown: "Not sure",
};

export const CONTACT_METHOD_LABEL: Record<ContactMethod, string> = {
  email: "Email",
  phone: "Phone call",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  self: "Myself",
  parent: "Parent",
  guardian: "Guardian or caregiver",
  grandparent: "Grandparent",
  relative: "Other relative",
  teacher: "Teacher",
  social_worker: "Social worker",
  professional: "Health worker or other professional",
  community_member: "Neighbour or community member",
  young_person: "I am the young person",
  institution: "I represent an orphanage, children's home or charity",
  other: "Other",
};

export const YES_NO_UNSURE_LABEL: Record<YesNoUnsure, string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

export const URGENCY3_LABEL: Record<Urgency3, string> = {
  low: "Not urgent",
  medium: "Within a few weeks",
  high: "Urgent (within days)",
};

export const CONCERN_TYPE_LABEL: Record<ConcernType, string> = {
  physical: "Physical harm",
  sexual: "Sexual abuse",
  emotional: "Emotional abuse",
  neglect: "Neglect",
  exploitation: "Exploitation",
  child_labour: "Child labour",
  trafficking: "Trafficking",
  harmful_practice: "Harmful practices (such as early or forced marriage, FGM/C)",
  online: "Online abuse",
  bullying: "Bullying",
  other: "Other",
};

export const HEARD_FROM_LABEL: Record<HeardFrom, string> = {
  search_engine: "Search engine",
  social_media: "Social media",
  friend_or_colleague: "A friend or colleague",
  event: "An event",
  news_or_media: "News or media",
  partner_organisation: "A partner organisation",
  haven_staff: "Someone from Haven",
  other: "Other",
};

export const VOLUNTEER_INTEREST_LABEL: Record<VolunteerInterest, string> = {
  community_outreach: "Community outreach",
  education_support: "Education support",
  counselling_psychosocial: "Counselling or psychosocial services",
  medical_assistance: "Medical assistance",
  legal_assistance: "Legal assistance",
  fundraising: "Fundraising",
  communications: "Communications",
  research: "Research",
  administration: "Administration",
  technology_support: "Technology support",
};

export const VOLUNTEER_DAY_LABEL: Record<VolunteerDay, string> = {
  weekdays: "Weekdays",
  weekends: "Weekends",
  evenings: "Evenings",
};

export const VOLUNTEER_HOURS_LABEL: Record<VolunteerHours, string> = {
  "1-3": "1 to 3 hours a week",
  "4-8": "4 to 8 hours a week",
  "9-16": "9 to 16 hours a week",
  "17+": "17 hours or more a week",
};

export const VOLUNTEER_MODE_LABEL: Record<VolunteerMode, string> = {
  in_person: "In person (The Gambia)",
  remote: "Remote",
  either: "Either",
};

export const PARTNERSHIP_TYPE_LABEL: Record<PartnershipType, string> = {
  programme: "Programme partnership",
  corporate_sponsorship: "Corporate sponsorship",
  technical_assistance: "Technical assistance",
  institutional_referral: "Institutional referral",
  research_collaboration: "Research collaboration",
  donation_partnership: "Donation partnership",
  awareness_campaign: "Awareness campaign",
  other: "Other",
};

export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = {
  ngo: "NGO or charity",
  orphanage_childrens_home: "Orphanage or children's home",
  company: "Company",
  school: "School",
  university: "University",
  faith_org: "Faith-based organisation",
  health_provider: "Healthcare provider",
  legal_practice: "Legal practice",
  government: "Government",
  other: "Other",
};

export const STORY_SUBMITTER_ROLE_LABEL: Record<StorySubmitterRole, string> = {
  beneficiary: "Beneficiary or family member",
  donor: "Donor",
  volunteer: "Volunteer",
  partner: "Partner",
  professional: "Professional",
};

export const REFERRAL_TYPE_LABEL: Record<ReferralType, string> = {
  health: "Health",
  legal: "Legal",
  education: "Education",
  protection: "Child protection",
  psychosocial: "Counselling and psychosocial",
  community: "Community",
  government: "Government service",
  other: "Other",
};

export const REFERRAL_OUTCOME_LABEL: Record<ReferralOutcome, string> = {
  waiting: "Waiting",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
};

/** Settings › Data retention rows (data-model §11.4). */
export const RETENTION_POLICY_LABEL: Record<RetentionPolicyId, string> = {
  "support.unsupported": "Support requests that were not supported",
  "support.supported": "Support requests that were supported",
  appointment: "Counselling sessions",
  concern: "Safeguarding concerns",
  "donation.financial": "Gifts and receipts",
  "donation.unfulfilled": "Cancelled pledges",
  "donor.profile": "Donor profiles",
  "volunteer.declined": "Declined volunteer applications",
  "volunteer.former": "Former volunteers",
  partnership: "Partnership enquiries",
  contact: "Contact messages",
  report_request: "Report requests",
  "newsletter.unconfirmed": "Unconfirmed newsletter sign-ups",
  "newsletter.unsubscribed": "Unsubscribed newsletter readers",
  data_request: "Privacy requests",
  story_submission: "Shared stories",
  audit: "Activity log",
  outbox: "Email log",
  ephemeral: "Short-lived system records",
  "media.consent": "Photo consent records",
};

export const INTAKE_SOURCE_LABEL: Record<IntakeSource, string> = {
  web_form: "Website form",
  staff_entry: "Entered by staff",
  moved_from_support: "Moved from a support request",
  moved_from_contact: "Moved from a message",
  stripe: "Online payment",
  import: "Imported",
};

/* ── Resources and media ───────────────────────────────────────────────── */

export const RESOURCE_CATEGORY_LABEL: Record<ResourceCategory, string> = {
  child_safeguarding: "Child safeguarding",
  child_rights: "Child rights and human rights",
  parenting: "Parenting and caregiving",
  mental_health: "Mental health and wellbeing",
  education: "Education",
  medical_information: "Medical information",
  legal_information: "Legal information",
  organisational_policies: "Organisational policies",
  annual_reports: "Annual and programme reports",
  research: "Research and publications",
};

export const RESOURCE_ACCESS_LABEL: Record<ResourceAccess, string> = {
  public: "Free download",
  controlled: "On request",
};

export const CONSENT_STATE_LABEL: Record<ConsentState, string> = {
  not_required: "Not needed",
  valid: "Consent recorded",
  missing: "Consent needed",
  expired: "Consent expired",
  withdrawn: "Consent withdrawn",
};

/* ── Emails ────────────────────────────────────────────────────────────── */

/** Plain-English names for Settings › Emails and the email log. */
export const EMAIL_TEMPLATE_LABEL: Record<EmailTemplateId, string> = {
  support_confirmation: "Request received",
  support_more_info: "We need more information",
  support_declined: "Request update (declined)",
  concern_alert: "Safeguarding alert to staff",
  concern_reporter_confirmation: "Concern received (to the reporter)",
  donation_acknowledgement: "Thank you and receipt",
  recurring_receipt: "Regular gift receipt",
  recurring_failed: "Regular gift payment failed",
  recurring_cancelled: "Regular gift stopped",
  refund_notice: "Gift refunded",
  pledge_instructions: "How to complete a pledge",
  pledge_reminder: "Pledge reminder",
  card_payment_link: "Card payment link",
  donor_manage_link: "Manage your gift link",
  inkind_follow_up: "Thank you for offering items",
  counselling_confirmation: "Session confirmed",
  zoom_reminder_24h: "Session reminder (a day before)",
  zoom_reminder_1h: "Session reminder (an hour before)",
  counselling_cancelled: "Session cancelled",
  report_request_confirmation: "Report request received",
  report_delivery: "Your requested report",
  report_declined: "Report request update",
  volunteer_acknowledgement: "Volunteer application received",
  partnership_acknowledgement: "Partnership enquiry received",
  contact_confirmation: "Message received",
  contact_reply: "Reply to a message",
  story_acknowledgement: "Story received",
  newsletter_confirm: "Confirm newsletter sign-up",
  supporter_update: "Update to supporters",
  data_request_verify: "Confirm a privacy request",
  data_request_done: "Privacy request complete",
  staff_invite: "Team invitation",
  staff_password_reset: "Password reset",
  staff_sign_in_code: "Sign-in code",
  staff_access_changed: "Access changed",
  staff_alert: "Something new for you",
  staff_alert_digest: "Morning summary",
  post_review_ready: "Draft ready for review",
  email_test: "Test email",
};
