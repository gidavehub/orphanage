import "server-only";

// Typed collection wrapper (data-model §8.2). Repos and the DAL use it instead of hand-built paths:
//   const supportRepo = createRepo<SupportRequest>("supportRequests");
//   const rec = await supportRepo.get("HVN-SR-2026-0001");
// With a zod schema, every read is parsed outside production, so a record that drifted from its type
// fails loudly on localhost instead of rendering wrongly. Only lib/server/** may import this.

import type { z } from "zod";
import { env } from "@/lib/server/env";
import { C, SUB, assertDocId, type CollectionKey, type SubKey } from "./collections";
import { getStore } from "./index";
import type { DocData, Filter, ListQuery, Page, Tx, WithId } from "./store";

export interface Repo<T extends object> {
  /** The collection path ("supportRequests"). */
  readonly collection: string;
  /** "supportRequests/<id>". */
  path(id: string): string;
  /** "supportRequests/<id>/<sub>". */
  sub(id: string, sub: SubKey): string;
  get(id: string): Promise<WithId<T> | null>;
  getMany(ids: string[]): Promise<Array<WithId<T> | null>>;
  /** Reads inside a transaction. */
  getTx(tx: Tx, id: string): Promise<WithId<T> | null>;
  list(q: ListQuery): Promise<Page<T>>;
  count(where?: Filter[]): Promise<number>;
  create(id: string, data: T): Promise<void>;
  set(id: string, data: T): Promise<void>;
  update(id: string, patch: DocData, opts?: { expectedVersion?: number }): Promise<void>;
  delete(id: string, opts?: { recursive?: boolean }): Promise<void>;
}

function parseOrThrow<T extends object>(collection: string, schema: z.ZodType<T>, doc: WithId<T>): WithId<T> {
  const { id, ...rest } = doc as WithId<T> & Record<string, unknown>;
  const parsed = schema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.length ? first.path.join(".") : "(root)";
    throw new Error(`${collection}/${id} does not match its schema at ${where}: ${first?.message ?? "invalid"}`);
  }
  return { ...(parsed.data as object), id } as WithId<T>;
}

/**
 * A typed repository over one top-level collection (a CollectionKey) or any collection path
 * (e.g. "supportRequests/HVN-SR-2026-0001/notes").
 */
export function createRepo<T extends object>(collection: CollectionKey | string, schema?: z.ZodType<T>): Repo<T> {
  const name = (C as Record<string, string>)[collection] ?? collection;
  const check = schema && env.nodeEnv !== "production" ? schema : null;
  const parse = (d: WithId<T> | null) => (d && check ? parseOrThrow(name, check, d) : d);
  const path = (id: string) => `${name}/${assertDocId(id)}`;

  return {
    collection: name,
    path,
    sub: (id, sub) => `${path(id)}/${SUB[sub]}`,
    get: async (id) => parse(await getStore().get<T>(path(id))),
    getMany: async (ids) => (await getStore().getMany<T>(ids.map(path))).map(parse),
    getTx: async (tx, id) => parse(await tx.get<T>(path(id))),
    list: async (q) => {
      const page = await getStore().list<T>(name, q);
      return check ? { items: page.items.map((d) => parseOrThrow(name, check, d)), nextCursor: page.nextCursor } : page;
    },
    count: (where) => getStore().count(name, where),
    create: (id, data) => getStore().create(path(id), data),
    set: (id, data) => getStore().set(path(id), data),
    update: (id, patch, opts) => getStore().update(path(id), patch, opts),
    delete: (id, opts) => getStore().delete(path(id), opts),
  };
}
