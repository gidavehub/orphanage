import "server-only";

// Filesystem primitives for practice mode (data-model §8.4, PLAN §4.7):
// - atomic writes: tmp file in the same directory → fsync → rename, with Windows EPERM/EBUSY/EACCES
//   retries (antivirus and indexers briefly lock files);
// - multi-file commits: every tmp file first, then the renames;
// - an in-process async mutex (memoised on globalThis, so every module instance in `next dev`
//   shares it) plus a cross-process lock file in .data/locks (next dev, next start and scripts are
//   safe together; a lock older than 10 s without a heartbeat is broken);
// - a JSON read cache keyed by mtime + size, so reads pick up writes from other processes.
// Never used on Vercel: the local backend refuses to start there.

import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES", "EMFILE", "ENFILE", "ENOTEMPTY"]);
const STALE_LOCK_MS = 10_000;
const HEARTBEAT_MS = 3_000;
const LOCK_TIMEOUT_MS = 30_000;

/** The practice-mode data root: <repo>/.data. */
export function dataRoot(): string {
  return path.join(process.cwd(), ".data");
}

/** A path under .data; segments must not escape it. */
export function dataPath(...segments: string[]): string {
  const root = dataRoot();
  const full = path.resolve(root, ...segments);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Path escapes the data folder.");
  return full;
}

function errCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries `fn` on transient Windows file-lock errors: up to 10 tries, 15–150 ms backoff. */
export async function withFsRetry<T>(fn: () => Promise<T>, tries = 10): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!RETRY_CODES.has(errCode(err) ?? "")) throw err;
      await sleep(Math.min(150, 15 * (i + 1)) + Math.floor(Math.random() * 10));
    }
  }
  throw lastErr;
}

async function writeTmp(file: string, content: string | Buffer): Promise<string> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  const fh = await fs.open(tmp, "w");
  try {
    await fh.writeFile(content);
    await fh.sync();
  } finally {
    await fh.close();
  }
  return tmp;
}

async function removeQuietly(file: string): Promise<void> {
  try {
    await fs.unlink(file);
  } catch {
    // already gone
  }
}

/** Atomically replaces one file. */
export async function writeFileAtomic(file: string, content: string | Buffer): Promise<void> {
  await writeFilesAtomic([[file, content]]);
}

/**
 * Commits several files: every tmp file is written and synced first, then each is renamed into
 * place. A crash between renames can leave a partial commit; that is acceptable for practice data.
 */
export async function writeFilesAtomic(files: Array<[file: string, content: string | Buffer]>): Promise<void> {
  const tmps: Array<[tmp: string, file: string]> = [];
  try {
    for (const [file, content] of files) tmps.push([await writeTmp(file, content), file]);
  } catch (err) {
    await Promise.all(tmps.map(([tmp]) => removeQuietly(tmp)));
    throw err;
  }
  let renamed = 0;
  try {
    for (const [tmp, file] of tmps) {
      await withFsRetry(() => fs.rename(tmp, file));
      renamed++;
    }
  } catch (err) {
    await Promise.all(tmps.slice(renamed).map(([tmp]) => removeQuietly(tmp)));
    throw err;
  }
}

/** Reads a file, or null when it doesn't exist (retries transient lock errors). */
export async function readFileOrNull(file: string): Promise<Buffer | null> {
  try {
    return await withFsRetry(() => fs.readFile(file));
  } catch (err) {
    if (errCode(err) === "ENOENT") return null;
    throw err;
  }
}

/** Removes a file or directory tree; missing paths are fine. */
export async function removePath(target: string): Promise<void> {
  await withFsRetry(() => fs.rm(target, { recursive: true, force: true }));
}

/* ── JSON read cache (mtime + size) ────────────────────────────────────── */

type CacheEntry = { mtimeMs: number; size: number; data: unknown };

type Globals = {
  jsonCache: Map<string, CacheEntry>;
  mutexes: Map<string, Mutex>;
};

