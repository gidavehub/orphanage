"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Brush } from "@/components/art/Brush";
import { HandDoodle } from "@/components/art/Hands";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { cn } from "@/lib/cn";
import type { HomeView } from "@/lib/content/types";

type Props = { section: HomeView["testimonials"]["section"]; testimonials: HomeView["testimonials"]["items"] };

/** Donat testimonials: brush splash, round-bottomed portrait, cream quote card, 02 —— 04 progress. */
export function Testimonials({ section, testimonials }: Props) {
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  const n = testimonials.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    if (hover || reduce) return;
    const id = setTimeout(() => go(1), 7000);
    return () => clearTimeout(id);
  }, [i, hover, reduce, go]);

  const t = testimonials[i];

  return (
    <section aria-labelledby="testimonials-title" className="relative overflow-hidden bg-white py-24 md:py-32 cv-auto" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <HandDoodle className="absolute right-[3%] top-[12%] hidden w-[130px] lg:block" />

      <div className="wrap">
        <Reveal className="text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <DonatHeading id="testimonials-title" lines={section.lines} className="mt-4" />
          {section.intro ? <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-[1.75] text-body">{section.intro}</p> : null}
        </Reveal>

        <Reveal y={50} className="relative mt-16 grid items-center lg:grid-cols-[540px_1fr]">
          <Brush name="splash" color="var(--color-deep)" className="absolute -left-[8%] -top-[18%] hidden w-[380px] lg:block" rotate={-12} />

          {/* Portrait with Donat's rounded bottom + rating tab */}
          <div className="relative z-10 mx-auto aspect-[540/600] w-full max-w-[540px] overflow-hidden rounded-b-[280px] rounded-tr-[0] bg-[#eee]">
            {testimonials.map((x, k) => (
              <div
                key={x.id}
                className={cn(
                  "absolute inset-0 transition-[clip-path,opacity] duration-[900ms] ease-out-expo",
                  k === i ? "opacity-100 [clip-path:inset(0_0_0_0)]" : "opacity-0 [clip-path:inset(0_0_0_100%)]",
                )}
              >
                {x.image ? (
                  <Image
                    src={x.image.src}
                    alt={k === i ? `${x.name}, ${x.role}` : ""}
                    fill
                    sizes="540px"
                    style={x.image.objectPosition ? { objectPosition: x.image.objectPosition } : undefined}
                    className="object-cover"
                  />
                ) : null}
              </div>
            ))}
            {t.image?.illustrative ? <ImageCredit position="static" className="absolute right-5 top-5" /> : null}
            <span className="absolute left-0 top-0 grid h-[112px] w-[100px] place-items-center rounded-b-[50px] bg-forest text-[17px] font-bold text-white">
              <span className="flex items-center gap-1">
                <Star className="size-4 text-marigold" fill="currentColor" strokeWidth={0} /> 5.0
              </span>
            </span>
          </div>

          {/* Cream quote card */}
          <div className="relative -mt-16 rounded-[40px] bg-cream px-8 pb-10 pt-24 lg:-ml-10 lg:mt-0 lg:rounded-l-none lg:py-16 lg:pl-24 lg:pr-16">
            <div key={i} className="animate-[hero-rise_0.8s_var(--ease-out-expo)_both] motion-reduce:animate-none">
              <p className="text-[17px] leading-[1.75] text-body md:text-[18px]">“{t.quote}”</p>
              <div className="mt-8 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[26px] font-semibold text-ink">{t.name}</p>
                  <p className="text-[15px] text-body">{t.role}</p>
                </div>
                <svg viewBox="0 0 60 50" className="w-14 shrink-0 text-forest" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 44C18 36 22 24 14 14C10 8 4 10 4 16M30 44C42 36 46 24 38 14C34 8 28 10 28 16" />
                </svg>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="col-start-1 mt-10 flex items-center justify-center gap-3 lg:col-start-2 lg:justify-start lg:pl-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial" className="grid size-14 place-items-center rounded-full border border-ink/70 text-ink transition-colors hover:border-forest hover:bg-forest hover:text-white">
              <ArrowLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next testimonial" className="grid size-14 place-items-center rounded-full border border-ink/70 text-ink transition-colors hover:border-forest hover:bg-forest hover:text-white">
              <ArrowRight className="size-5" />
            </button>
            <div className="ml-auto hidden items-end gap-3 sm:flex">
              <span className="text-[34px] font-medium leading-none text-forest">{String(i + 1).padStart(2, "0")}</span>
              <span className="mb-1.5 h-[2px] w-[240px] bg-line">
                <span className="block h-full bg-marigold transition-[width] duration-700 ease-out-expo" style={{ width: `${((i + 1) / n) * 100}%` }} />
              </span>
              <span className="mb-0.5 text-[15px] text-body">{String(n).padStart(2, "0")}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
