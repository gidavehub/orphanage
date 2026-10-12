// Small readers for the editable page docs (PLAN D52) shared by the P5 pages: a section's title lines,
// its plain text, its items and its call to action, each with an in-code fallback so a section the
// content team emptied still reads well. Also the PageHero media adapter for resolved media.

import type { PageHeroMedia } from "@/components/layout/PageHero";
import { blocksToPlain } from "@/components/content/Blocks";
import type { PageView, ResolvedMedia } from "@/lib/content/types";
import { routeHref, type RouteKey } from "@/lib/routes";

type Section = PageView["sections"][string];

export function section(page: PageView, key: string): Section | undefined {
  return page.sections[key];
}

/** The section's heading lines, or the fallback. */
export function titleOf(page: PageView, key: string, fallback: string[]): string[] {
  const t = page.sections[key]?.title;
  return t && t.length ? [...t] : fallback;
}

export function eyebrowOf(page: PageView, key: string, fallback?: string): string | undefined {
  return page.sections[key]?.eyebrow ?? fallback;
}

/** The section body as plain text (links and emphasis stripped), or the fallback. */
export function textOf(page: PageView, key: string, fallback = ""): string {
  const body = page.sections[key]?.body;
  const text = body && body.length ? blocksToPlain(body).trim() : "";
  return text || fallback;
}

/** Each paragraph of the section body as plain text. */
export function paragraphsOf(page: PageView, key: string): string[] {
  const body = page.sections[key]?.body ?? [];
  return body.flatMap((b) => (b.type === "paragraph" ? [blocksToPlain([b]).trim()] : [])).filter(Boolean);
}

export function itemsOf(page: PageView, key: string): Array<{ title: string; text?: string; icon?: string }> {
  return (page.sections[key]?.items ?? []).map((i) => ({ title: i.title, ...(i.text ? { text: i.text } : {}), ...(i.icon ? { icon: i.icon } : {}) }));
}

/** The section's button as { label, href }, or the fallback. */
export function ctaOf(page: PageView, key: string, fallback: { label: string; to: RouteKey }): { label: string; href: string } {
  const c = page.sections[key]?.cta ?? fallback;
  return { label: c.label, href: routeHref(c.to) };
}

/** Resolved hero media → PageHero media (videos keep their poster; documents are ignored). */
export function heroMediaOf(media: ResolvedMedia | undefined): PageHeroMedia | undefined {
  if (!media) return undefined;
  if (media.type === "image") return { image: media };
  if (media.type === "video") return { video: { src: media.src, poster: media.poster, label: media.alt }, illustrative: media.illustrative };
  return undefined;
}
