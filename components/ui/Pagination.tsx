import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type PaginationProps = {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  /** URL of a page (keep filters in the query). Called on the server or the client. */
  hrefFor: (page: number) => string;
  /** Accessible name of the nav (default "Pages"). */
  label?: string;
  className?: string;
};

/** Page numbers with ellipses: 1 … 4 5 6 … 12. */
function pageWindow(page: number, count: number): Array<number | "gap"> {
  const keep = new Set([1, count, page - 1, page, page + 1]);
  const out: Array<number | "gap"> = [];
  let prev = 0;
  for (let p = 1; p <= count; p++) {
    if (!keep.has(p)) continue;
    if (p - prev > 1) out.push(p - prev === 2 ? p - 1 : "gap");
    out.push(p);
    prev = p;
  }
  return out;
}

const disc =
  "inline-grid size-11 place-items-center rounded-full font-grotesk text-[14px] font-semibold tabular-nums transition-colors duration-300";

/**
 * Numbered pagination for public listings (/news 9 per page, /resources 12 per page; PLAN D124):
 * real links with rel="prev"/"next" that work without JavaScript. Current page = forest disc.
 */
export function Pagination({ page, pageCount, hrefFor, label = "Pages", className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(1, page), pageCount);
  const pill =
    "inline-flex h-11 items-center gap-2 rounded-full border border-ink/80 px-5 text-[14px] font-bold text-ink transition-colors duration-300 hover:border-forest hover:bg-forest hover:text-white";
  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {current > 1 ? (
        <Link href={hrefFor(current - 1)} rel="prev" className={pill}>
          <ArrowLeft aria-hidden className="size-4" strokeWidth={2.5} />
          Previous<span className="sr-only"> page</span>
        </Link>
      ) : null}
      <ul className="flex flex-wrap items-center gap-1.5">
        {pageWindow(current, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-body">
              …
            </li>
          ) : (
            <li key={p}>
              {p === current ? (
                <span aria-current="page" className={cn(disc, "bg-forest text-white")}>
                  <span className="sr-only">Page </span>
                  {p}
                </span>
              ) : (
                <Link href={hrefFor(p)} className={cn(disc, "border border-line bg-white text-ink hover:border-forest hover:text-forest")}>
                  <span className="sr-only">Page </span>
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
      </ul>
      {current < pageCount ? (
        <Link href={hrefFor(current + 1)} rel="next" className={pill}>
          Next<span className="sr-only"> page</span>
          <ArrowRight aria-hidden className="size-4" strokeWidth={2.5} />
        </Link>
      ) : null}
    </nav>
  );
}
