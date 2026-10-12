import "server-only";

// The website studio's server side (admin-ux §6.10–6.11; PLAN D60–D62). Loads what a section sheet or
// a collection sheet needs: the current value (draft over published, merged with defaults), its
// version, a JSON Schema generated from the zod schema (the one source of field shapes and limits),
// the fields this person can't change and why, and the photo library for pictures. Also lists the
// changes not live yet with readable lines, for the PublishSheet.

import { z } from "zod";
import { canCreateItem, canEditCollection, canEditDoc, canEditPath, groupFor } from "@/lib/content/access";
import { diffPaths, readablePath } from "@/lib/content/diff";
import { DOC_IDS, isCollectionName, type CollectionName, type DocId } from "@/lib/content/ids";
import { loadDoc } from "@/lib/content/read";
import { COLLECTIONS, DOCS } from "@/lib/content/registry";
import { DocSchemas, ItemSchemas } from "@/lib/content/schema";
import { contentStore, listDrafts } from "@/lib/content/store";
import type { RecordKey, Visibility } from "@/lib/content/types";
import { getMediaIndex, toPickerItem } from "@/lib/media/index";
import type { MediaPickerItem } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { staffRefs } from "@/lib/server/dal/_shared";
import { SECTION_COLLECTION } from "./registry";

export type JsonSchema = Record<string, unknown>;

const schemaCache = new Map<string, JsonSchema>();
function jsonSchemaOf(key: string, s: z.ZodType): JsonSchema {
  const hit = schemaCache.get(key);
  if (hit) return hit;
  // A JSON round-trip makes it a plain object (React passes only plain objects to the client).
  const out = JSON.parse(JSON.stringify(z.toJSONSchema(s, { io: "input", unrepresentable: "any" }))) as JsonSchema;
  schemaCache.set(key, out);
  return out;
}

async function pickerItems(): Promise<MediaPickerItem[]> {
  const index = await getMediaIndex();
  return Object.values(index)
    .filter((a) => a.kind === "image" || a.kind === "video")
    .map((a) => toPickerItem(a));
}

export type SectionDTO = {
  id: DocId;
  label: string;
  value: unknown;
  version: number;
  hasDraft: boolean;
  schema: JsonSchema;
  /** Top-level fields this person can't change, with the reason. */
  locked: Record<string, string>;
  canEdit: boolean;
  canPublish: boolean;
  managedIn: string | null;
  related: { name: CollectionName; label: string } | null;
  videoPaths: string[];
  media: MediaPickerItem[];
};

export async function loadSection(id: string): Promise<SectionDTO | null> {
  const v = await requireStaff("content.read", "content.edit");
  if (!(DOC_IDS as readonly string[]).includes(id)) return null;
  const doc = id as DocId;
  const spec = DOCS[doc];
  const [rec, value, media] = await Promise.all([contentStore().getDoc(doc), loadDoc(doc, { preview: true }), pickerItems()]);
  const editable = has(v, "content.edit") && canEditDoc(v.roles, doc);
  const locked: Record<string, string> = {};
  for (const key of Object.keys((value as Record<string, unknown>) ?? {})) {
    if (!editable || !canEditPath(v.roles, spec, key, value)) locked[key] = groupFor(spec, key, { before: value, after: value })?.message ?? "You don't have access to change this.";
  }
  const related = SECTION_COLLECTION[doc];
  return {
    id: doc,
    label: spec.label,
    value,
    version: rec?.version ?? 0,
    hasDraft: Boolean(rec?.draft),
    schema: jsonSchemaOf(`doc:${doc}`, DocSchemas[doc] as z.ZodType),
    locked,
    canEdit: editable,
    canPublish: has(v, "content.publish"),
    managedIn: "managedIn" in spec.studio ? spec.studio.managedIn : null,
    related: related ? { name: related, label: COLLECTIONS[related].label } : null,
    videoPaths: [...(spec.videoPaths ?? [])],
    media,
  };
}

export type CollectionItemDTO = { id: string; label: string; value: unknown; version: number; visibility: Visibility; hasDraft: boolean; everLive: boolean; placeholder: boolean; locked: Record<string, string> };

