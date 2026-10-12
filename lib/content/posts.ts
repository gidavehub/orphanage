import "server-only";

// The post workflow (content-model §7.1, PLAN D42, D110; edges from lib/model/flows.ts FLOWS.post):
// draft → in_review → scheduled | published → archived, with "changes requested" back to draft.
// - transitionPost(): the one transition core, used by the post Server Actions and the scheduler.
// - createAiDraft(): the monthly AI draft (and drafts from notes) arrive as `in_review`, origin "ai",
//   with an empty checklist; a human must approve them (I4 builds the writer).
// - publishDuePosts(): flips scheduled posts whose time has come, from the tick cron and the admin's
//   client effect (never during render), and expires their cache tags immediately (D16).

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { gateReasons } from "./gate";
import { POST_CATEGORY_LABEL, PostDraftSchema, PostSchema, type Post, type PostDraftInput, type StoredRecord } from "./schema";
import {
  actorId,
  actorName,
  auditWrite,
  conflictOf,
  ConflictSignal,
  contentStore,
  done,
  ensureSeeded,
  envelopeOf,
  fail,
  forbidden,
  guarded,
  isSystem,
  notAllowed,
  recordPath,
  snapshotVersion,
  tagsFor,
  toRecord,
  unavailable,
  validationFrom,
  writable,
  writeItem,
  type ContentActor,
  type Envelope,
  type WriteOutcome,
} from "./store";
import type { RecordKey } from "./types";
import { FALLBACK_MEDIA_ID } from "@/lib/media/pipeline";
import { readMediaIndexUncached } from "@/lib/media/index";
import { actionOk, type ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { canTakeEdge, edgeById } from "@/lib/model/flows";
import { STATUS_LABEL } from "@/lib/model/labels";
import { systemActor, type SystemActor, type Viewer } from "@/lib/model/viewer";
import { getStore } from "@/lib/server/db";
import { log } from "@/lib/server/log";
import { notify, recipientsFor } from "@/lib/server/notify";

export const POST_EDGES = ["submit", "request_changes", "approve", "publish_due", "unpublish", "archive"] as const;
export type PostEdge = (typeof POST_EDGES)[number];

export const TransitionPostInput = z.object({
  id: z.string().regex(/^[A-Za-z0-9_~.-]{1,128}$/),
  baseVersion: z.number().int().min(0),
  edge: z.enum(POST_EDGES),
  /** request_changes: what to change (required). */
  notes: z.string().trim().max(1000).optional(),
  /** approve: a future time schedules the post; absent or past publishes now. */
  publishAt: z.number().int().min(0).optional(),
  /** approve: the reviewer's ticks, merged into review.checklist. */
  checklist: z
    .object({
      factsChecked: z.boolean().optional(),
      figuresMatchVerifiedStats: z.boolean().optional(),
      noChildIdentified: z.boolean().optional(),
      noPreciseLocations: z.boolean().optional(),
      consentForPeopleShown: z.boolean().optional(),
      noAdviceOrDiagnosis: z.boolean().optional(),
    })
    .optional(),
});
export type TransitionPostInput = z.input<typeof TransitionPostInput>;

/** The FLOWS.post edge id an action takes, given the requested publish time. */
function flowEdge(edge: PostEdge, publishAt: number | undefined, now: number): string {
  if (edge === "approve") return publishAt !== undefined && publishAt > now ? "schedule" : "publish";
  return edge;
}

const AUDIT: Record<string, { action: string; verb: string }> = {
  submit: { action: "post.submit", verb: "sent {label} for review" },
  request_changes: { action: "post.changes_requested", verb: "asked for changes to {label}" },
  schedule: { action: "post.schedule", verb: "scheduled {label}" },
  publish: { action: "post.approve", verb: "approved and put {label} live" },
  publish_due: { action: "post.publish", verb: "put {label} live on schedule" },
  unpublish: { action: "post.unpublish", verb: "took {label} down to edit" },
  archive: { action: "post.archive", verb: "archived {label}" },
};

/**
 * Moves a post along its workflow. Staff need the FLOWS.post permission for the edge; only the
 * scheduler (a system actor) takes `publish_due`. Returns the post's tags when the public site changes.
 */
export async function transitionPost(actor: ContentActor, input: unknown): Promise<WriteOutcome> {
  const parsed = TransitionPostInput.safeParse(input);
  if (!parsed.success) return fail(validationFrom(parsed.error.issues));
  const { id, baseVersion, edge, notes, publishAt, checklist } = parsed.data;
  const now = Date.now();
  const edgeId = flowEdge(edge, publishAt, now);
  const spec = edgeById("post", edgeId);
  if (!spec) return notAllowed("That step isn't available for posts.");
  if (isSystem(actor)) {
    if (!spec.who.includes("system")) return forbidden("Only a person can take this step.");
  } else if (!canTakeEdge(spec, actor.perms)) {
    return forbidden(edge === "submit" ? "You don't have access to posts." : "Only a content manager can do this.");
  }
  if (edge === "request_changes" && !notes) return fail({ kind: "validation", fields: { notes: "Please say what should change." } });
  if (!writable()) return unavailable();

  const key: RecordKey = { kind: "item", collection: "posts", id };
  const index = edge === "approve" ? await readMediaIndexUncached() : {};
  let after: Post | null = null;
  return guarded(`post:${id}:${edge}`, async () => {
    await ensureSeeded("posts");
    const out = await getStore().runTransaction(async (tx) => {
      const rec = toRecord(id, await tx.get<Partial<Envelope>>(recordPath(key))) as StoredRecord<unknown> | null;
      if (!rec) throw new ConflictSignal({ kind: "not_allowed", message: "This post no longer exists." });
      if (rec.version !== baseVersion) throw new ConflictSignal(conflictOf(rec));
      const currentRaw = edge === "unpublish" || edge === "archive" ? rec.published : (rec.draft ?? rec.published);
      const current = PostSchema.safeParse(currentRaw);
      if (!current.success) throw new ConflictSignal(validationFrom(current.error.issues));
      const post = current.data;
      const fromOk = spec.from === "any_open" || (spec.from as readonly string[]).includes(post.status);
      if (!fromOk) {
        throw new ConflictSignal({ kind: "not_allowed", message: `This post is “${STATUS_LABEL.post[post.status]}” now. Reload to see the latest.` });
      }
      const who = actorId(actor);
      let next: Post;
      let published: unknown = rec.published;
      let draft: unknown = rec.draft;
      let visibility = rec.visibility;
      let publishedAt = rec.publishedAt;

      switch (edgeId) {
        case "submit":
          next = { ...post, status: "in_review", review: { ...post.review, submittedBy: who, submittedAt: now } };
          draft = next;
          break;
        case "request_changes":
          next = { ...post, status: "draft", review: { ...post.review, notes, reviewer: who, reviewedAt: now } };
          draft = next;
          break;
        case "schedule":
        case "publish": {
          if (post.origin.kind === "ai" && isSystem(actor)) throw new ConflictSignal({ kind: "forbidden", message: "AI drafts must be approved by a person." });
          const reviewed: Post = {
            ...post,
            review: { ...post.review, checklist: { ...post.review.checklist, ...(checklist ?? {}) }, reviewer: who, reviewedAt: now },
          };
          const reasons = gateReasons(["review"], reviewed, { index, previous: rec.published, placeholder: rec.placeholder, now });
          // The template writer's "✎ Write a few lines about…" placeholders must be replaced first.
          if ((reviewed.body as Array<{ type: string; text?: string }>).some((b) => b.type === "callout" && typeof b.text === "string" && b.text.startsWith("✎"))) {
            reasons.push("Replace every “✎ Write a few lines about…” box with your own words.");
          }
          if (reasons.length) throw new ConflictSignal({ kind: "blocked", message: "This post can't go live yet.", reasons });
          if (edgeId === "schedule") {
            next = { ...reviewed, status: "scheduled", publishAt };
            draft = next;
          } else {
            next = { ...reviewed, status: "published", publishedAt: now };
            published = next;
            draft = null;
            visibility = "live";
            publishedAt = now;
          }
          break;
        }
        case "publish_due": {
          const at = post.publishAt ?? now;
          if (at > now) throw new ConflictSignal({ kind: "not_allowed", message: "This post isn't due yet." });
          next = { ...post, status: "published", publishedAt: at };
          published = next;
          draft = null;
          visibility = "live";
          publishedAt = at;
          break;
        }
        case "unpublish":
          next = { ...post, status: "draft" };
          published = null;
          draft = next;
          break;
        case "archive":
          next = { ...post, status: "archived" };
          published = next;
          draft = null;
          visibility = "archived";
          break;
        default:
          throw new ConflictSignal({ kind: "not_allowed", message: "That step isn't available for posts." });
      }

      const record: StoredRecord<unknown> = {
        ...rec,
        published,
        draft,
        visibility,
        version: rec.version + 1,
        updatedAt: now,
        updatedBy: who,
        ...(publishedAt !== undefined ? { publishedAt } : {}),
        ...(published !== rec.published && (edgeId === "publish" || edgeId === "publish_due") ? { publishedBy: who } : {}),
      };
      tx.set(recordPath(key), envelopeOf(record, actorName(actor)));
      if (rec.published !== null && published !== rec.published) snapshotVersion(tx, key, rec.version, rec.published, actor, now);
      const a = AUDIT[edgeId];
      auditWrite(tx, actor, key, a.action, a.verb, next, [{ path: "status", before: post.status, after: next.status }], edgeId !== "request_changes");
      after = next;
      return { version: record.version, at: now };
    });
    const publicChange = edgeId === "publish" || edgeId === "publish_due" || edgeId === "unpublish" || edgeId === "archive";
    if (edgeId === "submit" && after) await notifyReviewers(after as Post);
    return done(actionOk(out), publicChange ? tagsFor(key, after) : []);
  });
}

async function notifyReviewers(post: Post): Promise<void> {
  try {
    const recipientUids = await recipientsFor("post_review");
    if (recipientUids.length === 0) return;
    await notify({ recipientUids, kind: "status_changed", title: "A post is waiting for review", href: `/admin/posts/review/${encodeURIComponent(post.slug)}` });
  } catch (err) {
    log.warn("post.notify_failed", { err });
  }
}

/* ── AI drafts (content-model §7.3) ────────────────────────────────────── */

export const AiOriginInput = z.object({
  via: z.enum(["notes", "monthly"]),
  model: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(40),
  briefTopicId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  sources: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
});

export type AiDraftInput = PostDraftInput & {
  origin: z.input<typeof AiOriginInput>;
  author?: { displayName: string; role?: string };
  /** What the writer was unsure about and the checks to make (shown to the reviewer). */
  reviewNotes?: string;
};

function slugify(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70)
      .replace(/-+$/g, "") || "post"
  );
}

