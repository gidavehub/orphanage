// The one cache-tag registry (PLAN D140, §4.5). Every cacheTag / updateTag / revalidateTag call uses
// these builders, never a hand-typed string. Tags are plain, at most 256 characters, and never carry
// personal data.
//   content:<docId>                 a content singleton (siteContent/<docId>)
//   col:<collection>                a whole collection (lists, indexes)
//   <collection>:<id|slug|code>     one item
//   media                           the media index
//   donations:totals                causeTotals (public "raised" figures)
//   settings:<payment|org|forms>    public system settings
// Writers: Server Actions → updateTag(tag); route handlers and cron → revalidateTag(tag, 'max');
// cron-published posts → revalidateTag(tag, { expire: 0 }).

import type { CollectionName, DocId } from "@/lib/content/ids";

/** Collections that are tagged but are not content collections. */
export type SystemTaggedCollection = "resources" | "sponsorProfiles";
export type TaggedCollection = CollectionName | SystemTaggedCollection;

export type PublicSettingsKey = "payment" | "org" | "forms";

export const TAG = {
  doc: (id: DocId) => `content:${id}`,
  col: (c: TaggedCollection) => `col:${c}`,
  item: (c: TaggedCollection, key: string) => `${c}:${key}`,
  media: "media",
  donationTotals: "donations:totals",
  settings: (k: PublicSettingsKey) => `settings:${k}`,
} as const;

/** Tags to invalidate when one item changes: its collection, its id and (when different) its slug. */
export function tagsForItem(c: CollectionName, item: { id: string; slug?: string }): string[] {
  const tags = [TAG.col(c), TAG.item(c, item.id)];
  if (item.slug && item.slug !== item.id) tags.push(TAG.item(c, item.slug));
  return tags;
}
