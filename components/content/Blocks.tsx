import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Notice, type NoticeTone } from "@/components/ui/Notice";
import { Prose } from "@/components/ui/Prose";
import { StatCard, type StatTone } from "@/components/ui/cards/StatCard";
import type { TocItem } from "@/components/ui/Toc";
import { renderInline, type RenderInlineOptions } from "@/lib/content/inline";
import type { Block, Resolved, ResolvedMedia, ResolvedStat } from "@/lib/content/types";
import { routeHref, routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

/**
 * The only renderer of staff-authored long text (PLAN D44; content-model §7.2): programme overview
 * and problem, cause stories, project bodies, policies, team bios, resource summaries and posts.
 * A server component. No HTML is ever rendered from content: InlineText goes through
 * lib/content/inline.ts, images through next/image (with the "Illustrative image" chip, D54), video
 * only as a privacy-enhanced youtube-nocookie iframe. Headings get stable ids for the TOC
 * (`blockToc()` returns the same ids). Figures by id come from `stats` (verified figures only after
 * the before-launch switch, D46); unknown ids render nothing.
 */

export type BlocksProps = {
  blocks: Resolved<Block[]> | readonly Resolved<Block>[];
  /** The stats registry (getStats()) for `{ type: "stat", statId }` blocks. */
  stats?: Record<string, ResolvedStat>;
  /** Wrap in <Prose> (default). Pass false when the parent already provides the prose surface. */
  prose?: boolean;
  size?: "md" | "lg";
  /** Constrain to the reading measure (default true). */
  measure?: boolean;
  /** Prefix for heading ids, so two block lists on one page never share an id. */
  idPrefix?: string;
  className?: string;
};

type AnyBlock = Resolved<Block>;

const inlineOpts: RenderInlineOptions = {
  internalLink: ({ href, className, children }) => (
    <Link href={href} className={className}>
      {children}
    </Link>
  ),
};

function slugify(text: string): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "section";
}

