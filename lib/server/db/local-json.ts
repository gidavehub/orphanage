import "server-only";

// LocalJsonAdapter (data-model §8.4, PLAN §4.7, D28–D30): the practice-mode DocStore on .data/db.
//
// Layout: one JSON file per collection, mirroring Firestore paths:
//   .data/db/<collection>/_docs.json                    { "<id>": { …doc } }
//   .data/db/<collection>/<docId>/<sub>/_docs.json      subcollections
//
// Behaviour kept at parity with the FirestoreAdapter:
// - every write runs under the global "db" lock (in-process mutex + .data/locks/db.lock), reads fresh
//   state, buffers its writes and commits every touched file atomically (tmp → fsync → rename);
// - transactions buffer writes and apply them after the callback returns, so `tx.get` always sees the
//   committed state (never this transaction's own writes) and reads may follow writes;
// - `create` on an existing document fails the whole commit with ConflictError, `update` on a missing
//   one with NotFoundError, `expectedVersion` mismatches with ConflictError;
// - queries follow Firestore semantics (type order null < boolean < number < string, documents without
//   the order field are excluded, the id is the implicit tiebreaker) and a query that Firestore could
//   not serve from firestore.indexes.json throws MissingIndexError here too;
// - `*At` fields are plain epoch-ms numbers (D30).
// Refuses to start on Vercel (read-only filesystem).

import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import {
  applyPatch,
  collectionGroupOf,
  compareValues,
  decodeCursor,
  encodeCursor,
  getField,
  normaliseDoc,
  normaliseValue,
  parseCollectionPath,
  parseDocPath,
  sameType,
  valuesEqual,
} from "./convert";
import { dataPath, forgetJsonCache, primeJsonCache, readJsonCached, removePath, withLock, writeFilesAtomic } from "./local-fs";
import {
  ConflictError,
  MissingIndexError,
  NotFoundError,
  type DocData,
  type DocStore,
  type Filter,
  type ListQuery,
  type Page,
  type Tx,
  type WithId,
} from "./store";

type StoredDoc = Record<string, unknown>;
type DocMap = Record<string, StoredDoc>;

type WriteOp =
  | { kind: "create"; path: string; data: StoredDoc }
  | { kind: "set"; path: string; data: StoredDoc }
  | { kind: "update"; path: string; patch: DocData; expectedVersion?: number }
  | { kind: "delete"; path: string; recursive: boolean };

const DOCS_FILE = "_docs.json";
const MAX_BATCH = 500;
const MAX_IN_VALUES = 30;

/* ── Filesystem mapping ────────────────────────────────────────────────── */

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/**
 * A path segment as a directory name. Document ids are already restricted to [A-Za-z0-9_~.-] (D29);
 * the few that Windows cannot hold as directory names (reserved device names, a trailing dot, or the
 * collection file's own name) are hex-encoded behind a `%`, which never appears in an id.
 */
function fsSegment(segment: string): string {
  if (WINDOWS_RESERVED.test(segment) || segment.endsWith(".") || segment.toLowerCase() === DOCS_FILE) {
    return `%${Buffer.from(segment, "utf8").toString("hex")}`;
  }
  return segment;
}

function collectionFile(collectionPath: string): string {
  const segments = parseCollectionPath(collectionPath);
  return dataPath("db", ...segments.map(fsSegment), DOCS_FILE);
}

/** The directory that holds a document's subcollections. */
function docDir(docPath: string): string {
  const { segments } = parseDocPath(docPath);
  return dataPath("db", ...segments.map(fsSegment));
}

async function readDocs(collectionPath: string): Promise<DocMap> {
  const docs = await readJsonCached<DocMap>(collectionFile(collectionPath));
  return docs && typeof docs === "object" && !Array.isArray(docs) ? docs : {};
}

function withId<T>(doc: StoredDoc, id: string): WithId<T> {
  return { ...(structuredClone(doc) as object), id } as WithId<T>;
}

/* ── Locking (re-entrant per async context) ────────────────────────────── */

type LockContext = { held: boolean };
const G = globalThis as typeof globalThis & { __havenDbLockContext?: AsyncLocalStorage<LockContext> };
const lockContext: AsyncLocalStorage<LockContext> = (G.__havenDbLockContext ??= new AsyncLocalStorage<LockContext>());

/**
 * Runs `fn` holding the global write lock. A write issued from inside a transaction callback (for
 * example an audit entry written on its own) runs immediately under the lock already held, as a
 * separate commit, exactly as an independent write would in Firestore. It never deadlocks.
 */
async function writeLocked<T>(fn: () => Promise<T>): Promise<T> {
  const ctx = lockContext.getStore();
  if (ctx?.held) return fn();
  return withLock("db", () => {
    const own: LockContext = { held: true };
    return lockContext.run(own, async () => {
      try {
        return await fn();
      } finally {
        own.held = false;
      }
    });
  });
}

