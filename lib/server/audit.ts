import "server-only";

// Audit log (data-model §4.7, PLAN D93). One append-only `auditLog` collection for every area,
// content included (`area: 'content'`, data-model action strings such as `content.publish`).
// - `sensitive: true` for record views, field reveals, exports, auth and role changes.
// - Summaries never carry sensitive content; values of sealed and contact fields are redacted.
// - The IP is stored only as a daily-salted hash; the request id ties entries of one request together.
// auditTx() writes inside the caller's transaction (same commit as the change it records);
// audit() writes on its own and never throws to the caller.

import { randomBytes, randomUUID } from "node:crypto";
import type { AuditActor, AuditArea, AuditChange, AuditEntry } from "@/lib/model/domain/system";
import type { SystemActor, Viewer } from "@/lib/model/viewer";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { BackendUnavailableError, type Tx } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";
import { ipHash } from "@/lib/server/security/hmac";

export type { AuditActor, AuditArea, AuditChange, AuditEntry } from "@/lib/model/domain/system";

export type AuditInput = {
  actor: AuditActor;
  /** "record.view", "status.change", "content.publish", "export.run", … */
  action: string;
  area: AuditArea;
  /** "Fatou moved HVN-SR-2026-0001 to Assigned". Never sensitive content. */
  summary: string;
  /** Show in "Recent activity". Default false. */
  feed?: boolean;
  /** Record views, field reveals, exports, auth and role changes. Default false. */
  sensitive?: boolean;
  targetPath?: string | null;
  targetRef?: string | null;
  changes?: AuditChange[] | null;
  /** Coarse device label for auth entries (D92). */
  device?: string | null;
  /** Raw IP: only hashed (daily salt), never stored. */
  ip?: string;
  requestId?: string;
};

/** Where entries go. Selftests pass a scratch root so practice Activity stays clean. */
export type AuditOptions = { root?: string };

const MAX_SUMMARY = 300;
const MAX_CHANGES = 50;

export function newAuditId(): string {
  return randomBytes(15).toString("base64url");
}

function auditCollection(opts?: AuditOptions): string {
  return opts?.root ? `${opts.root}/${C.auditLog}` : C.auditLog;
}

function hashIp(ip: string | undefined, at: number): string | null {
  if (!ip || ip === "local") return null;
  try {
    return ipHash(ip, at);
  } catch {
    return null;
  }
}

function toEntry(e: AuditInput, at: number): AuditEntry {
  return {
    at,
    actor: e.actor,
    action: e.action,
    area: e.area,
    feed: e.feed ?? false,
    sensitive: e.sensitive ?? false,
    targetPath: e.targetPath ?? null,
    targetRef: e.targetRef ?? null,
    summary: e.summary.length > MAX_SUMMARY ? `${e.summary.slice(0, MAX_SUMMARY - 1)}…` : e.summary,
    changes: e.changes ? e.changes.slice(0, MAX_CHANGES) : null,
    ipHash: hashIp(e.ip, at),
    device: e.device ?? null,
    requestId: e.requestId ?? randomUUID(),
  };
}

/** Writes the entry inside an existing transaction (same commit as the change it records). Returns its id. */
export function auditTx(tx: Tx, e: AuditInput, opts?: AuditOptions): string {
  const id = newAuditId();
  tx.create(`${auditCollection(opts)}/${id}`, toEntry(e, Date.now()));
  return id;
}

/** Writes the entry on its own (views, reveals, exports, sign-ins). Never throws to the caller. */
export async function audit(e: AuditInput, opts?: AuditOptions): Promise<void> {
  try {
    await getStore().create(`${auditCollection(opts)}/${newAuditId()}`, toEntry(e, Date.now()));
  } catch (err) {
    if (err instanceof BackendUnavailableError) log.warn("audit.unavailable", { action: e.action, area: e.area, targetRef: e.targetRef ?? null });
    else log.error("audit.write_failed", { action: e.action, area: e.area, targetRef: e.targetRef ?? null, err });
  }
}

/** The audit actor for a staff member or a system job. */
export function actorOf(v: Viewer | SystemActor): AuditActor {
  if ("kind" in v && v.kind === "system") return { kind: "system", job: v.job };
  const viewer = v as Viewer;
  return { kind: "staff", uid: viewer.uid, name: viewer.displayName, roles: [...viewer.roles] };
}

/**
 * Replaces the values of sensitive fields with `{ redacted: true }`. A field matches when it equals a
 * listed field or sits under it ("applicant" covers "applicant.email").
 */
export function redactChanges(changes: AuditChange[], sensitiveFields: string[]): AuditChange[] {
  return changes.map((c) => {
    const hit = sensitiveFields.some((f) => c.field === f || c.field.startsWith(`${f}.`));
    return hit ? { field: c.field, redacted: true as const } : c;
  });
}

/** Field-level changes between two flat value maps (only scalar values are recorded). */
export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  sensitiveFields: string[] = [],
): AuditChange[] {
  const scalar = (v: unknown): string | number | boolean | null =>
    v === null || v === undefined ? null : typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : JSON.stringify(v).slice(0, 120);
  const out: AuditChange[] = [];
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const from = scalar(before[field]);
    const to = scalar(after[field]);
    if (from !== to) out.push({ field, from, to });
  }
  return redactChanges(out, sensitiveFields);
}
