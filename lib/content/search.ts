import "server-only";

// Site search (PLAN D115, public-pages §3.22). An in-memory index over PUBLIC content only: the
// titles, summaries and headings (plus a little body text for snippets) of programmes, pages,
// policies, live causes, published posts, stories, FAQs, projects and published library resources.
// It never reads support requests, concerns or any other private collection, and every source goes
// through the same cached public readers the pages use, so a hidden or draft item can never surface.
//
// The index is built once per content change inside 'use cache' (tagged with every source), and each
// query is scored against it in memory (fewer than 500 documents, so a linear scan is instant).

import { cacheLife, cacheTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import { pageDocId, type PageKey } from "@/lib/content/ids";
import { inlineToPlain } from "@/lib/content/inline";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { getResources } from "@/lib/server/public/resources";
import { getCauses, getCollection, getFaqs, getPage, getPolicies, getProgrammes, getStories } from "./read";

export type SearchHitType = "programme" | "page" | "resource" | "news" | "story" | "faq" | "cause" | "project";

export type SearchHit = {
  type: SearchHitType;
  title: string;
  /** Plain text, at most ~160 characters, no markup. */
  snippet: string;
  href: string;
};

/** Display order of the groups in the overlay and on /search (public-pages §3.22). */
export const SEARCH_TYPE_ORDER: readonly SearchHitType[] = ["programme", "page", "cause", "resource", "news", "story", "project", "faq"];

/* ── Index documents ───────────────────────────────────────────────────── */

type IndexDoc = {
  type: SearchHitType;
  title: string;
  href: string;
  /** Plain summary shown as the snippet when it matches (or when nothing else does). */
  summary: string;
  /** Plain body text, used only to cut a snippet around a match. */
  body: string;
  /** Normalised fields for matching. */
  n: { title: string; headings: string; summary: string; body: string };
};

/** Public pages and their URLs. thankYou, search and notFound are never results. */
const PAGE_HREF: Partial<Record<PageKey, string>> = {
  about: routes.about(),
  programmes: routes.programmes(),
  getSupport: routes.getSupport(),
  requestSupport: routes.request(),
  reportConcern: routes.concern(),
  contact: routes.contact(),
  resources: routes.resources(),
  requestReport: routes.requestReport(),
  impact: routes.impact(),
  projects: routes.projects(),
  stories: routes.stories(),
  shareStory: routes.shareStory(),
  news: routes.news(),
  getInvolved: routes.involved(),
  volunteer: routes.volunteer(),
  partner: routes.partner(),
  sponsor: routes.sponsor(),
  donate: routes.donate(),
  faq: routes.faq(),
  policies: routes.policies(),
  privacyRequest: routes.privacyRequest(),
};
const PAGE_KEYS_INDEXED = Object.keys(PAGE_HREF) as PageKey[];

const REF_RE = /\bHVN-[A-Z0-9-]+/gi;
const MAX_TEXT = 4000;

/** Lower-case ASCII words separated by single spaces (accents folded, apostrophes dropped). */
function normalise(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clean(s: string | undefined | null): string {
  if (!s) return "";
  return inlineToPlain(s).replace(REF_RE, "").replace(/\s+/g, " ").trim();
}

/** The text-bearing blocks (paragraphs, headings, lists, quotes, callouts); media blocks are skipped. */
type TextBlock = { type: string; text?: unknown; title?: unknown; items?: unknown };
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function blockText(blocks: ReadonlyArray<TextBlock> | undefined): { text: string; headings: string[] } {
  const parts: string[] = [];
  const headings: string[] = [];
  for (const b of blocks ?? []) {
    if (b.type === "heading") headings.push(clean(str(b.text)));
    else if (b.type === "paragraph" || b.type === "quote") parts.push(clean(str(b.text)));
    else if (b.type === "list" && Array.isArray(b.items)) parts.push(b.items.map((i) => clean(str(i))).join(". "));
    else if (b.type === "callout") {
      if (b.title) headings.push(clean(str(b.title)));
      parts.push(clean(str(b.text)));
    }
  }
  return { text: parts.filter(Boolean).join(" ").slice(0, MAX_TEXT), headings: headings.filter(Boolean) };
}

function doc(type: SearchHitType, title: string, href: string, o: { summary?: string; headings?: string[]; body?: string; keywords?: string[] }): IndexDoc {
  const t = clean(title);
  const summary = clean(o.summary);
  const body = clean(o.body).slice(0, MAX_TEXT);
  const headings = [...(o.headings ?? []), ...(o.keywords ?? [])].map(clean).filter(Boolean);
  return {
    type,
    title: t,
    href,
    summary,
    body,
    n: { title: normalise(t), headings: normalise(headings.join(" ")), summary: normalise(summary), body: normalise(body) },
  };
}

/** Every published resource (the library pages through 12 at a time). */
async function allResources() {
  const first = await getResources({ page: 1 });
  const items = [...first.items];
  const pages = Math.min(40, Math.ceil(first.total / Math.max(1, first.items.length || 1)));
  for (let page = 2; page <= pages && items.length < first.total; page++) {
    const next = await getResources({ page });
    if (!next.items.length) break;
    items.push(...next.items);
  }
  return items;
}

/** The whole index, rebuilt whenever any of its sources changes. */
async function getSearchIndex(): Promise<IndexDoc[]> {
  "use cache";
  cacheLife("content");
  cacheTag(
    TAG.col("programmes"),
    TAG.col("causes"),
    TAG.col("posts"),
    TAG.col("stories"),
    TAG.col("faqs"),
    TAG.col("projects"),
    TAG.col("policies"),
    TAG.col("resources"),
    TAG.donationTotals,
    TAG.doc("settings.site"),
    ...PAGE_KEYS_INDEXED.map((k) => TAG.doc(pageDocId(k))),
  );

  const [programmes, causes, posts, stories, faqs, projects, policies, resources, pages] = await Promise.all([
    getProgrammes(),
    getCauses(),
    getCollection("posts"),
    getStories(),
    getFaqs(),
    getCollection("projects"),
    getPolicies(),
    allResources(),
    Promise.all(PAGE_KEYS_INDEXED.map(async (key) => ({ key, page: await getPage(key) }))),
  ]);

  const out: IndexDoc[] = [];

  for (const p of programmes) {
    const overview = blockText(p.overview);
    const problem = blockText(p.problem.body);
    out.push(
      doc("programme", p.title, p.href, {
        summary: p.summary,
        headings: [
          p.fullTitle,
          p.headline,
          p.navBlurb,
          p.problem.heading,
          p.support.heading,
          ...p.support.items.map((i) => i.title),
          p.eligibility.heading,
          p.process.heading,
          ...p.process.steps.map((s) => s.title),
          ...overview.headings,
        ],
        body: [overview.text, problem.text, p.support.intro ?? "", ...p.support.items.map((i) => i.text ?? ""), p.eligibility.intro].join(" "),
      }),
    );
  }

  for (const { key, page } of pages) {
    const href = PAGE_HREF[key];
    if (!href) continue;
    const headings: string[] = [];
    const body: string[] = [];
    for (const section of Object.values(page.sections ?? {})) {
      if (section.eyebrow) headings.push(section.eyebrow);
      if (section.title) headings.push(section.title.join(" "));
      for (const item of section.items ?? []) {
        headings.push(item.title);
        if (item.text) body.push(item.text);
      }
      const b = blockText(section.body);
      headings.push(...b.headings);
      body.push(b.text);
    }
    const title = page.seo?.title || page.hero.title.join(" ");
    out.push(
      doc("page", title, href, {
        summary: page.hero.intro || page.seo?.description || "",
        headings: [page.hero.title.join(" "), page.hero.eyebrow ?? "", ...headings],
        body: body.join(" "),
      }),
    );
  }

  for (const p of policies) {
    const b = blockText(p.body);
    out.push(doc("page", p.title, p.href, { summary: p.summary.join(" "), headings: b.headings, body: b.text }));
  }

  for (const c of causes) {
    const story = blockText(c.story);
    out.push(
      doc("cause", c.title, c.href, {
        summary: c.summary,
        headings: [c.eyebrow ?? "", c.season, ...story.headings, ...c.inKindItems, c.zakatEligible ? "zakat" : "", "donate give"],
        body: [story.text, c.place ?? ""].join(" "),
      }),
    );
  }

  for (const p of posts) {
    if (p.status !== "published") continue;
    const b = blockText(p.body);
    out.push(doc("news", p.title, routes.post(p.slug), { summary: p.excerpt, headings: [...b.headings, ...p.tags], body: b.text }));
  }

  for (const s of stories) {
    out.push(doc("story", s.label, routes.story(s.id), { summary: s.text, headings: [s.meta], body: s.place }));
  }

  for (const f of faqs) {
    out.push(doc("faq", f.q, routes.faq(), { summary: f.a }));
  }

  for (const p of projects) {
    const b = blockText(p.body);
    out.push(doc("project", p.title, routes.project(p.slug), { summary: p.summary || p.subtitle, headings: [p.subtitle, ...b.headings], body: b.text }));
  }

  for (const r of resources) {
    out.push(
      doc("resource", r.title, routes.resource(r.slug), {
        summary: r.shortDescription,
        headings: [RESOURCE_CATEGORY_LABEL[r.category] ?? ""],
      }),
    );
  }

  return out;
}

/* ── Querying ──────────────────────────────────────────────────────────── */

const STOPWORDS = new Set([
  "a", "an", "and", "are", "at", "be", "by", "can", "do", "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
  "our", "the", "to", "we", "what", "when", "where", "who", "with", "you", "your",
]);

/** UK/US spellings and everyday words people type for the same thing (matched at a lower weight). */
const SYNONYMS: Record<string, string[]> = {
  counseling: ["counselling"],
  counselor: ["counsellor"],
  therapy: ["counselling", "psychological"],
  mental: ["psychological", "counselling"],
  program: ["programme"],
  programs: ["programmes"],
  organization: ["organisation"],
  center: ["centre"],
  school: ["education"],
  fees: ["education"],
  doctor: ["medical"],
  hospital: ["medical"],
  health: ["medical"],
  lawyer: ["legal"],
  law: ["legal"],
  abuse: ["protection", "safeguarding", "concern"],
  danger: ["concern", "emergency"],
  give: ["donate"],
  donation: ["donate"],
  donations: ["donate"],
  money: ["donate"],
  sponsor: ["sponsorship"],
  report: ["reports"],
  help: ["support"],
};

type Field = keyof IndexDoc["n"];
const WEIGHT: Record<Field, number> = { title: 10, headings: 5, summary: 4, body: 1.5 };
const TYPE_BOOST: Record<SearchHitType, number> = { programme: 1.5, page: 1.15, cause: 1.05, resource: 1, news: 0.95, story: 0.9, project: 1, faq: 1 };

/** Word-prefix variants of a token: itself plus simple singulars ("fees" → "fee", "stories" → "story"). */
function variants(token: string): string[] {
  const v = new Set([token]);
  if (token.length > 4 && token.endsWith("ies")) v.add(`${token.slice(0, -3)}y`);
  if (token.length > 3 && token.endsWith("es")) v.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("s")) v.add(token.slice(0, -1));
  if (token.length > 5 && token.endsWith("ing")) v.add(token.slice(0, -3));
  return [...v];
}

/**
 * How well one token matches one document (0 = no match): the best field's weight plus a quarter of
 * every other field that also matches, so a page that is about the word beats one that mentions it
 * once in a title. Whole words score a little higher than prefixes; synonyms count at 60%.
 */
function tokenScore(d: IndexDoc, token: string): number {
  const tries: Array<[string, number]> = [
    ...variants(token).map((t): [string, number] => [t, 1]),
    ...(SYNONYMS[token] ?? []).map((t): [string, number] => [t, 0.6]),
  ];
  const perField: number[] = [];
  for (const field of Object.keys(WEIGHT) as Field[]) {
    const hay = ` ${d.n[field]} `;
    let best = 0;
    for (const [t, factor] of tries) {
      if (!hay.includes(` ${t}`)) continue;
      const whole = hay.includes(` ${t} `) ? 1.2 : 1;
      best = Math.max(best, WEIGHT[field] * factor * whole);
    }
    if (best > 0) perField.push(best);
  }
  if (!perField.length) return 0;
  const top = Math.max(...perField);
  return top + 0.25 * (perField.reduce((a, b) => a + b, 0) - top);
}

function cut(text: string, max = 160): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const at = slice.lastIndexOf(" ");
  return `${slice.slice(0, at > max * 0.6 ? at : max).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** The summary when it mentions the query (or nothing does), else a window of body text around the first match. */
function snippetFor(d: IndexDoc, tokens: string[]): string {
  const inSummary = tokens.some((t) => ` ${d.n.summary}`.includes(` ${t}`));
  if (inSummary || !d.body) return cut(d.summary || d.body);
  const lower = d.body.toLowerCase();
  let at = -1;
  for (const t of tokens) {
    const i = lower.search(new RegExp(`\\b${t.replace(/[^a-z0-9]/g, "")}`));
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return cut(d.summary || d.body);
  const start = Math.max(0, lower.lastIndexOf(" ", Math.max(0, at - 50)) + 1);
  const window = d.body.slice(start);
  return `${start > 0 ? "…" : ""}${cut(window, start > 0 ? 158 : 160)}`;
}

/** Query words (stopwords dropped unless nothing else is left), at most eight. */
export function searchTokens(q: string): string[] {
  const words = normalise(q).split(" ").filter((w) => w.length >= 2);
  const meaningful = words.filter((w) => !STOPWORDS.has(w));
  return [...new Set(meaningful.length ? meaningful : words)].slice(0, 8);
}

/**
 * Public content matching `q`, best first (programmes and pages lead on ties). Every query word must
 * match; when that finds nothing, any word may (at a lower score). A query that looks like a Haven
 * reference returns nothing: references are private and never searchable.
 */
export async function searchSite(q: string, limit = 8): Promise<SearchHit[]> {
  const raw = (q ?? "").slice(0, 120);
  if (/\bhvn\b|\bhvn-/i.test(raw)) return [];
  const tokens = searchTokens(raw);
  if (!tokens.length) return [];
  const max = Math.max(1, Math.min(50, Math.trunc(limit)));
  const phrase = normalise(raw);
  const index = await getSearchIndex();

  const rank = (all: boolean) =>
    index
      .map((d) => {
        const scores = tokens.map((t) => tokenScore(d, t));
        const matched = scores.filter((s) => s > 0).length;
        if (matched === 0 || (all && matched < tokens.length)) return null;
        let score = scores.reduce((a, b) => a + b, 0) * (all ? 1 : 0.5 * (matched / tokens.length));
        if (tokens.length > 1 && d.n.title.includes(phrase)) score += 8;
        if (d.n.title === phrase) score += 15;
        if (tokens.length > 1 && d.n.summary.includes(phrase)) score += 3;
        return { d, score: score * TYPE_BOOST[d.type] };
      })
      .filter((x): x is { d: IndexDoc; score: number } => x !== null);

  let ranked = rank(true);
  if (!ranked.length && tokens.length > 1) ranked = rank(false);

  const seen = new Set<string>();
  return ranked
    .sort((a, b) => b.score - a.score || a.d.title.localeCompare(b.d.title))
    .filter(({ d }) => {
      // FAQs share one URL: keep them all, but never list the same page twice.
      const key = d.type === "faq" ? `${d.href}|${d.title}` : d.href;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max)
    .map(({ d }) => ({ type: d.type, title: d.title, snippet: snippetFor(d, tokens), href: d.href }));
}

/** Hits grouped in display order, each group keeping the hits' rank order. */
export function groupHits(hits: readonly SearchHit[]): Array<{ type: SearchHitType; hits: SearchHit[] }> {
  return SEARCH_TYPE_ORDER.map((type) => ({ type, hits: hits.filter((h) => h.type === type) })).filter((g) => g.hits.length > 0);
}
