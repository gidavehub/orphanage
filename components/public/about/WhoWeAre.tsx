import Image from "next/image";
import { Brush } from "@/components/art/Brush";
import { BrushReveal } from "@/components/art/BrushReveal";
import { HeartCluster } from "@/components/art/Decor";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { DonatHeading } from "@/components/ui/SectionHeading";
import type { UiImage } from "@/lib/model/ui";

export type WhoWeAreProps = {
  eyebrow: string;
  title: string[];
  paragraphs: string[];
  image: UiImage & { objectPosition?: string };
  actions: Array<{ label: string; href: string }>;
};

/**
 * "Who we are" on /about (public-pages §3.2.2): the landing About split reused (grey strokes, the
 * forest frame with its marigold segment and the brush-cut photo), with the About page's own copy
 * and no values checklist (the values have their own section further down).
 */
export function WhoWeAre({ eyebrow, title, paragraphs, image, actions }: WhoWeAreProps) {
  const [primary, secondary] = actions;
  return (
    <section id="who-we-are" aria-labelledby="who-title" className="relative overflow-hidden bg-white py-20 md:py-28">
      <HeartCluster className="absolute right-[6%] top-16 hidden w-[150px] text-mist lg:block" />

      <div className="wrap grid items-center gap-14 lg:grid-cols-[1.02fr_1fr] lg:gap-20">
        {/* The painted patch's ink fills x 11.6–96.1% / y 10.1–88.3% of its box, so the box is sized to
            land the photo over the frame, which then reads as an offset outline (as on the landing). */}
        <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[560px]">
          <BrushReveal name="strokes" color="var(--color-mist)" className="absolute -left-[12%] -top-[8%] w-[70%] -rotate-[8deg]" duration={1.6} />
          <Reveal className="absolute bottom-[-6%] left-[6%] right-[22%] top-[16%]" y={30}>
            <div className="relative size-full rounded-[44px] border-[14px] border-forest">
              <span aria-hidden className="absolute -bottom-[14px] left-[18%] h-[14px] w-[40%] bg-marigold" />
            </div>
          </Reveal>
          <BrushReveal name="patch" direction="up" className="absolute bottom-[-13%] left-[-1%] right-[12%] top-[-2%]" duration={1.8} delay={0.2}>
            <div className="relative size-full">
              <Image
                src={image.src}
                alt={image.decorative ? "" : image.alt}
                fill
                sizes="(min-width:1024px) 560px, 90vw"
                style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
                className="object-cover"
              />
              {image.illustrative ? <ImageCredit position="static" className="absolute bottom-[17%] left-[17%]" /> : null}
            </div>
          </BrushReveal>
          <Brush name="drip" color="var(--color-marigold)" className="absolute -right-2 top-[2%] w-[18%] opacity-90" rotate={-20} />
        </div>

        <Reveal stagger={0.1}>
          <Eyebrow lines="right" tone="ink">
            {eyebrow}
          </Eyebrow>
          <DonatHeading id="who-title" lines={title} className="mt-4" />
          {paragraphs.map((p) => (
            <p key={p.slice(0, 32)} className="mt-5 max-w-[580px] text-[16px] leading-[1.8] text-body md:text-[17px]">
              {p}
            </p>
          ))}
          {primary ? (
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button href={primary.href} variant="forest" size="lg" className="max-sm:w-full">
                {primary.label}
              </Button>
              {secondary ? (
                <Button href={secondary.href} variant="outline" size="lg" icon="none" className="max-sm:w-full">
                  {secondary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
