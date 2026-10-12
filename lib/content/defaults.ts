import "server-only";

// The defaults every content read falls back to (content-model §3.7, G1): every singleton and every
// collection's seed items, parsed with their schemas once at module load. A seed that fails its
// schema throws here, loudly, in development and during `next build` (the home page is prerendered),
// so an invalid seed can never ship. This module and lib/server/public/resources.ts are the only
// importers of content/seed/** (PLAN §4.2 rule 3).

import { CONTACT_SEED_VALUES, docSeeds, itemSeeds, mediaMeta, placeholderDocIds } from "@/content/seed";
import { COLLECTION_NAMES, DOC_IDS, type CollectionName, type DocId } from "./ids";
import { DocSchemas, ItemSchemas, type DocData, type Item, type Visibility } from "./schema";

export type DefaultItem<C extends CollectionName> = {
  id: string;
  placeholder: boolean;
  visibility: Visibility;
  data: Item<C>;
};

function describe(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 8)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

function parseDocs(): { [K in DocId]: DocData<K> } {
  const out: Partial<Record<DocId, unknown>> = {};
  const problems: string[] = [];
  for (const id of DOC_IDS) {
    const r = DocSchemas[id].safeParse(docSeeds[id]);
    if (r.success) out[id] = r.data;
    else problems.push(`${id} → ${describe(r.error.issues)}`);
  }
  if (problems.length) throw new Error(`[haven] Content seeds failed their schemas (content/seed):\n- ${problems.join("\n- ")}`);
  return out as { [K in DocId]: DocData<K> };
}

function parseItems(): { [C in CollectionName]: DefaultItem<C>[] } {
  const out: Partial<Record<CollectionName, DefaultItem<CollectionName>[]>> = {};
  const problems: string[] = [];
  for (const c of COLLECTION_NAMES) {
    const seen = new Set<string>();
    const list: DefaultItem<CollectionName>[] = [];
    for (const seed of itemSeeds[c] as Array<{ id: string; placeholder?: boolean; visibility?: Visibility }>) {
      if (seen.has(seed.id)) problems.push(`${c}/${seed.id} → duplicate id`);
      seen.add(seed.id);
      const r = ItemSchemas[c].safeParse(seed);
      if (!r.success) {
        problems.push(`${c}/${seed.id} → ${describe(r.error.issues)}`);
        continue;
      }
      list.push({ id: seed.id, placeholder: seed.placeholder === true, visibility: seed.visibility ?? "live", data: r.data as Item<CollectionName> });
    }
    out[c] = list;
  }
  if (problems.length) throw new Error(`[haven] Content seeds failed their schemas (content/seed):\n- ${problems.join("\n- ")}`);
  return out as { [C in CollectionName]: DefaultItem<C>[] };
}

/** Every singleton's default (parsed: defaults filled). */
export const DEFAULT_DOCS = parseDocs();

/** Every collection's seed items (parsed), used until the collection's first admin write seeds it. */
export const DEFAULT_ITEMS = parseItems();

/** Singletons still holding // CLIENT values (Before-launch checklist). */
export const PLACEHOLDER_DOC_IDS: ReadonlySet<DocId> = new Set(placeholderDocIds);

/** Alt text for pipeline media (content/seed/media-meta.ts). */
export const MEDIA_META = mediaMeta;

/** Contact values that are still placeholders while unchanged (D130). */
export const CONTACT_SEEDS = CONTACT_SEED_VALUES;

/** A fresh copy of a singleton's default. */
export function defaultDoc<K extends DocId>(id: K): DocData<K> {
  return structuredClone(DEFAULT_DOCS[id]);
}

/** A fresh copy of one seeded item, or null. */
export function defaultItem<C extends CollectionName>(c: C, id: string): DefaultItem<C> | null {
  const found = (DEFAULT_ITEMS[c] as DefaultItem<C>[]).find((x) => x.id === id);
  return found ? structuredClone(found) : null;
}
