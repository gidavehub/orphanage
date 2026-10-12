// Display helpers for the resources library: publication dates and file sizes. Isomorphic.

import type { ResourceSummary } from "@/lib/model/dto";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "March 2026" (or "Coming soon" for an undated placeholder). */
export function publishedLabel(ms: number): string {
  return ms > 0 ? monthYear.format(new Date(ms)) : "Coming soon";
}

/** "2026-03-01" for <time dateTime>. */
export function isoDay(ms: number): string | undefined {
  return ms > 0 ? new Date(ms).toISOString().slice(0, 10) : undefined;
}

/** "2.3 MB", "640 KB". */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** ResourceCard props from a summary. */
export function cardProps(r: ResourceSummary, hrefs: { href: string; downloadHref?: string; requestHref?: string }) {
  return {
    title: r.title,
    ...(r.cover ? { cover: r.cover } : {}),
    date: publishedLabel(r.publicationDate),
    dateTime: isoDay(r.publicationDate),
    category: RESOURCE_CATEGORY_LABEL[r.category],
    summary: r.shortDescription,
    access: r.access === "public" ? ("public" as const) : ("request" as const),
    ...(r.file ? { file: { size: fileSize(r.file.sizeBytes), type: "PDF" } } : {}),
    ...hrefs,
  };
}

/** Medical and legal resources carry a short disclaimer (public-pages §3.9). */
export function disclaimerFor(category: ResourceSummary["category"]): string | null {
  if (category === "medical_information") return "General information only, not medical advice. Please speak to a qualified health worker.";
  if (category === "legal_information") return "General information only, not legal advice. Please speak to a qualified lawyer.";
  return null;
}