const G = globalThis as typeof globalThis & { __havenLocalFs?: Globals };
const globals: Globals = (G.__havenLocalFs ??= { jsonCache: new Map(), mutexes: new Map() });

/**
 * Parsed JSON for a file (null when missing). Cached by mtime and size; callers must not mutate the
 * returned value (clone first).
 */
export async function readJsonCached<T>(file: string): Promise<T | null> {
  let stat;
  try {
    stat = await withFsRetry(() => fs.stat(file));
  } catch (err) {
    if (errCode(err) === "ENOENT") {
      globals.jsonCache.delete(file);
      return null;
    }
    throw err;
  }
  const hit = globals.jsonCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.data as T;
  const raw = await readFileOrNull(file);
  if (raw === null) {
    globals.jsonCache.delete(file);
    return null;
  }
  let data: unknown;
  try {
    data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
  } catch {
    throw new Error(`A practice data file is damaged: ${path.relative(process.cwd(), file)}. Restore it or remove it to reseed.`);
  }
  globals.jsonCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, data });
  return data as T;
}

/** Records freshly committed content in the cache (avoids a re-parse of our own write). */
export async function primeJsonCache(file: string, data: unknown): Promise<void> {
  try {
    const stat = await fs.stat(file);
    globals.jsonCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, data });
  } catch {
    globals.jsonCache.delete(file);
  }
}

export function forgetJsonCache(prefix: string): void {
  for (const key of globals.jsonCache.keys()) if (key === prefix || key.startsWith(prefix + path.sep)) globals.jsonCache.delete(key);
}

/* ── Locks ─────────────────────────────────────────────────────────────── */

/** A FIFO async mutex. */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const prev = this.tail;
    this.tail = prev.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/** The process-wide mutex for a name (shared by every module instance). */
export function mutexFor(name: string): Mutex {
  let m = globals.mutexes.get(name);
  if (!m) {
    m = new Mutex();
    globals.mutexes.set(name, m);
  }
  return m;
}

async function acquireFileLock(name: string): Promise<() => Promise<void>> {
  const lockFile = dataPath("locks", `${name}.lock`);
  await fs.mkdir(path.dirname(lockFile), { recursive: true });
  const token = `${process.pid}:${randomBytes(8).toString("hex")}`;
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const fh = await fs.open(lockFile, "wx");
      try {
        await fh.writeFile(JSON.stringify({ token, pid: process.pid, at: Date.now() }));
      } finally {
        await fh.close();
      }
      break;
    } catch (err) {
      const code = errCode(err);
      if (code !== "EEXIST" && !RETRY_CODES.has(code ?? "")) throw err;
      try {
        const stat = await fs.stat(lockFile);
        if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
          await removeQuietly(lockFile);
          continue;
        }
      } catch {
        // vanished between open and stat: retry
      }
      if (Date.now() - started > LOCK_TIMEOUT_MS) {
        throw new Error("The local data store is busy. Please try again in a moment.");
      }
      await sleep(10 + Math.min(90, attempt * 5) + Math.floor(Math.random() * 15));
    }
  }

  const heartbeat = setInterval(() => {
    const now = new Date();
    fs.utimes(lockFile, now, now).catch(() => undefined);
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  return async () => {
    clearInterval(heartbeat);
    try {
      const raw = await fs.readFile(lockFile, "utf8");
      const owner = JSON.parse(raw) as { token?: string };
      if (owner.token === token) await removeQuietly(lockFile);
    } catch {
      // gone or replaced after a stale break: nothing to release
    }
  };
}

/**
 * Runs `fn` while holding the named lock in this process (mutex) and across processes (lock file
 * in .data/locks). Not re-entrant: never call it again from inside `fn` for the same name.
 */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return mutexFor(name).run(async () => {
    const release = await acquireFileLock(name);
    try {
      return await fn();
    } finally {
      await release();
    }
  });
}