async function uniquePostSlug(base: string): Promise<string> {
  const taken = new Set<string>();
  for (const r of await contentStore().listItems("posts")) {
    taken.add(r.id);
    const d = (r.draft ?? r.published) as { slug?: string } | null;
    if (d?.slug) taken.add(d.slug);
  }
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 74)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 66)}-${Date.now().toString(36)}`;
}

/**
 * Stores an AI-written draft for human review: validated against PostDraftSchema (so it can never fail
 * to render), forced to `in_review` with origin "ai" and an empty checklist, audited, and announced to
 * the reviewers. Not a Server Action: the cron route and the AI assistant call it on the server.
 */
export async function createAiDraft(post: AiDraftInput, actor: SystemActor | Viewer): Promise<ActionResult<{ id: string; version: number; at: Millis }>> {
  const draft = PostDraftSchema.safeParse(post);
  if (!draft.success) return fail<{ id: string; version: number; at: Millis }>(validationFrom(draft.error.issues)).result;
  const origin = AiOriginInput.safeParse(post.origin);
  if (!origin.success) return fail<{ id: string; version: number; at: Millis }>(validationFrom(origin.error.issues, "origin")).result;
  if (!writable()) return unavailable<{ id: string; version: number; at: Millis }>().result;

  const now = Date.now();
  const slug = await uniquePostSlug(draft.data.slug ?? slugify(draft.data.title));
  const submittedBy = isSystem(actor) ? `system:${actor.job}` : actor.uid;
  const full = {
    ...draft.data,
    slug,
    cover: draft.data.cover ?? { $media: FALLBACK_MEDIA_ID },
    author: { displayName: post.author?.displayName ?? "Haven team", ...(post.author?.role ? { role: post.author.role } : {}) },
    status: "in_review" as const,
    review: { submittedBy, submittedAt: now, checklist: {}, ...(post.reviewNotes ? { notes: post.reviewNotes.slice(0, 1000) } : {}) },
    origin: { kind: "ai" as const, ...origin.data, generatedAt: now },
    seo: {},
  };
  const writer: SystemActor = isSystem(actor) ? actor : systemActor(`AI draft for ${actor.displayName}`);
  const outcome = await writeItem(writer, { collection: "posts", data: full, intent: "draft" });
  if (outcome.result.ok) {
    const saved = PostSchema.safeParse(full);
    if (saved.success) await notifyReviewers(saved.data);
  }
  return outcome.result;
}

/* ── Scheduled publishing (D110) ───────────────────────────────────────── */

/**
 * Publishes every scheduled post whose time has come, as the system "Scheduler", and expires its
 * cache tags immediately (revalidateTag(tag, { expire: 0 }), D16). Call from route handlers and
 * Server Actions only, never during render.
 */
export async function publishDuePosts(now: number = Date.now()): Promise<{ published: string[]; failed: string[] }> {
  const scheduler = systemActor("Scheduler");
  const published: string[] = [];
  const failed: string[] = [];
  const tags = new Set<string>();
  for (const rec of await contentStore().listItems("posts")) {
    const current = (rec.draft ?? rec.published) as { status?: string; publishAt?: number; slug?: string } | null;
    if (current?.status !== "scheduled" || current.publishAt === undefined || current.publishAt > now) continue;
    const outcome = await transitionPost(scheduler, { id: rec.id, baseVersion: rec.version, edge: "publish_due" });
    if (outcome.result.ok) {
      published.push(current.slug ?? rec.id);
      outcome.tags.forEach((t) => tags.add(t));
    } else {
      failed.push(current.slug ?? rec.id);
      log.warn("post.publish_due_failed", { id: rec.id, error: outcome.result.error.kind });
    }
  }
  for (const t of tags) revalidateTag(t, { expire: 0 });
  return { published, failed };
}

/** Labels for the admin's category picker (re-exported for convenience). */
export { POST_CATEGORY_LABEL };