/** Heading ids in document order, de-duplicated ("support", "support-2"). */
function headingIds(blocks: readonly AnyBlock[], prefix = ""): Map<string, string> {
  const seen = new Map<string, number>();
  const ids = new Map<string, string>();
  for (const b of blocks) {
    if (b.type !== "heading") continue;
    const base = `${prefix}${slugify(b.text)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    ids.set(b.id, n === 1 ? base : `${base}-${n}`);
  }
  return ids;
}

/** The table of contents for a block list (policies, long articles): one entry per heading block. */
export function blockToc(blocks: Resolved<Block[]> | readonly Resolved<Block>[], idPrefix = ""): TocItem[] {
  const list = blocks as readonly AnyBlock[];
  const ids = headingIds(list, idPrefix);
  return list.flatMap((b) => (b.type === "heading" ? [{ id: ids.get(b.id) as string, label: b.text, level: b.level }] : []));
}

/** Plain text of a block list, for excerpts, reading time and search snippets. */
export function blocksToPlain(blocks: Resolved<Block[]> | readonly Resolved<Block>[]): string {
  const strip = (t: string) => t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1");
  return (blocks as readonly AnyBlock[])
    .map((b) => {
      switch (b.type) {
        case "paragraph":
        case "heading":
        case "quote":
        case "callout":
          return strip(b.text);
        case "list":
          return b.items.map(strip).join(" ");
        case "image":
          return b.caption ?? "";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
}

function Figure({ media, caption, wide, sizes }: { media: ResolvedMedia; caption?: string; wide?: boolean; sizes: string }) {
  if (media.type !== "image") return null;
  const hasSize = !!media.width && !!media.height;
  return (
    <figure className={cn("my-10", wide && "lg:-mx-16")}>
      <div className={cn("relative overflow-hidden rounded-card bg-pebble", !hasSize && "aspect-[4/3]")}>
        {hasSize ? (
          <Image
            src={media.src}
            alt={media.decorative ? "" : media.alt}
            width={media.width}
            height={media.height}
            sizes={sizes}
            placeholder={media.blurDataURL ? "blur" : "empty"}
            blurDataURL={media.blurDataURL}
            className="h-auto w-full"
            style={media.objectPosition ? { objectPosition: media.objectPosition } : undefined}
          />
        ) : (
          <Image
            src={media.src}
            alt={media.decorative ? "" : media.alt}
            fill
            sizes={sizes}
            className="object-cover"
            style={media.objectPosition ? { objectPosition: media.objectPosition } : undefined}
          />
        )}
        {media.illustrative ? <ImageCredit /> : null}
      </div>
      {caption ? <figcaption className="mt-3 text-[14px] leading-relaxed text-body">{caption}</figcaption> : null}
    </figure>
  );
}

const CALLOUT_TONE: Record<"info" | "safeguarding" | "warm", NoticeTone> = {
  info: "info",
  safeguarding: "emergency",
  warm: "success",
};

const STAT_TONES: readonly StatTone[] = ["forest", "clay", "cocoa", "umber", "marigold"];

function statTone(tone: string | undefined, index: number): StatTone {
  return (STAT_TONES as readonly string[]).includes(tone ?? "") ? (tone as StatTone) : STAT_TONES[index % STAT_TONES.length];
}

const CTA_DEFAULT: Record<"donate" | "cause" | "support" | "volunteer" | "partner", { label: string; href: (slug?: string) => string; variant: "marigold-ink" | "forest" }> = {
  donate: { label: "Donate now", href: () => routeHref("donate"), variant: "marigold-ink" },
  cause: { label: "Give to this cause", href: (slug) => routes.donate(slug), variant: "marigold-ink" },
  support: { label: "Request support", href: () => routeHref("support"), variant: "forest" },
  volunteer: { label: "Become a volunteer", href: () => routeHref("volunteer"), variant: "forest" },
  partner: { label: "Partner with us", href: () => routeHref("partner"), variant: "forest" },
};

function renderBlock(b: AnyBlock, i: number, ids: Map<string, string>, stats: Record<string, ResolvedStat> | undefined): React.ReactNode {
  switch (b.type) {
    case "paragraph":
      return <p key={b.id}>{renderInline(b.text, inlineOpts)}</p>;
    case "heading": {
      const id = ids.get(b.id);
      return b.level === 2 ? (
        <h2 key={b.id} id={id}>
          {b.text}
        </h2>
      ) : (
        <h3 key={b.id} id={id}>
          {b.text}
        </h3>
      );
    }
    case "list": {
      const items = b.items.map((t, n) => <li key={n}>{renderInline(t, inlineOpts)}</li>);
      return b.style === "number" ? <ol key={b.id}>{items}</ol> : <ul key={b.id}>{items}</ul>;
    }
    case "quote":
      return (
        <blockquote key={b.id}>
          <p>{b.text}</p>
          {b.attribution ? <footer className="mt-2 text-[15px] font-semibold not-italic text-body">— {b.attribution}</footer> : null}
        </blockquote>
      );
    case "image":
      return (
        <Figure
          key={b.id}
          media={b.media}
          caption={b.caption}
          wide={b.size === "wide"}
          sizes={b.size === "wide" ? "(min-width:1024px) 860px, 100vw" : "(min-width:768px) 720px, 100vw"}
        />
      );
    case "gallery":
      return (
        <div key={b.id} className={cn("my-10 grid gap-4", b.items.length > 2 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
          {b.items.map((item, n) =>
            item.media.type === "image" ? (
              <figure key={n} className="m-0">
                <div className="relative aspect-[4/3] overflow-hidden rounded-tile bg-pebble">
                  <Image
                    src={item.media.src}
                    alt={item.media.decorative ? "" : item.media.alt}
                    fill
                    sizes="(min-width:1024px) 240px, (min-width:640px) 45vw, 100vw"
                    className="object-cover"
                    style={item.media.objectPosition ? { objectPosition: item.media.objectPosition } : undefined}
                  />
                  {item.media.illustrative ? <ImageCredit /> : null}
                </div>
                {item.caption ? <figcaption className="mt-2 text-[14px] leading-relaxed text-body">{item.caption}</figcaption> : null}
              </figure>
            ) : null,
          )}
        </div>
      );
    case "callout":
      return (
        <div key={b.id} className="my-8 [&_p]:m-0">
          <Notice tone={CALLOUT_TONE[b.tone]} title={b.title}>
            {renderInline(b.text, inlineOpts)}
          </Notice>
        </div>
      );
    case "stat": {
      if (b.statId) {
        const s = stats?.[b.statId];
        if (!s) return null;
        return (
          <div key={b.id} className="my-8 max-w-[360px] [&_p]:m-0">
            <StatCard label={s.label} value={s.value} suffix={s.suffix} note={s.note} tone={statTone(s.tone, i)} size="sm" illustrative={s.placeholder} as="div" />
          </div>
        );
      }
      if (!b.value || !b.label) return null;
      return (
        <figure key={b.id} className="my-8 max-w-[420px] rounded-card bg-cream px-7 py-6">
          <p className="m-0 font-display text-[44px] leading-none text-ink">{b.value}</p>
          <p className="m-0 mt-2 text-[16px] font-bold text-ink">{b.label}</p>
          {b.source ? <figcaption className="mt-2 text-[13px] leading-snug text-body">Source: {b.source}</figcaption> : null}
        </figure>
      );
    }
    case "cta": {
      const d = CTA_DEFAULT[b.kind];
      if (b.kind === "cause" && !b.causeSlug) return null;
      return (
        <div key={b.id} className="my-8">
          <Button href={d.href(b.causeSlug)} variant={d.variant} icon={b.kind === "donate" || b.kind === "cause" ? "heart" : "arrow"} iconFirst={b.kind === "donate" || b.kind === "cause"}>
            {b.label || d.label}
          </Button>
        </div>
      );
    }
    case "video":
      return (
        <figure key={b.id} className="my-10">
          <div className="relative aspect-video overflow-hidden rounded-card bg-night">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.videoId)}?rel=0`}
              title={b.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 size-full border-0"
            />
          </div>
          <figcaption className="mt-3 text-[14px] leading-relaxed text-body">{b.title}</figcaption>
        </figure>
      );
    case "divider":
      return <hr key={b.id} className="my-12 border-0 border-t border-line" />;
    default:
      return null;
  }
}

export function Blocks({ blocks, stats, prose = true, size = "md", measure = true, idPrefix = "", className }: BlocksProps) {
  const list = blocks as readonly AnyBlock[];
  const ids = headingIds(list, idPrefix);
  const content = list.map((b, i) => renderBlock(b, i, ids, stats));
  if (!prose) return <>{content}</>;
  return (
    <Prose size={size} measure={measure} className={className}>
      {content}
    </Prose>
  );
}
