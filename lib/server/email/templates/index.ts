import "server-only";

// Every email template (integrations §4.4 with PLAN D107, D108): fixed subjects whose only variable is
// the reference, a subject pattern the outbox enforces, and a generic but complete body (heading,
// greeting, main paragraph, reference, links, and the emergency block on sensitive public mail).
// I3 replaces individual bodies with richer ones in templates/<area>.ts and keeps these ids, subjects
// and patterns. Sensitive templates carry only the first name, the reference, dates and links: no
// category of need, no child detail, no narrative, in the subject or the body.
// Staff-editable copy (settings/emailCopy) may change greeting, main paragraph and sign-off, with
// {firstName} and {ref} as the only placeholders.

import { EMAIL_TEMPLATE_IDS, SENSITIVE_EMAIL_TEMPLATES, type EmailTemplateId } from "@/lib/model/email";
import { buildIcs } from "@/lib/server/calendar/ics";
import type { EditableCopy, EmailBlock, EmailDoc, EmailVars, TemplateDef } from "../types";

type RefPrefix = "SR" | "DN" | "RC" | "RG" | "AP" | "RR" | "VA" | "PE" | "CM" | "SS" | "DR";

type Spec = {
  audience: "public" | "staff";
  replyTo: TemplateDef["replyTo"];
  /** Fixed subject text (without the reference). */
  subject: string;
  /** The reference prefix the subject must carry, or null for a subject without a reference. */
  ref: RefPrefix | null;
  /** The vars key that holds the subject's reference (default "reference"). */
  refKey?: "reference" | "receiptNumber";
  heading: string;
  preheader: string;
  main: string;
  /** Button label when vars.link is present. */
  button?: string;
  footer?: EmailDoc["footer"];
  /** Extra detail rows read from vars (label → key). */
  details?: Array<[label: string, key: string]>;
};

