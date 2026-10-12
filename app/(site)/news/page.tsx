import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Rss } from "lucide-react";
import { HeartCluster } from "@/components/art/Decor";
import { blocksToPlain } from "@/components/content/Blocks";
import { StudioSlot } from "@/components/content/StudioSlot";
import { PageHero } from "@/components/layout/PageHero";
import { FeaturedPost, PostTile } from "@/components/public/news/PostTiles";
import { JoinSphere } from "@/components/sections/JoinSphere";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chips } from "@/components/ui/form/Chips";
import { Pagination } from "@/components/ui/Pagination";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { getHomeContent, getPage, getPosts, type PageView } from "@/lib/content/public";
import { POST_CATEGORIES, POST_CATEGORY_LABEL, type PostCategory } from "@/lib/content/schema";
import { isRouteKey, routeHref, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";

// /news (public-pages §3.15, PLAN D42–D43, D124): the editorial hero, then the newest post as a wide
// card, category pills (?category=), a 9-per-page grid (?page=) where quick updates use the compact
// UpdateCard, numbered pagination with rel prev/next, an RSS link, and the newsletter sphere as the
// closing band. The query lives in a Suspense leaf; the hero and newsletter are the static shell.
// Filtered and paged views are canonical to /news.

const PAGE_SIZE = 9;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("news");
  const meta = buildMetadata({
    title: page.seo.title ?? "News & Updates",
    description: page.seo.description ?? page.hero.intro ?? "News and updates from Haven.",
    path: routes.news(),
    noindex: page.seo.noindex === true,
  });
  return { ...meta, alternates: { ...meta.alternates, types: { "application/rss+xml": [{ url: routes.rss(), title: "Haven: News & Updates" }] } } };
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function isCategory(v: string): v is PostCategory {
  return (POST_CATEGORIES as readonly string[]).includes(v);
}

async function Listing({ searchParams, page }: { searchParams: SearchParams; page: PageView }) {
  const sp = await searchParams;
  const rawCategory = first(sp.category).trim().toLowerCase();
  const category = isCategory(rawCategory) ? rawCategory : undefined;
  const pageNo = Math.max(1, Math.min(500, Math.trunc(Number(first(sp.page)) || 1)));

  // Category counts (cached reads over one cached collection): only categories with posts get a pill.
  const [counts, all, listed] = await Promise.all([
    Promise.all(POST_CATEGORIES.map(async (c) => [c, (await getPosts({ category: c, pageSize: 1 })).total] as const)),
    getPosts({ page: 1, pageSize: 1 }),
    getPosts({ category, page: pageNo, pageSize: PAGE_SIZE }),
  ]);
  const withPosts = counts.filter(([, n]) => n > 0);
  const total = listed.total;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Nine posts a page (D124). On the unfiltered first page the newest one leads as the wide card.
  const featuredMode = !category && pageNo === 1 && listed.items.length > 1;
  const featured = featuredMode ? listed.items[0] : undefined;
  const grid = featuredMode ? listed.items.slice(1) : listed.items;
  // Fill a short last row on the first page with the "never miss an update" tile.
  const promo = pageNo === 1 && grid.length > 0 && grid.length % 3 !== 0;

  const options = [
    { value: "all", label: "All news", count: all.total, href: routes.news() },
    ...withPosts.map(([c, n]) => ({ value: c, label: POST_CATEGORY_LABEL[c], count: n, href: routes.news({ category: c }) })),
  ];
  const empty = page.sections.empty;
  const emptyCta = empty?.cta && isRouteKey(empty.cta.to) ? { label: empty.cta.label, href: routeHref(empty.cta.to) } : { label: "All News", href: routes.news() };
  const label = category ? POST_CATEGORY_LABEL[category] : null;

  return (
    <>
      {featured ? (
        <Reveal y={30}>
          <FeaturedPost post={featured} eyebrow="Latest" />
        </Reveal>
      ) : null}

      <div className={featured ? "mt-16 md:mt-20" : undefined}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <h2 id="news-list-title" className="text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">
            {label ? `${label}` : featured ? "More News & Updates" : "All News & Updates"}
            {pageCount > 1 ? <span className="ml-2 text-[16px] font-semibold text-body">· Page {Math.min(pageNo, pageCount)} of {pageCount}</span> : null}
          </h2>
          <a
            href={routes.rss()}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-line px-4 text-[14px] font-bold text-ink transition-colors hover:border-forest hover:text-forest md:self-auto"
          >
            <Rss aria-hidden className="size-4 text-marigold-ink" strokeWidth={2.5} />
            RSS feed
          </a>
        </div>
        {options.length > 2 ? <Chips options={options} value={category ?? "all"} label="Filter news by topic" tone="clay" scroll className="mt-6" /> : null}

        {grid.length ? (
          <ul aria-labelledby="news-list-title" className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {grid.map((p) => (
              <li key={p.id} className="grid">
                <PostTile post={p} />
              </li>
            ))}
            {promo ? (
              <li className="grid">
                <NewsletterTile />
              </li>
            ) : null}
          </ul>
        ) : (
          <EmptyState
            art="plane"
            title={label ? `No ${label.toLowerCase()} posts yet.` : pageNo > 1 ? "There are no more posts." : "No posts yet."}
            body={blocksToPlain(empty?.body ?? []) || "New updates are published every month."}
            action={
              <Button href={emptyCta.href} variant="forest" icon="arrow">
                {emptyCta.label}
              </Button>
            }
            className="mt-10"
          />
        )}

        <Pagination
          page={pageNo}
          pageCount={pageCount}
          hrefFor={(n) => routes.news({ category, page: n })}
          label="News pages"
          className="mt-14"
        />
      </div>
    </>
  );
}

/** Fills a short last row: the monthly email and the RSS feed. */
function NewsletterTile() {
  return (
    <div className="paper relative flex flex-col justify-between overflow-hidden rounded-3xl p-8 md:min-h-[420px]">
      <HeartCluster className="pointer-events-none absolute -right-6 -top-4 w-[150px] text-mist opacity-70" />
      <div className="relative">
        <p className="font-script text-[28px] font-bold leading-none text-marigold-ink">Never miss a story</p>
        <h3 className="mt-3 text-[24px] font-extrabold leading-tight text-ink">One honest update a month, straight to your inbox.</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-body">What changed, where the money went and the families behind it. Unsubscribe in one click.</p>
      </div>
      <div className="relative mt-8 flex flex-wrap gap-3">
        <Button href="#newsletter" variant="forest" size="sm" icon="arrow">
          Get the Updates
        </Button>
        <a
          href={routes.rss()}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/80 px-5 text-[14px] font-bold text-ink transition-colors hover:border-forest hover:bg-forest hover:text-white"
        >
          <Rss aria-hidden className="size-4" strokeWidth={2.5} />
          RSS
        </a>
      </div>
    </div>
  );
}

function ListingSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-[400px] w-full rounded-card-lg" />
      <div className="mt-16 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[460px] w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const [page, home] = await Promise.all([getPage("news"), getHomeContent()]);
  const newsletterTitle = page.sections.newsletter?.title;
  const join = newsletterTitle && newsletterTitle.length === 3 ? { ...home.join, title: [newsletterTitle[0], newsletterTitle[1], newsletterTitle[2]] as [string, string, string] } : home.join;

  return (
    <>
      <StudioSlot id="pages.news">
        <PageHero
          variant="editorial"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "News" }]}
          actions={
            <Link
              href="#news-list"
              className="inline-flex min-h-11 items-center gap-2 font-grotesk text-[14px] font-semibold uppercase tracking-[0.06em] text-ink underline decoration-coral-800 decoration-2 underline-offset-[6px] hover:text-coral-800"
            >
              Browse every update
            </Link>
          }
        />
      </StudioSlot>

      <Section id="news-list" tone="white" pad="md" cv={false} label="News and updates" className="scroll-mt-24">
        <Suspense fallback={<ListingSkeleton />}>
          <Listing searchParams={searchParams} page={page} />
        </Suspense>
      </Section>

      <div id="newsletter" className="scroll-mt-20 bg-coral pb-[max(4rem,8vw)]">
        <JoinSphere join={join} />
      </div>
    </>
  );
}
