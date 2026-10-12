import Image from "next/image";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Accordion } from "@/components/ui/Accordion";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import { Brush } from "@/components/art/Brush";
import { ColorHands } from "@/components/art/Hands";
import { HeartClipDef } from "@/components/art/Decor";
import { MoreLink } from "@/components/public/home/MoreLink";
import type { HomeView } from "@/lib/content/types";
import { routes } from "@/lib/routes";

type Props = { section: HomeView["faq"]["section"]; faq: HomeView["faq"]["items"] };

/** Donat FAQ: brush-edged photo, B&W inset, colourful hands, heart-cropped photo, accordion (first question open). */
export function Faq({ section, faq }: Props) {
  const { main, inset, heart } = section.media;
  const pos = (i: { objectPosition?: string }) => (i.objectPosition ? { objectPosition: i.objectPosition } : undefined);

  return (
    <section id="faq" aria-labelledby="faq-title" className="relative overflow-hidden bg-white py-20 md:py-28 cv-auto">
      <HeartClipDef id="heart-clip" />
      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        {/* Collage bleeding off the left edge */}
        <Reveal x={-40} y={0} className="relative h-[520px] md:h-[640px]">
          <div className="absolute inset-y-0 left-0 w-[88%]">
            <Image src={main.src} alt={main.alt} fill sizes="50vw" style={pos(main)} className="object-cover" />
            <Brush name="edge" color="#fff" className="absolute -right-[2px] top-0 h-full w-auto" style={{ aspectRatio: "458 / 820" }} />
            {main.illustrative ? <ImageCredit position="top-left" className="z-[3]" /> : null}
          </div>
          <div className="absolute bottom-0 right-[4%] aspect-square w-[46%] overflow-hidden rounded-[40px] border-[8px] border-white">
            <Image src={inset.src} alt={inset.alt} fill sizes="25vw" style={pos(inset)} className="object-cover grayscale" />
            {inset.illustrative ? <ImageCredit position="static" className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap" /> : null}
          </div>
          <ColorHands className="absolute right-[6%] top-[28%] w-[120px] md:w-[140px]" />
        </Reveal>

        <div className="relative px-4 lg:pr-[max(16px,calc((100vw-1330px)/2+24px))]">
          <div className="absolute -right-2 top-4 hidden aspect-square w-[170px] animate-levitate-slow xl:block" style={{ clipPath: "url(#heart-clip)" }}>
            <Image src={heart.src} alt="" fill sizes="170px" style={pos(heart)} className="object-cover grayscale" />
          </div>

          <Reveal>
            <Eyebrow lines="right">{section.eyebrow}</Eyebrow>
            <DonatHeading id="faq-title" lines={section.lines} className="mt-4 max-w-[560px]" />
          </Reveal>

          <Reveal className="mt-10 max-w-[680px]">
            <Accordion items={faq.map((f) => ({ id: f.id, title: f.q, content: f.a }))} defaultOpen={faq[0] ? [faq[0].id] : []} />
          </Reveal>

          <div className="mt-8 flex max-w-[680px] justify-center lg:justify-start">
            <MoreLink href={routes.faq()}>See All Questions</MoreLink>
          </div>
        </div>
      </div>
    </section>
  );
}
