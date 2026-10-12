import "server-only";

// Cross-area record access (admin-ux §3.5, §4.4; PLAN D74, D84). F5 ships the reference lookup used by
// Find and the /admin/r/[ref] short link, and the Inbox entry point with its final signature (A2 fills
// listInbox with the parallel per-kind queries of D83). Every function calls requireStaff first; a
// record the viewer may not open is reported exactly like a missing one.

import { AREA_PERMS } from "@/lib/admin/access";
import { STATUS_LABEL, WORKFLOW_LABEL } from "@/lib/model/labels";
import type { InboxItem, Page } from "@/lib/model/dto";
import { adminHrefOfRef, type RecordKind } from "@/lib/model/refs";
import type { StatusOf, Workflow } from "@/lib/model/status";
import { requireStaff } from "@/lib/server/auth/session";
import { readRecordFor } from "./_shared";
import { inboxFor, type InboxKind, type InboxTab } from "./inbox";

/** What Find and the short link need about one record: never its contents. */
export type RecordLookupDTO = {
  ref: string;
  kind: RecordKind;
  workflow: Workflow;
  /** "Support request", "Gift", or "Safeguarding concern" (concerns never say more, §7.5). */
  title: string;
  /** Stage label ("Under review"). */
  stage: string;
  /** The record's home URL (admin-ux §4.2). */
  href: string;
  restricted: boolean;
};

/**
 * Finds one record by anything that normalises to a reference ("sr 2026 1", "HVN-K7Q2-M9XD"), or null
 * when it does not exist or is not open to this person.
 */
export async function findByReference(input: string): Promise<RecordLookupDTO | null> {
  const v = await requireStaff();
  const loaded = await readRecordFor(v, input);
  if (!loaded) return null;
  const restricted = loaded.collection === "safeguardingConcerns";
  const status = typeof loaded.record.status === "string" ? loaded.record.status : "";
  const labels = STATUS_LABEL[loaded.workflow] as Record<string, string>;
  return {
    ref: loaded.ref,
    kind: loaded.kind,
    workflow: loaded.workflow,
    title: restricted ? "Safeguarding concern" : WORKFLOW_LABEL[loaded.workflow],
    stage: labels[status as StatusOf<typeof loaded.workflow>] ?? "",
    href: adminHrefOfRef(loaded.ref, loaded.kind),
    restricted,
  };
}

export type { InboxKind, InboxTab } from "./inbox";

/**
 * The Inbox list for this person: everything they triage, across kinds, ordered by urgency then age
 * (admin-ux §6.3, D83). `counts` gives the per-kind totals for the "Type" chips.
 */
export async function listInbox(
  opts: { tab?: InboxTab; kind?: InboxKind | null; cursor?: string | null; limit?: number } = {},
): Promise<Page<InboxItem> & { counts: Partial<Record<InboxKind, number>>; at: number }> {
  const v = await requireStaff(...AREA_PERMS.inbox.read);
  return inboxFor(v, opts);
}
