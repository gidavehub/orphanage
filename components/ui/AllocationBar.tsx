"use client";

import { useInView } from "@/lib/motion/useInView";
import { money } from "@/lib/money";
import type { Currency } from "@/lib/model/enums";
import type { AllocationTone } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type AllocationPart = {
  label: string;
  percent: number;
  /** Segment colour (D56 `AllocationPart.tone`); `coral` paints coral-800 so it holds 3:1 beside white. */
  tone?: AllocationTone;
  note?: string;
};

export type AllocationBarProps = {
  parts: AllocationPart[];
  /** With an amount (major units), each legend row shows the money ("GMD 1,500 · school fees"). */
  amount?: { value: number; currency: Currency };
  /** Accessible name of the breakdown (also the hidden table's caption). */
  label?: string;
  className?: string;
};

const fill: Record<AllocationTone, string> = {
  forest: "bg-forest",
  marigold: "bg-marigold",
  clay: "bg-clay",
  cocoa: "bg-cocoa",
  coral: "bg-coral-800",
  umber: "bg-umber",
  deep: "bg-deep",
};
const ORDER: AllocationTone[] = ["forest", "marigold", "clay", "cocoa", "coral", "deep", "umber"];

const pct = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/**
 * "Where your money goes" (design-system §3.6): a 14px pill of segments with 2px white gaps that
 * fills from the left in view, and a legend with labels beside their numbers (no hover-only
 * tooltips). Also renders a visually hidden table for screen readers.
 */
export function AllocationBar({ parts, amount, label = "Where the money goes", className }: AllocationBarProps) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -8% 0px" });
  // Widths scale down only when the parts add up to more than 100 (rounding); a shortfall shows as track.
  const scale = Math.max(100, parts.reduce((s, p) => s + Math.max(0, p.percent), 0));
  const items = parts.map((p, i) => ({ ...p, tone: p.tone ?? ORDER[i % ORDER.length], share: (Math.max(0, p.percent) / scale) * 100 }));

  return (
    <figure className={cn("m-0", className)}>
      <div ref={ref} aria-hidden className="flex h-[14px] w-full gap-[2px] overflow-hidden rounded-full bg-pebble">
        {items.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            className={cn(
              "h-full origin-left transition-transform duration-[1.4s] ease-out-expo first:rounded-l-full last:rounded-r-full motion-reduce:transition-none",
              fill[p.tone],
            )}
            style={{ width: `${p.share}%`, transform: inView ? "scaleX(1)" : "scaleX(0)", transitionDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      <ul aria-hidden className="mt-5 grid gap-3">
        {items.map((p, i) => (
          <li key={`${p.label}-${i}`} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-baseline gap-x-3">
            <span className={cn("size-3 translate-y-[1px] rounded-full", fill[p.tone])} />
            <span className="min-w-0">
              <span className="text-[15px] font-bold text-ink">{p.label}</span>
              {amount ? (
                <span className="block font-grotesk text-[13px] tabular-nums text-body">{money((amount.value * p.percent) / 100, amount.currency)}</span>
              ) : null}
              {p.note ? <span className="block text-[14px] leading-snug text-body">{p.note}</span> : null}
            </span>
            <span className="font-grotesk text-[15px] font-semibold tabular-nums text-ink">{pct.format(p.percent)}%</span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Use</th>
            <th scope="col">Share</th>
            {amount ? <th scope="col">Amount</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={`${p.label}-${i}`}>
              <th scope="row">
                {p.label}
                {p.note ? `. ${p.note}` : ""}
              </th>
              <td>{pct.format(p.percent)}%</td>
              {amount ? <td>{money((amount.value * p.percent) / 100, amount.currency)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
