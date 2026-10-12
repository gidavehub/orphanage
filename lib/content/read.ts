import "server-only";

// The public content read path (content-model §4.3; PLAN D13–D15, D21, D38–D46, §4.5).
// - Readers are 'use cache' + cacheLife('content') + cacheTag(TAG…) and never read cookies() or
//   headers(). They read draftMode() (allowed inside 'use cache'; it bypasses the cache), so staff
//   previewing see drafts and hidden items.
// - Stored data is merged over the seeds and parsed on every read (G3): a doc that fails its schema
//   falls back to its defaults; an item that fails is dropped; both are reported.
// - Time-derived values (the year, years of service, seasonal windows) are computed only inside
//   'use cache' scopes and refreshed daily by the `content` profile (D14–D15).
// Pages import these through lib/content/public.ts only (D21).

import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { DEFAULT_DOCS, PLACEHOLDER_DOC_IDS } from "./defaults";
import { mediaIdsIn } from "./gate";
import { COLLECTION_NAMES, DOC_IDS, isCollectionName, pageDocId, type CollectionName, type DocId, type PageKey } from "./ids";
import {
  addressLine,
  asImage,
  asImageOrVideo,
  asVideo,
  cardDate,
  ctaView,
  longDate,
  phoneHref,
  reportInvalid,
  resolveMedia,
  toResolvedStat,
} from "./resolve";
import {
  DocSchemas,
  ItemSchemas,
  POST_CATEGORY_LABEL,
  PROGRAMME_NOTICE_TONE,
  type CauseKind,
  type DocData,
  type FaqPlacement,
  type Item,
  type PolicySlug,
  type PostCategory,
  type PostFormat,
  type ProjectStatus,
  type Visibility,
} from "./schema";
import { contentStore } from "./store";
import type {
  AllocationSummaryView,
  CauseCard,
  CauseView,
  ContactView,
  DonateConfigView,
  FaqView,
  HomeView,
  PageView,
  PartnerView,
  PolicyView,
  PostCard,
  ProgrammeCard,
  ProjectCard,
  ProjectView,
  Resolved,
  ResolvedPost,
  ResolvedProgramme,
  ResolvedStat,
  SafetyView,
  SiteChrome,
  SiteSettingsView,
  StoryView,
  TeamMemberView,
  TestimonialView,
} from "./types";
import { TAG } from "@/lib/cache/tags";
import { getMediaIndex, isIllustrative } from "@/lib/media/index";
import { CURRENCIES, PROGRAMME_SLUG, programmeIdOfSlug, type Currency, type ProgrammeId } from "@/lib/model/enums";
import { FREQUENCY_LABEL } from "@/lib/model/labels";
import { fromMinor } from "@/lib/money";
import { buildFooterLinks, buildMainNav } from "@/lib/nav";
import { routes } from "@/lib/routes";
import { getCauseTotals } from "@/lib/server/public/totals";

/* ── Preview and merging ───────────────────────────────────────────────── */

/** Draft Mode (staff preview). Safe outside a request scope (build-time params), where it is off. */
async function isPreview(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

/** Stored data merged over the defaults and parsed (content-model §4.4). Never throws. */
export function mergeDoc<K extends DocId>(id: K, raw: unknown): DocData<K> {
  const def = DEFAULT_DOCS[id];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return structuredClone(def);
  const candidate = { ...(def as Record<string, unknown>), ...(raw as Record<string, unknown>) };
  const r = DocSchemas[id].safeParse(candidate);
  if (r.success) return r.data as DocData<K>;
  reportInvalid({ kind: "doc", id, issues: r.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
  return structuredClone(def);
}

/** A singleton, uncached (write paths, admin, launch checks). */
export async function loadDoc<K extends DocId>(id: K, opts: { preview?: boolean } = {}): Promise<DocData<K>> {
  const rec = await contentStore().getDoc(id);
  const raw = opts.preview ? (rec?.draft ?? rec?.published) : rec?.published;
  return mergeDoc(id, raw ?? null);
}

/** Envelope facts every item view may need. */
export type ItemMeta = { id: string; placeholder: boolean; visibility: Visibility; version: number; updatedAt: number };
export type LoadedItem<C extends CollectionName> = Item<C> & ItemMeta;

/** A collection's visible items, parsed and sorted by `order`, uncached. Invalid items are dropped and reported. */
export async function loadItems<C extends CollectionName>(c: C, opts: { preview?: boolean } = {}): Promise<LoadedItem<C>[]> {
  const records = await contentStore().listItems(c);
  const out: LoadedItem<C>[] = [];
  for (const r of records) {
    if (r.visibility === "archived" || (r.visibility === "hidden" && !opts.preview)) continue;
    const raw = opts.preview ? (r.draft ?? r.published) : r.published;
    if (raw === null || raw === undefined) continue;
    const parsed = ItemSchemas[c].safeParse(raw);
    if (!parsed.success) {
      reportInvalid({ kind: "item", collection: c, id: r.id, issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
      continue;
    }
    out.push({
      ...(parsed.data as Item<C>),
      id: r.id,
      placeholder: r.placeholder === true,
      visibility: r.visibility,
      version: r.version,
      updatedAt: r.updatedAt,
    } as LoadedItem<C>);
  }
  out.sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0) || a.id.localeCompare(b.id));
  return out;
}

/* ── Public projection ─────────────────────────────────────────────────── */

// Every 'use cache' function is also a server reference: a browser can call it directly as a Server
// Action, with any arguments. So the cached readers below return only what a visitor may see:
// unknown and staff-only ids are refused, staff fields are dropped, and outside draft preview (staff
// only: the cookie can't be forged) only published posts come back.

/** Read by the server alone (getEditorialSettings), never through the cached readers. */
const PRIVATE_DOCS: ReadonlySet<string> = new Set<DocId>(["settings.editorial"]);
/** The media library is read through lib/media/index, never as content. */
const PRIVATE_COLLECTIONS: ReadonlySet<string> = new Set<CollectionName>(["media"]);
/** Who did what (staff uids) and where consent forms live: never public. */
const STAFF_KEYS: ReadonlySet<string> = new Set(["verifiedBy", "recordedBy", "submittedBy", "reviewer", "reviewerUids", "uploadedBy", "updatedBy", "recordRef"]);

function withoutStaffFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutStaffFields) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (!STAFF_KEYS.has(k)) out[k] = withoutStaffFields(v);
    return out as T;
  }
  return value;
}

