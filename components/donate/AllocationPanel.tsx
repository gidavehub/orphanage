"use client";

import { ArrowRight, Info } from "lucide-react";
import { AllocationBar } from "@/components/ui/AllocationBar";
import { cn } from "@/lib/cn";
import { useDonateContext } from "./DonateStateProvider";
import { amountOf, feeOf, moneyExact, splitOf, type WidgetCause } from "./model";

const FILL: Record<string, string> = {
  forest: "bg-forest",
  marigold: "bg-marigold",
  clay: "bg-clay",
  cocoa: "bg-cocoa",
  coral: "bg-coral-800",
  umber: "bg-umber",
  deep: "bg-deep",
};
const ORDER = ["forest", "marigold", "clay", "cocoa", "coral", "umber", "deep"];

function asOf(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * "See exactly where the money goes" (public-pages §4.5.1; PLAN D56): the cause's planned split as a
 * stacked bar with a legend, and, live from the widget, what the donor's own gift becomes line by line.
 * Unverified splits carry the Illustrative chip; once the before-launch switch hides unverified figures
 * the percentages and the live split disappear and the lines read as a plain list.
 */
export function AllocationPanel({
  cause,
  eyebrow,
  title,
  note,
}: {
  cause: WidgetCause;
  eyebrow?: string;
  title: string;
  /** The illustrative note ("Percentages are illustrative until…"). */
  note?: string;
}) {
  const ctx = useDonateContext();
  const state = ctx?.state;
  const active = ctx && ctx.activeSlug === cause.slug;
  const value = state && state.mode === "cash" ? amountOf(state) : 0;
  const total = state && state.coverFees ? value + feeOf(value, ctx.config.coverFeesPercent) : value;
  const currency = state?.currency ?? cause.currency;
  const live = active && total > 0 && cause.showFigures;
  const updated = asOf(cause.allocationAsOf);
  const year = cause.allocationAsOf?.slice(0, 4);

  return (
    <section id="where-it-goes" aria-labelledby="where-it-goes-title" className="relative scroll-mt-28 overflow-hidden rounded-card-lg bg-white p-6 shadow-soft sm:p-8 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="font-script text-[22px] font-bold leading-none text-marigold-ink md:text-[24px]">{eyebrow}</p> : null}
          <h2 id="where-it-goes-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[34px]">
            {title}
          </h2>
        </div>
        {!cause.verified ? (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-marigold-100 px-3 py-1 font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-umber">
            <Info aria-hidden className="size-3.5" /> Illustrative
          </span>
        ) : null}
      </div>

      {cause.showFigures ? (
        <>
          <AllocationBar parts={cause.allocation} label={`Where a gift to ${cause.title} goes`} className="mt-7 [&>div:first-child]:h-[18px]" />

          <div aria-live="polite" className={cn("mt-7 overflow-hidden rounded-[22px] transition-[background-color] duration-500", live ? "bg-sand" : "bg-paper")}>
            {live && state ? (
              <div className="p-5 sm:p-6">
                <p className="flex flex-wrap items-center gap-x-2 font-grotesk text-[14px] font-medium text-umber">
                  Your <strong className="font-display text-[26px] font-normal leading-none tracking-[0.01em] text-ink">{moneyExact(total, currency)}</strong>
                  <ArrowRight aria-hidden className="size-4" />
                </p>
                <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                  {splitOf(cause, total, currency).map((p, i) => (
                    <li key={`${p.label}-${i}`} className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-2.5">
                      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", FILL[p.tone ?? ORDER[i % ORDER.length]])} />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{p.label}</span>
                      <span className="font-grotesk text-[14px] font-semibold tabular-nums text-ink">{p.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="px-5 py-4 font-grotesk text-[14px] text-body sm:px-6">Choose an amount in the donation card and you&rsquo;ll see exactly what it becomes, line by line.</p>
            )}
          </div>

          <p className="mt-5 font-grotesk text-[13px] leading-relaxed text-body">
            {year ? `Based on our ${year} programme budget.` : "Based on our current programme budget."}
            {updated ? ` Updated ${updated}.` : ""}
            {!cause.verified && note ? ` ${note}` : ""}
          </p>
        </>
      ) : (
        <>
          <p className="mt-5 text-[16px] leading-relaxed text-body">Gifts to this cause are spent on:</p>
          <ul className="mt-4 grid gap-2.5">
            {cause.allocation.map((p, i) => (
              <li key={`${p.label}-${i}`} className="flex items-start gap-3">
                <span aria-hidden className={cn("mt-2 size-2.5 shrink-0 rounded-full", FILL[p.tone ?? ORDER[i % ORDER.length]])} />
                <span>
                  <span className="text-[16px] font-bold text-ink">{p.label}</span>
                  {p.note ? <span className="block text-[15px] text-body">{p.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 font-grotesk text-[13px] text-body">Our finance team publishes the exact split once it has been confirmed.</p>
        </>
      )}
    </section>
  );
}
