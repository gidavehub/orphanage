import "server-only";

// The content store and the content write pipeline (content-model §4.2, §5.2; PLAN D28, D31–D33,
// D61, D93). One DocStore engine (lib/server/db): singletons live in `siteContent/{docId}`, items in
// their collections, each in the StoredRecord envelope; previous published values are snapshotted
// to the `versions` subcollection (the last 20 are kept). `version` is the only concurrency control.
//
// The write core below takes an actor (a signed-in Viewer or a system job) and returns the
// ActionResult plus the cache tags the caller must invalidate:
//   Server Actions (lib/content/*actions.ts) → requireStaff, then updateTag(tag) for each tag;
//   route handlers and cron → revalidateTag(tag, 'max') (cron-published posts: { expire: 0 }).
// Every write runs the same eight steps: permission → validation → optimistic version check →
// field groups → publish gate → audit → version snapshot → tags.

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DEFAULT_DOCS, DEFAULT_ITEMS, PLACEHOLDER_DOC_IDS, type DefaultItem } from "./defaults";
import { deniedMessage, deniedPaths, canCreateItem, canEditCollection, canEditDoc, canVerifyStat } from "./access";
import { diffPaths, extraPaths, summarizeChanges, type Change } from "./diff";
import { gateReasons, videoSlotReasons } from "./gate";
import { COLLECTION_NAMES, DOC_IDS, type CollectionName, type DocId } from "./ids";
import { COLLECTIONS, DOCS, type CollectionSpec, type DocSpec } from "./registry";
import { VISIBILITIES, type EnvelopedCollection, type StoredRecord, type Visibility } from "./schema";
import type { RecordKey, VersionMeta } from "./types";
import { readMediaIndexUncached } from "@/lib/media/index";
import { TAG } from "@/lib/cache/tags";
import { actionError, actionOk, type ActionError, type ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { Permission, Role } from "@/lib/model/permissions";
import type { SystemActor, Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { getStore, storeAvailable } from "@/lib/server/db";
import { assertDocId, C, type CollectionKey } from "@/lib/server/db/collections";
import { BackendUnavailableError, type Tx, type WithId } from "@/lib/server/db/store";
import { env, resolveBackend, type Backend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

/* ── Paths and envelope ────────────────────────────────────────────────── */

/** Versions kept per record (D31). */
export const VERSIONS_KEPT = 20;

const SEED_MARKER = `${C.siteContent}/_seeded`;

type Envelope = Omit<StoredRecord<unknown>, "id"> & { updatedByName?: string };
type SeedMarker = { collections: Partial<Record<CollectionName, Millis>> };

/** The DocStore path of a record. */
export function recordPath(key: RecordKey): string {
  if (key.kind === "doc") return `${C.siteContent}/${assertDocId(key.id)}`;
  return `${C[key.collection as CollectionKey]}/${assertDocId(key.id)}`;
}

function versionsPath(key: RecordKey): string {
  return `${recordPath(key)}/versions`;
}

function toRecord(id: string, raw: WithId<Partial<Envelope>> | null): (StoredRecord<unknown> & { updatedByName?: string }) | null {
  if (!raw) return null;
  const visibility = (VISIBILITIES as readonly string[]).includes(raw.visibility as string) ? (raw.visibility as Visibility) : "live";
  return {
    id,
    published: raw.published ?? null,
    draft: raw.draft ?? null,
    version: typeof raw.version === "number" ? raw.version : 0,
    visibility,
    ...(raw.placeholder ? { placeholder: true } : {}),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
    createdBy: raw.createdBy ?? "seed",
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    updatedBy: raw.updatedBy ?? "seed",
    ...(typeof raw.publishedAt === "number" ? { publishedAt: raw.publishedAt } : {}),
    ...(raw.publishedBy ? { publishedBy: raw.publishedBy } : {}),
    ...(raw.updatedByName ? { updatedByName: raw.updatedByName } : {}),
  };
}

function envelopeOf(rec: StoredRecord<unknown>, updatedByName?: string): Envelope {
  const { id: _id, ...rest } = rec;
  void _id;
  const out: Envelope = { ...rest };
  if (updatedByName) out.updatedByName = updatedByName;
  // DocStore rejects undefined in some adapters; drop optional fields that are unset.
  for (const k of Object.keys(out) as Array<keyof Envelope>) if (out[k] === undefined) delete out[k];
  return out;
}

function seedRecord<C extends CollectionName>(item: DefaultItem<C>): StoredRecord<unknown> {
  return {
    id: item.id,
    published: structuredClone(item.data),
    draft: null,
    version: 0,
    visibility: item.visibility,
    ...(item.placeholder ? { placeholder: true } : {}),
    createdAt: 0,
    createdBy: "seed",
    updatedAt: 0,
    updatedBy: "seed",
  };
}

/* ── Read side ─────────────────────────────────────────────────────────── */

export interface ContentStore {
  /** Which backend content reads and writes use (D33). */
  readonly mode: Backend;
  /** False when writes would be refused (backend "unavailable" or the engine not connected). */
  readonly writable: boolean;
  getDoc(id: DocId): Promise<StoredRecord<unknown> | null>;
  getItem(c: CollectionName, id: string): Promise<StoredRecord<unknown> | null>;
  /** Every stored item of a seeded collection, or the seed records when it was never written. */
  listItems(c: CollectionName): Promise<StoredRecord<unknown>[]>;
  isSeeded(c: CollectionName): Promise<boolean>;
  listVersions(key: RecordKey, limit?: number): Promise<VersionMeta[]>;
  getVersion(key: RecordKey, version: number): Promise<unknown | null>;
}

/** True while `next build` prerenders (provided by lib/server/env.ts when available). */
function isBuildPhase(): boolean {
  return (env as unknown as { isBuild?: boolean }).isBuild === true;
}

/**
 * Runs a read and falls back on failure (G3: bad data never breaks a page). In Firestore mode during
 * a production build, a failure throws instead, so seeds are never baked into production by accident.
 */
async function safeRead<T>(what: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (resolveBackend() === "firestore" && isBuildPhase()) throw err;
    log.error("content.read_failed", { what, err });
    return fallback;
  }
}

async function listAll(collectionPath: string): Promise<Array<WithId<Partial<Envelope>>>> {
  const out: Array<WithId<Partial<Envelope>>> = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 100; guard++) {
    const page: { items: Array<WithId<Partial<Envelope>>>; nextCursor: string | null } = await getStore().list<Partial<Envelope>>(collectionPath, {
      orderBy: { field: "createdAt", dir: "asc" },
      limit: 100,
      cursor,
    });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

async function readMarker(): Promise<SeedMarker> {
  const m = await getStore().get<SeedMarker>(SEED_MARKER);
  return { collections: m?.collections ?? {} };
}

const contentStoreImpl: ContentStore = {
  get mode() {
    return resolveBackend();
  },
  get writable() {
    return resolveBackend() !== "unavailable" && storeAvailable();
  },
  async getDoc(id) {
    return safeRead(`doc:${id}`, async () => toRecord(id, await getStore().get<Partial<Envelope>>(recordPath({ kind: "doc", id }))), null);
  },
  async getItem(c, id) {
    const seeded = await this.isSeeded(c);
    if (!seeded) {
      const seed = (DEFAULT_ITEMS[c] as DefaultItem<CollectionName>[]).find((x) => x.id === id);
      return seed ? seedRecord(seed) : null;
    }
    return safeRead(`item:${c}/${id}`, async () => toRecord(id, await getStore().get<Partial<Envelope>>(recordPath({ kind: "item", collection: c, id }))), null);
  },
  async listItems(c) {
    const seeded = await this.isSeeded(c);
    if (!seeded) return (DEFAULT_ITEMS[c] as DefaultItem<CollectionName>[]).map(seedRecord);
    return safeRead(
      `list:${c}`,
      async () => (await listAll(C[c as CollectionKey])).map((r) => toRecord(r.id, r)).filter((r): r is StoredRecord<unknown> => r !== null),
      (DEFAULT_ITEMS[c] as DefaultItem<CollectionName>[]).map(seedRecord),
    );
  },
  async isSeeded(c) {
    if (c === "media") return true;
    return safeRead(`seeded:${c}`, async () => typeof (await readMarker()).collections[c] === "number", false);
  },
  async listVersions(key, limit = VERSIONS_KEPT) {
    return safeRead(
      `versions:${recordPath(key)}`,
      async () => {
        const page = await getStore().list<{ version: number; by: string; at: Millis; note?: string }>(versionsPath(key), {
          orderBy: { field: "version", dir: "desc" },
          limit: Math.max(1, Math.min(100, limit)),
        });
        return page.items.map((v) => ({ version: v.version, by: v.by, at: v.at, ...(v.note ? { note: v.note } : {}) }));
      },
      [],
    );
  },
  async getVersion(key, version) {
    return safeRead(
      `version:${recordPath(key)}/${version}`,
      async () => (await getStore().get<{ snapshot: unknown }>(`${versionsPath(key)}/${Math.trunc(version)}`))?.snapshot ?? null,
      null,
    );
  },
};

/** The content store over the DocStore engine. */
export function contentStore(): ContentStore {
  return contentStoreImpl;
}

/* ── Actors and results ────────────────────────────────────────────────── */

/** A signed-in staff member, or a server job (scheduler, AI drafter, dev helpers). */
export type ContentActor = Viewer | SystemActor;

export type WriteOutcome<T = { version: number; at: Millis }> = {
  result: ActionResult<T>;
  /** Cache tags to invalidate (updateTag in Server Actions; revalidateTag in route handlers and cron). */
  tags: string[];
};

const isSystem = (a: ContentActor): a is SystemActor => "kind" in a && (a as SystemActor).kind === "system";
const rolesOf = (a: ContentActor): readonly Role[] => (isSystem(a) ? ["super_admin"] : a.roles);
const actorId = (a: ContentActor): string => (isSystem(a) ? `system:${a.job}` : a.uid);
const actorName = (a: ContentActor): string => (isSystem(a) ? a.job : a.displayName);
const hasPerm = (a: ContentActor, p: Permission): boolean => isSystem(a) || a.perms.has(p);

const UNAVAILABLE =
  "Saving isn't switched on for this site yet. Your changes were not lost: copy them somewhere safe and try again once the database is connected.";

const done = <T>(result: ActionResult<T>, tags: string[] = []): WriteOutcome<T> => ({ result, tags });
const fail = <T = { version: number; at: Millis }>(error: ActionError): WriteOutcome<T> => done(actionError<T>(error));
const forbidden = <T = { version: number; at: Millis }>(message: string, paths?: string[]) =>
  fail<T>({ kind: "forbidden", message, ...(paths?.length ? { paths } : {}) });
const notAllowed = <T = { version: number; at: Millis }>(message: string) => fail<T>({ kind: "not_allowed", message });
const unavailable = <T = { version: number; at: Millis }>() => fail<T>({ kind: "unavailable", message: UNAVAILABLE });

function validationFrom(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>, prefix?: string): ActionError {
  const fields: Record<string, string> = {};
  for (const i of issues) {
    const key = [prefix, ...i.path.map(String)].filter(Boolean).join(".") || "_form";
    if (fields[key] === undefined) fields[key] = i.message;
  }
  return { kind: "validation", fields };
}

function conflictOf(rec: (StoredRecord<unknown> & { updatedByName?: string }) | null): ActionError {
  return {
    kind: "conflict",
    message: "Someone else saved a change a moment ago. Load their version, then make your change again.",
    current: { version: rec?.version ?? 0, updatedBy: rec?.updatedByName ?? rec?.updatedBy ?? "someone", updatedAt: rec?.updatedAt ?? 0 },
  };
}

function writable(): boolean {
  return resolveBackend() !== "unavailable" && storeAvailable();
}

/** Maps engine failures to friendly results; anything unexpected is logged and rethrown. */
async function guarded<T>(what: string, fn: () => Promise<WriteOutcome<T>>): Promise<WriteOutcome<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BackendUnavailableError) return unavailable<T>();
    if (err instanceof ConflictSignal) return fail<T>(err.error);
    log.error("content.write_failed", { what, err });
    throw err;
  }
}

