import "server-only";

// Counselling (admin-ux §6.7; PLAN D77; integrations §6.3–6.4). Programme officers and super admins
// see every session and the "Waiting for a time" list; counsellors see only their own sessions (other
// sessions are NoAccess). Clients appear as a first name and a reference. The client's email never
// reaches a counsellor; a phone number for a call shows from 24 h before to 24 h after the start.
// Follow-up notes are sealed and readable only by their author counsellor, safeguarding officers and
// super admins (admin-ux §5.1 matrix).

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { Appointment } from "@/lib/model/domain/appointment";
import type { SupportRequest } from "@/lib/model/domain/support";
import { toStaffRef, type StaffRef } from "@/lib/model/dto";
import type { EdgeSpec } from "@/lib/model/flows";
import type { Millis, Uid } from "@/lib/model/enums";
import type { StatusOf } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, audit, auditTx } from "@/lib/server/audit";
import { canSeeCallPhone, has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { cancelEmails, drainAfterResponse } from "@/lib/server/email/outbox";
import { addEventTx, addNoteTx, eventActorOf, listEvents, listNotes, openNoteBody } from "@/lib/server/events";
import { caseBase } from "@/lib/server/intake/caseBase";
import { log } from "@/lib/server/log";
import { activeStaff } from "@/lib/server/notify";
import { createWithReference } from "@/lib/server/references";
import { appointmentMachine, DURATIONS, firstNameOf, queueSessionEmails, sessionEmailIds, type AppointmentInput } from "@/lib/server/workflow/appointment";
import { transitionResult } from "@/lib/server/workflow/flow";
import { createZoomMeeting, hostStartUrl, moveZoomMeeting, removeZoomMeeting, zoomApiOn } from "@/lib/server/zoom/meetings";
import { loadForViewer } from "./_shared";

const DAY = 86_400_000;
const NOTE_MAX = 1000;
export const ZOOM_RE = /^https:\/\/([a-z0-9-]+\.)?zoom\.us\/(j|my|w)\/[A-Za-z0-9?=&._-]+$/i;

/* ── Time helpers (staff timezone) ─────────────────────────────────────── */

/** Minutes east of UTC for `tz` at `ms`. */
function offsetMin(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((wall - ms) / 60_000);
}

/** The instant of local midnight on `ymd` in `tz`. */
export function zonedMidnight(ymd: string, tz: string): number {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  return guess - offsetMin(guess - offsetMin(guess, tz) * 60_000, tz) * 60_000;
}

/** "2026-10-09" for `ms` in `tz`. */
export function ymdIn(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

/** A wall-clock date and time ("2026-10-09", "10:00") in `tz` as an instant. */
export function zonedTime(ymd: string, hm: string, tz: string): number {
  const [h, min] = hm.split(":").map(Number) as [number, number];
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, h, min);
  return guess - offsetMin(guess - offsetMin(guess, tz) * 60_000, tz) * 60_000;
}

function safeTz(tz: string | null | undefined, fallback = "Africa/Banjul"): string {
  if (!tz) return fallback;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

/* ── Agenda ─────────────────────────────────────────────────────────────── */

export type SessionCardDTO = {
  ref: string;
  version: number;
  status: StatusOf<"appointment">;
  startsAt: Millis;
  durationMin: number;
  firstName: string;
  sessionNumber: number;
  counsellor: StaffRef;
  mode: Appointment["mode"];
  zoomReady: boolean;
  confirmed: boolean;
  clientTimezone: string;
  /** The join link, on the day, for the counsellor and managers. */
  joinUrl: string | null;
};

export type WaitingDTO = {
  ref: string;
  firstName: string;
  sinceDays: number;
  language: string;
  format: string;
  preferences: string;
  timezone: string | null;
  forWhom: string;
};

export type CounsellorOption = { uid: Uid; name: string; thisWeek: number };

export type AgendaDTO = {
  tz: string;
  today: string;
  day: string;
  week: Array<{ ymd: string; label: string; weekday: string; count: number }>;
  sessions: SessionCardDTO[];
  attendanceDue: SessionCardDTO[];
  /** null for counsellors (they don't book). */
  waiting: WaitingDTO[] | null;
  counsellors: CounsellorOption[] | null;
  counsellor: Uid | null;
  ownOnly: boolean;
};

function toCard(a: WithId<Appointment>, v: Viewer, now: number): SessionCardDTO {
  const onDay = Math.abs(a.startsAt - now) < DAY;
  return {
    ref: a.reference ?? a.id,
    version: a.version,
    status: a.status,
    startsAt: a.startsAt,
    durationMin: a.durationMin,
    firstName: firstNameOf(a.clientSnapshot?.displayName ?? "") || "Client",
    sessionNumber: a.sessionNumber,
    counsellor: toStaffRef(a.counsellorUid, a.counsellorName),
    mode: a.mode,
    zoomReady: Boolean(a.zoom?.joinUrl),
    confirmed: Boolean(a.reminders?.confirmationQueuedAt),
    clientTimezone: a.clientTimezone,
    joinUrl: onDay && a.zoom?.joinUrl && (has(v, "appointment.manage") || a.counsellorUid === v.uid) ? a.zoom.joinUrl : null,
  };
}

async function listRange(where: Array<{ field: string; op: "==" | ">=" | "<" | "in"; value: unknown }>, limit = 100): Promise<Array<WithId<Appointment>>> {
  const page = await getStore().list<Appointment>(C.appointments, { where: where as never, orderBy: { field: "startsAt", dir: "asc" }, limit });
  return page.items;
}

/** The week strip, the chosen day's sessions, attendance still to record and (for managers) the waiting list. */
export async function getAgenda(opts: { day?: string | null; counsellor?: string | null } = {}): Promise<AgendaDTO> {
  const v = await requireStaff("appointment.manage", "appointment.own");
  const manage = has(v, "appointment.manage");
  const tz = safeTz(v.timezone);
  const now = Date.now();
  const today = ymdIn(now, tz);
  const day = opts.day && /^\d{4}-\d{2}-\d{2}$/.test(opts.day) ? opts.day : today;
  // Monday of the chosen day's week.
  const dayStart = zonedMidnight(day, tz);
  const dow = (new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))).getUTCDay() + 6) % 7;
  const monday = ymdIn(dayStart - dow * DAY + 12 * 3_600_000, tz);
  const weekStart = zonedMidnight(monday, tz);
  const weekEnd = weekStart + 7 * DAY + 2 * 3_600_000;
  const who = manage ? (opts.counsellor && /^[A-Za-z0-9_-]{1,128}$/.test(opts.counsellor) ? opts.counsellor : null) : v.uid;

  const range = [
    ...(who ? [{ field: "counsellorUid", op: "==" as const, value: who }] : []),
    { field: "startsAt", op: ">=" as const, value: weekStart },
    { field: "startsAt", op: "<" as const, value: weekEnd },
  ];
  const due = [
    ...(who ? [{ field: "counsellorUid", op: "==" as const, value: who }] : []),
    { field: "status", op: "==" as const, value: "scheduled" },
    { field: "startsAt", op: "<" as const, value: now },
  ];
  const [weekItems, dueItems, waiting, staff] = await Promise.all([
    listRange(range).catch((err) => {
      log.warn("dal.appointments.week_failed", { err });
      return [] as Array<WithId<Appointment>>;
    }),
    listRange(due, 50).catch(() => [] as Array<WithId<Appointment>>),
    manage ? waitingList(now) : Promise.resolve(null),
    manage ? activeStaff() : Promise.resolve(null),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const ymd = ymdIn(weekStart + i * DAY + 12 * 3_600_000, tz);
    const start = zonedMidnight(ymd, tz);
    const noon = start + 12 * 3_600_000;
    return {
      ymd,
      label: new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(noon),
      weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(noon),
      count: weekItems.filter((a) => a.status !== "cancelled" && ymdIn(a.startsAt, tz) === ymd).length,
    };
  });

  const counsellors = staff
    ? staff
        .filter((s) => (s.roles ?? []).includes("counsellor"))
        .map((s) => ({ uid: s.uid ?? s.id, name: s.displayName, thisWeek: weekItems.filter((a) => a.counsellorUid === (s.uid ?? s.id) && a.status === "scheduled").length }))
    : null;

  return {
    tz,
    today,
    day,
    week: days,
    sessions: weekItems.filter((a) => ymdIn(a.startsAt, tz) === day).map((a) => toCard(a, v, now)),
    attendanceDue: dueItems.filter((a) => a.startsAt + a.durationMin * 60_000 <= now).map((a) => toCard(a, v, now)),
    waiting,
    counsellors,
    counsellor: manage ? who : null,
    ownOnly: !manage,
  };
}

