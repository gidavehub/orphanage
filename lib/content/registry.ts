// The content registry (content-model §3.4–3.5, §5.3; PLAN D60, D85). Isomorphic: the admin uses it
// to build editors (lib/studio/registry.ts is generated from it), grey out fields and show preview
// links; the write pipeline uses it to enforce field groups, run gates and invalidate tags.
//
// Field groups are evaluated in order; the first group whose paths match a changed path (and whose
// `when` applies to the record before or after the change) decides who may change it. "*" matches
// every path. Super admins may change everything.

import type { z } from "zod";
import { COLLECTION_NAMES, DOC_IDS, type CollectionName, type DocId, type PageKey } from "./ids";
import { DocSchemas, ItemSchemas } from "./schema";
import { TAG, tagsForItem } from "@/lib/cache/tags";
import type { Role } from "@/lib/model/permissions";
import { routeHref } from "@/lib/routes";

const SA: Role = "super_admin";
const CM: Role = "content_manager";
const PO: Role = "programme_officer";
const SO: Role = "safeguarding_officer";
const FO: Role = "finance_officer";
const RM: Role = "report_manager";

export type FieldGroup = {
  name: string;
  /** Path prefixes ("goal", "allocation", "notices"); "*" matches every path. */
  paths: readonly string[];
  /** Roles that may change these paths. Empty = only through a dedicated action (or nobody). */
  edit: readonly Role[];
  /** Plain words shown when someone else tries ("Only the finance team can change amounts."). */
  message: string;
  /** Applies only to records matching this predicate (stats by kind, locked FAQs, one policy). */
  when?: (data: unknown) => boolean;
};

/** Publish-time checks run by lib/content/gate.ts. Media consent is always checked. */
export type GateKind = "consent" | "permission" | "allocation" | "review" | "policyReview" | "statVerification";

export type DocSpec = {
  id: DocId;
  /** Warm label for staff. */
  label: string;
  schema: z.ZodType;
  edit: readonly Role[];
  fieldGroups: readonly FieldGroup[];
  /** Public path to preview, or null. */
  previewPath: string | null;
  /** Admin studio page that holds this slot (/admin/website/[page]), or where it is managed instead. */
  studio: { page: string } | { managedIn: string };
  tags: () => string[];
  publishGate: readonly GateKind[];
  /** Publishes straight away from the Key information editor (D61). */
  keyInfo?: boolean;
  /** Film-only media slots (content-model §6.7): the picker offers videos only and publishing checks it. */
  videoPaths?: readonly string[];
};

export type CollectionSpec = {
  name: CollectionName;
  label: string;
  itemLabel: string;
  schema: z.ZodType;
  edit: readonly Role[];
  /** Who may add items; empty = fixed set (programmes). */
  create: readonly Role[];
  fieldGroups: readonly FieldGroup[];
  previewPath: (item: { id: string; slug?: string }) => string | null;
  tags: (item: { id: string; slug?: string }) => string[];
  publishGate: readonly GateKind[];
  /** Admin screen that manages the items (D60). */
  managedIn: string;
  /** Items are addressed by `slug` in URLs; the slug freezes after the first publish. */
  slugged: boolean;
  /** Item ids are fixed in code (no create or delete; hide only). */
  fixedIds?: boolean;
};

const ALL_COPY = (edit: readonly Role[]): FieldGroup => ({ name: "copy", paths: ["*"], edit, message: "You don't have access to change this." });

/* ── Singletons ────────────────────────────────────────────────────────── */

