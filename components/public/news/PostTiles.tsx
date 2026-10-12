import Image from "next/image";
import { CalendarDays, Clock } from "lucide-react";
import { ArticleCard } from "@/components/ui/cards/ArticleCard";
import { CardLink, CARD_FOCUS_RING } from "@/components/ui/cards/Card";
import { UpdateCard } from "@/components/ui/cards/UpdateCard";
import { ButtonGlyph, buttonClassName } from "@/components/ui/Button";
import { ImageCredit } from "@/components/ui/ImageCredit";
import type { PostCard } from "@/lib/content/types";
import { cn } from "@/lib/cn";

/** ISO day for <time dateTime> from Millis (deterministic, no clock read). */
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** "3 min read". */
export const readTime = (minutes: number) => `${Math.max(1, Math.round(minutes))} min read`;

/**
 * One post on a list: an article as the landing ArticleCard, a quick picture-and-paragraph update as
 * the compact UpdateCard (D43).
 */
export function PostTile({ post, cta = "Read More", headingLevel = 3, as = "article", className }: { post: PostCard; cta?: string; headingLevel?: 2 | 3; as?: "article" | "li"; className?: string }) {
  return post.format === "update" ? (
    <UpdateCard
      title={post.title}
      date={post.dateLabel}
      dateTime={isoDay(post.publishedAt)}
      text={post.excerpt}
      image={post.cover}
      category={post.categoryLabel}
      href={post.href}
      headingLevel={headingLevel}
      as={as}
      className={cn("self-start", className)}
    />
  ) : (
    <ArticleCard
      title={post.title}
      date={post.dateLabel}
      dateTime={isoDay(post.publishedAt)}
      category={post.categoryLabel}
      image={post.cover}
      href={post.href}
      excerpt={post.excerpt}
      cta={cta}
      headingLevel={headingLevel}
      as={as}
      className={className}
    />
  );
}

/** The newest post as a wide horizontal card at the top of /news (public-pages §3.15). */
export function FeaturedPost({ post, eyebrow = "Latest" }: { post: PostCard; eyebrow?: string }) {
  return (
    <article
      className={cn(
        "group relative grid overflow-hidden rounded-card-lg bg-white shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]",
        CARD_FOCUS_RING,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[400px]">
        <Image
          src={post.cover.src}
          alt={post.cover.decorative ? "" : post.cover.alt}
          fill
          sizes="(min-width:1280px) 660px, (min-width:768px) 55vw, 100vw"
          placeholder={post.cover.blurDataURL ? "blur" : "empty"}
          blurDataURL={post.cover.blurDataURL}
          style={post.cover.focal ? { objectPosition: `${post.cover.focal.x}% ${post.cover.focal.y}%` } : undefined}
          className="object-cover transition-transform duration-[1.4s] ease-out-expo group-hover:scale-105"
        />
        {post.cover.illustrative ? <ImageCredit position="bottom-left" /> : null}
        <span className="absolute left-5 top-5 rounded-full bg-marigold px-4 py-1.5 font-grotesk text-[12px] font-semibold uppercase tracking-[0.1em] text-night">{eyebrow}</span>
      </div>
      <div className="flex flex-col justify-center p-7 md:p-10 lg:p-12">
        <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-marigold-ink">{post.categoryLabel}</p>
        <h2 className="mt-3 text-balance text-[26px] font-extrabold leading-[1.2] text-ink transition-colors group-hover:text-forest md:text-[32px]">
          <CardLink href={post.href}>{post.title}</CardLink>
        </h2>
        <p className="mt-4 text-[16px] leading-[1.75] text-body">{post.excerpt}</p>
        <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-body">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4 text-marigold" />
            <time dateTime={isoDay(post.publishedAt)}>{post.dateLabel}</time>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4 text-marigold" />
            {readTime(post.readingMinutes)}
          </span>
        </p>
        <div className="mt-7">
          <span aria-hidden className={buttonClassName({ variant: "forest", size: "md", className: "group-hover:bg-marigold group-hover:text-night" })}>
            <span>Read the Story</span>
            <ButtonGlyph icon="arrow" />
          </span>
        </div>
      </div>
    </article>
  );
}
