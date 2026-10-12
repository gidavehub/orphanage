import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export type PageHeaderTab = {
  label: string;
  href: string;
  count?: number;
  /** The page passes which tab it is on (pages know their own URL; no path hook needed). */
  current?: boolean;
};

export type PageHeaderProps = {
  title: string;
  /** One line saying what this page is for. */
  description?: React.ReactNode;
  /** The page's primary action (one Button), right-aligned on desktop. */
  actions?: React.ReactNode;
  /** Sub-areas as pill tabs under the title, never a side list (admin-ux §3.1). */
  tabs?: PageHeaderTab[];
  /** Detail pages: the ‹ back chevron to the list. */
  back?: { label: string; href: string };
  className?: string;
};

/**
 * Every desk page's header (admin-ux §3.1, §9.1): title (Nunito 800, 24 → 32), a one-line purpose,
 * the primary action, and sub-area tabs as pills that scroll sideways on phones with an edge fade.
 */
export function PageHeader({ title, description, actions, tabs, back, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 md:mb-8", className)}>
      {back ? (
        <Link
          href={back.href}
          className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-full pl-1 pr-3 text-[15px] font-bold text-forest transition-colors hover:bg-mint"
        >
          <ChevronLeft aria-hidden className="size-5" strokeWidth={2.5} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-[24px] font-extrabold leading-[1.2] text-ink md:text-[32px]">{title}</h1>
          {description ? <div className="mt-1.5 max-w-[720px] text-[15px] leading-relaxed text-body md:text-[16px]">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {tabs?.length ? (
        <nav aria-label={`${title} sections`} className="scroll-fade-x scrollbar-none -mx-4 mt-5 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            {tabs.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={tab.current ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-5 text-[14px] font-bold transition-colors",
                    tab.current ? "bg-forest text-white" : "bg-white text-ink shadow-thumb hover:bg-mint",
                  )}
                >
                  {tab.label}
                  {typeof tab.count === "number" ? (
                    <span
                      className={cn(
                        "inline-grid min-w-6 place-items-center rounded-full px-1.5 font-grotesk text-[12px] font-semibold tabular-nums leading-6",
                        tab.current ? "bg-white text-forest-700" : "bg-pebble text-body",
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
