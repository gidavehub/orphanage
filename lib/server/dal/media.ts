import "server-only";

// Photos & files (admin-ux §6.13; PLAN D53–D54, D64): every picture and film the website can use,
// with its description, safeguarding answers, consent state and where it's used. Uploads go through
// /api/admin/media/upload and createMediaAsset; edits through updateMediaMeta; withdrawing consent
// (withdrawConsent) makes the file answer 410 and pages fall back to a warm neutral picture.

import { getLiveMediaUsage } from "@/lib/content/public";
import type { MediaAsset } from "@/lib/content/schema";
import { isIllustrative, readMediaIndexUncached } from "@/lib/media/index";
import type { ConsentState } from "@/lib/model/enums";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";

export type MediaItemDTO = {
  id: string;
  version: number;
  kind: "image" | "video" | "document";
  source: "pipeline" | "upload";
  src: string;
  poster: string | null;
  alt: string;
  decorative: boolean;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  status: MediaAsset["status"];
  illustrative: boolean;
  placeholder: boolean;
  peopleVisible: boolean;
  childInImage: boolean;
  identifiable: boolean;
  aiGenerated: boolean;
  consent: ConsentState;
  consentRef: string | null;
  locationRisk: "no" | "yes" | "unsure";
  usedIn: string[];
  /** A real photo of a child without valid consent: it can't be chosen for a page. */
  needsConsent: boolean;
};

async function versions(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    let cursor: string | null = null;
    for (let i = 0; i < 20; i++) {
      const page: { items: Array<{ id: string; version?: number }>; nextCursor: string | null } = await getStore().list<{ version?: number }>(C.media, { orderBy: { field: "updatedAt", dir: "asc" }, limit: 100, cursor });
      for (const r of page.items) out.set(r.id, r.version ?? 0);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } catch (err) {
    log.warn("dal.media.versions_failed", { err });
  }
  return out;
}

export async function listMediaForStaff(): Promise<{ items: MediaItemDTO[]; canUpload: boolean; canConsent: boolean }> {
  const v = await requireStaff("media.manage", "consent.status", "consent.manage");
  const [index, usage, vers] = await Promise.all([readMediaIndexUncached(), getLiveMediaUsage(), versions()]);
  const items = Object.values(index)
    .filter((a) => a.kind !== "document")
    .map((a): MediaItemDTO => {
      const sg = a.safeguarding;
      const consent = sg.consent.state;
      return {
        id: a.id,
        version: vers.get(a.id) ?? 0,
        kind: a.kind,
        source: a.source,
        src: a.src,
        poster: a.poster ?? null,
        alt: a.alt,
        decorative: a.decorative,
        caption: a.caption ?? null,
        credit: a.credit ?? null,
        width: a.width ?? null,
        height: a.height ?? null,
        status: a.status,
        illustrative: isIllustrative(a),
        placeholder: sg.placeholder,
        peopleVisible: sg.peopleVisible,
        childInImage: sg.childInImage,
        identifiable: sg.identifiable,
        aiGenerated: sg.aiGenerated,
        consent,
        consentRef: sg.consent.recordRef ?? null,
        locationRisk: sg.locationRisk,
        usedIn: usage[a.id] ?? [],
        needsConsent: sg.childInImage && !sg.aiGenerated && consent !== "valid" && consent !== "not_required",
      };
    })
    .sort((a, b) => Number(b.source === "upload") - Number(a.source === "upload") || a.id.localeCompare(b.id));
  return { items, canUpload: has(v, "media.manage"), canConsent: has(v, "consent.status") || has(v, "consent.manage") || has(v, "media.manage") };
}
