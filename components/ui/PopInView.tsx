"use client";

import { useInView } from "@/lib/motion/useInView";
import { cn } from "@/lib/cn";

/**
 * Pops its child once (the programme-icon `pi-pop`) the first time it scrolls into view.
 * Tiny client leaf so the surrounding Timeline stays a server component. Still under reduced motion.
 */
export function PopInView({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>({ rootMargin: "0px 0px -10% 0px" });
  return (
    <span
      ref={ref}
      className={cn("inline-grid", inView && "animate-[pi-pop_0.8s_var(--ease-out-back)_both] motion-reduce:animate-none", className)}
      style={inView && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </span>
  );
}