/** Thrown inside a transaction to abort it with an expected failure (no writes happen). */
class ConflictSignal extends Error {
  constructor(readonly error: ActionError) {
    super(error.kind);
  }
}

function labelOf(key: RecordKey, data?: unknown): string {
  if (key.kind === "doc") return DOCS[key.id].label;
  const d = (data ?? {}) as { title?: string; label?: string; name?: string; q?: string };
  const name = d.title ?? d.label ?? d.name ?? d.q ?? key.id;
  return `${COLLECTIONS[key.collection].label}: ${String(name).slice(0, 60)}`;
}

function tagsFor(key: RecordKey, data?: unknown): string[] {
  if (key.kind === "doc") return DOCS[key.id].tags();
  const slug = (data as { slug?: string } | null)?.slug;
  return COLLECTIONS[key.collection].tags({ id: key.id, ...(slug ? { slug } : {}) });
}

function auditWrite(
  tx: Tx,
  actor: ContentActor,
  key: RecordKey,
  action: string,
  verb: string,
  data: unknown,
  changes?: Change[],
  feed = false,
): void {
  auditTx(tx, {
    actor: actorOf(actor),
    action,
    area: "content",
    summary: `${actorName(actor)} ${verb.includes("{label}") ? verb.replace("{label}", labelOf(key, data)) : `${verb} ${labelOf(key, data)}`}`.slice(0, 200),
    feed,
    targetPath: recordPath(key),
    targetRef: null,
    changes: changes?.length ? summarizeChanges(changes) : null,
  });
}

