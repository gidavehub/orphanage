import "server-only";

// Safeguarding (admin-ux §6.5; data-model §4.2.2, §5.5; PLAN D76, D83, D87). The ONLY module that
// opens concern fields (concern isolation, §5.5 rule 3). Every entry point needs concern.read and a
// recent sign-in (step-up, D87); every open of a concern writes a `sensitive` audit entry; the first
// open by a safeguarding officer acknowledges it (screening) and cancels the queued re-alerts.

import { notFound } from "next/navigation";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { ConcernAction } from "@/lib/model/domain/case";
import type { SafeguardingConcern } from "@/lib/model/domain/concern";
import type { OrgSettings } from "@/lib/model/domain/settings";
import type { OutboxEmail } from "@/lib/model/domain/system";
import { toStaffRef, type StaffRef, type TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis, Uid } from "@/lib/model/enums";
import { AGE_BAND_LABEL, CONCERN_TYPE_LABEL, RELATIONSHIP_LABEL, YES_NO_UNSURE_LABEL } from "@/lib/model/labels";
import { OPEN_STATUSES, type RiskLevel, type StatusOf } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, audit } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireRecentAuth, requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath, settingsPath } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import type { WithId } from "@/lib/server/db/store";
import { cancelEmail } from "@/lib/server/email/outbox";
import { addEventTx, eventActorOf, listEvents } from "@/lib/server/events";
import { log } from "@/lib/server/log";
import { activeStaff } from "@/lib/server/notify";
import { tryOpenField } from "@/lib/server/security/seal";
import { actionDoc, actionsPath, concernMachine, type ConcernActionInput } from "@/lib/server/workflow/concern";
import { transitionResult } from "@/lib/server/workflow/flow";
import { staffRefs } from "./_shared";

type S = StatusOf<"concern">;

/** Concerns are only for safeguarding officers and super admins, with a recent sign-in. */
async function gate(nextPath: string): Promise<Viewer> {
  const v = await requireStaff("concern.read");
  await requireRecentAuth(v, nextPath);
  return v;
}

/* ── The list ──────────────────────────────────────────────────────────── */

export type ConcernRow = {
  ref: string;
  status: S;
  risk: RiskLevel | null;
  ageBand: string;
  country: string;
  createdAt: Millis;
  followUpAt: Millis | null;
  assignee: StaffRef | null;
  waitingSecondSignOff: boolean;
  suspectedSpam: boolean;
};

