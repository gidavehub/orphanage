"use client";

import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { CauseCard } from "@/components/ui/cards/CauseCard";
import { DoodleField } from "@/components/art/Decor";
import type { HomeView } from "@/lib/content/types";
import { countryName } from "@/lib/countries";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { requestDonation } from "@/lib/donate-intent";
import { cn } from "@/lib/cn";
import { useStudioMode } from "@/lib/motion/useStudioMode";

type Props = {
  section: HomeView["appeals"]["section"];
  causes: HomeView["appeals"]["causes"];
  /** "Appeal figures are illustrative…" while any shown figure is unverified. */
  showNote: boolean;
};

/**
 * Donat "Transparent Donation Causes" carousel → Haven's faith-season and year-round appeals
 * (public-pages §4.10; content-model §4.8). Cards are the shared CauseCard in the approved landing
 * pairing; "Donate Now" preselects the cause and its currency in the donate card below.
 */
export function Appeals({ section, causes, showNote }: Props) {
  const groups = [{ id: "all", label: "All" }, ...section.groups];
  const [group, setGroup] = useState("all");
  const items = group === "all" ? causes : causes.filter((a) => a.groupId === group);
  const [viewport, api] = useEmblaCarousel({ loop: true, align: "start", duration: 32 });
  const reduce = useReducedMotion();
  const studio = useStudioMode();

  useEffect(() => {
    if (!api || reduce || studio || items.length < 2) return;
    let hovering = false;
    const node = api.rootNode();
    const enter = () => (hovering = true);
    const leave = () => (hovering = false);
    node.addEventListener("mouseenter", enter);
    node.addEventListener("mouseleave", leave);
    const id = setInterval(() => !hovering && api.scrollNext(), 4200);
    return () => {
      clearInterval(id);
      node.removeEventListener("mouseenter", enter);
      node.removeEventListener("mouseleave", leave);
    };
  }, [api, reduce, studio, items.length]);

  // Embla re-inits itself when the slides change; start each filter from its first card.
  useEffect(() => {
    api?.scrollTo(0, true);
  }, [api, group]);

  return (
    <section id="appeals" aria-labelledby="appeals-title" className="relative overflow-hidden bg-cream-2 pb-28 pt-24 md:pt-28 cv-auto">
      <DoodleField className="absolute -right-10 bottom-0 w-[620px] max-w-[70%]" />

      <div className="wrap relative">
        <Reveal className="text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <DonatHeading id="appeals-title" lines={section.titleLines} className="mt-4" />
          <p className="mx-auto mt-4 max-w-[600px] text-[16px] leading-[1.75] text-body">{section.intro}</p>
        </Reveal>

        <div role="group" aria-label="Filter appeals" className="mt-10 flex flex-wrap justify-center gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={g.id === group}
              onClick={() => setGroup(g.id)}
              className={cn(
                "h-10 rounded-full px-5 text-[14px] font-bold transition-colors duration-300",
                g.id === group ? "bg-clay text-white" : "bg-white text-ink shadow-[0_8px_20px_-16px_rgba(74,44,26,0.6)] hover:bg-sand",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <Reveal className="mt-8" y={50}>
          <div ref={viewport} className="-mx-3 overflow-hidden px-0 py-4">
            <div className="flex">
              {items.map((a) => (
                <div key={a.slug} className="min-w-0 shrink-0 grow-0 basis-full px-3 md:basis-1/2 xl:basis-1/3">
                  <CauseCard
                    contrast="landing"
                    title={a.title}
                    season={a.season}
                    {...(a.place ? { place: { code: a.place, name: countryName(a.place) } } : {})}
                    image={a.image}
                    raised={a.showFigures ? a.raised : null}
                    goal={a.goal}
                    currency={a.currency}
                    tone={a.tone}
                    href="#donate"
                    cta="Donate Now"
                    onCtaClick={() => requestDonation({ causeSlug: a.slug, currency: a.currency })}
                  />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        {showNote && section.placeholderNote ? <p className="mt-6 text-center text-[13px] text-body">{section.placeholderNote}</p> : null}
      </div>
    </section>
  );
}
