import Image from "next/image";
import { Brush } from "@/components/art/Brush";
import { Counter } from "@/components/ui/Counter";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { DonatHeading } from "@/components/ui/SectionHeading";
import type { HomeView } from "@/lib/content/types";

/**
 * The founder on /about (public-pages §3.2.6): the landing Founder section's layout (years of
 * service, the photo and the quote card) without its "Our Story" button, which would link to this
 * very page, plus the founder's biography paragraphs when Haven supplies them (CLIENT §18).
 */
export function FounderNote({ founder, bio }: { founder: HomeView["founder"]; bio: string[] }) {
  return (
    <section aria-labelledby="founder-title" className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className="wrap grid items-center gap-14 lg:grid-cols-[0.95fr_1.25fr]">
        <Reveal stagger={0.1}>
          <Eyebrow lines="right" tone="ink">
            {founder.eyebrow}
          </Eyebrow>
          <DonatHeading id="founder-title" lines={founder.titleLines} className="mt-4" />
          <p className="mt-6 max-w-[500px] text-[16px] leading-[1.8] text-body md:text-[17px]">{founder.text}</p>
          {bio.map((p) => (
            <p key={p.slice(0, 32)} className="mt-4 max-w-[500px] text-[16px] leading-[1.8] text-body">
              {p}
            </p>
          ))}
        </Reveal>

        <div className="relative grid grid-cols-[auto_1fr] items-center gap-6 md:gap-10">
          <Reveal className="flex flex-col items-center" x={-30} y={0}>
            <p className="flex rotate-180 items-end gap-2 [writing-mode:vertical-rl]">
              <span className="text-[18px] font-semibold text-marigold-ink">Years of</span>
              <span className="text-[34px] font-semibold leading-none text-ink/80">Service</span>
            </p>
            <p className="mt-3 text-[64px] font-extrabold leading-none text-ink/80 md:text-[76px]">
              <Counter value={founder.yearsOfService} duration={1.6} />
            </p>
          </Reveal>

          <div className="relative">
            <Brush name="splash" color="var(--color-mist)" className="absolute -right-[8%] -top-[16%] w-[70%]" rotate={-10} />
            <Brush name="strokes" color="var(--color-mist)" className="absolute -bottom-[14%] right-[-10%] w-[46%]" rotate={30} />
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
            <Reveal y={30} delay={0.25} className="relative -mt-24 w-[300px] max-w-[85%] rounded-[24px] bg-white p-7 shadow-float md:absolute md:-bottom-10 md:-left-10 md:mt-0">
              <figure>
                <figcaption className="flex items-start justify-between">
                  <span>
                    <span className="block text-[21px] font-semibold text-ink">{founder.quoteName}</span>
                    <span className="block text-[13px] font-semibold text-forest">{founder.quoteRole}</span>
                  </span>
                  <span aria-hidden className="font-sans text-[54px] font-black leading-[0.7] text-marigold">
                    &rdquo;
                  </span>
                </figcaption>
                <blockquote className="mt-4 text-[15px] leading-[1.75] text-body">
                  <p>&ldquo;{founder.quote}&rdquo;</p>
                </blockquote>
              </figure>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