const PERIOD: Record<string, string> = { morning: "mornings", afternoon: "afternoons", evening: "evenings" };

/** Counselling requests approved or in progress with no session booked ahead (D77). */
async function waitingList(now: number): Promise<WaitingDTO[]> {
  try {
    const [srs, upcoming] = await Promise.all([
      getStore().list<SupportRequest>(C.supportRequests, {
        where: [
          { field: "category", op: "==", value: "counselling" },
          { field: "status", op: "in", value: ["approved", "support_in_progress"] },
        ],
        orderBy: { field: "createdAt", dir: "desc" },
        limit: 100,
      }),
      getStore().list<Appointment>(C.appointments, { where: [{ field: "status", op: "==", value: "scheduled" }], orderBy: { field: "startsAt", dir: "asc" }, limit: 100 }),
    ]);
    const booked = new Set(upcoming.items.map((a) => a.supportRef));
    return srs.items
      .filter((s) => !booked.has(s.reference ?? s.id) && !s.archived)
      .map((s) => {
        const c = s.counselling;
        const prefs = [
          c?.preferredDays?.length ? c.preferredDays.map((d) => d.slice(0, 1).toUpperCase() + d.slice(1, 3)).join(", ") : null,
          c?.preferredPeriods?.length ? `prefers ${c.preferredPeriods.map((p) => PERIOD[p] ?? p).join(" or ")}` : null,
        ].filter(Boolean);
        return {
          ref: s.reference ?? s.id,
          firstName: firstNameOf(s.applicant?.fullName ?? "") || "Client",
          sinceDays: Math.max(0, Math.floor((now - (s.statusChangedAt ?? s.createdAt)) / DAY)),
          language: c?.language ?? "",
          format: c?.format === "phone" ? "Phone" : c?.format === "video" ? "Video" : "Video or phone",
          preferences: prefs.join(" · ") || "No preference given",
          timezone: c?.timezone ?? null,
          forWhom: c?.forWhom === "child" ? "For a child" : c?.forWhom === "family" ? "For a family" : "For a parent or carer",
        };
      });
  } catch (err) {
    log.warn("dal.appointments.waiting_failed", { err });
    return [];
  }
}

