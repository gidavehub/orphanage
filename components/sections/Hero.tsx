"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Brush } from "@/components/art/Brush";
import { AutoVideo } from "@/components/ui/AutoVideo";
import { Flag } from "@/components/art/Flag";
import { countryByCode } from "@/content/world";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { cn } from "@/lib/cn";
import type { HomeView } from "@/lib/content/types";
import { useStudioMode } from "@/lib/motion/useStudioMode";

const SLIDE_MS = 6000;

function RiseWords({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-top">
          <span
            className="inline-block animate-[hero-rise_1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={{ animationDelay: `${delay + i * 70}ms` }}
          >
            {w}&nbsp;
          </span>
        </span>
      ))}
    </>
  );
}

function PlaceChip({ code, name, className }: { code: string; name: string; className?: string }) {
  return (
    <p
      className={cn(
        "flex animate-[hero-rise_0.8s_var(--ease-out-expo)_both] items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-3.5 text-[13px] font-bold text-white ring-1 ring-white/25 backdrop-blur-md motion-reduce:animate-none md:text-[14px]",
        className,
      )}
    >
      <Flag code={code} className="size-7 ring-2 ring-white/80" />
      {name}
    </p>
  );
}

/** The landing hero: content arrives as props from getHomeContent() (content-model §4.7). No ImageCredit here (D54). */
export function Hero({ hero }: { hero: HomeView["hero"] }) {
  // `prev` keeps the outgoing slide mounted while it crossfades away.
  const [{ index, prev }, setPos] = useState({ index: 0, prev: -1 });
  const [paused, setPaused] = useState(false);
  // Only the current, outgoing and next stills are mounted; the next one is fetched once first paint settles.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWarm(true), 2500);
    return () => clearTimeout(id);
  }, []);
  const reduce = useReducedMotion();
  const studio = useStudioMode();
  const slides = hero.slides;
  const go = useCallback(
    (n: number) => setPos((p) => ({ prev: p.index, index: (n + slides.length) % slides.length })),
    [slides.length],
  );
  const next = (index + 1) % slides.length;

  useEffect(() => {
    if (reduce || paused || studio) return;
    const id = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, paused, reduce, studio, go]);

  const slide = slides[index];
  const place = countryByCode(slide.place);

  return (
    // Fills the viewport under the header: 84px below xl, 92px bar + 30px pill spacer from xl (Header.tsx).
    <section
      aria-roledescription="carousel"
      aria-label="Welcome to Haven"
      className="relative -mt-px h-[calc(100svh-83px)] min-h-[600px] overflow-hidden bg-night md:min-h-[540px] xl:h-[calc(100svh-121px)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Media layers */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== index}
          className={cn("absolute inset-0 transition-opacity duration-[1400ms] ease-in-out", i === index ? "opacity-100" : "opacity-0")}
        >
          <div
            key={i === index ? `kb-${index}` : `idle-${i}`}
            className={cn("absolute inset-0", i === index && !reduce && "animate-[kenburns_9s_linear_forwards]")}
          >
            {s.media.type === "video" ? (
              <>
                <Image src={s.media.poster} alt="" fill sizes="100vw" preload quality={85} className="object-cover" />
                <AutoVideo src={s.media.src} poster={s.media.poster} paused={index !== i} className="absolute inset-0 size-full object-cover" />
              </>
            ) : i === index || i === prev || (warm && i === next) ? (
              <Image
                src={s.media.src}
                alt=""
                fill
                sizes="100vw"
                quality={85}
                style={s.media.objectPosition ? { objectPosition: s.media.objectPosition } : undefined}
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,21,18,0.55)_0%,rgba(6,21,18,0.38)_45%,rgba(6,21,18,0.62)_100%)]" />
        </div>
      ))}

      {/* Copy */}
      <div className="relative z-10 flex h-full items-center justify-center pb-14 pt-4 text-center md:pb-0 md:pt-8">
        <div key={index} className="wrap flex flex-col items-center">
          {/* Phones: the family's country leads the copy (bottom-right is taken by the slide controls) */}
          {place && <PlaceChip code={place.code} name={place.name} className="mb-4 md:hidden" />}
          <p className="flex animate-[hero-rise_0.9s_var(--ease-out-expo)_both] items-center gap-3 font-script text-[24px] font-bold text-marigold motion-reduce:animate-none md:text-[30px]">
            <span className="h-[2px] w-10 bg-marigold md:w-[60px]" />
            {slide.eyebrow}
            <span className="h-[2px] w-10 bg-marigold md:w-[60px]" />
          </p>
          <h1 className="mt-3 max-w-[1100px] text-balance text-[36px] font-extrabold leading-[1.1] tracking-[-0.015em] text-white [text-shadow:0_4px_30px_rgba(0,0,0,0.25)] sm:text-[54px] lg:text-[70px] xl:text-[78px]">
            <span className="block">
              <RiseWords text={slide.title[0]} delay={120} />
            </span>
            <span className="block">
              <RiseWords text={slide.title[1]} delay={320} />
            </span>
          </h1>
          {/* Short phones: the hero must still fit the screen, so this repeated intro steps aside. */}
          <p className="mt-4 max-w-[640px] animate-[hero-rise_1s_var(--ease-out-expo)_both] text-[15px] leading-relaxed text-white/80 [animation-delay:600ms] motion-reduce:animate-none max-sm:[@media(max-height:760px)]:hidden md:mt-5 md:text-[16px] lg:text-[18px]">
            {hero.text}
          </p>
          <div className="mt-7 flex animate-[hero-rise_1s_var(--ease-out-expo)_both] flex-wrap justify-center gap-3 md:mt-8 md:gap-4 [animation-delay:760ms] motion-reduce:animate-none">
            <Button href={hero.primaryCta.href} variant="forest" size="lg">
              {hero.primaryCta.label}
            </Button>
            <Button href={hero.secondaryCta.href} variant="marigold" size="lg">
              {hero.secondaryCta.label}
            </Button>
          </div>
        </div>
      </div>

      {/* Where this family is, then the slide controls */}
      <div className="absolute bottom-8 right-5 z-10 flex flex-col items-end gap-3 md:bottom-12 md:right-10">
        {place && <PlaceChip key={`place-${index}`} code={place.code} name={place.name} className="hidden md:flex" />}
        <div className="flex items-center gap-3">
          <span className="font-display text-lg text-white">{String(index + 1).padStart(2, "0")}</span>
          <div className="flex gap-1.5 md:gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className="relative h-[3px] w-6 overflow-hidden rounded-full bg-white/30 md:w-10"
              >
                {i === index && (
                  <span
                    key={`p-${index}-${paused}`}
                    className={cn("absolute inset-y-0 left-0 bg-marigold", !reduce && !paused ? "animate-[progress_6s_linear_forwards]" : "w-full")}
                  />
                )}
              </button>
            ))}
          </div>
          <span className="font-display text-lg text-white/50">{String(slides.length).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Donat's paint-splatter corner, painted in the next section's paper tone */}
      <Brush
        name="band"
        color="var(--color-paper)"
        rotate={38}
        className="absolute -bottom-[110px] -left-[220px] z-10 w-[480px] md:-bottom-[250px] md:-left-[430px] md:w-[1120px]"
      />
      <Brush
        name="drip"
        color="var(--color-paper)"
        rotate={200}
        className="absolute bottom-[70px] left-[210px] z-10 hidden w-[150px] opacity-90 md:block"
      />
    </section>
  );
}