/* ── Commit ────────────────────────────────────────────────────────────── */

async function commit(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  const files = new Map<string, { file: string; docs: DocMap }>();
  const removeDirs: string[] = [];

  const load = async (collectionPath: string) => {
    let entry = files.get(collectionPath);
    if (!entry) {
      const file = collectionFile(collectionPath);
      const cached = await readJsonCached<DocMap>(file);
      // Shallow copy: documents are replaced whole, never mutated in place.
      entry = { file, docs: cached && typeof cached === "object" && !Array.isArray(cached) ? { ...cached } : {} };
      files.set(collectionPath, entry);
    }
    return entry;
  };

  for (const op of ops) {
    const { collectionPath, id } = parseDocPath(op.path);
    const entry = await load(collectionPath);
    switch (op.kind) {
      case "create":
        if (Object.prototype.hasOwnProperty.call(entry.docs, id)) throw new ConflictError("That record already exists.");
        entry.docs[id] = op.data;
        break;
      case "set":
        entry.docs[id] = op.data;
        break;
      case "update": {
        const current = entry.docs[id];
        if (!current) throw new NotFoundError();
        if (op.expectedVersion !== undefined && current.version !== op.expectedVersion) throw new ConflictError();
        const next = structuredClone(current);
        applyPatch(next, op.patch);
        entry.docs[id] = next;
        break;
      }
      case "delete":
        delete entry.docs[id];
        if (op.recursive) removeDirs.push(docDir(op.path));
        break;
    }
  }

  const writes = [...files.values()];
  await writeFilesAtomic(writes.map((w) => [w.file, JSON.stringify(w.docs, null, 1)]));
  await Promise.all(writes.map((w) => primeJsonCache(w.file, w.docs)));
  for (const dir of removeDirs) {
    await removePath(dir);
    forgetJsonCache(dir);
  }
}

/* ── Query evaluation ──────────────────────────────────────────────────── */

function assertFilter(f: Filter): void {
  if (!f.field) throw new Error("A filter needs a field.");
  if (f.op === "in") {
    if (!Array.isArray(f.value) || f.value.length === 0 || f.value.length > MAX_IN_VALUES) {
      throw new Error(`An "in" filter needs 1–${MAX_IN_VALUES} values.`);
    }
  }
}

