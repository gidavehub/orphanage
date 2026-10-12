import type { Metadata } from "next";
import { blocksToPlain } from "@/components/content/Blocks";
import { StudioSlot } from "@/components/content/StudioSlot";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { projectTiles } from "./_lib/data";
import { ProjectExplorer } from "@/components/public/projects/ProjectExplorer";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getPage, getProgrammes } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";

// /projects (public-pages §3.13, PLAN D50, D132): the photo hero, then every live project as a tile
// (status pill, country, programme, dates and, when it is raising money, its funding bar), filtered
// by programme and status in the browser so the page stays fully static. The closing band invites a
// gift or a hand.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("projects");
  return buildMetadata({
    title: page.seo.title ?? "Our Projects",
    description: page.seo.description ?? page.hero.intro ?? "Haven's practical work on the ground.",
    path: routes.projects(),
    noindex: page.seo.noindex === true,
  });
}

export default async function ProjectsPage() {
  const [page, tiles, programmes] = await Promise.all([getPage("projects"), projectTiles(), getProgrammes()]);
  const s = page.sections;
  const hero = page.hero.media && page.hero.media.type === "image" ? page.hero.media : null;
  const withProjects = new Set(tiles.map((t) => t.programmeId).filter(Boolean));
  const filterProgrammes = programmes.filter((p) => withProjects.has(p.id)).map((p) => ({ id: p.id as string, label: p.title }));
  const ongoing = tiles.filter((t) => t.status === "ongoing").length;

  return (
    <>
      <StudioSlot id="pages.projects">
        <PageHero
          variant="photo"
          eyebrow={page.hero.eyebrow ?? "On the Ground"}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Projects" }]}
          next="paper"
          {...(hero ? { media: { image: hero } } : {})}
        />
      </StudioSlot>

      <Section id="all-projects" tone="paper" pad="md" cv={false} labelledBy="projects-list-title" className="scroll-mt-24">
        <SectionIntro
          id="projects-list-title"
          eyebrow={s.list?.eyebrow ?? "Our Work"}
          title={s.list?.title ?? ["Practical Help,", "Where It's Needed"]}
          intro={
            blocksToPlain(s.list?.body ?? []) ||
            `${tiles.length === 1 ? "One project" : `${tiles.length} projects`} so far${ongoing ? `, ${ongoing} running right now` : ""}. Choose a programme or a status to narrow the list.`
          }
          className="mb-12"
        />
        <ProjectExplorer projects={tiles} programmes={filterProgrammes} emptyBody={blocksToPlain(s.empty?.body ?? []) || "New projects are added as they begin."} />
      </Section>

      <CtaBand
        id="projects-cta-title"
        title={s.cta?.title?.join(" ") ?? "Help Us Start the Next Project"}
        text={blocksToPlain(s.cta?.body ?? []) || "Every project begins with a family's need and a supporter's gift. Give, volunteer or partner with us."}
        actions={
          <>
            <Button href={routes.donate()} variant="vu-white" size="lg" icon="heart" iconFirst className="min-w-[200px]">
              Donate Now
            </Button>
            <Button href={routes.partner()} variant="outline-light" size="lg" icon="arrow" className="min-w-[200px]">
              Partner With Us
            </Button>
          </>
        }
      />
    </>
  );
}
