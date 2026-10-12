"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Counter } from "@/components/ui/Counter";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { VideoLightbox } from "@/components/ui/VideoLightbox";
import { Brush } from "@/components/art/Brush";
import { cn } from "@/lib/cn";
import type { HomeView } from "@/lib/content/types";

/** Donat "We Always Help The Needy People": green block, 2×2 stats, B&W photo, play button. */
export function Restoring({ restoring }: { restoring: HomeView["restoring"] }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="restoring-title" className="relative bg-white cv-auto">
      <div className="relative ml-auto overflow-hidden bg-forest lg:w-[calc(100%-6.5%)]">
        {/* Donat's white paint edge on the block's left side */}
        <Brush name="edge" color="#fff" className="absolute -left-[4%] top-[4%] z-10 hidden w-[12%] lg:block" flipX />

        <div className="grid lg:grid-cols-[1.02fr_1fr]">
          <Reveal stagger={0.12} className="relative z-10 px-6 py-20 text-white sm:px-12 lg:py-28 lg:pl-[13%] lg:pr-16">
            <DonatHeading id="restoring-title" light lines={restoring.titleLines} />
            <p className="mt-6 max-w-[520px] text-[16px] leading-[1.8] text-white/90">{restoring.text}</p>
            <dl className="mt-10 grid max-w-[560px] grid-cols-2">
              {restoring.stats.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    "py-7",
                    i % 2 === 1 && "border-l border-white/20 pl-8",
                    i < 2 && "border-b border-white/20",
                  )}
                >
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <p className={cn("text-[44px] font-bold leading-none md:text-[50px]", s.tone === "marigold" ? "text-marigold" : "text-white")}>
                      <Counter value={s.value} suffix={s.suffix} suffixClassName="font-normal" />
                    </p>
                    <p className="mt-3 text-[16px] font-semibold text-white">{s.label}</p>
                  </dd>
                </div>
              ))}
            </dl>
            {restoring.showNote ? <p className="mt-6 text-[12px] text-white/90">{restoring.placeholderNote}</p> : null}
          </Reveal>

          <div className="relative min-h-[420px] lg:my-10">
            <Image
              src={restoring.image.src}
              alt={restoring.image.alt}
              fill
              sizes="(min-width:1024px) 50vw, 100vw"
              style={restoring.image.objectPosition ? { objectPosition: restoring.image.objectPosition } : undefined}
              className="object-cover grayscale"
            />
            {restoring.image.illustrative ? <ImageCredit position="bottom-left" /> : null}
            <Brush name="edge" color="#fff" className="absolute -right-[3%] bottom-0 hidden w-[18%] lg:block" />
            {/* Play button with pulse rings, straddling the photo's left edge */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Play our story film"
              className="group absolute left-1/2 top-1/2 z-10 grid size-[110px] -translate-x-1/2 -translate-y-1/2 place-items-center lg:left-0"
            >
              <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-white/40" />
              <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-white/30 [animation-delay:1.2s]" />
              <span className="absolute inset-0 rounded-full bg-white/30 backdrop-blur-sm" />
              <span className="relative grid size-[78px] place-items-center rounded-full bg-white text-deep transition-transform duration-500 group-hover:scale-110">
                <Play className="ml-1 size-6" fill="currentColor" />
              </span>
            </button>
          </div>
        </div>
      </div>
      <VideoLightbox open={open} onClose={() => setOpen(false)} src={restoring.film.src} poster={restoring.film.poster} title={restoring.filmTitle} />
    </section>
  );
}
