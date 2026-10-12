import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

export type VisionMissionCard = { label: string; text: string };

const TONE = [
  { card: "bg-forest", rule: "bg-marigold", glow: "bg-marigold/15" },
  { card: "bg-clay-700", rule: "bg-marigold-100", glow: "bg-sand/15" },
] as const;

/**
 * Vision and Mission on /about (public-pages §3.2.3): two large cards side by side (stacked on
 * phones) on vu-cream, an Anton label, the statement as a big quote, and a Caveat marigold opening
 * quote mark. The pair reveals with a stagger. Clay uses clay-700 so the 22px quote passes AA.
 */
export function VisionMission({ cards, className }: { cards: [VisionMissionCard, VisionMissionCard]; className?: string }) {
  return (
    <section aria-labelledby="vision-mission-title" className={cn("relative overflow-hidden bg-vu-cream py-20 md:py-28", className)}>
      <h2 id="vision-mission-title" className="sr-only">
        Our vision and mission
      </h2>
      <div className="wrap">
        <Reveal stagger={0.16} y={40} className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {cards.map((c, i) => {
            const t = TONE[i];
            return (
              <figure key={c.label} className={cn("relative isolate flex flex-col overflow-hidden rounded-card-lg px-7 pb-10 pt-9 text-white shadow-earth sm:px-10 md:px-12 md:pb-14 md:pt-12", t.card)}>
                <span aria-hidden className={cn("absolute -right-16 -top-16 -z-10 size-56 rounded-full", t.glow)} />
                <figcaption className="flex items-center gap-4">
                  <span className="font-display text-[34px] uppercase leading-none tracking-[0.02em] md:text-[44px]">{c.label}</span>
                  <span aria-hidden className={cn("h-[3px] w-12 rounded-full", t.rule)} />
                </figcaption>
                <span aria-hidden className="mt-6 block h-10 font-script text-[96px] font-bold leading-[0.8] text-marigold md:h-12 md:text-[120px]">
                  &ldquo;
                </span>
                <blockquote className="mt-2 text-[20px] font-semibold leading-[1.55] md:text-[24px]">
                  <p>{c.text}</p>
                </blockquote>
              </figure>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
