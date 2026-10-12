import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

export type StepCardItem = { title: string; text?: string };

/**
 * Numbered process cards (public-pages §3.5.3 "What happens after you ask"). An ordered list, so the
 * numbers are announced by the list itself; the big numerals are decoration. `dark` is for the clay
 * and deep bands, `light` for paper and white.
 */
export function StepCards({ items, surface = "dark", className }: { items: StepCardItem[]; surface?: "dark" | "light"; className?: string }) {
  const dark = surface === "dark";
  const cols = items.length >= 5 ? "lg:grid-cols-5" : items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <Reveal as="ol" stagger={0.08} y={30} className={cn("grid gap-4 sm:grid-cols-2", cols, className)}>
      {items.map((s, i) => (
        <li
          key={s.title}
          className={cn(
            "relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 overflow-hidden rounded-card p-5 sm:flex sm:flex-col sm:p-6 md:p-7",
            dark ? "border border-white/15 bg-clay-700 shadow-[0_18px_40px_-24px_rgba(6,21,18,0.6)]" : "bg-white shadow-card",
            i === items.length - 1 && items.length % 2 === 1 ? "sm:col-span-2 lg:col-span-1" : undefined,
          )}
        >
          <span aria-hidden className={cn("row-span-2 font-display text-[38px] leading-none tracking-[0.01em] sm:text-[46px]", dark ? "text-marigold-100" : "text-marigold-ink")}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span aria-hidden className={cn("mt-4 hidden h-[2px] w-9 sm:block", dark ? "bg-white/50" : "bg-marigold")} />
          <h3 className={cn("self-center text-[17px] font-extrabold leading-snug sm:mt-4 sm:self-auto", dark ? "text-white" : "text-ink")}>{s.title}</h3>
          {s.text ? <p className={cn("col-start-2 mt-1 text-[15px] leading-relaxed sm:mt-2", dark ? "text-white" : "text-body")}>{s.text}</p> : null}
        </li>
      ))}
    </Reveal>
  );
}
