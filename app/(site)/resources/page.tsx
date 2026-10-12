import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, Lock } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { PageHero } from "@/components/layout/PageHero";
import { ctaOf, eyebrowOf, textOf, titleOf } from "@/components/public/help/page-copy";
import { ResourceFilters } from "@/components/public/resources/ResourceFilters";
import { cardProps, disclaimerFor, fileSize, isoDay, publishedLabel } from "@/components/public/resources/format";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { ResourceCard } from "@/components/ui/cards/ResourceCard";
import { getPage, type PageView } from "@/lib/content/public";
import type { ResourceSummary } from "@/lib/model/dto";
import { RESOURCE_CATEGORIES, isResourceCategory, type ResourceAccess, type ResourceCategory } from "@/lib/model/enums";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { RESOURCES_PAGE_SIZE, getResources } from "@/lib/server/public/resources";

// /resources (public-pages §3.9, PLAN D101, D124): the editorial hero, then a Suspense leaf with the
// URL-synced filter bar (?q=&category=&access=), the latest report as a wide card on the unfiltered
// first page, a 12-per-page grid of ResourceCards and pagination. Public items download through
// /api/resources/<slug>/download; controlled ones lead to the request form. Filtered views are
// canonical to /resources.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("resources");
  return buildMetadata({
    title: page.seo.title ?? "Resources & Reports",
    description: page.seo.description ?? page.hero.intro ?? "Guides, policies and reports from Haven.",
    path: routes.resources(),
    noindex: page.seo.noindex === true,
  });
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function hrefsOf(r: ResourceSummary) {
  return {
    href: routes.resource(r.slug),
    ...(r.access === "public" && r.file ? { downloadHref: routes.resourceDownload(r.slug) } : {}),
    ...(r.access === "controlled" ? { requestHref: routes.requestReport(r.slug) } : {}),
  };
}

