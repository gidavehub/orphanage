import "server-only";

// Email modes (integrations §4.2): the safety rail against emailing real people from previews.
//   resend   → real sends (production with RESEND_API_KEY)
//   redirect → non-production with a key and EMAIL_REDIRECT_TO: everything goes to that address,
//              with a sand "Test copy" banner
//   mailbox  → no key (or EMAIL_PROVIDER=mailbox): rendered and HELD in the Outbox (Settings › Email
//              log), never sent; locally also written to .data/mailbox/{id}.html
// Transports share the message and result shapes below.

import type { Millis } from "@/lib/model/enums";
import type { OutboxStatus } from "@/lib/model/domain/system";
import { env } from "@/lib/server/env";
import type { EmailTemplateId, TemplateDef } from "./types";

export type EmailMode = "resend" | "redirect" | "mailbox";

export function emailMode(): EmailMode {
  if (env.email.provider === "mailbox" || !env.email.resendKey) return "mailbox";
  if (env.vercelEnv === "production") return "resend";
  return env.email.redirectTo ? "redirect" : "mailbox";
}

/** The From header. Staff mail uses the same address with the name "Haven team" (D107). */
export function emailFrom(audience: "public" | "staff"): string {
  const from = env.email.from;
  if (audience === "public") return from;
  const m = /<([^>]+)>/.exec(from);
  const address = m ? m[1] : from;
  return `Haven team <${address}>`;
}

/**
 * Reply-To for a template's team: the team mailbox from Settings › Key information
 * (settings.contact.teamEmails), the general contact address for "default", EMAIL_REPLY_TO as the
 * fallback. "none" → no Reply-To.
 */
export function replyToFor(kind: TemplateDef["replyTo"], contact?: { email?: string; teamEmails?: Partial<Record<string, string>> } | null): string | null {
  if (kind === "none") return null;
  const team = kind === "default" ? contact?.email : contact?.teamEmails?.[kind];
  return team || env.email.replyTo;
}

/** "amina@gmail.com" → "a***@gmail.com" (redirect banners, logs). */
export function maskAddress(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** A rendered message handed to a transport. */
export type OutgoingEmail = {
  /** The outbox id (also the provider idempotency key). */
  id: string;
  template: EmailTemplateId;
  from: string;
  to: string[];
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  scheduledFor: Millis;
  headers: Record<string, string>;
  attachments: Array<{ filename: string; content: Buffer; contentType: string }>;
};

/** What a transport did with a message. */
export type TransportResult =
  | { kind: "sent"; provider: "resend" | "redirect"; providerMessageId: string | null }
  | { kind: "scheduled"; provider: "resend" | "redirect"; providerMessageId: string }
  /** Mailbox mode (or a transport that is not built yet): kept in the Outbox, never sent. */
  | { kind: "held"; provider: "mailbox"; note?: string }
  /** Too far in the future for the provider's scheduler: try again later. */
  | { kind: "deferred"; until: Millis }
  /** Temporary failure (429, 5xx, network): back off and retry. */
  | { kind: "retry"; error: string }
  /** Permanent failure (validation, 4xx). */
  | { kind: "failed"; error: string };

export const FINAL_STATUSES: readonly OutboxStatus[] = ["sent", "held", "failed", "cancelled", "suppressed"];
