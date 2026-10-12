import "server-only";

// People › Volunteers (admin-ux §6.9; PLAN D83). The board: every application not archived, by stage,
// as cards (name, flag, two interests, time in stage, the follow-up person, "3 of 5 ready"). Viewers
// with the engagement scope see the summary only (stage, interests, country; no names). The record:
// interests and skills, availability, safeguarding check, the getting-ready checklist, follow-up,
// timeline and notes. Moves go through FLOWS (volunteerMachine).

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { VolunteerApplication } from "@/lib/model/domain/engagement";
import { toStaffRef, type StaffRef, type TimelineEntryDTO } from "@/lib/model/dto";
import type { EdgeSpec } from "@/lib/model/flows";
import type { Millis, Uid } from "@/lib/model/enums";
import { HEARD_FROM_LABEL, VOLUNTEER_HOURS_LABEL, VOLUNTEER_INTEREST_LABEL } from "@/lib/model/labels";
import type { StatusOf } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { has, hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { addEventTx, eventActorOf, listEvents, listNotes, openNoteBody } from "@/lib/server/events";
import { log } from "@/lib/server/log";
import { activeStaff } from "@/lib/server/notify";
import { transitionResult } from "@/lib/server/workflow/flow";
import { ONBOARDING_DEFAULT, volunteerMachine, type PeopleInput } from "@/lib/server/workflow/volunteer";
import { loadForViewer } from "./_shared";

const DAY = 86_400_000;

/** One card on a People board (volunteers and partners). */
export type PeopleCardDTO = {
  ref: string;
  version: number;
  status: string;
  /** "Aminata S." (or the organisation); "Volunteer" for summary-only viewers. */
  title: string;
  subtitle: string | null;
  country: string;
  chips: string[];
  moreChips: number;
  daysInStage: number;
  followUp: StaffRef | null;
  ready: { done: number; total: number } | null;
};

export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : (parts[0] ?? "");
}

