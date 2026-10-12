"use client";

import { useEffect, useState } from "react";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { scrollToId } from "./AnchorLink";
import { cn } from "@/lib/cn";

export type TocItem = { id: string; label: string; /** 2 = section, 3 = sub-section (indented). */ level?: 2 | 3 };

export type TocProps = {
  items: TocItem[];
  /** Accessible name of the nav (and its visible heading unless `hideTitle`). */
  label?: string;
  hideTitle?: boolean;
  className?: string;
};

/**
 * "On this page" scroll-spy (design-system §3.2): the active item gets a 2px marigold bar, ink bold
 * text and aria-current="location". Links scroll with Lenis and the sticky-bar offset.
 */
export function Toc({ items, label = "On this page", hideTitle, className }: TocProps) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const lenis = useLenis();

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      // A band just under the sticky bars: a heading is "current" once it reaches the top third.
      { rootMargin: "-110px 0px -62% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className={className}>
      {hideTitle ? null : <p className="mb-4 font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-body">{label}</p>}
      <ol className="grid gap-1 border-l-2 border-line">
        {items.map((item) => {
          const on = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={on ? "location" : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  if (scrollToId(item.id, lenis)) {
                    e.preventDefault();
                    setActive(item.id);
                    window.history.replaceState(window.history.state, "", `#${item.id}`);
                  }
                }}
                className={cn(
                  "relative -ml-0.5 block border-l-2 py-1.5 text-[15px] leading-snug transition-colors duration-300",
                  item.level === 3 ? "pl-7" : "pl-4",
                  on ? "border-marigold font-bold text-ink" : "border-transparent text-body hover:text-forest",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
