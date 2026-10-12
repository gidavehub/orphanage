import "server-only";

// Posts (admin-ux §6.12; PLAN D42, D48, D110, D129): the list by stage, the editor (an Update is one
// photo and one paragraph; an Article has a cover, summary and body blocks), the safety check, the
// review with its checklist (AI drafts also need "I've read every line"), "Send to supporters", and
// the newsletter numbers. Writes reuse lib/content (saveItem for drafts, the post workflow actions).

import { createHash } from "node:crypto";
import { z } from "zod";
import { safetyFlags, SAFETY_FLAG_LABEL } from "@/lib/content/safety";
import { PostSchema, POST_CATEGORY_LABEL, REVIEW_CHECKLIST_LABEL, type Post } from "@/lib/content/schema";
import { contentStore } from "@/lib/content/store";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { getMediaIndex, isIllustrative, toPickerItem } from "@/lib/media/index";
import type { NewsletterSubscriber } from "@/lib/model/domain/engagement";
import type { Donor } from "@/lib/model/domain/giving";
import type { MediaPickerItem } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import type { StatusOf } from "@/lib/model/status";
import { routes } from "@/lib/routes";
import { actorOf, auditTx } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { unsubscribeUrlFor } from "@/lib/server/intake/newsletter";
import { log } from "@/lib/server/log";
import { absolute } from "@/lib/server/url";
import { staffRefs } from "./_shared";

type S = StatusOf<"post">;

export type PostRowDTO = {
  id: string;
  title: string;
  format: Post["format"];
  category: string;
  status: S;
  publishAt: Millis | null;
  publishedAt: Millis | null;
  updatedAt: Millis;
  author: string;
  coverSrc: string | null;
  origin: "human" | "ai_notes" | "ai_monthly";
  hasDraft: boolean;
};

const originOf = (p: Post): PostRowDTO["origin"] => (p.origin.kind === "ai" ? (p.origin.via === "monthly" ? "ai_monthly" : "ai_notes") : "human");

export async function listPostsForStaff(): Promise<{ rows: PostRowDTO[]; counts: Partial<Record<S, number>>; canPublish: boolean; at: Millis }> {
  const v = await requireStaff("post.draft", "post.publish");
  const [records, index] = await Promise.all([contentStore().listItems("posts"), getMediaIndex()]);
  const rows: PostRowDTO[] = [];
  for (const r of records) {
    if (r.visibility === "archived" && !r.draft && !r.published) continue;
    const parsed = PostSchema.safeParse(r.draft ?? r.published);
    if (!parsed.success) continue;
    const p = parsed.data;
    const cover = index[p.cover.$media];
    rows.push({
      id: r.id,
      title: p.title,
      format: p.format,
      category: POST_CATEGORY_LABEL[p.category] ?? p.category,
      status: p.status,
      publishAt: p.publishAt ?? null,
      publishedAt: p.publishedAt ?? null,
      updatedAt: r.updatedAt,
      author: p.author.displayName,
      coverSrc: cover ? (cover.poster ?? cover.src) : null,
      origin: originOf(p),
      hasDraft: r.draft !== null && r.published !== null,
    });
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt);
  const counts: Partial<Record<S, number>> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return { rows, counts, canPublish: has(v, "post.publish"), at: Date.now() };
}

/** The fields people edit (workflow fields stay with the workflow). */
const EditableSchema = PostSchema.pick({ title: true, excerpt: true, cover: true, category: true, programmeIds: true, countries: true, tags: true, body: true, author: true, featured: true });
let editableJson: Record<string, unknown> | null = null;
function editableSchema(): Record<string, unknown> {
  editableJson ??= JSON.parse(JSON.stringify(z.toJSONSchema(EditableSchema, { io: "input", unrepresentable: "any" }))) as Record<string, unknown>;
  return editableJson;
}

export type SafetyItem = { kind: "name" | "place" | "health" | "photo" | "number" | "todo"; label: string; message: string };