function snapshotVersion(tx: Tx, key: RecordKey, version: number, snapshot: unknown, actor: ContentActor, at: Millis, note?: string): void {
  tx.set(`${versionsPath(key)}/${Math.trunc(version)}`, {
    version,
    by: actorName(actor),
    at,
    ...(note ? { note } : {}),
    snapshot: snapshot ?? null,
  });
}

async function pruneVersions(key: RecordKey): Promise<void> {
  try {
    const page = await getStore().list<{ version: number }>(versionsPath(key), { orderBy: { field: "version", dir: "desc" }, limit: 100 });
    const extra = page.items.slice(VERSIONS_KEPT);
    if (extra.length) await getStore().batch((b) => extra.forEach((v) => b.delete(`${versionsPath(key)}/${v.id}`)));
  } catch (err) {
    log.warn("content.prune_versions_failed", { path: recordPath(key), err });
  }
}

/* ── Seeding collections on first write (content-model §5.2) ───────────── */

/**
 * Writes a collection's seed items as published records the first time anyone writes to it, so the
 * stored set becomes the truth (a deleted seed item stays deleted). Idempotent and race-safe.
 */
export async function ensureSeeded(c: CollectionName): Promise<void> {
  if (c === "media") return;
  await getStore().runTransaction(async (tx) => {
    const found = await tx.get<SeedMarker>(SEED_MARKER);
    const marker: SeedMarker = { collections: found?.collections ?? {} };
    if (typeof marker.collections[c] === "number") return;
    const now = Date.now();
    for (const item of DEFAULT_ITEMS[c] as DefaultItem<CollectionName>[]) {
      const rec = seedRecord(item);
      tx.set(recordPath({ kind: "item", collection: c, id: item.id }), envelopeOf({ ...rec, createdAt: now, updatedAt: now }));
    }
    tx.set(SEED_MARKER, { collections: { ...marker.collections, [c]: now } });
  });
}

/* ── Singletons ────────────────────────────────────────────────────────── */

export const SaveDocInput = z.object({
  id: z.enum(DOC_IDS),
  baseVersion: z.number().int().min(0),
  data: z.unknown(),
  intent: z.enum(["draft", "publish"]),
});
export type SaveDocInput = z.input<typeof SaveDocInput>;

function staffCanWriteDoc(actor: ContentActor, id: DocId, intent: "draft" | "publish"): WriteOutcome | null {
  if (isSystem(actor)) return null;
  if (!hasPerm(actor, "content.edit")) return forbidden("You don't have access to edit the website.");
  if (intent === "publish" && !hasPerm(actor, "content.publish")) return forbidden("You can save drafts, but someone else needs to put this live.");
  if (!canEditDoc(actor.roles, id)) return forbidden("You don't have access to this section.");
  return null;
}

/** The figures a verification vouches for: a stat's value, a cause's goal, opening balance and breakdown. */
const VERIFIED_FIELDS: Partial<Record<CollectionName, readonly string[]>> = {
  stats: ["value", "suffix", "amounts"],
  causes: ["currency", "goal", "offlineRaised", "convertedRaised", "allocation"],
  allocationSummaries: ["periodStart", "periodEnd", "byCurrency"],
};

/** Stamps verification on stats and causes changed by someone allowed to verify (D45–D47). */
function stampVerification(c: CollectionName, actor: ContentActor, before: unknown, after: Record<string, unknown>, now: Millis): Record<string, unknown> {
  const fields = VERIFIED_FIELDS[c];
  if (!fields) return after;
  const v = (after.verification ?? {}) as { status?: string; verifiedBy?: string; verifiedAt?: number; evidence?: string };
  const prevV = ((before as { verification?: typeof v } | null)?.verification ?? {}) as typeof v;
  if (v.status !== "verified") return { ...after, verification: { status: "placeholder", ...(v.evidence ? { evidence: v.evidence } : {}) } };
  const pick = (o: unknown, status?: string) => ({ ...Object.fromEntries(fields.map((f) => [f, (o as Record<string, unknown> | null)?.[f]])), status });
  const changed = diffPaths(pick(before, prevV.status), pick(after, v.status)).length > 0;
  if (!changed && prevV.verifiedBy && prevV.verifiedAt) return { ...after, verification: { ...v, verifiedBy: prevV.verifiedBy, verifiedAt: prevV.verifiedAt } };
  const kind = (c === "stats" ? (after.kind ?? "programme") : "finance") as "programme" | "finance" | "organisation";
  if (!canVerifyStat(rolesOf(actor), kind)) return { ...after, verification: { status: "placeholder", ...(v.evidence ? { evidence: v.evidence } : {}) } };
  return { ...after, verification: { ...v, status: "verified", verifiedBy: actorId(actor), verifiedAt: now } };
}

