import "server-only";

// Settings (admin-ux §6.16): the email log, "Send me a test email", data retention and privacy
// requests. Super admins see everything (settings.manage, privacy.manage). In practice mode anyone on
// the team can open the email log to read the emails held for THEM (invites, alerts, digests), since
// nothing leaves the computer; the full log stays with super admins.

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { DataRequest, OutboxEmail, OutboxStatus } from "@/lib/model/domain/system";
import { DEFAULT_RETENTION_SETTINGS, RETENTION_LIMITS, type RetentionMode, type RetentionPolicySetting, type RetentionSettings } from "@/lib/model/domain/settings";
import { EMAIL_TEMPLATE_LABEL, RETENTION_POLICY_LABEL } from "@/lib/model/labels";
import { RETENTION_POLICY_IDS, type Millis, type RetentionPolicyId } from "@/lib/model/enums";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, audit, auditTx } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, settingsPath } from "@/lib/server/db/collections";
import type { Filter } from "@/lib/server/db/store";
import { drainAfterResponse, enqueueEmail, outboxPath, renderOutboxEmail } from "@/lib/server/email/outbox";
import { emailMode, maskAddress } from "@/lib/server/email/provider";
import { features } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { transitionResult } from "@/lib/server/workflow/flow";
import { dataRequestMachine, type DataRequestInput } from "@/lib/server/workflow/dataRequest";

/* ── Email log ─────────────────────────────────────────────────────────── */

export type EmailLogRow = {
  id: string;
  template: string;
  what: string;
  subject: string;
  to: string;
  status: OutboxStatus;
  deliveryState: OutboxEmail["deliveryState"] | null;
  createdAt: Millis;
  sentAt: Millis | null;
  scheduledFor: Millis;
  lastError: string | null;
  reference: string | null;
  hasPreview: boolean;
};

export type EmailLogDTO = { rows: EmailLogRow[]; nextCursor: string | null; full: boolean; mode: ReturnType<typeof emailMode>; now: Millis; tz: string };

const STATUSES: readonly OutboxStatus[] = ["queued", "sending", "scheduled", "held", "sent", "failed", "cancelled", "suppressed"];

async function emailLogViewer(): Promise<{ v: Viewer; full: boolean }> {
  const v = await requireStaff();
  const full = has(v, "settings.manage");
  if (!full && !features.practiceMode) {
    // Same as requireStaff's refusal: the page doesn't exist for them.
    await requireStaff("settings.manage");
  }
  return { v, full };
}

function mine(v: Viewer, e: OutboxEmail): boolean {
  return e.toStaffUids.includes(v.uid) || e.to.some((a) => a.toLowerCase() === v.email.toLowerCase());
}

export async function listEmailLog(opts: { status?: string | null; cursor?: string | null }): Promise<EmailLogDTO> {
  const { v, full } = await emailLogViewer();
  const status = STATUSES.find((s) => s === opts.status) ?? null;
  const where: Filter[] = status ? [{ field: "status", op: "==", value: status }] : [];
  const page = await getStore().list<OutboxEmail>(C.emailOutbox, { where, orderBy: { field: "createdAt", dir: "desc" }, limit: full ? 50 : 100, cursor: opts.cursor ?? null });
  const rows = page.items
    .filter((e) => full || mine(v, e))
    .map((e) => ({
      id: e.id,
      template: e.template,
      what: EMAIL_TEMPLATE_LABEL[e.template] ?? e.template,
      subject: e.subject,
      to: e.toStaffUids.length ? (e.toStaffUids.includes(v.uid) && e.toStaffUids.length === 1 ? "You" : `${e.toStaffUids.length} on the team`) : e.to.map(maskAddress).join(", "),
      status: e.status,
      deliveryState: e.deliveryState ?? null,
      createdAt: e.createdAt,
      sentAt: e.sentAt,
      scheduledFor: e.scheduledFor,
      lastError: e.lastError,
      reference: e.related?.reference ?? null,
      hasPreview: Boolean(e.preview) || (e.vars !== null && !e.bodyPurgedAt),
    }));
  return { rows, nextCursor: page.nextCursor, full, mode: emailMode(), now: Date.now(), tz: v.timezone };
}

/** The email as it was (or will be) sent, for a sandboxed preview. Opening one is logged. */
export async function getEmailPreview(id: string): Promise<{ subject: string; html: string; to: string; status: OutboxStatus } | null> {
  const { v, full } = await emailLogViewer();
  if (!/^[A-Za-z0-9_~.-]{1,300}$/.test(id)) return null;
  const e = await getStore().get<OutboxEmail>(outboxPath(id));
  if (!e || (!full && !mine(v, e))) return null;
  let html = e.preview?.html ?? null;
  if (!html && e.vars !== null && !e.bodyPurgedAt) html = (await renderOutboxEmail(id, e).catch(() => null))?.html ?? null;
  if (!html) return null;
  if (full && !mine(v, e)) {
    await audit({ actor: actorOf(v), action: "record.view", area: "settings", summary: `${v.displayName.split(" ")[0]} opened the "${EMAIL_TEMPLATE_LABEL[e.template] ?? e.template}" email in the email log`, sensitive: true, targetPath: outboxPath(id), targetRef: e.related?.reference ?? null });
  }
  return { subject: e.subject, html, to: e.toStaffUids.length ? "The team" : e.to.map(maskAddress).join(", "), status: e.status };
}

