import "server-only";

// The sweeper (integrations §3.5, §7.2): the third trigger after the webhook and the return route.
// Open intents with a Checkout Session older than 10 minutes are checked with Stripe: a completed
// session is applied (idempotently), an expired one closes the intent. Run by the tick.

import type { DonationIntent } from "@/lib/model/domain/giving";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";
import { applyCheckoutSession, applySessionExpired } from "./apply";
import { getStripe } from "./stripe";

export type SweepReport = { checked: number; applied: number; expired: number; failed: number };

export async function sweepOpenIntents(now: number = Date.now(), limit = 20): Promise<SweepReport> {
  const report: SweepReport = { checked: 0, applied: 0, expired: 0, failed: 0 };
  const stripe = getStripe();
  if (!stripe) return report;
  const page = await getStore().list<DonationIntent>(C.donationIntents, {
    where: [
      { field: "status", op: "==", value: "open" },
      { field: "createdAt", op: "<", value: now - 10 * 60_000 },
    ],
    orderBy: { field: "createdAt", dir: "asc" },
    limit,
  });
  for (const intent of page.items) {
    if (!intent.checkoutSessionId) {
      // Stripe was never reached (or the id wasn't recorded): nothing to reconcile after a day.
      if (now - intent.createdAt > 86_400_000) await getStore().update(docPath("donationIntents", intent.id), { status: "expired" }).catch(() => undefined);
      continue;
    }
    report.checked++;
    try {
      const session = await stripe.checkout.sessions.retrieve(intent.checkoutSessionId);
      if (session.status === "complete") {
        const r = await applyCheckoutSession(session, { source: "sweeper" });
        if (r.result === "created" || r.result === "updated") report.applied++;
      } else if (session.status === "expired") {
        await applySessionExpired(session, { source: "sweeper" });
        report.expired++;
      }
    } catch (err) {
      report.failed++;
      log.warn("stripe.sweep_failed", { err });
    }
  }
  return report;
}
