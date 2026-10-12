import "server-only";

// Cron authentication and job leases (integrations §2.5, §7; PLAN D110).
// - cronAuthorized(req): the FIRST statement of every /api/cron/* handler (reading the header also
//   keeps the GET dynamic). Compares `Authorization: Bearer ${CRON_SECRET}` in constant time; with
//   no CRON_SECRET every call is refused.
// - withJobLock(job, leaseMs, fn): a lease in cronLocks/{job} so overlapping invocations (Vercel can
//   double-deliver; a pinger plus Vercel) never run a job twice. Acquired and released in transactions.
// - claimDailyGate(day): cronLocks/daily-YYYY-MM-DD created once; the first tick of the day wins.

import { randomUUID, timingSafeEqual } from "node:crypto";
import type { CronLock } from "@/lib/model/domain/system";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { ConflictError } from "@/lib/server/db/store";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";

export function cronAuthorized(req: Request): boolean {
  const got = req.headers.get("authorization") ?? "";
  const want = env.cronSecret ? `Bearer ${env.cronSecret}` : null;
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** The standard 401 for an unauthorised cron call. */
export function cronUnauthorized(): Response {
  return Response.json({ ok: false, error: "unauthorised" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

function lockPath(job: string): string {
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(job)) throw new Error("Invalid job name.");
  return `${C.cronLocks}/${job}`;
}

/**
 * Runs `fn` only if no other invocation holds the job's lease; returns "locked" otherwise. The lease
 * expires after `leaseMs` even if the holder crashed. Errors from `fn` propagate after the release.
 */
export async function withJobLock<T>(job: string, leaseMs: number, fn: () => Promise<T>): Promise<T | "locked"> {
  const path = lockPath(job);
  const holder = randomUUID();
  const store = getStore();
  const acquired = await store.runTransaction(async (tx) => {
    const now = Date.now();
    const cur = await tx.get<CronLock>(path);
    if (cur && cur.until > now) return false;
    tx.set<CronLock>(path, { until: now + leaseMs, holder, acquiredAt: now });
    return true;
  });
  if (!acquired) return "locked";
  try {
    return await fn();
  } finally {
    try {
      await store.runTransaction(async (tx) => {
        const cur = await tx.get<CronLock>(path);
        if (cur && cur.holder === holder) tx.set<CronLock>(path, { until: 0, holder, acquiredAt: cur.acquiredAt });
      });
    } catch (err) {
      log.warn("cron.release_failed", { job, err });
    }
  }
}

/** True for the first caller of the day (UTC); false for every later one. */
export async function claimDailyGate(day: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid day.");
  try {
    const now = Date.now();
    await getStore().create<CronLock>(`${C.cronLocks}/daily-${day}`, { until: now + 36 * 3_600_000, holder: randomUUID(), acquiredAt: now });
    return true;
  } catch (err) {
    if (err instanceof ConflictError) return false;
    throw err;
  }
}