/** A post as visitors may see it: no review trail, no AI sources, no author uid. */
function publicPost(p: Record<string, unknown>): Record<string, unknown> {
  const { review: _review, origin, author, ...rest } = p as { review?: unknown; origin?: { kind?: string }; author?: Record<string, unknown> };
  void _review;
  const { uid: _uid, ...byline } = author ?? {};
  void _uid;
  return { ...rest, author: byline, review: { checklist: {} }, origin: { kind: origin?.kind === "ai" ? "ai" : "human" } };
}

function refuseUnknown(ok: boolean, what: string): void {
  if (!ok) throw new Error(`${what} is not public content.`);
}

/* ── Cached primitives ─────────────────────────────────────────────────── */

/** One singleton, merged over its defaults, media resolved. Tags: content:<id>, media. */
export async function getContent<K extends DocId>(id: K): Promise<Resolved<DocData<K>>> {
  "use cache";
  refuseUnknown(typeof id === "string" && (DOC_IDS as readonly string[]).includes(id) && !PRIVATE_DOCS.has(id), "That document");
  cacheLife("content");
  cacheTag(TAG.doc(id), TAG.media);
  const preview = await isPreview();
  const [data, index] = await Promise.all([loadDoc(id, { preview }), getMediaIndex()]);
  const resolved = resolveMedia(data, index) as Resolved<DocData<K>>;
  return preview ? resolved : withoutStaffFields(resolved);
}

/** One collection's visible items, sorted, media resolved. Tags: col:<collection>, media. */
export async function getCollection<C extends CollectionName>(c: C): Promise<Array<Resolved<Item<C>> & ItemMeta>> {
  "use cache";
  refuseUnknown(isCollectionName(c) && !PRIVATE_COLLECTIONS.has(c), "That collection");
  cacheLife("content");
  cacheTag(TAG.col(c), TAG.media);
  const preview = await isPreview();
  const [items, index] = await Promise.all([loadItems(c, { preview }), getMediaIndex()]);
  const resolved = resolveMedia(items, index) as unknown as Array<Resolved<Item<C>> & ItemMeta>;
  if (preview) return resolved;
  const visible = c === "posts" ? resolved.filter((p) => (p as { status?: string }).status === "published").map((p) => publicPost(p as Record<string, unknown>)) : resolved;
  return withoutStaffFields(visible) as typeof resolved;
}

/** The monthly story plan, for the AI writer only (uncached: it is not a server reference). */
export async function getEditorialSettings(): Promise<DocData<"settings.editorial">> {
  return loadDoc("settings.editorial");
}

/** Organisation details plus the year and years of service (computed in the cache scope, D15). */
export async function getSiteSettings(): Promise<SiteSettingsView> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.doc("settings.site"));
  const s = await loadDoc("settings.site", { preview: await isPreview() });
  const year = new Date().getFullYear();
  return { ...s, year, yearsOfService: Math.max(0, year - s.foundedYear) };
}

/* ── Stats (D45–D47) ───────────────────────────────────────────────────── */

/** Every live figure by id. After the before-launch switch, unverified figures are left out (D46). */
export async function getStats(): Promise<Record<string, ResolvedStat>> {
  const [stats, site] = await Promise.all([getCollection("stats"), getContent("settings.site")]);
  const out: Record<string, ResolvedStat> = {};
  for (const s of stats) {
    const r = toResolvedStat(s);
    if (site.figures.hideUnverified && !r.verified) continue;
    out[r.id] = r;
  }
  return out;
}

/** Live figures as a list in registry order (the /impact bento). */
export async function getStatList(): Promise<ResolvedStat[]> {
  const [stats, map] = await Promise.all([getCollection("stats"), getStats()]);
  return stats.map((s) => map[s.id]).filter((s): s is ResolvedStat => !!s);
}

/* ── Programmes (D40–D41) ──────────────────────────────────────────────── */

