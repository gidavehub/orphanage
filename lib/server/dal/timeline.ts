import "server-only";

// A record's timeline (admin-ux §6.4 Timeline; data-model §4.1 events). Built from the `events`
// subcollection, which holds human-readable summaries only (never narrative or contact data). Notes,
// emails with previews and referrals are added by the area packages (A2 and others) on top of this.
// Calls requireStaff first and opens the record for the viewer (IDOR check); a record the viewer may
// not open renders NoAccess (notFound), exactly like a missing one.

import type { CaseEvent, CaseEventType } from "@/lib/model/domain/case";
import { toStaffRef, type Page, type TimelineEntryDTO, type TimelineKind } from "@/lib/model/dto";
import { requireStaff } from "@/lib/server/auth/session";
import { listEvents } from "@/lib/server/events";
import { clampLimit, loadForViewer, pageOf } from "./_shared";

const KIND_OF_EVENT: Record<CaseEventType, TimelineKind> = {
  created: "submitted",
  status_changed: "status",
  assigned: "assigned",
  unassigned: "assigned",
  note_added: "note",
  attachment_added: "document",
  attachment_removed: "document",
  email_queued: "email",
  email_sent: "email",
  email_failed: "email",
  referral_recorded: "referral",
  referral_updated: "referral",
  field_updated: "system",
  moved_to_safeguarding: "system",
  reopened: "status",
  archived: "system",
  unarchived: "system",
  snoozed: "system",
  merged: "system",
};

function actorOf(e: CaseEvent): TimelineEntryDTO["actor"] {
  switch (e.actor.kind) {
    case "staff":
      return toStaffRef(e.actor.uid, e.actor.name);
    case "system":
      return { system: e.actor.job };
    case "stripe":
      return { stripe: true };
    default:
      return { public: true };
  }
}

/** Newest first, 25 per page ("Load more" passes the cursor back). */
export async function listTimeline(ref: string, opts: { cursor?: string | null; limit?: number } = {}): Promise<Page<TimelineEntryDTO>> {
  const v = await requireStaff();
  const loaded = await loadForViewer(v, ref);
  const restricted = loaded.collection === "safeguardingConcerns";
  const page = await listEvents(loaded.path, { cursor: opts.cursor ?? null, limit: clampLimit(opts.limit) });
  return pageOf(page, (e) => ({
    id: e.id,
    ref: loaded.ref,
    at: e.at,
    actor: actorOf(e),
    kind: KIND_OF_EVENT[e.type] ?? "system",
    text: e.summary,
    ...(e.from !== undefined ? { from: e.from } : {}),
    ...(e.to !== undefined ? { to: e.to } : {}),
    ...(restricted ? { restricted: true } : {}),
  }));
}