async function Library({ searchParams, page }: { searchParams: SearchParams; page: PageView }) {
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 100);
  const rawCategory = first(sp.category).trim().toLowerCase();
  const category: ResourceCategory | null = isResourceCategory(rawCategory) ? rawCategory : null;
  const rawAccess = first(sp.access).trim().toLowerCase();
  const access: ResourceAccess | null = rawAccess === "public" || rawAccess === "controlled" ? rawAccess : null;
  const pageNo = Math.max(1, Math.min(200, Math.trunc(Number(first(sp.page)) || 1)));

  const [listed, all, counts, reports] = await Promise.all([
    getResources({ category: category ?? undefined, access: access ?? undefined, q: q || undefined, page: pageNo }),
    getResources({ q: q || undefined, access: access ?? undefined }),
    Promise.all(RESOURCE_CATEGORIES.map(async (c) => [c, (await getResources({ category: c, q: q || undefined, access: access ?? undefined })).total] as const)),
    getResources({ category: "annual_reports" }),
  ]);
  const pageCount = Math.max(1, Math.ceil(listed.total / RESOURCES_PAGE_SIZE));
  const unfiltered = !q && !category && !access && pageNo === 1;
  const featured = unfiltered ? [...reports.items].sort((a, b) => b.publicationDate - a.publicationDate)[0] : undefined;
  const grid = featured ? listed.items.filter((r) => r.id !== featured.id) : listed.items;
  const emptyCta = ctaOf(page, "empty", { label: "Ask Us", href: routes.contact({ category: "resource_request" }) });
  const where = category ? ` in ${RESOURCE_CATEGORY_LABEL[category].toLowerCase()}` : "";

  return (
    <>
      <ResourceFilters q={q} category={category} access={access} counts={Object.fromEntries(counts)} total={all.total} className="lg:sticky lg:top-24 lg:z-20" />

      {featured ? <Featured r={featured} eyebrow={eyebrowOf(page, "featured", "Latest Report")} /> : null}

      <div className="mt-14">
        <h2 id="resources-list-title" className="text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">
          {category ? RESOURCE_CATEGORY_LABEL[category] : q ? `Results for “${q}”` : "All Resources"}
          <span className="ml-2 text-[16px] font-semibold text-body">
            · {listed.total} {listed.total === 1 ? "item" : "items"}
            {pageCount > 1 ? ` · Page ${Math.min(pageNo, pageCount)} of ${pageCount}` : ""}
          </span>
        </h2>
        {grid.length ? (
          <ul aria-labelledby="resources-list-title" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((r) => {
              const note = disclaimerFor(r.category);
              return (
                <li key={r.id} className="grid">
                  <div className="flex flex-col">
                    <ResourceCard {...cardProps(r, hrefsOf(r))} as="article" className="flex-1" />
                    {note ? <p className="mt-2 px-2 text-[12.5px] italic leading-snug text-body">{note}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : featured ? null : (
          <EmptyState
            className="mt-6"
            art="doodle"
            title={q ? `No resources match “${q}”${where} yet.` : `Nothing here${where} yet.`}
            body={textOf(page, "empty", "Try another word, or ask us for a resource.")}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button href={routes.resources()} variant="outline" icon="none">
                  Clear Filters
                </Button>
                <Button href={emptyCta.href} variant="forest" icon="arrow">
                  {emptyCta.label}
                </Button>
              </div>
            }
          />
        )}
        <Pagination
          page={pageNo}
          pageCount={pageCount}
          hrefFor={(n) => routes.resources({ q, category: category ?? undefined, access: access ?? undefined, page: n })}
          label="Resource pages"
          className="mt-14"
        />
      </div>
    </>
  );
}

function Featured({ r, eyebrow }: { r: ResourceSummary; eyebrow?: string }) {
  const isPublic = r.access === "public";
  return (
    <article className="mt-12 grid overflow-hidden rounded-card-lg bg-white shadow-card md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Link href={routes.resource(r.slug)} tabIndex={-1} aria-hidden className="paper relative block aspect-[4/3] md:aspect-auto md:min-h-[360px]">
        {r.cover ? (
          <Image src={r.cover.src} alt="" fill sizes="(min-width:768px) 40vw, 100vw" className="object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <FileText className="size-24 text-forest/35" strokeWidth={1.25} />
          </span>
        )}
      </Link>
      <div className="flex flex-col justify-center p-7 md:p-10 lg:p-12">
        <p className="font-script text-[26px] font-bold leading-none text-marigold-ink">{eyebrow}</p>
        <h2 className="mt-4 text-[28px] font-extrabold leading-tight text-ink md:text-[36px]">
          <Link href={routes.resource(r.slug)} className="transition-colors hover:text-forest">
            {r.title}
          </Link>
        </h2>
        <p className="mt-3 text-[14px] font-semibold text-body">
          <time dateTime={isoDay(r.publicationDate)}>{publishedLabel(r.publicationDate)}</time> · {RESOURCE_CATEGORY_LABEL[r.category]}
          {r.file ? ` · PDF ${fileSize(r.file.sizeBytes)}` : ""}
        </p>
        <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-body">{r.shortDescription}</p>
        {r.placeholder ? <p className="mt-3 text-[13px] italic text-body">This report is being prepared. You can ask for it now and we&rsquo;ll send it when it&rsquo;s ready.</p> : null}
        <div className="mt-7 flex flex-wrap gap-3">
          {isPublic && r.file ? (
            <Button href={routes.resourceDownload(r.slug)} variant="forest" icon="download">
              Download PDF
            </Button>
          ) : (
            <Button href={routes.requestReport(r.slug)} variant="forest" icon="arrow">
              <span className="inline-flex items-center gap-2">
                <Lock aria-hidden className="size-4" strokeWidth={2.5} /> Request Full Report
              </span>
            </Button>
          )}
          <Button href={routes.resource(r.slug)} variant="outline" icon="none">
            Read the Summary
          </Button>
        </div>
      </div>
    </article>
  );
}

function LibrarySkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-[140px] w-full rounded-card-lg" />
      <Skeleton className="mt-12 h-[360px] w-full rounded-card-lg" />
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[560px] w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}

export default async function ResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const page = await getPage("resources");
  const notListedCta = ctaOf(page, "notListed", { label: "Request a Report", href: routes.requestReport() });

  return (
    <>
      <StudioSlot id="pages.resources">
        <PageHero variant="editorial" eyebrow={page.hero.eyebrow ?? "Library"} title={page.hero.title} intro={page.hero.intro} crumbs={[{ label: "Resources" }]} next="paper" />
      </StudioSlot>

      <Section tone="paper" pad="md" cv={false} label="Resources library">
        <Suspense fallback={<LibrarySkeleton />}>
          <Library searchParams={searchParams} page={page} />
        </Suspense>
      </Section>

      <Section tone="cream" pad="md" last labelledBy="not-listed-title" cvSize={420}>
        <div className="mx-auto flex max-w-[980px] flex-col items-center gap-6 text-center">
          <h2 id="not-listed-title" className="font-display text-[38px] uppercase leading-[1.02] text-ink md:text-[52px]">
            {titleOf(page, "notListed", ["Looking for a Report", "That Isn't Listed?"]).join(" ")}
          </h2>
          <p className="max-w-[560px] text-[17px] leading-relaxed text-body">{textOf(page, "notListed", "Tell us what you need and our team will help.")}</p>
          <Button href={notListedCta.href} variant="forest" size="lg">
            {notListedCta.label}
          </Button>
        </div>
      </Section>
    </>
  );
}
