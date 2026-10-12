// Email template ids (client-safe). integrations §4.4 plus `story_acknowledgement` and
// `supporter_update` (PLAN D107). Subjects, bodies and transport live in lib/server/email/**;
// plain-English names for the admin live in lib/model/labels.ts (EMAIL_TEMPLATE_LABEL).

export const EMAIL_TEMPLATE_IDS = [
  // support and safeguarding
  "support_confirmation",
  "support_more_info",
  "support_declined",
  "concern_alert",
  "concern_reporter_confirmation",
  // giving
  "donation_acknowledgement",
  "recurring_receipt",
  "recurring_failed",
  "recurring_cancelled",
  "refund_notice",
  "pledge_instructions",
  "pledge_reminder",
  "card_payment_link",
  "donor_manage_link",
  "inkind_follow_up",
  // counselling
  "counselling_confirmation",
  "zoom_reminder_24h",
  "zoom_reminder_1h",
  "counselling_cancelled",
  // resources
  "report_request_confirmation",
  "report_delivery",
  "report_declined",
  // engagement
  "volunteer_acknowledgement",
  "partnership_acknowledgement",
  "contact_confirmation",
  "contact_reply",
  "story_acknowledgement",
  "newsletter_confirm",
  "supporter_update",
  // privacy
  "data_request_verify",
  "data_request_done",
  // staff
  "staff_invite",
  "staff_password_reset",
  "staff_access_changed",
  "staff_alert",
  "staff_alert_digest",
  "post_review_ready",
  "email_test",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export function isEmailTemplateId(v: unknown): v is EmailTemplateId {
  return typeof v === "string" && (EMAIL_TEMPLATE_IDS as readonly string[]).includes(v);
}

/**
 * Templates whose bodies name no category of need, no child detail and no narrative: first name,
 * reference, dates and links only (integrations §4.4). Their subjects are locked in the editor.
 */
export const SENSITIVE_EMAIL_TEMPLATES: readonly EmailTemplateId[] = [
  "support_confirmation",
  "support_more_info",
  "support_declined",
  "concern_alert",
  "concern_reporter_confirmation",
  "counselling_confirmation",
  "zoom_reminder_24h",
  "zoom_reminder_1h",
  "counselling_cancelled",
  "data_request_verify",
  "data_request_done",
  "staff_alert",
  "staff_alert_digest",
];
