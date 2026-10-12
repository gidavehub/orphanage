import { cn } from "@/lib/cn";

/**
 * The brand heart, centred on (0,0) and about 30 units wide. Same path as HEART_PATH in
 * components/art/Hands.tsx; repeated here because constants exported from a "use client" module
 * cannot be read by server components.
 */
export const HEART_D =
  "M0 12C-8 6-15 0-15-7C-15-12-11-15-7-15C-4-15-1-13 0-10C1-13 4-15 7-15C11-15 15-12 15-7C15 0 8 6 0 12Z";

/** A small solid heart (breadcrumb separators, list markers). Decorative. */
export function HeartGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="-15 -15 30 27" aria-hidden className={cn("size-2 shrink-0 fill-marigold", className)}>
      <path d={HEART_D} />
    </svg>
  );
}
