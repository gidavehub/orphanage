import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ProjectCard } from "@/components/ui/cards/ProjectCard";
import { DoodleField } from "@/components/art/Decor";
import type { HomeView } from "@/lib/content/types";

type Props = { section: HomeView["projects"]["section"]; projects: HomeView["projects"]["items"] };

/** Donat "Our Recent Project": cream container, doodles, marigold brush label that paints in on hover. Each tile opens its project. */
export function Projects({ section, projects }: Props) {
  return (
    <section aria-labelledby="projects-title" className="bg-white py-20 md:py-28 cv-auto">
      <div className="wrap-wide">
        <div className="paper relative overflow-hidden rounded-[40px] px-5 py-16 md:rounded-[60px] md:px-10 md:py-20">
          <DoodleField className="absolute -right-8 -top-20 w-[560px] max-w-[60%] rotate-180 opacity-80" />

          <div className="wrap relative !px-0">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow lines="right">{section.eyebrow}</Eyebrow>
                <DonatHeading id="projects-title" lines={section.lines} className="mt-3" />
              </div>
              <Button href={section.cta.href} variant="forest" size="md" icon="none">
                {section.cta.label}
              </Button>
            </Reveal>

            <Reveal stagger={0.12} className="mt-12 grid gap-6 md:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  title={p.title}
                  subtitle={p.subtitle}
                  image={p.image}
                  href={p.href}
                  sizes="(min-width:768px) 33vw, 100vw"
                  contrast="landing"
                />
              ))}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
