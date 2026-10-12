import "server-only";

// Resolution (content-model §4.5): MediaRefs → resolved media, stat ids → ResolvedStat, CTAs → hrefs,
// plus the derived values pages need (phone href, address line, cause money, post dates).
// A missing, archived or withdrawn asset resolves to the neutral `fallback-warm` image and is
// reported; withdrawal therefore takes an image off every page at once.

import { isIllustrative, assetOrFallback, type MediaIndex } from "@/lib/media/index";
import type { Cta, MediaAsset, MediaRef } from "./schema";
import type { CtaView, Resolved, ResolvedDocument, ResolvedImage, ResolvedMedia, ResolvedStat, ResolvedVideo } from "./types";
import { log } from "@/lib/server/log";
import { routeHref } from "@/lib/routes";

/* ── Reporting invalid content (G3) ────────────────────────────────────── */

const reported = new Set<string>();

/**
 * Logs content that could not be used (a doc that failed its schema, a dropped item, a missing
 * picture). Each problem is logged once per process; the admin lists current problems through
 * findInvalidContent() (lib/content/launch.ts).
 */
export function reportInvalid(info: { kind: "doc" | "item" | "media"; id: string; collection?: string; issues?: string[] }): void {
  const key = `${info.kind}:${info.collection ?? ""}:${info.id}:${(info.issues ?? []).join("|")}`;
  if (reported.has(key)) return;
  reported.add(key);
  if (reported.size > 2000) reported.clear();
  log.error("content.invalid", { kind: info.kind, id: info.id, collection: info.collection ?? null, issues: (info.issues ?? []).slice(0, 5) });
}

/* ── Media ─────────────────────────────────────────────────────────────── */

function focalPosition(asset: MediaAsset): string | undefined {
  return asset.focal ? `${asset.focal.x}% ${asset.focal.y}%` : undefined;
}

function imageOf(asset: MediaAsset): ResolvedImage {
  const objectPosition = focalPosition(asset);
  // A video used in a still slot shows its poster frame.
  const src = asset.kind === "video" && asset.poster ? asset.poster : asset.src;
  return {
    type: "image",
    assetId: asset.id,
    src,
    alt: asset.decorative ? "" : asset.alt,
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(asset.blurDataURL ? { blurDataURL: asset.blurDataURL } : {}),
    ...(asset.focal ? { focal: asset.focal } : {}),
    ...(objectPosition ? { objectPosition } : {}),
    illustrative: isIllustrative(asset),
    ...(asset.decorative ? { decorative: true } : {}),
  };
}

function videoOf(asset: MediaAsset): ResolvedVideo {
  return {
    type: "video",
    assetId: asset.id,
    src: asset.src,
    poster: asset.poster ?? (asset.kind === "image" ? asset.src : ""),
    alt: asset.decorative ? "" : asset.alt,
    illustrative: isIllustrative(asset),
    ...(asset.caption ? { label: asset.caption } : {}),
  };
}

function documentOf(asset: MediaAsset): ResolvedDocument {
  return { type: "document", assetId: asset.id, src: asset.src, title: asset.caption || asset.alt || asset.id };
}

function lookup(ref: MediaRef, index: MediaIndex): MediaAsset {
  const { asset, fellBack } = assetOrFallback(index, ref.$media);
  if (fellBack) reportInvalid({ kind: "media", id: ref.$media, issues: [index[ref.$media] ? `asset is ${index[ref.$media].status}` : "asset is missing"] });
  return asset;
}

/** A MediaRef as whatever the asset is (image, video or document). */
export function resolveRef(ref: MediaRef, index: MediaIndex): ResolvedMedia {
  const a = lookup(ref, index);
  if (a.kind === "video") return videoOf(a);
  if (a.kind === "document") return documentOf(a);
  return imageOf(a);
}

/** A MediaRef for a still slot. */
export function resolveImage(ref: MediaRef, index: MediaIndex): ResolvedImage {
  return imageOf(lookup(ref, index));
}

/** A MediaRef for a film slot (manifesto, donate, join, restoring film; content-model §6.7). */
export function resolveVideo(ref: MediaRef, index: MediaIndex): ResolvedVideo {
  return videoOf(lookup(ref, index));
}

