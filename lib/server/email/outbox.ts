import "server-only";

// Transactional email outbox (data-model §4.7, integrations §4.3, PLAN D106–D108).
// - enqueueEmailTx(): writes emailOutbox/{template~key} in the SAME transaction as the record change.
//   The id is the dedupe key, so a retried request or drain can never double-send. The subject is
//   rendered from the template's fixed text plus, at most, the reference, and is refused unless it
//   matches the template's pattern (no names, no categories). Vars beyond the reference, first name
//   and links are sealed (AAD = outbox path + "vars").
// - drainOutbox(): called from after() and the cron tick. Claims due records with a lease in a
//   transaction, resolves recipients (staff uids at send time; suppressions skipped for staff alerts),
//   renders, and hands each to the transport for the current mode (mailbox: held + preview).
//   Backoff 1, 5, 30, 120, 720 minutes, then failed (super admins are told in-app).
// - cancelEmail(): queued/held → cancelled; scheduled → provider cancel → cancelled (or sent).

import { after } from "next/server";
import { getContact } from "@/lib/content/read";
import type { EmailSuppression, OutboxEmail, OutboxStatus } from "@/lib/model/domain/system";
import type { EmailCopySettings } from "@/lib/model/domain/settings";
import type { StaffProfile } from "@/lib/model/domain/staff";
import { DOCUMENT_ID_RE, type Millis, type Uid } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { C, docPath, settingsPath } from "@/lib/server/db/collections";
import { BackendUnavailableError, type Tx, type WithId } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";
import { notify, superAdminUids } from "@/lib/server/notify";
import { emailHash } from "@/lib/server/security/hmac";
import { isSealed, openField, sealField } from "@/lib/server/security/seal";
import { baseUrl } from "@/lib/server/url";
import { emailFrom, emailMode, maskAddress, replyToFor, type OutgoingEmail, type TransportResult } from "./provider";
import { renderEmail } from "./render";
import { getTemplate, subjectNeedsRef, subjectRefKey } from "./templates";
import { deliverToMailbox } from "./transports/mailbox";
import { cancelViaResend, sendViaResend } from "./transports/resend";
import { SUBJECT_RE, type EmailTemplateId, type EmailVars } from "./types";

/** The subject does not match the template's fixed pattern (a name or category would leak). */
export class EmailSubjectError extends Error {
  constructor(message = "This email's subject is not allowed: subjects may only carry the reference.") {
    super(message);
    this.name = "EmailSubjectError";
  }
}

export type EnqueueInput = {
  template: EmailTemplateId;
  /** Public recipients (email addresses). */
  to?: string[];
  /** Staff recipients, resolved to their current address at send time. */
  toStaffUids?: Uid[];
  vars?: EmailVars;
  /** Defaults to vars.reference (one email per template per record). Required without a reference. */
  dedupeKey?: string;
  /** Now, or later (Zoom reminders, concern re-alerts). */
  scheduledFor?: Millis;
  related?: { path: string; reference: string } | null;
  /** Selftests only: a scratch root prefixed to the outbox path (never drained). */
  root?: string;
};

const BACKOFF_MIN = [1, 5, 30, 120, 720];
const MAX_ATTEMPTS = BACKOFF_MIN.length;
const LEASE_MS = 2 * 60_000;
const YEAR_MS = 365 * 24 * 60 * 60_000;
const MAX_RECIPIENTS = 50;
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;

/** Var keys that may stay in plain text; everything else is sealed. */
const PLAIN_KEYS = new Set(["reference", "receiptNumber", "firstName", "realert"]);
function isLinkKey(key: string): boolean {
  return key === "link" || key === "url" || /(Url|Href|Link)$/.test(key);
}

/** "support_confirmation~HVN-SR-2026-0001". */
export function outboxId(template: EmailTemplateId, key: string): string {
  const id = `${template}~${key}`;
  if (!DOCUMENT_ID_RE.test(id)) throw new Error("Invalid outbox key: use the reference and simple suffixes (~1, ~<startsAt>).");
  return id;
}

export function outboxPath(id: string): string {
  return docPath("emailOutbox", id);
}

function cleanRecipients(list: string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of list ?? []) {
    const e = String(raw ?? "").trim().toLowerCase();
    if (e && EMAIL_RE.test(e) && e.length <= 254 && !out.includes(e)) out.push(e);
  }
  return out.slice(0, MAX_RECIPIENTS);
}

