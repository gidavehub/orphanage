import Image from "next/image";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { Badge } from "../Badge";
import { ImageCredit } from "../ImageCredit";
import { CardLink, CARD_FOCUS_RING } from "./Card";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type UpdateCardProps = {
  title: string;
  /** Display date ("12 October 2026"). */
  date: string;
  dateTime?: string;
  /** One or two sentences (the update's excerpt). */
  text: string;
  /** Optional thumbnail (updates can be one photo and a few lines). */
  image?: UiImage;
  /** Programme or category label. */
  category?: string;
  href: string;
  headingLevel?: 2 | 3;
  as?: "article" | "li";
  className?: string;
};

/**
 * The compact card for `format: 'update'` posts in /news and the home News section (D43): a marigold
 * "Update" badge, the date, a short title and two lines, with an optional square thumbnail.
 * The whole card is one link.
 */
export function UpdateCard({ title, date, dateTime, text, image, category, href, headingLevel = 3, as: As = "article", className }: UpdateCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <As
      className={cn(
        "group relative flex gap-5 rounded-3xl bg-white p-5 shadow-soft transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover md:p-6",
        CARD_FOCUS_RING,
        className,
      )}
    >
      {image ? (
        <div className="relative hidden aspect-square w-[112px] shrink-0 self-start overflow-hidden rounded-tile sm:block">
          <Image
            src={image.src}
            alt={image.decorative ? "" : image.alt}
            fill
            sizes="112px"
            style={image.focal ? { objectPosition: `${image.focal.x}% ${image.focal.y}%` } : undefined}
            className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-110"
          />
          {image.illustrative ? <ImageCredit position="static" className="absolute bottom-1.5 left-1.5" label="Illustrative" /> : null}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Badge tone="marigold" size="sm" icon={Megaphone}>
            Update
          </Badge>
          <span className="font-grotesk text-[13px] text-body">{dateTime ? <time dateTime={dateTime}>{date}</time> : date}</span>
          {category ? <span className="font-grotesk text-[13px] text-body">· {category}</span> : null}
        </p>
        <Heading className="mt-2.5 text-[17px] font-bold leading-snug text-ink transition-colors group-hover:text-forest">
          <CardLink href={href}>{title}</CardLink>
        </Heading>
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-body">{text}</p>
        <span aria-hidden className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-forest">
          Read update
          <ArrowUpRight className="size-4 text-marigold-ink transition-transform duration-300 group-hover:rotate-45" strokeWidth={2.5} />
        </span>
      </div>
    </As>
  );
}
