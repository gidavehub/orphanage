import Image from "next/image";
import Link from "next/link";
import { CalendarDays, FileText, Lock, Tag } from "lucide-react";
import { maskStyle } from "@/components/art/Brush";
import { Badge } from "../Badge";
import { Button, ButtonGlyph, buttonClassName } from "../Button";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type ResourceCardProps = {
  title: string;
  /** Report cover at 3:4. Without one, a paper tile with a document glyph stands in. */
  cover?: UiImage;
  /** Display date ("March 2026"). */
  date: string;
  dateTime?: string;
  category: string;
  summary: string;
  access: "public" | "request";
  /** File facts for public downloads ("2.4 MB", "PDF"). */
  file?: { size: string; type: string };
  /** The resource page. */
  href: string;
  /** Public: the download route (`/api/resources/<slug>/download`). */
  downloadHref?: string;
  /** On request: the request form (`routes.requestReport(slug)`). */
  requestHref?: string;
  headingLevel?: 2 | 3;
  as?: "article" | "li";
  className?: string;
};

/**
 * A report or resource (design-system §3.7): a 3:4 cover with the category painted on a marigold
 * brush label, the date and category, a 3-line summary, then "Download PDF · 2.4 MB" (public) or
 * an "Available on request" badge and "Request full report" (controlled).
 */
export function ResourceCard({
  title,
  cover,
  date,
  dateTime,
  category,
  summary,
  access,
  file,
  href,
  downloadHref,
  requestHref,
  headingLevel = 3,
  as: As = "article",
  className,
}: ResourceCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <As className={cn("group flex h-full flex-col rounded-card bg-white p-5 shadow-card md:p-6", className)}>
      <Link href={href} tabIndex={-1} aria-hidden className="relative block aspect-[3/4] overflow-hidden rounded-tile bg-paper">
        {cover ? (
          <Image
            src={cover.src}
            alt=""
            fill
            sizes="(min-width:1280px) 300px, (min-width:768px) 45vw, 90vw"
            className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-105"
          />
        ) : (
          <span className="paper absolute inset-0 grid place-items-center">
            <FileText className="size-16 text-forest/40" strokeWidth={1.5} />
          </span>
        )}
        <span className="absolute bottom-2 left-0 max-w-[92%]">
          <span className="relative block min-w-[170px] py-6 pl-6 pr-10">
            <span className="absolute inset-0 bg-marigold" style={maskStyle("label")} />
            <span className="relative block truncate text-[15px] font-bold text-night">{category}</span>
          </span>
        </span>
      </Link>
      <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-body">
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden className="size-4 text-marigold-ink" /> {dateTime ? <time dateTime={dateTime}>{date}</time> : date}
        </span>
        <span className="flex items-center gap-1.5">
          <Tag aria-hidden className="size-4 text-marigold-ink" /> {category}
        </span>
      </p>
      <Heading className="mt-3 text-[19px] font-semibold leading-snug text-ink">
        <Link href={href} className="transition-colors hover:text-forest">
          {title}
        </Link>
      </Heading>
      <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-body">{summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
        {access === "public" ? (
          downloadHref ? (
            // A plain anchor: the download route answers with a redirect to the file, not a page.
            <a href={downloadHref} className={buttonClassName({ variant: "forest", size: "sm" })}>
              <span>
                Download {file?.type ?? "PDF"}
                {file?.size ? <span className="font-grotesk font-medium"> · {file.size}</span> : null}
              </span>
              <ButtonGlyph icon="download" />
            </a>
          ) : null
        ) : (
          <>
            <Badge tone="deep" icon={Lock}>
              Available on request
            </Badge>
            {requestHref ? (
              <Button href={requestHref} variant="outline" size="sm" icon="arrow">
                Request full report
              </Button>
            ) : null}
          </>
        )}
      </div>
    </As>
  );
}
