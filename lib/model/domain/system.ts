// Audit, outbox, counters, privacy requests, retention, cron locks, metrics and AI jobs
// (data-model §4.7, §11 with PLAN D92, D93, D104, D106; integrations §1, §7). Types only.

import type { ActivityArea } from "../dto";
import type { EmailTemplateId } from "../email";
import type { CaseDoc, Millis, RetentionPolicyId, Sealed, Uid } from "../enums";
import type { Role } from "../permissions";
import type { DataRequestStatus } from "../status";

export type AuditArea = ActivityArea;

export type AuditActor =
  | { kind: "staff"; uid: Uid; name: string; roles: Role[] }
  | { kind: "system"; job: string }
  | { kind: "public" }
  | { kind: "stripe" };

/** One changed field. Values of sealed and contact fields are always `{ redacted: true }`. */
export type AuditChange = {
  field: string;
  from?: string | number | boolean | null;
  to?: string | number | boolean | null;
  redacted?: true;
};

/** auditLog/{id}: append-only security and activity log (D93). */
export interface AuditEntry {
  at: Millis;
  actor: AuditActor;
  /**
   * "auth.sign_in", "auth.sign_in_failed", "record.view", "record.create", "record.update",
   * "status.change", "assign", "note.add", "field.reveal", "attachment.download", "export.run",
   * "content.save", "content.publish", "staff.invite", "staff.roles_change", "staff.deactivate",
   * "mfa.reset", "settings.change", "privacy.*", "retention.delete", "retention.anonymise".
   */
  action: string;
  area: AuditArea;
  /** True = show in "Recent activity" (creates, status changes, assignments, publishes). */
  feed: boolean;
  /** True for record views, field reveals, exports, auth and role changes (D93). */
  sensitive: boolean;
  /** "supportRequests/HVN-SR-2026-0001". */
  targetPath: string | null;
  targetRef: string | null;
  /** "Fatou moved HVN-SR-2026-0001 to Assigned". Never sensitive content. */
  summary: string;
  changes: AuditChange[] | null;
  /** Daily-salted HMAC of the IP; never the IP itself. */
  ipHash: string | null;
  /** Coarse device label on auth entries ("Chrome on Windows") (D92). */
  device: string | null;
  requestId: string;
}

export type OutboxStatus = "queued" | "sending" | "scheduled" | "held" | "sent" | "failed" | "cancelled" | "suppressed";

/** emailOutbox/{dedupeKey}, e.g. "support_confirmation~HVN-SR-2026-0001" (D106). */
export interface OutboxEmail {
  template: EmailTemplateId;
  /** Resolved addresses; staff alerts use toStaffUids, resolved at send time. */
  to: string[];
  toStaffUids: Uid[];
  /** The template's fixed subject plus, at most, the reference. */
  subject: string;
  /** Sealed when the vars include anything beyond reference, first name and links. Null after the 90-day purge. */
  vars: Record<string, string | number> | Sealed | null;
  status: OutboxStatus;
  /** Now, or a future time (Zoom reminders, concern re-alerts). */
  scheduledFor: Millis;
  attempts: number;
  /** Backoff 1, 5, 30, 120, 720 minutes, then failed. */
  nextAttemptAt: Millis;
  /** Claimed in a transaction to prevent double sends (after() + cron). */
  leaseUntil: Millis | null;
  lastError: string | null;
  provider: "resend" | "mailbox" | "redirect" | null;
  providerMessageId: string | null;
  related: { path: string; reference: string } | null;
  /** Rendered preview kept for held mail (mailbox mode) and the email log. Purged with vars. */
  preview: { html: string; text: string } | null;
  /** From provider webhooks. */
  deliveryState?: "delivered" | "delayed" | "bounced" | "complained";
  createdAt: Millis;
  sentAt: Millis | null;
  bodyPurgedAt: Millis | null;
  /** TTL +1 year. */
  expireAt: Millis;
}

/** emailSuppressions/{emailHash}: never email this address again (bounces, complaints, unsubscribes). */
export interface EmailSuppression {
  reason: "bounce" | "complaint" | "unsubscribe" | "manual";
  at: Millis;
  source: string;
}

/** counters/{PP}-{YYYY} (and RC-YYYY, SP). */
export interface Counter {
  next: number;
  updatedAt: Millis;
}

/** rateLimits/{sha256(form|ipHash|window)} (TTL 24 h). */
export interface RateLimitBucket {
  count: number;
  windowStart: Millis;
  expireAt: Millis;
}

export type DataRequestType = "access" | "correction" | "deletion" | "stop_contact";

/** dataRequests/{HVN-DR-YYYY-NNNN}: access, correction and deletion requests (D104). */
export interface DataRequest extends CaseDoc<DataRequestStatus> {
  type: DataRequestType;
  requester: { fullName: string; email: string; emailLower: string; phone: string | null };
  /** ≤ 2000. */
  details: string;
  knownReferences: string[];
  verifyTokenHash: string | null;
  verifiedAt: Millis | null;
  /** createdAt + 30 days. */
  dueAt: Millis;
  findings: Array<{
    path: string;
    action: "corrected" | "deleted" | "anonymised" | "restricted" | "no_action";
    reason: string;
    at: Millis;
    by: Uid;
  }>;
  rejectionReason: string | null;
}

/** retentionQueue/{collection~docId}. */
export interface RetentionQueueItem {
  path: string;
  policy: RetentionPolicyId;
  dueAt: Millis;
  mode: "auto_delete" | "auto_anonymise" | "review";
  createdAt: Millis;
}

/** cronLocks/{job}: lease lock so overlapping invocations don't run a job twice. */
export interface CronLock {
  until: Millis;
  holder: string;
  acquiredAt: Millis;
}

/** metrics/{YYYY-MM-DD}: internal counters with no personal data (integrations §8.2). */
export interface Metric {
  day: string;
  counts: Record<string, number>;
  updatedAt: Millis;
}

/** aiJobs/{id}: AI drafting runs (the run log). */
export interface AiJob {
  kind: "monthly_blog_drafts" | "single_draft" | "assist" | "cover";
  status: "queued" | "running" | "succeeded" | "failed";
  /** "2026-11". */
  month: string | null;
  startedAt: Millis;
  finishedAt: Millis | null;
  provider: "anthropic" | "gemini" | "template";
  model: string;
  promptVersion: string | null;
  postIds: string[];
  /** Why a fallback was used, or why it failed. Never prompt text. */
  error: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  triggeredBy: Uid | "cron";
}
