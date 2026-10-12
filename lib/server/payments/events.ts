import "server-only";

// stripeEvents/{eventId} (integrations §3.6; PLAN D69). The webhook short-circuits on processedAt; the
// domain transaction re-reads the record and marks it processed in the same commit, so concurrent
// duplicate deliveries serialise on this document. Errors are kept for the admin view. TTL 90 days.

import type { StripeEventRecord } from "@/lib/model/domain/giving";
import type { Millis } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import type { Tx } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";

const TTL = 90 * 86_400_000;

/** Selftests write under a scratch root; everything else uses the real collections. */
export type Scope = { root?: string };

export function at(scope: Scope | undefined, path: string): string {
  return scope?.root ? `${scope.root}/${path}` : path;
}

export type EventRef = { id: string; type: string };

/** Stripe event ids (evt_…) and our own markers (cs_…) are both valid document ids. */
function eventPath(id: string, scope?: Scope): string {
  return at(scope, docPath("stripeEvents", id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200)));
}

/** True when this event was already applied (the cheap pre-check outside any transaction). */
export async function isEventProcessed(id: string, scope?: Scope): Promise<boolean> {
  try {
    return Boolean((await getStore().get<StripeEventRecord>(eventPath(id, scope)))?.processedAt);
  } catch {
    return false;
  }
}

/** Inside the domain transaction: false when another delivery already applied it. */
export async function eventOpenTx(tx: Tx, event: EventRef | undefined, scope?: Scope): Promise<boolean> {
  if (!event) return true;
  const cur = await tx.get<StripeEventRecord>(eventPath(event.id, scope));
  return !cur?.processedAt;
}

/** Marks the event processed in the domain transaction. */
export function markEventTx(tx: Tx, event: EventRef | undefined, donationRef: string | null, now: Millis, scope?: Scope): void {
  if (!event) return;
  const doc: StripeEventRecord = { type: event.type, receivedAt: now, processedAt: now, donationRef, error: null, expireAt: now + TTL };
  tx.set(eventPath(event.id, scope), doc);
}

/** Records a failed delivery (Stripe retries); never throws. */
export async function recordEventError(event: EventRef, err: unknown, scope?: Scope): Promise<void> {
  const now = Date.now();
  const message = err instanceof Error ? err.message.slice(0, 300) : "Unknown error";
  try {
    const store = getStore();
    const path = eventPath(event.id, scope);
    const cur = await store.get<StripeEventRecord>(path);
    if (cur?.processedAt) return;
    await store.set(path, { type: event.type, receivedAt: cur?.receivedAt ?? now, processedAt: null, donationRef: null, error: message, expireAt: now + TTL } satisfies StripeEventRecord);
  } catch (e) {
    log.warn("stripe.event_error_record_failed", { id: event.id, err: e });
  }
}
