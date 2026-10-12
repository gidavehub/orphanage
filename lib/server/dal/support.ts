import "server-only";

// Support requests for the team space (admin-ux §6.4; data-model §4.1, §5.1). Every entry point calls
// requireStaff first and opens the record for the viewer (programme scope included). DTOs are built
// field by field. Contact details are masked unless the viewer looks after the request, is a
// safeguarding officer or a super admin; "Show" reveals one field for others and is audited as
// sensitive. The explanation and notes are opened only here, after the checks.

import { EDUCATION_LEVEL_LABEL, EDUCATION_NEED_LABEL, LEGAL_MATTER_LABEL, MEDICAL_NEED_LABEL } from "@/components/public/help/labels";
import type { SupportRequest } from "@/lib/model/domain/support";
import type { StaffProfile } from "@/lib/model/domain/staff";
import { toStaffRef, type InboxItem, type Page, type StaffRef, type TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis, Uid } from "@/lib/model/enums";
import type { EdgeSpec } from "@/lib/model/flows";
import { AGE_BAND_LABEL, CONTACT_METHOD_LABEL, RELATIONSHIP_LABEL, ROLE_LABEL, SUPPORT_CATEGORY_LABEL } from "@/lib/model/labels";
import { permsFor } from "@/lib/model/permissions";
import { OPEN_STATUSES, type StatusOf } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { actorOf, audit, auditTx } from "@/lib/server/audit";
import { has, programmeFilterFor } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { Filter, WithId } from "@/lib/server/db/store";
import { addEventTx, eventActorOf, listEvents, listNotes, openNoteBody } from "@/lib/server/events";
import { log } from "@/lib/server/log";
import { activeStaff } from "@/lib/server/notify";
import { tryOpenField } from "@/lib/server/security/seal";
import { supportMachine } from "@/lib/server/workflow/support";
import { clampLimit, loadForViewer, maskEmail, maskPhone, staffRefs } from "./_shared";
import { shortName } from "./inbox";

type S = StatusOf<"support">;

export type SupportDetailDTO = {
  ref: string;
  status: S;
  version: number;
  createdAt: Millis;
  lastActivityAt: Millis;
  title: string;
  category: SupportRequest["category"];
  programmeId: SupportRequest["programmeId"];
  urgency: SupportRequest["urgency"];
  applicant: {
    name: string;
    relationship: string;
    country: string;
    locality: string | null;
    preferredContact: string;
    safeToContact: boolean;
    bestTimes: string | null;
    phone: { value: string; masked: boolean } | null;
    email: { value: string; masked: boolean } | null;
  };
  /** May press Show on masked fields (never viewers). */
  canReveal: boolean;
  consent: { contactAt: Millis | null; privacyAt: Millis | null };
  child: { ageBand: string; numberOfChildren: number | null } | null;
  explanation: string | null;
  details: Array<{ label: string; value: string }>;
  triage: { eligibility: "eligible" | "ineligible" | "unclear" | null; verification: { status: string; method: string | null; byName: string | null; at: Millis | null } };
  moreInfo: { requestedAt: Millis; dueAt: Millis } | null;
  referrals: Array<{ id: string; toName: string; toType: string; outcome: string; at: Millis; note: string | null }>;
  decision: { kind: "approved" | "declined"; reasonCode: string | null; at: Millis } | null;
  outcome: string | null;
  closureReason: string | null;
  movedToSafeguarding: boolean;
  assignee: StaffRef | null;
  history: Array<{ status: S; at: Millis }>;
  canWrite: boolean;
  /** Edges this person may take now (the stepper filters by perms; guards are previewed in `blocked`). */
  edges: string[];
  blocked: Partial<Record<string, string>>;
  people: Array<{ uid: Uid; name: string; roleLabel: string; openCount: number }>;
  attachments: number;
  me: Uid;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

function canSeeContact(v: Viewer, rec: SupportRequest): boolean {
  return rec.assignedTo === v.uid || v.roles.includes("super_admin") || v.roles.includes("safeguarding_officer");
}

function detailLines(rec: SupportRequest): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  if (rec.education) {
    out.push({ label: "School level", value: EDUCATION_LEVEL_LABEL[rec.education.level as keyof typeof EDUCATION_LEVEL_LABEL] ?? rec.education.level });
    if (rec.education.needs?.length) out.push({ label: "Needs", value: rec.education.needs.map((n) => EDUCATION_NEED_LABEL[n as keyof typeof EDUCATION_NEED_LABEL] ?? n).join(", ") });
    if (rec.education.amountNeeded) out.push({ label: "Amount mentioned", value: `${rec.education.amountNeeded.currency} ${(rec.education.amountNeeded.amountMinor / 100).toLocaleString("en")}` });
  }
  if (rec.medical) out.push({ label: "Medical need", value: MEDICAL_NEED_LABEL[rec.medical.need as keyof typeof MEDICAL_NEED_LABEL] ?? rec.medical.need });
  if (rec.legal) out.push({ label: "Legal matter", value: LEGAL_MATTER_LABEL[rec.legal.matter as keyof typeof LEGAL_MATTER_LABEL] ?? rec.legal.matter });
  if (rec.food) {
    if (rec.food.householdSize) out.push({ label: "People at home", value: String(rec.food.householdSize) });
    if (rec.food.childrenInHousehold) out.push({ label: "Children at home", value: String(rec.food.childrenInHousehold) });
  }
  if (rec.counselling) {
    out.push({ label: "Counselling for", value: rec.counselling.forWhom.replace(/_/g, " ") });
    if (rec.counselling.language) out.push({ label: "Language", value: rec.counselling.language });
    out.push({ label: "Format", value: rec.counselling.format });
    if (rec.counselling.timezone) out.push({ label: "Their timezone", value: rec.counselling.timezone });
  }
  return out;
}

