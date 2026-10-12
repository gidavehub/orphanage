"use server";

// Website studio Server Actions (admin-ux §6.10–6.11). Reads go through lib/studio/server (requireStaff
// inside); writes reuse the content actions (lib/content/actions), which check field groups, run the
// publish gates, audit and expire the public tags.

import { refresh } from "next/cache";
import { deleteItem, discardDraft, saveItem } from "@/lib/content/actions";
import { contentStore } from "@/lib/content/store";
import type { RecordKey } from "@/lib/content/types";
import type { ActionResult } from "@/lib/forms/types";
import { requireStaff } from "@/lib/server/auth/session";
import { draftChanges, loadCollection, loadSection } from "@/lib/studio/server";

export async function loadSectionAction(id: string) {
  return loadSection(id);
}

export async function loadCollectionAction(name: string) {
  return loadCollection(name);
}

export async function draftChangesAction() {
  return draftChanges();
}

/** "Undo this change": throws the draft away (a never-live item is removed). */
export async function undoChangeAction(change: { key: RecordKey; version: number; everLive: boolean }): Promise<ActionResult<unknown>> {
  await requireStaff("content.edit");
  const k = change.key;
  let r: ActionResult<unknown>;
  if (k.kind === "doc") r = await discardDraft({ id: k.id, baseVersion: change.version });
  else if (!change.everLive) r = await deleteItem({ collection: k.collection, id: k.id, baseVersion: change.version });
  else {
    const rec = await contentStore().getItem(k.collection, k.id);
    r = rec?.published ? await saveItem({ collection: k.collection, id: k.id, baseVersion: change.version, data: rec.published, intent: "publish" }) : { ok: false, error: { kind: "not_allowed", message: "That change couldn't be undone." } };
  }
  if (r.ok) refresh();
  return r;
}