function programmeView(p: Resolved<Item<"programmes">> & ItemMeta): ResolvedProgramme {
  const notices = p.notices.map((n) => ({ kind: n.kind, tone: PROGRAMME_NOTICE_TONE[n.kind], text: n.text }));
  const cardNotice = p.notices.find((n) => n.showOnCard)?.text;
  const category = p.requestCta.category;
  return {
    ...p,
    notices,
    href: routes.programme(p.slug),
    causeSlug: p.slug,
    ...(cardNotice ? { cardNotice } : {}),
    requestHref: category === "child_protection" ? routes.concern() : routes.request(category),
    donateHref: routes.donate(p.donateCta.causeSlug ?? p.slug),
    partnerHref: routes.partner({ programme: p.slug }),
    placeholder: p.placeholder,
  };
}

/** The live programmes, in order. */
export async function getProgrammes(): Promise<ResolvedProgramme[]> {
  return (await getCollection("programmes")).map(programmeView);
}

/** One programme by its URL slug (or id), or null. */
export async function getProgramme(slug: string): Promise<ResolvedProgramme | null> {
  const id = programmeIdOfSlug(slug) ?? slug;
  const p = (await getCollection("programmes")).find((x) => x.slug === slug || x.id === id);
  return p ? programmeView(p) : null;
}

function programmeCard(p: ResolvedProgramme): ProgrammeCard {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    ...(p.cardNotice ? { notice: p.cardNotice } : {}),
    navBlurb: p.navBlurb,
    href: p.href,
  };
}

/* ── Causes and money (D37–D39, D56) ───────────────────────────────────── */

function causeView(
  c: Resolved<Item<"causes">> & ItemMeta,
  totals: Partial<Record<Currency, { raisedMinor: number; gifts: number }>>,
  hideUnverified: boolean,
  now: number,
): CauseView {
  const own = totals[c.currency]?.raisedMinor ?? 0;
  const raised = c.offlineRaised + fromMinor(own, c.currency) + c.convertedRaised;
  const otherCurrencyTotals: Partial<Record<Currency, number>> = {};
  for (const cur of CURRENCIES) {
    if (cur === c.currency) continue;
    const minor = totals[cur]?.raisedMinor ?? 0;
    if (minor > 0) otherCurrencyTotals[cur] = fromMinor(minor, cur);
  }
  const verified = c.verification.status === "verified";
  const closed = c.status === "completed" || (c.endsAt !== undefined && c.endsAt <= now);
  const live = c.status === "active" && (c.startsAt === undefined || c.startsAt <= now) && !closed;
  return {
    id: c.id,
    slug: c.slug,
    kind: c.kind,
    title: c.title,
    ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}),
    season: c.season,
    groupId: c.groupId,
    ...(c.programmeId ? { programmeId: c.programmeId, programmeSlug: PROGRAMME_SLUG[c.programmeId] } : {}),
    ...(c.place ? { place: c.place } : {}),
    tone: c.tone,
    image: asImage(c.image),
    summary: c.summary,
    story: c.story,
    currency: c.currency,
    goal: c.goal,
    raised,
    percent: c.goal > 0 ? (raised / c.goal) * 100 : 0,
    otherCurrencyTotals,
    allocation: c.allocation,
    ...(c.allocationAsOf ? { allocationAsOf: c.allocationAsOf } : {}),
    impactUnits: c.impactUnits,
    presetAmounts: c.presetAmounts,
    defaultFrequency: c.defaultFrequency,
    allowedFrequencies: c.allowedFrequencies,
    inKindItems: c.inKindItems,
    zakatEligible: c.zakatEligible,
    ...(c.startsAt !== undefined ? { startsAt: c.startsAt } : {}),
    ...(c.endsAt !== undefined ? { endsAt: c.endsAt } : {}),
    status: c.status,
    verified,
    placeholder: c.placeholder,
    showFigures: verified || (c.placeholder && !hideUnverified),
    closed,
    live,
    href: routes.donate(c.slug),
    seo: c.seo as CauseView["seo"],
  };
}

/**
 * Causes with their derived money fields. `liveOnly` (default) keeps active causes inside their
 * window; otherwise every visible cause, closed ones included. Tags: col:causes, media,
 * donations:totals, content:settings.site.
 */
export async function getCauses(o: { liveOnly?: boolean; kind?: CauseKind } = {}): Promise<CauseView[]> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.col("causes"), TAG.media, TAG.donationTotals, TAG.doc("settings.site"));
  const [causes, totals, site] = await Promise.all([getCollection("causes"), getCauseTotals(), getContent("settings.site")]);
  const now = Date.now();
  const views = causes.map((c) => causeView(c, totals[c.slug] ?? {}, site.figures.hideUnverified, now));
  return views.filter((v) => (o.liveOnly === false || v.live) && (!o.kind || v.kind === o.kind));
}

/** One cause by slug (closed causes included, so their page can say so), or null. */
export async function getCause(slug: string): Promise<CauseView | null> {
  const all = await getCauses({ liveOnly: false });
  return all.find((c) => c.slug === slug) ?? null;
}

function causeCard(c: CauseView): CauseCard {
  return {
    slug: c.slug,
    title: c.title,
    season: c.season,
    groupId: c.groupId,
    ...(c.place ? { place: c.place } : {}),
    currency: c.currency,
    raised: c.raised,
    goal: c.goal,
    percent: c.percent,
    image: c.image,
    tone: c.tone,
    href: c.href,
    showFigures: c.showFigures,
    verified: c.verified,
    placeholder: c.placeholder,
  };
}

