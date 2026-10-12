import "server-only";

// Child-protection concerns from the public site (data-model §4.2.2, §10.2; integrations §4.4 re-alerts;
// PLAN D79, D94, D107–D109). Two doors lead here:
//   - the concern form (source "web_form"), through runIntake with keepSuspected: honeypot, time-trap
//     and over-limit submissions are KEPT, flagged `suspectedSpam`, and raise no alert;
//   - a support request with immediate danger or the child-protection category (source
//     "moved_from_support"): written only here, never to supportRequests (D79).
// One transaction under a fresh random reference (HVN-XXXX-XXXX): the concern with every free-text
// field sealed (identity, follow-up, location, narrative, authority details), the timeline event,
// attachments, the concern_alert email to the alert list now plus three scheduled re-alerts (super
// admins join the last), the in-app alert (a fixed, non-sensitive title), the reporter confirmation
// only when allowed (D108), and the audit entry. Nothing about the concern reaches a title, subject,
// log line or search token: the only searchable token is the reference.

import type { SafeguardingConcern } from "@/lib/model/domain/concern";
import type { NotificationSettings } from "@/lib/model/domain/settings";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/model/domain/settings";
import type { AgeBand, ConcernType, ContactMethod, CountryCode, Millis, Relationship, Uid, YesNoUnsure } from "@/lib/model/enums";
import { actionError, actionOk, type ActionResult, type FormState } from "@/lib/forms/types";
import { CONCERN_ECHO_KEYS, concernSchema, type ConcernData } from "@/lib/schemas/forms/concern";
import { emailLowerOf } from "@/lib/schemas/common";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { docPath, settingsPath } from "@/lib/server/db/collections";
import type { Tx } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { addEventTx, eventActorOf } from "@/lib/server/events";
import { consentStamp, runIntake, type IntakeContext } from "@/lib/server/intake/pipeline";
import { attachmentWritesTx, moveAttachmentFiles, type AttachmentMove, type VerifiedUpload } from "@/lib/server/intake/upload";
import { log } from "@/lib/server/log";
import { notifyTx, recipientsFor, superAdminUids } from "@/lib/server/notify";
import { createConcernWithRandomRef } from "@/lib/server/references";
import { emailHash } from "@/lib/server/security/hmac";
import { sealField } from "@/lib/server/security/seal";
import { baseUrl } from "@/lib/server/url";

/** What the success screen needs (never anything about the concern itself). */
export type ConcernSuccess = { emailSent: boolean };

const MINUTE = 60_000;
/** Re-alert cadence when the child is in danger now (integrations §4.4: +30, +60, +90 minutes). */
const DANGER_REALERT_MIN = 30;
const REALERTS = 3;

/** The in-app title is fixed: it never says what the concern is about. */
export const CONCERN_ALERT_TITLE = "New safeguarding item needs review";

export type NewConcern = {
  source: "web_form" | "moved_from_support" | "staff_entry";
  /** Set when a team member logged it from a call or visit (the timeline and audit name them). */
  loggedBy?: Viewer;
  reporter: {
    anonymous: boolean;
    name: string | null;
    email: string | null;
    phone: string | null;
    relationship: Relationship;
    followUp: { method: ContactMethod; times: string | null; notes: string | null } | null;
    emailConfirmationAllowed: boolean;
  };
  child: { ageBand: AgeBand; country: CountryCode; area: string | null; details: string | null };
  concernTypes: ConcernType[];
  narrative: string;
  inDangerNow: YesNoUnsure;
  authoritiesContacted: YesNoUnsure;
  authorityDetails: string | null;
  suspectedSpam: boolean;
  uploads: readonly VerifiedUpload[];
  /** Timeline sentence for the "created" event (never narrative). */
  createdSummary: string;
};

function firstNameOf(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : null;
}

function priorityOf(inDanger: YesNoUnsure): string {
  return inDanger === "yes" ? "Immediate" : inDanger === "unsure" ? "High" : "Normal";
}

async function realertAfterMin(): Promise<number> {
  try {
    const doc = await getStore().get<NotificationSettings>(settingsPath("notifications"));
    const v = doc?.concernAlert?.realertAfterMin;
    return typeof v === "number" && Number.isFinite(v) && v >= 15 && v <= 24 * 60 ? v : DEFAULT_NOTIFICATION_SETTINGS.concernAlert.realertAfterMin;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS.concernAlert.realertAfterMin;
  }
}

async function fallbackAlertEmail(): Promise<string | null> {
  try {
    const doc = await getStore().get<NotificationSettings>(settingsPath("notifications"));
    const v = doc?.concernAlert?.fallbackEmail;
    return typeof v === "string" && v.includes("@") ? v : null;
  } catch {
    return null;
  }
}

