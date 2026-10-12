"use client";

import { useEffect, useRef } from "react";
import { useInView } from "@/lib/motion/useInView";
import { prefersReducedMotion } from "@/lib/motion/useReducedMotion";
import { cn } from "@/lib/cn";

const fmt = new Intl.NumberFormat("en-US");

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  suffixClassName?: string;
  /** Render compact values like 15K. */
  compact?: boolean;
};

function format(n: number, compact?: boolean) {
  if (compact && n >= 1000) return `${Math.round(n / 1000)}K`;
  return fmt.format(Math.round(n));
}

/** Counts up from zero the first time it scrolls into view (rAF, no scroll listeners). */
export function Counter({ value, suffix, prefix, duration = 2.2, className, suffixClassName, compact }: Props) {
  const [wrap, inView] = useInView<HTMLSpanElement>({ rootMargin: "0px 0px -10% 0px" });
  const numRef = useRef<HTMLSpanElement>(null);

  // Start from zero on the client (the server-rendered final value stays for no-JS / SEO).
  useEffect(() => {
    if (numRef.current && !prefersReducedMotion()) numRef.current.textContent = format(0, compact);
  }, [compact]);

  useEffect(() => {
    const el = numRef.current;
    if (!inView || !el) return;
    if (prefersReducedMotion()) {
      el.textContent = format(value, compact);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(value * eased, compact);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, compact]);

  return (
    <span ref={wrap} className={cn("tabular-nums", className)}>
      {prefix}
      <span ref={numRef}>{format(value, compact)}</span>
      {suffix && <span className={suffixClassName}>{suffix}</span>}
    </span>
  );
}
