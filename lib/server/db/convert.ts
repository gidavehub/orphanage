import "server-only";

// Shared, adapter-neutral helpers for the DocStore (data-model §8.2–8.4, PLAN D29–D30):
// path parsing and id validation, new ids, cursor encoding, Firestore-compatible value ordering,
// dotted field paths and FieldOp resolution. The Firestore-specific `*At` <-> Timestamp conversion
// lives in firestore.ts (it needs firebase-admin); this module stays dependency-free.

import { randomBytes } from "node:crypto";
import { isValidDocumentId } from "@/lib/model/enums";
import { isFieldOp, type DocData, type FieldOp, type Scalar } from "./store";

/* ── Paths and ids ─────────────────────────────────────────────────────── */

export type DocPathParts = { collectionPath: string; id: string; segments: string[] };

/** Splits and validates a path; every segment must be a valid document id (D29). */
export function splitPath(path: string): string[] {
  if (typeof path !== "string" || !path) throw new Error("Empty storage path.");
  const segments = path.split("/");
  for (const s of segments) {
    if (!isValidDocumentId(s)) throw new Error("Invalid storage path.");
  }
  return segments;
}

/** "supportRequests/HVN-SR-2026-0001" → { collectionPath: "supportRequests", id: "HVN-SR-2026-0001" }. */
export function parseDocPath(path: string): DocPathParts {
  const segments = splitPath(path);
  if (segments.length % 2 !== 0) throw new Error("A document path has an even number of segments.");
  return { collectionPath: segments.slice(0, -1).join("/"), id: segments[segments.length - 1], segments };
}

/** Validates a collection path ("supportRequests", "supportRequests/HVN-SR-2026-0001/notes"). */
export function parseCollectionPath(path: string): string[] {
  const segments = splitPath(path);
  if (segments.length % 2 !== 1) throw new Error("A collection path has an odd number of segments.");
  return segments;
}

/** The collection id of a collection path (its last segment), used to match composite indexes. */
export function collectionGroupOf(collectionPath: string): string {
  const segments = parseCollectionPath(collectionPath);
  return segments[segments.length - 1];
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 20 random base62 characters (data-model §2): ids for everything that is not sequenced. */
export function newId(length = 20): string {
  const out: string[] = [];
  // Rejection sampling keeps the distribution uniform (62 does not divide 256).
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (const b of bytes) {
      if (b < 248) out.push(BASE62[b % 62]);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

/* ── Cursors ───────────────────────────────────────────────────────────── */

/** Opaque base64url of [orderValue, id]. */
export function encodeCursor(value: unknown, id: string): string {
  return Buffer.from(JSON.stringify([value ?? null, id]), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): { value: Scalar; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === "string") {
      const v = parsed[0];
      if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return { value: v, id: parsed[1] };
    }
  } catch {
    // fall through
  }
  throw new Error("That list position is no longer valid. Please reload the list.");
}

/* ── Values ────────────────────────────────────────────────────────────── */

/** Firestore's cross-type order: null < boolean < number < string < array < map. */
function typeRank(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "boolean") return 1;
  if (typeof v === "number") return 2;
  if (typeof v === "string") return 4;
  if (Array.isArray(v)) return 6;
  return 7;
}

/** Total order compatible with Firestore for scalars (strings compare by UTF-16 code units here). */
export function compareValues(a: unknown, b: unknown): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return 0;
  if (ra === 1) return a === b ? 0 : a ? 1 : -1;
  if (ra === 2) {
    const x = a as number;
    const y = b as number;
    if (Number.isNaN(x)) return Number.isNaN(y) ? 0 : -1;
    if (Number.isNaN(y)) return 1;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (ra === 4) return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
  if (ra === 6) {
    const x = a as unknown[];
    const y = b as unknown[];
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const c = compareValues(x[i], y[i]);
      if (c !== 0) return c;
    }
    return x.length - y.length;
  }
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Same type and equal value (Firestore equality; 1 === 1.0, null === null, missing never matches). */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return false;
  return typeRank(a) === typeRank(b) && compareValues(a, b) === 0;
}

/** True when both values have the same Firestore type (range filters only match within a type). */
export function sameType(a: unknown, b: unknown): boolean {
  return typeRank(a) === typeRank(b);
}

/** Reads a dotted field path ("actor.uid"); undefined when any step is missing. */
export function getField(doc: unknown, field: string): unknown {
  let cur: unknown = doc;
  for (const part of field.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function assertSafeKey(key: string): void {
  if (!key || FORBIDDEN_KEYS.has(key)) throw new Error("Invalid field name.");
}

/** Applies one FieldOp to the current value. */
export function applyFieldOp(current: unknown, op: FieldOp): unknown {
  switch (op.$op) {
    case "increment":
      return (typeof current === "number" ? current : 0) + op.by;
    case "arrayUnion": {
      const arr = Array.isArray(current) ? [...current] : [];
      for (const v of op.values) if (!arr.some((x) => valuesEqual(x, v))) arr.push(v);
      return arr;
    }
    case "arrayRemove": {
      const arr = Array.isArray(current) ? current : [];
      return arr.filter((x) => !op.values.some((v) => valuesEqual(x, v)));
    }
    case "delete":
      return undefined;
  }
}

/** Writes `value` at a dotted path, creating intermediate maps. `undefined` removes the key. */
export function setField(doc: Record<string, unknown>, field: string, value: unknown): void {
  const parts = field.split(".");
  let cur: Record<string, unknown> = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    assertSafeKey(p);
    const next = cur[p];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      if (value === undefined) return;
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  assertSafeKey(last);
  const resolved = isFieldOp(value) ? applyFieldOp(cur[last], value) : value;
  if (resolved === undefined) delete cur[last];
  else cur[last] = resolved;
}

/** Applies an update patch (dotted keys and FieldOps) to a document, in place. */
export function applyPatch(doc: Record<string, unknown>, patch: DocData): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue; // ignoreUndefinedProperties
    setField(doc, key, normaliseValue(value));
  }
}

/**
 * JSON-normalises data for storage: drops `undefined` object properties (like Firestore's
 * ignoreUndefinedProperties), resolves FieldOps inside create/set data, rejects non-finite numbers,
 * functions and class instances other than plain objects, arrays and Dates (stored as epoch ms).
 */
export function normaliseValue(value: unknown): unknown {
  if (value === null) return null;
  if (isFieldOp(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : normaliseValue(v)));
  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) throw new Error("Numbers stored must be finite.");
      return value;
    case "object": {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) throw new Error("Only plain objects can be stored.");
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined) continue;
        assertSafeKey(k);
        out[k] = normaliseValue(v);
      }
      return out;
    }
    default:
      throw new Error(`Values of type ${typeof value} cannot be stored.`);
  }
}

/** Resolves FieldOps found anywhere inside create/set data against an empty value. */
function resolveOpsDeep(value: unknown): unknown {
  if (isFieldOp(value)) return applyFieldOp(undefined, value);
  if (Array.isArray(value)) return value.map(resolveOpsDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = resolveOpsDeep(v);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return value;
}

/**
 * Normalises full document data (create/set). Keys are literal field names here (a key may contain
 * dots, e.g. retention policy ids); only `update` patches treat dots as paths.
 */
export function normaliseDoc(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("Document data must be an object.");
  return resolveOpsDeep(normaliseValue(data)) as Record<string, unknown>;
}
