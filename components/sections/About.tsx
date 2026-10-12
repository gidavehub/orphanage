import Image from "next/image";
import { Check } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { Brush } from "@/components/art/Brush";
import { BrushReveal } from "@/components/art/BrushReveal";
import { HeartCluster } from "@/components/art/Decor";
import { cn } from "@/lib/cn";
import type { HomeView } from "@/lib/content/types";

const tone = {
  forest: "bg-forest",
  marigold: "bg-marigold",
  flame: "bg-flame",
  night: "bg-night",
} as const;

/** Donat "We Believe That We Can Save More Life's" → Who We Are. */
export function About({ about }: { about: HomeView["about"] }) {
  return (
    <section id="about" aria-labelledby="about-title" className="relative overflow-hidden bg-white py-24 md:py-32 cv-auto">
      <HeartCluster className="absolute right-[6%] top-16 hidden w-[150px] text-[#f1f1f0] lg:block" />

      <div className="wrap grid items-center gap-16 lg:grid-cols-[1.02fr_1fr] lg:gap-20">
        {/* ── Visual: grey strokes, green frame w/ marigold segment, brush-cut photo ──
            The patch ink fills x 11.6–96.1% / y 10.1–88.3% of its box (public/brush/patch.svg), so the
            box is sized to land the painted photo over the frame: x ≈ 9–85%, y ≈ 10–100% of the square.
            The frame then reads as an offset outline along the left and bottom. */}
        <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[600px]">
          <BrushReveal name="strokes" color="#e6e6e4" className="absolute -left-[12%] -top-[8%] w-[70%] -rotate-[8deg]" duration={1.6} />
          <Reveal className="absolute bottom-[-6%] left-[6%] right-[22%] top-[16%]" y={30}>
            <div className="relative size-full rounded-[44px] border-[14px] border-forest">
              <span aria-hidden className="absolute -bottom-[14px] left-[18%] h-[14px] w-[40%] bg-marigold" />
            </div>
          </Reveal>
          <BrushReveal name="patch" direction="up" className="absolute bottom-[-13%] left-[-1%] right-[12%] top-[-2%]" duration={1.8} delay={0.2}>
            <div className="relative size-full">
              <Image
                src={about.image.src}
                alt={about.image.alt}
                fill
                sizes="(min-width:1024px) 600px, 90vw"
                style={about.image.objectPosition ? { objectPosition: about.image.objectPosition } : undefined}
                className="object-cover"
              />
              {/* Inside the painted patch (its ink spans x 11.6–96.1%, y 10.1–88.3%), clear of the ragged edge. */}
              {about.image.illustrative ? <ImageCredit position="static" className="absolute bottom-[17%] left-[17%]" /> : null}
            </div>
          </BrushReveal>
          <Brush name="drip" color="var(--color-marigold)" className="absolute -right-2 top-[2%] w-[18%] opacity-90" rotate={-20} />
        </div>

        {/* ── Copy ── */}
        <Reveal stagger={0.1}>
          <Eyebrow lines="right">{about.eyebrow}</Eyebrow>
          <DonatHeading id="about-title" lines={about.titleLines} className="mt-4" />
          {about.body.map((p) => (
            <p key={p.slice(0, 20)} className="mt-5 max-w-[560px] text-[16px] leading-[1.8] text-body">
              {p}
            </p>
          ))}
          <ul className="mt-8 grid max-w-[520px] grid-cols-2 gap-x-6 gap-y-4">
            {about.values.map((v) => (
              <li key={v.label} className="flex items-center gap-3 text-[17px] font-semibold text-ink">
                <span className={cn("grid size-[22px] shrink-0 place-items-center rounded-full text-white", tone[v.tone])}>
                  <Check strokeWidth={3.5} className="size-3" />
                </span>
                {v.label}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-2xl border-l-4 border-marigold bg-cream px-5 py-4 text-[15px] leading-relaxed text-ink/85">
            <span className="font-extrabold text-forest">{about.visionLabel} </span>
            {about.vision}
          </div>
          <div className="mt-9">
            <Button href={about.cta.href} variant="forest" size="lg">
              {about.cta.label}
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