const DOC_LABEL: Record<DocId, string> = {
  "settings.site": "Organisation details",
  "settings.contact": "Contact details & social links",
  "settings.safety": "Safety notices",
  "settings.announcements": "Messages in the menu bar",
  "settings.chrome": "Header & footer buttons",
  "settings.seo": "How Haven looks when shared",
  "settings.editorial": "Monthly story plan (AI drafts)",
  "home.layout": "Show or hide home sections",
  "home.hero": "Welcome slideshow",
  "home.world": "Countries we stand with",
  "home.partners": "Partners strip",
  "home.programmes": "Programmes heading",
  "home.about": "About Haven",
  "home.duo": "Volunteer & partner cards",
  "home.manifesto": "“Every Child” film",
  "home.impact": "Impact numbers",
  "home.focus": "What we stand for",
  "home.appeals": "Appeals heading & filters",
  "home.donate": "Donate box words",
  "home.doors": "“You do not have to face it alone”",
  "home.stories": "Stories heading",
  "home.founder": "A word from our founder",
  "home.team": "Team heading",
  "home.restoring": "“We always stand with children”",
  "home.testimonials": "Testimonials heading",
  "home.journey": "How we reach every child",
  "home.projects": "Recent projects heading",
  "home.faq": "Questions heading & photos",
  "home.join": "Join the Haven family",
  "home.news": "Latest news heading",
  "home.finalCta": "Closing call to action",
  "donate.config": "Currencies, amounts & in-kind items",
  "pages.about": "About page",
  "pages.programmes": "Programmes page",
  "pages.getSupport": "Get Support page",
  "pages.requestSupport": "Request Support page",
  "pages.reportConcern": "Report a Concern page",
  "pages.contact": "Contact page",
  "pages.resources": "Resources page",
  "pages.requestReport": "Request a Report page",
  "pages.impact": "Our Impact page",
  "pages.projects": "Projects page",
  "pages.stories": "Stories page",
  "pages.shareStory": "Share Your Story page",
  "pages.news": "News page",
  "pages.getInvolved": "Get Involved page",
  "pages.volunteer": "Volunteer page",
  "pages.partner": "Partner page",
  "pages.sponsor": "Sponsorship page",
  "pages.donate": "Donate page",
  "pages.thankYou": "Thank-you page",
  "pages.faq": "Questions page",
  "pages.policies": "Policies page",
  "pages.search": "Search page",
  "pages.privacyRequest": "Privacy request page",
  "pages.notFound": "Page not found",
};

/** Home slots and their in-page anchors on "/" (preview scrolls there). */
const HOME_ANCHOR: Partial<Record<DocId, string>> = {
  "home.hero": "#top",
  "home.programmes": "#programmes",
  "home.about": "#about",
  "home.duo": "#involved",
  "home.impact": "#impact",
  "home.appeals": "#appeals",
  "home.donate": "#donate",
  "home.doors": "#support",
  "home.stories": "#stories",
  "home.team": "#team",
  "home.faq": "#faq",
  "home.news": "#news",
};

const PAGE_PATH: Record<PageKey, string | null> = {
  about: routeHref("about"),
  programmes: routeHref("programmes"),
  getSupport: routeHref("getSupport"),
  requestSupport: routeHref("support"),
  reportConcern: routeHref("report"),
  contact: routeHref("contact"),
  resources: routeHref("resources"),
  requestReport: routeHref("requestReport"),
  impact: routeHref("impact"),
  projects: routeHref("projects"),
  stories: routeHref("stories"),
  shareStory: routeHref("tellStory"),
  news: routeHref("news"),
  getInvolved: routeHref("involved"),
  volunteer: routeHref("volunteer"),
  partner: routeHref("partner"),
  sponsor: routeHref("sponsor"),
  donate: routeHref("donate"),
  thankYou: "/donate/thank-you",
  faq: routeHref("faq"),
  policies: routeHref("policies"),
  search: "/search",
  privacyRequest: "/privacy/request",
  notFound: null,
};

/** Film-only slots on the home page (content-model §6.7). */
const VIDEO_SLOTS: Partial<Record<DocId, readonly string[]>> = {
  "home.manifesto": ["media"],
  "home.donate": ["media"],
  "home.join": ["media"],
  "home.restoring": ["film"],
};

/** Studio page keys (admin-ux §4.2 `/admin/website/[page]`). */
const PAGE_STUDIO: Record<PageKey, string> = {
  about: "about",
  programmes: "programmes",
  getSupport: "get-support",
  requestSupport: "request-support",
  reportConcern: "report-concern",
  contact: "contact",
  resources: "resources",
  requestReport: "request-report",
  impact: "impact",
  projects: "projects",
  stories: "stories",
  shareStory: "share-story",
  news: "news",
  getInvolved: "get-involved",
  volunteer: "volunteer",
  partner: "partner",
  sponsor: "sponsor",
  donate: "donate",
  thankYou: "thank-you",
  faq: "faq",
  policies: "policies",
  search: "search",
  privacyRequest: "privacy-request",
  notFound: "not-found",
};