/** "Send me a test email" (Settings › Connections): to the viewer's own address. */
export async function sendTestEmail(): Promise<ActionResult<{ id: string; mode: string }>> {
  const v = await requireStaff("settings.manage");
  try {
    const r = await enqueueEmail({ template: "email_test", toStaffUids: [v.uid], dedupeKey: `test~${v.uid}~${Date.now()}` });
    drainAfterResponse();
    return actionOk({ id: r.id, mode: emailMode() });
  } catch (err) {
    log.error("settings.test_email_failed", { err });
    return actionError({ kind: "unavailable", message: "The test email couldn't be queued. Please try again." });
  }
}

/* ── Retention ─────────────────────────────────────────────────────────── */

export type RetentionRow = { id: RetentionPolicyId; label: string; days: number; mode: RetentionMode; minDays: number; maxDays: number; modes: readonly RetentionMode[] };

export async function getRetention(): Promise<{ rows: RetentionRow[]; updatedAt: Millis | null }> {
  await requireStaff("settings.manage");
  const saved = await getStore().get<RetentionSettings>(settingsPath("retention")).catch(() => null);
  const policies = { ...DEFAULT_RETENTION_SETTINGS.policies, ...(saved?.policies ?? {}) };
  return {
    rows: RETENTION_POLICY_IDS.map((id) => ({ id, label: RETENTION_POLICY_LABEL[id], ...policies[id], ...RETENTION_LIMITS[id] })),
    updatedAt: saved?.updatedAt ?? null,
  };
}

export async function saveRetention(changes: Partial<Record<string, RetentionPolicySetting>>, baseUpdatedAt: Millis | null): Promise<ActionResult<{ updatedAt: Millis }>> {
  const v = await requireStaff("settings.manage");
  const fields: Record<string, string> = {};
  const clean: Partial<Record<RetentionPolicyId, RetentionPolicySetting>> = {};
  for (const [id, s] of Object.entries(changes)) {
    const lim = RETENTION_LIMITS[id as RetentionPolicyId];
    if (!lim || !s) continue;
    const days = Math.trunc(Number(s.days));
    if (!Number.isFinite(days) || days < lim.minDays || days > lim.maxDays) fields[id] = `Between ${lim.minDays} and ${lim.maxDays} days.`;
    else if (!lim.modes.includes(s.mode)) fields[id] = "That choice isn't allowed for this kind of record.";
    else clean[id as RetentionPolicyId] = { days, mode: s.mode };
  }
  if (Object.keys(fields).length) return actionError({ kind: "validation", fields });
  const now = Date.now();
  const out = await getStore().runTransaction(async (tx) => {
    const cur = await tx.get<RetentionSettings>(settingsPath("retention"));
    if ((cur?.updatedAt ?? null) !== baseUpdatedAt) return "conflict" as const;
    const policies = { ...DEFAULT_RETENTION_SETTINGS.policies, ...(cur?.policies ?? {}), ...clean };
    tx.set(settingsPath("retention"), { policies, updatedAt: now, updatedBy: v.uid });
    auditTx(tx, { actor: actorOf(v), action: "settings.change", area: "settings", summary: `${v.displayName} changed how long Haven keeps ${Object.keys(clean).length === 1 ? RETENTION_POLICY_LABEL[Object.keys(clean)[0] as RetentionPolicyId].toLowerCase() : "some records"}`, feed: true, sensitive: true, targetPath: settingsPath("retention") });
    return "ok" as const;
  });
  if (out === "conflict") return actionError({ kind: "not_allowed", message: "Someone else changed these settings just now. Reload to see their changes." });
  return actionOk({ updatedAt: now });
}

/* ── Privacy requests ──────────────────────────────────────────────────── */

export type DataRequestRow = {
  ref: string;
  type: DataRequest["type"];
  status: DataRequest["status"];
  name: string;
  email: string;
  details: string;
  knownReferences: string[];
  createdAt: Millis;
  dueAt: Millis;
  verifiedAt: Millis | null;
  rejectionReason: string | null;
  done: string | null;
  version: number;
};

export async function listDataRequests(): Promise<{ open: DataRequestRow[]; closed: DataRequestRow[]; now: Millis; tz: string }> {
  const v = await requireStaff("privacy.manage");
  const page = await getStore().list<DataRequest>(C.dataRequests, { orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
  const rows = page.items.map((r) => ({
    ref: r.reference ?? r.id,
    type: r.type,
    status: r.status,
    name: r.requester.fullName,
    email: r.requester.email,
    details: String(r.details ?? "").slice(0, 2000),
    knownReferences: r.knownReferences ?? [],
    createdAt: r.createdAt,
    dueAt: r.dueAt,
    verifiedAt: r.verifiedAt,
    rejectionReason: r.rejectionReason,
    done: r.findings?.length ? (r.findings[r.findings.length - 1]?.reason ?? null) : null,
    version: r.version ?? 0,
  }));
  if (rows.length) await audit({ actor: actorOf(v), action: "record.view", area: "privacy", summary: `${v.displayName.split(" ")[0]} opened the privacy requests`, sensitive: true, targetPath: C.dataRequests, targetRef: null });
  const closed = new Set(["completed", "rejected"]);
  return { open: rows.filter((r) => !closed.has(r.status)), closed: rows.filter((r) => closed.has(r.status)).slice(0, 20), now: Date.now(), tz: v.timezone };
}

export async function moveDataRequest(ref: string, edgeId: string, expectedVersion: number, input: DataRequestInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("privacy.manage");
  const clean: DataRequestInput = {
    ...(typeof input.note === "string" ? { note: input.note.slice(0, 600) } : {}),
    ...(typeof input.reason === "string" ? { reason: input.reason.slice(0, 500) } : {}),
  };
  const r = await transitionResult(() => dataRequestMachine.transition({ ref, edgeId, actor: v, expectedVersion, input: clean }));
  if (r.ok) drainAfterResponse();
  return r as ActionResult<{ version: number; at: Millis; status: string }>;
}