/** Builds the outbox record (validates recipients and the subject, seals vars when needed). */
function prepare(input: EnqueueInput, now: Millis): { id: string; doc: OutboxEmail } {
  const def = getTemplate(input.template);
  const vars: EmailVars = { ...(input.vars ?? {}) };
  const subject = def.subject(vars);
  if (!SUBJECT_RE.test(subject) || !def.subjectPattern.test(subject)) throw new EmailSubjectError();
  if (subjectNeedsRef(input.template) && typeof vars[subjectRefKey(input.template)] !== "string") throw new EmailSubjectError();

  const key = input.dedupeKey ?? (typeof vars.reference === "string" ? vars.reference : null);
  if (!key) throw new Error(`An email without a reference needs a dedupeKey (${input.template}).`);
  const id = outboxId(input.template, key);

  const to = cleanRecipients(input.to);
  const toStaffUids = [...new Set((input.toStaffUids ?? []).filter((u) => typeof u === "string" && u))].slice(0, MAX_RECIPIENTS);
  if (to.length === 0 && toStaffUids.length === 0) throw new Error(`An email needs at least one recipient (${input.template}).`);

  const needsSeal = Object.keys(vars).some((k) => !PLAIN_KEYS.has(k) && !isLinkKey(k));
  const storedVars = needsSeal ? sealField(outboxPath(id), "vars", vars) : vars;

  const doc: OutboxEmail = {
    template: input.template,
    to,
    toStaffUids,
    subject,
    vars: storedVars,
    status: "queued",
    scheduledFor: input.scheduledFor ?? now,
    attempts: 0,
    nextAttemptAt: now,
    leaseUntil: null,
    lastError: null,
    provider: null,
    providerMessageId: null,
    related: input.related ?? null,
    preview: null,
    createdAt: now,
    sentAt: null,
    bodyPurgedAt: null,
    expireAt: now + YEAR_MS,
  };
  return { id, doc };
}

/**
 * Queues an email inside an existing transaction. An existing record with the same id is left alone
 * (`deduped: true`). Throws EmailSubjectError for a subject that breaks the template's pattern.
 */
export async function enqueueEmailTx(tx: Tx, input: EnqueueInput): Promise<{ id: string; deduped: boolean }> {
  const { id, doc } = prepare(input, Date.now());
  const path = input.root ? `${input.root}/${outboxPath(id)}` : outboxPath(id);
  if (await tx.get(path)) return { id, deduped: true };
  tx.create(path, doc);
  return { id, deduped: false };
}

/** Queues an email on its own. */
export async function enqueueEmail(input: EnqueueInput): Promise<{ id: string; deduped: boolean }> {
  return getStore().runTransaction((tx) => enqueueEmailTx(tx, input));
}

/**
 * Drains the outbox after the response is sent (Server Actions and Route Handlers). Outside a request
 * scope it drains in the background instead. Never throws.
 */
export function drainAfterResponse(): void {
  try {
    after(() => drainOutbox().then(() => undefined));
  } catch {
    void drainOutbox().catch(() => undefined);
  }
}

/* ── Delivery ──────────────────────────────────────────────────────────── */

function openVars(id: string, vars: OutboxEmail["vars"]): EmailVars {
  if (!vars) return {};
  if (isSealed(vars)) return openField<EmailVars>(outboxPath(id), "vars", vars);
  return vars as EmailVars;
}

async function staffAddresses(uids: Uid[]): Promise<string[]> {
  if (uids.length === 0) return [];
  const docs = await getStore().getMany<StaffProfile>(uids.map((u) => docPath("staff", u)));
  return docs.filter((d): d is WithId<StaffProfile> => !!d && d.status === "active").map((d) => d.email);
}

/**
 * Drops suppressed addresses. An unsubscribe only stops update emails (newsletter, supporter updates);
 * bounces, complaints and manual blocks stop everything public.
 */
async function dropSuppressed(addresses: string[], updates: boolean): Promise<string[]> {
  if (addresses.length === 0) return [];
  const docs = await getStore().getMany<EmailSuppression>(addresses.map((a) => docPath("emailSuppressions", emailHash(a))));
  return addresses.filter((_, i) => {
    const d = docs[i];
    return !d || (d.reason === "unsubscribe" && !updates);
  });
}

async function editableCopy(template: EmailTemplateId) {
  try {
    const doc = await getStore().get<EmailCopySettings>(settingsPath("emailCopy"));
    return (doc?.[template] as { greeting?: string; main?: string; signOff?: string } | undefined) ?? {};
  } catch {
    return {};
  }
}

/** Renders an outbox record (for previews in Settings › Email log and for sending). */
export async function renderOutboxEmail(
  id: string,
  doc: OutboxEmail,
  opts?: { testNotice?: string | null },
): Promise<{ subject: string; html: string; text: string }> {
  const def = getTemplate(doc.template);
  const vars = openVars(id, doc.vars);
  const copy = await editableCopy(doc.template);
  const rendered = renderEmail(def.build(vars, copy), {
    baseUrl: baseUrl(),
    testNotice: opts?.testNotice ?? null,
    unsubscribeUrl: typeof vars.unsubscribeUrl === "string" ? vars.unsubscribeUrl : null,
  });
  return { subject: doc.subject, ...rendered };
}

