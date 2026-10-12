import "server-only";

// Public library reads for /resources and /resources/[slug] (PLAN D6, D21, D101; data-model §4.5).
// Cached ('use cache' + cacheLife('content') + cacheTag(TAG.col('resources'), TAG.item(…))) over the
// `resources` collection, merged with content/seed/resources.ts: a seeded item (the D6 placeholder
// "Annual report 2025") shows until a stored record with the same slug replaces or archives it, so
// every resource route always has at least one entry. Only `published` records are listed.
// DTOs are built field by field and never carry storage paths: public files are reached through
// /api/resources/<slug>/download (D101), controlled ones only through a request (/request-a-report).
// Writers (A5's library actions) call updateTag(TAG.col('resources')) and the item tag.

import { cacheLife, cacheTag } from "next/cache";
import { resourceSeeds, type ResourceSeed } from "@/content/seed/resources";
import { TAG } from "@/lib/cache/tags";
import { resolveImage, resolveMedia } from "@/lib/content/resolve";
import { BlockSchema } from "@/lib/content/schema";
import { getMediaIndex, type MediaIndex } from "@/lib/media/index";
import type { Resource } from "@/lib/model/domain/library";
import type { ResourceDetail, ResourceSummary } from "@/lib/model/dto";
import { PROGRAMME_IDS, type ProgrammeId, type ResourceAccess, type ResourceCategory } from "@/lib/model/enums";
import type { UiImage } from "@/lib/model/ui";
import { routes } from "@/lib/routes";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

/** 12 per page on /resources (D124). */
export const RESOURCES_PAGE_SIZE = 12;

type Stored = Partial<Resource> & { id: string };
type Row = ResourceSeed | Stored;

const PAGE = 100;
const MAX_PAGES = 20;

/** Every stored resource (any status), newest first. A Firestore failure during `next build` throws. */
async function readStored(): Promise<Stored[]> {
  const out: Stored[] = [];
  try {
    const store = getStore();
    let cursor: string | null = null;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page: { items: Stored[]; nextCursor: string | null } = await store.list<Partial<Resource>>(C.resources, {
        orderBy: { field: "publicationDate", dir: "desc" },
        limit: PAGE,
        cursor,
      });
      out.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } catch (err) {
    if (resolveBackend() === "firestore" && (env as unknown as { isBuild?: boolean }).isBuild === true) throw err;
    log.error("public.resources_read_failed", { err });
  }
  return out;
}

/** Published rows: stored records first, then seeds whose slug no stored record uses. */
async function publishedRows(): Promise<Row[]> {
  const stored = await readStored();
  const slugs = new Set(stored.map((r) => r.slug).filter((s): s is string => typeof s === "string"));
  const seeds = resourceSeeds.filter((s) => !slugs.has(s.slug));
  return [...stored, ...seeds].filter(
    (r) => r.status === "published" && typeof r.slug === "string" && !!r.slug && typeof r.title === "string" && (r.access === "public" || r.access === "controlled"),
  );
}

const isProgrammeId = (v: unknown): v is ProgrammeId => typeof v === "string" && (PROGRAMME_IDS as readonly string[]).includes(v);

function coverOf(r: Row, index: MediaIndex): UiImage | null {
  if (!r.coverMediaId) return null;
  const img = resolveImage({ $media: r.coverMediaId }, index);
  return {
    src: img.src,
    alt: img.alt,
    ...(img.width ? { width: img.width } : {}),
    ...(img.height ? { height: img.height } : {}),
    ...(img.blurDataURL ? { blurDataURL: img.blurDataURL } : {}),
    ...(img.focal ? { focal: img.focal } : {}),
    illustrative: img.illustrative,
  };
}

function summaryOf(r: Row, index: MediaIndex): ResourceSummary {
  const file = r.file && typeof r.file.sizeBytes === "number" ? { format: "pdf" as const, sizeBytes: r.file.sizeBytes, pageCount: r.file.pageCount ?? null } : null;
  return {
    id: r.id,
    slug: r.slug as string,
    title: r.title as string,
    category: r.category as ResourceCategory,
    access: r.access as ResourceAccess,
    shortDescription: typeof r.shortDescription === "string" ? r.shortDescription : "",
    cover: coverOf(r, index),
    publicationDate: typeof r.publicationDate === "number" ? r.publicationDate : 0,
    programmeIds: Array.isArray(r.programmeIds) ? r.programmeIds.filter(isProgrammeId) : [],
    language: typeof r.language === "string" && r.language ? r.language : "English",
    file,
    featured: r.featured === true,
    placeholder: r.placeholder === true,
  };
}

