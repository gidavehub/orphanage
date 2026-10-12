import Image from "next/image";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { Brush } from "@/components/art/Brush";
import type { HomeView } from "@/lib/content/types";

/**
 * Donat "Success Story" block → a word from Haven's founder + years of service. `yearsOfService` comes
 * from the cached site settings (PLAN D15), so the clock is never read during render.
 */
export function Founder({ founder }: { founder: HomeView["founder"] }) {
  const years = founder.yearsOfService;
  return (
    <section aria-labelledby="founder-title" className="relative overflow-hidden bg-white py-24 md:py-32 cv-auto">
      <div className="wrap grid items-center gap-14 lg:grid-cols-[0.95fr_1.25fr]">
        <Reveal stagger={0.1}>
          <Eyebrow lines="right">{founder.eyebrow}</Eyebrow>
          <DonatHeading id="founder-title" lines={founder.titleLines} className="mt-4" />
          <p className="mt-6 max-w-[470px] text-[16px] leading-[1.8] text-body">{founder.text}</p>
          <div className="mt-10">
            <Button href={founder.cta.href} variant="outline" size="lg">
              {founder.cta.label}
            </Button>
          </div>
        </Reveal>

        <div className="relative grid grid-cols-[auto_1fr] items-center gap-6 md:gap-10">
          {/* Years of service — Donat's rotated label + big number */}
          <Reveal className="flex flex-col items-center" x={-30} y={0}>
            <p className="flex rotate-180 items-end gap-2 [writing-mode:vertical-rl]">
              <span className="text-[18px] font-semibold text-marigold">Years of</span>
              <span className="text-[34px] font-semibold leading-none text-ink/80">Service</span>
            </p>
            <p className="mt-3 text-[64px] font-extrabold leading-none text-ink/80 md:text-[76px]">
              <Counter value={years} duration={1.6} />
            </p>
          </Reveal>

          <div className="relative">
            <Brush name="splash" color="#ececec" className="absolute -right-[8%] -top-[16%] w-[70%]" rotate={-10} />
            <Brush name="strokes" color="#ececec" className="absolute -bottom-[14%] right-[-10%] w-[46%]" rotate={30} />
            <Reveal y={40} className="relative ml-auto aspect-[558/450] w-full max-w-[560px] overflow-hidden rounded-[30px]">
              <Image
                src={founder.image.src}
                alt={founder.image.alt}
                fill
                sizes="(min-width:1024px) 560px, 90vw"
                style={founder.image.objectPosition ? { objectPosition: founder.image.objectPosition } : undefined}
                className="object-cover"
              />
              {founder.image.illustrative ? <ImageCredit position="top-right" /> : null}
            </Reveal>
            <Reveal
              y={30}
              delay={0.25}
              className="relative -mt-24 w-[300px] max-w-[85%] rounded-[24px] bg-white p-7 shadow-[0_24px_60px_-28px_rgba(6,21,18,0.35)] md:absolute md:-bottom-10 md:-left-10 md:mt-0"
            >
              <div className="flex items-start justify-between">
                <p className="text-[21px] font-semibold text-ink">{founder.quoteName}</p>
                <span aria-hidden className="font-sans text-[54px] font-black leading-[0.7] text-marigold">”</span>
              </div>
              <p className="text-[13px] font-semibold text-forest">{founder.quoteRole}</p>
              <p className="mt-4 text-[15px] leading-[1.75] text-body">“{founder.quote}”</p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
