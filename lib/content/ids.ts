// Content document ids and collection names (client-safe). Singletons are stored in
// `siteContent/{docId}`; collection items in top-level collections with these names (PLAN D32).
// Schemas live in lib/content/schema.ts; studio slot ids equal these doc ids (D60).

export const DOC_IDS = [
  "settings.site",
  "settings.contact",
  "settings.safety",
  "settings.announcements",
  "settings.chrome",
  "settings.seo",
  "settings.editorial",
  "home.layout",
  "home.hero",
  "home.world",
  "home.partners",
  "home.programmes",
  "home.about",
  "home.duo",
  "home.manifesto",
  "home.impact",
  "home.focus",
  "home.appeals",
  "home.donate",
  "home.doors",
  "home.stories",
  "home.founder",
  "home.team",
  "home.restoring",
  "home.testimonials",
  "home.journey",
  "home.projects",
  "home.faq",
  "home.join",
  "home.news",
  "home.finalCta",
  "donate.config",
  "pages.about",
  "pages.programmes",
  "pages.getSupport",
  "pages.requestSupport",
  "pages.reportConcern",
  "pages.contact",
  "pages.resources",
  "pages.requestReport",
  "pages.impact",
  "pages.projects",
  "pages.stories",
  "pages.shareStory",
  "pages.news",
  "pages.getInvolved",
  "pages.volunteer",
  "pages.partner",
  "pages.sponsor",
  "pages.donate",
  "pages.thankYou",
  "pages.faq",
  "pages.policies",
  "pages.search",
  "pages.privacyRequest",
  "pages.notFound",
] as const;

export type DocId = (typeof DOC_IDS)[number];

export function isDocId(v: unknown): v is DocId {
  return typeof v === "string" && (DOC_IDS as readonly string[]).includes(v);
}

/** The key after "pages." (getPage(key), content/seed/pages/<key>.ts). */
type PageKeyOf<T> = T extends `pages.${infer K}` ? K : never;
export type PageKey = PageKeyOf<DocId>;

export const PAGE_KEYS = DOC_IDS.filter((id): id is Extract<DocId, `pages.${string}`> => id.startsWith("pages.")).map(
  (id) => id.slice("pages.".length) as PageKey,
);

export function pageDocId(key: PageKey): DocId {
  return `pages.${key}` as DocId;
}

export const COLLECTION_NAMES = [
  "programmes",
  "causes",
  "stats",
  "stories",
  "testimonials",
  "team",
  "faqs",
  "partners",
  "projects",
  "posts",
  "policies",
  "media",
  "allocationSummaries",
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

export function isCollectionName(v: unknown): v is CollectionName {
  return typeof v === "string" && (COLLECTION_NAMES as readonly string[]).includes(v);
}
