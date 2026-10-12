import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { AllocationBar } from "@/components/ui/AllocationBar";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import type { CauseView } from "@/lib/content/types";
import { plainNumber } from "@/lib/money";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

const DOT: Record<string, string> = {
  forest: "bg-forest",
  marigold: "bg-marigold",
  clay: "bg-clay",
  cocoa: "bg-cocoa",
  coral: "bg-coral-800",
  umber: "bg-umber",
  deep: "bg-deep",
};
const ORDER = ["forest", "marigold", "clay", "cocoa", "coral", "umber", "deep"];

const CHIP = [
  { card: "bg-sand", amount: "text-umber" },
  { card: "bg-mint", amount: "text-forest-700" },
  { card: "bg-marigold-100", amount: "text-umber" },
];

function asOf(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * "Where your gift goes" on a programme page (public-pages §3.4.10, §4.5; PLAN D56): the programme
 * cause's planned split as a compact allocation bar (a plain list once unverified figures are hidden),
 * and up to three "USD 25 = …" examples, each a link into /donate/<slug> with that amount chosen.
 */
export function GiftPath({ cause, programmeTitle }: { cause: CauseView; programmeTitle: string }) {
  const examples = cause.impactUnits.slice(0, 3);
  const updated = asOf(cause.allocationAsOf);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
      <Reveal y={30} className="relative rounded-card-lg bg-white p-6 shadow-soft sm:p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-script text-[22px] font-bold leading-none text-marigold-ink md:text-[24px]">See it clearly</p>
            <h2 id="gift-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[34px]">
              Where Your Gift Goes
            </h2>
          </div>
          {!cause.verified ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-marigold-100 px-3 py-1 font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-umber">
              <Info aria-hidden className="size-3.5" /> Illustrative
            </span>
          ) : null}
        </div>

        {cause.allocation.length ? (
          cause.showFigures ? (
            <AllocationBar parts={cause.allocation} label={`Where a gift to ${programmeTitle} goes`} className="mt-7" />
          ) : (
            <ul className="mt-6 grid gap-2.5">
              {cause.allocation.map((p, i) => (
                <li key={`${p.label}-${i}`} className="flex items-start gap-3">
                  <span aria-hidden className={cn("mt-2 size-2.5 shrink-0 rounded-full", DOT[p.tone ?? ORDER[i % ORDER.length]])} />
                  <span>
                    <span className="text-[16px] font-bold text-ink">{p.label}</span>
                    {p.note ? <span className="block text-[15px] text-body">{p.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="mt-6 text-[16px] leading-relaxed text-body">{cause.summary}</p>
        )}

        <p className="mt-6 font-grotesk text-[13px] leading-relaxed text-body">
          {cause.showFigures ? "Based on our current programme budget." : "Our finance team publishes the exact split once it has been confirmed."}
          {cause.showFigures && updated ? ` Updated ${updated}.` : ""}
          {cause.showFigures && !cause.verified ? " Percentages are illustrative until our finance team confirms them." : ""}
        </p>
      </Reveal>

      <Reveal y={30} delay={0.1} className="focus-marigold flex flex-col rounded-card-lg bg-deep p-6 text-white sm:p-8 md:p-10">
        <p className="font-script text-[22px] font-bold leading-none text-marigold md:text-[24px]">What your gift can do</p>
        <h3 className="mt-2 text-[24px] font-extrabold leading-tight md:text-[28px]">Give to {programmeTitle}</h3>
        {examples.length ? (
          <ul className="mt-6 grid gap-3">
            {examples.map((u, i) => {
              const t = CHIP[i % CHIP.length];
              return (
                <li key={`${u.currency}-${u.amount}-${i}`}>
                  <Link
                    href={routes.donate(cause.slug, { amount: u.amount, currency: u.currency })}
                    className={cn(
                      "group flex min-h-[64px] items-center gap-4 rounded-[20px] px-4 py-3 text-ink transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-5",
                      t.card,
                    )}
                  >
                    <span className={cn("shrink-0 font-display text-[30px] uppercase leading-none tracking-[0.01em]", t.amount)}>
                      <span className="mr-1 font-grotesk text-[12px] font-semibold tracking-normal">{u.currency}</span>
                      {plainNumber.format(u.amount)}
                    </span>
                    <span className="min-w-0 flex-1 font-grotesk text-[15px] leading-snug">
                      <span className="sr-only">gives </span>
                      {u.label.charAt(0).toUpperCase() + u.label.slice(1)}
                    </span>
                    <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-[16px] leading-relaxed text-white/90">{cause.summary}</p>
        )}
        <div className="mt-auto pt-8">
          <Button href={cause.href} variant="marigold-ink" size="lg" icon="heart" className="w-full sm:w-auto">
            Give to {programmeTitle}
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
