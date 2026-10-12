"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { AutoVideo } from "@/components/ui/AutoVideo";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { manifestoGlyphs } from "@/components/art/manifesto-glyphs";
import { useInView } from "@/lib/motion/useInView";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/motion/gsap";
import type { HomeView } from "@/lib/content/types";

/**
 * Voices United's signature: film playing *inside* giant condensed letters.
 * A cream SVG plate with the words knocked out of it sits over a muted video.
 */
export function Manifesto({ manifesto }: { manifesto: HomeView["manifesto"] }) {
  const [donate, story] = manifesto.ctas;
  const root = useRef<HTMLElement>(null);
  const [plate, shown] = useInView<SVGSVGElement>({ rootMargin: "0px 0px -25% 0px" });

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;
      // Slow parallax drift of the film inside the letters.
      gsap.fromTo(
        el.querySelector("[data-mask-video]"),
        { yPercent: -8, scale: 1.18 },
        { yPercent: 8, scale: 1.05, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
      );
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="manifesto-title" className="relative overflow-hidden bg-vu-cream py-20 md:py-28 cv-auto">
      <h2 id="manifesto-title" className="sr-only">
        Every child
      </h2>
      <div className="wrap">
        <div className="relative mx-auto w-full max-w-[880px]">
          <div className="relative aspect-[1000/640] w-full overflow-hidden">
            {/* Inset clip: the film never reaches the plate's anti-aliased outer edge (no hairline frame). */}
            <div className="absolute inset-1 overflow-hidden">
              <AutoVideo data-mask-video src={manifesto.media.src} poster={manifesto.media.poster} className="absolute inset-0 size-full object-cover" />
            </div>
            <svg ref={plate} data-shown={shown ? "" : undefined} viewBox="0 0 1000 640" className="manifesto-plate absolute inset-0 size-full" aria-hidden>
              <defs>
                {/* Words are Anton outlines (scripts/art/text-paths.mjs), knocked out of the cream plate. */}
                <mask id="manifesto-knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="640">
                  <rect width="1000" height="640" fill="#fff" />
                  <path className="manifesto-line" d={manifestoGlyphs.every} fill="#000" />
                  <path className="manifesto-line" d={manifestoGlyphs.child} fill="#000" style={{ transitionDelay: "0.18s" }} />
                </mask>
              </defs>
              <rect width="1000" height="640" fill="var(--color-vu-cream)" mask="url(#manifesto-knockout)" />
            </svg>
            {manifesto.media.illustrative ? <ImageCredit position="bottom-left" /> : null}
          </div>
        </div>

        <Reveal stagger={0.12} y={24}>
          <p className="mx-auto mt-8 max-w-xl text-center font-grotesk text-[17px] leading-relaxed text-ink/70">{manifesto.tagline}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href={donate.href} variant="vu" icon="none" size="lg" className="min-w-[200px]">
              {donate.label}
            </Button>
            <Button href={story.href} variant="vu-outline" icon="none" size="lg" className="min-w-[200px]">
              {story.label}
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