/** Every case of a collection that isn't archived (up to 500), newest first. */
/** Raw board records for an entry point that has already checked the viewer (it passes them in). */
export async function listBoard<T>(_v: Viewer, collection: "volunteerApplications" | "partnershipEnquiries", statuses: readonly string[]): Promise<Array<WithId<T>>> {
  const out: Array<WithId<T>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const page: { items: Array<WithId<T>>; nextCursor: string | null } = await getStore().list<T>(C[collection], {
      where: [
        { field: "archived", op: "==", value: false },
        { field: "status", op: "in", value: [...statuses] },
      ],
      orderBy: { field: "createdAt", dir: "desc" },
      limit: 100,
      cursor,
    });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

const STATUSES = ["submitted", "screening", "interview", "approved", "onboarding", "active", "inactive", "declined"] as const;

export type BoardDTO = { cards: PeopleCardDTO[]; summaryOnly: boolean; canManage: boolean; interests: Array<{ value: string; label: string }> };

export async function getVolunteerBoard(): Promise<BoardDTO> {
  const v = await requireStaff("volunteer.read", "volunteer.summary", "volunteer.manage");
  const summaryOnly = !hasAny(v, "volunteer.read", "volunteer.manage");
  const now = Date.now();
  let rows: Array<WithId<VolunteerApplication>> = [];
  try {
    rows = await listBoard<VolunteerApplication>(v, "volunteerApplications", STATUSES);
  } catch (err) {
    log.warn("dal.volunteers.board_failed", { err });
  }
  return {
    summaryOnly,
    canManage: has(v, "volunteer.manage"),
    interests: Object.entries(VOLUNTEER_INTEREST_LABEL).map(([value, label]) => ({ value, label })),
    cards: rows.map((r) => {
      const chips = (r.interests ?? []).map((i) => VOLUNTEER_INTEREST_LABEL[i] ?? i);
      const list = r.onboardingChecklist ?? [];
      return {
        ref: r.reference ?? r.id,
        version: r.version,
        status: r.status,
        title: summaryOnly ? "Volunteer" : shortName(r.applicant.fullName),
        subtitle: summaryOnly ? (r.reference ?? r.id) : null,
        country: r.applicant.country,
        chips: chips.slice(0, 2),
        moreChips: Math.max(0, chips.length - 2),
        daysInStage: Math.max(0, Math.floor((now - (r.statusChangedAt ?? r.createdAt)) / DAY)),
        followUp: r.assignedTo && r.assignedName ? toStaffRef(r.assignedTo, r.assignedName) : null,
        ready: list.length && (r.status === "onboarding" || r.status === "approved") ? { done: list.filter((s) => s.doneAt).length, total: list.length } : null,
        interests: r.interests,
      } as PeopleCardDTO & { interests: string[] };
    }),
  };
}

export type VolunteerDetailDTO = {
  ref: string;
  version: number;
  status: StatusOf<"volunteer">;
  name: string;
  email: string;
  phone: string | null;
  country: string;
  locality: string | null;
  interests: string[];
  skills: string | null;
  languages: string[];
  availability: string;
  motivation: string | null;
  workedWithChildren: string;
  backgroundCheckConsent: boolean;
  safeguardingCheck: VolunteerApplication["safeguardingCheck"];
  interview: { at: Millis | null } | null;
  heardFrom: string | null;
  consentToContact: boolean;
  checklist: Array<{ id: string; label: string; doneAt: Millis | null; doneBy: string | null }>;
  followUp: { person: StaffRef | null; at: Millis | null };
  declineReason: string | null;
  createdAt: Millis;
  edges: Array<EdgeSpec<StatusOf<"volunteer">>>;
  people: Array<{ uid: Uid; name: string }>;
  canManage: boolean;
};

async function managers(): Promise<Array<{ uid: Uid; name: string }>> {
  const staff = await activeStaff();
  return staff.filter((s) => (s.roles ?? []).some((r) => r === "programme_officer" || r === "super_admin")).map((s) => ({ uid: s.uid ?? s.id, name: s.displayName }));
}

export async function getVolunteer(ref: string): Promise<VolunteerDetailDTO> {
  const v = await requireStaff("volunteer.read", "volunteer.manage");
  const loaded = await loadForViewer(v, ref);
  const r = loaded.record as unknown as WithId<VolunteerApplication>;
  const [people, staff] = await Promise.all([managers(), activeStaff()]);
  const nameOf = (uid: Uid | null) => (uid ? (staff.find((s) => (s.uid ?? s.id) === uid)?.displayName ?? "a former team member") : null);
  const list = r.onboardingChecklist?.length ? r.onboardingChecklist : [];
  const a = r.availability;
  return {
    ref: loaded.ref,
    version: r.version,
    status: r.status,
    name: r.applicant.fullName,
    email: r.applicant.email,
    phone: r.applicant.phone,
    country: r.applicant.country,
    locality: r.applicant.locality,
    interests: (r.interests ?? []).map((i) => VOLUNTEER_INTEREST_LABEL[i] ?? i),
    skills: r.skills,
    languages: r.languages ?? [],
    availability: [a?.hoursPerWeek ? VOLUNTEER_HOURS_LABEL[a.hoursPerWeek] : null, a?.mode ? { remote: "Remote", in_person: "In person", either: "Remote or in person" }[a.mode] : null, a?.days?.length ? a.days.join(", ") : null].filter(Boolean).join(" · "),
    motivation: r.motivation,
    workedWithChildren: r.workedWithChildren ? `Yes${r.workedWithChildrenNote ? `: ${r.workedWithChildrenNote}` : ""}` : "No",
    backgroundCheckConsent: r.backgroundCheckConsent,
    safeguardingCheck: r.safeguardingCheck,
    interview: r.interview ? { at: r.interview.at } : null,
    heardFrom: r.heardFrom ? (HEARD_FROM_LABEL[r.heardFrom] ?? r.heardFrom) : null,
    consentToContact: Boolean(r.consentToContact),
    checklist: list.map((s) => ({ id: s.id, label: s.label, doneAt: s.doneAt, doneBy: nameOf(s.doneBy) })),
    followUp: { person: r.assignedTo && r.assignedName ? toStaffRef(r.assignedTo, r.assignedName) : null, at: r.followUpAt },
    declineReason: r.declineReasonCode,
    createdAt: r.createdAt,
    edges: volunteerMachine.allowedFor(r, v),
    people,
    canManage: has(v, "volunteer.manage"),
  };
}

/** Timeline: events and opened notes, newest first. */
export async function getPeopleTimeline(ref: string): Promise<TimelineEntryDTO[]> {
  const v = await requireStaff("volunteer.read", "volunteer.manage", "partnership.read", "partnership.manage");
  const loaded = await loadForViewer(v, ref);
  const [events, notes] = await Promise.all([listEvents(loaded.path, { limit: 100 }), listNotes(loaded.path, { limit: 100 })]);
  const out: TimelineEntryDTO[] = [];
  for (const e of events.items) {
    if (e.type === "note_added") continue;
    const actor = e.actor.kind === "staff" ? toStaffRef(e.actor.uid, e.actor.name) : e.actor.kind === "system" ? { system: e.actor.job } : { public: true as const };
    out.push({ id: e.id, ref: loaded.ref, at: e.at, actor, kind: e.type === "created" ? "submitted" : e.type === "status_changed" || e.type === "reopened" ? "status" : e.type === "assigned" ? "assigned" : "system", text: e.summary, ...(e.from ? { from: e.from } : {}), ...(e.to ? { to: e.to } : {}) } as TimelineEntryDTO);
  }
  for (const n of notes.items) {
    if (n.deletedAt) continue;
    let text = "";
    try {
      text = openNoteBody(loaded.path, n);
    } catch {
      text = "This note couldn't be opened.";
    }
    out.push({ id: `note-${n.id}`, ref: loaded.ref, at: n.createdAt, actor: toStaffRef(n.authorUid, n.authorName), kind: "note", text: n.kind === "call" ? `Call: ${text}` : text, editableUntil: n.authorUid === v.uid ? n.editableUntil : undefined });
  }
  return out.sort((a, b) => b.at - a.at);
}

export async function moveVolunteer(ref: string, edgeId: string, expectedVersion: number, input: PeopleInput = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("volunteer.manage");
  const clean: PeopleInput = {
    ...(typeof input.reason === "string" ? { reason: input.reason.slice(0, 500) } : {}),
    ...(typeof input.interviewAt === "number" ? { interviewAt: input.interviewAt } : {}),
  };
  return (await transitionResult(() => volunteerMachine.transition({ ref, edgeId, actor: v, expectedVersion, input: clean }))) as ActionResult<{ version: number; at: Millis; status: string }>;
}

/** Writes a small change to a volunteer record with a version check, a timeline line and audit. */
async function patchVolunteer(v: Viewer, ref: string, expectedVersion: number, build: (r: WithId<VolunteerApplication>, now: Millis) => { patch: Record<string, unknown>; summary: string } | string): Promise<ActionResult<{ version: number }>> {
  const loaded = await loadForViewer(v, ref);
  try {
    const out = await getStore().runTransaction(async (tx) => {
      const r = await tx.get<VolunteerApplication>(loaded.path);
      if (!r) return { error: "This application no longer exists." };
      if (r.version !== expectedVersion) return { conflict: { version: r.version, updatedAt: r.updatedAt } };
      const now = Date.now();
      const b = build({ ...r, id: loaded.ref }, now);
      if (typeof b === "string") return { error: b };
      const version = r.version + 1;
      tx.update(loaded.path, { ...b.patch, version, updatedAt: now, lastActivityAt: now });
      addEventTx(tx, loaded.path, { type: "field_updated", actor: eventActorOf(v), summary: b.summary, at: now });
      auditTx(tx, { actor: actorOf(v), action: "record.update", area: "engagement", summary: b.summary, targetRef: loaded.ref });
      return { version };
    });
    if ("conflict" in out && out.conflict) return actionError({ kind: "conflict", message: "Someone else changed this. Reload to see their changes.", current: { version: out.conflict.version, updatedBy: "", updatedAt: out.conflict.updatedAt } });
    if ("error" in out && out.error) return actionError({ kind: "not_allowed", message: out.error });
    return actionOk({ version: (out as { version: number }).version });
  } catch (err) {
    log.error("dal.volunteers.patch_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

const first = (n: string) => n.split(" ")[0] ?? n;

/** Ticks or unticks one getting-ready step (the default checklist is created on first use). */
export async function toggleChecklist(ref: string, expectedVersion: number, stepId: string, done: boolean): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("volunteer.manage");
  return patchVolunteer(v, ref, expectedVersion, (r, now) => {
    const list = r.onboardingChecklist?.length ? r.onboardingChecklist : ONBOARDING_DEFAULT.map((s) => ({ ...s, doneAt: null, doneBy: null }));
    const step = list.find((s) => s.id === stepId);
    if (!step) return "That step isn't on the checklist.";
    const next = list.map((s) => (s.id === stepId ? { ...s, doneAt: done ? now : null, doneBy: done ? v.uid : null } : s));
    return { patch: { onboardingChecklist: next }, summary: `${first(v.displayName)} ${done ? "ticked" : "unticked"} “${step.label}”` };
  });
}

/** Who follows up, and when (the date shows on their Today). */
export async function setVolunteerFollowUp(ref: string, expectedVersion: number, uid: Uid | null, at: Millis | null): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("volunteer.manage");
  const people = await managers();
  const person = uid ? people.find((p) => p.uid === uid) : null;
  if (uid && !person) return actionError({ kind: "validation", fields: { followUp: "Choose someone from the team." } });
  return patchVolunteer(v, ref, expectedVersion, (_r, now) => ({
    patch: { assignedTo: person?.uid ?? null, assignedName: person?.name ?? null, assignedAt: person ? now : null, followUpAt: at },
    summary: person ? `${first(v.displayName)} asked ${first(person.name)} to follow up${at ? " by a date" : ""}` : `${first(v.displayName)} cleared the follow-up`,
  }));
}

/** Records the outcome of the safeguarding check (never the documents). */
export async function setSafeguardingCheck(ref: string, expectedVersion: number, status: "not_required" | "pending" | "cleared" | "not_cleared"): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("volunteer.manage");
  if (!["not_required", "pending", "cleared", "not_cleared"].includes(status)) return actionError({ kind: "validation", fields: { check: "Choose an outcome." } });
  const words = { not_required: "not needed", pending: "waiting", cleared: "cleared", not_cleared: "not cleared" }[status];
  return patchVolunteer(v, ref, expectedVersion, (_r, now) => ({ patch: { safeguardingCheck: { status, at: now, by: v.uid } }, summary: `${first(v.displayName)} recorded the safeguarding check as ${words}` }));
}
