import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Tag } from "lucide-react";
import { Blocks, blocksToPlain } from "@/components/content/Blocks";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { AdjacentPosts, ArticleDonate, Byline, RelatedPosts, UpdatePicture } from "@/components/public/news/ArticleParts";
import { isoDay, readTime } from "@/components/public/news/PostTiles";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import { ShareRow } from "@/components/ui/ShareRow";
import { getAdjacentPosts, getCause, getLatestPosts, getPage, getPost, getPosts, getPublishedPostSlugs, getSiteSettings, getStats, type PostCard, type ResolvedImage } from "@/lib/content/public";
import type { PostCategory } from "@/lib/content/schema";
import { PROGRAMME_SLUG, type ProgrammeId } from "@/lib/model/enums";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { absolute } from "@/lib/server/url";

// /news/[slug] (public-pages §3.15, PLAN D42–D44): one article or quick update. The `article` hero
// carries the category pill (a link to the filtered index), the date and the reading time; the body
// is Block[] rendered by <Blocks> in a 720px reading column with a sticky share rail on desktop (the
// share row sits under the header on phones); then "Give to {cause}" (the post's cause, else its
// programme's cause, else where it's needed most), the byline with the AI transparency line, older
// and newer posts, three related posts and the closing band. Quick updates (D43) get the short form:
// their picture inside the reading column and no wide cover.
//
// `instant = false` (route segment config, not a D5-forbidden export): params are read at the top so
// an unknown slug answers a real HTTP 404 instead of a streamed 200 (the same pattern as
// /donate/[cause] and /policies/[slug]). Every published post is prerendered.
export const instant = false;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getPublishedPostSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(decodeURIComponent(slug));
  if (!post) return { title: "Post not found" };
  const meta = buildMetadata({
    title: post.seo.title ?? post.title,
    description: post.seo.description ?? post.excerpt,
    path: post.href,
    type: "article",
    noindex: post.seo.noindex === true || post.status !== "published",
  });
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article",
      ...(post.publishedAt ? { publishedTime: new Date(post.publishedAt).toISOString() } : {}),
      section: post.categoryLabel,
      authors: [post.author.displayName],
    },
  };
}

/** The post's own cause, else its first programme's cause, else the general fund (public-pages §3.15 item 4). */
async function donateCause(post: { causeSlugs: string[]; programmeIds: ProgrammeId[] }) {
  for (const slug of post.causeSlugs) {
    const c = await getCause(slug);
    if (c && !c.closed) return c;
  }
  const programme = post.programmeIds[0];
  if (programme) {
    const c = await getCause(PROGRAMME_SLUG[programme]);
    if (c) return c;
  }
  return getCause("general");
}

/** Three related posts: same category first, then the latest others. */
async function relatedTo(post: { slug: string; category: PostCategory }): Promise<PostCard[]> {
  const [same, latest] = await Promise.all([getPosts({ category: post.category, pageSize: 4 }), getLatestPosts(6)]);
  const out: PostCard[] = [];
  for (const p of [...same.items, ...latest]) {
    if (p.slug === post.slug || out.some((x) => x.slug === p.slug)) continue;
    out.push(p);
    if (out.length === 3) break;
  }
  return out;
}