/** Staff who may look after support requests, with how many open requests each has. */
async function peopleFor(): Promise<SupportDetailDTO["people"]> {
  const staff = await activeStaff();
  const eligible = staff.filter((s: WithId<StaffProfile>) => permsFor(s.roles ?? [], s.viewerScopes ?? []).has("support.manage"));
  const counts = await Promise.all(
    eligible.map((s) =>
      getStore()
        .count(C.supportRequests, [
          { field: "assignedTo", op: "==", value: s.uid ?? s.id },
          { field: "status", op: "in", value: [...OPEN_STATUSES.support] },
        ])
        .catch(() => 0),
    ),
  );
  return eligible.map((s, i) => ({
    uid: s.uid ?? s.id,
    name: s.displayName,
    roleLabel: (s.roles ?? []).map((r) => ROLE_LABEL[r]?.name ?? r).join(", "),
    openCount: counts[i] ?? 0,
  }));
}

/** The request view for this viewer (NoAccess when it isn't theirs to open). */
export async function getSupportDetail(ref: string): Promise<SupportDetailDTO> {
  const v = await requireStaff("support.read", "support.summary", "support.manage");
  const loaded = await loadForViewer(v, ref);
  if (loaded.collection !== "supportRequests") throw new Error("Not a support request.");
  const rec = loaded.record as unknown as WithId<SupportRequest>;
  const summaryOnly = !has(v, "support.read") && !has(v, "support.manage");
  const canWrite = has(v, "support.manage");
  const seeContact = canSeeContact(v, rec);
  const [staff, events, people] = await Promise.all([staffRefs(), listEvents(loaded.path, { limit: 100 }), canWrite ? peopleFor() : Promise.resolve([])]);

  const history: SupportDetailDTO["history"] = [{ status: "new", at: rec.createdAt }];
  for (const e of [...events.items].reverse()) {
    if ((e.type === "status_changed" || e.type === "reopened") && e.to) history.push({ status: e.to as S, at: e.at });
  }

  const allowed: EdgeSpec<S>[] = canWrite ? supportMachine.allowedFor({ status: rec.status }, v) : [];
  const blocked: Partial<Record<string, string>> = {};
  for (const edge of allowed) {
    if (edge.id === "approve") {
      if (rec.triage?.verification?.status !== "verified") blocked.approve = "Check and verify the request first, then you can approve it.";
      else if (rec.triage.eligibility !== "eligible") blocked.approve = "Mark the request as eligible first, then you can approve it.";
    }
  }

  const a = rec.applicant;
  const verifiedBy = rec.triage?.verification?.by ? staff.get(rec.triage.verification.by)?.name ?? null : null;
  const dto: SupportDetailDTO = {
    ref: loaded.ref,
    status: rec.status,
    version: rec.version,
    createdAt: rec.createdAt,
    lastActivityAt: rec.lastActivityAt,
    title: SUPPORT_CATEGORY_LABEL[rec.category] ?? "Support request",
    category: rec.category,
    programmeId: rec.programmeId,
    urgency: rec.urgency,
    applicant: {
      name: seeContact ? a.fullName : shortName(a.fullName),
      relationship: a.relationship === "other" ? (a.relationshipOther ?? "Other") : (RELATIONSHIP_LABEL[a.relationship] ?? a.relationship),
      country: a.country,
      locality: summaryOnly ? null : a.locality,
      preferredContact: CONTACT_METHOD_LABEL[a.preferredContact] ?? a.preferredContact,
      safeToContact: a.safeToContact,
      bestTimes: summaryOnly ? null : a.bestTimes,
      phone: a.phone ? (seeContact ? { value: a.phone, masked: false } : { value: maskPhone(a.phone), masked: true }) : null,
      email: a.email ? (seeContact ? { value: a.email, masked: false } : { value: maskEmail(a.email), masked: true }) : null,
    },
    canReveal: !summaryOnly && !v.roles.every((r) => r === "viewer"),
    consent: { contactAt: rec.consentToContact?.at ?? null, privacyAt: rec.privacyAcknowledged?.at ?? null },
    child: rec.child ? { ageBand: AGE_BAND_LABEL[rec.child.ageBand] ?? rec.child.ageBand, numberOfChildren: rec.child.numberOfChildren } : null,
    explanation: summaryOnly ? null : tryOpenField<string>(loaded.path, "explanation", rec.explanation),
    details: summaryOnly ? [] : detailLines(rec),
    triage: {
      eligibility: rec.triage?.eligibility ?? null,
      verification: {
        status: rec.triage?.verification?.status ?? "not_started",
        method: rec.triage?.verification?.method ?? null,
        byName: verifiedBy,
        at: rec.triage?.verification?.at ?? null,
      },
    },
    moreInfo: rec.moreInfo ? { requestedAt: rec.moreInfo.requestedAt, dueAt: rec.moreInfo.dueAt } : null,
    referrals: (rec.referrals ?? []).map((r) => ({ id: r.id, toName: r.toName, toType: r.toType, outcome: r.outcome, at: r.at, note: summaryOnly ? null : r.note })),
    decision: rec.decision ? { kind: rec.decision.kind, reasonCode: rec.decision.reasonCode, at: rec.decision.at } : null,
    outcome: rec.outcome?.summary ?? null,
    closureReason: rec.closureReason ?? null,
    movedToSafeguarding: !!rec.linkedConcernRef,
    assignee: rec.assignedTo ? (staff.get(rec.assignedTo) ?? toStaffRef(rec.assignedTo, rec.assignedName ?? "A colleague")) : null,
    history,
    canWrite,
    edges: allowed.map((e) => e.id),
    blocked,
    people,
    attachments: rec.attachmentCount ?? 0,
    me: v.uid,
  };
  return dto;
}