function docSpec(id: DocId): DocSpec {
  const base = {
    id,
    label: DOC_LABEL[id],
    schema: DocSchemas[id] as z.ZodType,
    tags: () => [TAG.doc(id)],
    publishGate: [] as GateKind[],
  };
  if (id.startsWith("pages.")) {
    const key = id.slice("pages.".length) as PageKey;
    const edit: Role[] = key === "reportConcern" ? [SA, SO] : key === "resources" ? [SA, CM, RM] : [SA, CM];
    return { ...base, edit, fieldGroups: [ALL_COPY(edit)], previewPath: PAGE_PATH[key], studio: { page: PAGE_STUDIO[key] } };
  }
  if (id.startsWith("home.")) {
    const anchor = HOME_ANCHOR[id] ?? "";
    const groups: FieldGroup[] =
      id === "home.donate"
        ? [
            {
              name: "legal",
              paths: ["updatesConsentLabel", "anonymousLabel"],
              edit: [SA],
              message: "The consent wording is legal text: only a super admin can change it.",
            },
            ALL_COPY([SA, CM]),
          ]
        : [ALL_COPY([SA, CM])];
    const videoPaths = VIDEO_SLOTS[id];
    return { ...base, edit: [SA, CM], fieldGroups: groups, previewPath: `/${anchor}`, studio: { page: "home" }, ...(videoPaths ? { videoPaths } : {}) };
  }
  switch (id) {
    case "settings.site":
      return {
        ...base,
        edit: [SA, CM],
        keyInfo: true,
        fieldGroups: [
          {
            name: "brand",
            paths: ["name", "orgName", "foundedYear"],
            edit: [SA],
            message: "The organisation's name and founding year can only be changed by a super admin.",
          },
          {
            name: "launch",
            paths: ["registrations", "figures"],
            edit: [SA],
            message: "Registration numbers and the before-launch switches are for a super admin.",
          },
          ALL_COPY([SA, CM]),
        ],
        previewPath: "/",
        studio: { page: "key-info" },
      };
    case "settings.contact":
      return { ...base, edit: [SA, CM], keyInfo: true, fieldGroups: [ALL_COPY([SA, CM])], previewPath: "/#site-footer", studio: { page: "key-info" } };
    case "settings.safety":
      return {
        ...base,
        edit: [SA, SO],
        keyInfo: true,
        fieldGroups: [
          {
            name: "safety",
            paths: ["*"],
            edit: [SA, SO],
            message: "This wording protects children. Only the safeguarding officer or a super admin can change it.",
          },
        ],
        previewPath: "/#support",
        studio: { page: "key-info" },
      };
    case "settings.announcements":
      return { ...base, edit: [SA, CM], keyInfo: true, fieldGroups: [ALL_COPY([SA, CM])], previewPath: "/", studio: { page: "key-info" } };
    case "settings.chrome":
      return { ...base, edit: [SA, CM], fieldGroups: [ALL_COPY([SA, CM])], previewPath: "/#site-footer", studio: { page: "footer" } };
    case "settings.seo":
      return { ...base, edit: [SA, CM], fieldGroups: [ALL_COPY([SA, CM])], previewPath: null, studio: { page: "footer" } };
    case "settings.editorial":
      return { ...base, edit: [SA, CM], fieldGroups: [ALL_COPY([SA, CM])], previewPath: null, studio: { managedIn: "/admin/posts/plan" } };
    case "donate.config":
      return {
        ...base,
        edit: [SA, FO],
        fieldGroups: [{ name: "money", paths: ["*"], edit: [SA, FO], message: "Currencies and amounts are set by the finance team." }],
        previewPath: "/#donate",
        studio: { managedIn: "/admin/settings/giving" },
      };
    default:
      return { ...base, edit: [SA, CM], fieldGroups: [ALL_COPY([SA, CM])], previewPath: null, studio: { page: "home" } };
  }
}

export const DOCS: Readonly<Record<DocId, DocSpec>> = Object.fromEntries(DOC_IDS.map((id) => [id, docSpec(id)])) as Record<DocId, DocSpec>;

/* ── Collections ───────────────────────────────────────────────────────── */

const isFinanceStat = (d: unknown) => (d as { kind?: string } | null)?.kind === "finance";
const isLockedFaq = (d: unknown) => (d as { locked?: boolean } | null)?.locked === true;
const isSafeguardingPolicy = (d: unknown) => (d as { slug?: string } | null)?.slug === "safeguarding";

const WORKFLOW_ONLY = "Use the review buttons (Send for review, Put live) to change this.";

const slugPath = (prefix: string) => (item: { id: string; slug?: string }) => `${prefix}/${encodeURIComponent(item.slug ?? item.id)}`;

