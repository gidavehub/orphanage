"use client";

import { useEffect, useRef, useState } from "react";
import { AnchorLink, anchorOffset } from "@/components/ui/AnchorLink";
import { cn } from "@/lib/cn";

export type SectionChip = { id: string; label: string };

/**
 * The programme page's sticky section chips (public-pages §3.4.3): Overview · The Problem · Support ·
 * Eligibility · How It Works · Resources · Contact. They stick under the header (68px bar below xl,
 * 88px pill from xl) and scroll sideways on phones. A scroll spy marks the section in view with
 * `aria-current="location"` and keeps its chip visible in the row.
 */
export function SectionChips({ items, label = "On this page", className }: { items: SectionChip[]; label?: string; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const bar = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLUListElement>(null);

  // Scroll spy: the current section is the last one whose top has passed a reading line just under
  // the sticky chips (so a chip jump marks the section it landed on, not the one above it). Above
  // the first section (back at the hero) no chip is current; at the very bottom the last section
  // that is on screen wins, because a short final section may never reach the line.
  useEffect(() => {
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Where the chips' bottom edge sits once stuck (not where it is now, above the fold), plus
      // room for the gap a chip jump leaves above the section.
      const nav = bar.current;
      const stuckTop = nav ? parseFloat(getComputedStyle(nav).top) || anchorOffset() : anchorOffset();
      const line = stuckTop + (nav?.offsetHeight ?? 64) + 120;
      let current: string | null = null;
      for (const t of targets) if (t.getBoundingClientRect().top <= line) current = t.id;
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        const onScreen = targets.filter((t) => t.getBoundingClientRect().top < window.innerHeight * 0.7);
        if (onScreen.length) current = onScreen[onScreen.length - 1].id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  // Keep the active chip in view inside the sideways row (phones), without moving the page.
  useEffect(() => {
    const row = scroller.current;
    if (!row || !active) return;
    const chip = row.querySelector<HTMLElement>(`[data-chip="${CSS.escape(active)}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  return (
    <nav
      ref={bar}
      aria-label={label}
      className={cn("sticky top-[68px] z-30 border-b border-line bg-white/92 backdrop-blur-md supports-[backdrop-filter]:bg-white/85 xl:top-[88px]", className)}
    >
      <div className="wrap relative">
        <ul
          ref={scroller}
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:mx-0 sm:px-0 md:justify-center [&::-webkit-scrollbar]:hidden"
        >
          {items.map((i) => {
            const on = active === i.id;
            return (
              <li key={i.id} className="shrink-0 snap-start">
                <AnchorLink
                  to={i.id}
                  data-chip={i.id}
                  aria-current={on ? "location" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-5 text-[14px] font-bold transition-colors duration-300",
                    on ? "bg-forest text-white shadow-chip" : "border border-line bg-white text-ink hover:border-forest hover:text-forest",
                  )}
                >
                  {i.label}
                </AnchorLink>
              </li>
            );
          })}
        </ul>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent md:hidden" />
      </div>
    </nav>
  );
}
