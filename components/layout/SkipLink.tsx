import { cn } from "@/lib/cn";

/**
 * "Skip to content": the first focusable element of the site and admin layouts (D9). Hidden until
 * focused, then a forest pill top-left. Targets `<main id="main" tabIndex={-1}>`.
 */
export function SkipLink({ href = "#main", label = "Skip to content", className }: { href?: string; label?: string; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:h-12 focus:items-center focus:rounded-full focus:bg-forest focus:px-6 focus:text-[15px] focus:font-bold focus:text-white focus:shadow-float focus:[--focus:var(--color-marigold)]",
        className,
      )}
    >
      {label}
    </a>
  );
}
