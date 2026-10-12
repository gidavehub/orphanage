import "server-only";

// FirestoreAdapter (data-model §8.3, PLAN D30, D34): the production DocStore on firebase-admin.
// Compiled and typed now; exercised against a real project once FIREBASE_SERVICE_ACCOUNT_JSON exists
// (I8 runs the preflight). Same contract as the LocalJsonAdapter:
// - modular imports, one named app ("haven") memoised on globalThis (dev HMR reloads modules);
// - `preferRest` (no gRPC cold start on Vercel) and `ignoreUndefinedProperties`;
// - values under keys ending in `At` are written as Timestamps (readable console, TTL) and every
//   Timestamp is read back as epoch ms;
// - n+1 cursor paging ordered by [field, documentId], `count()` aggregation, `recursiveDelete`,
//   `expectedVersion` checked in a transaction;
// - transactions buffer writes and apply them after the callback, so reads may follow writes (the
//   callback may run more than once on contention: keep it free of outside side effects).
// This module and lib/server/storage/gcs.ts and lib/server/auth/firebase.ts are the only importers of
// firebase-admin (PLAN §4.2 rule 4); the other two reuse adminApp() from here.

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  initializeFirestore,
  type DocumentReference,
  type Firestore,
  type Query,
  type WhereFilterOp,
} from "firebase-admin/firestore";
import { env, firebaseServiceAccount } from "@/lib/server/env";
import { decodeCursor, encodeCursor, normaliseDoc, normaliseValue, parseCollectionPath, parseDocPath } from "./convert";
import {
  BackendUnavailableError,
  ConflictError,
  MissingIndexError,
  NotFoundError,
  isFieldOp,
  type DocData,
  type DocStore,
  type FieldOp,
  type Filter,
  type ListQuery,
  type Page,
  type Scalar,
  type Tx,
  type WithId,
} from "./store";

const APP_NAME = "haven";
const MAX_BATCH = 500;

type Globals = { firestore?: Firestore };
const G = globalThis as typeof globalThis & { __havenFirestore?: Globals };
const globals: Globals = (G.__havenFirestore ??= {});

/** The firebase-admin app for Haven (Firestore, Storage and Auth share it). */
export function adminApp(): App {
  const existing = getApps().find((a) => a?.name === APP_NAME);
  if (existing) return existing;
  const sa = firebaseServiceAccount();
  if (!sa) throw new BackendUnavailableError("Firestore credentials are missing (FIREBASE_SERVICE_ACCOUNT_JSON).");
  return initializeApp(
    {
      credential: cert({ projectId: sa.projectId, clientEmail: sa.clientEmail, privateKey: sa.privateKey }),
      projectId: sa.projectId,
      ...(env.firebase.storageBucket ? { storageBucket: env.firebase.storageBucket } : {}),
    },
    APP_NAME,
  );
}

function firestore(): Firestore {
  if (!globals.firestore) {
    const db = initializeFirestore(adminApp(), { preferRest: true });
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings() may only be called once per instance; a reused instance already has them.
    }
    globals.firestore = db;
  }
  return globals.firestore;
}

/* ── Conversion (*At ↔ Timestamp, FieldOps) ────────────────────────────── */

const AT_KEY = /At$/;

function isAtKey(key: string | undefined): boolean {
  return key !== undefined && AT_KEY.test(key);
}

function fieldOpToFirestore(op: FieldOp): FieldValue {
  switch (op.$op) {
    case "increment":
      return FieldValue.increment(op.by);
    case "arrayUnion":
      return FieldValue.arrayUnion(...op.values);
    case "arrayRemove":
      return FieldValue.arrayRemove(...op.values);
    case "delete":
      return FieldValue.delete();
  }
}

/** Domain value → Firestore value. Numbers under `*At` keys (and inside `*At` arrays) become Timestamps. */
function toFirestore(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;
  if (isFieldOp(value)) return fieldOpToFirestore(value);
  if (typeof value === "number") return isAtKey(key) && Number.isFinite(value) ? Timestamp.fromMillis(value) : value;
  if (Array.isArray(value)) return value.map((v) => toFirestore(v, key));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = toFirestore(v, k);
    }
    return out;
  }
  return value;
}

function lastSegment(fieldPath: string): string {
  const parts = fieldPath.split(".");
  return parts[parts.length - 1];
}

