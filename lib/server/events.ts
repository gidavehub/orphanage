import "server-only";

// Case timeline and internal notes (data-model §4.1, PLAN §7.5).
// - events/{id}: the human-readable timeline, part of the record, visible to whoever can see the case.
//   Summaries never contain narrative or contact data ("Fatou moved this to Assigned").
// - notes/{id}: internal notes; the body is ALWAYS sealed (AAD = note path + "body"). The author may
//   edit for 15 minutes; afterwards notes are append-only (corrections are new notes).
// A status change writes an event and an audit entry in the same commit (workflow/flow.ts).

import type { CaseEvent, CaseEventActor, CaseEventType, CaseNote } from "@/lib/model/domain/case";
import type { Millis, Sealed, Uid } from "@/lib/model/enums";
import type { SystemActor, Viewer } from "@/lib/model/viewer";
import { getStore } from "@/lib/server/db";
import { SUB } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import type { Page, Tx, WithId } from "@/lib/server/db/store";
import { openField, sealField } from "@/lib/server/security/seal";

export type EventInput = {
  type: CaseEventType;
  actor: CaseEventActor;
  /** Non-sensitive sentence. */
  summary: string;
  from?: string;
  to?: string;
  at?: Millis;
};

const NOTE_EDIT_WINDOW_MS = 15 * 60_000;
export const NOTE_MAX_LENGTH = 4000;
export const COUNSELLOR_NOTE_MAX_LENGTH = 1000;

/** "supportRequests/HVN-SR-2026-0001" → "supportRequests/HVN-SR-2026-0001/events". */
export function eventsPath(parentPath: string): string {
  return `${parentPath}/${SUB.events}`;
}

export function notesPath(parentPath: string): string {
  return `${parentPath}/${SUB.notes}`;
}

/** The timeline actor for a staff member, a system job, the public or Stripe. */
export function eventActorOf(v: Viewer | SystemActor | "public" | "stripe"): CaseEventActor {
  if (v === "public") return { kind: "public" };
  if (v === "stripe") return { kind: "stripe" };
  if ("kind" in v && v.kind === "system") return { kind: "system", job: v.job };
  const viewer = v as Viewer;
  return { kind: "staff", uid: viewer.uid, name: viewer.displayName };
}

function toEvent(e: EventInput, now: Millis): CaseEvent {
  return {
    at: e.at ?? now,
    actor: e.actor,
    type: e.type,
    ...(e.from !== undefined ? { from: e.from } : {}),
    ...(e.to !== undefined ? { to: e.to } : {}),
    summary: e.summary.slice(0, 300),
  };
}

/** Adds a timeline event inside a transaction. Returns the event id. */
export function addEventTx(tx: Tx, parentPath: string, e: EventInput): string {
  const id = newId();
  tx.create(`${eventsPath(parentPath)}/${id}`, toEvent(e, Date.now()));
  return id;
}

/** Adds a timeline event on its own. */
export async function addEvent(parentPath: string, e: EventInput): Promise<string> {
  const id = newId();
  await getStore().create(`${eventsPath(parentPath)}/${id}`, toEvent(e, Date.now()));
  return id;
}

/** The timeline, newest first (25 per page, cursor "Load more"). */
export async function listEvents(parentPath: string, opts?: { limit?: number; cursor?: string | null }): Promise<Page<CaseEvent>> {
  return getStore().list<CaseEvent>(eventsPath(parentPath), {
    orderBy: { field: "at", dir: "desc" },
    limit: Math.min(100, Math.max(1, opts?.limit ?? 25)),
    cursor: opts?.cursor ?? null,
  });
}

export type NoteInput = {
  kind: CaseNote["kind"];
  /** Plain text; sealed before storage. */
  body: string;
  author: { uid: Uid; name: string };
  /** Defaults to 4000 (counsellor notes pass 1000). */
  maxLength?: number;
};

/**
 * Adds a sealed note inside a transaction and a matching "note_added" timeline event (no note text
 * in the event). Returns the note id.
 */
export function addNoteTx(tx: Tx, parentPath: string, note: NoteInput, opts?: { event?: boolean }): string {
  const max = note.maxLength ?? NOTE_MAX_LENGTH;
  const text = note.body.trim();
  if (!text) throw new Error("A note can't be empty.");
  if (text.length > max) throw new Error(`A note can be at most ${max} characters.`);
  const id = newId();
  const path = `${notesPath(parentPath)}/${id}`;
  const now = Date.now();
  const doc: CaseNote = {
    authorUid: note.author.uid,
    authorName: note.author.name,
    kind: note.kind,
    body: sealField(path, "body", text),
    editableUntil: now + NOTE_EDIT_WINDOW_MS,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  tx.create(path, doc);
  if (opts?.event !== false) {
    addEventTx(tx, parentPath, {
      type: "note_added",
      actor: { kind: "staff", uid: note.author.uid, name: note.author.name },
      summary: `${note.author.name.split(" ")[0] || "Someone"} added ${note.kind === "call" ? "a call note" : "a note"}`,
    });
  }
  return id;
}

/** Notes, newest first, still sealed: DAL detail mappers open them after the permission check. */
export async function listNotes(parentPath: string, opts?: { limit?: number; cursor?: string | null }): Promise<Page<CaseNote>> {
  return getStore().list<CaseNote>(notesPath(parentPath), {
    orderBy: { field: "createdAt", dir: "desc" },
    limit: Math.min(100, Math.max(1, opts?.limit ?? 25)),
    cursor: opts?.cursor ?? null,
  });
}

/** Opens a note body (call only after the permission check). */
export function openNoteBody(parentPath: string, note: WithId<CaseNote>): string {
  return openField<string>(`${notesPath(parentPath)}/${note.id}`, "body", note.body);
}

/** Re-seals edited note text for the same note path (within the edit window). */
export function sealNoteBody(parentPath: string, noteId: string, text: string): Sealed {
  return sealField(`${notesPath(parentPath)}/${noteId}`, "body", text.trim());
}