/** The request's timeline: events and (opened) notes, newest first. */
export async function getSupportTimeline(ref: string): Promise<TimelineEntryDTO[]> {
  const v = await requireStaff("support.read", "support.summary", "support.manage");
  const loaded = await loadForViewer(v, ref);
  const summaryOnly = !has(v, "support.read") && !has(v, "support.manage");
  const [events, notes] = await Promise.all([listEvents(loaded.path, { limit: 100 }), summaryOnly ? Promise.resolve({ items: [], nextCursor: null }) : listNotes(loaded.path, { limit: 100 })]);
  const out: TimelineEntryDTO[] = [];
  for (const e of events.items) {
    if (e.type === "note_added") continue; // the note itself is shown instead
    const actor =
      e.actor.kind === "staff" ? toStaffRef(e.actor.uid, e.actor.name) : e.actor.kind === "system" ? { system: e.actor.job } : e.actor.kind === "stripe" ? { stripe: true as const } : { public: true as const };
    const kind = e.type === "created" ? "submitted" : e.type === "status_changed" || e.type === "reopened" ? "status" : e.type.startsWith("email") ? "email" : e.type.startsWith("referral") ? "referral" : e.type === "assigned" || e.type === "unassigned" ? "assigned" : "system";
    out.push({ id: e.id, ref: loaded.ref, at: e.at, actor, kind, text: e.summary, ...(e.from ? { from: e.from } : {}), ...(e.to ? { to: e.to } : {}) });
  }
  for (const n of notes.items) {
    if (n.deletedAt) continue;
    let text = "";
    try {
      text = openNoteBody(loaded.path, n);
    } catch (err) {
      log.warn("dal.support.note_open_failed", { ref: loaded.ref, err });
      text = "This note couldn't be opened.";
    }
    out.push({
      id: `note-${n.id}`,
      ref: loaded.ref,
      at: n.createdAt,
      actor: toStaffRef(n.authorUid, n.authorName),
      kind: "note",
      text: n.kind === "call" ? `Call: ${text}` : text,
      editableUntil: n.authorUid === v.uid ? n.editableUntil : undefined,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** One contact field in full, for someone allowed to press Show (audited as sensitive). */
export async function revealSupportContact(ref: string, field: "phone" | "email"): Promise<string | null> {
  const v = await requireStaff("support.read", "support.manage");
  if (v.roles.every((r) => r === "viewer")) return null;
  const loaded = await loadForViewer(v, ref);
  const rec = loaded.record as unknown as SupportRequest;
  const value = field === "phone" ? rec.applicant.phone : rec.applicant.email;
  if (!value) return null;
  await audit({
    actor: actorOf(v),
    action: "record.reveal",
    area: "support",
    summary: `${v.displayName.split(" ")[0]} viewed the ${field === "phone" ? "phone number" : "email address"} on ${loaded.ref}`,
    feed: false,
    sensitive: true,
    targetPath: loaded.path,
    targetRef: loaded.ref,
  });
  return value;
}

/* ── The Requests list ─────────────────────────────────────────────────── */

export type RequestsStage = "open" | S;

export type RequestRow = InboxItem & { stage: S };

/** Requests for the list: by stage (open = every open stage), mine or everyone, newest first. */
export async function listRequests(opts: { stage?: RequestsStage; who?: "mine" | "everyone"; cursor?: string | null; limit?: number } = {}): Promise<Page<RequestRow> & { counts: Partial<Record<RequestsStage, number>>; at: Millis }> {
  const v = await requireStaff("support.read", "support.summary", "support.manage");
  const stage = opts.stage ?? "open";
  const programmes = programmeFilterFor(v);
  const scope: Filter[] = programmes ? (programmes.length ? [programmes.length === 1 ? { field: "programmeId", op: "==", value: programmes[0] } : { field: "programmeId", op: "in", value: programmes }] : []) : [];
  if (programmes && !programmes.length) return { items: [], nextCursor: null, counts: {}, at: Date.now() };

  const statuses: string[] = stage === "open" ? [...OPEN_STATUSES.support] : [stage];
  const mine = opts.who === "mine";
  const where: Filter[] = mine
    ? [{ field: "assignedTo", op: "==", value: v.uid }, { field: "status", op: "in", value: statuses }]
    : programmes
      ? [scope[0]!, { field: "archived", op: "==", value: false }, statuses.length === 1 ? { field: "status", op: "==", value: statuses[0]! } : { field: "status", op: "in", value: statuses }]
      : [{ field: "archived", op: "==", value: false }, statuses.length === 1 ? { field: "status", op: "==", value: statuses[0]! } : { field: "status", op: "in", value: statuses }];

  const [page, staff, counts] = await Promise.all([
    getStore()
      .list<SupportRequest>(C.supportRequests, { where, orderBy: { field: mine ? "lastActivityAt" : "createdAt", dir: "desc" }, limit: clampLimit(opts.limit), cursor: opts.cursor ?? null })
      .catch((err) => {
        log.warn("dal.support.list_failed", { stage, err });
        return { items: [] as Array<WithId<SupportRequest>>, nextCursor: null };
      }),
    staffRefs(),
    Promise.all(
      (["new", "under_review", "more_info_required", "assigned", "referred", "approved", "support_in_progress", "completed"] as const).map(async (s) => {
        const w: Filter[] = [...scope, { field: "archived", op: "==", value: false }, { field: "status", op: "==", value: s }];
        return [s, await getStore().count(C.supportRequests, w).catch(() => 0)] as const;
      }),
    ),
  ]);
  const countMap: Partial<Record<RequestsStage, number>> = Object.fromEntries(counts);
  countMap.open = counts.filter(([s]) => s !== "completed").reduce((a, [, n]) => a + n, 0);

  const items: RequestRow[] = page.items
    .filter((r) => (mine ? scope.every((f) => f.op === "==" ? r.programmeId === f.value : (f.value as unknown[]).includes(r.programmeId)) : true))
    .map((r) => {
      const assignee = r.assignedTo ? staff.get(r.assignedTo) : undefined;
      return {
        ref: r.id,
        kind: "support",
        workflow: "support",
        title: SUPPORT_CATEGORY_LABEL[r.category] ?? "Support request",
        who: shortName(str(r.applicant?.fullName)),
        country: r.applicant?.country,
        preview: "",
        urgency: r.urgency === "high" ? "urgent" : r.urgency === "medium" ? "soon" : "normal",
        status: r.status,
        stage: r.status,
        createdAt: r.createdAt,
        lastActivityAt: r.lastActivityAt,
        unread: !(r.seenBy ?? []).includes(v.uid),
        restricted: false,
        ...(assignee ? { assignee } : {}),
      };
    });
  return { items, nextCursor: page.nextCursor, counts: countMap, at: Date.now() };
}

/** Sets eligibility and verification (admin-ux §6.4 "checked and verified"; needed before Approve). */
export async function updateSupportTriage(
  ref: string,
  input: { eligibility: "eligible" | "ineligible" | "unclear" | null; verification: "not_started" | "in_progress" | "verified" | "failed"; method: string | null; expectedVersion: number },
): Promise<ActionResult> {
  const v = await requireStaff("support.manage");
  const loaded = await loadForViewer(v, ref);
  const now = Date.now();
  try {
    let version = 0;
    await getStore().runTransaction(async (tx) => {
      const rec = await tx.get<SupportRequest>(loaded.path);
      if (!rec) throw new Error("gone");
      if (rec.version !== input.expectedVersion) throw new ConflictSignal(rec.version, rec.updatedAt);
      version = rec.version + 1;
      const verification =
        input.verification === "verified" || input.verification === "failed"
          ? { status: input.verification, method: input.method?.trim().slice(0, 200) || null, by: v.uid, at: now }
          : { status: input.verification, method: input.method?.trim().slice(0, 200) || null, by: null, at: null };
      tx.update(loaded.path, { triage: { eligibility: input.eligibility, verification }, lastActivityAt: now, updatedAt: now, version });
      addEventTx(tx, loaded.path, {
        type: "field_updated",
        actor: eventActorOf(v),
        summary: `${v.displayName.split(" ")[0]} updated the checks: ${input.eligibility ?? "eligibility not set"}, ${input.verification.replace("_", " ")}`,
        at: now,
      });
      auditTx(tx, { actor: actorOf(v), action: "record.update", area: "support", summary: `${v.displayName} updated the checks on ${loaded.ref}`, feed: true, targetPath: loaded.path, targetRef: loaded.ref });
    });
    return actionOk({ version, at: now });
  } catch (err) {
    if (err instanceof ConflictSignal) return actionError({ kind: "conflict", message: "Someone else saved changes a moment ago. Reload to see them.", current: { version: err.version, updatedBy: "", updatedAt: err.at } });
    log.warn("dal.support.triage_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

class ConflictSignal extends Error {
  constructor(
    readonly version: number,
    readonly at: Millis,
  ) {
    super("conflict");
  }
}
