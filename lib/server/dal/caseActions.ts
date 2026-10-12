import "server-only";

// Actions every case record shares (admin-ux §6.3–6.4): Take it, put it aside until later, mark it
// seen, and add a note or a call note. Each one opens the record for the viewer first (IDOR check)
// and needs the collection's manage permission; support requests "taken" while new also move to
// Under review through the workflow engine, so the timeline and audit stay consistent.

import type { ActionResult } from "@/lib/forms/types";
import { actionError, actionOk } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import { actorOf, auditTx } from "@/lib/server/audit";
import { hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { F } from "@/lib/server/db/store";
import { addEventTx, addNoteTx, eventActorOf } from "@/lib/server/events";
import { log } from "@/lib/server/log";
import { supportMachine } from "@/lib/server/workflow/support";
import { transitionResult } from "@/lib/server/workflow/flow";
import { readRecordFor, type LoadedRecord } from "./_shared";

const MANAGE: Record<LoadedRecord["collection"], Permission[]> = {
  supportRequests: ["support.manage"],
  safeguardingConcerns: ["concern.manage"],
  donations: ["donation.manage"],
  recurringGifts: ["donation.manage"],
  appointments: ["appointment.manage", "appointment.own"],
  reportRequests: ["reportRequest.manage"],
  volunteerApplications: ["volunteer.manage"],
  partnershipEnquiries: ["partnership.manage"],
  contactMessages: ["contact.manage"],
  dataRequests: ["privacy.manage"],
  storySubmissions: ["storySubmission.manage"],
};

const AUDIT_AREA: Record<LoadedRecord["collection"], "support" | "safeguarding" | "donations" | "counselling" | "engagement" | "resources" | "privacy" | "content"> = {
  supportRequests: "support",
  safeguardingConcerns: "safeguarding",
  donations: "donations",
  recurringGifts: "donations",
  appointments: "counselling",
  reportRequests: "resources",
  volunteerApplications: "engagement",
  partnershipEnquiries: "engagement",
  contactMessages: "engagement",
  dataRequests: "privacy",
  storySubmissions: "content",
};

type Res = ActionResult<{ version: number; at: Millis }>;

async function openForWrite(ref: string) {
  const v = await requireStaff();
  const loaded = await readRecordFor(v, ref);
  if (!loaded) return { v, loaded: null, error: actionError({ kind: "not_allowed", message: "This record doesn't exist, or it isn't open to your role." }) } as const;
  if (!hasAny(v, ...MANAGE[loaded.collection])) return { v, loaded: null, error: actionError({ kind: "forbidden", message: "Your role can look at this but not change it." }) } as const;
  return { v, loaded, error: null } as const;
}

/** "Take it": the record becomes yours (support requests that are new also move to Under review). */
export async function takeRecord(ref: string): Promise<Res> {
  const { v, loaded, error } = await openForWrite(ref);
  if (!loaded) return error;
  if (loaded.collection === "supportRequests" && loaded.record.status === "new") {
    const r = await transitionResult(() => supportMachine.transition({ ref: loaded.ref, edgeId: "start_review", actor: v, expectedVersion: loaded.record.version as number }));
    if (!r.ok) return r;
    if (loaded.record.assignedTo && loaded.record.assignedTo !== v.uid) {
      // start_review keeps an existing owner; taking it means it's now yours.
      await getStore().update(loaded.path, { assignedTo: v.uid, assignedName: v.displayName, assignedAt: Date.now() });
    }
    return actionOk({ version: r.data.version, at: r.data.at });
  }
  const now = Date.now();
  try {
    let version = 0;
    await getStore().runTransaction(async (tx) => {
      const rec = await tx.get<{ version: number; assignedTo?: string | null }>(loaded.path);
      if (!rec) throw new Error("gone");
      version = rec.version + 1;
      tx.update(loaded.path, { assignedTo: v.uid, assignedName: v.displayName, assignedAt: now, seenBy: F.arrayUnion(v.uid), lastActivityAt: now, updatedAt: now, version });
      addEventTx(tx, loaded.path, { type: "assigned", actor: eventActorOf(v), summary: `${v.displayName.split(" ")[0]} took this`, at: now });
      auditTx(tx, { actor: actorOf(v), action: "record.assign", area: AUDIT_AREA[loaded.collection], summary: `${v.displayName} took ${loaded.ref}`, feed: true, targetPath: loaded.path, targetRef: loaded.ref });
    });
    return actionOk({ version, at: now });
  } catch (err) {
    log.warn("case.take_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

/** Put aside until `until` (or bring back now with null). */
export async function snoozeRecord(ref: string, until: Millis | null): Promise<Res> {
  const { v, loaded, error } = await openForWrite(ref);
  if (!loaded) return error;
  const now = Date.now();
  if (until !== null && (!Number.isFinite(until) || until < now + 60_000 || until > now + 120 * 86_400_000)) {
    return actionError({ kind: "not_allowed", message: "Choose a time later today or in the next few months." });
  }
  try {
    let version = 0;
    await getStore().runTransaction(async (tx) => {
      const rec = await tx.get<{ version: number }>(loaded.path);
      if (!rec) throw new Error("gone");
      version = rec.version + 1;
      tx.update(loaded.path, { snoozedUntil: until, updatedAt: now, version });
      addEventTx(tx, loaded.path, {
        type: "snoozed",
        actor: eventActorOf(v),
        summary: until ? `${v.displayName.split(" ")[0]} put this aside until ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: v.timezone }).format(until)}` : `${v.displayName.split(" ")[0]} brought this back`,
        at: now,
      });
    });
    return actionOk({ version, at: now });
  } catch (err) {
    log.warn("case.snooze_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

/** Marks the record seen by this person (the unread dot). Quiet: never fails loudly. */
export async function markSeen(ref: string): Promise<void> {
  const v = await requireStaff();
  const loaded = await readRecordFor(v, ref);
  if (!loaded) return;
  const seen = loaded.record.seenBy;
  if (Array.isArray(seen) && seen.includes(v.uid)) return;
  try {
    await getStore().update(loaded.path, { seenBy: F.arrayUnion(v.uid) });
  } catch (err) {
    log.warn("case.seen_failed", { ref, err });
  }
}

/** Adds a sealed note (or a call note) to any case record this person may change. */
export async function addCaseNote(ref: string, kind: "note" | "call", text: string): Promise<Res> {
  const { v, loaded, error } = await openForWrite(ref);
  if (!loaded) return error;
  if (loaded.collection === "safeguardingConcerns") return actionError({ kind: "forbidden", message: "Concern notes are added in Safeguarding." });
  const body = text.trim();
  if (!body) return actionError({ kind: "validation", fields: { text: "Write something first." } });
  if (body.length > 4000) return actionError({ kind: "validation", fields: { text: "A note can be at most 4,000 characters." } });
  const now = Date.now();
  try {
    let version = 0;
    await getStore().runTransaction(async (tx) => {
      const rec = await tx.get<{ version: number }>(loaded.path);
      if (!rec) throw new Error("gone");
      version = rec.version + 1;
      addNoteTx(tx, loaded.path, { kind, body, author: { uid: v.uid, name: v.displayName } });
      tx.update(loaded.path, { lastActivityAt: now, updatedAt: now, version });
    });
    return actionOk({ version, at: now });
  } catch (err) {
    log.warn("case.note_failed", { ref, err });
    return actionError({ kind: "unavailable", message: "Your note didn't save. It's still in the box, so please try again." });
  }
}
