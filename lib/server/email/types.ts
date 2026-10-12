import "server-only";

// Email contracts (integrations §4.4–4.5, PLAN D107, D118). Templates are plain typed blocks
// rendered by lib/server/email/render.ts into one-column brand HTML plus a text part.

import type { EmailTemplateId } from "@/lib/model/email";

export type { EmailTemplateId } from "@/lib/model/email";
export { EMAIL_TEMPLATE_IDS, SENSITIVE_EMAIL_TEMPLATES, isEmailTemplateId } from "@/lib/model/email";

export type EmailBlock =
  /** Escaped; **bold** only. */
  | { type: "p"; text: string }
  /** href must start with baseUrl() or https://zoom.us | checkout.stripe.com | billing.stripe.com. */
  | { type: "button"; label: string; href: string }
  | { type: "details"; rows: Array<[label: string, value: string]> }
  | { type: "notice"; tone: "emergency" | "info" | "test"; text: string }
  | { type: "list"; items: string[] }
  | { type: "divider" };

export interface EmailDoc {
  preheader: string;
  heading: string;
  greeting?: string;
  blocks: EmailBlock[];
  signOff?: string;
  /** "updates" adds the unsubscribe link and List-Unsubscribe headers. */
  footer: "transactional" | "staff" | "updates";
}

/** Template variables. Sensitive templates may carry only first name, reference, dates and links. */
export type EmailVars = Record<string, string | number> & { firstName?: string; reference?: string };

/** Staff-editable wording (settings/emailCopy). Only {firstName} and {ref} placeholders are allowed. */
export type EditableCopy = { greeting?: string; main?: string; signOff?: string };

export interface TemplateDef<V extends EmailVars = EmailVars> {
  id: EmailTemplateId;
  audience: "public" | "staff";
  /** Body names no category of need, no child detail and no narrative; subject locked in the editor. */
  sensitive: boolean;
  /** Fixed text plus, at most, the reference in parentheses. */
  subject: (v: V) => string;
  /** The exact shape this template's subject must match; the outbox refuses anything else. */
  subjectPattern: RegExp;
  build: (v: V, copy: EditableCopy) => EmailDoc;
  attachments?: (v: V) => Promise<Array<{ filename: string; content: Buffer; contentType: string }>>;
  replyTo: "donations" | "support" | "safeguarding" | "privacy" | "default" | "none";
  /** "updates" emails carry the unsubscribe link and honour unsubscribe suppressions. */
  updates: boolean;
}

/** Every subject: fixed words plus at most "(HVN-…)" (integrations §4.4). */
export const SUBJECT_RE = /^[A-Za-z0-9' :,!.?-]+( \((HVN-[A-Z0-9-]+)\))?$/;