/* ── One session ───────────────────────────────────────────────────────── */

export type SessionDTO = {
  ref: string;
  version: number;
  status: StatusOf<"appointment">;
  startsAt: Millis;
  durationMin: number;
  staffTimezone: string;
  clientTimezone: string;
  mode: Appointment["mode"];
  joinUrl: string | null;
  /** The meeting was made through the Zoom API (it moves and is deleted with the session). */
  zoomFromApi: boolean;
  /** This person is the session's counsellor ("Start as host"). */
  isMine: boolean;
  sessionNumber: number;
  client: { firstName: string; forWhom: string; ageBand: string; language: string; reasonSummary: string; hasEmail: boolean; phoneForCall: string | null };
  /** Only for people who manage counselling. */
  supportRef: string | null;
  counsellor: StaffRef;
  attendance: Appointment["attendance"];
  followUp: Appointment["followUp"];
  cancelReason: string | null;
  confirmedAt: Millis | null;
  reminders: Appointment["reminders"];
  edges: Array<EdgeSpec<StatusOf<"appointment">>>;
  /** null when this person may not read follow-up notes. */
  notes: Array<{ id: string; at: Millis; author: StaffRef; text: string }> | null;
  canNote: boolean;
  canManage: boolean;
  counsellors: CounsellorOption[] | null;
  timeline: Array<{ id: string; at: Millis; text: string }>;
};

/** Follow-up notes: their author counsellor, safeguarding officers and super admins. */
function canReadNotes(v: Viewer, a: Appointment): boolean {
  return v.roles.includes("super_admin") || v.roles.includes("safeguarding_officer") || (v.roles.includes("counsellor") && a.counsellorUid === v.uid);
}

async function loadSession(v: Viewer, ref: string) {
  const loaded = await loadForViewer(v, ref);
  if (loaded.collection !== "appointments") throw new Error("not an appointment");
  return { loaded, a: loaded.record as unknown as WithId<Appointment> };
}