/**
 * Saves a singleton as a draft (preview only) or publishes it ("Save & update the website").
 * Drafts need no tag; publishing returns the doc's tag.
 */
export async function writeDoc(actor: ContentActor, input: unknown): Promise<WriteOutcome> {
  const parsedInput = SaveDocInput.safeParse(input);
  if (!parsedInput.success) return fail(validationFrom(parsedInput.error.issues));
  const { id, baseVersion, data, intent } = parsedInput.data;
  const denied = staffCanWriteDoc(actor, id, intent);
  if (denied) return denied;
  const spec: DocSpec = DOCS[id];
  const parsed = spec.schema.safeParse(data);
  if (!parsed.success) return fail(validationFrom(parsed.error.issues));
  const extras = extraPaths(data, parsed.data);
  if (extras.length) return fail({ kind: "validation", fields: Object.fromEntries(extras.map((p) => [p, "This isn't part of this section."])) });
  if (!writable()) return unavailable();

  const key: RecordKey = { kind: "doc", id };
  const index = intent === "publish" ? await readMediaIndexUncached() : {};
  return guarded(`doc:${id}`, async () => {
    const out = await getStore().runTransaction(async (tx) => {
      const rec = toRecord(id, await tx.get<Partial<Envelope>>(recordPath(key))) as (StoredRecord<unknown> & { updatedByName?: string }) | null;
      if ((rec?.version ?? 0) !== baseVersion) throw new ConflictSignal(conflictOf(rec));
      const before = rec?.draft ?? rec?.published ?? DEFAULT_DOCS[id];
      const changes = diffPaths(before, parsed.data);
      if (!isSystem(actor)) {
        const deniedList = deniedPaths(actor.roles, spec, changes.map((c) => c.path), { before, after: parsed.data });
        if (deniedList.length) throw new ConflictSignal({ kind: "forbidden", message: deniedMessage(spec, deniedList, { before, after: parsed.data }), paths: deniedList });
      }
      const now = Date.now();
      if (intent === "publish") {
        const reasons = [
          ...gateReasons(spec.publishGate, parsed.data, { index, previous: rec?.published ?? null, placeholder: rec ? rec.placeholder === true : PLACEHOLDER_DOC_IDS.has(id), now }),
          ...videoSlotReasons(parsed.data, spec.videoPaths ?? [], index),
        ];
        if (reasons.length) throw new ConflictSignal({ kind: "blocked", message: "This can't go live yet.", reasons });
      }
      const next: StoredRecord<unknown> = {
        id,
        published: intent === "publish" ? parsed.data : (rec?.published ?? null),
        draft: intent === "publish" ? null : parsed.data,
        version: baseVersion + 1,
        visibility: "live",
        ...((rec ? rec.placeholder === true : PLACEHOLDER_DOC_IDS.has(id)) ? { placeholder: true } : {}),
        createdAt: rec?.createdAt || now,
        createdBy: rec?.createdBy ?? actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
        ...(intent === "publish" ? { publishedAt: now, publishedBy: actorId(actor) } : rec?.publishedAt ? { publishedAt: rec.publishedAt, publishedBy: rec.publishedBy } : {}),
      };
      tx.set(recordPath(key), envelopeOf(next, actorName(actor)));
      if (intent === "publish") snapshotVersion(tx, key, baseVersion, rec?.published ?? DEFAULT_DOCS[id], actor, now);
      const changesVsLive = intent === "publish" ? diffPaths(rec?.published ?? DEFAULT_DOCS[id], parsed.data) : changes;
      auditWrite(tx, actor, key, intent === "publish" ? "content.publish" : "content.save", intent === "publish" ? "put {label} live" : "saved a draft of {label}", parsed.data, changesVsLive, intent === "publish");
      return { version: next.version, at: now };
    });
    if (intent === "publish") await pruneVersions(key);
    return done(actionOk(out), intent === "publish" ? spec.tags() : []);
  });
}

/** Throws away the unpublished draft of a singleton (the publish sheet's "Undo this change"). */
export async function discardDocDraft(actor: ContentActor, input: unknown): Promise<WriteOutcome> {
  const parsed = z.object({ id: z.enum(DOC_IDS), baseVersion: z.number().int().min(0) }).safeParse(input);
  if (!parsed.success) return fail(validationFrom(parsed.error.issues));
  const { id, baseVersion } = parsed.data;
  const denied = staffCanWriteDoc(actor, id, "draft");
  if (denied) return denied;
  if (!writable()) return unavailable();
  const key: RecordKey = { kind: "doc", id };
  return guarded(`discard:${id}`, async () => {
    const out = await getStore().runTransaction(async (tx) => {
      const rec = toRecord(id, await tx.get<Partial<Envelope>>(recordPath(key)));
      if (!rec || rec.version !== baseVersion) throw new ConflictSignal(conflictOf(rec));
      if (rec.draft === null) return { version: rec.version, at: rec.updatedAt };
      const now = Date.now();
      tx.set(recordPath(key), envelopeOf({ ...rec, draft: null, version: rec.version + 1, updatedAt: now, updatedBy: actorId(actor) }, actorName(actor)));
      auditWrite(tx, actor, key, "content.discard", "discarded the draft of", rec.draft);
      return { version: rec.version + 1, at: now };
    });
    return done(actionOk(out));
  });
}

/**
 * Brings back an earlier published version: into the draft (default; it then goes through Preview
 * and Publish), or live straight away (the Key information editor's 10-second Undo, D61).
 */
