import { CalendarCheck, Download, Mail } from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Prose } from "@/components/ui/Prose";
import { Toc, type TocItem } from "@/components/ui/Toc";
import { routeHref } from "@/lib/routes";
import { cn } from "@/lib/cn";

export type { TocItem };

export type PolicyShellProps = {
  /** Built from the policy's heading blocks (D44). */
  toc: TocItem[];
  /** The policy body (usually <Blocks/>), rendered inside Prose. */
  children: React.ReactNode;
  meta: {
    /** "12 October 2026". */
    reviewed: string;
    version?: string;
    /** A PDF copy (D50 `Policy.pdf`). */
    pdf?: string;
  };
  /** E.g. the "Draft, pending professional review" Notice (D50), shown above the body. */
  notice?: React.ReactNode;
  /** The closing card: who to ask (default: the contact page). */
  contact?: { text?: string; label?: string; href?: string };
  className?: string;
};

/**
 * Safeguarding, privacy and terms pages (design-system §3.1): a sticky contents list beside the prose
 * from lg, an "On this page" disclosure on phones, review meta and a closing contact card.
 * Never inside a cv-auto section (anchor jumps).
 */
export function PolicyShell({ toc, children, meta, notice, contact, className }: PolicyShellProps) {
  const hasToc = toc.length > 1;
  return (
    <div className={cn("grid grid-cols-1 gap-10 lg:gap-16", hasToc && "lg:grid-cols-[240px_minmax(0,1fr)]", className)}>
      {hasToc ? (
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="hidden lg:block">
            <Toc items={toc} />
          </div>
          <div className="lg:hidden">
            <Accordion variant="flush" headingLevel={2} items={[{ id: "toc", title: "On this page", content: <Toc items={toc} hideTitle label="On this page" /> }]} />
          </div>
        </aside>
      ) : null}

      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-2 font-grotesk text-[14px] text-body">
          <span className="inline-flex items-center gap-1.5">
            <CalendarCheck aria-hidden className="size-4 text-marigold-ink" strokeWidth={2.25} />
            Last reviewed {meta.reviewed}
          </span>
          {meta.version ? <span>Version {meta.version}</span> : null}
          {meta.pdf ? (
            <a href={meta.pdf} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink">
              <Download aria-hidden className="size-4" strokeWidth={2.5} />
              Download PDF
            </a>
          ) : null}
        </p>
        {notice ? <div className="mt-6 max-w-reading">{notice}</div> : null}
        <Prose className="mt-8">{children}</Prose>

        <section className="mt-14 max-w-reading rounded-control bg-cream p-6 md:p-7">
          <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-ink">
            <Mail aria-hidden className="size-5 text-marigold-ink" strokeWidth={2.25} />
            {contact?.text ?? "Questions about this policy?"}
          </h2>
          <ArrowLink href={contact?.href ?? routeHref("contact")} className="mt-3 font-bold">
            {contact?.label ?? "Contact our safeguarding lead"}
          </ArrowLink>
        </section>
      </div>
    </div>
  );
}