/** The landing's appeal cards: live causes that belong to an appeals group, in order. */
export async function getAppealCards(): Promise<CauseCard[]> {
  return (await getCauses()).filter((c) => c.groupId !== "").map(causeCard);
}

/* ── Posts (D42–D43) ───────────────────────────────────────────────────── */

const PROGRAMME_TOPIC: Record<ProgrammeId, string> = {
  protection: "Child protection",
  education: "Education",
  medical: "Health",
  psychological: "Counselling",
  legal: "Legal support",
  family: "Family & community",
};

/** The card's topic label: a programme update about one programme shows that programme's topic. */
export function postCategoryLabel(p: { category: PostCategory; programmeIds: ProgrammeId[] }): string {
  if (p.category === "programme-update" && p.programmeIds.length === 1) return PROGRAMME_TOPIC[p.programmeIds[0]];
  return POST_CATEGORY_LABEL[p.category];
}

type LivePost = Resolved<Item<"posts">> & ItemMeta;

function postDate(p: LivePost): number {
  return p.publishedAt ?? p.publishAt ?? p.updatedAt;
}

function postCard(p: LivePost, timeZone: string): PostCard {
  return {
    id: p.id,
    slug: p.slug,
    href: routes.post(p.slug),
    title: p.title,
    excerpt: p.excerpt,
    format: p.format,
    category: p.category,
    categoryLabel: postCategoryLabel(p),
    dateLabel: cardDate(postDate(p), timeZone),
    publishedAt: postDate(p),
    cover: asImage(p.cover),
    readingMinutes: p.readingMinutes,
    featured: p.featured,
  };
}

async function publishedPosts(): Promise<LivePost[]> {
  const posts = await getCollection("posts");
  return posts.filter((p) => p.status === "published").sort((a, b) => postDate(b) - postDate(a));
}

/** Published posts, newest first, optionally filtered; 9 per page on /news (D124). */
export async function getPosts(o: { category?: PostCategory; format?: PostFormat; page?: number; pageSize?: number } = {}): Promise<{ items: PostCard[]; total: number }> {
  const [posts, site] = await Promise.all([publishedPosts(), getContent("settings.site")]);
  const matches = posts.filter((p) => (!o.category || p.category === o.category) && (!o.format || p.format === o.format));
  const size = Math.max(1, Math.min(48, Math.trunc(o.pageSize ?? 9)));
  const page = Math.max(1, Math.trunc(o.page ?? 1));
  return { items: matches.slice((page - 1) * size, page * size).map((p) => postCard(p, site.timeZone)), total: matches.length };
}

/** The latest published posts: featured first, then newest (content-model §7.5). */
export async function getLatestPosts(n = 3): Promise<PostCard[]> {
  const [posts, site] = await Promise.all([publishedPosts(), getContent("settings.site")]);
  const ordered = [...posts].sort((a, b) => Number(b.featured) - Number(a.featured) || postDate(b) - postDate(a));
  return ordered.slice(0, Math.max(0, n)).map((p) => postCard(p, site.timeZone));
}

/** One post by slug. Published only, except in preview, where staff see any status. */
export async function getPost(slug: string): Promise<ResolvedPost | null> {
  "use cache";
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  cacheLife("content");
  cacheTag(TAG.col("posts"), TAG.item("posts", slug), TAG.media, TAG.doc("settings.site"));
  const [posts, site, preview] = await Promise.all([getCollection("posts"), getContent("settings.site"), isPreview()]);
  const p = posts.find((x) => x.slug === slug && (preview || x.status === "published"));
  if (!p) return null;
  const { review: _r, origin, ...rest } = p;
  void _r;
  return {
    ...rest,
    id: p.id,
    href: routes.post(p.slug),
    categoryLabel: postCategoryLabel(p),
    dateLabel: cardDate(postDate(p), site.timeZone),
    aiAssisted: origin.kind === "ai",
    placeholder: p.placeholder,
  };
}

/** The neighbours of a published post: `prev` is the older one, `next` the newer one. */
export async function getAdjacentPosts(slug: string): Promise<{ prev?: PostCard; next?: PostCard }> {
  const [posts, site] = await Promise.all([publishedPosts(), getContent("settings.site")]);
  const i = posts.findIndex((p) => p.slug === slug);
  if (i < 0) return {};
  const newer = posts[i - 1];
  const older = posts[i + 1];
  return { ...(older ? { prev: postCard(older, site.timeZone) } : {}), ...(newer ? { next: postCard(newer, site.timeZone) } : {}) };
}

/** Slugs of every published post (generateStaticParams; never empty thanks to the seeds, D6). */
export async function getPublishedPostSlugs(): Promise<string[]> {
  return (await publishedPosts()).map((p) => p.slug);
}

/* ── People and stories ────────────────────────────────────────────────── */

const consentWithdrawn = (c: { state: string }) => c.state === "withdrawn";

