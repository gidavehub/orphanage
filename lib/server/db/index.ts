import "server-only";

// The process-wide DocStore (data-model §8.1–8.4, PLAN §4.3, D28, D33).
//   local       → LocalJsonAdapter on .data/db (practice mode; never on Vercel)
//   firestore   → FirestoreAdapter (firebase-admin)
//   unavailable → reads return nothing (callers fall back to seeds and defaults) and writes throw
//                 BackendUnavailableError (callers return the friendly "not switched on yet" state).
// The adapter is memoised on globalThis, keyed by backend and adapter class, so every module instance
// in `next dev` shares it and an edited adapter module is picked up on the next call.

import { resolveBackend, type Backend } from "@/lib/server/env";
import { FirestoreAdapter } from "./firestore";
import { LocalJsonAdapter } from "./local-json";
import { BackendUnavailableError, type DocStore, type Page, type WithId } from "./store";

export type { DocStore } from "./store";

const NOT_CONNECTED = "Records can't be saved here yet: the data store is not connected.";

function refuse(): never {
  throw new BackendUnavailableError(NOT_CONNECTED);
}

/** The "unavailable" backend (Vercel without credentials). Reports itself as Firestore-shaped. */
class UnavailableStore implements DocStore {
  readonly kind = "firestore" as const;

  async get<T>(): Promise<WithId<T> | null> {
    return null;
  }
  async getMany<T>(paths: string[]): Promise<Array<WithId<T> | null>> {
    return paths.map(() => null);
  }
  async create(): Promise<void> {
    refuse();
  }
  async set(): Promise<void> {
    refuse();
  }
  async update(): Promise<void> {
    refuse();
  }
  async delete(): Promise<void> {
    refuse();
  }
  async list<T>(): Promise<Page<T>> {
    return { items: [], nextCursor: null };
  }
  async count(): Promise<number> {
    return 0;
  }
  async listIds(): Promise<string[]> {
    return [];
  }
  async runTransaction<R>(): Promise<R> {
    refuse();
  }
  async batch(): Promise<void> {
    refuse();
  }
}

type Ctor = new () => DocStore;
type Memo = { backend: Backend; ctor: Ctor; store: DocStore };

const G = globalThis as typeof globalThis & { __havenStore?: Memo };

function adapterFor(backend: Backend): Ctor {
  if (backend === "local") return LocalJsonAdapter;
  if (backend === "firestore") return FirestoreAdapter;
  return UnavailableStore;
}

/** The process-wide document store. */
export function getStore(): DocStore {
  const backend = resolveBackend();
  const ctor = adapterFor(backend);
  const memo = G.__havenStore;
  if (memo && memo.backend === backend && memo.ctor === ctor) return memo.store;
  const store = new ctor();
  G.__havenStore = { backend, ctor, store };
  return store;
}

/** False while records cannot be stored (backend "unavailable"). Never throws. */
export function storeAvailable(): boolean {
  try {
    return resolveBackend() !== "unavailable";
  } catch {
    return false;
  }
}
