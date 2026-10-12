// Reading the help pages' copy (pages.getSupport, pages.requestSupport, pages.reportConcern,
// pages.contact) with safe fallbacks, so a section removed in the studio never breaks a page that
// people rely on to ask for help.

import { blocksToPlain } from "@/components/content/Blocks";
import type { CtaView, PageView } from "@/lib/content/public";
import { isRouteKey, routeHref } from "@/lib/routes";

type Section = PageView["sections"][string];

export function sectionOf(page: PageView, key: string): Section | undefined {
  return page.sections[key];
}

/** A section's body as plain text (links and emphasis flattened), or the fallback. */
export function textOf(page: PageView, key: string, fallback: string): string {
  const body = page.sections[key]?.body;
  const text = body?.length ? blocksToPlain(body).trim() : "";
  return text || fallback;
}

/** A section's title lines, or the fallback lines. */
export function titleOf(page: PageView, key: string, fallback: string[]): string[] {
  const t = page.sections[key]?.title;
  return t?.length ? [...t] : fallback;
}

/** A section's eyebrow, or the fallback. */
export function eyebrowOf(page: PageView, key: string, fallback?: string): string | undefined {
  return page.sections[key]?.eyebrow ?? fallback;
}

/** A section's items as { title, text?, icon? }, or the fallback list. */
export function itemsOf(page: PageView, key: string, fallback: Array<{ title: string; text?: string; icon?: string }> = []) {
  const items = page.sections[key]?.items;
  return items?.length ? items.map((i) => ({ title: i.title, text: i.text, icon: i.icon })) : fallback;
}

/** A section's CTA as a real route (label + href), or the fallback. */
export function ctaOf(page: PageView, key: string, fallback: { label: string; href: string }): { label: string; href: string } {
  const cta = page.sections[key]?.cta as Partial<CtaView> | undefined;
  if (!cta?.label || !cta.to || !isRouteKey(cta.to)) return fallback;
  return { label: cta.label, href: routeHref(cta.to) };
}