/** A MediaRef for a mixed slot (hero and focus slides): an image or a video. */
export function resolveImageOrVideo(ref: MediaRef, index: MediaIndex): ResolvedImage | ResolvedVideo {
  const a = lookup(ref, index);
  return a.kind === "video" ? videoOf(a) : imageOf(a);
}

const isRef = (v: unknown): v is MediaRef =>
  typeof v === "object" && v !== null && !Array.isArray(v) && typeof (v as { $media?: unknown }).$media === "string" && Object.keys(v).length === 1;

/** Walks any value and replaces every MediaRef with its resolved media. */
export function resolveMedia<T>(value: T, index: MediaIndex): Resolved<T> {
  return walk(value, index) as Resolved<T>;
}

function walk(value: unknown, index: MediaIndex): unknown {
  if (isRef(value)) return resolveRef(value, index);
  if (Array.isArray(value)) return value.map((v) => walk(v, index));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v, index);
    return out;
  }
  return value;
}

/* ── CTAs, stats, contact ──────────────────────────────────────────────── */

/** A stored CTA as label + href (final page URLs; "top" becomes "#top" on the home page). */
export function ctaView(cta: Cta, on?: "home"): CtaView {
  return { label: cta.label, href: routeHref(cta.to, on), to: cta.to };
}

type StatItem = {
  id: string;
  label: string;
  value: number;
  suffix: string;
  note?: string;
  kind: "programme" | "finance" | "organisation";
  verification: { status: "placeholder" | "verified" };
  asOf?: string;
  amounts?: Partial<Record<string, number>>;
  tone?: string;
};

export function toResolvedStat(s: StatItem): ResolvedStat {
  const verified = s.verification.status === "verified";
  return {
    id: s.id,
    label: s.label,
    value: s.value,
    suffix: s.suffix,
    ...(s.note ? { note: s.note } : {}),
    kind: s.kind,
    placeholder: !verified,
    verified,
    ...(s.asOf ? { asOf: s.asOf } : {}),
    ...(s.amounts ? { amounts: s.amounts as ResolvedStat["amounts"] } : {}),
    ...(s.tone ? { tone: s.tone } : {}),
  };
}

/** "tel:" + digits: "+220 000 0000" → "tel:+2200000000". */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** The one-line office address: "Kanifing, The Gambia · California, USA". */
export function addressLine(offices: ReadonlyArray<{ address: string }>): string {
  return offices.map((o) => o.address).join(" · ");
}

/* ── Dates ─────────────────────────────────────────────────────────────── */

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** "September 12, 2026" in the site's time zone (today's News card format). */
export function cardDate(ms: number, timeZone: string): string {
  let f = dateFormats.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone });
    } catch {
      f = new Intl.DateTimeFormat("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone: "UTC" });
    }
    dateFormats.set(timeZone, f);
  }
  return f.format(new Date(ms));
}

/** "1 October 2026" for policy review lines. */
export function longDate(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(ms));
  }
}

/* ── Narrowing resolved media for typed slots ──────────────────────────── */

/** A resolved value for a still slot: a video shows its poster; a document shows nothing useful (decorative blank). */
export function asImage(m: ResolvedMedia): ResolvedImage {
  if (m.type === "image") return m;
  if (m.type === "video") return { type: "image", assetId: m.assetId, src: m.poster || m.src, alt: m.alt, illustrative: m.illustrative };
  return { type: "image", assetId: m.assetId, src: m.src, alt: "", illustrative: false, decorative: true };
}

/** A resolved value for a film slot: a still becomes its own poster (the gate keeps film slots on films). */
export function asVideo(m: ResolvedMedia): ResolvedVideo {
  if (m.type === "video") return m;
  if (m.type === "image") return { type: "video", assetId: m.assetId, src: m.src, poster: m.src, alt: m.alt, illustrative: m.illustrative };
  return { type: "video", assetId: m.assetId, src: m.src, poster: "", alt: "", illustrative: false };
}

/** A resolved value for a mixed slot (hero and focus slides). */
export function asImageOrVideo(m: ResolvedMedia): ResolvedImage | ResolvedVideo {
  return m.type === "document" ? asImage(m) : m;
}
