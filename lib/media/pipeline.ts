// The fingerprinted media pipeline as data (content-model §6.2, PLAN D23, §7.4).
//
// - img() / video() / poster() resolve a pipeline id to its content-hashed URL (scripts/media/
//   fingerprint.mjs), so a replaced file always gets a URL no cache has seen. They are the only place
//   that knows the /media layout: never hard-code /media/... paths anywhere else.
// - ref() builds a MediaRef ({ $media: id }), the only way content points at media.
// - pipelineAssets() turns every pipeline id into a MediaAsset record (safeguarding flags from
//   content/media-credits.ts; alt text from the media-meta seed, passed in by lib/media/index.ts).
//
// Node scripts load this file through type stripping, so it uses relative imports with explicit
// .ts extensions, imports types only from the app, and never imports `server-only` (PLAN §4.2 rule 6).

import type { MediaAsset } from "../content/schema";
// @ts-expect-error TS5097: Node type stripping needs the explicit .ts extension (bundlers resolve it either way).
import { mediaCredits } from "../../content/media-credits.ts";
// @ts-expect-error TS5097: Node type stripping needs the explicit .ts extension (bundlers resolve it either way).
import { mediaMap } from "../../content/media-map.ts";

type MediaMapShape = Record<"img" | "video" | "poster", Record<string, string>>;
type MediaCreditShape = { id: string; type: "image" | "video"; section: string; model: string; childPlaceholder: boolean };

const MAP = mediaMap as MediaMapShape;

/** Content-hashed URL of a pipeline still. */
export const img = (id: string): string => MAP.img[id] ?? `/media/img/${id}.webp`;
/** Content-hashed URL of a pipeline clip. */
export const video = (id: string): string => MAP.video[id] ?? `/media/video/${id}.mp4`;
/** Content-hashed URL of a pipeline clip's poster frame. */
export const poster = (id: string): string => MAP.poster[id] ?? `/media/posters/${id}.webp`;

export type MediaRef = { $media: string };

/** A media reference by id: `ref("hero-family-in")` → `{ $media: "hero-family-in" }`. */
export const ref = (id: string): MediaRef => ({ $media: id });

export function isMediaRef(value: unknown): value is MediaRef {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $media?: unknown }).$media === "string" &&
    Object.keys(value).length === 1
  );
}

/**
 * The neutral stand-in shown wherever an asset is missing, archived or withdrawn (content-model §4.5).
 * It reuses the existing pipeline paper texture: warm, no people, no new generation.
 */
export const FALLBACK_MEDIA_ID = "fallback-warm";
const FALLBACK_SRC = "/textures/paper-v5.svg";

/** Per-id alt text and display hints (content/seed/media-meta.ts). Ids without an entry are decorative. */
export type MediaMetaEntry = {
  alt?: string;
  decorative?: boolean;
  focal?: { x: number; y: number };
  caption?: string;
  credit?: string;
};
export type MediaMeta = Readonly<Record<string, MediaMetaEntry>>;

const NOT_REQUIRED = { state: "not_required" } as const;

// Read lazily, so client bundles that only need img()/video()/poster() can drop the credits list.
function credit(id: string): MediaCreditShape | undefined {
  return (mediaCredits as MediaCreditShape[]).find((c) => c.id === id);
}

function baseAsset(
  id: string,
  kind: "image" | "video",
  src: string,
  posterSrc: string | undefined,
  meta: MediaMetaEntry | undefined,
): MediaAsset {
  const c = credit(id);
  const aiGenerated = c !== undefined;
  const childPlaceholder = c?.childPlaceholder ?? false;
  const alt = meta?.alt?.trim() ?? "";
  return {
    id,
    kind,
    source: "pipeline",
    src,
    ...(posterSrc ? { poster: posterSrc } : {}),
    alt,
    decorative: meta?.decorative ?? alt === "",
    ...(meta?.focal ? { focal: meta.focal } : {}),
    ...(meta?.caption ? { caption: meta.caption } : {}),
    ...(meta?.credit ? { credit: meta.credit } : aiGenerated ? { credit: "Illustrative image (AI-generated)" } : {}),
    safeguarding: {
      // Every pipeline photo and film shows people; brush shapes and textures are not pipeline ids.
      peopleVisible: aiGenerated,
      childInImage: childPlaceholder,
      // Illustrations: no real, recognisable person is shown.
      identifiable: false,
      aiGenerated,
      // Child images are placeholders to replace with consented photography before launch (HANDOFF).
      placeholder: childPlaceholder,
      consent: NOT_REQUIRED,
      metadataStripped: true,
      locationRisk: "no",
    },
    status: "active",
  };
}

/** Every pipeline id as a MediaAsset record, plus the `fallback-warm` stand-in. */
export function pipelineAssets(meta: MediaMeta = {}): Record<string, MediaAsset> {
  const out: Record<string, MediaAsset> = {};
  for (const [id, src] of Object.entries(MAP.img)) out[id] = baseAsset(id, "image", src, undefined, meta[id]);
  for (const [id, src] of Object.entries(MAP.video)) out[id] = baseAsset(id, "video", src, poster(id), meta[id]);
  out[FALLBACK_MEDIA_ID] = {
    id: FALLBACK_MEDIA_ID,
    kind: "image",
    source: "pipeline",
    src: FALLBACK_SRC,
    alt: "",
    decorative: true,
    safeguarding: {
      peopleVisible: false,
      childInImage: false,
      identifiable: false,
      aiGenerated: false,
      placeholder: false,
      consent: NOT_REQUIRED,
      metadataStripped: true,
      locationRisk: "no",
    },
    status: "active",
  };
  return out;
}

/** True for ids that come from the git-tracked pipeline (they can be overridden, never deleted). */
export function isPipelineId(id: string): boolean {
  return id === FALLBACK_MEDIA_ID || id in MAP.img || id in MAP.video;
}

/** Pipeline ids by kind (for the video-only picker slots, content-model §6.7). */
export function pipelineIds(kind: "image" | "video"): string[] {
  return Object.keys(kind === "image" ? MAP.img : MAP.video);
}
