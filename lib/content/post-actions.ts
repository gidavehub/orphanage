"use server";

// Post workflow Server Actions (content-model §7.1, PLAN D42, D139). The transition core lives in
// lib/content/posts.ts; each action checks the session first and refreshes the post's cache tags
// when the public site changes.

import { updateTag } from "next/cache";
import { transitionPost } from "./posts";
import type { ActionResult } from "@/lib/forms/types";
import { requireStaff } from "@/lib/server/auth/session";

async function run(input: Record<string, unknown>, ...perms: Array<"post.draft" | "post.publish">): Promise<ActionResult> {
  const viewer = await requireStaff(...perms);
  const outcome = await transitionPost(viewer, input);
  for (const tag of outcome.tags) updateTag(tag);
  return outcome.result;
}

/** Draft → waiting for review ("Send for review"). */
export async function submitPost(input: { id: string; baseVersion: number }): Promise<ActionResult> {
  return run({ id: input.id, baseVersion: input.baseVersion, edge: "submit" }, "post.draft", "post.publish");
}

/** Waiting for review → draft, with what should change ("Ask for changes"). */
export async function requestChanges(input: { id: string; baseVersion: number; notes: string }): Promise<ActionResult> {
  return run({ id: input.id, baseVersion: input.baseVersion, edge: "request_changes", notes: input.notes }, "post.publish");
}

/**
 * Waiting for review → live now, or scheduled when `publishAt` is in the future. The reviewer's ticks
 * are saved with the post; every item must be ticked.
 */
export async function approvePost(input: {
  id: string;
  baseVersion: number;
  publishAt?: number;
  checklist?: Partial<Record<"factsChecked" | "figuresMatchVerifiedStats" | "noChildIdentified" | "noPreciseLocations" | "consentForPeopleShown" | "noAdviceOrDiagnosis", boolean>>;
}): Promise<ActionResult> {
  return run(
    {
      id: input.id,
      baseVersion: input.baseVersion,
      edge: "approve",
      ...(input.publishAt !== undefined ? { publishAt: input.publishAt } : {}),
      ...(input.checklist ? { checklist: input.checklist } : {}),
    },
    "post.publish",
  );
}

/** Live → back to draft ("Take down to edit"), or archived (`to: 'archived'`). */
export async function unpublishPost(input: { id: string; baseVersion: number; to?: "draft" | "archived" }): Promise<ActionResult> {
  return run({ id: input.id, baseVersion: input.baseVersion, edge: input.to === "archived" ? "archive" : "unpublish" }, "post.publish");
}
