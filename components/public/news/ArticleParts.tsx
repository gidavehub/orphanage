import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Sparkles } from "lucide-react";
import { HavenMark } from "@/components/art/Logo";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Button } from "@/components/ui/Button";
import { CauseCard } from "@/components/ui/cards/CauseCard";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Reveal } from "@/components/ui/Reveal";
import type { CauseView, PostCard, ResolvedImage } from "@/lib/content/types";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/cn";
import { PostTile } from "./PostTiles";

/** The author box after the body, with the AI transparency line when the post was AI-assisted (D42). */
export function Byline({
  name,
  role,
  avatar,
  aiAssisted,
  aiLine,
  dateLabel,
}: {
  name: string;
  role?: string;
  avatar?: ResolvedImage;
  aiAssisted: boolean;
  aiLine: string;
  dateLabel: string;
}) {
  return (
    <aside aria-label="About this article" className="mt-14 rounded-card bg-cream p-6 md:p-7">
      <div className="flex items-start gap-4">
        {avatar ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-full ring-4 ring-white">
            <Image src={avatar.src} alt="" fill sizes="56px" className="object-cover" />
          </span>
        ) : (
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-white ring-4 ring-white">
            <HavenMark className="w-8" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-body">Written by</p>
          <p className="mt-0.5 text-[18px] font-extrabold leading-snug text-ink">{name}</p>
          {role ? <p className="text-[15px] text-body">{role}</p> : null}
          <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] text-forest-700">
            <BadgeCheck aria-hidden className="size-4" strokeWidth={2.25} />
            Reviewed and published by the Haven team, {dateLabel}
          </p>
        </div>
      </div>
      {aiAssisted ? (
        <p className="mt-5 flex gap-2.5 border-t border-line pt-5 text-[14px] leading-relaxed text-body">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-ink" strokeWidth={2.25} />
          <span>{aiLine}</span>
        </p>
      ) : null}
    </aside>
  );
}

/** "Give to {cause}" after the body (public-pages §3.15 item 4). */
export function ArticleDonate({ cause, lead }: { cause: CauseView; lead: string }) {
  const place = cause.place ? { code: cause.place, name: countryName(cause.place) } : undefined;
  return (
    <section aria-labelledby="article-donate-title" className="relative mt-16 overflow-hidden rounded-card-lg bg-cream-2 p-6 md:p-10">
      <div className={cn("grid items-center gap-8", cause.goal > 0 && "md:grid-cols-[minmax(0,1fr)_300px]")}>
        <div>
          <p className="font-script text-[28px] font-bold leading-none text-marigold-ink">{lead}</p>
          <h2 id="article-donate-title" className="mt-3 text-balance text-[26px] font-extrabold leading-tight text-ink md:text-[30px]">
            Give to {cause.title}
          </h2>
          <p className="mt-3 max-w-[460px] text-[16px] leading-[1.75] text-body">{cause.summary}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            {cause.goal > 0 ? null : (
              <Button href={cause.href} variant="flame-ink" icon="heart" iconFirst>
                Give Now
              </Button>
            )}
            <ArrowLink href={`${cause.href}#where-it-goes`} className="font-bold">
              See exactly where your money goes
            </ArrowLink>
          </div>
        </div>
        {cause.goal > 0 ? (
          <CauseCard
            title={cause.title}
            season={cause.season}
            {...(place ? { place } : {})}
            image={cause.image}
            raised={cause.showFigures ? cause.raised : null}
            goal={cause.goal}
            currency={cause.currency}
            tone={cause.tone}
            href={cause.href}
            cta="Give Now"
            sizes="300px"
          />
        ) : null}
      </div>
    </section>
  );
}

/** Older and newer posts. */
export function AdjacentPosts({ prev, next }: { prev?: PostCard; next?: PostCard }) {
  if (!prev && !next) return null;
  const item = (p: PostCard, dir: "prev" | "next") => (
    <Link
      href={p.href}
      rel={dir}
      className={cn(
        "group flex min-h-[112px] items-center gap-4 rounded-card border border-line bg-white p-4 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-transparent hover:shadow-card-hover",
        dir === "next" && "flex-row-reverse text-right",
      )}
    >
      <span className="relative hidden size-20 shrink-0 overflow-hidden rounded-tile sm:block">
        <Image src={p.cover.src} alt="" fill sizes="80px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("inline-flex items-center gap-1.5 font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-marigold-ink", dir === "next" && "flex-row-reverse")}>
          {dir === "prev" ? <ArrowLeft aria-hidden className="size-3.5" strokeWidth={2.5} /> : <ArrowRight aria-hidden className="size-3.5" strokeWidth={2.5} />}
          {dir === "prev" ? "Older" : "Newer"}
        </span>
        <span className="mt-1 line-clamp-2 block text-[16px] font-bold leading-snug text-ink transition-colors group-hover:text-forest">{p.title}</span>
      </span>
    </Link>
  );
  return (
    <nav aria-label="More posts" className="mt-10 grid gap-4 sm:grid-cols-2">
      <div>{prev ? item(prev, "prev") : null}</div>
      <div>{next ? item(next, "next") : null}</div>
    </nav>
  );
}

/** Three related posts (same category first). */
export function RelatedPosts({ posts, title = "Keep Reading" }: { posts: PostCard[]; title?: string }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="related-title">
      <h2 id="related-title" className="text-center text-[30px] font-extrabold leading-tight text-ink md:text-[38px]">
        {title}
      </h2>
      <span aria-hidden className="mx-auto mt-3 block h-[3px] w-14 rounded-full bg-marigold" />
      <Reveal
        stagger={0.1}
        as="ul"
        className={cn("mx-auto mt-12 grid gap-7 md:grid-cols-2", posts.length >= 3 ? "lg:grid-cols-3" : posts.length === 2 ? "max-w-[860px]" : "max-w-[420px] md:grid-cols-1")}
      >
        {posts.map((p) => (
          <li key={p.id} className="grid">
            <PostTile post={p} />
          </li>
        ))}
      </Reveal>
    </section>
  );
}

/** A quick update's picture, shown inside the reading column (updates have no wide cover). */
export function UpdatePicture({ image }: { image: ResolvedImage }) {
  return (
    <figure className="relative mb-10 aspect-[4/3] overflow-hidden rounded-card">
      <Image
        src={image.src}
        alt={image.decorative ? "" : image.alt}
        fill
        sizes="(min-width:800px) 720px, 100vw"
        loading="eager"
        style={image.focal ? { objectPosition: `${image.focal.x}% ${image.focal.y}%` } : undefined}
        className="object-cover"
      />
      {image.illustrative ? <ImageCredit position="bottom-left" /> : null}
    </figure>
  );
}
