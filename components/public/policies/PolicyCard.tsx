import Link from "next/link";
import { ArrowUpRight, Check, ClipboardCheck, Download, LockKeyhole, ScrollText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { IconDisc } from "@/components/ui/IconDisc";
import type { PolicyView } from "@/lib/content/types";
import { cn } from "@/lib/cn";

const ICON = { safeguarding: ShieldCheck, privacy: LockKeyhole, terms: ScrollText } as const;

/**
 * One policy on /policies (public-pages §3.21): icon disc, title, the draft flag (D50), the first
 * "in plain words" points, review meta and Read / Download PDF. The whole card is one link target
 * (stretched link on the title) with the PDF link layered above it.
 */
export function PolicyCard({ policy, className }: { policy: PolicyView; className?: string }) {
  const titleId = `policy-${policy.slug}-title`;
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "group relative flex flex-col rounded-card-lg bg-white p-7 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo focus-within:shadow-card-hover hover:-translate-y-1.5 hover:shadow-card-hover md:p-8",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <IconDisc icon={ICON[policy.slug]} size={64} />
        {policy.draft ? (
          <Badge tone="marigold" icon={ClipboardCheck} size="sm">
            Draft
          </Badge>
        ) : null}
      </div>
      <h2 id={titleId} className="mt-6 text-[24px] font-extrabold leading-tight text-ink">
        <Link href={policy.href} className="outline-none after:absolute after:inset-0 after:rounded-card-lg after:content-[''] focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-offset-4 focus-visible:after:outline-forest">
          {policy.title}
        </Link>
      </h2>
      <ul className="mt-5 grid gap-3">
        {policy.summary.slice(0, 3).map((line) => (
          <li key={line} className="flex items-start gap-3 text-[15px] leading-relaxed text-body">
            <span aria-hidden className="mt-[3px] grid size-5 shrink-0 place-items-center rounded-full bg-mint text-forest-700">
              <Check className="size-3" strokeWidth={3.5} />
            </span>
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <p className="font-grotesk text-[13px] text-body">
          {policy.lastReviewedLabel ? <>Last reviewed {policy.lastReviewedLabel} · </> : null}Version {policy.version}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span aria-hidden className="inline-flex items-center gap-1.5 text-[15px] font-bold text-forest transition-colors group-hover:text-ink">
            Read the policy
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.5} />
          </span>
          {policy.pdfHref ? (
            <a
              href={policy.pdfHref}
              className="relative z-[1] inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink"
            >
              <Download aria-hidden className="size-4" strokeWidth={2.5} />
              Download PDF<span className="sr-only">: {policy.title}</span>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
