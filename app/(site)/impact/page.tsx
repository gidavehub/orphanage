import type { Metadata } from "next";
import Link from "next/link";
import { blocksToPlain } from "@/components/content/Blocks";
import { StudioSlot } from "@/components/content/StudioSlot";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { ImpactNumbers, pickImpactStats } from "@/components/public/impact/ImpactNumbers";
import { ImpactAppeals, ImpactReports } from "@/components/public/impact/ImpactSections";
import { allocationCurrencies, MoneyWent } from "@/components/public/impact/MoneyWent";
import { Projects } from "@/components/sections/Projects";
import { Stories } from "@/components/sections/Stories";
import { Testimonials } from "@/components/sections/Testimonials";
import { WorldFlags } from "@/components/sections/WorldFlags";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getAllocationSummary, getAppealCards, getHomeContent, getPage, getProjects, getResource, getResources, getStats, getStories } from "@/lib/content/public";
import type { CtaView, PageView } from "@/lib/content/types";
import { isRouteKey, routeHref, routes, type RouteKey } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";

// /impact (public-pages §3.12, PLAN D45–D46, D57): the editorial hero (the page's one Voices United
// chapter), the ToR §3 figures as a bento (Illustrative chips and footnote while unverified; gone
// after the launch switch; an empty state below three figures), "Where the money went" from the
// annual allocation summary with its report link, where we work, the latest projects, featured
// stories, the appeals (each "Donate Now" opens /donate/<slug>), reports, donor-first testimonials
// and the closing band. Every read is cached, so the page is fully static.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("impact");
  return buildMetadata({
    title: page.seo.title ?? "Our Impact",
    description: page.seo.description ?? page.hero.intro ?? "How Haven's work changes things for children and families.",
    path: routes.impact(),
    noindex: page.seo.noindex === true,
  });
}

/** A section's CTA from the page doc, or the given default. */
function ctaOf(page: PageView, key: string, fallback: { label: string; to: RouteKey }): CtaView {
  const c = page.sections[key]?.cta;
  if (c && isRouteKey(c.to)) return { label: c.label, href: routeHref(c.to), to: c.to };
  return { label: fallback.label, href: routeHref(fallback.to), to: fallback.to };
}