export async function restoreDoc(actor: ContentActor, input: unknown): Promise<WriteOutcome> {
  const parsed = z
    .object({
      id: z.enum(DOC_IDS),
      version: z.number().int().min(0),
      baseVersion: z.number().int().min(0),
      intent: z.enum(["draft", "publish"]).default("draft"),
    })
    .safeParse(input);
  if (!parsed.success) return fail(validationFrom(parsed.error.issues));
  const { id, version, baseVersion, intent } = parsed.data;
  const snapshot = await contentStore().getVersion({ kind: "doc", id }, version);
  if (snapshot === null) return notAllowed("That earlier version is no longer available.");
  // An older version may predate fields added since: fill them from the defaults and drop retired keys.
  const merged = DOCS[id].schema.safeParse({ ...(DEFAULT_DOCS[id] as Record<string, unknown>), ...(snapshot as Record<string, unknown>) });
  if (!merged.success) return fail(validationFrom(merged.error.issues));
  return writeDoc(actor, { id, baseVersion, data: merged.data, intent });
}

/* ── Collection items ──────────────────────────────────────────────────── */

const ENVELOPED = COLLECTION_NAMES.filter((c): c is EnvelopedCollection => c !== "media") as [EnvelopedCollection, ...EnvelopedCollection[]];

export const SaveItemInput = z.object({
  collection: z.enum(ENVELOPED),
  id: z.string().regex(/^[A-Za-z0-9_~.-]{1,128}$/).optional(),
  baseVersion: z.number().int().min(0).optional(),
  data: z.unknown(),
  intent: z.enum(["draft", "publish"]),
});
export type SaveItemInput = z.input<typeof SaveItemInput>;

/** Values a brand-new item is compared against for field-group checks (money starts empty, posts start as drafts). */
const NEW_ITEM_BASELINE: Partial<Record<CollectionName, Record<string, unknown>>> = {
  causes: { currency: "USD", goal: 0, offlineRaised: 0, convertedRaised: 0, allocation: [], impactUnits: [], presetAmounts: {}, verification: { status: "placeholder" } },
  posts: {
    status: "draft",
    review: { checklist: { factsChecked: false, figuresMatchVerifiedStats: false, noChildIdentified: false, noPreciseLocations: false, consentForPeopleShown: false, noAdviceOrDiagnosis: false } },
    origin: { kind: "human" },
  },
  faqs: { locked: false },
  stats: { verification: { status: "placeholder" } },
};

