import "server-only";

// The storage interface (data-model §8.2). One DocStore, two adapters: LocalJsonAdapter (.data/db)
// and FirestoreAdapter (firebase-admin). Both must pass the selftest contract suite. Only the DAL,
// intake, public readers and content store use it; app/** never imports lib/server/db (PLAN §4.2).

export type Scalar = string | number | boolean | null;
export type DocData = Record<string, unknown>;
export type WithId<T> = T & { id: string };

/**
 * Deliberately NOT supported: "!=", "not-in", "array-contains-any" and OR queries. That keeps the
 * adapters at parity and every query index-backed; use explicit `in` lists of statuses instead.
 */
export type Filter =
  | { field: string; op: "==" | "<" | "<=" | ">" | ">="; value: Scalar }
  /** At most 30 values. */
  | { field: string; op: "in"; value: Scalar[] }
  | { field: string; op: "array-contains"; value: Scalar };

export interface ListQuery {
  where?: Filter[];
  /** A single order field; the document id is the implicit tiebreaker. */
  orderBy: { field: string; dir: "asc" | "desc" };
  /** 1–100 (admin lists use 25). */
  limit: number;
  /** Opaque base64url of [orderValue, id]. */
  cursor?: string | null;
}

export interface Page<T> {
  items: WithId<T>[];
  nextCursor: string | null;
}

export type FieldOp =
  | { $op: "increment"; by: number }
  | { $op: "arrayUnion"; values: Scalar[] }
  | { $op: "arrayRemove"; values: Scalar[] }
  | { $op: "delete" };

export const F = {
  increment: (by: number): FieldOp => ({ $op: "increment", by }),
  arrayUnion: (...values: Scalar[]): FieldOp => ({ $op: "arrayUnion", values }),
  arrayRemove: (...values: Scalar[]): FieldOp => ({ $op: "arrayRemove", values }),
  delete: (): FieldOp => ({ $op: "delete" }),
};

export function isFieldOp(value: unknown): value is FieldOp {
  return typeof value === "object" && value !== null && "$op" in value && typeof (value as { $op: unknown }).$op === "string";
}

export interface Tx {
  /** All gets must precede writes (Firestore semantics). */
  get<T>(path: string): Promise<WithId<T> | null>;
  /** Fails the commit if the document exists. */
  create<T>(path: string, data: T): void;
  set<T>(path: string, data: T): void;
  /** Dotted keys ("triage.verification.status") and FieldOps. */
  update(path: string, patch: DocData): void;
  delete(path: string): void;
}

export interface DocStore {
  readonly kind: "firestore" | "local";
  get<T>(path: string): Promise<WithId<T> | null>;
  getMany<T>(paths: string[]): Promise<Array<WithId<T> | null>>;
  create<T>(path: string, data: T): Promise<void>;
  set<T>(path: string, data: T): Promise<void>;
  /** Throws ConflictError when expectedVersion doesn't match. */
  update(path: string, patch: DocData, opts?: { expectedVersion?: number }): Promise<void>;
  /** recursive: subcollections too. */
  delete(path: string, opts?: { recursive?: boolean }): Promise<void>;
  list<T>(collectionPath: string, q: ListQuery): Promise<Page<T>>;
  count(collectionPath: string, where?: Filter[]): Promise<number>;
  /** Maintenance only (retention, export). */
  listIds(collectionPath: string): Promise<string[]>;
  runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
  /** At most 500 operations. */
  batch(write: (b: Omit<Tx, "get">) => void): Promise<void>;
}

/** "Someone else saved changes a moment ago. Reload to see them." */
export class ConflictError extends Error {
  constructor(message = "Someone else saved changes a moment ago. Reload to see them.") {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "That record no longer exists.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** A query whose fields are not covered by firestore.indexes.json (thrown in local mode too, for parity). */
export class MissingIndexError extends Error {
  constructor(message = "This query needs a composite index in firestore.indexes.json.") {
    super(message);
    this.name = "MissingIndexError";
  }
}

/** Backend "unavailable" (Vercel without credentials): callers return the friendly "not switched on yet" state. */
export class BackendUnavailableError extends Error {
  constructor(message = "This part of Haven is not switched on yet.") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}