/** Queues the alert now and the three re-alerts (cancelled by A3 when a safeguarding officer opens it). */
async function queueAlertsTx(
  tx: Tx,
  o: { reference: string; path: string; now: Millis; inDanger: YesNoUnsure; alertUids: Uid[]; adminUids: Uid[]; fallback: string | null; stepMin: number },
): Promise<number> {
  const link = `${baseUrl()}/admin/safeguarding`;
  const priority = priorityOf(o.inDanger);
  const related = { path: o.path, reference: o.reference };
  const fallbackTo = o.alertUids.length === 0 && o.fallback ? [o.fallback] : [];
  if (o.alertUids.length === 0 && fallbackTo.length === 0) return 0;
  let queued = 0;
  await enqueueEmailTx(tx, {
    template: "concern_alert",
    toStaffUids: o.alertUids,
    to: fallbackTo,
    vars: { priority, link },
    dedupeKey: o.reference,
    related,
  });
  queued++;
  for (let n = 1; n <= REALERTS; n++) {
    const last = n === REALERTS;
    await enqueueEmailTx(tx, {
      template: "concern_alert",
      toStaffUids: last ? [...new Set([...o.alertUids, ...o.adminUids])] : o.alertUids,
      to: fallbackTo,
      vars: { priority, link, realert: n },
      dedupeKey: `${o.reference}~${n}`,
      scheduledFor: o.now + n * o.stepMin * MINUTE,
      related,
    });
    queued++;
  }
  return queued;
}

/** Creates a concern (both doors). Returns its random reference and whether the reporter is emailed. */
export async function createConcern(input: NewConcern): Promise<{ reference: string; emailSent: boolean }> {
  const r = input.reporter;
  const anonymous = r.anonymous;
  const email = anonymous ? null : r.email;
  const emailLower = email ? emailLowerOf(email) : null;
  const confirmReporter = !anonymous && !input.suspectedSpam && !!email && r.emailConfirmationAllowed && r.followUp?.method === "email";

  // Resolve people before the transaction (they read staff and settings).
  const [alertUids, adminUids, stepSetting, fallback] = input.suspectedSpam
    ? [[] as Uid[], [] as Uid[], 0, null]
    : await Promise.all([recipientsFor("concern_alert"), superAdminUids(), realertAfterMin(), fallbackAlertEmail()]);
  const stepMin = input.inDangerNow === "yes" ? DANGER_REALERT_MIN : stepSetting;

  let moves: AttachmentMove[] = [];
  const reference = await createConcernWithRandomRef<SafeguardingConcern>(
    (ref, now) => {
      const path = docPath("safeguardingConcerns", ref);
      return {
        reference: ref,
        status: "received",
        statusChangedAt: now,
        assignedTo: null,
        assignedName: null,
        assignedAt: null,
        followUpAt: null,
        snoozedUntil: null,
        seenBy: [],
        lastActivityAt: now,
        closedAt: null,
        archived: false,
        archivedAt: null,
        tags: [],
        searchTokens: [ref.toLowerCase()],
        retention: { policy: "concern", retainUntil: null, legalHold: false },
        source: input.source,
        createdAt: now,
        updatedAt: now,
        version: 1,
        reporter: {
          anonymous,
          identity: anonymous ? null : sealField(path, "reporter.identity", { name: r.name, email, phone: r.phone }),
          lookupHash: emailLower ? emailHash(emailLower) : null,
          relationship: r.relationship,
          safeFollowUp: anonymous || !r.followUp ? null : sealField(path, "reporter.safeFollowUp", r.followUp),
          emailConfirmationAllowed: !anonymous && !!email && r.emailConfirmationAllowed,
        },
        child: {
          ageBand: input.child.ageBand,
          country: input.child.country,
          location: sealField(path, "child.location", { area: input.child.area, details: input.child.details }),
        },
        concernTypes: input.concernTypes,
        narrative: sealField(path, "narrative", input.narrative),
        inDangerNow: input.inDangerNow,
        authoritiesContacted: input.authoritiesContacted,
        authorityDetails: input.authorityDetails ? sealField(path, "authorityDetails", input.authorityDetails) : null,
        consent: consentStamp(now),
        riskLevel: null,
        risk: null,
        escalation: null,
        acknowledgedAt: null,
        realertCount: 0,
        suspectedSpam: input.suspectedSpam,
        closureReason: null,
        closure: null,
        linkedSupportRef: null,
      };
    },
    async (tx, ref, now) => {
      const path = docPath("safeguardingConcerns", ref);
      addEventTx(tx, path, { type: "created", actor: input.loggedBy ? eventActorOf(input.loggedBy) : { kind: "public" }, summary: input.createdSummary, at: now });

      if (input.uploads.length) {
        moves = attachmentWritesTx(tx, input.uploads, { collection: "safeguardingConcerns", docId: ref, label: "other", now });
        addEventTx(tx, path, {
          type: "attachment_added",
          actor: { kind: "public" },
          summary: input.uploads.length === 1 ? "1 document attached" : `${input.uploads.length} documents attached`,
          at: now,
        });
      }

      if (!input.suspectedSpam) {
        const queued = await queueAlertsTx(tx, { reference: ref, path, now, inDanger: input.inDangerNow, alertUids, adminUids, fallback, stepMin });
        if (queued) {
          addEventTx(tx, path, { type: "email_queued", actor: { kind: "system", job: "intake" }, summary: "Safeguarding team alerted by email", at: now });
        }
        if (alertUids.length) {
          notifyTx(tx, { recipientUids: alertUids, kind: "concern_alert", title: CONCERN_ALERT_TITLE, href: "/admin/safeguarding", priority: "urgent" });
        }
      }

      if (confirmReporter && email) {
        await enqueueEmailTx(tx, {
          template: "concern_reporter_confirmation",
          to: [email],
          vars: { ...(firstNameOf(r.name) ? { firstName: firstNameOf(r.name)! } : {}) },
          dedupeKey: ref,
          related: { path, reference: ref },
        });
        addEventTx(tx, path, { type: "email_queued", actor: { kind: "system", job: "intake" }, summary: "Confirmation email queued to the reporter", at: now });
      }

      auditTx(tx, {
        actor: input.loggedBy ? actorOf(input.loggedBy) : { kind: "public" },
        action: input.source === "web_form" ? "concern.received" : input.source === "staff_entry" ? "concern.logged" : "concern.moved_from_support",
        area: "safeguarding",
        summary: input.suspectedSpam
          ? "A possible-spam safeguarding item was kept for review"
          : input.loggedBy
            ? `${input.loggedBy.displayName} logged a safeguarding concern from a call or visit`
            : "A safeguarding item was received on the website",
        feed: false,
        targetPath: path,
        targetRef: ref,
      });
    },
  );

  if (moves.length) await moveAttachmentFiles(moves);
  if (input.suspectedSpam) log.info("concern.kept_suspected", {});
  return { reference, emailSent: confirmReporter };
}