/** An update patch: dotted keys stay field paths; the `*At` rule applies to the last segment. */
function patchToFirestore(patch: DocData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = toFirestore(normaliseValue(v), lastSegment(k));
  }
  return out;
}

/** Firestore value → domain value: every Timestamp becomes epoch ms. */
function fromFirestore(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = fromFirestore(v);
    return out;
  }
  return value;
}

function filterValue(field: string, value: Scalar): unknown {
  return typeof value === "number" && isAtKey(lastSegment(field)) ? Timestamp.fromMillis(value) : value;
}

function toWithId<T>(data: unknown, id: string): WithId<T> {
  return { ...(fromFirestore(data) as object), id } as WithId<T>;
}

/* ── Errors ────────────────────────────────────────────────────────────── */

function grpcCode(err: unknown): number | string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "number" || typeof code === "string" ? code : undefined;
}

/** Maps Firestore errors onto the DocStore error classes; everything else is rethrown unchanged. */
function mapError(err: unknown): unknown {
  if (err instanceof ConflictError || err instanceof NotFoundError || err instanceof MissingIndexError) return err;
  const code = grpcCode(err);
  const message = err instanceof Error ? err.message : "";
  if (code === 6 || code === "already-exists" || code === "ALREADY_EXISTS") return new ConflictError("That record already exists.");
  if (code === 5 || code === "not-found" || code === "NOT_FOUND") return new NotFoundError();
  if ((code === 9 || code === "failed-precondition" || code === "FAILED_PRECONDITION") && /index/i.test(message)) {
    return new MissingIndexError(`Firestore needs an index for this query: ${message.slice(0, 300)}`);
  }
  return err;
}

async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw mapError(err);
  }
}

/* ── Transactions with buffered writes ─────────────────────────────────── */

type WriteOp =
  | { kind: "create"; path: string; data: Record<string, unknown> }
  | { kind: "set"; path: string; data: Record<string, unknown> }
  | { kind: "update"; path: string; patch: Record<string, unknown> }
  | { kind: "delete"; path: string };

function bufferingTx(ops: WriteOp[], state: { open: boolean }, read: (p: string) => Promise<WithId<unknown> | null>): Tx {
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
      ops.push({ kind: "create", path: p, data: toFirestore(normaliseDoc(data)) as Record<string, unknown> });
    },
    set<T>(p: string, data: T) {
      assertOpen();
      parseDocPath(p);
      ops.push({ kind: "set", path: p, data: toFirestore(normaliseDoc(data)) as Record<string, unknown> });
    },
    update(p: string, patch: DocData) {
      assertOpen();
      parseDocPath(p);
      ops.push({ kind: "update", path: p, patch: patchToFirestore(patch) });
    },
    delete(p: string) {
      assertOpen();
      parseDocPath(p);
      ops.push({ kind: "delete", path: p });
    },
  };
}

/* ── The adapter ───────────────────────────────────────────────────────── */

export class FirestoreAdapter implements DocStore {
  readonly kind = "firestore" as const;

  private get db(): Firestore {
    return firestore();
  }

  private ref(p: string): DocumentReference {
    parseDocPath(p);
    return this.db.doc(p);
  }

  async get<T>(p: string): Promise<WithId<T> | null> {
    return guarded(async () => {
      const snap = await this.ref(p).get();
      return snap.exists ? toWithId<T>(snap.data(), snap.id) : null;
    });
  }

  async getMany<T>(paths: string[]): Promise<Array<WithId<T> | null>> {
    if (paths.length === 0) return [];
    return guarded(async () => {
      const snaps = await this.db.getAll(...paths.map((p) => this.ref(p)));
      return snaps.map((s) => (s.exists ? toWithId<T>(s.data(), s.id) : null));
    });
  }

  async create<T>(p: string, data: T): Promise<void> {
    await guarded(async () => {
      await this.ref(p).create(toFirestore(normaliseDoc(data)) as Record<string, unknown>);
    });
  }

  async set<T>(p: string, data: T): Promise<void> {
    await guarded(async () => {
      await this.ref(p).set(toFirestore(normaliseDoc(data)) as Record<string, unknown>);
    });
  }

  async update(p: string, patch: DocData, opts?: { expectedVersion?: number }): Promise<void> {
    const ref = this.ref(p);
    const data = patchToFirestore(patch);
    if (Object.keys(data).length === 0) return;
    await guarded(async () => {
      if (opts?.expectedVersion === undefined) {
        await ref.update(data);
        return;
      }
      const expected = opts.expectedVersion;
      await this.db.runTransaction(async (t) => {
        const snap = await t.get(ref);
        if (!snap.exists) throw new NotFoundError();
        if (snap.get("version") !== expected) throw new ConflictError();
        t.update(ref, data);
      });
    });
  }

