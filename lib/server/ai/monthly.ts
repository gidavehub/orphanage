import "server-only";

// The monthly story draft (integrations §5.6). One job per month in aiJobs/monthly-{YYYY-MM} (the
// November draft is about October). The fact sheet goes to the provider chain; the validator's hard
// findings get one retry and are then handed to the reviewer. With AI off (or every provider failing)
// the template writer makes a draft with "✎" boxes to fill in. Either way the draft waits in review:
// AI never publishes. Prompts and outputs are never logged; aiJobs keeps metadata only.

import type { AiJob } from "@/lib/model/domain/system";
import type { PostDraftInput } from "@/lib/content/schema";
import type { Millis } from "@/lib/model/enums";
import { systemActor } from "@/lib/model/viewer";
import { createAiDraft } from "@/lib/content/posts";
import { getEditorialSettings } from "@/lib/content/public";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";
import { notify, recipientsFor } from "@/lib/server/notify";
import { countries as worldCountries } from "@/content/world";
import { chooseCover } from "./cover";
import { buildFactSheet, type FactSheet } from "./facts";
import { PROMPT_VERSION, MONTHLY_SYSTEM, monthlyUser } from "./prompts/monthly";
import { generateWithChain, textModels } from "./provider";
import { AiPostDraft } from "./schemas";
import { templateDraft } from "./template";
import type { Flag } from "./types";
import { validateDraft } from "./validate";

const PLACE_CODES = new Set(worldCountries.map((c) => c.code));

/** "2026-11" for a time (UTC). */
export function monthKey(at: Millis = Date.now()): string {
  return new Date(at).toISOString().slice(0, 7);
}

/** The month before a "YYYY-MM" key. */
export function previousMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function toPostDraft(d: AiPostDraft, sheet: FactSheet): PostDraftInput {
  let i = 0;
  const id = () => `a${(i++).toString(36)}`;
  const body: PostDraftInput["body"] = [];
  for (const b of d.body) {
    if (b.type === "stat") {
      if (sheet.verifiedStatIds.includes(b.statId)) body.push({ id: id(), type: "stat", statId: b.statId });
      continue;
    }
    if (b.type === "cta") {
      body.push({ id: id(), type: "cta", kind: b.kind === "cause" && b.causeSlug && sheet.liveCauses.includes(b.causeSlug) ? "cause" : "donate", ...(b.kind === "cause" && b.causeSlug && sheet.liveCauses.includes(b.causeSlug) ? { causeSlug: b.causeSlug } : {}) });
      continue;
    }
    if (b.type === "list") body.push({ id: id(), type: "list", style: b.style, items: b.items });
    else if (b.type === "heading") body.push({ id: id(), type: "heading", level: b.level, text: b.text });
    else body.push({ id: id(), type: "paragraph", text: b.text });
  }
  return {
    format: "article",
    title: d.title,
    excerpt: d.excerpt,
    category: d.category,
    programmeIds: d.programmeIds,
    causeSlugs: [],
    countries: d.countries.map((c) => c.toLowerCase()).filter((c) => PLACE_CODES.has(c)),
    tags: [],
    body,
  } as PostDraftInput;
}

function reviewNotes(notes: string, flags: Flag[], fallback: string | null): string {
  const hard = flags.filter((f) => f.severity === "hard");
  const soft = flags.filter((f) => f.severity === "soft");
  const parts = [
    fallback ? `Written without AI (${fallback}).` : "",
    hard.length ? `Check before it goes live:\n${hard.map((f) => `• ${f.text}`).join("\n")}` : "",
    soft.length ? `Worth a look:\n${soft.slice(0, 6).map((f) => `• ${f.text}`).join("\n")}` : "",
    notes ? `The writer's notes: ${notes}` : "",
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 1000);
}

async function claim(draftKey: string, force: boolean, trigger: string): Promise<{ jobId: string } | { skip: string }> {
  const store = getStore();
  const base = `monthly-${draftKey}`;
  return store.runTransaction(async (tx) => {
    const cur = await tx.get<AiJob & { attempts?: number }>(`${C.aiJobs}/${base}`);
    const now = Date.now();
    const fresh = (): AiJob & { attempts: number } => ({ kind: "monthly_blog_drafts", status: "running", month: draftKey, startedAt: now, finishedAt: null, provider: "template", model: "template", promptVersion: null, postIds: [], error: null, usage: null, triggeredBy: trigger === "cron" ? "cron" : trigger, attempts: 1 });
    if (!cur) {
      tx.create(`${C.aiJobs}/${base}`, fresh());
      return { jobId: base };
    }
    if (!force) {
      if (cur.status === "succeeded") return { skip: "already_done" };
      if (cur.status === "running" && now - cur.startedAt < 10 * 60_000) return { skip: "running" };
      if ((cur.attempts ?? 1) >= 3) return { skip: "too_many_attempts" };
      tx.set(`${C.aiJobs}/${base}`, { ...fresh(), attempts: (cur.attempts ?? 1) + 1 });
      return { jobId: base };
    }
    // "Draft this month's story now": another run under its own id.
    for (let n = 2; n < 20; n++) {
      const id = `${base}-${n}`;
      if (!(await tx.get(`${C.aiJobs}/${id}`))) {
        tx.create(`${C.aiJobs}/${id}`, fresh());
        return { jobId: id };
      }
    }
    return { skip: "too_many_runs" };
  });
}

