import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { ProgrammeCard } from "@/components/ui/cards/ProgrammeCard";
import { HandsLineArt } from "@/components/art/Hands";
import type { HomeView } from "@/lib/content/types";

type Props = { section: HomeView["programmes"]["section"]; programmes: HomeView["programmes"]["items"] };

/** Donat "Humanist Services" → Haven's six programmes (ToR §3 highlights). Each card opens its programme page. */
export function Programmes({ section, programmes }: Props) {
  return (
    <section id="programmes" aria-labelledby="programmes-title" className="paper relative overflow-hidden pb-24 pt-24 md:pb-32 md:pt-28 cv-auto">
      <HandsLineArt className="absolute -left-16 top-10 hidden w-[330px] md:block xl:left-0 xl:w-[360px]" />

      <div className="wrap relative">
        <Reveal className="text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <DonatHeading as="h2" lines={section.lines} className="mt-4" id="programmes-title" />
        </Reveal>

        <Reveal stagger={0.12} className="mt-24 grid gap-x-7 gap-y-24 md:grid-cols-2 xl:grid-cols-3">
          {programmes.map((p) => (
            <ProgrammeCard
              key={p.id}
              programme={p.id}
              title={p.title}
              summary={p.summary}
              notice={p.notice}
              href={p.href}
              cta={section.cardCta}
              contrast="landing"
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