function toNewConcern(d: ConcernData, ctx: IntakeContext): NewConcern {
  const anonymous = d.reporterMode === "anonymous";
  return {
    source: "web_form",
    reporter: {
      anonymous,
      name: anonymous ? null : d.name,
      email: anonymous ? null : d.email,
      phone: anonymous ? null : d.phone,
      relationship: d.relationship ?? "other",
      followUp: anonymous || !d.followUpMethod ? null : { method: d.followUpMethod, times: d.followUpTimes, notes: null },
      emailConfirmationAllowed: !anonymous && d.followUpMethod === "email" && d.emailConfirmationAllowed,
    },
    child: { ageBand: d.childAge, country: d.country, area: d.area, details: null },
    concernTypes: d.concernTypes,
    narrative: d.narrative,
    inDangerNow: d.inDangerNow,
    authoritiesContacted: d.authoritiesContacted,
    authorityDetails: d.authoritiesContacted === "yes" ? d.authorityDetails : null,
    suspectedSpam: ctx.suspectedSpam,
    uploads: [],
    createdSummary: ctx.suspectedSpam ? "Received through the website (flagged as possible spam)" : "Concern received through the website",
  };
}

/** The concern form's Server Action body. Never rate-limited away and never discarded (D94). */
export async function submitConcernForm(fd: FormData): Promise<FormState<string, ConcernSuccess>> {
  return runIntake<typeof concernSchema, ConcernSuccess>({
    form: "concern",
    input: fd,
    schema: concernSchema,
    keepSuspected: true,
    echoKeys: CONCERN_ECHO_KEYS,
    create: async (data, ctx) => {
      const { reference, emailSent } = await createConcern(toNewConcern(data, ctx));
      return { reference, data: { emailSent } };
    },
  });
}

/**
 * A team member logs a concern from a call or visit (admin-ux §3.4 "Log a concern"): the same checks,
 * alerts and re-alerts as the website form, source `staff_entry`. The caller can stay anonymous. The
 * reporter is never emailed from here (the staff member agrees follow-up with them on the call).
 */
export async function logConcernByStaff(v: Viewer, raw: Record<string, unknown>): Promise<ActionResult<{ reference: string }>> {
  const parsed = concernSchema.safeParse({ ...raw, emailConfirmationAllowed: null, consent: "on" });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "_form");
      if (!fields[k]) fields[k] = i.message;
    }
    return actionError({ kind: "validation", fields });
  }
  const n = toNewConcern(parsed.data, { suspectedSpam: false } as IntakeContext);
  const { reference } = await createConcern({
    ...n,
    source: "staff_entry",
    loggedBy: v,
    reporter: { ...n.reporter, emailConfirmationAllowed: false },
    createdSummary: `Logged by ${v.displayName} from a call or visit`,
  });
  return actionOk({ reference });
}