/** Live stories (consent not withdrawn), optionally for one programme (id or slug) or featured only. */
export async function getStories(o: { programme?: string; featured?: boolean } = {}): Promise<StoryView[]> {
  const stories = await getCollection("stories");
  const programmeId = o.programme ? (programmeIdOfSlug(o.programme) ?? o.programme) : null;
  return stories
    .filter((s) => !consentWithdrawn(s.consent) && (!programmeId || s.programmeId === programmeId) && (!o.featured || s.featured))
    .map((s) => ({
      id: s.id,
      label: s.label,
      meta: s.meta,
      ...(s.programmeId ? { programmeId: s.programmeId } : {}),
      place: s.place,
      text: s.text,
      image: asImage(s.image),
      featured: s.featured,
      placeholder: s.placeholder,
    }));
}

/** Live testimonials (consent not withdrawn), optionally for one audience. */
export async function getTestimonials(o: { audience?: Item<"testimonials">["kind"] } = {}): Promise<TestimonialView[]> {
  const items = await getCollection("testimonials");
  return items
    .filter((t) => !consentWithdrawn(t.consent) && (!o.audience || t.kind === o.audience))
    .map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      role: t.role,
      quote: t.quote,
      ...(t.image ? { image: asImage(t.image) } : {}),
      placeholder: t.placeholder,
    }));
}

/** The team, optionally only those shown on the home page or the About page. */
export async function getTeam(o: { on?: "home" | "about" } = {}): Promise<TeamMemberView[]> {
  const team = await getCollection("team");
  return team
    .filter((m) => !o.on || m.showOn.includes(o.on))
    .map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      image: asImage(m.image),
      socials: m.socials,
      bio: m.bio,
      languages: m.languages,
      showOn: m.showOn,
      placeholder: m.placeholder,
    }));
}

/** FAQs by placement (public groups, D49), or by id in the given order (programme pages). */
export async function getFaqs(o: { placement?: FaqPlacement; ids?: readonly string[] } = {}): Promise<FaqView[]> {
  const faqs = await getCollection("faqs");
  const view = (f: (typeof faqs)[number]): FaqView => ({ id: f.id, q: f.q, a: f.a, placements: f.placements, locked: f.locked });
  if (o.ids) {
    const byId = new Map(faqs.map((f) => [f.id, f]));
    return o.ids.map((id) => byId.get(id)).filter((f): f is (typeof faqs)[number] => !!f).map(view);
  }
  return faqs.filter((f) => !o.placement || f.placements.includes(o.placement)).map(view);
}

/** Partner logos (built-in placeholders or uploaded logos). */
export async function getPartners(): Promise<PartnerView[]> {
  const partners = await getCollection("partners");
  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    ...(p.url ? { url: p.url } : {}),
    logo:
      "builtin" in p.logo
        ? { kind: "builtin" as const, key: p.logo.builtin }
        : { kind: "image" as const, image: asImage(p.logo) },
    placeholder: p.placeholder,
  }));
}

/* ── Projects (D50, D132) ──────────────────────────────────────────────── */

function projectCard(p: Resolved<Item<"projects">> & ItemMeta): ProjectCard {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    image: asImage(p.image),
    status: p.status,
    ...(p.programmeId ? { programmeId: p.programmeId } : {}),
    ...(p.place ? { place: p.place } : {}),
    ...(p.causeSlug ? { causeSlug: p.causeSlug } : {}),
    href: routes.project(p.slug),
  };
}

/** Live projects, optionally filtered by programme (id or slug) or status. */
export async function getProjects(o: { programme?: string; status?: ProjectStatus } = {}): Promise<ProjectCard[]> {
  const projects = await getCollection("projects");
  const programmeId = o.programme ? (programmeIdOfSlug(o.programme) ?? o.programme) : null;
  return projects.filter((p) => (!programmeId || p.programmeId === programmeId) && (!o.status || p.status === o.status)).map(projectCard);
}

/** One project by slug, with verified outcomes only. */
export async function getProject(slug: string): Promise<ProjectView | null> {
  const p = (await getCollection("projects")).find((x) => x.slug === slug);
  if (!p) return null;
  return {
    ...p,
    id: p.id,
    href: routes.project(p.slug),
    outcomes: p.outcomes.filter((o) => o.verified).map((o) => ({ label: o.label, value: o.value })),
    placeholder: p.placeholder,
  };
}

/* ── Policies (D50) ────────────────────────────────────────────────────── */

function policyView(p: Resolved<Item<"policies">> & ItemMeta, timeZone: string): PolicyView {
  const pdfHref = p.pdf && p.pdf.type === "document" ? p.pdf.src : undefined;
  return {
    ...p,
    id: p.id,
    slug: p.slug,
    href: routes.policy(p.slug),
    draft: p.lastReview?.reviewer !== "professional",
    ...(p.lastReview ? { lastReviewedLabel: longDate(p.lastReview.at, timeZone) } : {}),
    ...(pdfHref ? { pdfHref } : {}),
    placeholder: p.placeholder,
  };
}

export async function getPolicies(): Promise<PolicyView[]> {
  const [policies, site] = await Promise.all([getCollection("policies"), getContent("settings.site")]);
  return policies.map((p) => policyView(p, site.timeZone));
}

export async function getPolicy(slug: PolicySlug | string): Promise<PolicyView | null> {
  return (await getPolicies()).find((p) => p.slug === slug) ?? null;
}

/* ── Pages (D52), allocation (D57), donate config (D63) ─────────────────── */

