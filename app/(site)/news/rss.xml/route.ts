import { cacheLife, cacheTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import { getPosts, getSiteSettings } from "@/lib/content/public";
import { absolute } from "@/lib/server/url";

// /news/rss.xml (public-pages §3.15, PLAN D43): RSS 2.0 of the 30 newest published posts, articles
// and quick updates alike. The XML is built in a 'use cache' helper (route handler bodies cannot
// hold the directive) tagged with the posts collection and the site settings, so publishing a post
// (updateTag / revalidateTag on col:posts) refreshes the feed. Dates come from the posts, never the
// clock. Every text value is XML-escaped.

const FEED_SIZE = 30;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Strips characters XML 1.0 forbids (control characters other than tab, newline and return). */
function clean(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const forbidden = (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0xfffe || c === 0xffff;
    if (!forbidden) out += ch;
  }
  return out;
}

const text = (s: string) => esc(clean(s));

function imageType(src: string): string {
  const ext = src.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "avif") return "image/avif";
  return "image/webp";
}

async function feedXml(): Promise<string> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.col("posts"), TAG.doc("settings.site"), TAG.media);

  const [{ items }, site] = await Promise.all([getPosts({ page: 1, pageSize: FEED_SIZE }), getSiteSettings()]);
  const home = absolute("/news");
  const self = absolute("/news/rss.xml");
  const newest = items[0]?.publishedAt;

  const entries = items
    .map((p) => {
      const link = absolute(p.href);
      const cover = absolute(p.cover.src);
      return [
        "    <item>",
        `      <title>${text(p.title)}</title>`,
        `      <link>${text(link)}</link>`,
        `      <guid isPermaLink="true">${text(link)}</guid>`,
        `      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>`,
        `      <category>${text(p.categoryLabel)}</category>`,
        `      <description>${text(p.excerpt)}</description>`,
        `      <enclosure url="${text(cover)}" length="0" type="${imageType(p.cover.src)}" />`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${text(`${site.name}: News & Updates`)}</title>`,
    `    <link>${text(home)}</link>`,
    `    <description>${text("Fresh impact updates and stories of hope, published every month.")}</description>`,
    "    <language>en-gb</language>",
    `    <atom:link href="${text(self)}" rel="self" type="application/rss+xml" />`,
    ...(newest ? [`    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>`] : []),
    `    <copyright>${text(`© ${site.year} ${site.name}`)}</copyright>`,
    entries,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export async function GET(): Promise<Response> {
  const xml = await feedXml();
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
