import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The landing's quiet "go further" text link ("Become a Partner", "Meet the Team", "See All
 * Questions"): bold forest words on a marigold underline with an arrow that turns on hover. Used
 * where a full button would compete with a section's own call to action (public-pages §6).
 */
export function MoreLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-h-11 items-center gap-1 font-bold text-forest underline decoration-marigold/70 decoration-2 underline-offset-4 transition-colors hover:text-ink",
        className,
      )}
    >
      {children}
      <ArrowUpRight aria-hidden strokeWidth={2.5} className="size-4 text-marigold-ink transition-transform duration-300 group-hover:rotate-45" />
    </Link>
  );
}