export default async function PostPage({ params }: PageProps<"/news/[slug]">) {
  const { slug: raw } = await params;
  const post = await getPost(decodeURIComponent(raw));
  if (!post) notFound();

  const [page, stats, adjacent, related, cause, site] = await Promise.all([
    getPage("news"),
    getStats(),
    getAdjacentPosts(post.slug),
    relatedTo(post),
    donateCause(post),
    getSiteSettings(),
  ]);

  const isUpdate = post.format === "update";
  const cover = post.cover.type === "image" ? post.cover : null;
  const avatar: ResolvedImage | undefined = post.author.avatar && post.author.avatar.type === "image" ? post.author.avatar : undefined;
  const aiLine = blocksToPlain(page.sections.aiByline?.body ?? []) || "This article was prepared with the help of AI tools, then reviewed and approved by the Haven team.";
  const published = post.publishedAt ?? post.publishAt;
  const categoryHref = routes.news({ category: post.category });
  const crumbs = [{ label: "News", href: routes.news() }, { label: post.title }];

  const meta = (
    <>
      <Link
        href={categoryHref}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-marigold-100 px-4 font-grotesk text-[13px] font-semibold uppercase tracking-[0.08em] text-umber transition-colors hover:bg-marigold hover:text-night"
      >
        <Tag aria-hidden className="size-3.5" strokeWidth={2.5} />
        {post.categoryLabel}
      </Link>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays aria-hidden className="size-4 text-marigold-ink" />
        {published ? <time dateTime={isoDay(published)}>{post.dateLabel}</time> : post.dateLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock aria-hidden className="size-4 text-marigold-ink" />
        {readTime(post.readingMinutes)}
      </span>
    </>
  );

  const shareText = post.excerpt;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": isUpdate ? "BlogPosting" : "NewsArticle",
          headline: post.title,
          description: post.excerpt,
          ...(cover ? { image: [absolute(cover.src)] } : {}),
          ...(published ? { datePublished: new Date(published).toISOString() } : {}),
          ...(published ? { dateModified: new Date(published).toISOString() } : {}),
          author: { "@type": post.author.uid ? "Person" : "Organization", name: post.author.displayName },
          publisher: { "@type": "NGO", name: site.name, url: absolute("/") },
          mainEntityOfPage: absolute(post.href),
          articleSection: post.categoryLabel,
        }}
      />

      <PageHero
        variant="article"
        title={post.title}
        intro={post.excerpt}
        meta={meta}
        crumbs={crumbs}
        {...(!isUpdate && cover ? { media: { image: cover } } : {})}
      />

      <div className="bg-white pb-20 pt-12 md:pb-28 md:pt-16">
        <div className="wrap">
          <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[150px_minmax(0,720px)_150px] lg:justify-center lg:gap-[40px]">
            {/* Share: a sticky rail on desktop, a row under the header on phones. */}
            <aside aria-label="Share this post">
              <ShareRow
                url={post.href}
                title={post.title}
                text={shareText}
                label="Share"
                className="justify-center lg:sticky lg:top-28 lg:flex-col lg:items-start lg:[&_ul]:flex-col lg:[&_ul]:items-start"
              />
            </aside>

            <article aria-labelledby="page-title" className="min-w-0">
              {isUpdate && cover ? <UpdatePicture image={cover} /> : null}
              <Blocks blocks={post.body} stats={stats} size="lg" measure={false} />

              {cause ? <ArticleDonate cause={cause} lead={isUpdate ? "Be part of the next update" : "Moved by this story?"} /> : null}

              <Byline
                name={post.author.displayName}
                {...(post.author.role ? { role: post.author.role } : {})}
                {...(avatar ? { avatar } : {})}
                aiAssisted={post.aiAssisted}
                aiLine={aiLine}
                dateLabel={post.dateLabel}
              />

              <AdjacentPosts {...adjacent} />

              <p className="mt-10 text-center">
                <Button href={routes.news()} variant="outline" size="sm" icon="arrow">
                  All News & Updates
                </Button>
              </p>
            </article>
          </div>
        </div>
      </div>

      {related.length ? (
        <section aria-label="Related posts" className="paper py-20 md:py-28">
          <div className="wrap">
            <RelatedPosts posts={related} />
          </div>
        </section>
      ) : null}

      <CtaBand
        id="post-cta-title"
        actions={
          <>
            <Button href={cause?.href ?? routes.donate()} variant="vu-white" size="lg" icon="heart" iconFirst className="min-w-[200px]">
              Donate Now
            </Button>
            <Button href={routes.involved()} variant="outline-light" size="lg" icon="arrow" className="min-w-[200px]">
              Get Involved
            </Button>
          </>
        }
      />
    </>
  );
}
