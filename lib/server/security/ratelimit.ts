import "server-only";

// Fixed-window rate limits per subject (data-model §10.4, PLAN D71, D94; integrations §3.7, §5.8).
// The subject is a daily-salted IP hash (ipHash), an emailHash or a staff uid, never a raw value.
// Firestore mode counts in `rateLimits/{sha256(name|subject|window)}` inside a transaction (TTL via
// expireAt); local mode counts in memory (one dev server process). A store failure fails OPEN and is
// logged: people asking for help must never be blocked by our own outage.

import { createHash } from "node:crypto";
import type { Millis } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { RateLimitBucket } from "@/lib/model/domain/system";
import { resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type RateRule = { max: number; windowMs: number };

/** Every limit in one table. Names ending in `_address` are keyed by emailHash, `ai_assist` by uid. */
export const RATE_LIMITS = {
  support: [
    { max: 5, windowMs: HOUR },
    { max: 20, windowMs: DAY },
  ],
  /** Never a bare error: the concern form still accepts (flagged) and shows the emergency notice. */
  concern: [{ max: 10, windowMs: HOUR }],
  donation: [{ max: 10, windowMs: HOUR }],
  volunteer: [{ max: 5, windowMs: HOUR }],
  partnership: [{ max: 5, windowMs: HOUR }],
  contact: [{ max: 5, windowMs: HOUR }],
  report_request: [{ max: 10, windowMs: HOUR }],
  story: [{ max: 5, windowMs: HOUR }],
  newsletter: [{ max: 5, windowMs: HOUR }],
  /** Confirmation emails per address. */
  newsletter_address: [{ max: 3, windowMs: DAY }],
  data_request: [{ max: 3, windowMs: DAY }],
  upload: [{ max: 20, windowMs: HOUR }],
  /** Staff sign-in attempts per IP (local accounts also lock after 5 failures). */
  login: [{ max: 10, windowMs: 15 * MINUTE }],
  /** "Forgot password" requests per IP. */
  forgot: [{ max: 5, windowMs: HOUR }],
  /** Donor magic links: per IP and per address. */
  manage_link: [{ max: 3, windowMs: HOUR }],
  manage_link_address: [{ max: 3, windowMs: DAY }],
  /** "Help me write" per staff member. */
  ai_assist: [{ max: 30, windowMs: HOUR }],
} as const satisfies Record<string, readonly RateRule[]>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

type MemoryBucket = { count: number; resetAt: Millis };
const G = globalThis as typeof globalThis & { __havenRateLimits?: Map<string, MemoryBucket> };
const memory: Map<string, MemoryBucket> = (G.__havenRateLimits ??= new Map());

function bucketKey(name: string, subject: string, rule: RateRule, windowStart: Millis): string {
  return createHash("sha256").update(`${name}|${subject}|${rule.windowMs}|${windowStart}`).digest("base64url");
}

function pruneMemory(now: Millis): void {
  if (memory.size < 5_000) return;
  for (const [k, b] of memory) if (b.resetAt <= now) memory.delete(k);
}

async function countFirestore(key: string, windowStart: Millis, rule: RateRule): Promise<number> {
  const path = `${C.rateLimits}/${key}`;
  return getStore().runTransaction(async (tx) => {
    const cur = await tx.get<RateLimitBucket>(path);
    const count = (cur?.count ?? 0) + 1;
    tx.set<RateLimitBucket>(path, { count, windowStart, expireAt: windowStart + rule.windowMs + DAY });
    return count;
  });
}

/**
 * Counts one attempt against every rule of `name` and reports whether it is allowed. Over-limit
 * attempts are counted too (fixed window). Never throws.
 */
export async function rateLimit(name: RateLimitName, subject: string, now: Millis = Date.now()): Promise<RateLimitResult> {
  const rules: readonly RateRule[] = RATE_LIMITS[name];
  let ok = true;
  let remaining = Number.POSITIVE_INFINITY;
  let retryAfterSec = 0;
  try {
    const backend = resolveBackend();
    pruneMemory(now);
    for (const rule of rules) {
      const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
      const resetAt = windowStart + rule.windowMs;
      const key = bucketKey(name, subject || "unknown", rule, windowStart);
      let count: number;
      if (backend === "firestore") {
        count = await countFirestore(key, windowStart, rule);
      } else {
        const b = memory.get(key);
        count = b && b.resetAt > now ? b.count + 1 : 1;
        memory.set(key, { count, resetAt });
      }
      remaining = Math.min(remaining, Math.max(0, rule.max - count));
      if (count > rule.max) {
        ok = false;
        retryAfterSec = Math.max(retryAfterSec, Math.ceil((resetAt - now) / 1000));
      }
    }
  } catch (err) {
    log.warn("ratelimit.failed_open", { name, err });
    return { ok: true, remaining: 0, retryAfterSec: 0 };
  }
  return { ok, remaining: Number.isFinite(remaining) ? remaining : 0, retryAfterSec };
}

/** Forgets the in-memory counters for a name and subject (local selftests only). */
export function resetLocalRateLimit(name: RateLimitName, subject: string, now: Millis = Date.now()): void {
  for (const rule of RATE_LIMITS[name] as readonly RateRule[]) {
    const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
    memory.delete(bucketKey(name, subject, rule, windowStart));
  }
}