function newItemId(c: CollectionName, data: Record<string, unknown>, spec: CollectionSpec): string {
  if (spec.slugged && typeof data.slug === "string") return data.slug;
  const prefix = spec.itemLabel.replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || c;
  return `${prefix}-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

function staffCanWriteItem(actor: ContentActor, c: CollectionName, intent: "draft" | "publish", creating: boolean): WriteOutcome | null {
  if (isSystem(actor)) return null;
  if (c === "posts") {
    if (!hasPerm(actor, "post.draft") && !hasPerm(actor, "post.publish")) return forbidden("You don't have access to posts.");
    if (intent === "publish" && !hasPerm(actor, "post.publish")) return forbidden("Send it for review, and a content manager will put it live.");
  } else {
    if (!hasPerm(actor, "content.edit")) return forbidden("You don't have access to edit the website.");
    if (intent === "publish" && !hasPerm(actor, "content.publish")) return forbidden("You can save drafts, but someone else needs to put this live.");
  }
  if (!canEditCollection(actor.roles, c)) return forbidden("You don't have access to this part of the website.");
  if (creating && !canCreateItem(actor.roles, c)) {
    return forbidden(COLLECTIONS[c].fixedIds ? "These are a fixed set: you can edit or hide them, but not add new ones." : "You can't add new items here.");
  }
  return null;
}

/** Reading minutes for posts (200 words a minute, at least one). */
function readingMinutes(post: Record<string, unknown>): number {
  const text = JSON.stringify(post.body ?? []).replace(/"(id|type|style|level|size|tone|kind|provider|videoId|\$media)":"[^"]*"/g, " ");
  const words = text.split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 1).length;
  return Math.max(1, Math.min(120, Math.round(words / 200)));
}

/**
 * Creates or edits a collection item (draft or publish). New items get an id (the slug for slugged
 * collections). Publishing returns the item's tags (collection + id + slug).
 */
export async function writeItem(actor: ContentActor, input: unknown): Promise<WriteOutcome<{ id: string; version: number; at: Millis }>> {
  type R = { id: string; version: number; at: Millis };
  const parsedInput = SaveItemInput.safeParse(input);
  if (!parsedInput.success) return fail<R>(validationFrom(parsedInput.error.issues));
  const { collection: c, intent, data } = parsedInput.data;
  const creating = !parsedInput.data.id;
  const denied = staffCanWriteItem(actor, c, intent, creating);
  if (denied) return denied as WriteOutcome<R>;
  if (!creating && parsedInput.data.baseVersion === undefined) return fail<R>({ kind: "validation", fields: { baseVersion: "Please reload and try again." } });
  const spec = COLLECTIONS[c];
  const parsed = spec.schema.safeParse(data);
  if (!parsed.success) return fail<R>(validationFrom(parsed.error.issues));
  const extras = extraPaths(data, parsed.data);
  if (extras.length) return fail<R>({ kind: "validation", fields: Object.fromEntries(extras.map((p) => [p, "This isn't part of this item."])) });
  if (!writable()) return unavailable<R>();

  const input0 = parsed.data as Record<string, unknown>;
  const id = parsedInput.data.id ?? newItemId(c, input0, spec);
  const key: RecordKey = { kind: "item", collection: c, id };
  const index = intent === "publish" ? await readMediaIndexUncached() : {};

  /**
   * Every check that depends on the stored record: existence, version, slug freeze, field groups and
   * the publish gate. Runs once before seeding (so a refused write leaves the store untouched) and
   * again inside the transaction (authoritative). Throws ConflictSignal; returns the value to store.
   */
  const prepare = (rec: (StoredRecord<unknown> & { updatedByName?: string }) | null, now: number) => {
    if (creating && rec) throw new ConflictSignal({ kind: "validation", fields: { [spec.slugged ? "slug" : "_form"]: "That web address is already used. Please choose another." } });
    if (!creating && !rec) throw new ConflictSignal({ kind: "not_allowed", message: "This item no longer exists. It may have been deleted." });
    if (!creating && rec && rec.version !== parsedInput.data.baseVersion) throw new ConflictSignal(conflictOf(rec));
    const current = rec ? (rec.draft ?? rec.published) : null;
    const before = current ?? NEW_ITEM_BASELINE[c] ?? {};
    const live = rec?.published ?? null;
    let value = input0;

    // Slugs freeze once the item has been live.
    if (spec.slugged && live && (live as { slug?: string }).slug !== value.slug) {
      throw new ConflictSignal({ kind: "validation", fields: { slug: "The web address can't change once it has been live. Ask a developer for a redirect." } });
    }
    if (VERIFIED_FIELDS[c]) value = stampVerification(c, actor, live ?? before, value, now);
    if (c === "posts") value = { ...value, readingMinutes: readingMinutes(value) };

    const changes = diffPaths(before, value).filter((ch) => !(c === "posts" && ch.path === "readingMinutes"));
    if (!isSystem(actor)) {
      const deniedList = deniedPaths(actor.roles, spec, changes.map((ch) => ch.path), { before: current ?? before, after: value });
      if (deniedList.length) {
        throw new ConflictSignal({ kind: "forbidden", message: deniedMessage(spec, deniedList, { before: current ?? before, after: value }), paths: deniedList });
      }
    }

    if (intent === "publish") {
      if (c === "posts") {
        // Posts go live through review (post-actions). A live post's edits may be republished here;
        // the checklist runs again only when the body or cover changed (content-model §7.1).
        if (!live || (live as { status?: string }).status !== "published") {
          throw new ConflictSignal({ kind: "not_allowed", message: "Send this post for review first. It goes live once it has been approved." });
        }
        const bodyChanged = diffPaths({ body: (live as { body?: unknown }).body, cover: (live as { cover?: unknown }).cover }, { body: value.body, cover: value.cover }).length > 0;
        const reasons = gateReasons(bodyChanged ? ["review"] : [], value, { index, previous: live, placeholder: rec?.placeholder, now });
        if (reasons.length) throw new ConflictSignal({ kind: "blocked", message: "This can't go live yet.", reasons });
        value = { ...value, status: "published", publishedAt: (live as { publishedAt?: number }).publishedAt ?? now };
      } else {
        const reasons = gateReasons(spec.publishGate, value, { index, previous: live, placeholder: rec?.placeholder, now });
        if (reasons.length) throw new ConflictSignal({ kind: "blocked", message: "This can't go live yet.", reasons });
      }
    }
    return { value, changes, live };
  };

  return guarded(`item:${c}/${id}`, async () => {
    // Refuse early, before the collection is seeded, when the stored record already rules the write out.
    prepare(creating ? null : ((await contentStore().getItem(c, id)) as (StoredRecord<unknown> & { updatedByName?: string }) | null), Date.now());
    await ensureSeeded(c);
    // Slug uniqueness (slugged collections), checked outside the transaction against the stored set.
    if (spec.slugged && typeof input0.slug === "string") {
      const clash = (await contentStore().listItems(c)).find(
        (r) => r.id !== id && ((r.draft as { slug?: string } | null)?.slug === input0.slug || (r.published as { slug?: string } | null)?.slug === input0.slug),
      );
      if (clash) return fail<R>({ kind: "validation", fields: { slug: "That web address is already used. Please choose another." } });
    }
    let value: Record<string, unknown> = input0;
    const out = await getStore().runTransaction(async (tx) => {
      const rec = toRecord(id, await tx.get<Partial<Envelope>>(recordPath(key))) as (StoredRecord<unknown> & { updatedByName?: string }) | null;
      const now = Date.now();
      const prepared = prepare(rec, now);
      value = prepared.value;
      const { changes, live } = prepared;

      const next: StoredRecord<unknown> = {
        id,
        published: intent === "publish" ? value : live,
        draft: intent === "publish" ? null : value,
        version: (rec?.version ?? 0) + 1,
        visibility: rec?.visibility ?? "live",
        ...(rec?.placeholder ? { placeholder: true } : {}),
        createdAt: rec?.createdAt || now,
        createdBy: rec?.createdBy ?? actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
        ...(intent === "publish" ? { publishedAt: now, publishedBy: actorId(actor) } : rec?.publishedAt ? { publishedAt: rec.publishedAt, publishedBy: rec.publishedBy } : {}),
      };
      tx.set(recordPath(key), envelopeOf(next, actorName(actor)));
      if (intent === "publish" && live !== null) snapshotVersion(tx, key, rec?.version ?? 0, live, actor, now);
      const action = creating ? "content.create" : intent === "publish" ? "content.publish" : "content.save";
      const verb = creating ? "added {label}" : intent === "publish" ? "put {label} live" : "saved a draft of {label}";
      auditWrite(tx, actor, key, action, verb, value, intent === "publish" ? diffPaths(live ?? {}, value) : changes, intent === "publish" || creating);
      return { id, version: next.version, at: now };
    });
    if (intent === "publish") await pruneVersions(key);
    return done(actionOk(out), intent === "publish" ? tagsFor(key, value) : []);
  });
}

/** Shows, hides or archives an item (programmes and policies can be hidden, not removed). */
export async function writeItemVisibility(actor: ContentActor, input: unknown): Promise<WriteOutcome> {
  const parsed = z
    .object({ collection: z.enum(ENVELOPED), id: z.string().min(1).max(128), baseVersion: z.number().int().min(0), visibility: z.enum(VISIBILITIES) })
    .safeParse(input);
  if (!parsed.success) return fail(validationFrom(parsed.error.issues));
  const { collection: c, id, baseVersion, visibility } = parsed.data;
  const denied = staffCanWriteItem(actor, c, "publish", false);
  if (denied) return denied;
  if (COLLECTIONS[c].fixedIds && visibility === "archived") return notAllowed("These are a fixed set: hide it instead.");
  if (!writable()) return unavailable();
  const key: RecordKey = { kind: "item", collection: c, id };
  return guarded(`visibility:${c}/${id}`, async () => {
    await ensureSeeded(c);
    let data: unknown = null;
    const out = await getStore().runTransaction(async (tx) => {
      const rec = toRecord(id, await tx.get<Partial<Envelope>>(recordPath(key)));
      if (!rec) throw new ConflictSignal({ kind: "not_allowed", message: "This item no longer exists." });
      if (rec.version !== baseVersion) throw new ConflictSignal(conflictOf(rec));
      data = rec.published ?? rec.draft;
      if (rec.visibility === visibility) return { version: rec.version, at: rec.updatedAt };
      const now = Date.now();
      tx.set(recordPath(key), envelopeOf({ ...rec, visibility, version: rec.version + 1, updatedAt: now, updatedBy: actorId(actor) }, actorName(actor)));
      const verb = visibility === "live" ? "showed" : visibility === "hidden" ? "hid" : "archived";
      auditWrite(tx, actor, key, "content.visibility", verb, data, [{ path: "visibility", before: rec.visibility, after: visibility }], true);
      return { version: rec.version + 1, at: now };
    });
    return done(actionOk(out), tagsFor(key, data));
  });
}

/** Saves a new order for a collection (order = position, starting at 1). */
export async function writeItemOrder(actor: ContentActor, input: unknown): Promise<WriteOutcome> {
  const parsed = z
    .object({ collection: z.enum(ENVELOPED), orderedIds: z.array(z.string().min(1).max(128)).min(1).max(500) })
    .safeParse(input);
  if (!parsed.success) return fail(validationFrom(parsed.error.issues));
  const { collection: c, orderedIds } = parsed.data;
  const denied = staffCanWriteItem(actor, c, "publish", false);
  if (denied) return denied;
  if (!isSystem(actor) && deniedPaths(actor.roles, COLLECTIONS[c], ["order"]).length) return forbidden("You can't change the order here.");
  if (!writable()) return unavailable();
  return guarded(`order:${c}`, async () => {
    await ensureSeeded(c);
    const out = await getStore().runTransaction(async (tx) => {
      const recs = await Promise.all(orderedIds.map(async (id) => toRecord(id, await tx.get<Partial<Envelope>>(recordPath({ kind: "item", collection: c, id })))));
      const now = Date.now();
      let changed = 0;
      recs.forEach((rec, i) => {
        if (!rec) return;
        const order = i + 1;
        const withOrder = (v: unknown) => (v && typeof v === "object" ? { ...(v as Record<string, unknown>), order } : v);
        const pub = rec.published as { order?: number } | null;
        const dr = rec.draft as { order?: number } | null;
        if ((pub?.order ?? order) === order && (dr?.order ?? order) === order) return;
        changed++;
        tx.set(
          recordPath({ kind: "item", collection: c, id: rec.id }),
          envelopeOf({ ...rec, published: withOrder(rec.published), draft: withOrder(rec.draft), version: rec.version + 1, updatedAt: now, updatedBy: actorId(actor) }, actorName(actor)),
        );
      });
      if (changed) {
        auditTx(tx, {
          actor: actorOf(actor),
          action: "content.reorder",
          area: "content",
          summary: `${actorName(actor)} reordered ${COLLECTIONS[c].label}`,
          feed: false,
          targetPath: C[c as CollectionKey],
          targetRef: null,
          changes: null,
        });
      }
      return { version: changed, at: now };
    });
    return done(actionOk(out), [TAG.col(c)]);
  });
}

/**
 * Deletes an item that was never live. A live item is archived instead, except for super admins,
 * who may delete it for good. Programmes and policies are a fixed set.
 */
export async function removeItem(actor: ContentActor, input: unknown): Promise<WriteOutcome<{ version: number; at: Millis; archived: boolean }>> {
  type R = { version: number; at: Millis; archived: boolean };
  const parsed = z.object({ collection: z.enum(ENVELOPED), id: z.string().min(1).max(128), baseVersion: z.number().int().min(0) }).safeParse(input);
  if (!parsed.success) return fail<R>(validationFrom(parsed.error.issues));
  const { collection: c, id, baseVersion } = parsed.data;
  if (COLLECTIONS[c].fixedIds) return notAllowed<R>("These are a fixed set: hide it instead.");
  const denied = staffCanWriteItem(actor, c, "draft", false);
  if (denied) return denied as WriteOutcome<R>;
  if (!writable()) return unavailable<R>();
  const key: RecordKey = { kind: "item", collection: c, id };
  return guarded(`delete:${c}/${id}`, async () => {
    await ensureSeeded(c);
    let data: unknown = null;
    const out = await getStore().runTransaction(async (tx) => {
      const rec = toRecord(id, await tx.get<Partial<Envelope>>(recordPath(key)));
      if (!rec) throw new ConflictSignal({ kind: "not_allowed", message: "This item no longer exists." });
      if (rec.version !== baseVersion) throw new ConflictSignal(conflictOf(rec));
      data = rec.published ?? rec.draft;
      const now = Date.now();
      const everLive = rec.publishedAt !== undefined || rec.published !== null;
      if (everLive && !rolesOf(actor).includes("super_admin")) {
        tx.set(recordPath(key), envelopeOf({ ...rec, visibility: "archived", version: rec.version + 1, updatedAt: now, updatedBy: actorId(actor) }, actorName(actor)));
        auditWrite(tx, actor, key, "content.visibility", "archived", data, [{ path: "visibility", before: rec.visibility, after: "archived" }], true);
        return { version: rec.version + 1, at: now, archived: true };
      }
      tx.delete(recordPath(key));
      auditWrite(tx, actor, key, "content.delete", "deleted", data, undefined, true);
      return { version: rec.version + 1, at: now, archived: false };
    });
    if (!out.archived) {
      try {
        await getStore().delete(recordPath(key), { recursive: true });
      } catch (err) {
        log.warn("content.delete_versions_failed", { path: recordPath(key), err });
      }
    }
    return done(actionOk(out), tagsFor(key, data));
  });
}

/** "This is real, approved content": clears the placeholder flag of a doc or item. */
export async function confirmRecord(actor: ContentActor, input: unknown): Promise<WriteOutcome> {
  const KeySchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("doc"), id: z.enum(DOC_IDS) }),
    z.object({ kind: z.literal("item"), collection: z.enum(ENVELOPED), id: z.string().min(1).max(128) }),
  ]);
  const parsed = z.object({ key: KeySchema, baseVersion: z.number().int().min(0) }).safeParse(input);
  if (!parsed.success) return fail(validationFrom(parsed.error.issues));
  const { key, baseVersion } = parsed.data as { key: RecordKey; baseVersion: number };
  const denied = key.kind === "doc" ? staffCanWriteDoc(actor, key.id, "publish") : staffCanWriteItem(actor, key.collection, "publish", false);
  if (denied) return denied;
  if (!writable()) return unavailable();
  return guarded(`confirm:${recordPath(key)}`, async () => {
    if (key.kind === "item") await ensureSeeded(key.collection);
    let data: unknown = null;
    const out = await getStore().runTransaction(async (tx) => {
      const raw = await tx.get<Partial<Envelope>>(recordPath(key));
      const now = Date.now();
      if (!raw && key.kind === "doc") {
        // Never edited: confirm the defaults as they are.
        if (baseVersion !== 0) throw new ConflictSignal(conflictOf(null));
        data = DEFAULT_DOCS[key.id];
        const rec: StoredRecord<unknown> = {
          id: key.id,
          published: DEFAULT_DOCS[key.id],
          draft: null,
          version: 1,
          visibility: "live",
          createdAt: now,
          createdBy: actorId(actor),
          updatedAt: now,
          updatedBy: actorId(actor),
          publishedAt: now,
          publishedBy: actorId(actor),
        };
        tx.set(recordPath(key), envelopeOf(rec, actorName(actor)));
        auditWrite(tx, actor, key, "content.confirm", "confirmed", data, undefined, true);
        return { version: 1, at: now };
      }
      const rec = toRecord(key.id, raw);
      if (!rec) throw new ConflictSignal({ kind: "not_allowed", message: "This item no longer exists." });
      if (rec.version !== baseVersion) throw new ConflictSignal(conflictOf(rec));
      data = rec.published ?? rec.draft;
      const { placeholder: _p, ...rest } = rec;
      void _p;
      tx.set(recordPath(key), envelopeOf({ ...rest, version: rec.version + 1, updatedAt: now, updatedBy: actorId(actor) }, actorName(actor)));
      auditWrite(tx, actor, key, "content.confirm", "confirmed", data, undefined, true);
      return { version: rec.version + 1, at: now };
    });
    return done(actionOk(out), tagsFor(key, data));
  });
}

/** Puts every listed draft live (the publish sheet's "Put these changes live", D61). */
export async function publishDrafts(
  actor: ContentActor,
  input: unknown,
): Promise<WriteOutcome<{ published: RecordKey[]; failed: Array<{ key: RecordKey; error: ActionError }> }>> {
  type R = { published: RecordKey[]; failed: Array<{ key: RecordKey; error: ActionError }> };
  const KeySchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("doc"), id: z.enum(DOC_IDS) }),
    z.object({ kind: z.literal("item"), collection: z.enum(ENVELOPED), id: z.string().min(1).max(128) }),
  ]);
  const parsed = z.object({ keys: z.array(KeySchema).min(1).max(100) }).safeParse(input);
  if (!parsed.success) return fail<R>(validationFrom(parsed.error.issues));
  if (!writable()) return unavailable<R>();
  const published: RecordKey[] = [];
  const failed: Array<{ key: RecordKey; error: ActionError }> = [];
  const tags = new Set<string>();
  for (const key of parsed.data.keys as RecordKey[]) {
    const rec = key.kind === "doc" ? await contentStore().getDoc(key.id) : await contentStore().getItem(key.collection, key.id);
    if (!rec || rec.draft === null) continue;
    const outcome =
      key.kind === "doc"
        ? await writeDoc(actor, { id: key.id, baseVersion: rec.version, data: rec.draft, intent: "publish" })
        : await writeItem(actor, { collection: key.collection, id: key.id, baseVersion: rec.version, data: rec.draft, intent: "publish" });
    if (outcome.result.ok) {
      published.push(key);
      outcome.tags.forEach((t) => tags.add(t));
    } else failed.push({ key, error: outcome.result.error });
  }
  return done(actionOk({ published, failed }), [...tags]);
}

/** Every record with an unpublished draft (the "changes not live yet" list). */
export async function listDrafts(): Promise<Array<{ key: RecordKey; label: string; updatedAt: Millis; updatedBy: string; version: number }>> {
  const out: Array<{ key: RecordKey; label: string; updatedAt: Millis; updatedBy: string; version: number }> = [];
  const store = contentStore();
  for (const id of DOC_IDS) {
    const rec = await store.getDoc(id);
    if (rec?.draft) out.push({ key: { kind: "doc", id }, label: DOCS[id].label, updatedAt: rec.updatedAt, updatedBy: rec.updatedBy, version: rec.version });
  }
  for (const c of ENVELOPED) {
    if (!(await store.isSeeded(c))) continue;
    for (const rec of await store.listItems(c)) {
      if (!rec.draft) continue;
      if (c === "posts") continue; // posts follow their own review workflow
      const key: RecordKey = { kind: "item", collection: c, id: rec.id };
      out.push({ key, label: labelOf(key, rec.draft), updatedAt: rec.updatedAt, updatedBy: rec.updatedBy, version: rec.version });
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ── Low-level helpers for the post workflow and media actions ─────────── */

export { ConflictSignal, guarded, isSystem, actorId, actorName, hasPerm, unavailable, notAllowed, forbidden, fail, done, validationFrom, conflictOf, writable, toRecord, envelopeOf, auditWrite, snapshotVersion, pruneVersions, tagsFor };
export type { Envelope };
