import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";

export type SpinnerProps = {
  /** Glyph size in px (16–24). */
  size?: 16 | 20 | 24;
  /** Screen-reader text. Pass "" when the parent already says it is busy (e.g. a loading Button). */
  label?: string;
  className?: string;
};

/**
 * Haven's loading indicator: a beating heart in the current colour (design-system §3.4).
 * Under reduced motion the heart stays still (global CSS rule) and the label carries the meaning.
 */
export function Spinner({ size = 20, label = "Loading…", className }: SpinnerProps) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center", className)}>
      <Heart
        aria-hidden
        fill="currentColor"
        strokeWidth={0}
        style={{ width: size, height: size }}
        className="animate-heartbeat motion-reduce:animate-none"
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