/** A page's editable hero, SEO and section copy. */
export async function getPage(key: PageKey): Promise<PageView> {
  const doc = (await getContent(pageDocId(key))) as unknown as Omit<PageView, "key">;
  return { ...doc, key };
}

/** The latest published "where the money went" summary, or null (D57). */
export async function getAllocationSummary(): Promise<AllocationSummaryView | null> {
  const [items, site] = await Promise.all([getCollection("allocationSummaries"), getContent("settings.site")]);
  const latest = [...items].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
  if (!latest) return null;
  const verified = latest.verification.status === "verified";
  if (!verified && site.figures.hideUnverified) return null;
  return { ...latest, id: latest.id, verified, showFigures: verified || latest.placeholder, placeholder: latest.placeholder };
}

/** The donate widget's display configuration: enabled currencies and frequencies, in order. */
export async function getDonateConfig(): Promise<DonateConfigView> {
  const c = await getContent("donate.config");
  return {
    defaultCurrency: c.defaultCurrency,
    currencies: CURRENCIES.filter((code) => c.currencies[code].enabled).map((code) => ({
      code,
      name: c.currencies[code].name,
      min: c.currencies[code].min,
      amounts: [...c.currencies[code].amounts],
    })),
    frequencies: (Object.keys(FREQUENCY_LABEL) as Array<keyof typeof FREQUENCY_LABEL>)
      .filter((f) => c.frequencies[f])
      .map((f) => ({ value: f, label: FREQUENCY_LABEL[f] })),
    inKind: [...c.inKind],
  };
}

/* ── Live media usage and the illustrative footer notice (D54) ─────────── */

/**
 * Where each media id is used by live content: id → ["home.hero", "stories/story-1", …]. Used by the
 * footer notice and the admin's "Used in". Tags: every doc and collection tag, plus media.
 */
export async function getLiveMediaUsage(): Promise<Record<string, string[]>> {
  "use cache";
  cacheLife("content");
  cacheTag(...DOC_IDS.map((id) => TAG.doc(id)), ...COLLECTION_NAMES.map((c) => TAG.col(c)), TAG.media);
  const usage: Record<string, string[]> = {};
  const add = (ids: Set<string>, place: string) => ids.forEach((id) => (usage[id] ??= []).push(place));
  const docs = await Promise.all(DOC_IDS.map(async (id) => [id, await loadDoc(id)] as const));
  for (const [id, data] of docs) add(mediaIdsIn(data), id);
  for (const c of COLLECTION_NAMES) {
    if (c === "media") continue;
    for (const item of await loadItems(c)) add(mediaIdsIn(item), `${c}/${item.id}`);
  }
  return usage;
}

/** True while any AI image with people visible is used by live content. */
export async function getAnyIllustrativeInUse(): Promise<boolean> {
  const [usage, index] = await Promise.all([getLiveMediaUsage(), getMediaIndex()]);
  return Object.keys(usage).some((id) => {
    const a = index[id];
    return !!a && isIllustrative(a);
  });
}

/* ── Site chrome ───────────────────────────────────────────────────────── */

function contactView(c: DocData<"settings.contact">): ContactView {
  return {
    addressLabel: c.addressLabel,
    address: addressLine(c.offices),
    offices: c.offices.map((o) => ({
      label: o.label,
      address: o.address,
      ...(o.phone ? { phone: o.phone, phoneHref: phoneHref(o.phone) } : {}),
      ...(o.mapUrl ? { mapUrl: o.mapUrl } : {}),
    })),
    phoneLabel: c.phoneLabel,
    phone: c.phone,
    phoneHref: phoneHref(c.phone),
    emailLabel: c.emailLabel,
    email: c.email,
    socials: c.socials.filter((s) => s.show).map((s) => ({ name: s.name, icon: s.icon, href: s.href })),
    teamEmails: c.teamEmails,
    ...(c.hours ? { hours: c.hours } : {}),
    responseTimes: c.responseTimes,
  };
}

function safetyView(s: DocData<"settings.safety">): SafetyView {
  return {
    emergencyNotice: s.emergencyNotice,
    footerHeading: s.footerHeading,
    emergencyContacts: s.emergencyContacts.filter((e) => e.verified).map((e) => ({ country: e.country, label: e.label, number: e.number })),
  };
}

/** Contact details for pages (derived phone href and address line). */
export async function getContact(): Promise<ContactView> {
  return contactView(await getContent("settings.contact"));
}

/** Safety notices; only verified emergency numbers. */
export async function getSafety(): Promise<SafetyView> {
  return safetyView(await getContent("settings.safety"));
}

/** Everything the site layout needs: Header, Footer, MobileMenu and the footer notice. */
export async function getSiteChrome(): Promise<SiteChrome> {
  const [site, contact, safety, announcements, chrome, seo, programmes, policies, anyIllustrativeInUse] = await Promise.all([
    getSiteSettings(),
    getContent("settings.contact"),
    getContent("settings.safety"),
    getContent("settings.announcements"),
    getContent("settings.chrome"),
    getContent("settings.seo"),
    getProgrammes(),
    getPolicies(),
    getAnyIllustrativeInUse(),
  ]);
  const navProgrammes = programmes.map((p) => ({ id: p.id, slug: p.slug, title: p.title, navBlurb: p.navBlurb }));
  return {
    site,
    contact: contactView(contact),
    safety: safetyView(safety),
    ticker: [...announcements.ticker],
    ctas: { footer: [ctaView(chrome.footerCtas[0]), ctaView(chrome.footerCtas[1])], donate: ctaView(chrome.donateCta) },
    nav: buildMainNav(navProgrammes),
    footerLinks: buildFooterLinks(navProgrammes, policies.map((p) => ({ slug: p.slug, title: p.title }))),
    anyIllustrativeInUse,
    seo: { ogLines: [seo.ogLines[0], seo.ogLines[1]], ...(seo.ogImage ? { ogImage: asImage(seo.ogImage) } : {}) },
  };
}

