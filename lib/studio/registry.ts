// The website studio's map (admin-ux §6.10; PLAN D60): which public page each studio page previews,
// which content docs ("sections") it holds, and which collections are edited from it. Generated from
// lib/content/registry.ts (each DocSpec's `studio.page`, each CollectionSpec's `managedIn`), so a new
// doc or collection appears here without extra wiring. Client-safe: labels and keys only (schemas and
// values are loaded on the server).

import { COLLECTION_SPECS, DOCS } from "@/lib/content/registry";
import { DOC_IDS, type CollectionName, type DocId } from "@/lib/content/ids";

export type StudioSection = { id: DocId; label: string; editable: boolean; managedIn: string | null };
export type StudioCollection = { name: CollectionName; label: string; itemLabel: string };
export type StudioPage = { key: string; label: string; path: string | null; sections: StudioSection[]; collections: StudioCollection[] };

/** Studio page keys in the order of the page picker, with their labels. */
const PAGE_LABEL: Record<string, string> = {
  home: "Home",
  about: "About",
  programmes: "Programmes",
  "get-support": "Get Support",
  "request-support": "Request Support",
  "report-concern": "Report a Concern",
  impact: "Our Impact",
  projects: "Projects",
  stories: "Stories",
  "share-story": "Share Your Story",
  news: "News",
  "get-involved": "Get Involved",
  volunteer: "Volunteer",
  partner: "Partner",
  sponsor: "Sponsorship",
  donate: "Donate",
  "thank-you": "Thank you",
  resources: "Resources",
  "request-report": "Request a Report",
  faq: "Questions",
  policies: "Policies",
  contact: "Contact",
  search: "Search",
  "privacy-request": "Privacy request",
  "not-found": "Page not found",
  footer: "Header & footer",
};

/** Which section on a public page shows a collection's items (the sheet offers "Edit the … themselves"). */
export const SECTION_COLLECTION: Partial<Record<DocId, CollectionName>> = {
  "home.programmes": "programmes",
  "home.impact": "stats",
  "home.stories": "stories",
  "home.team": "team",
  "home.testimonials": "testimonials",
  "home.partners": "partners",
  "home.projects": "projects",
  "home.faq": "faqs",
  "pages.programmes": "programmes",
  "pages.impact": "stats",
  "pages.stories": "stories",
  "pages.about": "team",
  "pages.faq": "faqs",
  "pages.projects": "projects",
  "pages.policies": "policies",
};

function pageOfDoc(id: DocId): string | null {
  const s = DOCS[id].studio;
  return "page" in s ? s.page : null;
}

function pathOf(key: string): string | null {
  if (key === "home" || key === "footer") return "/";
  const id = DOC_IDS.find((d) => d.startsWith("pages.") && pageOfDoc(d) === key);
  return id ? DOCS[id].previewPath : null;
}

/** Every studio page (Key information is its own screen). */
export const STUDIO_PAGES: StudioPage[] = Object.keys(PAGE_LABEL).map((key) => ({
  key,
  label: PAGE_LABEL[key]!,
  path: pathOf(key),
  sections: DOC_IDS.filter((id) => pageOfDoc(id) === key).map((id) => ({ id, label: DOCS[id].label, editable: true, managedIn: null })),
  collections: COLLECTION_SPECS.filter((c) => c.managedIn === `/admin/website/${key}`).map((c) => ({ name: c.name, label: c.label, itemLabel: c.itemLabel })),
}));

export function studioPage(key: string): StudioPage | null {
  return STUDIO_PAGES.find((p) => p.key === key) ?? null;
}

/** The studio page that edits a section (for Find and deep links). */
export function studioPageOfDoc(id: DocId): string | null {
  return pageOfDoc(id);
}

/** "Hero slides" etc., for the bridge badges. */
export function sectionLabels(): Record<string, string> {
  return Object.fromEntries(DOC_IDS.map((id) => [id, DOCS[id].label]));
}
