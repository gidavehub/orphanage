import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { HeartGlyph } from "./glyphs";
import { cn } from "@/lib/cn";

/** One step of the trail. The last crumb is the current page and has no href. */
export type Crumb = { label: string; href?: string };

export type BreadcrumbsProps = {
  items: Crumb[];
  /**
   * The surface: `light` (default) for paper/white heroes (body text, forest links, current page in
   * ink bold); `dark` for photos (a glass pill, white text, current page in marigold).
   */
  tone?: "light" | "dark";
  /** Prepend "Home" (default true). */
  home?: boolean;
  /** Emit BreadcrumbList JSON-LD (default true). */
  jsonLd?: boolean;
  /** Absolute site origin for JSON-LD item URLs (e.g. "https://haven.org"); relative paths otherwise. */
  baseUrl?: string;
  className?: string;
};

function absolute(href: string, baseUrl?: string) {
  if (!baseUrl || /^https?:\/\//.test(href)) return href;
  return `${baseUrl.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`;
}

/** The trail with "Home" prepended (unless the first crumb already is home). */
function withHome(items: Crumb[]): Crumb[] {
  return items[0]?.href === "/" ? items : [{ label: "Home", href: "/" }, ...items];
}

/**
 * `<nav aria-label="Breadcrumb"><ol>` with marigold heart separators (PLAN D124). With more than
 * three crumbs, phones show "… / Parent / Current"; the hidden crumbs stay in the accessibility tree.
 */
export function Breadcrumbs({ items, tone = "light", home = true, jsonLd = true, baseUrl, className }: BreadcrumbsProps) {
  const trail = home ? withHome(items) : items;
  const collapse = trail.length > 3;
  const dark = tone === "dark";

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: absolute(c.href, baseUrl) } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol
        className={cn(
          "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] leading-snug",
          dark
            ? "w-fit max-w-full rounded-full bg-white/15 px-4 py-2 font-bold text-white/90 ring-1 ring-white/25 backdrop-blur-md"
            : "text-body",
        )}
      >
        {collapse ? (
          <li aria-hidden className="flex items-center gap-2.5 sm:hidden">
            <span>…</span>
            <HeartGlyph />
          </li>
        ) : null}
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          const hiddenOnPhone = collapse && i < trail.length - 2;
          return (
            <li key={`${c.label}-${i}`} className={cn("flex min-w-0 items-center gap-2.5", hiddenOnPhone && "max-sm:sr-only")}>
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className={cn(
                    "truncate underline-offset-4 transition-colors hover:underline",
                    dark ? "hover:text-white" : "font-semibold text-forest hover:text-ink",
                  )}
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn("truncate", last && (dark ? "text-marigold" : "font-bold text-ink"))}>
                  {c.label}
                </span>
              )}
              {!last ? <HeartGlyph /> : null}
            </li>
          );
        })}
      </ol>
      {jsonLd ? <JsonLd data={data} /> : null}
    </nav>
  );
}