function matches(doc: StoredDoc, f: Filter): boolean {
  const actual = getField(doc, f.field);
  if (actual === undefined) return false;
  switch (f.op) {
    case "==":
      return valuesEqual(actual, f.value);
    case "in":
      return f.value.some((v) => valuesEqual(actual, v));
    case "array-contains":
      return Array.isArray(actual) && actual.some((v) => valuesEqual(v, f.value));
    case "<":
    case "<=":
    case ">":
    case ">=": {
      if (f.value === null || !sameType(actual, f.value)) return false;
      const c = compareValues(actual, f.value);
      return f.op === "<" ? c < 0 : f.op === "<=" ? c <= 0 : f.op === ">" ? c > 0 : c >= 0;
    }
  }
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ── Index parity (firestore.indexes.json) ─────────────────────────────── */

type IndexField = { fieldPath: string; order?: "ASCENDING" | "DESCENDING"; arrayConfig?: "CONTAINS" };
type IndexDef = { collectionGroup: string; queryScope?: string; fields: IndexField[] };
type FieldOverride = { collectionGroup: string; fieldPath: string; indexes?: unknown[]; ttl?: boolean };
type IndexFile = { indexes?: IndexDef[]; fieldOverrides?: FieldOverride[] };

let warnedNoIndexFile = false;

async function loadIndexes(): Promise<IndexFile> {
  const file = path.join(process.cwd(), "firestore.indexes.json");
  const parsed = await readJsonCached<IndexFile>(file);
  if (!parsed) {
    if (!warnedNoIndexFile) {
      warnedNoIndexFile = true;
      log.warn("db.local.no_index_file", { file: "firestore.indexes.json" });
    }
    return {};
  }
  return parsed;
}

type FieldKind = "eq" | "contains";

function indexMissing(group: string, fields: string[]): MissingIndexError {
  return new MissingIndexError(
    `This query needs a composite index on ${group} (${fields.join(", ")}). Add it to firestore.indexes.json in the same change.`,
  );
}

/**
 * Throws MissingIndexError when Firestore could not serve the query: composite indexes come from
 * firestore.indexes.json, single-field indexes are automatic unless exempted by a fieldOverride with
 * `indexes: []`. Equality filters may be served by merging composite indexes that end in the order
 * field (Firestore's index merging); range filters need one exact composite index.
 */
async function assertIndexed(collectionPath: string, where: Filter[], orderField: string | null): Promise<void> {
  const group = collectionGroupOf(collectionPath);
  const config = await loadIndexes();

  const eq = new Map<string, FieldKind>();
  const ranges = new Set<string>();
  for (const f of where) {
    if (f.op === "==" || f.op === "in") {
      if (eq.get(f.field) === "contains") throw indexMissing(group, [f.field]);
      eq.set(f.field, "eq");
    } else if (f.op === "array-contains") {
      if (eq.has(f.field)) throw indexMissing(group, [f.field]);
      eq.set(f.field, "contains");
    } else {
      ranges.add(f.field);
    }
  }
  if (ranges.size > 1) {
    throw new MissingIndexError(`Haven queries filter on at most one range field (${[...ranges].join(", ")}).`);
  }
  const range = ranges.size ? [...ranges][0] : null;
  // Ordering by a field that is fixed by an equality filter adds nothing.
  const order = orderField && !(eq.get(orderField) === "eq" && !range) ? orderField : null;

  const exempt = new Set(
    (config.fieldOverrides ?? [])
      .filter((o) => o.collectionGroup === group && Array.isArray(o.indexes) && o.indexes.length === 0)
      .map((o) => o.fieldPath),
  );
  for (const field of [...eq.keys(), ...(range ? [range] : []), ...(orderField ? [orderField] : [])]) {
    if (exempt.has(field)) throw new MissingIndexError(`${group}.${field} is exempt from indexing in firestore.indexes.json and cannot be queried.`);
  }

  if (eq.size === 0 && (!range || !order || range === order)) return; // single-field index
  if (!range && !order) return; // equality-only: merged single-field indexes

  const composites = (config.indexes ?? [])
    .filter((ix) => ix.collectionGroup === group)
    .map((ix) => ix.fields.filter((f) => f.fieldPath !== "__name__"));

  const kindOf = (f: IndexField): FieldKind => (f.arrayConfig === "CONTAINS" ? "contains" : "eq");
  // The ordered part of the index: the range field (when it differs from the order field), then the order field.
  const tail: string[] = [];
  if (range && range !== order) tail.push(range);
  if (order) tail.push(order);
  const tailOk = (fields: IndexField[]) =>
    fields.length >= tail.length &&
    tail.every((t, i) => {
      const f = fields[fields.length - tail.length + i];
      return f.fieldPath === t && !f.arrayConfig;
    });
  const prefixOf = (fields: IndexField[]) => fields.slice(0, fields.length - tail.length);
  const prefixWithin = (prefix: IndexField[]) => prefix.every((f) => eq.get(f.fieldPath) === kindOf(f));

  // One exact composite: equality prefix (any order) + tail.
  const exact = composites.some((fields) => {
    if (!tailOk(fields)) return false;
    const prefix = prefixOf(fields);
    return prefix.length === eq.size && prefixWithin(prefix);
  });
  if (exact) return;

  // Index merging (equality filters + one order field, no range).
  if (!range && order) {
    const covered = new Set<string>();
    for (const fields of composites) {
      if (!tailOk(fields)) continue;
      const prefix = prefixOf(fields);
      if (prefix.length === 0 || !prefixWithin(prefix)) continue;
      for (const f of prefix) covered.add(f.fieldPath);
    }
    if ([...eq.keys()].every((k) => covered.has(k))) return;
  }

  throw indexMissing(group, [...eq.keys(), ...tail]);
}

/* ── The adapter ───────────────────────────────────────────────────────── */

function validateQuery(q: ListQuery): void {
  if (!q || !q.orderBy || !q.orderBy.field) throw new Error("A list query needs orderBy.");
  if (q.orderBy.dir !== "asc" && q.orderBy.dir !== "desc") throw new Error('orderBy.dir is "asc" or "desc".');
  if (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > 100) throw new Error("A list query limit is 1–100.");
  for (const f of q.where ?? []) assertFilter(f);
}

function buildTx(ops: WriteOp[], state: { open: boolean }, read: (p: string) => Promise<WithId<unknown> | null>): Tx {
  const assertOpen = () => {
    if (!state.open) throw new Error("This transaction has already finished.");
  };
  return {
    async get<T>(p: string) {
      assertOpen();
      return (await read(p)) as WithId<T> | null;
    },
    create<T>(p: string, data: T) {
      assertOpen();
      parseDocPath(p);
      ops.push({ kind: "create", path: p, data: normaliseDoc(data) });
    },
    set<T>(p: string, data: T) {
      assertOpen();
      parseDocPath(p);
      ops.push({ kind: "set", path: p, data: normaliseDoc(data) });
    },
    update(p: string, patch: DocData) {
      assertOpen();
      parseDocPath(p);
      ops.push({ kind: "update", path: p, patch: snapshotPatch(patch) });
    },
    delete(p: string) {
      assertOpen();
      parseDocPath(p);
      ops.push({ kind: "delete", path: p, recursive: false });
    },
  };
}

/** Copies a patch at call time (callers may reuse their objects), keeping FieldOps intact. */
function snapshotPatch(patch: DocData): DocData {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("An update patch must be an object.");
  const out: DocData = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = normaliseValue(v);
  }
  return out;
}

