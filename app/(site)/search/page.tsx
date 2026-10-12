import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, HandHeart, HeartHandshake, LifeBuoy, ShieldAlert } from "lucide-react";
import { blocksToPlain } from "@/components/content/Blocks";
import { PageHero } from "@/components/layout/PageHero";
import { Highlight, SearchHitIcon } from "@/components/layout/SearchOverlay";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconDisc } from "@/components/ui/IconDisc";
import { SearchField } from "@/components/ui/SearchField";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPage, searchSite, type PageView, type SearchHit } from "@/lib/content/public";
import { groupHits } from "@/lib/content/search";
import { isRouteKey, programmeIdOfSlug, routeHref, routes } from "@/lib/routes";
import { SEARCH_SUGGESTIONS, SEARCH_TYPE_LABEL, SEARCH_TYPE_SINGULAR } from "@/lib/nav";
import { cn } from "@/lib/cn";

// /search?q= (public-pages §3.22, PLAN D115): server-rendered results from searchSite(q, 50), grouped
// by type. noindex. An empty query shows popular links; no results shows "Nothing found for '{q}'."
// with the same chips and Contact Us. The query lives only in the URL the visitor typed; it is never
// logged or stored.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("search");
  return {
    title: page.seo.title || "Search",
    description: page.seo.description || page.hero.intro,
    robots: { index: false, follow: true },
    alternates: { canonical: routes.search() },
  };
}

async function readQuery(searchParams: SearchParams): Promise<string> {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? (sp.q[0] ?? "") : (sp.q ?? "");
  return raw.replace(/\s+/g, " ").trim().slice(0, 120);
}

/** The chips: labels from pages.search (editable), destinations from code (lib/nav). */
function suggestionsOf(page: PageView) {
  const labels = page.sections.suggestions?.items ?? [];
  return SEARCH_SUGGESTIONS.map((s, i) => ({ href: s.href, label: labels[i]?.title || s.label }));
}

