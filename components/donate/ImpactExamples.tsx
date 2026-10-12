"use client";

import { Check } from "lucide-react";
import { plainNumber } from "@/lib/money";
import { cn } from "@/lib/cn";
import { useDonateContext } from "./DonateStateProvider";
import { amountOf, presetsFor, type WidgetCause } from "./model";

const TONES = [
  { card: "bg-sand", amount: "text-umber", ring: "ring-umber/40" },
  { card: "bg-mint", amount: "text-forest-700", ring: "ring-forest/40" },
  { card: "bg-marigold-100", amount: "text-umber", ring: "ring-umber/40" },
  { card: "bg-clay-100", amount: "text-clay-700", ring: "ring-clay/40" },
];

/**
 * "What Your Gift Can Do" (public-pages §4.5.2): a row of cards with the amount in Anton and the
 * outcome in Inter. Choosing one sets that amount and currency in the widget (on phones the page also
 * scrolls back to it).
 */
export function ImpactExamples({ cause, eyebrow, title, intro }: { cause: WidgetCause; eyebrow?: string; title: string; intro?: string }) {
  const ctx = useDonateContext();
  if (cause.impactUnits.length === 0) return null;
  const state = ctx?.state;
  const value = state ? amountOf(state) : 0;

  return (
    <section aria-labelledby="examples-title">
      {eyebrow ? <p className="font-script text-[22px] font-bold leading-none text-marigold-ink md:text-[24px]">{eyebrow}</p> : null}
      <h2 id="examples-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[34px]">
        {title}
      </h2>
      {intro ? <p className="mt-3 max-w-[560px] text-[16px] leading-relaxed text-body">{intro}</p> : null}
      <ul className={cn("mt-7 grid gap-3", cause.impactUnits.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {cause.impactUnits.map((u, i) => {
          const t = TONES[i % TONES.length];
          const on = !!state && state.mode === "cash" && state.currency === u.currency && value === u.amount;
          return (
            <li key={`${u.currency}-${u.amount}-${i}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => ctx?.dispatch({ type: "example", amount: u.amount, currency: u.currency, preset: presetsFor(cause, ctx.config, u.currency).includes(u.amount) })}
                className={cn(
                  "group relative flex h-full w-full flex-col items-start rounded-card p-5 text-left transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  t.card,
                  on && cn("ring-2", t.ring),
                )}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className={cn("font-display text-[40px] uppercase leading-none tracking-[0.01em]", t.amount)}>
                    <span className="mr-1 font-grotesk text-[14px] font-semibold tracking-normal">{u.currency}</span>
                    {plainNumber.format(u.amount)}
                  </span>
                  <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full bg-white/80 transition-opacity", on ? "opacity-100" : "opacity-0 group-hover:opacity-60")}>
                    <Check className="size-4 text-ink" strokeWidth={3} />
                  </span>
                </span>
                <span className="mt-3 font-grotesk text-[15px] leading-snug text-ink">{u.label.charAt(0).toUpperCase() + u.label.slice(1)}</span>
                <span className="mt-auto pt-4 font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70 group-hover:text-ink">Give this</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