/** Things to check (admin-ux §6.12 SafetyCheck): names, small places, health words, photos without consent. */
async function safetyOf(p: Post): Promise<SafetyItem[]> {
  const texts: string[] = [p.title, p.excerpt];
  for (const b of p.body as Array<Record<string, unknown>>) {
    for (const k of ["text", "attribution", "caption", "title"]) if (typeof b[k] === "string") texts.push(b[k] as string);
    if (Array.isArray(b.items)) for (const it of b.items) if (typeof it === "string") texts.push(it);
  }
  const out: SafetyItem[] = [];
  const seen = new Set<string>();
  const todos = (p.body as Array<{ type: string; text?: string }>).filter((b) => b.type === "callout" && typeof b.text === "string" && b.text.startsWith("✎"));
  for (const t of todos) out.push({ kind: "todo", label: "Still to write", message: `Replace “${(t.text ?? "").slice(0, 80)}” with your own words. It can't go live until you do.` });
  for (const t of texts) {
    for (const f of safetyFlags(t)) {
      const key = `${f.kind}:${f.text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: f.kind, label: SAFETY_FLAG_LABEL[f.kind], message: f.message });
    }
  }
  const index = await getMediaIndex();
  const ids = [p.cover.$media, ...(p.body as Array<{ media?: { $media?: string } }>).map((b) => b.media?.$media).filter((x): x is string => Boolean(x))];
  for (const id of new Set(ids)) {
    const a = index[id];
    if (!a) continue;
    const sg = a.safeguarding;
    if (sg.childInImage && !sg.aiGenerated && sg.consent.state !== "valid" && sg.consent.state !== "not_required") out.push({ kind: "photo", label: "Photo without consent", message: `“${a.alt || a.id}” shows a child and has no consent on file.` });
    else if (isIllustrative(a)) out.push({ kind: "photo", label: "Illustrative picture", message: `“${a.alt || a.id}” is AI-made: the page labels it “Illustrative image”.` });
  }
  return out;
}

export type PostEditorDTO = {
  id: string;
  version: number;
  status: S;
  slug: string;
  value: Post;
  everLive: boolean;
  schema: Record<string, unknown>;
  media: MediaPickerItem[];
  origin: PostRowDTO["origin"];
  sources: string[];
  generatedAt: Millis | null;
  review: { notes: string | null; submittedBy: string | null; submittedAt: Millis | null; checklist: Record<string, boolean>; labels: Record<string, string> };
  safety: SafetyItem[];
  can: { edit: boolean; publish: boolean; send: boolean };
  publicHref: string;
};

export async function getPostForEditor(id: string): Promise<PostEditorDTO | null> {
  const v = await requireStaff("post.draft", "post.publish");
  const rec = await contentStore().getItem("posts", id);
  if (!rec) return null;
  const parsed = PostSchema.safeParse(rec.draft ?? rec.published);
  if (!parsed.success) return null;
  const p = parsed.data;
  const [index, staff, safety] = await Promise.all([getMediaIndex(), staffRefs(), safetyOf(p)]);
  const editable = p.status === "draft" || p.status === "in_review" || (p.status === "published" && has(v, "post.publish"));
  return {
    id,
    version: rec.version,
    status: p.status,
    slug: p.slug,
    value: p,
    everLive: rec.published !== null,
    schema: editableSchema(),
    media: Object.values(index)
      .filter((a) => a.kind === "image")
      .map((a) => toPickerItem(a)),
    origin: originOf(p),
    sources: p.origin.kind === "ai" ? p.origin.sources : [],
    generatedAt: p.origin.kind === "ai" ? p.origin.generatedAt : null,
    review: {
      notes: p.review.notes ?? null,
      submittedBy: p.review.submittedBy ? (staff.get(p.review.submittedBy)?.name ?? null) : null,
      submittedAt: p.review.submittedAt ?? null,
      checklist: { ...p.review.checklist },
      labels: { ...REVIEW_CHECKLIST_LABEL },
    },
    safety,
    can: { edit: editable && (has(v, "post.draft") || has(v, "post.publish")), publish: has(v, "post.publish"), send: has(v, "supporters.send") },
    publicHref: routes.post(p.slug),
  };
}

/* ── Send to supporters (D129) ──────────────────────────────────────────── */

type Recipient = { email: string; firstName: string | null };

async function audience(): Promise<{ recipients: Recipient[]; subscribers: number; donors: number; unconfirmed: number }> {
  const store = getStore();
  const subs: Array<WithId<NewsletterSubscriber>> = [];
  const donors: Array<WithId<Donor>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 50; i++) {
    const page: { items: Array<WithId<NewsletterSubscriber>>; nextCursor: string | null } = await store.list<NewsletterSubscriber>(C.newsletterSubscribers, { orderBy: { field: "createdAt", dir: "asc" }, limit: 100, cursor });
    subs.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  cursor = null;
  for (let i = 0; i < 50; i++) {
    const page: { items: Array<WithId<Donor>>; nextCursor: string | null } = await store.list<Donor>(C.donors, { orderBy: { field: "createdAt", dir: "asc" }, limit: 100, cursor });
    donors.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  const byEmail = new Map<string, Recipient>();
  let subscribers = 0;
  let consented = 0;
  for (const s of subs) {
    if (s.status !== "confirmed" || !s.emailLower) continue;
    subscribers++;
    byEmail.set(s.emailLower, { email: s.email ?? s.emailLower, firstName: s.firstName });
  }
  for (const d of donors) {
    if (!d.updatesConsent || d.updatesWithdrawnAt || !d.emailLower) continue;
    consented++;
    if (!byEmail.has(d.emailLower)) byEmail.set(d.emailLower, { email: d.email, firstName: (d as { firstName?: string | null }).firstName ?? null });
  }
  return { recipients: [...byEmail.values()], subscribers, donors: consented, unconfirmed: subs.filter((s) => s.status === "pending").length };
}

export async function supportersPreview(): Promise<{ total: number; subscribers: number; donors: number; unconfirmed: number }> {
  await requireStaff("supporters.send");
  const a = await audience();
  return { total: a.recipients.length, subscribers: a.subscribers, donors: a.donors, unconfirmed: a.unconfirmed };
}

/** Queues one `supporter_update` per recipient (deduped per post and address; suppressions apply at delivery). */
export async function sendToSupporters(postId: string): Promise<ActionResult<{ queued: number }>> {
  const v = await requireStaff("supporters.send");
  const rec = await contentStore().getItem("posts", postId);
  const parsed = PostSchema.safeParse(rec?.published);
  if (!rec || !parsed.success || parsed.data.status !== "published") return actionError({ kind: "not_allowed", message: "Only a live post can be sent to supporters." });
  const post = parsed.data;
  const { recipients } = await audience();
  if (!recipients.length) return actionError({ kind: "not_allowed", message: "There's no one to send to yet." });
  const link = absolute(routes.post(post.slug));
  let queued = 0;
  try {
    for (let i = 0; i < recipients.length; i += 50) {
      const batch = recipients.slice(i, i + 50);
      await getStore().runTransaction(async (tx) => {
        for (const r of batch) {
          const key = `${postId}~${createHash("sha256").update(r.email.toLowerCase()).digest("hex").slice(0, 16)}`;
          const out = await enqueueEmailTx(tx, {
            template: "supporter_update",
            to: [r.email],
            vars: { firstName: r.firstName ?? "", link, unsubscribeUrl: unsubscribeUrlFor(r.email), title: post.title, excerpt: post.excerpt },
            dedupeKey: key,
          });
          if (!out.deduped) queued++;
        }
        if (i === 0) auditTx(tx, { actor: actorOf(v), action: "supporters.send", area: "content", summary: `${v.displayName} sent “${post.title}” to supporters`, feed: true, targetPath: `posts/${postId}` });
      });
    }
  } catch (err) {
    log.error("dal.posts.send_failed", { postId, err });
    return actionError({ kind: "unavailable", message: "Not every email was queued. Try again: people already queued won't get it twice." });
  }
  return actionOk({ queued });
}

/* ── Settings › Newsletter ─────────────────────────────────────────────── */

export async function newsletterStats(): Promise<{ confirmed: number; pending: number; unsubscribed: number; bySource: Record<string, number>; consentedDonors: number }> {
  await requireStaff("newsletter.read", "settings.manage");
  const a = await audience();
  const store = getStore();
  const subs: Array<WithId<NewsletterSubscriber>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 50; i++) {
    const page: { items: Array<WithId<NewsletterSubscriber>>; nextCursor: string | null } = await store.list<NewsletterSubscriber>(C.newsletterSubscribers, { orderBy: { field: "createdAt", dir: "asc" }, limit: 100, cursor });
    subs.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  const bySource: Record<string, number> = {};
  for (const s of subs) if (s.status === "confirmed") bySource[s.source] = (bySource[s.source] ?? 0) + 1;
  return {
    confirmed: subs.filter((s) => s.status === "confirmed").length,
    pending: subs.filter((s) => s.status === "pending").length,
    unsubscribed: subs.filter((s) => s.status === "unsubscribed").length,
    bySource,
    consentedDonors: a.donors,
  };
}