function Chips({ chips, label }: { chips: Array<{ href: string; label: string }>; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap justify-center gap-2.5">
      {chips.map((c) => (
        <li key={c.href}>
          <Link
            href={c.href}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-5 text-[15px] font-bold text-ink shadow-chip transition-[background-color,border-color,color,transform] duration-300 hover:-translate-y-0.5 hover:border-forest hover:bg-forest hover:text-white"
          >
            {c.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SearchBox({ q }: { q?: string }) {
  return (
    <div className="w-full max-w-[680px]">
      <SearchField
        key={q ?? ""}
        label="Search the Haven website"
        placeholder="Try “school fees”, “counselling” or “volunteer”"
        defaultValue={q ?? ""}
        action={routes.search()}
        size="lg"
      />
    </div>
  );
}

async function SearchBoxWithQuery({ searchParams }: { searchParams: SearchParams }) {
  const q = await readQuery(searchParams);
  return <SearchBox q={q} />;
}

const DOORS = [
  { title: "Request support", text: "Tell us what a child or family needs. It is free and confidential.", href: routes.request(), icon: LifeBuoy },
  { title: "Report a concern", text: "Worried about a child's safety? Tell our safeguarding team.", href: routes.concern(), icon: ShieldAlert, urgent: true },
  { title: "Our programmes", text: "Protection, education, health, counselling, legal and family support.", href: routes.programmes(), icon: HeartHandshake },
  { title: "Give to a cause", text: "Choose a cause and see exactly where your gift goes.", href: routes.donate(), icon: HandHeart },
] as const;

function Doors() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {DOORS.map((d) => (
        <li key={d.href}>
          <Link
            href={d.href}
            className="group flex h-full flex-col rounded-card border border-line bg-white p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-card-hover"
          >
            <IconDisc icon={<d.icon aria-hidden strokeWidth={2.25} className="size-6" />} tone={"urgent" in d ? "urgent" : "white"} halo={"urgent" in d ? "none" : "marigold"} />
            <span className={cn("mt-5 text-[18px] font-extrabold leading-snug transition-colors", "urgent" in d ? "text-coral-800" : "text-ink group-hover:text-forest")}>
              {d.title}
            </span>
            <span className="mt-1.5 text-[15px] leading-relaxed text-body">{d.text}</span>
            <ArrowUpRight aria-hidden strokeWidth={2.5} className="mt-auto size-5 self-end pt-0 text-marigold-ink transition-transform duration-300 group-hover:rotate-45" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ hit, q }: { hit: SearchHit; q: string }) {
  const programme = hit.type === "programme" ? programmeIdOfSlug(hit.href.split("/").pop() ?? "") : undefined;
  return (
    <Link
      href={hit.href}
      className="group flex items-start gap-4 rounded-card border border-line bg-white p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-transparent hover:shadow-card-hover md:gap-5 md:p-6"
    >
      <IconDisc icon={programme ?? <SearchHitIcon type={hit.type} className="size-[22px]" />} size={52} className="hidden sm:grid" />
      <span className="min-w-0 flex-1">
        <span className="block font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-marigold-ink">{SEARCH_TYPE_SINGULAR[hit.type]}</span>
        <span className="mt-1 block text-[19px] font-extrabold leading-snug text-ink transition-colors group-hover:text-forest">
          <Highlight text={hit.title} q={q} markClassName="rounded-[3px] bg-marigold-100 text-inherit" />
        </span>
        {hit.snippet ? (
          <span className="mt-1.5 line-clamp-3 block text-[15px] leading-relaxed text-body">
            <Highlight text={hit.snippet} q={q} markClassName="rounded-[3px] bg-marigold-100 text-ink" />
          </span>
        ) : null}
        <span className="mt-2.5 block truncate font-grotesk text-[13px] text-body">{hit.href.split(/[?#]/, 1)[0]}</span>
      </span>
      <ArrowUpRight aria-hidden strokeWidth={2.5} className="mt-1 size-5 shrink-0 text-marigold-ink transition-transform duration-300 group-hover:rotate-45" />
    </Link>
  );
}

async function Results({ searchParams, page }: { searchParams: SearchParams; page: PageView }) {
  const q = await readQuery(searchParams);
  const chips = suggestionsOf(page);
  const popular = page.sections.suggestions?.eyebrow || "Popular";

  if (q.length < 2) {
    return (
      <Section tone="white" pad="md" last cv={false} labelledBy="search-start-title">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="font-script text-[28px] font-bold leading-none text-marigold-ink">{popular}</p>
          <h2 id="search-start-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[34px]">
            {q ? "Type a little more to search" : "Where would you like to start?"}
          </h2>
          <div className="mt-8">
            <Chips chips={chips} label="Popular searches" />
          </div>
        </div>
        <div className="mt-14">
          <Doors />
        </div>
      </Section>
    );
  }

  const hits = await searchSite(q, 50);

  if (!hits.length) {
    const empty = page.sections.empty;
    const body = blocksToPlain(empty?.body ?? []);
    const cta = empty?.cta && isRouteKey(empty.cta.to) ? { label: empty.cta.label, href: routeHref(empty.cta.to) } : { label: "Contact Us", href: routes.contact() };
    return (
      <Section tone="white" pad="md" last cv={false} label="Search results">
        <div className="mx-auto max-w-[760px]">
          <EmptyState
            art="plane"
            headingLevel={2}
            title={`Nothing found for “${q}”.`}
            note="Let's find it together"
            body={body || "Try another word or a shorter phrase, or contact us and we'll help you find it."}
            action={
              <Button href={cta.href} variant="forest" icon="arrow">
                {cta.label}
              </Button>
            }
            className="pb-10 pt-4"
          />
          <p className="text-center font-grotesk text-[13px] font-semibold uppercase tracking-[0.12em] text-body">{popular}</p>
          <div className="mt-4">
            <Chips chips={chips} label="Popular searches" />
          </div>
        </div>
      </Section>
    );
  }

  const groups = groupHits(hits);
  return (
    <Section tone="white" pad="md" last cv={false} labelledBy="search-results-title">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <h2 id="search-results-title" className="text-[22px] font-extrabold leading-snug text-ink">
            {hits.length === 50 ? "50+" : hits.length} {hits.length === 1 ? "result" : "results"}
            <span className="block text-[16px] font-semibold text-body">for “{q}”</span>
          </h2>
          <nav aria-label="Result groups" className="mt-5">
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0">
              {groups.map((g) => (
                <li key={g.type} className="shrink-0">
                  <a
                    href={`#results-${g.type}`}
                    className="group flex min-h-11 items-center justify-between gap-3 rounded-full border border-line bg-white px-4 text-[15px] font-bold text-ink transition-colors hover:border-forest hover:text-forest lg:rounded-xl lg:border-transparent lg:hover:bg-cream"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <SearchHitIcon type={g.type} className="size-4 text-forest" />
                      {SEARCH_TYPE_LABEL[g.type]}
                    </span>
                    <span className="grid min-w-7 place-items-center rounded-full bg-mint px-2 py-0.5 text-[13px] font-bold text-forest">{g.hits.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8 hidden rounded-card bg-cream p-6 lg:block">
            <p className="font-script text-[24px] font-bold leading-none text-marigold-ink">Can&apos;t find it?</p>
            <p className="mt-2 text-[15px] leading-relaxed text-body">Ask us. A real person reads every message.</p>
            <Button href={routes.contact()} variant="outline" size="sm" icon="arrow" className="mt-4">
              Contact Us
            </Button>
          </div>
        </aside>

        <div className="grid gap-12">
          {groups.map((g) => (
            <section key={g.type} id={`results-${g.type}`} aria-labelledby={`results-${g.type}-title`} className="scroll-mt-32">
              <h2 id={`results-${g.type}-title`} className="flex items-center gap-3 text-[24px] font-extrabold text-ink">
                {SEARCH_TYPE_LABEL[g.type]}
                <span className="text-[16px] font-semibold text-body">({g.hits.length})</span>
              </h2>
              <span aria-hidden className="mt-2 block h-[2px] w-12 bg-marigold" />
              <ul className="mt-6 grid gap-3.5">
                {g.hits.map((h) => (
                  <li key={`${h.href}|${h.title}`}>
                    <ResultCard hit={h} q={q} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="rounded-card bg-cream p-6 lg:hidden">
            <p className="font-script text-[24px] font-bold leading-none text-marigold-ink">Can&apos;t find it?</p>
            <p className="mt-2 text-[15px] leading-relaxed text-body">Ask us. A real person reads every message.</p>
            <Button href={routes.contact()} variant="outline" size="sm" icon="arrow" className="mt-4">
              Contact Us
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ResultsSkeleton() {
  return (
    <Section tone="white" pad="md" last cv={false} label="Loading results">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
        <div className="grid content-start gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="grid gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px] w-full rounded-card" />
          ))}
        </div>
      </div>
    </Section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const page = await getPage("search");
  return (
    <>
      <PageHero
        variant="plain"
        eyebrow={page.hero.eyebrow}
        title={page.hero.title}
        intro={page.hero.intro}
        crumbs={[{ label: page.hero.title.join(" ") }]}
        art="hands"
        actions={
          <Suspense fallback={<SearchBox />}>
            <SearchBoxWithQuery searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} page={page} />
      </Suspense>
    </>
  );
}