/** Claims a queued record with a lease. Returns the claimed record, or null when it isn't ours to send. */
async function claim(id: string, now: Millis): Promise<OutboxEmail | null> {
  return getStore().runTransaction(async (tx) => {
    const cur = await tx.get<OutboxEmail>(outboxPath(id));
    if (!cur || cur.status !== "queued") return null;
    if (cur.leaseUntil && cur.leaseUntil > now) return null;
    tx.update(outboxPath(id), { status: "sending", leaseUntil: now + LEASE_MS, attempts: (cur.attempts ?? 0) + 1 });
    return { ...cur, status: "sending", attempts: (cur.attempts ?? 0) + 1 };
  });
}

async function finish(id: string, patch: Partial<OutboxEmail>): Promise<void> {
  await getStore().update(outboxPath(id), { ...patch, leaseUntil: null });
}

async function onFailed(id: string, doc: OutboxEmail): Promise<void> {
  try {
    const admins = await superAdminUids();
    const urgent = doc.template === "concern_alert";
    await notify({
      recipientUids: admins,
      kind: "system",
      title: urgent ? "An urgent alert email couldn't be sent" : "An email couldn't be sent",
      href: "/admin/settings/email-log",
      priority: urgent ? "urgent" : "normal",
    });
  } catch (err) {
    log.warn("outbox.failure_notice_failed", { id, err });
  }
}

/**
 * Processes one outbox record by id (claim → recipients → render → transport → status). Returns the
 * resulting status, or null when the record is missing. Never throws for delivery problems.
 */
export async function deliverOutboxItem(id: string): Promise<OutboxStatus | null> {
  const now = Date.now();
  const doc = await claim(id, now);
  if (!doc) return (await getStore().get<OutboxEmail>(outboxPath(id)))?.status ?? null;

  try {
    const def = getTemplate(doc.template);
    const staffMail = doc.toStaffUids.length ? await staffAddresses(doc.toStaffUids) : [];
    let recipients = [...new Set([...doc.to, ...staffMail.map((e) => e.toLowerCase())])];
    const bypassSuppression = def.audience === "staff" || doc.template === "concern_alert";
    if (!bypassSuppression) recipients = await dropSuppressed(recipients, def.updates);
    if (recipients.length === 0) {
      await finish(id, { status: "suppressed", lastError: "No one to send to (unsubscribed, bounced or no active recipient)." });
      return "suppressed";
    }

    const mode = emailMode();
    const testNotice = mode === "redirect" ? `Test copy. Originally to: ${recipients.map(maskAddress).join(", ")} (${doc.template})` : null;
    const rendered = await renderOutboxEmail(id, doc, { testNotice });
    const contact = await getContact().catch(() => null);
    const unsubscribe = def.updates ? openVars(id, doc.vars).unsubscribeUrl : null;
    const msg: OutgoingEmail = {
      id,
      template: doc.template,
      from: emailFrom(def.audience),
      to: recipients,
      replyTo: replyToFor(def.replyTo, contact),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      scheduledFor: doc.scheduledFor,
      // One-line unsubscribe for updates (RFC 2369); receipts and case emails never carry it.
      headers: typeof unsubscribe === "string" && unsubscribe ? { "List-Unsubscribe": `<${unsubscribe}>` } : {},
      attachments: def.attachments ? await def.attachments(openVars(id, doc.vars)) : [],
    };

    const result: TransportResult = mode === "mailbox" ? await deliverToMailbox(msg) : await sendViaResend(msg, mode);
    const preview = { html: rendered.html, text: rendered.text };
    switch (result.kind) {
      case "held":
        await finish(id, { status: "held", provider: "mailbox", preview, lastError: result.note ?? null });
        return "held";
      case "sent":
        await finish(id, { status: "sent", provider: result.provider, providerMessageId: result.providerMessageId, sentAt: Date.now(), preview, lastError: null });
        return "sent";
      case "scheduled":
        await finish(id, { status: "scheduled", provider: result.provider, providerMessageId: result.providerMessageId, preview, lastError: null });
        return "scheduled";
      case "deferred":
        await finish(id, { status: "queued", nextAttemptAt: result.until, attempts: Math.max(0, doc.attempts - 1) });
        return "queued";
      case "retry": {
        if (doc.attempts >= MAX_ATTEMPTS) {
          await finish(id, { status: "failed", lastError: result.error.slice(0, 300) });
          await onFailed(id, doc);
          return "failed";
        }
        await finish(id, { status: "queued", nextAttemptAt: Date.now() + BACKOFF_MIN[doc.attempts - 1] * 60_000, lastError: result.error.slice(0, 300) });
        return "queued";
      }
      case "failed":
        await finish(id, { status: "failed", lastError: result.error.slice(0, 300) });
        await onFailed(id, doc);
        return "failed";
    }
  } catch (err) {
    log.error("outbox.deliver_failed", { id, template: doc.template, err });
    const attempts = doc.attempts;
    const message = err instanceof Error ? err.message.slice(0, 300) : "Delivery failed.";
    if (attempts >= MAX_ATTEMPTS) {
      await finish(id, { status: "failed", lastError: message }).catch(() => undefined);
      await onFailed(id, doc);
      return "failed";
    }
    await finish(id, { status: "queued", nextAttemptAt: Date.now() + BACKOFF_MIN[attempts - 1] * 60_000, lastError: message }).catch(() => undefined);
    return "queued";
  }
}