const SPECS: Record<EmailTemplateId, Spec> = {
  support_confirmation: {
    audience: "public",
    replyTo: "support",
    subject: "We've received your request",
    ref: "SR",
    heading: "We've received your request",
    preheader: "Thank you for reaching out. Here is your reference.",
    main: "Thank you for reaching out to Haven. A member of our team will read your request and contact you using the details you gave us. Please keep your reference: it helps us find your request quickly.",
  },
  support_more_info: {
    audience: "public",
    replyTo: "support",
    subject: "We need a little more information",
    ref: "SR",
    heading: "We need a little more information",
    preheader: "A quick next step on your request.",
    main: "Thank you for your patience. To keep going with your request we need a few more details. A member of our team will explain what we need, or you can reply to this email.",
    details: [["Please reply by", "dueDate"]],
  },
  support_declined: {
    audience: "public",
    replyTo: "support",
    subject: "An update on your request",
    ref: "SR",
    heading: "An update on your request",
    preheader: "An update from the Haven team.",
    main: "Thank you for contacting Haven. We have looked carefully at your request and we are not able to help with it this time. We are sorry. If things change, you are welcome to contact us again.",
  },
  concern_alert: {
    audience: "staff",
    replyTo: "none",
    subject: "Haven: a new item needs your attention",
    ref: null,
    heading: "A new item needs your attention",
    preheader: "Please sign in to Haven.",
    main: "Please sign in to Haven to review it.",
    button: "Sign in to Haven",
    footer: "staff",
    details: [["Priority", "priority"]],
  },
  concern_reporter_confirmation: {
    audience: "public",
    replyTo: "safeguarding",
    subject: "Thank you for getting in touch",
    ref: null,
    heading: "Thank you for getting in touch",
    preheader: "We have received your message.",
    main: "We have received what you shared with us. Our team takes every message seriously and will follow up in the way you asked.",
  },
  donation_acknowledgement: {
    audience: "public",
    replyTo: "donations",
    subject: "Thank you for your gift to Haven",
    ref: "RC",
    refKey: "receiptNumber",
    heading: "Thank you for your gift",
    preheader: "Your receipt from Haven.",
    main: "Your generosity helps children and families get the support they need. Your receipt details are below; please keep this email for your records.",
    button: "View your receipt",
    details: [
      ["Receipt number", "receiptNumber"],
      ["Gift reference", "reference"],
      ["Amount", "amount"],
      ["Date", "date"],
    ],
  },
  recurring_receipt: {
    audience: "public",
    replyTo: "donations",
    subject: "Thank you for your regular gift",
    ref: "RC",
    refKey: "receiptNumber",
    heading: "Thank you for your regular gift",
    preheader: "Your receipt from Haven.",
    main: "Thank you for giving to Haven every month, quarter or year. Your receipt details are below.",
    button: "Manage your gift",
    details: [
      ["Receipt number", "receiptNumber"],
      ["Gift reference", "reference"],
      ["Amount", "amount"],
      ["Date", "date"],
    ],
  },
  recurring_failed: {
    audience: "public",
    replyTo: "donations",
    subject: "Please update your payment details",
    ref: "RG",
    heading: "Please update your payment details",
    preheader: "We couldn't collect your latest regular gift.",
    main: "We weren't able to collect your latest regular gift. You can update your card details using the secure link below. Thank you for your support.",
    button: "Manage your gift",
  },
  recurring_cancelled: {
    audience: "public",
    replyTo: "donations",
    subject: "Your regular gift has been stopped",
    ref: "RG",
    heading: "Your regular gift has been stopped",
    preheader: "No further payments will be taken.",
    main: "Your regular gift to Haven has been stopped and no further payments will be taken. Thank you for everything you have given.",
  },
  refund_notice: {
    audience: "public",
    replyTo: "donations",
    subject: "We've refunded your gift",
    ref: "DN",
    heading: "We've refunded your gift",
    preheader: "Your refund is on its way.",
    main: "We have refunded your gift. Depending on your bank, it can take a few days to appear on your statement.",
    details: [["Amount refunded", "amount"]],
  },
  pledge_instructions: {
    audience: "public",
    replyTo: "donations",
    subject: "How to complete your gift to Haven",
    ref: "DN",
    heading: "How to complete your gift",
    preheader: "Payment details and your reference.",
    main: "Thank you for pledging a gift to Haven. Please use the payment details below and quote your reference, so we can match your gift. If no details are shown, our team will email them to you within 2 working days.",
    details: [["Amount", "amount"]],
  },
  pledge_reminder: {
    audience: "public",
    replyTo: "donations",
    subject: "A gentle reminder about your pledge",
    ref: "DN",
    heading: "A gentle reminder about your pledge",
    preheader: "Your reference and how to pay.",
    main: "Thank you again for pledging a gift to Haven. If you have already sent it, thank you, and please ignore this email. If not, you can use the payment details from our earlier email and quote your reference.",
  },
  card_payment_link: {
    audience: "public",
    replyTo: "donations",
    subject: "Card payments are now open: complete your gift",
    ref: "DN",
    heading: "You can now give by card",
    preheader: "Complete your gift securely by card.",
    main: "You asked to pay by card when card payments were not yet available. They are now open, and you can complete your gift securely using the link below.",
    button: "Complete your gift",
  },
  donor_manage_link: {
    audience: "public",
    replyTo: "donations",
    subject: "Your link to manage your gift to Haven",
    ref: null,
    heading: "Manage your gift",
    preheader: "Your secure link (works for 60 minutes).",
    main: "Here is your secure link to change or stop your regular gift. It works for 60 minutes. If you didn't ask for it, you can ignore this email.",
    button: "Manage your gift",
  },
  inkind_follow_up: {
    audience: "public",
    replyTo: "donations",
    subject: "Thank you for offering items to Haven",
    ref: "DN",
    heading: "Thank you for your offer",
    preheader: "We'll be in touch about the next step.",
    main: "Thank you for offering items to Haven. Our team will contact you to arrange how they reach us.",
  },
  counselling_confirmation: {
    audience: "public",
    replyTo: "support",
    subject: "Your Haven appointment is confirmed",
    ref: "AP",
    heading: "Your appointment is confirmed",
    preheader: "The date, time and how to join.",
    main: "Your appointment is booked. The details are below. If you need to change the time, please reply to this email.",
    button: "Join your appointment",
    details: [["Date and time", "when"]],
  },
  zoom_reminder_24h: {
    audience: "public",
    replyTo: "support",
    subject: "Reminder: your Haven appointment",
    ref: "AP",
    heading: "Your appointment is tomorrow",
    preheader: "A reminder of the time and how to join.",
    main: "This is a reminder of your appointment. The details are below.",
    button: "Join your appointment",
    details: [["Date and time", "when"]],
  },
  zoom_reminder_1h: {
    audience: "public",
    replyTo: "support",
    subject: "Starting soon: your Haven appointment",
    ref: "AP",
    heading: "Your appointment starts soon",
    preheader: "It starts in about an hour.",
    main: "Your appointment starts in about an hour. You can join using the link below.",
    button: "Join your appointment",
    details: [["Date and time", "when"]],
  },
  counselling_cancelled: {
    audience: "public",
    replyTo: "support",
    subject: "Your Haven appointment has been cancelled",
    ref: "AP",
    heading: "Your appointment has been cancelled",
    preheader: "An update about your appointment.",
    main: "Your appointment has been cancelled. If you would like a new time, please reply to this email and we will help.",
    details: [["Date and time", "when"]],
  },
  report_request_confirmation: {
    audience: "public",
    replyTo: "default",
    subject: "We've received your report request",
    ref: "RR",
    heading: "We've received your report request",
    preheader: "Here is your reference.",
    main: "Thank you for your interest in Haven's work. Our team will review your request and reply by email.",
  },
  report_delivery: {
    audience: "public",
    replyTo: "default",
    subject: "Your requested report from Haven",
    ref: "RR",
    heading: "Your report is ready",
    preheader: "Your download link (works for 7 days).",
    main: "Thank you for your patience. You can download the report using the link below. The link works for 7 days; please do not share it.",
    button: "Download the report",
  },
  report_declined: {
    audience: "public",
    replyTo: "default",
    subject: "An update on your report request",
    ref: "RR",
    heading: "An update on your report request",
    preheader: "An update from the Haven team.",
    main: "Thank you for your request. We are not able to share this report at the moment. We are sorry, and you are welcome to contact us with any questions.",
  },
  volunteer_acknowledgement: {
    audience: "public",
    replyTo: "default",
    subject: "Thank you for offering to volunteer",
    ref: "VA",
    heading: "Thank you for offering to volunteer",
    preheader: "Here is your reference.",
    main: "Thank you for offering your time to Haven. Our team will read your application and contact you about the next steps.",
  },
  partnership_acknowledgement: {
    audience: "public",
    replyTo: "default",
    subject: "Thank you for your partnership enquiry",
    ref: "PE",
    heading: "Thank you for your enquiry",
    preheader: "Here is your reference.",
    main: "Thank you for wanting to work with Haven. Our team will review your enquiry and reply soon.",
  },
  contact_confirmation: {
    audience: "public",
    replyTo: "default",
    subject: "We've received your message",
    ref: "CM",
    heading: "We've received your message",
    preheader: "Here is your reference.",
    main: "Thank you for getting in touch. A member of our team will reply as soon as they can.",
  },
  contact_reply: {
    audience: "public",
    replyTo: "default",
    subject: "A reply from Haven",
    ref: "CM",
    heading: "A reply from Haven",
    preheader: "A reply to your message.",
    main: "Thank you for your message.",
  },
  story_acknowledgement: {
    audience: "public",
    replyTo: "default",
    subject: "Thank you for sharing your story",
    ref: "SS",
    heading: "Thank you for sharing your story",
    preheader: "Here is your reference.",
    main: "Thank you for sharing your story with Haven. Before anything is published, our team will contact you to check the details and your wishes.",
  },
  newsletter_confirm: {
    audience: "public",
    replyTo: "default",
    subject: "Please confirm your subscription to Haven updates",
    ref: null,
    heading: "Please confirm your subscription",
    preheader: "One click and you're in.",
    main: "We will only start sending updates after you confirm. If you didn't ask for this, you can ignore this email.",
    button: "Confirm my subscription",
  },
  supporter_update: {
    audience: "public",
    replyTo: "default",
    subject: "An update from Haven",
    ref: null,
    heading: "An update from Haven",
    preheader: "News from Haven.",
    main: "Thank you for supporting Haven. Here is our latest update.",
    button: "Read the update",
    footer: "updates",
  },
  data_request_verify: {
    audience: "public",
    replyTo: "privacy",
    subject: "Please confirm your privacy request",
    ref: "DR",
    heading: "Please confirm your privacy request",
    preheader: "Confirm it was you who asked.",
    main: "To protect your information, please confirm that you made this request. If you didn't, you can ignore this email.",
    button: "Confirm my request",
  },
  data_request_done: {
    audience: "public",
    replyTo: "privacy",
    subject: "Your privacy request is complete",
    ref: "DR",
    heading: "Your privacy request is complete",
    preheader: "An update on your request.",
    main: "We have completed your privacy request. If you have any questions, please reply to this email.",
  },
  staff_invite: {
    audience: "staff",
    replyTo: "none",
    subject: "You're invited to join the Haven team",
    ref: null,
    heading: "You're invited to the Haven team",
    preheader: "Set up your account.",
    main: "You have been invited to the Haven team space. Use the link below to choose a password and get started. The invitation works for 72 hours.",
    button: "Accept the invitation",
    footer: "staff",
  },
  staff_password_reset: {
    audience: "staff",
    replyTo: "none",
    subject: "Reset your Haven team password",
    ref: null,
    heading: "Reset your password",
    preheader: "Your reset link (works for 1 hour).",
    main: "Use the link below to choose a new password. It works for 1 hour. If you didn't ask for this, you can ignore this email.",
    button: "Choose a new password",
    footer: "staff",
  },
  staff_access_changed: {
    audience: "staff",
    replyTo: "none",
    subject: "Your Haven team access has changed",
    ref: null,
    heading: "Your access has changed",
    preheader: "An update to your Haven account.",
    main: "A super admin has changed your access to Haven. Sign in to see what you can do now. If this looks wrong, please contact your super admin.",
    button: "Sign in to Haven",
    footer: "staff",
  },
  staff_alert: {
    audience: "staff",
    replyTo: "none",
    subject: "Haven team: something new for you",
    ref: null,
    heading: "Something new for you",
    preheader: "Please sign in to Haven.",
    main: "There is something new for you in Haven.",
    button: "Open Haven",
    footer: "staff",
    details: [["New items", "count"]],
  },
  staff_alert_digest: {
    audience: "staff",
    replyTo: "none",
    subject: "Your Haven team morning summary",
    ref: null,
    heading: "Your morning summary",
    preheader: "What's waiting for you today.",
    main: "Here is what is waiting for you in Haven today.",
    button: "Open Haven",
    footer: "staff",
    details: [["New items", "count"]],
  },
  post_review_ready: {
    audience: "staff",
    replyTo: "none",
    subject: "A story draft is ready for your review",
    ref: null,
    heading: "A draft is ready for your review",
    preheader: "Please review it before it goes live.",
    main: "A new draft is waiting for your review. Nothing is published until a person approves it.",
    button: "Review the draft",
    footer: "staff",
  },
  email_test: {
    audience: "staff",
    replyTo: "none",
    subject: "Haven test email",
    ref: null,
    heading: "Haven test email",
    preheader: "Email sending works.",
    main: "This is a test email from Haven. If you can read it, emails are reaching you.",
    footer: "staff",
  },
};

