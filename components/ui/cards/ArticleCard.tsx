import Image from "next/image";
import { CalendarDays, Tag } from "lucide-react";
import { buttonClassName, ButtonGlyph } from "../Button";
import { ImageCredit } from "../ImageCredit";
import { CardLink, CARD_FOCUS_RING } from "./Card";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type ArticleCardProps = {
  title: string;
  /** Display date ("12 October 2026"). */
  date: string;
  /** ISO date for `<time dateTime>`. */
  dateTime?: string;
  category: string;
  image: UiImage;
  href: string;
  excerpt?: string;
  cta?: string;
  headingLevel?: 2 | 3;
  sizes?: string;
  as?: "article" | "li";
  className?: string;
};

/**
 * The landing News card (design-system §3.7) with explicit props. The whole card is one link (the
 * title is stretched over it); "Read More" is drawn as a button but is part of that same link.
 */
export function ArticleCard({
  title,
  date,
  dateTime,
  category,
  image,
  href,
  excerpt,
  cta = "Read More",
  headingLevel = 3,
  sizes = "(min-width:768px) 33vw, 100vw",
  as: As = "article",
  className,
}: ArticleCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <As className={cn("group relative overflow-hidden rounded-3xl bg-white shadow-[0_20px_50px_-30px_rgba(20,51,43,0.35)]", CARD_FOCUS_RING, className)}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={image.src}
          alt={image.decorative ? "" : image.alt}
          fill
          sizes={sizes}
          placeholder={image.blurDataURL ? "blur" : "empty"}
          blurDataURL={image.blurDataURL}
          style={image.focal ? { objectPosition: `${image.focal.x}% ${image.focal.y}%` } : undefined}
          className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-110"
        />
        {image.illustrative ? <ImageCredit position="bottom-left" /> : null}
      </div>
      <div className="p-7">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-body">
          <span className="flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4 text-marigold" /> {dateTime ? <time dateTime={dateTime}>{date}</time> : date}
          </span>
          <span className="flex items-center gap-1.5">
            <Tag aria-hidden className="size-4 text-marigold" /> {category}
          </span>
        </p>
        <Heading className="mt-3 min-h-[56px] text-[19px] font-semibold leading-snug text-ink transition-colors group-hover:text-forest">
          <CardLink href={href}>{title}</CardLink>
        </Heading>
        {excerpt ? <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-body">{excerpt}</p> : null}
        <div className="mt-5">
          <span aria-hidden className={buttonClassName({ variant: "forest", size: "sm", className: "group-hover:bg-marigold group-hover:text-night" })}>
            <span>{cta}</span>
            <ButtonGlyph icon="arrow" />
          </span>
        </div>
      </div>
    </As>
  );
}
