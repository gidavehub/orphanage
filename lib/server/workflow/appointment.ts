import "server-only";

// Counselling sessions (admin-ux §6.7; PLAN D77; integrations §6.3–6.4). Edges come from FLOWS; this
// file adds the guards, the attendance and schedule patches, and the emails:
//   • the invitation (`counselling_confirmation` with an .ics) and the 24 h / 1 h reminders are keyed
//     by the reference and the ics sequence, so a reschedule queues a fresh set; the DAL cancels the
//     previous set after the commit (cancelEmails also cancels mail already scheduled with Resend);
//   • cancelling sends `counselling_cancelled` with an .ics CANCEL when the client had been invited.
// Counsellors take only their own sessions' edges (`assigned_counsellor`, `authorize`).

import type { Appointment } from "@/lib/model/domain/appointment";
import type { Millis } from "@/lib/model/enums";
import { enqueueEmailTx, outboxId } from "@/lib/server/email/outbox";
import { has } from "@/lib/server/auth/permissions";
import { defineMachine, type TransitionInput } from "./flow";

export type AppointmentInput = TransitionInput & {
  startsAt?: Millis;
  durationMin?: 30 | 45 | 60 | 90;
  /** attended: recommend a follow-up session by this date. */
  followUpBy?: Millis | null;
};

const HOUR = 3_600_000;
export const DURATIONS = [30, 45, 60, 90] as const;

/** Outbox ids of the invitation and reminders for one schedule of a session. */
export function sessionEmailIds(ref: string, sequence: number): string[] {
  const key = `${ref}~s${sequence}`;
  return [outboxId("counselling_confirmation", key), outboxId("zoom_reminder_24h", key), outboxId("zoom_reminder_1h", key)];
}

export function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

/** "Thursday 9 October, 10:00 (Africa/Banjul time)" in the client's timezone. */
export function whenFor(startsAt: Millis, timezone: string): string {
  let tz = timezone;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
  } catch {
    tz = "Africa/Banjul";
  }
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(startsAt);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(startsAt);
  return `${day}, ${time} (${tz.replace(/_/g, " ")} time)`;
}

type Tx = Parameters<typeof enqueueEmailTx>[0];

/**
 * Queues the invitation and the two reminders for the record's current schedule. Reminders whose time
 * has passed are skipped. Returns the reminder timestamps for `reminders.*QueuedAt`.
 */
export async function queueSessionEmails(
  tx: Tx,
  a: Pick<Appointment, "reference" | "startsAt" | "durationMin" | "clientTimezone" | "zoom" | "clientSnapshot" | "icsSequence">,
  path: string,
  now: Millis,
): Promise<{ confirmationQueuedAt: Millis | null; reminder24hQueuedAt: Millis | null; reminder1hQueuedAt: Millis | null }> {
  const email = a.clientSnapshot.contactEmail;
  if (!email) return { confirmationQueuedAt: null, reminder24hQueuedAt: null, reminder1hQueuedAt: null };
  const key = `${a.reference}~s${a.icsSequence}`;
  const vars = {
    reference: a.reference,
    firstName: firstNameOf(a.clientSnapshot.displayName),
    when: whenFor(a.startsAt, a.clientTimezone),
    startsAt: a.startsAt,
    durationMin: a.durationMin,
    sequence: a.icsSequence,
    ...(a.zoom?.joinUrl ? { link: a.zoom.joinUrl } : {}),
  };
  const related = { path, reference: a.reference };
  await enqueueEmailTx(tx, { template: "counselling_confirmation", to: [email], vars, related, dedupeKey: key });
  const out = { confirmationQueuedAt: now as Millis | null, reminder24hQueuedAt: null as Millis | null, reminder1hQueuedAt: null as Millis | null };
  if (a.startsAt - 24 * HOUR > now) {
    await enqueueEmailTx(tx, { template: "zoom_reminder_24h", to: [email], vars, related, dedupeKey: key, scheduledFor: a.startsAt - 24 * HOUR });
    out.reminder24hQueuedAt = now;
  }
  if (a.startsAt - HOUR > now) {
    await enqueueEmailTx(tx, { template: "zoom_reminder_1h", to: [email], vars, related, dedupeKey: key, scheduledFor: a.startsAt - HOUR });
    out.reminder1hQueuedAt = now;
  }
  return out;
}