const REALERT_SUBJECT = "Reminder: an item still needs your attention";
const SENSITIVE = new Set<EmailTemplateId>(SENSITIVE_EMAIL_TEMPLATES);

/** Public sensitive templates carry the emergency block (integrations §4.4). */
const EMERGENCY_TEXT =
  "**If a child is in immediate danger,** contact your local emergency services or the police now. Do not wait for a reply from us.";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function refOf(spec: Spec, v: EmailVars): string | null {
  const key = spec.refKey ?? "reference";
  const value = v[key];
  return typeof value === "string" && value ? value : null;
}

/** Fills {firstName} and {ref} in staff-editable copy; nothing else is substituted. */
export function applyCopy(text: string, v: EmailVars): string {
  return text.replace(/\{firstName\}/g, String(v.firstName ?? "")).replace(/\{ref\}/g, String(v.reference ?? ""));
}

function str(v: EmailVars, key: string): string | null {
  const x = v[key];
  return typeof x === "string" && x.trim() ? x : typeof x === "number" ? String(x) : null;
}

function buildDoc(id: EmailTemplateId, spec: Spec, v: EmailVars, copy: EditableCopy): EmailDoc {
  const blocks: EmailBlock[] = [];
  const firstName = str(v, "firstName");
  const realert = id === "concern_alert" && Number(v.realert ?? 0) > 0;
  const heading = realert ? "An item still needs your attention" : str(v, "title") && id === "supporter_update" ? str(v, "title")! : spec.heading;

  const main = copy.main ? applyCopy(copy.main, v) : spec.main;
  blocks.push({ type: "p", text: main });
  // Free text that a person wrote for this email (a staff reply, an update excerpt, payment details).
  for (const key of ["message", "excerpt", "instructions"]) {
    const extra = str(v, key);
    if (extra) for (const para of extra.split(/\n{2,}/)) if (para.trim()) blocks.push({ type: "p", text: para.trim() });
  }

  const rows: Array<[string, string]> = [];
  const ref = str(v, "reference");
  if (ref && !(spec.details ?? []).some(([, k]) => k === "reference") && id !== "concern_reporter_confirmation") rows.push(["Your reference", ref]);
  for (const [label, key] of spec.details ?? []) {
    const value = str(v, key);
    if (value) rows.push([label, value]);
  }
  if (rows.length) blocks.push({ type: "details", rows });

  const link = str(v, "link") ?? str(v, "joinUrl") ?? str(v, "url");
  if (spec.button && link) blocks.push({ type: "button", label: spec.button, href: link });

  if (spec.audience === "public" && SENSITIVE.has(id)) blocks.push({ type: "notice", tone: "emergency", text: EMERGENCY_TEXT });

  return {
    preheader: spec.preheader,
    heading,
    greeting: copy.greeting ? applyCopy(copy.greeting, v) : firstName ? `Hello ${firstName},` : "Hello,",
    blocks,
    signOff: copy.signOff ? applyCopy(copy.signOff, v) : spec.audience === "staff" ? "The Haven team" : "With warmth, the Haven team",
    footer: spec.footer ?? "transactional",
  };
}