export type CollectionDTO = {
  name: CollectionName;
  label: string;
  itemLabel: string;
  items: CollectionItemDTO[];
  schema: JsonSchema;
  canEdit: boolean;
  canCreate: boolean;
  canPublish: boolean;
  fixedIds: boolean;
  managedIn: string;
  media: MediaPickerItem[];
};

const LABEL_KEYS = ["title", "label", "name", "q", "question", "headline", "quote", "text"];

export function itemLabelOf(value: unknown, fallback: string): string {
  const v = (value ?? {}) as Record<string, unknown>;
  for (const k of LABEL_KEYS) {
    const x = v[k];
    if (typeof x === "string" && x.trim()) return x.trim().slice(0, 80);
    if (Array.isArray(x) && typeof x[0] === "string") return x.join(" ").slice(0, 80);
  }
  return fallback;
}

export async function loadCollection(name: string): Promise<CollectionDTO | null> {
  const v = await requireStaff("content.read", "content.edit", "media.manage");
  if (!isCollectionName(name) || name === "posts" || name === "media" || name === "causes") return null;
  const spec = COLLECTIONS[name];
  const [records, media] = await Promise.all([contentStore().listItems(name), pickerItems()]);
  const editable = has(v, "content.edit") && canEditCollection(v.roles, name);
  const items = records
    .filter((r) => r.visibility !== "archived" && (r.draft ?? r.published))
    .map((r) => {
      const value = r.draft ?? r.published;
      const locked: Record<string, string> = {};
      for (const key of Object.keys((value as Record<string, unknown>) ?? {})) {
        if (!editable || !canEditPath(v.roles, spec, key, value)) locked[key] = groupFor(spec, key, { before: value, after: value })?.message ?? "You don't have access to change this.";
      }
      return {
        id: r.id,
        label: itemLabelOf(value, `${spec.itemLabel} ${r.id}`),
        value,
        version: r.version,
        visibility: r.visibility,
        hasDraft: r.draft !== null,
        everLive: r.published !== null,
        placeholder: r.placeholder === true,
        locked,
      };
    })
    .sort((a, b) => (((a.value as { order?: number }).order ?? 0) - ((b.value as { order?: number }).order ?? 0)) || a.id.localeCompare(b.id));
  return {
    name,
    label: spec.label,
    itemLabel: spec.itemLabel,
    items,
    schema: jsonSchemaOf(`col:${name}`, ItemSchemas[name] as z.ZodType),
    canEdit: editable,
    canCreate: editable && canCreateItem(v.roles, name),
    canPublish: has(v, "content.publish"),
    fixedIds: spec.fixedIds === true,
    managedIn: spec.managedIn,
    media,
  };
}

export type DraftChangeDTO = { key: RecordKey; label: string; at: Millis; by: string; version: number; lines: string[]; everLive: boolean };

/** The changes not live yet, each with up to six readable lines ("Hero slide 2 · headline"). */
export async function draftChanges(): Promise<DraftChangeDTO[]> {
  await requireStaff("content.read", "content.edit");
  const [drafts, staff] = await Promise.all([listDrafts(), staffRefs()]);
  const out: DraftChangeDTO[] = [];
  for (const d of drafts) {
    const rec = d.key.kind === "doc" ? await contentStore().getDoc(d.key.id) : await contentStore().getItem(d.key.collection, d.key.id);
    const before = rec?.published ?? (d.key.kind === "doc" ? await loadDoc(d.key.id) : {});
    const changes = diffPaths(before, rec?.draft ?? {});
    out.push({
      key: d.key,
      label: d.key.kind === "item" ? `${COLLECTIONS[d.key.collection].label} · ${d.label}` : d.label,
      at: d.updatedAt,
      by: staff.get(d.updatedBy)?.name ?? (d.updatedBy.startsWith("loc_seed") || d.updatedBy === "seed" ? "Haven" : "a team member"),
      version: d.version,
      lines: rec?.published ? changes.slice(0, 6).map((c) => readablePath(c.path)) : ["New, not on the website yet"],
      everLive: Boolean(rec?.published),
    });
  }
  return out;
}
