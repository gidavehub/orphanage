import "server-only";

// Internal counters with no personal data (integrations §8.2): metrics/{YYYY-MM-DD} holds counts such
// as donate_checkout_stripe or form_support; the daily block rolls days up into metrics/{YYYY-MM}.
// Never throws: counting must never break the thing being counted.

import type { Metric } from "@/lib/model/domain/system";
import { getStore } from "@/lib/server/db";
import { F } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";

const KEY = /^[a-z0-9_]{1,60}$/;

export function dayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Adds to today's counters. */
export async function bumpMetrics(counts: Record<string, number>): Promise<void> {
  const entries = Object.entries(counts).filter(([k, n]) => KEY.test(k) && Number.isFinite(n) && n !== 0);
  if (!entries.length) return;
  const day = dayKey();
  const path = `metrics/${day}`;
  try {
    await getStore().runTransaction(async (tx) => {
      const cur = await tx.get<Metric>(path);
      const now = Date.now();
      if (!cur) tx.set(path, { day, counts: Object.fromEntries(entries), updatedAt: now } satisfies Metric);
      else tx.update(path, { ...Object.fromEntries(entries.map(([k, n]) => [`counts.${k}`, F.increment(n)])), updatedAt: now });
    });
  } catch (err) {
    log.warn("metrics.bump_failed", { err });
  }
}

/** Rolls yesterday into its month (metrics/{YYYY-MM}); idempotent per day. */
export async function rollUpDay(day: string): Promise<boolean> {
  const store = getStore();
  const src = await store.get<Metric & { rolledUp?: boolean }>(`metrics/${day}`);
  if (!src || src.rolledUp) return false;
  const month = day.slice(0, 7);
  await store.runTransaction(async (tx) => {
    const again = await tx.get<Metric & { rolledUp?: boolean }>(`metrics/${day}`);
    if (!again || again.rolledUp) return;
    const m = await tx.get<Metric>(`metrics/${month}`);
    const now = Date.now();
    if (!m) tx.set(`metrics/${month}`, { day: month, counts: { ...again.counts }, updatedAt: now } satisfies Metric);
    else tx.update(`metrics/${month}`, { ...Object.fromEntries(Object.entries(again.counts).map(([k, n]) => [`counts.${k}`, F.increment(n)])), updatedAt: now });
    tx.update(`metrics/${day}`, { rolledUp: true });
  });
  return true;
}
