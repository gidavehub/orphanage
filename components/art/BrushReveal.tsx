"use client";

import { useInView } from "@/lib/motion/useInView";
import { brushes, type BrushName } from "./brush-index";
import { cn } from "@/lib/cn";

/**
 * A brush mark (or brush-masked content) that paints itself on: the brush SVG mask
 * is intersected with a soft linear wipe whose edge (`--wipe`, a registered CSS
 * property) transitions across when the element scrolls into view.
 */
export function BrushReveal({
  name,
  color,
  className,
  children,
  direction = "right",
  duration = 1.4,
  delay = 0,
  flipX,
  immediate,
  style,
}: {
  name: BrushName;
  color?: string;
  className?: string;
  children?: React.ReactNode;
  direction?: "right" | "left" | "up" | "down";
  duration?: number;
  delay?: number;
  flipX?: boolean;
  /** Above the fold: wipe in from the first paint with CSS alone (no waiting for hydration). */
  immediate?: boolean;
  style?: React.CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -15% 0px" });
  const angle = { right: "90deg", left: "270deg", up: "0deg", down: "180deg" }[direction];

  const { w, h } = brushes[name];
  const brush = `url(/brush/${name}.svg)`;
  const wipe = `linear-gradient(${angle}, #000 var(--wipe), transparent calc(var(--wipe) + 18%))`;

  return (
    <div
      ref={ref}
      aria-hidden={children ? undefined : true}
      className={cn(
        "motion-reduce:transition-none",
        immediate && "brush-wipe-in",
        !children && "pointer-events-none",
        className,
      )}
      style={
        {
          ...(immediate
            ? { "--wipe-dur": `${duration}s`, "--wipe-delay": `${delay}s` }
            : {
                "--wipe": inView ? "120%" : "-20%",
                transitionProperty: "--wipe",
                transitionTimingFunction: "cubic-bezier(0.65, 0, 0.35, 1)",
                transitionDuration: `${duration}s`,
                transitionDelay: `${delay}s`,
              }),
          aspectRatio: children ? undefined : `${w} / ${h}`,
          backgroundColor: children ? undefined : color,
          transform: flipX ? "scaleX(-1)" : undefined,
          maskImage: `${brush}, ${wipe}`,
          WebkitMaskImage: `${brush}, ${wipe}`,
          maskSize: "100% 100%, 100% 100%",
          WebkitMaskSize: "100% 100%, 100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
          ...style,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
