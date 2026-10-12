"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/motion/gsap";
import { cn } from "@/lib/cn";
import { AutoVideo } from "@/components/ui/AutoVideo";
import { ImageCredit } from "@/components/ui/ImageCredit";
import type { HomeView } from "@/lib/content/types";

/**
 * Voices United pinned slides: full-bleed media crossfades while the stacked
 * headline list swaps outline ↔ filled for the active theme.
 */
export function Focus({ focus }: { focus: HomeView["focus"] }) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const n = focus.items.length;

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;
      let last = 0;
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: () => `+=${window.innerHeight * (n - 0.4)}`,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const i = Math.min(n - 1, Math.floor(self.progress * n));
          if (i !== last) {
            last = i;
            setActive(i);
          }
        },
      });
      gsap.from(el.querySelectorAll("[data-focus-item]"), {
        yPercent: 60,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        scrollTrigger: { trigger: el, start: "top 60%", once: true },
      });
      return () => st.kill();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      data-nav-theme="glass"
      aria-labelledby="focus-title"
      className="relative h-svh min-h-[560px] overflow-hidden bg-night text-white"
    >
      <h2 id="focus-title" className="sr-only">
        What we stand for: {focus.items.join(", ")}
      </h2>
      {focus.media.map((m, i) => (
        <div
          key={i}
          aria-hidden
          className={cn("absolute inset-0 transition-[opacity,transform] duration-[1200ms] ease-out-expo", i === active ? "scale-100 opacity-100" : "scale-[1.06] opacity-0")}
        >
          {"poster" in m && m.poster ? (
            <AutoVideo src={m.src} poster={m.poster} paused={i !== active} className="size-full object-cover" />
          ) : (
            <Image src={m.src} alt="" fill sizes="100vw" className="object-cover" />
          )}
        </div>
      ))}
      {/* Earth-toned grade (umber) so the chapter reads warm, per the client's palette note */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(46,26,14,0.4)_0%,rgba(46,26,14,0.08)_38%,rgba(46,26,14,0.78)_100%)]" />
      {focus.media[active]?.illustrative ? <ImageCredit position="bottom-left" className="z-10" /> : null}

      <div className="absolute inset-x-0 bottom-[6vh] z-10 flex flex-col items-center px-4 text-center">
        <ul className="flex flex-col items-center font-display uppercase leading-[1.02]">
          {focus.items.map((t, i) => (
            <li key={t} data-focus-item className="overflow-hidden">
              <span
                className={cn(
                  "block text-[42px] transition-all duration-700 ease-out-expo md:text-[64px] xl:text-[76px]",
                  i === active ? "text-white" : "text-outline text-sand/85 opacity-70",
                )}
              >
                {t}
              </span>
            </li>
          ))}
        </ul>
        <p
          key={active}
          className="mt-5 max-w-[640px] animate-[hero-rise_0.8s_var(--ease-out-expo)_both] rounded-[22px] bg-clay/90 px-5 py-2.5 font-grotesk text-[14px] leading-snug text-white shadow-[0_18px_40px_-20px_rgba(46,26,14,0.8)] motion-reduce:animate-none md:text-[15px]"
        >
          {focus.captions[active]}
        </p>
      </div>

      <div className="absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        {focus.items.map((t, i) => (
          <span key={t} className={cn("h-10 w-[3px] rounded-full transition-colors duration-500", i === active ? "bg-clay" : "bg-white/30")} />
        ))}
      </div>
    </section>
  );
}
