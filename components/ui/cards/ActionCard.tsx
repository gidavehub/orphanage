import Image from "next/image";
import { Brush } from "@/components/art/Brush";
import { Button } from "../Button";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type ActionCardProps = {
  title: string;
  text: string;
  cta: string;
  href: string;
  /** Shown in grayscale under a tinted veil; always decorative. */
  image: UiImage;
  tone: "forest" | "charcoal" | "clay";
  /** Brush stroke angle (the landing pair uses 20 and −14). */
  brushRotate?: number;
  /**
   * `aa` (default): the charcoal card's button carries night text on marigold.
   * `landing`: the approved landing pairing (white on marigold), for the home Duo only.
   */
  contrast?: "aa" | "landing";
  headingLevel?: 2 | 3;
  sizes?: string;
  className?: string;
};

// Veils keep white text at AA even over a bright photo (clay uses clay-700: 5.5:1 worst case).
const veil = { forest: "bg-forest/88", charcoal: "bg-charcoal-veil", clay: "bg-clay-700/90" } as const;
const stroke = { forest: "var(--color-deep)", charcoal: "var(--color-marigold)", clay: "var(--color-umber)" } as const;

/**
 * The landing Duo photo card (design-system §3.7; D120 DuoCard): a grayscale photo under a tinted
 * veil, brush strokes sweeping in on hover, a big title and one button. Used for the programme
 * "Request support / Support this programme" pair and on Get Involved.
 */
export function ActionCard({
  title,
  text,
  cta,
  href,
  image,
  tone,
  brushRotate = 20,
  contrast = "aa",
  headingLevel = 3,
  sizes = "(min-width:768px) 50vw, 100vw",
  className,
}: ActionCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <article className={cn("group relative isolate overflow-hidden rounded-card px-8 py-14 text-center text-white md:px-12", className)}>
      <Image
        src={image.src}
        alt=""
        fill
        sizes={sizes}
        className="-z-20 object-cover grayscale transition-transform duration-[1.4s] ease-out-expo group-hover:scale-110"
      />
      <div className={cn("absolute inset-0 -z-10", veil[tone])} />
      {/* Brush strokes sweep in from the right on hover */}
      <Brush
        name="strokes"
        color={stroke[tone]}
        rotate={brushRotate}
        className="absolute -bottom-16 -right-10 -z-10 w-[62%] opacity-90 transition-transform duration-700 ease-out-expo group-hover:-translate-x-6 group-hover:-translate-y-3"
      />
      <Heading className="text-[30px] font-extrabold md:text-[36px]">{title}</Heading>
      <p className={cn("mx-auto mt-4 max-w-[480px] text-[16px] leading-[1.75]", contrast === "landing" ? "text-white/90" : "text-white")}>{text}</p>
      <div className="mt-8">
        {tone === "charcoal" ? (
          <Button href={href} variant={contrast === "landing" ? "marigold" : "marigold-ink"}>
            {cta}
          </Button>
        ) : (
          <Button href={href} variant={contrast === "landing" ? "white" : "white-ink"} icon="arrow-right">
            {cta}
          </Button>
        )}
      </div>
    </article>
  );
}
