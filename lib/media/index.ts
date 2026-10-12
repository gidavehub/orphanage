import "server-only";

// The media index (content-model §6.2): every pipeline asset plus every stored asset (uploads and
// overrides). A stored asset with the same id as a pipeline asset overrides it — that is how
// "Replace this photo" works on a placeholder: every usage updates at once and the git-tracked
// pipeline file is untouched. Uploads are served from /m/public/media/{id}/{sha256-12}.webp (D98).

import { cacheLife, cacheTag } from "next/cache";
import { FALLBACK_MEDIA_ID, isPipelineId, pipelineAssets } from "./pipeline";
import { TAG } from "@/lib/cache/tags";
import { MEDIA_META } from "@/lib/content/defaults";
import { MediaAssetSchema, type MediaAsset } from "@/lib/content/schema";
import type { MediaPickerItem } from "@/lib/model/dto";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

export { FALLBACK_MEDIA_ID } from "./pipeline";

export type MediaIndex = Record<string, MediaAsset>;

/** Stored media records (uploads and overrides). Invalid records are skipped and logged. */
async function readStoredMedia(): Promise<MediaIndex> {
  const out: MediaIndex = {};
  try {
    let cursor: string | null = null;
    for (let guard = 0; guard < 100; guard++) {
      const page: { items: Array<{ id: string } & Record<string, unknown>>; nextCursor: string | null } = await getStore().list<Record<string, unknown>>(C.media, {
        orderBy: { field: "updatedAt", dir: "asc" },
        limit: 100,
        cursor,
      });
      for (const raw of page.items) {
        const r = MediaAssetSchema.safeParse({ ...raw, id: raw.id });
        if (r.success) out[r.data.id] = r.data;
        else log.error("content.invalid", { kind: "media", id: raw.id, issues: r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) });
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } catch (err) {
    if (resolveBackend() === "firestore" && (env as unknown as { isBuild?: boolean }).isBuild === true) throw err;
    log.error("content.read_failed", { what: "media", err });
  }
  return out;
}

/** The media index without the cache (write paths, gates, the admin library). */
export async function readMediaIndexUncached(): Promise<MediaIndex> {
  const base = pipelineAssets(MEDIA_META);
  const stored = await readStoredMedia();
  return { ...base, ...stored };
}

/** The media index for public reads ('use cache', tag "media"). */
export async function getMediaIndex(): Promise<MediaIndex> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.media);
  return readMediaIndexUncached();
}

/** The URL a page uses for an asset (pipeline: hashed /media URL; upload: /m/public/media/…). */
export function mediaUrl(asset: MediaAsset): string {
  return asset.src;
}

/** AI-generated with people visible: the page shows the "Illustrative image" label (D54). */
export function isIllustrative(asset: MediaAsset): boolean {
  return asset.safeguarding.aiGenerated && asset.safeguarding.peopleVisible;
}

/** Usable on a public page: active and consent not withdrawn. */
export function isUsable(asset: MediaAsset | undefined): asset is MediaAsset {
  return !!asset && asset.status === "active" && asset.safeguarding.consent.state !== "withdrawn";
}

/** The asset to show for an id: itself when usable, otherwise the neutral fallback. */
export function assetOrFallback(index: MediaIndex, id: string): { asset: MediaAsset; fellBack: boolean } {
  const a = index[id];
  if (isUsable(a)) return { asset: a, fellBack: false };
  const fallback = index[FALLBACK_MEDIA_ID] ?? pipelineAssets()[FALLBACK_MEDIA_ID];
  return { asset: fallback, fellBack: true };
}

/** One MediaPicker choice (admin). `usedIn` comes from the usage scan. */
export function toPickerItem(asset: MediaAsset, usedIn?: number): MediaPickerItem {
  return {
    id: asset.id,
    kind: asset.kind === "video" ? "video" : "image",
    source: asset.source,
    src: asset.src,
    ...(asset.poster ? { poster: asset.poster } : {}),
    alt: asset.alt,
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(asset.blurDataURL ? { blurDataURL: asset.blurDataURL } : {}),
    ...(asset.caption ? { caption: asset.caption } : {}),
    peopleVisible: asset.safeguarding.peopleVisible,
    childInImage: asset.safeguarding.childInImage,
    aiGenerated: asset.safeguarding.aiGenerated,
    illustrative: isIllustrative(asset),
    placeholder: asset.safeguarding.placeholder,
    consent: asset.safeguarding.consent.state,
    status: asset.status,
    ...(usedIn !== undefined ? { usedIn } : {}),
  };
}

/** Pipeline ids can be overridden by a stored record but never deleted. */
export { isPipelineId };
