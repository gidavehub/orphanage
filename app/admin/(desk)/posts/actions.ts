"use server";

// Posts Server Actions (admin-ux §6.12; PLAN D42, D110, D129). New posts are created as drafts through
// saveItem; moves use the post workflow actions (lib/content/post-actions), which check permissions,
// run the review gate and expire the public tags.

import { refresh } from "next/cache";
import { deleteItem, saveItem } from "@/lib/content/actions";
import { approvePost, requestChanges, submitPost, unpublishPost } from "@/lib/content/post-actions";
import { getMediaIndex, toPickerItem } from "@/lib/media/index";
import { FALLBACK_MEDIA_ID } from "@/lib/media/pipeline";
import type { ActionResult } from "@/lib/forms/types";
import { PROGRAMME_IDS, type Millis, type ProgrammeId } from "@/lib/model/enums";
import { requireStaff } from "@/lib/server/auth/session";
import { assist } from "@/lib/server/ai/assist";
import { runMonthlyDraft } from "@/lib/server/ai/monthly";
import { drainAfterResponse } from "@/lib/server/email/outbox";
import { sendToSupporters, supportersPreview } from "@/lib/server/dal/posts";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "post";

export type NewPostInput = {
  format: "update" | "article";
  title: string;
  excerpt: string;
  /** Updates: the one paragraph (≤ 600). */
  text?: string;
  category: string;
  cover?: string | null;
  programmeIds?: string[];
  countries?: string[];
};

/** Creates a draft post (the slug comes from the title; a clash gets -2, -3…). */
export async function createPostAction(input: NewPostInput): Promise<ActionResult<{ id: string; version: number; at: Millis }>> {
  const v = await requireStaff("post.draft", "post.publish");
  const base = slugify(input.title);
  const data = {
    format: input.format,
    title: input.title,
    excerpt: input.excerpt,
    cover: { $media: input.cover || FALLBACK_MEDIA_ID },
    category: input.category,
    programmeIds: (input.programmeIds ?? []).filter((p): p is ProgrammeId => (PROGRAMME_IDS as readonly string[]).includes(p)),
    countries: input.countries ?? [],
    tags: [],
    body: input.format === "update" && input.text ? [{ id: "p1", type: "paragraph", text: input.text }] : [],
    author: { displayName: input.format === "update" ? v.displayName.split(" ")[0] || "Haven team" : "Haven team" },
    status: "draft",
    featured: false,
    review: { checklist: { factsChecked: false, figuresMatchVerifiedStats: false, noChildIdentified: false, noPreciseLocations: false, consentForPeopleShown: false, noAdviceOrDiagnosis: false } },
    origin: { kind: "human" },
    seo: {},
  };
  let r: ActionResult<{ id: string; version: number; at: Millis }> = { ok: false, error: { kind: "not_allowed", message: "That didn't save." } };
  for (let n = 1; n <= 6; n++) {
    r = await saveItem({ collection: "posts", data: { ...data, slug: n === 1 ? base : `${base}-${n}` }, intent: "draft" });
    if (r.ok || r.error.kind !== "validation" || !r.error.fields.slug) break;
  }
  if (r.ok) refresh();
  return r;
}

export async function savePostAction(input: { id: string; baseVersion: number; data: unknown }) {
  return saveItem({ collection: "posts", id: input.id, baseVersion: input.baseVersion, data: input.data, intent: "draft" });
}

/** Live post: saves the edit straight to the live version (re-reviewed only when the body or cover changed). */
export async function savePublishedPostAction(input: { id: string; baseVersion: number; data: unknown }) {
  const r = await saveItem({ collection: "posts", id: input.id, baseVersion: input.baseVersion, data: input.data, intent: "publish" });
  if (r.ok) refresh();
  return r;
}

function settle<T>(r: ActionResult<T>): ActionResult<T> {
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function submitPostAction(id: string, baseVersion: number) {
  return settle(await submitPost({ id, baseVersion }));
}

export async function approvePostAction(id: string, baseVersion: number, checklist: Record<string, boolean>, publishAt?: number) {
  return settle(await approvePost({ id, baseVersion, checklist, ...(publishAt ? { publishAt } : {}) }));
}

export async function requestChangesAction(id: string, baseVersion: number, notes: string) {
  return settle(await requestChanges({ id, baseVersion, notes }));
}

export async function unpublishPostAction(id: string, baseVersion: number, to: "draft" | "archived" = "draft") {
  return settle(await unpublishPost({ id, baseVersion, to }));
}

/** "Not this month" on an AI draft: back to draft with the reason, then removed (it was never live). */
export async function notThisMonthAction(id: string, baseVersion: number, reason: string): Promise<ActionResult<unknown>> {
  const r = await requestChanges({ id, baseVersion, notes: `Not this month${reason.trim() ? `: ${reason.trim()}` : "."}` });
  if (!r.ok) return r;
  const d = await deleteItem({ collection: "posts", id, baseVersion: r.data.version });
  if (d.ok) refresh();
  return d;
}

export async function supportersPreviewAction() {
  return supportersPreview();
}

export async function sendToSupportersAction(id: string) {
  return settle(await sendToSupporters(id));
}

export async function assistAction(kind: "tighten" | "warmer" | "shorter" | "title" | "excerpt", text: string) {
  const v = await requireStaff("post.draft", "post.publish");
  if (!["tighten", "warmer", "shorter", "title", "excerpt"].includes(kind)) return { kind: "off" as const, message: "That isn't something the helper can do." };
  return assist({ kind, text: String(text ?? "").slice(0, 4000), uid: v.uid });
}

export async function monthlyDraftNowAction(): Promise<{ created: string | null; message: string }> {
  const v = await requireStaff("post.publish", "ai.manage");
  const r = await runMonthlyDraft({ force: true, trigger: v.uid });
  if (r.created) refresh();
  const message = r.created
    ? r.provider === "template"
      ? "A draft is ready to review. The writing helper is off, so fill in the ✎ boxes before it goes live."
      : "This month’s draft is ready to review."
    : r.reason === "thin"
      ? "There isn’t much to write about yet. Add a few updates or topics, then try again."
      : r.reason === "running"
        ? "A draft is already being written. Please wait a minute."
        : "No draft was made this time. Please try again.";
  return { created: r.created, message };
}

/** Photos for the update composer (the MediaPicker's consent gate applies). */
export async function updateSheetOptionsAction() {
  await requireStaff("post.draft", "post.publish");
  const index = await getMediaIndex();
  return {
    media: Object.values(index)
      .filter((a) => a.kind === "image")
      .map((a) => toPickerItem(a)),
  };
}