export class LocalJsonAdapter implements DocStore {
  readonly kind = "local" as const;

  constructor() {
    if (env.onVercel) throw new Error("The local data store cannot run on Vercel (read-only filesystem).");
  }

  private async read<T>(p: string): Promise<WithId<T> | null> {
    const { collectionPath, id } = parseDocPath(p);
    const docs = await readDocs(collectionPath);
    const doc = Object.prototype.hasOwnProperty.call(docs, id) ? docs[id] : undefined;
    return doc ? withId<T>(doc, id) : null;
  }

  async get<T>(p: string): Promise<WithId<T> | null> {
    return this.read<T>(p);
  }

  async getMany<T>(paths: string[]): Promise<Array<WithId<T> | null>> {
    return Promise.all(paths.map((p) => this.read<T>(p)));
  }

  async create<T>(p: string, data: T): Promise<void> {
    parseDocPath(p);
    const doc = normaliseDoc(data);
    await writeLocked(() => commit([{ kind: "create", path: p, data: doc }]));
  }

  async set<T>(p: string, data: T): Promise<void> {
    parseDocPath(p);
    const doc = normaliseDoc(data);
    await writeLocked(() => commit([{ kind: "set", path: p, data: doc }]));
  }

  async update(p: string, patch: DocData, opts?: { expectedVersion?: number }): Promise<void> {
    parseDocPath(p);
    const snap = snapshotPatch(patch);
    await writeLocked(() => commit([{ kind: "update", path: p, patch: snap, expectedVersion: opts?.expectedVersion }]));
  }

  async delete(p: string, opts?: { recursive?: boolean }): Promise<void> {
    parseDocPath(p);
    await writeLocked(() => commit([{ kind: "delete", path: p, recursive: opts?.recursive === true }]));
  }

  async list<T>(collectionPath: string, q: ListQuery): Promise<Page<T>> {
    validateQuery(q);
    const where = q.where ?? [];
    await assertIndexed(collectionPath, where, q.orderBy.field);
    const docs = await readDocs(collectionPath);
    const field = q.orderBy.field;
    const sign = q.orderBy.dir === "desc" ? -1 : 1;

    let rows = Object.entries(docs).filter(([, d]) => getField(d, field) !== undefined && where.every((f) => matches(d, f)));
    rows.sort(([ida, a], [idb, b]) => sign * (compareValues(getField(a, field), getField(b, field)) || compareIds(ida, idb)));

    if (q.cursor) {
      const cursor = decodeCursor(q.cursor);
      rows = rows.filter(([id, d]) => sign * (compareValues(getField(d, field), cursor.value) || compareIds(id, cursor.id)) > 0);
    }

    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      items: page.map(([id, d]) => withId<T>(d, id)),
      nextCursor: rows.length > q.limit && last ? encodeCursor(getField(last[1], field), last[0]) : null,
    };
  }

  async count(collectionPath: string, where: Filter[] = []): Promise<number> {
    for (const f of where) assertFilter(f);
    await assertIndexed(collectionPath, where, null);
    const docs = await readDocs(collectionPath);
    let n = 0;
    for (const d of Object.values(docs)) if (where.every((f) => matches(d, f))) n++;
    return n;
  }

  async listIds(collectionPath: string): Promise<string[]> {
    parseCollectionPath(collectionPath);
    return Object.keys(await readDocs(collectionPath)).sort(compareIds);
  }

  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return writeLocked(async () => {
      const ops: WriteOp[] = [];
      const state = { open: true };
      const tx = buildTx(ops, state, (p) => this.read(p));
      let result: R;
      try {
        result = await fn(tx);
      } finally {
        state.open = false;
      }
      await commit(ops);
      return result;
    });
  }

  async batch(write: (b: Omit<Tx, "get">) => void): Promise<void> {
    const ops: WriteOp[] = [];
    const state = { open: true };
    const tx = buildTx(ops, state, async () => null);
    try {
      write({ create: tx.create, set: tx.set, update: tx.update, delete: tx.delete });
    } finally {
      state.open = false;
    }
    if (ops.length > MAX_BATCH) throw new Error(`A batch holds at most ${MAX_BATCH} writes.`);
    await writeLocked(() => commit(ops));
  }
}
