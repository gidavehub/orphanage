import "server-only";

// Case references (data-model §3, PLAN D74). The only place references are generated.
//   sequenced  HVN-{PP}-{YYYY}-{NNNN}  gap-free, equal to the document id (SR DN RG AP RR VA PE CM DR SS)
//   concerns   HVN-XXXX-XXXX           random Crockford base32 (no I L O U): neither category nor volume leaks
//   receipts   HVN-RC-YYYY-NNNN        a field on a donation, gap-free for finance
//   sponsors   HVN-SP-NNNN             stable anonymous public code (no year)
// Gap-free: the counter read, its increment and the record create commit in ONE transaction; if any
// part fails nothing commits, so no number is skipped. The year is the UTC (= Banjul) year.
// Counters live in counters/{PP}-{YYYY}, counters/RC-{YYYY} and counters/SP.

import { randomInt } from "node:crypto";
import type { Counter } from "@/lib/model/domain/system";
import type { Millis } from "@/lib/model/enums";
import { REF_PREFIX, type SequencedCollection } from "@/lib/model/refs";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { ConflictError, type Tx } from "@/lib/server/db/store";

export { REF_PREFIX, type SequencedCollection } from "@/lib/model/refs";
export { normaliseRef, collectionOfRef, adminHrefOfRef, isConcernRef, isSequencedRef } from "@/lib/model/refs";

/** Scratch roots (selftests) prefix every path so practice numbering is never consumed. */
export type RefOptions = { root?: string; now?: Millis };

function rootPath(path: string, opts?: RefOptions): string {
  return opts?.root ? `${opts.root}/${path}` : path;
}

export function referenceYear(now: Millis = Date.now()): number {
  return new Date(now).getUTCFullYear();
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

export function counterPath(prefix: string, year?: number, opts?: RefOptions): string {
  return rootPath(`${C.counters}/${year === undefined ? prefix : `${prefix}-${year}`}`, opts);
}

/**
 * Counters already advanced in a transaction. Writes are buffered until commit (tx.get always returns
 * committed state), so a second allocation in the same transaction must continue from here.
 */
const pending = new WeakMap<Tx, Map<string, number>>();

/** Reads and advances a counter inside the transaction; returns the number to use. */
async function nextNumber(tx: Tx, path: string, now: Millis): Promise<number> {
  let advanced = pending.get(tx);
  if (!advanced) {
    advanced = new Map();
    pending.set(tx, advanced);
  }
  let n = advanced.get(path);
  if (n === undefined) {
    const c = await tx.get<Counter>(path);
    n = c && Number.isInteger(c.next) && c.next > 0 ? c.next : 1;
  }
  advanced.set(path, n + 1);
  tx.set<Counter>(path, { next: n + 1, updatedAt: now });
  return n;
}

/**
 * Allocates the next sequenced reference inside an existing transaction (Stripe webhooks, moves,
 * conversions). The caller creates the record with it in the same transaction.
 */
export async function allocateReference(tx: Tx, collection: SequencedCollection, opts?: RefOptions): Promise<string> {
  const now = opts?.now ?? Date.now();
  const prefix = REF_PREFIX[collection];
  const year = referenceYear(now);
  const n = await nextNumber(tx, counterPath(prefix, year, opts), now);
  return `HVN-${prefix}-${year}-${pad4(n)}`;
}

/**
 * Creates a record whose id is its new reference, gap-free. `build` returns the document; `extra`
 * adds events, audit, outbox and notifications to the same commit. Returns the reference.
 */
export async function createWithReference<T>(
  collection: SequencedCollection,
  build: (reference: string, now: Millis) => T,
  extra?: (tx: Tx, reference: string, now: Millis) => void | Promise<void>,
  opts?: RefOptions,
): Promise<string> {
  return getStore().runTransaction(async (tx) => {
    const now = opts?.now ?? Date.now();
    const reference = await allocateReference(tx, collection, { ...opts, now });
    tx.create(rootPath(`${C[collection]}/${reference}`, opts), build(reference, now));
    if (extra) await extra(tx, reference, now);
    return reference;
  });
}

/** The next receipt number (counters/RC-YYYY), inside the acknowledgement transaction. */
export async function nextReceiptNumber(tx: Tx, year?: number, opts?: RefOptions): Promise<string> {
  const now = opts?.now ?? Date.now();
  const y = year ?? referenceYear(now);
  const n = await nextNumber(tx, counterPath("RC", y, opts), now);
  return `HVN-RC-${y}-${pad4(n)}`;
}

/** The next sponsorship profile code (counters/SP), inside the creating transaction. */
export async function nextSponsorCode(tx: Tx, opts?: RefOptions): Promise<string> {
  const now = opts?.now ?? Date.now();
  const n = await nextNumber(tx, counterPath("SP", undefined, opts), now);
  return `HVN-SP-${pad4(n)}`;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A random concern reference: Crockford base32 (no I L O U), 8 characters, about 1.1e12 values. */
export function randomConcernRef(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CROCKFORD[randomInt(CROCKFORD.length)];
  return `HVN-${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * Creates a safeguarding concern under a fresh random reference, retrying on the (astronomically
 * rare) collision. `build`/`extra` as for createWithReference. Returns the reference.
 */
export async function createConcernWithRandomRef<T>(
  build: (reference: string, now: Millis) => T,
  extra?: (tx: Tx, reference: string, now: Millis) => void | Promise<void>,
  opts?: RefOptions,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = randomConcernRef();
    try {
      return await getStore().runTransaction(async (tx) => {
        const now = opts?.now ?? Date.now();
        const path = rootPath(`${C.safeguardingConcerns}/${reference}`, opts);
        if (await tx.get(path)) throw new ConflictError("That reference is taken.");
        tx.create(path, build(reference, now));
        if (extra) await extra(tx, reference, now);
        return reference;
      });
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
    }
  }
  throw new Error("Could not allocate a concern reference. Please try again.");
}
