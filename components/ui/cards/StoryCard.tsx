import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { FlagDisc } from "../flag";
import { ImageCredit } from "../ImageCredit";
import { CardLink, CARD_FOCUS_RING } from "./Card";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type StoryCardProps = {
  image: UiImage;
  /** The person, never a child's real name ("A mother in Kanifing"). */
  label: string;
  /** Short context ("Education support"). */
  meta: string;
  place?: { code: string; name: string };
  text: string;
  /** Optional link (a story anchor on /stories). */
  href?: string;
  /** Sizing comes from the parent (the landing uses `w-[78vw] shrink-0 snap-center`). */
  className?: string;
  sizes?: string;
};

/** The landing Stories card (the phone layout of the capsules), with explicit props (design-system §3.7). */
export function StoryCard({ image, label, meta, place, text, href, className, sizes = "80vw" }: StoryCardProps) {
  return (
    <article className={cn("group relative h-[420px] overflow-hidden rounded-[36px]", href && CARD_FOCUS_RING, className)}>
      <Image
        src={image.src}
        alt={image.decorative ? "" : image.alt}
        fill
        sizes={sizes}
        style={image.focal ? { objectPosition: `${image.focal.x}% ${image.focal.y}%` } : undefined}
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(6,21,18,0.85)_100%)]" />
      {image.illustrative ? <ImageCredit position="static" className="absolute left-5 top-5" /> : null}
      {href ? (
        <span aria-hidden className="absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-white/50 bg-white/10 text-white backdrop-blur transition-transform duration-500 group-hover:rotate-45">
          <ArrowUpRight className="size-5" />
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        {place ? (
          <p className="mb-2 flex items-center gap-2 font-grotesk text-[13px] text-white/85">
            <FlagDisc code={place.code} className="size-5 ring-2 ring-white/70" />
            {place.name}
          </p>
        ) : null}
        <p className="font-grotesk text-[20px] font-semibold">{href ? <CardLink href={href}>{label}</CardLink> : label}</p>
        <p className="font-grotesk text-[14px] text-white/80">{meta}</p>
        <p className="mt-2 font-grotesk text-[15px] leading-relaxed text-white/90">{text}</p>
      </div>
    </article>
  );
}
