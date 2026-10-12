import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type ArrowLinkProps = {
  href: string;
  children: React.ReactNode;
  /**
   * The surface the link sits on. `light` (default): ink label, marigold-ink arrow, forest on hover.
   * `dark`: the Footer LinkColumn look, white/75 label and marigold arrow, marigold on hover.
   */
  tone?: "light" | "dark";
  /** Bigger row for menus and "More" sheets (17px, full width, 48px tall). */
  size?: "md" | "lg";
  /** Opens in a new tab with rel="noopener noreferrer" and an sr-only note. */
  external?: boolean;
  className?: string;
};

/** A related-links row: an ArrowUpRight that turns 45° on hover (design-system §3.2). */
export function ArrowLink({ href, children, tone = "light", size = "md", external, className }: ArrowLinkProps) {
  const cls = cn(
    "group inline-flex items-center gap-3 transition-colors duration-300",
    size === "md" ? "min-h-11 text-[16px]" : "min-h-12 w-full text-[17px] font-semibold",
    tone === "dark" ? "text-white/75 hover:text-marigold" : "text-ink hover:text-forest",
    className,
  );
  const arrow = (
    <ArrowUpRight
      aria-hidden
      strokeWidth={2.5}
      className={cn("size-4 shrink-0 transition-transform duration-300 group-hover:rotate-45", tone === "dark" ? "text-marigold" : "text-marigold-ink")}
    />
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {arrow}
        <span>
          {children}
          <span className="sr-only"> (opens in a new tab)</span>
        </span>
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {arrow}
      <span>{children}</span>
    </Link>
  );
}