export type MonthlyResult = { created: string | null; reason?: string; provider?: string };

/** Creates this month's draft (or `month`'s). `force` runs again even if one exists (the admin button). */
export async function runMonthlyDraft(opts: { force?: boolean; month?: string; trigger?: string } = {}): Promise<MonthlyResult> {
  const draftKey = opts.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : monthKey();
  const periodKey = previousMonth(draftKey);
  const c = await claim(draftKey, opts.force === true, opts.trigger ?? "cron");
  if ("skip" in c) return { created: null, reason: c.skip };
  const jobPath = `${C.aiJobs}/${c.jobId}`;
  const store = getStore();
  try {
    const sheet = await buildFactSheet(periodKey);
    const hasAi = textModels().length > 0;
    if (hasAi && sheet.substance < 2 && sheet.verifiedStatIds.length === 0) {
      const reviewers = await recipientsFor("post_review").catch(() => []);
      if (reviewers.length) await notify({ recipientUids: reviewers, kind: "system", title: `Not much to write about for ${sheet.period.label}. Add a few updates or topics, then press “Draft now”.`, href: "/admin/posts/plan" });
      await store.update(jobPath, { status: "succeeded", finishedAt: Date.now(), error: "skipped_thin" });
      return { created: null, reason: "thin" };
    }

    let post: PostDraftInput;
    let provider: "anthropic" | "gemini" | "template" = "template";
    let model = "template";
    let usage: AiJob["usage"] = null;
    let notes = "";
    let flags: Flag[] = [];
    let fallback: string | null = hasAi ? null : "the writing helper is off";
    let cover: AiPostDraft["cover"] | null = null;

    if (hasAi) {
      let gen = await generateWithChain({ system: MONTHLY_SYSTEM, user: monthlyUser(sheet), schema: AiPostDraft, maxOutputTokens: 16000, effort: "medium" });
      if (gen.result) {
        flags = validateDraft(gen.result.data, sheet);
        const hard = flags.filter((f) => f.severity === "hard");
        if (hard.length) {
          const retry = await generateWithChain({ system: MONTHLY_SYSTEM, user: monthlyUser(sheet, hard.map((f) => f.text).join(" | ")), schema: AiPostDraft, maxOutputTokens: 16000, effort: "medium" });
          if (retry.result) {
            const again = validateDraft(retry.result.data, sheet);
            if (again.filter((f) => f.severity === "hard").length <= hard.length) {
              gen = retry;
              flags = again;
            }
          }
        }
        const r = gen.result!;
        post = toPostDraft(r.data, sheet);
        provider = r.provider;
        model = r.model;
        usage = r.usage;
        notes = r.data.notesForReviewer;
        cover = r.data.cover;
        fallback = r.fallbackNote;
      } else {
        fallback = gen.reasons.join("; ") || "no provider answered";
        post = templateDraft(sheet, sheet.period.label);
      }
    } else {
      post = templateDraft(sheet, sheet.period.label);
    }

    const chosen = await chooseCover(post, cover).catch(() => null);
    if (chosen) post.cover = { $media: chosen };
    const saved = await createAiDraft(
      {
        ...post,
        origin: { via: "monthly", model, promptVersion: provider === "template" ? "template-1" : PROMPT_VERSION, sources: sheet.facts.map((f) => f.source).slice(0, 40) },
        reviewNotes: reviewNotes(notes, flags, provider === "template" ? fallback : null),
      },
      systemActor("Monthly AI draft"),
    );
    if (!saved.ok) throw new Error(saved.error.kind === "validation" ? `draft invalid: ${Object.keys(saved.error.fields).join(",")}` : saved.error.kind);
    await store.update(jobPath, { status: "succeeded", finishedAt: Date.now(), provider, model, promptVersion: provider === "template" ? "template-1" : PROMPT_VERSION, postIds: [saved.data.id], usage, error: fallback });
    log.info("ai.monthly_draft", { job: c.jobId, provider, flags: flags.length });
    return { created: saved.data.id, provider };
  } catch (err) {
    log.error("ai.monthly_failed", { job: c.jobId, err });
    await store.update(jobPath, { status: "failed", finishedAt: Date.now(), error: err instanceof Error ? err.message.slice(0, 200) : "failed" }).catch(() => undefined);
    return { created: null, reason: "failed" };
  }
}

/** For the editorial cron: is today the configured day, and is drafting switched on? */
export async function editorialDue(now: Millis = Date.now()): Promise<{ due: boolean; reason?: string }> {
  const s = await getEditorialSettings();
  if (!s.aiDrafting?.enabled) return { due: false, reason: "paused" };
  if (new Date(now).getUTCDate() !== (s.aiDrafting.dayOfMonth ?? 1)) return { due: false, reason: "not_today" };
  return { due: true };
}
