import "server-only";

// Selftest suite "content" (PLAN §5.3 acceptance; owner F3): content defaults, the read path and the
// write pipeline. GET /api/dev/selftest?suite=content
//
// The write cases use the real pipeline on `home.impact` and restore its live value at the end (the
// restore is published too, so the landing page is unchanged; two versions and audit entries by
// "Selftest" remain). Every other case is read-only or refused before anything is written.

import { revalidateTag } from "next/cache";
import type { Suite, SuiteCase } from "../types";
import { getResources } from "@/lib/server/public/resources";
import { DEFAULT_DOCS, DEFAULT_ITEMS } from "@/lib/content/defaults";
import { COLLECTION_NAMES, DOC_IDS } from "@/lib/content/ids";
import { inlineIssues, inlineToPlain } from "@/lib/content/inline";
import {
  getCause,
  getCauses,
  getHomeContent,
  getPage,
  getPost,
  getProgramme,
  getSiteChrome,
  getPolicies,
  getProgrammes,
  getProjects,
  getPublishedPostSlugs,
  loadDoc,
  loadItems,
} from "@/lib/content/read";
import { DocSchemas, ItemSchemas } from "@/lib/content/schema";
import { createAiDraft, transitionPost } from "@/lib/content/posts";
import { contentStore, removeItem, writeDoc, writeItem, type WriteOutcome } from "@/lib/content/store";
import { FALLBACK_MEDIA_ID, pipelineAssets } from "@/lib/media/pipeline";
import { permsFor, type Role } from "@/lib/model/permissions";
import { systemActor, type Viewer } from "@/lib/model/viewer";

function viewerAs(role: Role): Viewer {
  return {
    uid: `selftest-${role}`,
    displayName: `Selftest (${role.replace(/_/g, " ")})`,
    email: `selftest+${role}@haven.test`,
    roles: [role],
    perms: permsFor([role], []),
    viewerScopes: [],
    programmeScope: "all",
    timezone: "Africa/Banjul",
    textSize: "normal",
    authTime: Date.now(),
    mfa: false,
    backend: "local",
  };
}