export default async function ImpactPage() {
  const [page, home, stats, summary, projects, featured, allStories, appeals, annual, research] = await Promise.all([
    getPage("impact"),
    getHomeContent(),
    getStats(),
    getAllocationSummary(),
    getProjects(),
    getStories({ featured: true }),
    getStories(),
    getAppealCards(),
    getResources({ category: "annual_reports" }),
    getResources({ category: "research" }),
  ]);
  const s = page.sections;

  const picked = pickImpactStats(stats);
  const reportSlug = summary?.reportResourceSlug;
  const report = reportSlug ? await getResource(reportSlug) : null;
  const showMoney = !!summary && summary.showFigures && allocationCurrencies(summary).length > 0;

  const storyItems = featured.length >= 3 ? featured : allStories.slice(0, 9);
  const reports = [...annual.items, ...research.items].slice(0, 3);
  const testimonials = [...home.testimonials.items].sort((a, b) => Number(b.kind === "donor") - Number(a.kind === "donor"));

  const projectsCta = ctaOf(page, "projects", { label: "View All Projects", to: "projects" });
  const storiesCta = ctaOf(page, "stories", { label: "See All Stories", to: "stories" });
  const reportsCta = ctaOf(page, "reports", { label: "All Reports", to: "resources" });
  const reportsHref = reportsCta.to === "resources" ? routes.resources({ category: "annual_reports" }) : reportsCta.href;

  return (
    <>
      <StudioSlot id="pages.impact">
        <PageHero
          variant="editorial"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Our Impact" }]}
          actions={
            <>
              <Button href={routes.donate()} variant="flame-ink" icon="heart" iconFirst>
                Donate Now
              </Button>
              {showMoney ? (
                <Link
                  href="#where-the-money-went"
                  className="inline-flex min-h-11 items-center gap-2 font-grotesk text-[14px] font-semibold uppercase tracking-[0.06em] text-ink underline decoration-coral-800 decoration-2 underline-offset-[6px] hover:text-coral-800"
                >
                  Where the money went
                </Link>
              ) : null}
            </>
          }
        />
      </StudioSlot>

      <Section id="the-numbers" tone="vu-cream" pad="none" cv={false} labelledBy="numbers-title" className="pb-20 md:pb-28">
        <div className="rounded-[40px] bg-white px-5 py-12 shadow-card md:rounded-[60px] md:px-10 md:py-16">
          <SectionIntro
            id="numbers-title"
            eyebrow={s.numbers?.eyebrow ?? "Our Impact"}
            title={s.numbers?.title ?? ["The Numbers"]}
            intro="Children, families and communities reached through education, health, counselling and protection."
          />
          <ImpactNumbers
            picked={picked}
            footnote={blocksToPlain(s.numbers?.body ?? []) || "Figures marked illustrative are placeholders pending verification by our finance team."}
            emptyText={blocksToPlain(s.numbersEmpty?.body ?? []) || "We're verifying our latest figures. Check back soon."}
          />
        </div>
      </Section>

      {showMoney && summary ? (
        <Section id="where-the-money-went" tone="white" pad="md" labelledBy="money-title" className="scroll-mt-24">
          <SectionIntro
            id="money-title"
            eyebrow={s.whereMoneyWent?.eyebrow ?? "Transparency"}
            title={s.whereMoneyWent?.title ?? ["Where the Money Went"]}
            intro={
              blocksToPlain(s.whereMoneyWent?.body ?? []) ||
              "Every gift, accounted for. Here is how last year's donations were put to work, programme by programme, in each currency we receive."
            }
          />
          <MoneyWent summary={summary} reportHref={report ? routes.resource(report.slug) : null} />
        </Section>
      ) : null}

      <WorldFlags world={home.world} />

      {projects.length ? (
        <Projects
          section={{ eyebrow: s.projects?.eyebrow ?? "On the Ground", lines: s.projects?.title ?? ["Our Recent Projects"], cta: projectsCta }}
          projects={projects.slice(0, 3)}
        />
      ) : null}

      {storyItems.length >= 3 ? (
        <Stories
          section={{
            title: s.stories?.title ?? ["Stories of", "Hope"],
            intro: blocksToPlain(s.stories?.body ?? []) || home.stories.section.intro,
            ctas: [{ label: "Tell Your Story", href: routes.shareStory(), to: "tellStory" }, storiesCta],
          }}
          stories={storyItems}
        />
      ) : null}

      <ImpactAppeals
        causes={appeals}
        eyebrow={s.appeals?.eyebrow ?? home.appeals.section.eyebrow}
        title={s.appeals?.title ?? home.appeals.section.titleLines}
        intro={blocksToPlain(s.appeals?.body ?? []) || home.appeals.section.intro}
        note={home.appeals.showNote ? home.appeals.section.placeholderNote : null}
      />

      <ImpactReports reports={reports} eyebrow={s.reports?.eyebrow ?? "Reports"} title={s.reports?.title ?? ["Annual and Programme Reports"]} cta={{ label: reportsCta.label, href: reportsHref }} />

      {testimonials.length ? <Testimonials section={home.testimonials.section} testimonials={testimonials} /> : null}

      <CtaBand
        id="impact-cta-title"
        actions={
          <>
            <Button href={routes.donate()} variant="vu-white" size="lg" icon="heart" iconFirst className="min-w-[200px]">
              Donate Now
            </Button>
            <Button href={routes.involved()} variant="outline-light" size="lg" icon="arrow" className="min-w-[200px]">
              Get Involved
            </Button>
          </>
        }
      />
    </>
  );
}