const ended = (r: Appointment, now: Millis) => r.startsAt + r.durationMin * 60_000 <= now + 5 * 60_000;

export const appointmentMachine = defineMachine<"appointment", Appointment, AppointmentInput>({
  workflow: "appointment",
  collection: "appointments",
  area: "counselling",
  // Counsellors only ever act on their own sessions; programme officers and super admins on any.
  authorize: ({ viewer, record }) => !viewer || has(viewer, "appointment.manage") || record.counsellorUid === viewer.uid,
  guards: {
    reschedule: ({ input, now }) => {
      if (typeof input.startsAt !== "number" || !Number.isFinite(input.startsAt)) return "Choose the new date and time.";
      if (input.startsAt < now - 5 * 60_000) return "The new time is in the past.";
      if (input.durationMin !== undefined && !DURATIONS.includes(input.durationMin)) return "Choose 30, 45, 60 or 90 minutes.";
      return null;
    },
    attended: ({ record, now }) => (ended(record, now) ? null : "You can mark attendance once the session has started."),
    no_show: ({ record, now }) => (record.startsAt <= now ? null : "You can mark a missed session once its time has come."),
    cancel: ({ input }) => (input.reason?.trim() && input.reason.trim().length >= 3 ? null : "Say why, so the team knows later."),
  },
  patches: {
    // A confirmed session gets a fresh invitation and reminders for the new time (queued here, so the
    // record is written once).
    reschedule: async ({ tx, record, input, path, now }) => {
      const next = { ...record, startsAt: input.startsAt!, durationMin: input.durationMin ?? record.durationMin, icsSequence: (record.icsSequence ?? 0) + 1 };
      const reminders = record.reminders?.confirmationQueuedAt
        ? await queueSessionEmails(tx, next, path, now)
        : { confirmationQueuedAt: null, reminder24hQueuedAt: null, reminder1hQueuedAt: null };
      return { startsAt: next.startsAt, durationMin: next.durationMin, icsSequence: next.icsSequence, reminders };
    },
    attended: ({ viewer, now, input }) => ({
      attendance: { status: "attended", recordedBy: viewer?.uid ?? "system", recordedAt: now },
      followUp: input.followUpBy ? { recommended: true, byDate: input.followUpBy } : null,
    }),
    no_show: ({ viewer, now }) => ({ attendance: { status: "no_show", recordedBy: viewer?.uid ?? "system", recordedAt: now } }),
    client_cancelled: ({ viewer, now, input }) => ({
      attendance: { status: "cancelled_by_client", recordedBy: viewer?.uid ?? "system", recordedAt: now },
      cancelReason: input.reason?.trim().slice(0, 300) || "The client asked to cancel.",
    }),
    cancel: ({ viewer, now, input }) => ({
      attendance: { status: "cancelled_by_haven", recordedBy: viewer?.uid ?? "system", recordedAt: now },
      cancelReason: input.reason!.trim().slice(0, 300),
    }),
    correct: () => ({ attendance: null, followUp: null }),
  },
  effects: {
    client_cancelled: ({ tx, record, path }) => cancelNotice(tx, record, path),
    cancel: ({ tx, record, path }) => cancelNotice(tx, record, path),
  },
  summary: ({ edge, actorName, ref, input }) => {
    if (edge.id === "reschedule") return `${actorName} moved ${ref} to a new time`;
    if (edge.id === "attended") return `${actorName} marked ${ref} as attended${input.followUpBy ? " and suggested a follow-up" : ""}`;
    if (edge.id === "no_show") return `${actorName} marked ${ref} as missed`;
    return `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`;
  },
});

async function cancelNotice(tx: Tx, record: Appointment, path: string): Promise<void> {
  const email = record.clientSnapshot.contactEmail;
  if (!email || !record.reminders?.confirmationQueuedAt) return;
  await enqueueEmailTx(tx, {
    template: "counselling_cancelled",
    to: [email],
    vars: {
      reference: record.reference,
      firstName: firstNameOf(record.clientSnapshot.displayName),
      when: whenFor(record.startsAt, record.clientTimezone),
      startsAt: record.startsAt,
      durationMin: record.durationMin,
      sequence: (record.icsSequence ?? 0) + 1,
    },
    related: { path, reference: record.reference },
    dedupeKey: `${record.reference}~s${record.icsSequence ?? 0}`,
  });
}