/** Counselling emails carry the session as an .ics file (integrations §6.4): an invite, or its cancellation. */
const ICS: Partial<Record<EmailTemplateId, "REQUEST" | "CANCEL">> = { counselling_confirmation: "REQUEST", counselling_cancelled: "CANCEL" };

async function icsAttachment(v: EmailVars, method: "REQUEST" | "CANCEL") {
  const startsAt = Number(v.startsAt);
  const reference = typeof v.reference === "string" ? v.reference : null;
  if (!reference || !Number.isFinite(startsAt) || startsAt <= 0) return [];
  const ics = buildIcs({
    reference,
    startsAt,
    durationMin: Number(v.durationMin) > 0 ? Number(v.durationMin) : 45,
    sequence: Number(v.sequence) || 0,
    url: typeof v.link === "string" ? v.link : null,
    method,
  });
  return [{ filename: "haven-appointment.ics", content: Buffer.from(ics, "utf8"), contentType: `text/calendar; charset=utf-8; method=${method}` }];
}

function defFor(id: EmailTemplateId): TemplateDef {
  const spec = SPECS[id];
  const refPattern = spec.ref ? ` \\(HVN-${spec.ref}-\\d{4}-\\d{4,}\\)` : "";
  const subjectPattern =
    id === "concern_alert"
      ? new RegExp(`^(?:${escapeRe(spec.subject)}|${escapeRe(REALERT_SUBJECT)})$`)
      : new RegExp(`^${escapeRe(spec.subject)}${refPattern}$`);
  return {
    id,
    audience: spec.audience,
    sensitive: SENSITIVE.has(id),
    subject: (v: EmailVars) => {
      if (id === "concern_alert") return Number(v.realert ?? 0) > 0 ? REALERT_SUBJECT : spec.subject;
      const ref = spec.ref ? refOf(spec, v) : null;
      return ref ? `${spec.subject} (${ref})` : spec.subject;
    },
    subjectPattern,
    build: (v: EmailVars, copy: EditableCopy) => buildDoc(id, spec, v, copy),
    ...(ICS[id] ? { attachments: (v: EmailVars) => icsAttachment(v, ICS[id]!) } : {}),
    replyTo: spec.replyTo,
    updates: spec.footer === "updates",
  };
}

