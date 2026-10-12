"use server";

// Photos & files Server Actions (admin-ux §6.13). The media actions check media.manage / consent
// permissions, validate the safeguarding answers and expire the media tag; these wrappers refresh the
// library after a change.

import { refresh } from "next/cache";
import { createMediaAsset, updateMediaMeta, withdrawConsent } from "@/lib/content/media-actions";

export async function addPhotoAction(input: { uploadId: string; meta: unknown }) {
  const r = await createMediaAsset(input);
  if (r.ok) refresh();
  return r;
}

export async function updatePhotoAction(input: { assetId: string; baseVersion: number; meta: unknown }) {
  const r = await updateMediaMeta(input);
  if (r.ok) refresh();
  return r;
}

export async function withdrawPhotoAction(id: string, note?: string) {
  const r = await withdrawConsent({ target: { kind: "media", id }, ...(note ? { note } : {}) });
  if (r.ok) refresh();
  return r;
}
