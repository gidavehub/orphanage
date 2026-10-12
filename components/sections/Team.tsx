"use client";

import { useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { PersonCard } from "@/components/ui/cards/PersonCard";
import { MoreLink } from "@/components/public/home/MoreLink";
import type { HomeView } from "@/lib/content/types";
import { routes } from "@/lib/routes";

type Props = { section: HomeView["team"]["section"]; team: HomeView["team"]["members"] };

/** Donat "Meet The Optimistic Volunteer" arch cards with the ＋ social fan-out (PersonCard). */
export function Team({ section, team }: Props) {
  const [viewport, api] = useEmblaCarousel({ loop: true, align: "start", duration: 30 });
  const prev = useCallback(() => api?.scrollPrev(), [api]);
  const next = useCallback(() => api?.scrollNext(), [api]);

  return (
    <section id="team" aria-labelledby="team-title" className="bg-white pb-28 pt-8 cv-auto">
      <div className="wrap">
        <Reveal className="text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <DonatHeading id="team-title" lines={section.lines} className="mt-4" />
          {section.intro ? <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-[1.75] text-body">{section.intro}</p> : null}
        </Reveal>

        <Reveal y={50} className="relative mt-14 md:px-20">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous team member"
            className="absolute left-0 top-[42%] z-10 hidden size-14 -translate-y-1/2 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-marigold md:grid"
          >
            <ArrowLeft strokeWidth={2.5} className="size-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next team member"
            className="absolute right-0 top-[42%] z-10 hidden size-14 -translate-y-1/2 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-marigold md:grid"
          >
            <ArrowRight strokeWidth={2.5} className="size-5" />
          </button>

          <div ref={viewport} className="overflow-hidden pt-4">
            <div className="-ml-6 flex">
              {team.map((m) => (
                <div key={m.id} className="min-w-0 shrink-0 grow-0 basis-[82%] pl-6 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                  <PersonCard name={m.name} role={m.role} image={m.image} socials={m.socials} />
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-10 flex justify-center">
          <MoreLink href={routes.about("team")}>Meet the Team</MoreLink>
        </div>
      </div>
    </section>
  );
}
