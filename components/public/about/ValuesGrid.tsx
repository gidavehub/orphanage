import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

export type ValueItem = { title: string; text?: string };

// forest → marigold → clay → cocoa → deep → coral → umber (public-pages §3.2.4). Coral uses coral-800
// and marigold carries night text, so every description passes AA.
const TONES = [
  { card: "bg-forest text-white", rule: "bg-marigold", text: "text-white" },
  { card: "bg-marigold text-night", rule: "bg-night/70", text: "text-night" },
  { card: "bg-clay-700 text-white", rule: "bg-marigold-100", text: "text-white" },
  { card: "bg-cocoa text-white", rule: "bg-marigold", text: "text-white" },
  { card: "bg-deep text-white", rule: "bg-marigold", text: "text-white" },
  { card: "bg-coral-800 text-white", rule: "bg-marigold-100", text: "text-white" },
  { card: "bg-umber text-white", rule: "bg-marigold", text: "text-white" },
] as const;

/**
 * "Our Values" tiles (public-pages §3.2.4): StatCard-shaped, no numbers, the value in Anton and a
 * one-line description. Two per row on phones and four from lg, every short last row centred.
 */
export function ValuesGrid({ values, className }: { values: ValueItem[]; className?: string }) {
  return (
    <Reveal as="ul" stagger={0.07} y={30} className={cn("flex flex-wrap justify-center gap-3 sm:gap-5", className)}>
      {values.map((v, i) => {
        const t = TONES[i % TONES.length];
        return (
          <li
            key={v.title}
            className={cn(
              "group relative flex min-h-[170px] basis-[calc(50%-6px)] flex-col overflow-hidden rounded-card px-4 pb-6 pt-6 sm:basis-[calc(50%-10px)] sm:px-7 sm:pb-8 sm:pt-8 md:basis-[calc(33.333%-14px)] lg:basis-[calc(25%-15px)]",
              "transition-transform duration-500 ease-out-expo hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              t.card,
            )}
          >
            <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 size-32 rounded-full bg-white/[0.07] transition-transform duration-700 ease-out-expo group-hover:scale-125" />
            <h3 className="break-words font-display text-[clamp(17px,5.2vw,24px)] uppercase leading-[1.05] tracking-[0.02em] [hyphens:auto] md:text-[28px]" lang="en">
              {v.title}
            </h3>
            <span aria-hidden className={cn("mt-3 block h-[2px] w-9", t.rule)} />
            {v.text ? <p className={cn("mt-3 text-[14px] leading-relaxed sm:text-[15px]", t.text)}>{v.text}</p> : null}
          </li>
        );
      })}
    </Reveal>
  );
}
