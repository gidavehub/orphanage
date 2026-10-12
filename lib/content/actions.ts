"use server";

// Content Server Actions (content-model §5.1; PLAN D22, D61, D62, D139): the single cross-screen
// exception to "actions live beside their route". Each one checks the session first (requireStaff,
// outside try/catch), runs the write pipeline in lib/content/store.ts and calls updateTag() for
// read-your-own-writes. Only the constrained ActionResult reaches the client.

import { updateTag } from "next/cache";
import { draftMode } from "next/headers";
import {
  confirmRecord,
  discardDocDraft,
  publishDrafts,
  removeItem,
  restoreDoc,
  writeDoc,
  writeItem,
  writeItemOrder,
  writeItemVisibility,
  type WriteOutcome,
} from "./store";
import type { RecordKey } from "./types";
import type { ActionError, ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { requireStaff } from "@/lib/server/auth/session";

function settle<T>(outcome: WriteOutcome<T>): ActionResult<T> {
  for (const tag of outcome.tags) updateTag(tag);
  return outcome.result;
}

/** Saves a singleton as a draft (autosave, preview) or puts it live ("Save & update the website"). */
export async function saveDoc(input: { id: string; baseVersion: number; data: unknown; intent: "draft" | "publish" }): Promise<ActionResult> {
  const viewer = await requireStaff("content.edit");
  return settle(await writeDoc(viewer, input));
}

/** Throws away a singleton's unpublished draft (the publish sheet's "Undo this change"). */
export async function discardDraft(input: { id: string; baseVersion: number }): Promise<ActionResult> {
  const viewer = await requireStaff("content.edit");
  return settle(await discardDocDraft(viewer, input));
}

/**
 * Brings back an earlier version of a singleton: into the draft by default, or live straight away
 * (`intent: 'publish'`, the Key information editor's 10-second Undo).
 */
export async function restoreDocVersion(input: { id: string; version: number; baseVersion: number; intent?: "draft" | "publish" }): Promise<ActionResult> {
  const viewer = await requireStaff("content.edit");
  return settle(await restoreDoc(viewer, input));
}

/** Creates (no `id`) or edits a collection item, as a draft or live. Posts go live through review. */
export async function saveItem(input: {
  collection: string;
  id?: string;
  baseVersion?: number;
  data: unknown;
  intent: "draft" | "publish";
}): Promise<ActionResult<{ id: string; version: number; at: Millis }>> {
  const viewer = await requireStaff("content.edit", "post.draft", "post.publish");
  return settle(await writeItem(viewer, input));
}

/** Shows, hides or archives an item. */
export async function setItemVisibility(input: {
  collection: string;
  id: string;
  baseVersion: number;
  visibility: "live" | "hidden" | "archived";
}): Promise<ActionResult> {
  const viewer = await requireStaff("content.publish", "post.publish");
  return settle(await writeItemVisibility(viewer, input));
}

/** Saves a new order (the list editor's drag handles and ↑/↓ buttons). */
export async function reorderItems(input: { collection: string; orderedIds: string[] }): Promise<ActionResult> {
  const viewer = await requireStaff("content.publish", "post.publish");
  return settle(await writeItemOrder(viewer, input));
}

/** Deletes a never-published item; archives a live one (super admins may delete it for good). */
export async function deleteItem(input: { collection: string; id: string; baseVersion: number }): Promise<ActionResult<{ version: number; at: Millis; archived: boolean }>> {
  const viewer = await requireStaff("content.edit", "post.draft", "post.publish");
  return settle(await removeItem(viewer, input));
}

/** "This is real, approved content": clears the placeholder flag (Before-launch checklist). */
export async function confirmPlaceholder(input: { key: RecordKey; baseVersion: number }): Promise<ActionResult> {
  const viewer = await requireStaff("content.publish", "post.publish");
  return settle(await confirmRecord(viewer, input));
}

/** Puts the listed drafts live (the PublishSheet's "Put these changes live", D61). */
export async function publishAll(
  keys: RecordKey[],
): Promise<ActionResult<{ published: RecordKey[]; failed: Array<{ key: RecordKey; error: ActionError }> }>> {
  const viewer = await requireStaff("content.publish");
  return settle(await publishDrafts(viewer, { keys }));
}

/** Leaves Draft Mode (the PreviewBanner's "Exit preview", D62). */
export async function exitPreview(): Promise<void> {
  (await draftMode()).disable();
}