/** Every template definition, keyed by id. */
export const TEMPLATES: Record<EmailTemplateId, TemplateDef> = Object.fromEntries(
  EMAIL_TEMPLATE_IDS.map((id) => [id, defFor(id)]),
) as Record<EmailTemplateId, TemplateDef>;

export function getTemplate(id: EmailTemplateId): TemplateDef {
  const def = TEMPLATES[id];
  if (!def) throw new Error(`Unknown email template: ${id}`);
  return def;
}

/** The vars key that holds a template's subject reference ("reference", or "receiptNumber" for receipts). */
export function subjectRefKey(id: EmailTemplateId): "reference" | "receiptNumber" {
  return SPECS[id].refKey ?? "reference";
}

/** True when the template's subject must carry a reference. */
export function subjectNeedsRef(id: EmailTemplateId): boolean {
  return SPECS[id].ref !== null;
}

/** Sample variables for previews and selftests (fictional, non-identifying). */
export function sampleVars(id: EmailTemplateId): EmailVars {
  const spec = SPECS[id];
  const year = new Date().getUTCFullYear();
  const ref = spec.ref && spec.ref !== "RC" ? `HVN-${spec.ref}-${year}-0001` : spec.refKey === "receiptNumber" ? `HVN-DN-${year}-0001` : undefined;
  return {
    firstName: "Awa",
    ...(ref ? { reference: ref } : {}),
    ...(spec.refKey === "receiptNumber" ? { receiptNumber: `HVN-RC-${year}-0001`, amount: "USD 50.00", date: "10 October" } : {}),
    ...(spec.button ? { link: "/admin" } : {}),
    ...(id === "concern_alert" ? { priority: "Normal" } : {}),
  };
}

/** Haven's standard wording for a template (what the editor shows before anyone changes it). */
export function standardWording(id: EmailTemplateId): { greeting: string; main: string; signOff: string; heading: string; audience: "public" | "staff" } {
  const spec = SPECS[id];
  return {
    greeting: "Hello {firstName},",
    main: spec.main,
    signOff: spec.audience === "staff" ? "The Haven team" : "With warmth, the Haven team",
    heading: spec.heading,
    audience: spec.audience,
  };
}
