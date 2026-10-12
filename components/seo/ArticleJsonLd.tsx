import { JsonLd } from "./JsonLd";

export type ArticleJsonLdProps = {
  base: string;
  url: string;
  headline: string;
  description: string;
  image?: string;
  publishedAt?: number | null;
  modifiedAt?: number | null;
  section?: string;
  /** A named, approved author; otherwise the organisation is the author. */
  author?: string | null;
  kind?: "NewsArticle" | "BlogPosting";
};

/** NewsArticle / BlogPosting JSON-LD (public-pages §7.2) with the organisation (#org) as publisher. */
export function ArticleJsonLd({ base, url, headline, description, image, publishedAt, modifiedAt, section, author, kind = "NewsArticle" }: ArticleJsonLdProps) {
  const org = { "@id": `${base}/#org` };
  const iso = (ms?: number | null) => (ms ? new Date(ms).toISOString() : undefined);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": kind,
        headline,
        description,
        ...(image ? { image: [image] } : {}),
        ...(publishedAt ? { datePublished: iso(publishedAt) } : {}),
        ...(modifiedAt || publishedAt ? { dateModified: iso(modifiedAt ?? publishedAt) } : {}),
        author: author ? { "@type": "Person", name: author } : org,
        publisher: org,
        mainEntityOfPage: url,
        ...(section ? { articleSection: section } : {}),
      }}
    />
  );
}
