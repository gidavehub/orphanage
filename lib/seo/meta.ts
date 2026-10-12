// Page metadata (public-pages §7.1; PLAN §5.3). One helper so every public page sets the same fields:
// title (the root layout's template adds " | Haven"), description, canonical path, Open Graph and
// Twitter cards, and noindex where asked. Paths are relative; the root layout sets metadataBase from
// NEXT_PUBLIC_SITE_URL.

import type { Metadata } from "next";

export type MetadataInput = {
  title: string;
  description: string;
  /** The canonical path ("/programmes/education"). */
  path: string;
  /** An absolute or root-relative image URL (a page's opengraph-image wins when present). */
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
  /** Brand name for Open Graph; defaults to "Haven". */
  siteName?: string;
};

function cleanPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path.split("#")[0] || "/";
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function buildMetadata(i: MetadataInput): Metadata {
  const path = cleanPath(i.path);
  const description = clip(i.description, 200);
  const images = i.image ? [{ url: i.image }] : undefined;
  return {
    title: i.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: i.title,
      description,
      url: path,
      siteName: i.siteName ?? "Haven",
      type: i.type ?? "website",
      locale: "en_GB",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: i.title,
      description,
      ...(images ? { images: images.map((x) => x.url) } : {}),
    },
    ...(i.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