export async function getSession(ref: string): Promise<SessionDTO> {
  const v = await requireStaff("appointment.manage", "appointment.own", "concern.read");
  const { loaded, a } = await loadSession(v, ref);
  const now = Date.now();
  const manage = has(v, "appointment.manage");
  const notesAllowed = canReadNotes(v, a);
  const [notes, events, staff] = await Promise.all([
    notesAllowed ? listNotes(loaded.path, { limit: 50 }) : Promise.resolve(null),
    listEvents(loaded.path, { limit: 50 }),
    manage ? activeStaff() : Promise.resolve(null),
  ]);
  void audit({ actor: actorOf(v), action: "record.view", area: "counselling", summary: `${v.displayName} opened ${loaded.ref}`, targetRef: loaded.ref, sensitive: notesAllowed });
  const openedNotes = notes
    ? notes.items
        .filter((n) => !n.deletedAt)
        .map((n) => {
          let text = "";
          try {
            text = openNoteBody(loaded.path, n);
          } catch {
            text = "This note couldn't be opened.";
          }
          return { id: n.id, at: n.createdAt, author: toStaffRef(n.authorUid, n.authorName), text };
        })
    : null;
  const isMine = a.counsellorUid === v.uid;
  return {
    ref: loaded.ref,
    version: a.version,
    status: a.status,
    startsAt: a.startsAt,
    durationMin: a.durationMin,
    staffTimezone: safeTz(v.timezone),
    clientTimezone: safeTz(a.clientTimezone),
    mode: a.mode,
    joinUrl: a.zoom?.joinUrl ?? null,
    zoomFromApi: a.zoom?.source === "zoom_api",
    isMine,
    sessionNumber: a.sessionNumber,
    client: {
      firstName: firstNameOf(a.clientSnapshot.displayName) || "Client",
      forWhom: a.clientSnapshot.forWhom === "child" ? "A child" : a.clientSnapshot.forWhom === "family" ? "A family" : "A parent or carer",
      ageBand: a.clientSnapshot.ageBand,
      language: a.clientSnapshot.language,
      reasonSummary: a.clientSnapshot.reasonSummary,
      hasEmail: Boolean(a.clientSnapshot.contactEmail),
      phoneForCall: a.mode === "phone" && a.clientSnapshot.phoneForCall && canSeeCallPhone(v, a, now) ? a.clientSnapshot.phoneForCall : null,
    },
    supportRef: manage ? a.supportRef : null,
    counsellor: toStaffRef(a.counsellorUid, a.counsellorName),
    attendance: a.attendance,
    followUp: a.followUp,
    cancelReason: a.cancelReason,
    confirmedAt: a.reminders?.confirmationQueuedAt ?? null,
    reminders: a.reminders,
    edges: appointmentMachine.allowedFor(a, v, { isAssignedCounsellor: isMine }),
    notes: openedNotes,
    canNote: v.roles.includes("super_admin") || (v.roles.includes("counsellor") && isMine),
    canManage: manage,
    counsellors: staff
      ? staff.filter((s) => (s.roles ?? []).includes("counsellor")).map((s) => ({ uid: s.uid ?? s.id, name: s.displayName, thisWeek: 0 }))
      : null,
    timeline: events.items.filter((e) => e.type !== "note_added").map((e) => ({ id: e.id, at: e.at, text: e.summary })),
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export type BookSessionInput = {
  supportRef: string;
  counsellorUid: string;
  /** "2026-10-09" and "10:00" in the booker's timezone. */
  date: string;
  time: string;
  durationMin: number;
  mode: Appointment["mode"];
  zoomUrl?: string | null;
  clientTimezone?: string | null;
  /** ≤ 300, non-identifying. */
  reasonSummary?: string | null;
};

function badZoom(url: string | null | undefined): string | null {
  if (!url) return null;
  return ZOOM_RE.test(url.trim()) ? null : "Paste the meeting link from Zoom: it starts with https:// and has zoom.us/j/ in it.";
}

/** Books a session for a counselling request (programme officers and super admins). */
export async function bookSession(input: BookSessionInput): Promise<ActionResult<{ ref: string }>> {
  const v = await requireStaff("appointment.manage");
  const f: Record<string, string> = {};
  if (!/^HVN-SR-\d{4}-\d{4,}$/.test(input.supportRef)) f.supportRef = "Choose the request this session is for.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) f.date = "Choose a date.";
  if (!/^\d{2}:\d{2}$/.test(input.time)) f.time = "Choose a time.";
  if (!(DURATIONS as readonly number[]).includes(input.durationMin)) f.durationMin = "Choose how long.";
  if (!["zoom", "phone", "in_person"].includes(input.mode)) f.mode = "Choose how you'll meet.";
  const zoomErr = badZoom(input.zoomUrl);
  if (zoomErr) f.zoomUrl = zoomErr;
  const reason = (input.reasonSummary ?? "").trim();
  if (reason.length > 300) f.reasonSummary = "Please keep this to 300 characters.";
  if (Object.keys(f).length) return actionError({ kind: "validation", fields: f });

  const tz = safeTz(v.timezone);
  const startsAt = zonedTime(input.date, input.time, tz);
  if (startsAt < Date.now() - 5 * 60_000) return actionError({ kind: "validation", fields: { date: "That time has already passed." } });

  const [sr, staff] = await Promise.all([getStore().get<SupportRequest>(docPath("supportRequests", input.supportRef)), activeStaff()]);
  if (!sr || sr.category !== "counselling") return actionError({ kind: "validation", fields: { supportRef: "That isn't a counselling request." } });
  if (!["approved", "support_in_progress"].includes(sr.status)) return actionError({ kind: "not_allowed", message: "Approve the request first, then book a session." });
  const counsellor = staff.find((s) => (s.uid ?? s.id) === input.counsellorUid && (s.roles ?? []).includes("counsellor"));
  if (!counsellor) return actionError({ kind: "validation", fields: { counsellorUid: "Choose a counsellor." } });

  const prior = await getStore()
    .list<Appointment>(C.appointments, { where: [{ field: "supportRef", op: "==", value: input.supportRef }], orderBy: { field: "startsAt", dir: "asc" }, limit: 100 })
    .catch(() => ({ items: [] as Array<WithId<Appointment>>, nextCursor: null }));
  const c = sr.counselling;
  const cuid = counsellor.uid ?? counsellor.id;
  const now = Date.now();
  try {
    const ref = await createWithReference<Appointment>(
      "appointments",
      (reference, at) => ({
        ...caseBase(reference, "scheduled", at, "appointment", { extra: [input.supportRef.toLowerCase()] }),
        source: "staff_entry",
        assignedTo: cuid,
        assignedName: counsellor.displayName,
        assignedAt: at,
        supportRef: input.supportRef,
        counsellorUid: cuid,
        counsellorName: counsellor.displayName,
        sessionNumber: prior.items.length + 1,
        startsAt,
        durationMin: input.durationMin as Appointment["durationMin"],
        clientTimezone: safeTz(input.clientTimezone || c?.timezone, "Africa/Banjul"),
        mode: input.mode,
        zoom: input.zoomUrl ? { joinUrl: input.zoomUrl.trim(), meetingId: null, passcode: null, source: "manual" } : null,
        clientSnapshot: {
          displayName: firstNameOf(sr.applicant.fullName) || "Client",
          forWhom: c?.forWhom ?? "parent_or_caregiver",
          ageBand: c?.ageBand ?? sr.child?.ageBand ?? "unknown",
          language: c?.language ?? "",
          contactEmail: sr.applicant.email,
          phoneForCall: input.mode === "phone" ? sr.applicant.phone : null,
          reasonSummary: reason || "Counselling support.",
        },
        attendance: null,
        reminders: { confirmationQueuedAt: null, reminder24hQueuedAt: null, reminder1hQueuedAt: null },
        followUp: null,
        cancelReason: null,
        icsSequence: 0,
      }),
      (tx, reference, at) => {
        const path = docPath("appointments", reference);
        addEventTx(tx, path, { type: "created", actor: eventActorOf(v), summary: `${firstNameOf(v.displayName)} booked session ${prior.items.length + 1} with ${firstNameOf(counsellor.displayName)}`, at });
        addEventTx(tx, docPath("supportRequests", input.supportRef), { type: "field_updated", actor: eventActorOf(v), summary: `${firstNameOf(v.displayName)} booked a counselling session (${reference})`, at });
        tx.update(docPath("supportRequests", input.supportRef), { lastActivityAt: at, updatedAt: at });
        auditTx(tx, { actor: actorOf(v), action: "appointment.create", area: "counselling", summary: `${v.displayName} booked ${reference}`, feed: true, targetRef: reference });
      },
    );
    void now;
    return actionOk({ ref });
  } catch (err) {
    log.error("dal.appointments.book_failed", { err });
    return actionError({ kind: "unavailable", message: "The session wasn't booked. Please try again." });
  }
}

async function writeSession(
  ref: string,
  expectedVersion: number,
  fn: (a: WithId<Appointment>, v: Viewer, now: number, tx: Parameters<Parameters<ReturnType<typeof getStore>["runTransaction"]>[0]>[0], path: string) => Promise<{ patch: Record<string, unknown>; summary: string } | string>,
  perms: Array<"appointment.manage" | "appointment.own"> = ["appointment.manage"],
): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff(...perms);
  let loaded;
  try {
    loaded = await loadSession(v, ref);
  } catch {
    return actionError({ kind: "not_allowed", message: "This session isn't open to you." });
  }
  const path = loaded.loaded.path;
  try {
    const out = await getStore().runTransaction(async (tx) => {
      const a = await tx.get<Appointment>(path);
      if (!a) return { error: actionError<{ version: number }>({ kind: "not_allowed", message: "This session no longer exists." }) };
      if (a.version !== expectedVersion) return { error: actionError<{ version: number }>({ kind: "conflict", message: "Someone else changed this session. Reload to see their changes.", current: { version: a.version, updatedBy: "", updatedAt: a.updatedAt } }) };
      const now = Date.now();
      const r = await fn({ ...a, id: loaded.a.id }, v, now, tx, path);
      if (typeof r === "string") return { error: actionError<{ version: number }>({ kind: "not_allowed", message: r }) };
      const version = a.version + 1;
      tx.update(path, { ...r.patch, version, updatedAt: now, lastActivityAt: now });
      addEventTx(tx, path, { type: r.patch.reminders ? "email_queued" : "field_updated", actor: eventActorOf(v), summary: r.summary, at: now });
      auditTx(tx, { actor: actorOf(v), action: "appointment.update", area: "counselling", summary: r.summary, targetRef: a.reference });
      return { version };
    });
    if (out.error) return out.error;
    return actionOk({ version: out.version! });
  } catch (err) {
    log.error("dal.appointments.write_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

/** Adds or changes the Zoom link (validated against https://…zoom.us/j/…). */
export async function setZoomLink(ref: string, expectedVersion: number, url: string): Promise<ActionResult<{ version: number }>> {
  const err = badZoom(url.trim()) ?? (url.trim() ? null : "Paste the meeting link from Zoom.");
  if (err) return actionError({ kind: "validation", fields: { zoomUrl: err } });
  return writeSession(ref, expectedVersion, async (a, v) => {
    if (a.status !== "scheduled") return "Only upcoming sessions can change their link.";
    return { patch: { zoom: { joinUrl: url.trim(), meetingId: null, passcode: null, source: "manual" } }, summary: `${firstNameOf(v.displayName)} added the Zoom link` };
  });
}

/** Changes the counsellor (programme officers and super admins). */
export async function reassignSession(ref: string, expectedVersion: number, counsellorUid: string): Promise<ActionResult<{ version: number }>> {
  const staff = await activeStaff();
  const c = staff.find((s) => (s.uid ?? s.id) === counsellorUid && (s.roles ?? []).includes("counsellor"));
  if (!c) return actionError({ kind: "validation", fields: { counsellorUid: "Choose a counsellor." } });
  return writeSession(ref, expectedVersion, async (a, v, now) => {
    if (a.status !== "scheduled") return "Only upcoming sessions can change counsellor.";
    const uid = c.uid ?? c.id;
    return { patch: { counsellorUid: uid, counsellorName: c.displayName, assignedTo: uid, assignedName: c.displayName, assignedAt: now }, summary: `${firstNameOf(v.displayName)} gave the session to ${firstNameOf(c.displayName)}` };
  });
}

/** "Send the invitation": the confirmation with an .ics, and reminders 24 h and 1 h before. */
export async function sendInvitation(ref: string, expectedVersion: number): Promise<ActionResult<{ version: number }>> {
  const r = await writeSession(ref, expectedVersion, async (a, v, now, tx, path) => {
    if (a.status !== "scheduled") return "Only upcoming sessions can be sent.";
    if (a.startsAt <= now) return "This session's time has passed. Choose a new time first.";
    if (a.mode === "zoom" && !a.zoom?.joinUrl) return "Add the Zoom link first, so the invitation has it.";
    if (!a.clientSnapshot.contactEmail) return "There's no email address for this client. Let them know the time another way.";
    if (a.reminders?.confirmationQueuedAt) return "The invitation has already gone. Change the time to send a new one.";
    const reminders = await queueSessionEmails(tx, a, path, now);
    return { patch: { reminders }, summary: `${firstNameOf(v.displayName)} sent the invitation and set reminders` };
  });
  if (r.ok) drainAfterResponse();
  return r;
}

/** Moves a session along FLOWS (reschedule, attendance, cancel). Old reminders are cancelled after the commit. */
export async function moveSession(ref: string, edgeId: string, expectedVersion: number, input: AppointmentInput & { date?: string; time?: string } = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("appointment.manage", "appointment.own");
  let loaded;
  try {
    loaded = await loadSession(v, ref);
  } catch {
    return actionError({ kind: "not_allowed", message: "This session isn't open to you." });
  }
  const a = loaded.a;
  const next: AppointmentInput = { ...input };
  if (edgeId === "reschedule") {
    if (!input.date || !input.time || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
      return actionError({ kind: "validation", fields: { date: "Choose the new date and time." } });
    }
    next.startsAt = zonedTime(input.date, input.time, safeTz(v.timezone));
  }
  delete (next as Record<string, unknown>).date;
  delete (next as Record<string, unknown>).time;
  const r = await transitionResult(() =>
    appointmentMachine.transition({ ref: loaded.loaded.ref, edgeId, actor: v, expectedVersion, input: next, isAssignedCounsellor: a.counsellorUid === v.uid }),
  );
  if (r.ok && ["reschedule", "cancel", "client_cancelled"].includes(edgeId) && a.reminders?.confirmationQueuedAt) {
    // The previous invitation's reminders must not go out.
    const ids = sessionEmailIds(a.reference, a.icsSequence ?? 0).slice(1);
    await cancelEmails(ids).catch((err) => log.error("dal.appointments.cancel_reminders_failed", { ref, err }));
  }
  if (r.ok && a.zoom?.source === "zoom_api" && a.zoom.meetingId) {
    if (edgeId === "reschedule" && next.startsAt) await moveZoomMeeting(a.zoom.meetingId, next.startsAt, Number(next.durationMin) || a.durationMin);
    if (edgeId === "cancel" || edgeId === "client_cancelled") await removeZoomMeeting(a.zoom.meetingId);
  }
  if (r.ok) drainAfterResponse();
  return r as ActionResult<{ version: number; at: Millis; status: string }>;
}

/**
 * "Make a Zoom meeting" (integrations §6.2): a neutral meeting on Haven's Zoom account, saved as the
 * session's link. If saving fails, the new meeting is deleted again.
 */
export async function createZoomForSession(ref: string, expectedVersion: number): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("appointment.manage", "appointment.own");
  if (!zoomApiOn()) return actionError({ kind: "not_allowed", message: "Zoom isn't connected. Paste a link from Zoom instead." });
  let loaded;
  try {
    loaded = await loadSession(v, ref);
  } catch {
    return actionError({ kind: "not_allowed", message: "This session isn't open to you." });
  }
  const a = loaded.a;
  if (a.status !== "scheduled" || a.mode !== "zoom") return actionError({ kind: "not_allowed", message: "Only upcoming Zoom sessions can have a meeting made." });
  let meeting: { joinUrl: string; meetingId: string; passcode: string | null } | null = null;
  try {
    meeting = await createZoomMeeting({ reference: a.reference, startsAt: a.startsAt, durationMin: a.durationMin, timezone: a.clientTimezone });
  } catch (err) {
    log.warn("zoom.create_failed", { ref, err });
  }
  if (!meeting) return actionError({ kind: "unavailable", message: "Zoom couldn't make the meeting just now. Paste a link from Zoom instead." });
  const made = meeting;
  const r = await writeSession(
    ref,
    expectedVersion,
    async (x, viewer) => {
      if (x.status !== "scheduled") return "Only upcoming sessions can change their link.";
      return { patch: { zoom: { joinUrl: made.joinUrl, meetingId: made.meetingId, passcode: made.passcode, source: "zoom_api" } }, summary: `${firstNameOf(viewer.displayName)} made a Zoom meeting` };
    },
    ["appointment.manage", "appointment.own"],
  );
  if (!r.ok) await removeZoomMeeting(made.meetingId);
  return r;
}

/** A fresh host start link for the session's own counsellor (never stored or emailed). */
export async function hostStartLink(ref: string): Promise<string | null> {
  const v = await requireStaff("appointment.manage", "appointment.own");
  let loaded;
  try {
    loaded = await loadSession(v, ref);
  } catch {
    return null;
  }
  const a = loaded.a;
  if (a.counsellorUid !== v.uid || a.zoom?.source !== "zoom_api" || !a.zoom.meetingId) return null;
  return hostStartUrl(a.zoom.meetingId);
}

/** A short follow-up note (≤ 1,000), sealed: the session's counsellor or a super admin. */
export async function addSessionNote(ref: string, text: string): Promise<ActionResult<{ version: number }>> {
  const body = text.trim();
  if (!body) return actionError({ kind: "validation", fields: { note: "Write something first." } });
  if (body.length > NOTE_MAX) return actionError({ kind: "validation", fields: { note: `Notes can be at most ${NOTE_MAX.toLocaleString("en")} characters.` } });
  const v = await requireStaff("appointment.manage", "appointment.own");
  let loaded;
  try {
    loaded = await loadSession(v, ref);
  } catch {
    return actionError({ kind: "not_allowed", message: "This session isn't open to you." });
  }
  const canWrite = v.roles.includes("super_admin") || (v.roles.includes("counsellor") && loaded.a.counsellorUid === v.uid);
  if (!canWrite) return actionError({ kind: "forbidden", message: "Follow-up notes are written by the session's counsellor." });
  try {
    let version = 0;
    await getStore().runTransaction(async (tx) => {
      const a = await tx.get<Appointment>(loaded.loaded.path);
      if (!a) throw new Error("gone");
      version = a.version + 1;
      addNoteTx(tx, loaded.loaded.path, { kind: "note", body, author: { uid: v.uid, name: v.displayName }, maxLength: NOTE_MAX });
      tx.update(loaded.loaded.path, { version, updatedAt: Date.now(), lastActivityAt: Date.now() });
    });
    return actionOk({ version });
  } catch (err) {
    log.warn("dal.appointments.note_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "Your note didn't save. It's still in the box, so please try again." });
  }
}

/** For the booking sheet: counselling requests waiting for a time and the counsellors. */
export async function bookingOptions(): Promise<{ requests: WaitingDTO[]; counsellors: CounsellorOption[]; tz: string }> {
  const v = await requireStaff("appointment.manage");
  const [requests, staff] = await Promise.all([waitingList(Date.now()), activeStaff()]);
  return {
    requests,
    counsellors: staff.filter((s) => (s.roles ?? []).includes("counsellor")).map((s) => ({ uid: s.uid ?? s.id, name: s.displayName, thisWeek: 0 })),
    tz: safeTz(v.timezone),
  };
}

export type NoteTargetDTO = { ref: string; label: string; status: Appointment["status"] };

/** Sessions to add a follow-up note to (the "Add a note" sheet): yours from the last 14 days, newest first. */
export async function noteTargets(): Promise<NoteTargetDTO[]> {
  const v = await requireStaff("appointment.manage", "appointment.own");
  const tz = safeTz(v.timezone);
  const now = Date.now();
  const items = await listRange([
    { field: "counsellorUid", op: "==", value: v.uid },
    { field: "startsAt", op: ">=", value: now - 14 * DAY },
    { field: "startsAt", op: "<", value: now + DAY },
  ]).catch(() => [] as Array<WithId<Appointment>>);
  const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz });
  return items
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => b.startsAt - a.startsAt)
    .map((a) => ({ ref: a.reference ?? a.id, label: `${fmt.format(a.startsAt)} · ${firstNameOf(a.clientSnapshot?.displayName ?? "") || "Client"}, session ${a.sessionNumber}`, status: a.status }));
}
