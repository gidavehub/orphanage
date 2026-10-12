import { VuHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { StatCard } from "@/components/ui/cards/StatCard";
import type { HomeView } from "@/lib/content/types";
import { routes } from "@/lib/routes";

/**
 * Voices United "Our Impact in Action": tall count-up cards in earth tones, on warm cream. The three
 * figures are stats referenced by id (D45); unverified ones carry the "Illustrative" chip and the
 * placeholder note until launch (D46).
 */
export function Impact({ impact }: { impact: HomeView["impact"] }) {
  return (
    <section id="impact" aria-labelledby="impact-title" className="bg-vu-cream pb-24 pt-8 md:pb-32 cv-auto">
      <div className="wrap">
        <Reveal className="text-center">
          <VuHeading id="impact-title" parts={impact.title} className="text-ink" />
          <p className="mx-auto mt-5 max-w-[520px] font-grotesk text-[16px] leading-relaxed text-ink/75">{impact.text}</p>
        </Reveal>

        <Reveal stagger={0.14} y={60} className="mt-14 grid gap-5 md:grid-cols-3">
          {impact.stats.map((s) => (
            <StatCard
              key={s.id}
              label={s.label}
              value={s.value}
              suffix={s.suffix}
              note={s.note}
              tone={s.tone}
              illustrative={s.placeholder}
              contrast="landing"
            />
          ))}
        </Reveal>
        {impact.showNote ? <p className="mt-6 text-center font-grotesk text-[12px] text-ink/65">{impact.placeholderNote}</p> : null}
        <div className="mt-8 flex justify-center">
          <Button href={routes.impact()} variant="vu-outline" icon="none" size="lg" className="min-w-[200px]">
            See Our Full Impact
          </Button>
        </div>
      </div>
    </section>
  );
}
