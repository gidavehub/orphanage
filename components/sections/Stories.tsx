"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { countryByCode } from "@/content/world";
import { Flag } from "@/components/art/Flag";
import { VuHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { StoryCard } from "@/components/ui/cards/StoryCard";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { cn } from "@/lib/cn";
import type { HomeView } from "@/lib/content/types";
import { useStudioMode } from "@/lib/motion/useStudioMode";

type Props = { section: HomeView["stories"]["section"]; stories: HomeView["stories"]["items"] };

/** Voices United "Here Our Stories": capsule portraits that expand into story cards. */
export function Stories({ section, stories }: Props) {
  const [tell, all] = section.ctas;
  // The fourth capsule opens first (today's composition), or the last one when there are fewer.
  const [active, setActive] = useState(() => Math.min(3, stories.length - 1));
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  const studio = useStudioMode();
  useEffect(() => {
    if (hover || reduce || studio) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % stories.length), 5200);
    return () => clearTimeout(id);
  }, [active, hover, reduce, studio, stories.length]);

  return (
    <section id="stories" aria-labelledby="stories-title" className="bg-vu-cream py-24 md:py-32 cv-auto">
      <div className="wrap">
        <Reveal className="text-center">
          <VuHeading id="stories-title" parts={section.title} className="text-ink" />
          <p className="mx-auto mt-5 max-w-[470px] font-grotesk text-[16px] leading-relaxed text-ink/75">{section.intro}</p>
        </Reveal>

        {/* Desktop capsule accordion */}
        <Reveal y={60} className="mt-14 hidden h-[460px] gap-2.5 md:flex" >
          {stories.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => {
                  setHover(true);
                  setActive(i);
                }}
                onMouseLeave={() => setHover(false)}
                onFocus={() => setActive(i)}
                aria-expanded={on}
                aria-label={`${s.label}, ${s.meta}, ${countryByCode(s.place)?.name ?? ""}`}
                aria-describedby={`story-${s.id}-text`}
                className={cn(
                  "group relative h-full min-w-0 overflow-hidden rounded-[70px] text-left transition-[flex-grow,border-radius] duration-700 ease-out-expo",
                  on ? "flex-[5.2] rounded-[40px]" : "flex-1",
                )}
              >
                <Image
                  src={s.image.src}
                  alt=""
                  fill
                  sizes="460px"
                  style={s.image.objectPosition ? { objectPosition: s.image.objectPosition } : undefined}
                  className={cn("object-cover transition-transform duration-[1.2s] ease-out-expo", on ? "scale-100" : "scale-[1.15]")}
                />
                <div className={cn("absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(6,21,18,0.85)_100%)] transition-opacity duration-700", on ? "opacity-100" : "opacity-0")} />
                {s.image.illustrative ? (
                  <ImageCredit
                    position="static"
                    className={cn("absolute left-7 top-7 transition-opacity duration-500", on ? "opacity-100 delay-200" : "opacity-0")}
                  />
                ) : null}
                <span
                  className={cn(
                    "absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-white/50 bg-white/10 text-white backdrop-blur transition-all duration-500",
                    on ? "scale-100 opacity-100" : "scale-50 opacity-0",
                  )}
                >
                  <ArrowUpRight className="size-5" />
                </span>
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 w-[440px] max-w-full p-7 text-white transition-all duration-700 ease-out-expo",
                    on ? "translate-y-0 opacity-100 delay-200" : "translate-y-6 opacity-0",
                  )}
                >
                  <p className="flex items-center gap-2 font-grotesk text-[14px] text-white/85">
                    <Flag code={s.place} className="size-6 ring-2 ring-white/70" />
                    {countryByCode(s.place)?.name}
                  </p>
                  <p className="mt-2 font-grotesk text-[24px] font-semibold">
                    {s.label} <span className="text-[16px] font-normal text-white/80">· {s.meta}</span>
                  </p>
                  <p id={`story-${s.id}-text`} className="mt-3 max-w-[360px] font-grotesk text-[17px] leading-relaxed text-white/90">
                    {s.text}
                  </p>
                </div>
              </button>
            );
          })}
        </Reveal>

        {/* Mobile: swipeable expanded cards. The cards hold no links, so the strip itself takes focus
            and scrolls with the arrow keys. */}
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="stories-title"
          className="focus-forest -mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:hidden"
        >
          {stories.map((s) => {
            const country = countryByCode(s.place);
            return (
              <StoryCard
                key={s.id}
                image={{ ...s.image, alt: "" }}
                label={s.label}
                meta={s.meta}
                place={country ? { code: country.code, name: country.name } : undefined}
                text={s.text}
                className="w-[78vw] shrink-0 snap-center"
              />
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Button href={tell.href} variant="vu" icon="none" size="lg" className="min-w-[200px]">
            {tell.label}
          </Button>
          <Button href={all.href} variant="vu-outline" icon="none" size="lg" className="min-w-[200px]">
            {all.label}
          </Button>
        </div>
      </div>
    </section>
  );
}