function recorder() {
  const cases: SuiteCase[] = [];
  return {
    cases,
    async check(name: string, fn: () => Promise<true | string | false> | true | string | false): Promise<boolean> {
      try {
        const r = await fn();
        const ok = r === true;
        cases.push({ name, ok, ...(ok ? {} : { detail: typeof r === "string" ? r : "expectation not met" }) });
        return ok;
      } catch (err) {
        cases.push({ name, ok: false, detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
        return false;
      }
    },
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const show = (v: unknown) => JSON.stringify(v).slice(0, 300);
const errorKind = (o: WriteOutcome<unknown>) => (o.result.ok ? "ok" : o.result.error.kind);
const expire = (tags: string[]) => tags.forEach((t) => revalidateTag(t, { expire: 0 }));

/** Today's landing values (content/home.ts, content/people.ts, content/site.ts on 2026-10-10). */
const TODAY = {
  heroTitles: [
    ["Every Child Deserves", "a Safe and Hopeful Future"],
    ["Standing With Families", "Wherever They Call Home"],
    ["Restoring Hope", "One Child at a Time"],
    ["Your Support Can Change", "a Child’s Story"],
    ["Strong Families,", "Brighter Futures"],
    ["Protecting Childhood", "Around the World"],
    ["One Promise of Care", "for Every Child"],
  ],
  heroPlaces: ["gm", "in", "ph", "et", "pk", "kh", "ye"],
  appealCurrencies: ["USD", "GMD", "USD", "USD", "USD", "USD", "USD", "USD"],
  appealRaised: [2900, 38500, 3400, 2150, 3700, 850, 620, 1250],
  appealGoals: [5500, 90000, 8000, 5000, 5000, 8000, 3000, 6000],
  appealGroups: ["Ramadan & Eid", "Christmas", "Thanksgiving", "Year-round"],
  impact: [1200, 640, 3200],
  restoring: [
    [150, "Active Volunteers", "marigold"],
    [45, "Community Partners", "white"],
    [400, "Monthly Donors", "white"],
    [980, "School-Fee Interventions", "marigold"],
  ],
  partnersTitle: ["Trusted by over", "45+", "partners & communities"],
  focus: ["Protection", "Education", "Healing", "Justice"],
  programmeTitles: ["Child Protection", "Education Assistance", "Medical Support", "Psychological Support", "Legal Support", "Family & Community"],
  programmeNotices: [
    "This platform is not an emergency-response service.",
    undefined,
    "We do not provide medical diagnoses or replace professional medical advice.",
    undefined,
    "General website information is not legal advice.",
    undefined,
  ],
  faqCount: 8,
  teamNames: ["Awa Jallow", "Arjun Mehta", "Ayesha Malik", "Ebrima Touray", "Maria Santos", "Yousef Haddad"],
  storyCount: 9,
  testimonialNames: ["Denise W.", "Priya S.", "Omar H.", "Parent", "Paolo R.", "Dr. Sana A."],
  journeySteps: ["We Go Out", "We Build Relationships", "We Verify", "We Identify Needs", "We Give & Follow Up"],
  projects: [
    ["Back-to-School Drive", "Education Assistance"],
    ["Reading Circles", "Learning Resources"],
    ["Community Health Days", "Medical Support"],
  ],
  news: [
    ["September 12, 2026", "Education", "Back-to-School: 50 Children Return to Class"],
    ["August 28, 2026", "Safeguarding", "How We Keep Every Child’s Story Safe"],
    ["August 03, 2026", "Partnerships", "Partner for Good: Community Health Days"],
  ],
  donateCurrencies: [
    ["GMD", "Dalasi", 100, [500, 1000, 2500, 5000, 10000, 25000]],
    ["USD", "US dollars", 5, [10, 25, 50, 100, 250, 500]],
    ["GBP", "Pounds", 5, [10, 20, 50, 100, 200, 500]],
    ["EUR", "Euros", 5, [10, 25, 50, 100, 250, 500]],
  ],
  frequencies: ["One-time", "Monthly", "Quarterly", "Annual"],
  // The landing's eight plus "Bedding" from client spec §8 (lead decision, F3 request).
  inKindCount: 9,
  emergencyNotice:
    "If a child is in immediate danger, contact the appropriate emergency, law-enforcement or child-protection authority immediately. Do not wait for a response from this website.",
  foundedYear: 2010,
};

export const suite: Suite = {
  name: "content",
  async run() {
    const t = recorder();

    /* ── Defaults ── */
    await t.check("every singleton default parses", () => {
      const bad = DOC_IDS.filter((id) => !DocSchemas[id].safeParse(DEFAULT_DOCS[id]).success);
      return bad.length === 0 ? true : `invalid: ${bad.join(", ")}`;
    });
    await t.check("every seeded item parses, ids unique", () => {
      const bad: string[] = [];
      for (const c of COLLECTION_NAMES) {
        const ids = new Set<string>();
        for (const it of DEFAULT_ITEMS[c]) {
          if (ids.has(it.id)) bad.push(`${c}/${it.id} (duplicate)`);
          ids.add(it.id);
          if (!ItemSchemas[c].safeParse(it.data).success) bad.push(`${c}/${it.id}`);
        }
      }
      return bad.length === 0 ? true : `invalid: ${bad.join(", ")}`;
    });
    await t.check("pipeline exposes every media id plus fallback-warm", () => {
      const assets = pipelineAssets();
      return assets[FALLBACK_MEDIA_ID]?.safeguarding.peopleVisible === false && !!assets["hero-family-in"] && assets["hero-1"]?.kind === "video" ? true : "pipeline assets incomplete";
    });
    await t.check("inline text: bold, italic and safe links only", () => {
      const plain = inlineToPlain("**Bold** and _italic_ with a [link](/donate).");
      const issues = inlineIssues("[bad](javascript:alert(1)) <b>x</b> **open");
      return plain === "Bold and italic with a link." && issues.length === 3 ? true : `plain=${plain} issues=${issues.length}`;
    });

    /* ── The landing page, as today ── */
    const home = await getHomeContent();
    await t.check("hero: seven slides with today's titles and places", () =>
      home.hero.slides.length === 7 && same(home.hero.slides.map((s) => s.title), TODAY.heroTitles) && same(home.hero.slides.map((s) => s.place), TODAY.heroPlaces)
        ? true
        : show(home.hero.slides.map((s) => [s.title, s.place])),
    );
    await t.check("hero: first slide is the film, the others are stills", () =>
      home.hero.slides[0]?.media.type === "video" && home.hero.slides.slice(1).every((s) => s.media.type === "image") ? true : show(home.hero.slides.map((s) => s.media.type)),
    );
    await t.check("appeals: eight cards, today's currencies, raised and goals", () =>
      same(home.appeals.causes.map((c) => c.currency), TODAY.appealCurrencies) &&
      same(home.appeals.causes.map((c) => c.raised), TODAY.appealRaised) &&
      same(home.appeals.causes.map((c) => c.goal), TODAY.appealGoals) &&
      same(home.appeals.section.groups.map((g) => g.label), TODAY.appealGroups) &&
      home.appeals.showNote
        ? true
        : show(home.appeals.causes.map((c) => [c.slug, c.currency, c.raised, c.goal])),
    );
    await t.check("impact and restoring figures, partners strip", () =>
      same(home.impact.stats.map((s) => s.value), TODAY.impact) &&
      home.impact.showNote &&
      same(home.restoring.stats.map((s) => [s.value, s.label, s.tone]), TODAY.restoring) &&
      same(home.partners.title, TODAY.partnersTitle)
        ? true
        : show({ impact: home.impact.stats, restoring: home.restoring.stats, partners: home.partners.title }),
    );
    await t.check("focus words, programmes and card notices", () =>
      same(home.focus.items, TODAY.focus) &&
      same(home.programmes.items.map((p) => p.title), TODAY.programmeTitles) &&
      same(home.programmes.items.map((p) => p.notice), TODAY.programmeNotices)
        ? true
        : show({ focus: home.focus.items, programmes: home.programmes.items.map((p) => [p.title, p.notice]) }),
    );
    await t.check("FAQs, team, stories, testimonials, journey and projects counts and order", () =>
      home.faq.items.length === TODAY.faqCount &&
      same(home.team.members.map((m) => m.name), TODAY.teamNames) &&
      home.stories.items.length === TODAY.storyCount &&
      same(home.testimonials.items.map((x) => x.name), TODAY.testimonialNames) &&
      same(home.journey.steps.map((s) => s.title), TODAY.journeySteps) &&
      same(home.projects.items.map((p) => [p.title, p.subtitle]), TODAY.projects)
        ? true
        : show({ faq: home.faq.items.length, team: home.team.members.length, stories: home.stories.items.length }),
    );
    await t.check("news cards: today's dates, labels and titles", () =>
      same(home.news.posts.map((p) => [p.dateLabel, p.categoryLabel, p.title]), TODAY.news) ? true : show(home.news.posts.map((p) => [p.dateLabel, p.categoryLabel, p.title])),
    );
    await t.check("donate widget: currencies, amounts, frequencies and in-kind items", () =>
      same(home.donate.config.currencies.map((c) => [c.code, c.name, c.min, c.amounts]), TODAY.donateCurrencies) &&
      same(home.donate.config.frequencies.map((f) => f.label), TODAY.frequencies) &&
      home.donate.config.inKind.length === TODAY.inKindCount &&
      home.donate.config.defaultCurrency === "GMD"
        ? true
        : show(home.donate.config),
    );
    await t.check("doors notice, founder years and hidden final call to action", () =>
      home.doors.emergencyNotice === TODAY.emergencyNotice &&
      home.founder.yearsOfService === new Date().getFullYear() - TODAY.foundedYear &&
      home.finalCta.visible === false &&
      home.hidden.length === 0
        ? true
        : show({ notice: home.doors.emergencyNotice, years: home.founder.yearsOfService, finalCta: home.finalCta.visible }),
    );

    await t.check("site chrome: contact line, phone link, menus and the illustrative notice", async () => {
      const chrome = await getSiteChrome();
      const programmesMenu = chrome.nav.find((n) => n.mega);
      const ok =
        chrome.contact.address === "Kanifing, The Gambia · California, USA" &&
        chrome.contact.phoneHref === "tel:+2200000000" &&
        chrome.contact.socials.length === 6 &&
        chrome.ticker.length === 6 &&
        chrome.footerLinks.programmes.length === 6 &&
        chrome.footerLinks.legal.some((l) => l.href === "/policies/safeguarding") &&
        !!programmesMenu &&
        chrome.anyIllustrativeInUse &&
        chrome.site.yearsOfService === new Date().getFullYear() - TODAY.foundedYear;
      return ok ? true : show({ contact: chrome.contact.address, phone: chrome.contact.phoneHref, illustrative: chrome.anyIllustrativeInUse });
    });
    await t.check("pages, programmes, causes and posts resolve by key and slug", async () => {
      const [about, education, eid, post, missing] = await Promise.all([
        getPage("about"),
        getProgramme("education"),
        getCause("eid-clothes-gifts"),
        getPost("back-to-school-50-children"),
        getProgramme("nope"),
      ]);
      const ok =
        about.hero.title[0] === "Who We Are" &&
        education?.causeSlug === "education" &&
        education.notices[0]?.tone === "info" &&
        eid?.currency === "GMD" &&
        eid.raised === 38500 &&
        eid.showFigures &&
        !eid.verified &&
        post?.categoryLabel === "Education" &&
        post.dateLabel === "September 12, 2026" &&
        missing === null;
      return ok ? true : show({ about: about.hero.title, education: education?.causeSlug, eid: eid?.raised, post: post?.dateLabel });
    });

    /* ── Dynamic routes always have at least one entry (D6) ── */
    await t.check("published posts, projects, programmes, causes, policies and resources are non-empty", async () => {
      const [slugs, projects, programmes, causes, policies, resources] = await Promise.all([
        getPublishedPostSlugs(),
        getProjects(),
        getProgrammes(),
        getCauses({ liveOnly: false }),
        getPolicies(),
        getResources(),
      ]);
      const counts = { posts: slugs.length, projects: projects.length, programmes: programmes.length, causes: causes.length, policies: policies.length, resources: resources.total };
      return Object.values(counts).every((n) => n > 0) && programmes.length === 6 && causes.length === 15 ? true : show(counts);
    });

    /* ── Write pipeline ── */
    const store = contentStore();
    if (!store.writable) {
      t.cases.push({ name: "write pipeline", ok: false, detail: `the content store is not writable (backend ${store.mode}); write cases skipped` });
      return t.cases;
    }
    const cm = viewerAs("content_manager");
    const sa = viewerAs("super_admin");
    const id = "home.impact" as const;
    const original = await loadDoc(id);
    const startVersion = (await store.getDoc(id))?.version ?? 0;
    const changed = { ...original, text: `${original.text.slice(0, 170)} (selftest)` };
    let version = startVersion;

    await t.check("unknown keys are rejected", async () => {
      const o = await writeDoc(cm, { id, baseVersion: version, data: { ...original, surprise: true }, intent: "draft" });
      return errorKind(o) === "validation" ? true : errorKind(o);
    });
    await t.check("layout limits are enforced (an Impact card too many)", async () => {
      const o = await writeDoc(cm, { id, baseVersion: version, data: { ...original, cards: [...original.cards, original.cards[0]] }, intent: "draft" });
      return errorKind(o) === "validation" ? true : errorKind(o);
    });
    await t.check("saving a draft leaves the live value unchanged", async () => {
      const o = await writeDoc(cm, { id, baseVersion: version, data: changed, intent: "draft" });
      if (!o.result.ok) return `draft save: ${errorKind(o)}`;
      version = o.result.data.version;
      const live = await loadDoc(id);
      const preview = await loadDoc(id, { preview: true });
      return live.text === original.text && preview.text === changed.text ? true : show({ live: live.text, preview: preview.text });
    });
    await t.check("publishing changes the live value", async () => {
      const o = await writeDoc(cm, { id, baseVersion: version, data: changed, intent: "publish" });
      if (!o.result.ok) return `publish: ${errorKind(o)}`;
      version = o.result.data.version;
      expire(o.tags);
      return (await loadDoc(id)).text === changed.text && o.tags.includes(`content:${id}`) ? true : "live value not updated";
    });
    await t.check("a stale baseVersion is a conflict", async () => {
      const o = await writeDoc(cm, { id, baseVersion: Math.max(0, version - 1), data: original, intent: "draft" });
      return errorKind(o) === "conflict" ? true : errorKind(o);
    });
    await t.check("an earlier version was snapshotted", async () => {
      const versions = await store.listVersions({ kind: "doc", id });
      return versions.length > 0 ? true : "no versions listed";
    });
    await t.check("restoring today's Impact section", async () => {
      const o = await writeDoc(cm, { id, baseVersion: version, data: original, intent: "publish" });
      if (!o.result.ok) return `restore: ${errorKind(o)}`;
      version = o.result.data.version;
      expire(o.tags);
      return same(await loadDoc(id), original) ? true : "restored value differs";
    });

    await t.check("a content manager changing a cause goal is forbidden (with paths)", async () => {
      const rec = await store.getItem("causes", "education");
      const cause = rec?.published as Record<string, unknown> | null;
      if (!rec || !cause) return "cause education missing";
      const o = await writeItem(cm, { collection: "causes", id: "education", baseVersion: rec.version, data: { ...cause, goal: Number(cause.goal ?? 0) + 100 }, intent: "draft" });
      return !o.result.ok && o.result.error.kind === "forbidden" && (o.result.error.paths ?? []).includes("goal") ? true : show(o.result);
    });
    await t.check("a content manager changing a locked answer is forbidden", async () => {
      const rec = await store.getItem("faqs", "faq-emergency");
      const faq = rec?.published as Record<string, unknown> | null;
      if (!rec || !faq) return "faq-emergency missing";
      const o = await writeItem(cm, { collection: "faqs", id: "faq-emergency", baseVersion: rec.version, data: { ...faq, a: `${String(faq.a)} ` + "Edited." }, intent: "draft" });
      return errorKind(o) === "forbidden" ? true : errorKind(o);
    });
    await t.check("a changed figure without verification cannot go live", async () => {
      const rec = await store.getItem("stats", "children-supported");
      const stat = rec?.published as Record<string, unknown> | null;
      if (!rec || !stat) return "stat children-supported missing";
      const o = await writeItem(sa, {
        collection: "stats",
        id: "children-supported",
        baseVersion: rec.version,
        data: { ...stat, value: Number(stat.value ?? 0) + 1, verification: { status: "placeholder" } },
        intent: "publish",
      });
      return !o.result.ok && o.result.error.kind === "blocked" && o.result.error.reasons.length > 0 ? true : show(o.result);
    });
    await t.check("a programme officer cannot publish site copy", async () => {
      const o = await writeDoc(viewerAs("programme_officer"), { id, baseVersion: version, data: original, intent: "draft" });
      return errorKind(o) === "forbidden" ? true : errorKind(o);
    });

    /* ── Posts: the review workflow and AI drafts (temporary posts, deleted at the end) ── */
    const ALL_TICKED = {
      factsChecked: true,
      figuresMatchVerifiedStats: true,
      noChildIdentified: true,
      noPreciseLocations: true,
      consentForPeopleShown: true,
      noAdviceOrDiagnosis: true,
    };
    await t.check("post workflow: draft → review → blocked until checked → live → taken down → deleted", async () => {
      const slug = `selftest-${Date.now().toString(36)}`;
      const created = await writeItem(cm, {
        collection: "posts",
        data: {
          slug,
          title: "Selftest post",
          excerpt: "A temporary post written by the content selftest.",
          cover: { $media: "news-1" },
          category: "news",
          body: [{ id: "p1", type: "paragraph", text: "Selftest." }],
          author: { displayName: "Haven team" },
        },
        intent: "draft",
      });
      if (!created.result.ok) return `create: ${errorKind(created)}`;
      let v = created.result.data.version;
      try {
        const early = await writeItem(cm, { collection: "posts", id: slug, baseVersion: v, data: (await store.getItem("posts", slug))?.draft, intent: "publish" });
        if (errorKind(early) !== "not_allowed") return `publishing an unreviewed post: ${errorKind(early)}`;
        const submitted = await transitionPost(cm, { id: slug, baseVersion: v, edge: "submit" });
        if (!submitted.result.ok) return `submit: ${errorKind(submitted)}`;
        v = submitted.result.data.version;
        const blocked = await transitionPost(cm, { id: slug, baseVersion: v, edge: "approve" });
        if (errorKind(blocked) !== "blocked") return `approve without checklist: ${errorKind(blocked)}`;
        const approved = await transitionPost(cm, { id: slug, baseVersion: v, edge: "approve", checklist: ALL_TICKED });
        if (!approved.result.ok) return `approve: ${show(approved.result)}`;
        v = approved.result.data.version;
        expire(approved.tags);
        const live = (await loadItems("posts")).find((p) => p.slug === slug);
        if (live?.status !== "published") return `after approve: ${live?.status ?? "missing"}`;
        const down = await transitionPost(cm, { id: slug, baseVersion: v, edge: "unpublish" });
        if (!down.result.ok) return `unpublish: ${errorKind(down)}`;
        v = down.result.data.version;
        expire(down.tags);
        return (await loadItems("posts")).some((p) => p.slug === slug) ? "still live after unpublish" : true;
      } finally {
        const rec = await store.getItem("posts", slug);
        if (rec) {
          const removed = await removeItem(sa, { collection: "posts", id: slug, baseVersion: rec.version });
          expire(removed.tags);
        }
      }
    });
    await t.check("an AI draft arrives waiting for review, origin AI, checklist empty", async () => {
      const result = await createAiDraft(
        {
          title: "Selftest AI draft",
          excerpt: "A temporary draft created by the content selftest.",
          category: "impact-update",
          body: [{ id: "p1", type: "paragraph", text: "Selftest." }],
          origin: { via: "monthly", model: "selftest", promptVersion: "selftest-1", sources: ["selftest"] },
        },
        systemActor("Selftest"),
      );
      if (!result.ok) return `create: ${show(result.error)}`;
      const rec = await store.getItem("posts", result.data.id);
      try {
        const d = rec?.draft as { status?: string; origin?: { kind?: string }; review?: { checklist?: Record<string, boolean> } } | null;
        const anyTicked = Object.values(d?.review?.checklist ?? {}).some(Boolean);
        return rec?.published === null && d?.status === "in_review" && d.origin?.kind === "ai" && !anyTicked ? true : show(d);
      } finally {
        if (rec) await removeItem(sa, { collection: "posts", id: rec.id, baseVersion: rec.version });
      }
    });

    return t.cases;
  },
};