  async delete(p: string, opts?: { recursive?: boolean }): Promise<void> {
    const ref = this.ref(p);
    await guarded(async () => {
      if (opts?.recursive) await this.db.recursiveDelete(ref);
      else await ref.delete();
    });
  }

  private query(collectionPath: string, where: Filter[]): Query {
    parseCollectionPath(collectionPath);
    let q: Query = this.db.collection(collectionPath);
    for (const f of where) {
      if (f.op === "in") {
        if (!Array.isArray(f.value) || f.value.length === 0 || f.value.length > 30) throw new Error('An "in" filter needs 1–30 values.');
        q = q.where(f.field, "in", f.value.map((v) => filterValue(f.field, v)));
      } else {
        q = q.where(f.field, f.op as WhereFilterOp, filterValue(f.field, f.value));
      }
    }
    return q;
  }

  async list<T>(collectionPath: string, lq: ListQuery): Promise<Page<T>> {
    if (!Number.isInteger(lq.limit) || lq.limit < 1 || lq.limit > 100) throw new Error("A list query limit is 1–100.");
    const { field, dir } = lq.orderBy;
    return guarded(async () => {
      let q = this.query(collectionPath, lq.where ?? []).orderBy(field, dir).orderBy(FieldPath.documentId(), dir);
      if (lq.cursor) {
        const cursor = decodeCursor(lq.cursor);
        q = q.startAfter(filterValue(field, cursor.value), cursor.id);
      }
      const snap = await q.limit(lq.limit + 1).get();
      const docs = snap.docs.slice(0, lq.limit);
      const items = docs.map((d) => toWithId<T>(d.data(), d.id));
      const last = docs[docs.length - 1];
      const lastValue = last ? fromFirestore(last.get(field)) : null;
      return {
        items,
        nextCursor: snap.docs.length > lq.limit && last ? encodeCursor(lastValue, last.id) : null,
      };
    });
  }

  async count(collectionPath: string, where: Filter[] = []): Promise<number> {
    return guarded(async () => {
      const snap = await this.query(collectionPath, where).count().get();
      return snap.data().count;
    });
  }

  async listIds(collectionPath: string): Promise<string[]> {
    parseCollectionPath(collectionPath);
    return guarded(async () => {
      const snap = await this.db.collection(collectionPath).select().get();
      return snap.docs.map((d) => d.id);
    });
  }

  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return guarded(() =>
      this.db.runTransaction(async (t) => {
        const ops: WriteOp[] = [];
        const state = { open: true };
        const tx = bufferingTx(ops, state, async (p) => {
          const snap = await t.get(this.ref(p));
          return snap.exists ? toWithId(snap.data(), snap.id) : null;
        });
        let result: R;
        try {
          result = await fn(tx);
        } finally {
          state.open = false;
        }
        if (ops.length > MAX_BATCH) throw new Error(`A transaction holds at most ${MAX_BATCH} writes.`);
        for (const op of ops) {
          const ref = this.db.doc(op.path);
          if (op.kind === "create") t.create(ref, op.data);
          else if (op.kind === "set") t.set(ref, op.data);
          else if (op.kind === "update") t.update(ref, op.patch);
          else t.delete(ref);
        }
        return result;
      }),
    );
  }

  async batch(write: (b: Omit<Tx, "get">) => void): Promise<void> {
    const ops: WriteOp[] = [];
    const state = { open: true };
    const tx = bufferingTx(ops, state, async () => null);
    try {
      write({ create: tx.create, set: tx.set, update: tx.update, delete: tx.delete });
    } finally {
      state.open = false;
    }
    if (ops.length === 0) return;
    if (ops.length > MAX_BATCH) throw new Error(`A batch holds at most ${MAX_BATCH} writes.`);
    await guarded(async () => {
      const b = this.db.batch();
      for (const op of ops) {
        const ref = this.db.doc(op.path);
        if (op.kind === "create") b.create(ref, op.data);
        else if (op.kind === "set") b.set(ref, op.data);
        else if (op.kind === "update") b.update(ref, op.patch);
        else b.delete(ref);
      }
      await b.commit();
    });
  }
}