export async function listConcerns(): Promise<{ open: ConcernRow[]; closed: ConcernRow[]; at: Millis }> {
  await gate("/admin/safeguarding");
  const [open, closed, staff] = await Promise.all([
    getStore().list<SafeguardingConcern>(C.safeguardingConcerns, { where: [{ field: "archived", op: "==", value: false }, { field: "status", op: "in", value: [...OPEN_STATUSES.concern] }], orderBy: { field: "createdAt", dir: "desc" }, limit: 100 }),
    getStore().list<SafeguardingConcern>(C.safeguardingConcerns, { where: [{ field: "archived", op: "==", value: false }, { field: "status", op: "==", value: "closed" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 50 }),
    staffRefs(),
  ]);
  // Only safe fields: reference, risk, stage, age range, country, assignee, dates. Never narrative.
  const row = (c: WithId<SafeguardingConcern>): ConcernRow => ({
    ref: c.id,
    status: c.status,
    risk: c.riskLevel ?? null,
    ageBand: AGE_BAND_LABEL[c.child?.ageBand] ?? "",
    country: c.child?.country ?? "",
    createdAt: c.createdAt,
    followUpAt: c.followUpAt ?? null,
    assignee: c.assignedTo ? (staff.get(c.assignedTo) ?? toStaffRef(c.assignedTo, c.assignedName ?? "A colleague")) : null,
    waitingSecondSignOff: !!c.closure && !c.closure.secondSignOffAt && c.status !== "closed",
    suspectedSpam: !!c.suspectedSpam,
  });
  return { open: open.items.map(row), closed: closed.items.map(row), at: Date.now() };
}

/* ── One concern ───────────────────────────────────────────────────────── */

export type ConcernDetailDTO = {
  ref: string;
  status: S;
  version: number;
  createdAt: Millis;
  source: string;
  suspectedSpam: boolean;
  risk: RiskLevel | null;
  riskRationale: string | null;
  riskBy: string | null;
  narrative: string | null;
  concernTypes: string[];
  child: { ageBand: string; country: string; area: string | null; details: string | null };
  inDangerNow: string;
  authoritiesContacted: string;
  authorityDetails: string | null;
  reporter: { anonymous: boolean; relationship: string; name: string | null; email: string | null; phone: string | null; followUp: { method: string | null; times: string | null; notes: string | null } | null };
  escalation: { to: string; at: Millis; externalRef: string | null } | null;
  acknowledgedAt: Millis | null;
  closure: { byName: string; at: Millis; reason: string; secondSignOffAt: Millis | null; byMe: boolean } | null;
  actions: Array<{ id: string; kind: ConcernAction["kind"]; at: Millis; dueAt: Millis | null; doneAt: Millis | null; byName: string; detail: string }>;
  openedBy: Array<{ name: string; at: Millis }>;
  assignee: StaffRef | null;
  canWrite: boolean;
  edges: string[];
  twoPerson: boolean;
  history: Array<{ status: S; at: Millis }>;
};

async function twoPersonClose(): Promise<boolean> {
  try {
    const org = await getStore().get<OrgSettings>(settingsPath("org"));
    return org?.concernTwoPersonClose !== false;
  } catch {
    return true;
  }
}

/** Cancels the re-alerts still waiting in the outbox for this concern. */
async function cancelRealerts(ref: string): Promise<number> {
  let n = 0;
  for (const i of [1, 2, 3]) {
    const id = `concern_alert~${ref}~${i}`;
    try {
      const doc = await getStore().get<OutboxEmail>(docPath("emailOutbox", id));
      if (doc && (doc.status === "queued" || doc.status === "held" || doc.status === "scheduled")) {
        await cancelEmail(id);
        n++;
      }
    } catch (err) {
      log.warn("dal.concern.cancel_realert_failed", { id, err });
    }
  }
  return n;
}

/**
 * Opens a concern for a safeguarding officer: writes the sensitive "viewed" audit entry, and on the
 * first open moves it to Screening (acknowledged) and cancels the queued re-alerts.
 */
export async function openConcern(ref: string): Promise<ConcernDetailDTO> {
  const v = await gate(`/admin/safeguarding/${encodeURIComponent(ref)}`);
  const path = docPath("safeguardingConcerns", ref);
  let c = await getStore().get<SafeguardingConcern>(path);
  if (!c) notFound();

  await audit({ actor: actorOf(v), action: "record.view", area: "safeguarding", summary: `${v.displayName} opened ${ref}`, feed: false, sensitive: true, targetPath: path, targetRef: ref });

  if (c.status === "received" && has(v, "concern.manage")) {
    const r = await transitionResult(() => concernMachine.transition({ ref, edgeId: "screen", actor: v }));
    if (r.ok) {
      await cancelRealerts(ref);
      c = (await getStore().get<SafeguardingConcern>(path)) ?? c;
    }
  }

  const [staff, actionsPage, events, auditPage, twoPerson] = await Promise.all([
    staffRefs(),
    getStore().list<ConcernAction>(actionsPath(path), { orderBy: { field: "at", dir: "desc" }, limit: 100 }),
    listEvents(path, { limit: 100 }),
    getStore()
      .list<{ at: Millis; actor?: { kind: string; name?: string }; action: string; targetRef?: string }>(C.auditLog, { where: [{ field: "targetRef", op: "==", value: ref }], orderBy: { field: "at", dir: "desc" }, limit: 40 })
      .catch(() => ({ items: [], nextCursor: null })),
    twoPersonClose(),
  ]);

  const identity = c.reporter.identity ? tryOpenField<{ name?: string; email?: string | null; phone?: string | null }>(path, "reporter.identity", c.reporter.identity) : null;
  const followUp = c.reporter.safeFollowUp ? tryOpenField<{ method?: string; times?: string | null; notes?: string | null }>(path, "reporter.safeFollowUp", c.reporter.safeFollowUp) : null;
  const location = tryOpenField<{ area?: string | null; details?: string | null }>(path, "child.location", c.child.location);
  const history: ConcernDetailDTO["history"] = [{ status: "received", at: c.createdAt }];
  for (const e of [...events.items].reverse()) if ((e.type === "status_changed" || e.type === "reopened") && e.to) history.push({ status: e.to as S, at: e.at });

  const seen = new Set<string>();
  const openedBy: ConcernDetailDTO["openedBy"] = [];
  for (const a of auditPage.items) {
    if (a.action !== "record.view" || !a.actor?.name) continue;
    if (seen.has(a.actor.name)) continue;
    seen.add(a.actor.name);
    openedBy.push({ name: a.actor.name, at: a.at });
  }

  const canWrite = has(v, "concern.manage");
  return {
    ref,
    status: c.status,
    version: c.version,
    createdAt: c.createdAt,
    source: c.source === "moved_from_support" ? "from a support request" : c.source === "staff_entry" ? "logged by staff" : "via the website",
    suspectedSpam: !!c.suspectedSpam,
    risk: c.riskLevel ?? null,
    riskRationale: c.risk ? tryOpenField<string>(path, "risk.rationale", c.risk.rationale) : null,
    riskBy: c.risk ? (staff.get(c.risk.assessedBy)?.name ?? null) : null,
    narrative: tryOpenField<string>(path, "narrative", c.narrative),
    concernTypes: (c.concernTypes ?? []).map((t) => CONCERN_TYPE_LABEL[t] ?? t),
    child: { ageBand: AGE_BAND_LABEL[c.child.ageBand] ?? "", country: c.child.country, area: location?.area ?? null, details: location?.details ?? null },
    inDangerNow: YES_NO_UNSURE_LABEL[c.inDangerNow] ?? c.inDangerNow,
    authoritiesContacted: YES_NO_UNSURE_LABEL[c.authoritiesContacted] ?? c.authoritiesContacted,
    authorityDetails: c.authorityDetails ? tryOpenField<string>(path, "authorityDetails", c.authorityDetails) : null,
    reporter: {
      anonymous: c.reporter.anonymous,
      relationship: RELATIONSHIP_LABEL[c.reporter.relationship] ?? c.reporter.relationship,
      name: identity?.name ?? null,
      email: identity?.email ?? null,
      phone: identity?.phone ?? null,
      followUp: followUp ? { method: followUp.method ?? null, times: followUp.times ?? null, notes: followUp.notes ?? null } : null,
    },
    escalation: c.escalation ? { to: c.escalation.to.replace(/_/g, " "), at: c.escalation.at, externalRef: c.escalation.externalRef ? tryOpenField<string>(path, "escalation.externalRef", c.escalation.externalRef) : null } : null,
    acknowledgedAt: c.acknowledgedAt,
    closure: c.closure ? { byName: staff.get(c.closure.by)?.name ?? "A colleague", at: c.closure.at, reason: c.closure.reason.replace(/_/g, " "), secondSignOffAt: c.closure.secondSignOffAt, byMe: c.closure.by === v.uid } : null,
    actions: actionsPage.items.map((a) => ({
      id: a.id,
      kind: a.kind,
      at: a.at,
      dueAt: a.dueAt,
      doneAt: a.doneAt,
      byName: a.byName,
      detail: tryOpenField<string>(`${actionsPath(path)}/${a.id}`, "detail", a.detail) ?? "This entry couldn't be opened.",
    })),
    openedBy,
    assignee: c.assignedTo ? (staff.get(c.assignedTo) ?? toStaffRef(c.assignedTo, c.assignedName ?? "A colleague")) : null,
    canWrite,
    edges: canWrite ? concernMachine.allowedFor({ status: c.status }, v).map((e) => e.id) : [],
    twoPerson,
    history,
  };
}

/** The concern's restricted timeline (summaries only; actions are listed separately). */
export async function concernTimeline(ref: string): Promise<TimelineEntryDTO[]> {
  await gate(`/admin/safeguarding/${encodeURIComponent(ref)}`);
  const events = await listEvents(docPath("safeguardingConcerns", ref), { limit: 100 });
  return events.items.map((e) => ({
    id: e.id,
    ref,
    at: e.at,
    actor: e.actor.kind === "staff" ? toStaffRef(e.actor.uid, e.actor.name) : e.actor.kind === "system" ? { system: e.actor.job } : { public: true as const },
    kind: e.type === "created" ? "submitted" : e.type === "status_changed" || e.type === "reopened" ? "status" : "system",
    text: e.summary,
    restricted: true,
  }));
}

/* ── Changes ───────────────────────────────────────────────────────────── */

async function alertList(): Promise<Uid[]> {
  const staff = await activeStaff();
  return staff.filter((s) => (s.roles ?? []).some((r) => r === "safeguarding_officer" || r === "super_admin")).map((s) => s.uid ?? s.id);
}

/** One step on a concern (the DAL resolves who to alert and the two-person setting). */
export async function moveConcern(ref: string, edgeId: string, expectedVersion: number, input: Record<string, unknown>): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("concern.manage");
  await requireRecentAuth(v, `/admin/safeguarding/${encodeURIComponent(ref)}`);
  const extra = edgeId === "escalate" ? { alertUids: await alertList() } : edgeId === "close" ? { twoPerson: await twoPersonClose() } : {};
  return transitionResult(() => concernMachine.transition({ ref, edgeId, actor: v, expectedVersion, input: { ...input, ...extra } }));
}

/** Records an action or a follow-up without changing the stage. */
export async function addConcernAction(ref: string, a: ConcernActionInput): Promise<ActionResult> {
  const v = await requireStaff("concern.manage");
  await requireRecentAuth(v, `/admin/safeguarding/${encodeURIComponent(ref)}`);
  if (!a.detail?.trim()) return actionError({ kind: "validation", fields: { detail: "Write what happened." } });
  const path = docPath("safeguardingConcerns", ref);
  const now = Date.now();
  try {
    let version = 0;
    await getStore().runTransaction(async (tx) => {
      const c = await tx.get<SafeguardingConcern>(path);
      if (!c) throw new Error("gone");
      version = c.version + 1;
      const id = newId();
      tx.create(`${actionsPath(path)}/${id}`, actionDoc(path, id, a, { uid: v.uid, name: v.displayName }, now));
      const followUpAt = a.dueAt && (!c.followUpAt || a.dueAt < c.followUpAt) ? a.dueAt : c.followUpAt;
      tx.update(path, { followUpAt: followUpAt ?? null, lastActivityAt: now, updatedAt: now, version });
      addEventTx(tx, path, { type: "field_updated", actor: eventActorOf(v), summary: `${v.displayName.split(" ")[0]} recorded an action`, at: now });
    });
    return actionOk({ version, at: now });
  } catch (err) {
    log.warn("dal.concern.action_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

/** First step of a two-person closure: records who asks to close and why. */
export async function requestConcernClosure(ref: string, reason: string, note: string): Promise<ActionResult> {
  const v = await requireStaff("concern.manage");
  await requireRecentAuth(v, `/admin/safeguarding/${encodeURIComponent(ref)}`);
  if (!reason || !note.trim()) return actionError({ kind: "validation", fields: { note: "Choose a reason and write a closing note." } });
  const path = docPath("safeguardingConcerns", ref);
  const now = Date.now();
  try {
    let version = 0;
    await getStore().runTransaction(async (tx) => {
      const c = await tx.get<SafeguardingConcern>(path);
      if (!c) throw new Error("gone");
      version = c.version + 1;
      tx.update(path, { closure: { by: v.uid, at: now, reason, secondSignOffBy: null, secondSignOffAt: null }, lastActivityAt: now, updatedAt: now, version });
      const id = newId();
      tx.create(`${actionsPath(path)}/${id}`, actionDoc(path, id, { kind: "other", detail: `Asked to close (${reason.replace(/_/g, " ")}): ${note.trim()}` }, { uid: v.uid, name: v.displayName }, now));
      addEventTx(tx, path, { type: "field_updated", actor: eventActorOf(v), summary: `${v.displayName.split(" ")[0]} asked for closure; waiting for a second sign-off`, at: now });
    });
    return actionOk({ version, at: now });
  } catch (err) {
    log.warn("dal.concern.request_close_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

/** For the cron/tests: cancel re-alerts of an acknowledged concern (exported for reuse). */
export { cancelRealerts };