export type DrainReport = { processed: number; held: number; sent: number; scheduled: number; failed: number; suppressed: number; requeued: number };

/** Sends (or holds) every due queued email, up to `limit`. Never throws. */
export async function drainOutbox(limit = 25): Promise<DrainReport> {
  const report: DrainReport = { processed: 0, held: 0, sent: 0, scheduled: 0, failed: 0, suppressed: 0, requeued: 0 };
  try {
    const store = getStore();
    const now = Date.now();

    // Recover leases abandoned by a crashed drain.
    const stuck = await store.list<OutboxEmail>(C.emailOutbox, {
      where: [
        { field: "status", op: "==", value: "sending" },
        { field: "nextAttemptAt", op: "<=", value: now },
      ],
      orderBy: { field: "nextAttemptAt", dir: "asc" },
      limit: 25,
    });
    for (const s of stuck.items) {
      if (s.leaseUntil && s.leaseUntil > now) continue;
      await store.runTransaction(async (tx) => {
        const cur = await tx.get<OutboxEmail>(outboxPath(s.id));
        if (cur && cur.status === "sending" && (!cur.leaseUntil || cur.leaseUntil <= now)) tx.update(outboxPath(s.id), { status: "queued", leaseUntil: null });
      });
      report.requeued++;
    }

    const due = await store.list<OutboxEmail>(C.emailOutbox, {
      where: [
        { field: "status", op: "==", value: "queued" },
        { field: "nextAttemptAt", op: "<=", value: now },
      ],
      orderBy: { field: "nextAttemptAt", dir: "asc" },
      limit: Math.min(100, Math.max(1, limit)),
    });
    for (const item of due.items) {
      const status = await deliverOutboxItem(item.id);
      report.processed++;
      if (status === "held") report.held++;
      else if (status === "sent") report.sent++;
      else if (status === "scheduled") report.scheduled++;
      else if (status === "failed") report.failed++;
      else if (status === "suppressed") report.suppressed++;
    }
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) log.error("outbox.drain_failed", { err });
  }
  return report;
}

/* ── Cancel ────────────────────────────────────────────────────────────── */

export type CancelResult = "cancelled" | "already_sent" | "not_found" | "unchanged";

/** Cancels one email (reschedules are cancel + a new enqueue with a new key). */
export async function cancelEmail(id: string): Promise<CancelResult> {
  const store = getStore();
  const path = outboxPath(id);
  const doc = await store.get<OutboxEmail>(path);
  if (!doc) return "not_found";
  if (doc.status === "sent") return "already_sent";
  if (doc.status === "scheduled" && doc.providerMessageId) {
    const r = await cancelViaResend(doc.providerMessageId);
    if (r === "already_sent") {
      await store.update(path, { status: "sent", sentAt: doc.sentAt ?? Date.now() });
      return "already_sent";
    }
  }
  return store.runTransaction(async (tx) => {
    const cur = await tx.get<OutboxEmail>(path);
    if (!cur) return "not_found" as const;
    if (cur.status === "queued" || cur.status === "held" || cur.status === "scheduled" || cur.status === "sending") {
      tx.update(path, { status: "cancelled", leaseUntil: null });
      return "cancelled" as const;
    }
    return cur.status === "sent" ? ("already_sent" as const) : ("unchanged" as const);
  });
}

/** Cancels several emails (e.g. a concern's queued re-alerts once it is opened). */
export async function cancelEmails(ids: string[]): Promise<Record<string, CancelResult>> {
  const out: Record<string, CancelResult> = {};
  for (const id of ids) out[id] = await cancelEmail(id);
  return out;
}
