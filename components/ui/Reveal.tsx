"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Reveal direct children one after another (seconds between each) instead of the wrapper. */
  stagger?: number;
  y?: number;
  x?: number;
  delay?: number;
  duration?: number;
  scale?: number;
  /** How far into the viewport the element must be before revealing (fraction of height). */
  offset?: number;
  as?: "div" | "section" | "ul" | "ol" | "header" | "footer" | "article";
  id?: string;
};

/**
 * Fade + rise on scroll into view, driven by one IntersectionObserver and CSS
 * transitions (see `[data-reveal]` in globals.css) — no per-element ScrollTrigger,
 * so dozens of these cost almost nothing on low-end phones. Once finished, the
 * attributes are removed so each element's own hover/transition utilities apply.
 */
export function Reveal({
  children,
  className,
  stagger,
  y = 40,
  x = 0,
  delay = 0,
  duration = 1,
  scale,
  offset = 0.14,
  as: As = "div",
  id,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const kids = stagger ? Array.from(el.children) : [];
    kids.forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(i)));
    let done: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        el.setAttribute("data-shown", "");
        const total = (delay + duration + (stagger ?? 0) * kids.length) * 1000 + 100;
        done = setTimeout(() => {
          el.removeAttribute("data-reveal");
          el.removeAttribute("data-reveal-stagger");
          el.removeAttribute("data-shown");
        }, total);
      },
      { rootMargin: `0px 0px -${Math.round(offset * 100)}% 0px` },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(done);
    };
  }, [stagger, delay, duration, offset]);

  const vars = {
    "--rx": `${x}px`,
    "--ry": `${y}px`,
    "--rs": String(scale ?? 1),
    "--rdur": `${duration}s`,
    "--rdel": `${delay}s`,
    "--rstag": `${stagger ?? 0}s`,
  } as React.CSSProperties;

  return (
    <As
      ref={ref as React.Ref<never>}
      id={id}
      className={cn(className)}
      style={vars}
      {...(stagger ? { "data-reveal-stagger": "" } : { "data-reveal": "" })}
    >
      {children}
    </As>
  );
}
