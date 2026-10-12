import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Blocks } from "@/components/content/Blocks";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { RelatedPosts } from "@/components/public/news/ArticleParts";
import { fundingOf, postsAboutProgramme, projectTile, projectTiles, tileImage } from "../_lib/data";
import { ProjectFacts, ProjectFundingBlock, ProjectOutcomes } from "@/components/public/projects/ProjectDetail";
import { ProjectGallery } from "@/components/public/projects/ProjectGallery";
import { ProjectTile } from "@/components/public/projects/ProjectTile";
import { JsonLd } from "@/components/seo/JsonLd";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ShareRow } from "@/components/ui/ShareRow";
import { getCause, getProgrammes, getProject, getProjects, getStats } from "@/lib/content/public";
import type { UiImage } from "@/lib/model/ui";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { cn } from "@/lib/cn";
import { absolute } from "@/lib/server/url";

// /projects/[slug] (public-pages §3.13, PLAN D44, D50, D132): the photo hero with its place chip, the
// facts bar (programme link, country, dates, status), the story as Block[] in the reading column,
// verified outcomes only, the gallery with its lightbox, "Support This Project" when the project is
// linked to a cause, news from the same programme, the other projects and the closing band.
//
// `instant = false` (route segment config, not a D5-forbidden export): params are read at the top so
// an unknown slug answers a real HTTP 404 instead of a streamed 200 (the pattern of /donate/[cause]
// and /policies/[slug]). Every live project is prerendered.
export const instant = false;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(decodeURIComponent(slug));
  if (!project) return { title: "Project not found" };
  const image = project.image.type === "image" ? project.image.src : undefined;
  return buildMetadata({
    title: project.seo.title ?? project.title,
    description: project.seo.description ?? project.summary ?? `${project.title}: ${project.subtitle}. A Haven project.`,
    path: project.href,
    ...(image ? { image } : {}),
    noindex: project.seo.noindex === true,
  });
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = await getProject(decodeURIComponent(slug));
  if (!project) notFound();

  const [tile, programmes, stats, cause, others, news] = await Promise.all([
    projectTile(project),
    getProgrammes(),
    getStats(),
    project.causeSlug ? getCause(project.causeSlug) : Promise.resolve(null),
    projectTiles({ exclude: project.slug }),
    postsAboutProgramme(project.programmeId ?? null),
  ]);

  const programme = project.programmeId ? programmes.find((p) => p.id === project.programmeId) : undefined;
  const funding = fundingOf(cause);
  const hero = project.image.type === "image" ? project.image : null;
  const gallery: UiImage[] = project.gallery.flatMap((m) => (m.type === "image" ? [tileImage(m)] : []));
  const hasBody = project.body.length > 0;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Project",
          name: project.title,
          description: project.summary ?? project.subtitle,
          url: absolute(project.href),
          ...(hero ? { image: absolute(hero.src) } : {}),
          ...(project.startedAt ? { foundingDate: new Date(project.startedAt).toISOString().slice(0, 10) } : {}),
          ...(project.place ? { areaServed: { "@type": "Country", name: tile.place?.name } } : {}),
          parentOrganization: { "@type": "NGO", name: "Haven", url: absolute("/") },
        }}
      />

      <PageHero
        variant="photo"
        eyebrow={tile.programmeLabel ?? project.subtitle}
        title={project.title}
        intro={project.summary ?? project.subtitle}
        crumbs={[{ label: "Projects", href: routes.projects() }, { label: project.title }]}
        next="white"
        {...(hero ? { media: { image: hero } } : {})}
        {...(tile.place
          ? {
              actions: (
                <Badge tone="glass" flag={tile.place.code}>
                  {tile.place.name}
                </Badge>
              ),
            }
          : {})}
      />

      <div className="bg-white pb-20 md:pb-28">
        <ProjectFacts project={tile} programmeHref={programme ? programme.href : null} />

        <div className="wrap mt-14 md:mt-20">
          <article aria-label="The story of this project" className="mx-auto max-w-[760px]">
            <p className="font-script text-[28px] font-bold leading-none text-marigold-ink">The story</p>
            {hasBody ? <Blocks blocks={project.body} stats={stats} size="lg" measure={false} className="mt-5" /> : null}
            <ProjectOutcomes outcomes={project.outcomes} />
            <ShareRow url={project.href} title={project.title} text={project.summary ?? project.subtitle} label="Share this project" className="mt-12 border-t border-line pt-8" />
          </article>

          {gallery.length ? (
            <section aria-labelledby="gallery-title" className="mx-auto mt-16 max-w-[1120px] md:mt-20">
              <h2 id="gallery-title" className="text-center text-[28px] font-extrabold text-ink md:text-[34px]">
                In Pictures
              </h2>
              <span aria-hidden className="mx-auto mt-3 block h-[3px] w-14 rounded-full bg-marigold" />
              <div className="mt-10">
                <ProjectGallery images={gallery} title={project.title} />
              </div>
            </section>
          ) : null}

          <div className="mx-auto mt-16 max-w-[1120px] md:mt-20">
            {funding ? (
              <ProjectFundingBlock funding={funding} title={project.title} />
            ) : (
              <section aria-labelledby="give-title" className="flex flex-col items-start gap-6 rounded-card-lg bg-cream px-6 py-9 md:flex-row md:items-center md:justify-between md:px-12 md:py-10">
                <div className="max-w-[620px]">
                  <p className="font-script text-[26px] font-bold leading-none text-marigold-ink">Make the next one possible</p>
                  <h2 id="give-title" className="mt-3 text-[24px] font-extrabold leading-tight text-ink md:text-[30px]">
                    {programme ? `Give to ${programme.title}` : "Give Where It's Needed Most"}
                  </h2>
                  <p className="mt-3 text-[16px] leading-relaxed text-body">Projects like this one start with a family&apos;s need and a supporter&apos;s gift.</p>
                </div>
                <Button href={programme ? programme.donateHref : routes.donate()} variant="forest" size="lg" icon="heart" iconFirst className="shrink-0">
                  Donate Now
                </Button>
              </section>
            )}
          </div>
        </div>
      </div>

      {news.length ? (
        <section aria-label="Related news" className="paper py-20 md:py-28">
          <div className="wrap">
            <RelatedPosts posts={news} title={programme ? `News from ${programme.title}` : "Latest News"} />
          </div>
        </section>
      ) : null}

      {others.length ? (
        <section aria-labelledby="more-projects-title" className="bg-white py-20 md:py-28">
          <div className="wrap">
            <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-5 text-center">
              <h2 id="more-projects-title" className="text-[30px] font-extrabold leading-tight text-ink md:text-[38px]">
                More Projects
              </h2>
              <span aria-hidden className="block h-[3px] w-14 rounded-full bg-marigold" />
            </div>
            <Reveal as="ul" stagger={0.1} className={cn("mx-auto mt-10 grid gap-7 md:grid-cols-2", others.length >= 3 ? "lg:grid-cols-3" : others.length === 2 ? "max-w-[860px]" : "max-w-[420px] md:grid-cols-1")}>
              {others.slice(0, 3).map((p) => (
                <li key={p.id} className="grid">
                  <ProjectTile project={p} />
                </li>
              ))}
            </Reveal>
            <p className="mt-12 text-center">
              <Button href={routes.projects()} variant="forest" icon="arrow">
                View All Projects
              </Button>
            </p>
          </div>
        </section>
      ) : null}

      <CtaBand
        id="project-cta-title"
        actions={
          <>
            <Button href={funding && !funding.closed ? funding.href : routes.donate()} variant="vu-white" size="lg" icon="heart" iconFirst className="min-w-[200px]">
              Donate Now
            </Button>
            <Button href={routes.volunteer()} variant="outline-light" size="lg" icon="arrow" className="min-w-[200px]">
              Volunteer
            </Button>
          </>
        }
      />
    </>
  );
}