/* ── The landing page (content-model §4.3) ─────────────────────────────── */

const RESTORING_TONES = ["marigold", "white", "white", "marigold"] as const;

function pickByIds<T extends { slug: string }>(items: T[], ids: readonly string[], n: number): T[] {
  if (ids.length) {
    const bySlug = new Map(items.map((i) => [i.slug, i]));
    const chosen = ids.map((id) => bySlug.get(id)).filter((x): x is T => !!x);
    if (chosen.length) return chosen.slice(0, n);
  }
  return items.slice(0, n);
}

/**
 * The landing page's content, reshaped back into the props each section consumes today (content-model
 * §4.3), so the section bodies stay untouched when they switch from imports to props.
 */
export async function getHomeContent(): Promise<HomeView> {
  const [
    layout,
    hero,
    world,
    partnersDoc,
    progDoc,
    about,
    duo,
    manifesto,
    impact,
    focus,
    appealsDoc,
    donate,
    doors,
    storiesDoc,
    founder,
    teamDoc,
    restoring,
    testiDoc,
    journey,
    projectsDoc,
    faqDoc,
    join,
    newsDoc,
    finalCta,
  ] = await Promise.all([
    getContent("home.layout"),
    getContent("home.hero"),
    getContent("home.world"),
    getContent("home.partners"),
    getContent("home.programmes"),
    getContent("home.about"),
    getContent("home.duo"),
    getContent("home.manifesto"),
    getContent("home.impact"),
    getContent("home.focus"),
    getContent("home.appeals"),
    getContent("home.donate"),
    getContent("home.doors"),
    getContent("home.stories"),
    getContent("home.founder"),
    getContent("home.team"),
    getContent("home.restoring"),
    getContent("home.testimonials"),
    getContent("home.journey"),
    getContent("home.projects"),
    getContent("home.faq"),
    getContent("home.join"),
    getContent("home.news"),
    getContent("home.finalCta"),
  ]);
  const [stats, programmes, appeals, donateConfig, safety, stories, team, testimonials, projects, faqs, partners, posts, site, latest] =
    await Promise.all([
      getStats(),
      getProgrammes(),
      getAppealCards(),
      getDonateConfig(),
      getContent("settings.safety"),
      getStories(),
      getTeam({ on: "home" }),
      getTestimonials(),
      getProjects(),
      getFaqs({ placement: "home" }),
      getPartners(),
      getPosts({ pageSize: 48 }),
      getSiteSettings(),
      getLatestPosts(3),
    ]);

  const img = asImage;
  const vid = asVideo;
  const stat = (id: string): ResolvedStat | null => stats[id] ?? null;

  const impactStats = impact.cards
    .map((c) => ({ card: c, s: stat(c.statId) }))
    .filter((x): x is { card: typeof x.card; s: ResolvedStat } => x.s !== null)
    .map(({ card, s }) => ({ id: s.id, label: s.label, value: s.value, suffix: s.suffix, note: s.note ?? "", tone: card.tone, placeholder: s.placeholder }));
  const restoringStats = restoring.statIds
    .map((id, i) => ({ s: stat(id), tone: RESTORING_TONES[i] }))
    .filter((x): x is { s: ResolvedStat; tone: (typeof RESTORING_TONES)[number] } => x.s !== null)
    .map(({ s, tone }) => ({ id: s.id, label: s.label, value: s.value, suffix: s.suffix, tone, placeholder: s.placeholder }));
  const partnerStat = stat(partnersDoc.statId);

  const featuredPosts = newsDoc.featured.length ? pickByIds(posts.items, newsDoc.featured, 3) : latest;

  return {
    hidden: [...layout.hidden],
    hero: {
      slides: hero.slides.map((s) => ({
        id: s.id,
        eyebrow: s.eyebrow,
        title: [s.title[0], s.title[1]],
        place: s.place,
        media: asImageOrVideo(s.media),
      })),
      text: hero.text,
      primaryCta: ctaView(hero.primaryCta, "home"),
      secondaryCta: ctaView(hero.secondaryCta, "home"),
    },
    world: { eyebrow: world.eyebrow, title: world.title, intro: world.intro },
    partners: {
      title: [partnersDoc.before, partnerStat ? `${partnerStat.value.toLocaleString("en")}${partnerStat.suffix}` : "", partnersDoc.after],
      subline: partnersDoc.subline,
      stat: partnerStat,
      logos: partners,
    },
    programmes: { section: { eyebrow: progDoc.eyebrow, lines: [...progDoc.lines], cardCta: progDoc.cardCta }, items: programmes.map(programmeCard) },
    about: {
      eyebrow: about.eyebrow,
      titleLines: [...about.titleLines],
      body: [...about.body],
      values: about.values.map((v) => ({ label: v.label, tone: v.tone })),
      visionLabel: about.visionLabel,
      vision: about.vision,
      image: img(about.image),
      cta: ctaView(about.cta, "home"),
    },
    duo: duo.cards.map((c) => ({ title: c.title, text: c.text, cta: ctaView(c.cta, "home"), tone: c.tone, image: img(c.image) })),
    manifesto: { media: vid(manifesto.media), tagline: site.tagline, ctas: [ctaView(manifesto.ctas[0], "home"), ctaView(manifesto.ctas[1], "home")] },
    impact: {
      title: [...impact.title],
      text: impact.text,
      placeholderNote: impact.placeholderNote,
      showNote: impactStats.some((s) => s.placeholder),
      stats: impactStats,
    },
    focus: {
      items: focus.slides.map((s) => s.word),
      captions: focus.slides.map((s) => s.caption),
      media: focus.slides.map((s) => asImageOrVideo(s.media)),
    },
    appeals: {
      section: {
        eyebrow: appealsDoc.eyebrow,
        titleLines: [...appealsDoc.titleLines],
        intro: appealsDoc.intro,
        placeholderNote: appealsDoc.placeholderNote,
        groups: appealsDoc.groups.map((g) => ({ id: g.id, label: g.label })),
      },
      causes: appeals,
      showNote: appeals.some((c) => !c.verified),
    },
    donate: {
      copy: {
        title: [...donate.title],
        text: donate.text,
        media: vid(donate.media),
        anywhereLabel: donate.anywhereLabel,
        securityNote: donate.securityNote,
        thankYouCash: donate.thankYouCash,
        thankYouKind: donate.thankYouKind,
        updatesConsentLabel: donate.updatesConsentLabel,
        anonymousLabel: donate.anonymousLabel,
      },
      config: donateConfig,
      causes: appeals.map((c) => ({ slug: c.slug, title: c.title, currency: c.currency })),
      programmes: programmes.map((p) => ({ id: p.id, slug: p.slug, title: p.title })),
    },
    doors: {
      title: doors.title,
      text: doors.text,
      primaryCta: ctaView(doors.primaryCta, "home"),
      secondaryCta: ctaView(doors.secondaryCta, "home"),
      emergencyNotice: safety.emergencyNotice,
    },
    stories: {
      section: { title: [...storiesDoc.title], intro: storiesDoc.intro, ctas: [ctaView(storiesDoc.ctas[0], "home"), ctaView(storiesDoc.ctas[1], "home")] },
      items: stories,
    },
    founder: {
      eyebrow: founder.eyebrow,
      titleLines: [...founder.titleLines],
      text: founder.text,
      quoteName: founder.quoteName,
      quoteRole: founder.quoteRole,
      quote: founder.quote,
      image: img(founder.image),
      cta: ctaView(founder.cta, "home"),
      yearsOfService: site.yearsOfService,
    },
    team: { section: { eyebrow: teamDoc.eyebrow, lines: [...teamDoc.lines], ...(teamDoc.intro ? { intro: teamDoc.intro } : {}) }, members: team },
    restoring: {
      titleLines: [...restoring.titleLines],
      text: restoring.text,
      stats: restoringStats,
      showNote: restoringStats.some((s) => s.placeholder),
      placeholderNote: restoring.placeholderNote,
      image: img(restoring.image),
      film: vid(restoring.film),
      filmTitle: restoring.filmTitle,
    },
    testimonials: {
      section: { eyebrow: testiDoc.eyebrow, lines: [...testiDoc.lines], ...(testiDoc.intro ? { intro: testiDoc.intro } : {}) },
      items: testimonials,
    },
    journey: {
      title: journey.title,
      text: journey.text,
      steps: journey.steps.map((s) => ({ id: s.id, title: s.title, text: s.text, image: img(s.image) })),
    },
    projects: {
      section: { eyebrow: projectsDoc.eyebrow, lines: [...projectsDoc.lines], cta: ctaView(projectsDoc.cta, "home") },
      items: pickByIds(projects, projectsDoc.featured, 3),
    },
    faq: {
      section: {
        eyebrow: faqDoc.eyebrow,
        lines: [...faqDoc.lines],
        media: { main: img(faqDoc.media.main), inset: img(faqDoc.media.inset), heart: img(faqDoc.media.heart) },
      },
      items: faqs,
    },
    join: { title: [join.title[0], join.title[1], join.title[2]], text: join.text, media: vid(join.media), note: join.note },
    news: {
      section: { eyebrow: newsDoc.eyebrow, lines: [...newsDoc.lines], intro: newsDoc.intro, cardCta: newsDoc.cardCta },
      posts: featuredPosts,
    },
    finalCta: {
      visible: finalCta.visible,
      title: finalCta.title,
      ...(finalCta.text ? { text: finalCta.text } : {}),
      buttons: finalCta.buttons.map((b) => ctaView(b, "home")),
    },
  };
}

/** Whether a singleton still holds // CLIENT values (Before-launch checklist). */
export async function isPlaceholderDoc(id: DocId): Promise<boolean> {
  const rec = await contentStore().getDoc(id);
  return rec ? rec.placeholder === true : PLACEHOLDER_DOC_IDS.has(id);
}