export const COLLECTIONS: Readonly<Record<CollectionName, CollectionSpec>> = {
  programmes: {
    name: "programmes",
    label: "Programmes",
    itemLabel: "programme",
    schema: ItemSchemas.programmes,
    edit: [SA, CM, PO, SO],
    create: [],
    fixedIds: true,
    fieldGroups: [
      { name: "fixed", paths: ["id", "slug"], edit: [], message: "Programme web addresses are fixed. Ask a developer to add or rename a programme." },
      {
        name: "notices",
        paths: ["notices"],
        edit: [SA, SO],
        message: "Safety notices are worded by the safeguarding officer. Ask them to change it.",
      },
      ALL_COPY([SA, CM, PO]),
    ],
    previewPath: slugPath("/programmes"),
    tags: (item) => tagsForItem("programmes", item),
    publishGate: [],
    managedIn: "/admin/website/programmes",
    slugged: true,
  },
  causes: {
    name: "causes",
    label: "Appeals & causes",
    itemLabel: "cause",
    schema: ItemSchemas.causes,
    edit: [SA, CM, FO],
    create: [SA, CM, FO],
    fieldGroups: [
      {
        name: "money",
        paths: ["currency", "goal", "offlineRaised", "convertedRaised", "allocation", "allocationAsOf", "impactUnits", "presetAmounts", "verification"],
        edit: [SA, FO],
        message: "Only the finance team can change amounts and the spending breakdown.",
      },
      ALL_COPY([SA, CM, FO]),
    ],
    previewPath: (item) => (item.slug === "general" ? "/donate" : slugPath("/donate")(item)),
    tags: (item) => tagsForItem("causes", item),
    publishGate: ["allocation"],
    managedIn: "/admin/giving/causes",
    slugged: true,
  },
  stats: {
    name: "stats",
    label: "Impact numbers",
    itemLabel: "figure",
    schema: ItemSchemas.stats,
    edit: [SA, CM, PO, FO],
    create: [SA],
    fieldGroups: [
      { name: "kind", paths: ["kind"], edit: [SA], message: "Only a super admin can change what kind of figure this is." },
      {
        name: "financeValue",
        paths: ["value", "suffix", "verification", "amounts", "asOf"],
        edit: [SA, FO],
        message: "Money figures are checked and changed by the finance team.",
        when: isFinanceStat,
      },
      {
        name: "programmeValue",
        paths: ["value", "suffix", "verification", "amounts", "asOf"],
        edit: [SA, PO],
        message: "Programme figures are checked and changed by a programme officer.",
      },
      ALL_COPY([SA, CM]),
    ],
    previewPath: () => routeHref("impact"),
    tags: (item) => tagsForItem("stats", item),
    publishGate: ["statVerification"],
    managedIn: "/admin/website/impact",
    slugged: false,
  },
  stories: {
    name: "stories",
    label: "Stories of hope",
    itemLabel: "story",
    schema: ItemSchemas.stories,
    edit: [SA, CM, SO],
    create: [SA, CM],
    fieldGroups: [
      { name: "consent", paths: ["consent"], edit: [SA, CM, SO], message: "Consent is recorded by the content team or the safeguarding officer." },
      ALL_COPY([SA, CM]),
    ],
    previewPath: () => routeHref("stories"),
    tags: (item) => tagsForItem("stories", item),
    publishGate: ["consent"],
    managedIn: "/admin/website/stories",
    slugged: false,
  },
  testimonials: {
    name: "testimonials",
    label: "Testimonials",
    itemLabel: "testimonial",
    schema: ItemSchemas.testimonials,
    edit: [SA, CM, SO],
    create: [SA, CM],
    fieldGroups: [
      { name: "consent", paths: ["consent"], edit: [SA, CM, SO], message: "Consent is recorded by the content team or the safeguarding officer." },
      ALL_COPY([SA, CM]),
    ],
    previewPath: () => routeHref("about"),
    tags: (item) => tagsForItem("testimonials", item),
    publishGate: ["consent"],
    managedIn: "/admin/website/home",
    slugged: false,
  },
  team: {
    name: "team",
    label: "Team",
    itemLabel: "team member",
    schema: ItemSchemas.team,
    edit: [SA, CM],
    create: [SA, CM],
    fieldGroups: [ALL_COPY([SA, CM])],
    previewPath: () => `${routeHref("about")}#team`,
    tags: (item) => tagsForItem("team", item),
    publishGate: [],
    managedIn: "/admin/website/about",
    slugged: false,
  },
  faqs: {
    name: "faqs",
    label: "Questions",
    itemLabel: "question",
    schema: ItemSchemas.faqs,
    edit: [SA, CM, SO],
    create: [SA, CM, SO],
    fieldGroups: [
      {
        name: "locked",
        paths: ["*"],
        edit: [SA, SO],
        message: "This answer is safety wording. Only the safeguarding officer can change it.",
        when: isLockedFaq,
      },
      { name: "lockFlag", paths: ["locked"], edit: [SA, SO], message: "Only the safeguarding officer can lock or unlock an answer." },
      ALL_COPY([SA, CM]),
    ],
    previewPath: () => routeHref("faq"),
    tags: (item) => tagsForItem("faqs", item),
    publishGate: [],
    managedIn: "/admin/website/faq",
    slugged: false,
  },
  partners: {
    name: "partners",
    label: "Partner logos",
    itemLabel: "partner",
    schema: ItemSchemas.partners,
    edit: [SA, CM],
    create: [SA, CM],
    fieldGroups: [ALL_COPY([SA, CM])],
    previewPath: () => "/",
    tags: (item) => tagsForItem("partners", item),
    publishGate: ["permission"],
    managedIn: "/admin/website/home",
    slugged: false,
  },
  projects: {
    name: "projects",
    label: "Projects",
    itemLabel: "project",
    schema: ItemSchemas.projects,
    edit: [SA, CM, PO],
    create: [SA, CM, PO],
    fieldGroups: [ALL_COPY([SA, CM, PO])],
    previewPath: slugPath("/projects"),
    tags: (item) => tagsForItem("projects", item),
    publishGate: [],
    managedIn: "/admin/website/projects",
    slugged: true,
  },
  posts: {
    name: "posts",
    label: "Posts",
    itemLabel: "post",
    schema: ItemSchemas.posts,
    edit: [SA, CM, PO],
    create: [SA, CM, PO],
    fieldGroups: [
      { name: "workflow", paths: ["status", "review", "publishedAt", "publishAt", "origin"], edit: [], message: WORKFLOW_ONLY },
      ALL_COPY([SA, CM, PO]),
    ],
    previewPath: slugPath("/news"),
    tags: (item) => tagsForItem("posts", item),
    publishGate: ["review"],
    managedIn: "/admin/posts",
    slugged: true,
  },
  policies: {
    name: "policies",
    label: "Policies",
    itemLabel: "policy",
    schema: ItemSchemas.policies,
    edit: [SA, SO],
    create: [],
    fixedIds: true,
    fieldGroups: [
      { name: "fixed", paths: ["slug"], edit: [], message: "Policy web addresses are fixed." },
      {
        name: "safeguardingPolicy",
        paths: ["*"],
        edit: [SA, SO],
        message: "The safeguarding policy is kept by the safeguarding officer and super admin.",
        when: isSafeguardingPolicy,
      },
      ALL_COPY([SA]),
    ],
    previewPath: slugPath("/policies"),
    tags: (item) => tagsForItem("policies", item),
    publishGate: ["policyReview"],
    managedIn: "/admin/website/policies",
    slugged: true,
  },
  media: {
    name: "media",
    label: "Photos & films",
    itemLabel: "photo",
    schema: ItemSchemas.media,
    edit: [SA, CM, SO],
    create: [SA, CM],
    fieldGroups: [
      {
        name: "consent",
        paths: ["safeguarding.consent", "status"],
        edit: [SA, CM, SO],
        message: "Consent is recorded by the content team or the safeguarding officer.",
      },
      ALL_COPY([SA, CM]),
    ],
    previewPath: () => null,
    tags: () => [TAG.media],
    publishGate: [],
    managedIn: "/admin/media",
    slugged: false,
  },
  allocationSummaries: {
    name: "allocationSummaries",
    label: "Where the money went",
    itemLabel: "year",
    schema: ItemSchemas.allocationSummaries,
    edit: [SA, FO],
    create: [SA, FO],
    fieldGroups: [{ name: "money", paths: ["*"], edit: [SA, FO], message: "This summary is kept by the finance team." }],
    previewPath: () => routeHref("impact"),
    tags: (item) => tagsForItem("allocationSummaries", item),
    publishGate: [],
    managedIn: "/admin/giving/where-it-goes",
    slugged: false,
  },
};

export function docSpecOf(id: DocId): DocSpec {
  return DOCS[id];
}

export function collectionSpecOf(c: CollectionName): CollectionSpec {
  return COLLECTIONS[c];
}

/** Every registered collection, in registry order. */
export const COLLECTION_SPECS: readonly CollectionSpec[] = COLLECTION_NAMES.map((c) => COLLECTIONS[c]);