function detailOf(r: Row, index: MediaIndex): ResourceDetail {
  const summary = summaryOf(r, index);
  const blocks = (Array.isArray(r.executiveSummary) ? r.executiveSummary : []).flatMap((b) => {
    const parsed = BlockSchema.safeParse(b);
    return parsed.success ? [parsed.data] : [];
  });
  const isPublic = summary.access === "public";
  return {
    ...summary,
    executiveSummary: resolveMedia(blocks, index) as unknown[],
    preview: r.preview && typeof r.preview.pageCount === "number" ? { pageCount: r.preview.pageCount } : null,
    downloadHref: isPublic && summary.file ? routes.resourceDownload(summary.slug) : null,
    requestHref: isPublic ? null : routes.requestReport(summary.slug),
  };
}

/** One page of the library (12 per page), filtered by category, access and a plain-text search. */
export async function getResources(
  o: { category?: ResourceCategory; q?: string; access?: ResourceAccess; page?: number } = {},
): Promise<{ items: ResourceSummary[]; total: number }> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.col("resources"), TAG.media);
  const [rows, index] = await Promise.all([publishedRows(), getMediaIndex()]);
  const q = o.q?.trim().toLowerCase().slice(0, 100);
  const matches = rows
    .filter(
      (r) =>
        (!o.category || r.category === o.category) &&
        (!o.access || r.access === o.access) &&
        (!q || String(r.title).toLowerCase().includes(q) || String(r.shortDescription ?? "").toLowerCase().includes(q)),
    )
    .sort((a, b) => Number(b.featured === true) - Number(a.featured === true) || (b.publicationDate ?? 0) - (a.publicationDate ?? 0));
  const page = Math.max(1, Math.trunc(Number.isFinite(o.page) ? (o.page as number) : 1));
  const start = (page - 1) * RESOURCES_PAGE_SIZE;
  return { items: matches.slice(start, start + RESOURCES_PAGE_SIZE).map((r) => summaryOf(r, index)), total: matches.length };
}

/** One published resource by slug, or null. */
export async function getResource(slug: string): Promise<ResourceDetail | null> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.col("resources"), TAG.item("resources", slug), TAG.media);
  const [rows, index] = await Promise.all([publishedRows(), getMediaIndex()]);
  const r = rows.find((x) => x.slug === slug);
  return r ? detailOf(r, index) : null;
}

/** Every published slug (generateStaticParams and the sitemap). Never empty: the D6 placeholder is seeded. */
export async function getResourceSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.col("resources"));
  return (await publishedRows()).map((r) => r.slug as string);
}

/** Every published resource as a picker option (the Request a Report form): controlled first. */
export async function getResourceOptions(): Promise<
  Array<{ slug: string; title: string; category: ResourceCategory; access: ResourceAccess; downloadHref: string | null }>
> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.col("resources"));
  const rows = await publishedRows();
  return rows
    .map((r) => ({
      slug: r.slug as string,
      title: r.title as string,
      category: r.category as ResourceCategory,
      access: r.access as ResourceAccess,
      downloadHref: r.access === "public" && r.file && typeof r.file.sizeBytes === "number" ? routes.resourceDownload(r.slug as string) : null,
    }))
    .sort((a, b) => Number(a.access === "public") - Number(b.access === "public") || a.title.localeCompare(b.title));
}

/**
 * Every resource for the staff library (Reports & resources, A5): stored records of any status, plus
 * the seeded placeholders no stored record replaces yet (`seeded: true`). Uncached; staff only (the
 * caller checks permissions). Saving a seeded item stores it under the same id and slug.
 */
export async function resourceRowsForStaff(): Promise<Array<Partial<Resource> & { id: string; seeded: boolean }>> {
  const stored = await readStored();
  const slugs = new Set(stored.map((r) => r.slug).filter((s): s is string => typeof s === "string"));
  const seeds = resourceSeeds.filter((s) => !slugs.has(s.slug)).map((s) => ({ ...s, seeded: true }));
  return [...stored.map((r) => ({ ...r, seeded: false })), ...seeds];
}
