"use client";

import { useInView } from "@/lib/motion/useInView";
import { cn } from "@/lib/cn";

type Props = {
  percent: number;
  tone?: "flame" | "forest" | "marigold" | "clay";
  className?: string;
  label: string;
  /**
   * `true` (default): fills over 1.8s when scrolled into view (campaign progress).
   * `false`: shows the live width with a short transition (FileDrop upload progress, Stepper).
   */
  animate?: boolean;
};

const fill = { flame: "bg-flame", forest: "bg-forest", marigold: "bg-marigold", clay: "bg-clay" };
const track = { flame: "bg-track", forest: "bg-mint", marigold: "bg-cream", clay: "bg-sand" };

/** Donat's thin campaign progress bar; fills (CSS transition) when it scrolls into view. */
export function ProgressBar({ percent, tone = "flame", className, label, animate = true }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -8% 0px" });
  const pct = Math.max(1.5, Math.min(100, percent));

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-[5px] w-full overflow-hidden rounded-full", track[tone], className)}
    >
      {animate ? (
        <div
          className={cn("h-full origin-left rounded-full transition-transform duration-[1.8s] ease-out-expo motion-reduce:transition-none", fill[tone])}
          style={{ width: `${pct}%`, transform: inView ? "scaleX(1)" : "scaleX(0)" }}
        />
      ) : (
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none", fill[tone])}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
