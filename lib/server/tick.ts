import "server-only";

// The tick (integrations §7.2): run by /api/cron/tick every 15 minutes on Pro (or daily on Hobby plus
// the pinger). Each step has its own try/catch so one failure never stops the rest, and each returns
// a small summary. The first tick at or after 06:00 UTC runs the daily block once (cronLocks gate).

import type { Donation } from "@/lib/model/domain/giving";
import type { SafeguardingConcern } from "@/lib/model/domain/concern";
import type { SupportRequest } from "@/lib/model/domain/support";
import { adminHrefOfRef } from "@/lib/model/refs";
import { systemActor } from "@/lib/model/viewer";
import { publishDuePosts } from "@/lib/content/posts";
import { claimDailyGate } from "@/lib/server/cron";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { sendDailyDigests } from "@/lib/server/email/digest";
import { drainOutbox, enqueueEmail } from "@/lib/server/email/outbox";
import { log } from "@/lib/server/log";
import { dayKey, rollUpDay } from "@/lib/server/metrics";
import { notify, recipientsFor, superAdminUids } from "@/lib/server/notify";
import { enrichPending } from "@/lib/server/payments/enrich";
import { sweepOpenIntents } from "@/lib/server/payments/reconcile";
import { firstNameOf } from "@/lib/server/intake/caseBase";
import { supportMachine } from "@/lib/server/workflow/support";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export type StepResult = { ok: true; [k: string]: unknown } | { ok: false; error: string };
export type TickReport = { at: number; steps: Record<string, StepResult>; daily: Record<string, StepResult> | "not_due" | "done_today" };

async function step(name: string, fn: () => Promise<Record<string, unknown>>): Promise<[string, StepResult]> {
  try {
    return [name, { ok: true, ...(await fn()) }];
  } catch (err) {
    log.error("tick.step_failed", { step: name, err });
    return [name, { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "failed" }];
  }
}

/** Support requests waiting for information close 30 days after it was asked for (§5.1). */
async function closeNoResponse(now: number): Promise<number> {
  const page = await getStore().list<SupportRequest>(C.supportRequests, {
    where: [
      { field: "status", op: "==", value: "more_info_required" },
      { field: "statusChangedAt", op: "<", value: now - 16 * DAY },
    ],
    orderBy: { field: "statusChangedAt", dir: "asc" },
    limit: 50,
  });
  let closed = 0;
  for (const r of page.items) {
    const due = r.moreInfo?.dueAt ?? r.statusChangedAt + 14 * DAY;
    if (due + 16 * DAY > now) continue;
    try {
      await supportMachine.transition({ ref: r.id, edgeId: "close_no_response", actor: systemActor("tick") });
      closed++;
    } catch (err) {
      log.warn("tick.close_no_response_failed", { err });
    }
  }
  return closed;
}

/** One in-app nudge to whoever is looking after a record when its follow-up date arrives. */
async function followUpsDue(now: number): Promise<number> {
  let sent = 0;
  for (const collection of ["supportRequests", "volunteerApplications", "partnershipEnquiries", "safeguardingConcerns"] as const) {
    const page = await getStore().list<{ followUpAt: number | null; assignedTo: string | null; followUpNotifiedAt?: number | null; reference?: string }>(C[collection], {
      where: [
        { field: "followUpAt", op: "<=", value: now },
        { field: "followUpAt", op: ">", value: now - 7 * DAY },
      ],
      orderBy: { field: "followUpAt", dir: "asc" },
      limit: 50,
    });
    for (const r of page.items) {
      if (!r.assignedTo || r.followUpNotifiedAt === r.followUpAt) continue;
      const ref = r.reference ?? r.id;
      const concern = collection === "safeguardingConcerns";
      await notify({ recipientUids: [r.assignedTo], kind: "follow_up_due", title: concern ? "A safeguarding follow-up is due" : `Follow-up due on ${ref}`, href: adminHrefOfRef(ref), priority: concern ? "urgent" : "normal" });
      await getStore().update(docPath(collection, r.id), { followUpNotifiedAt: r.followUpAt });
      sent++;
    }
  }
  return sent;
}

/**
 * The backstop for safeguarding re-alerts (§4.3, data-model §5.5): re-alert emails are scheduled with
 * the provider, but in mailbox mode or after a send failure the team must still be told in-app. Every
 * 2 hours without anyone opening the concern, one urgent note; the third also goes to super admins.
 */
async function concernBackstop(now: number): Promise<number> {
  const page = await getStore().list<SafeguardingConcern & { realertNotified?: number }>(C.safeguardingConcerns, {
    where: [{ field: "status", op: "==", value: "received" }],
    orderBy: { field: "status", dir: "asc" },
    limit: 100,
  });
  let sent = 0;
  for (const c of page.items) {
    if (c.acknowledgedAt || c.archived) continue;
    const step = Math.min(3, Math.floor((now - c.createdAt) / (2 * HOUR)));
    if (step <= (c.realertNotified ?? 0)) continue;
    const alert = await recipientsFor("concern_alert").catch(() => []);
    const admins = step >= 3 ? await superAdminUids().catch(() => []) : [];
    await notify({ recipientUids: [...new Set([...alert, ...admins])], kind: "concern_alert", priority: "urgent", title: "A safeguarding item is still waiting to be opened", href: "/admin/safeguarding" });
    await getStore().update(docPath("safeguardingConcerns", c.id), { realertNotified: step });
    sent++;
  }
  return sent;
}

/** Day 5: a gentle reminder to donors who pledged; day 30: a prompt to finance (once each). */
async function pledgeFollowUps(now: number): Promise<{ reminders: number; prompts: number }> {
  const page = await getStore().list<Donation & { financePromptAt?: number | null }>(C.donations, {
    where: [
      { field: "status", op: "==", value: "pledged" },
      { field: "createdAt", op: "<", value: now - 5 * DAY },
    ],
    orderBy: { field: "createdAt", dir: "desc" },
    limit: 100,
  });
  let reminders = 0;
  let prompts = 0;
  const finance = await recipientsFor("finance_alert").catch(() => []);
  for (const d of page.items) {
    const age = now - d.createdAt;
    if (d.kind === "cash" && age < 30 * DAY && d.donor.email && !d.isSample) {
      const r = await enqueueEmail({ template: "pledge_reminder", to: [d.donor.email], vars: { reference: d.id, firstName: d.recognition === "anonymous" ? "" : (firstNameOf(d.donor.fullName) ?? "") }, dedupeKey: `${d.id}~day5`, related: { path: docPath("donations", d.id), reference: d.id } }).catch(() => null);
      if (r && !r.deduped) reminders++;
    }
    if (age >= 30 * DAY && !d.financePromptAt && finance.length) {
      await notify({ recipientUids: finance, kind: "follow_up_due", title: `Pledge ${d.id} is a month old: follow up or close it`, href: `/admin/giving/${d.id}` });
      await getStore().update(docPath("donations", d.id), { financePromptAt: now });
      prompts++;
    }
  }
  return { reminders, prompts };
}

/** Runs every tick step, and the daily block when it's due. */
export async function runTick(now: number = Date.now()): Promise<TickReport> {
  const steps = Object.fromEntries(
    await Promise.all([
      step("outbox", async () => ({ ...(await drainOutbox(50)) })),
      step("posts", async () => {
        const r = await publishDuePosts(now);
        return { published: r.published.length, failed: r.failed.length };
      }),
      step("closeNoResponse", async () => ({ closed: await closeNoResponse(now) })),
      step("followUps", async () => ({ notified: await followUpsDue(now) })),
      step("concernBackstop", async () => ({ notified: await concernBackstop(now) })),
      step("stripeSweep", async () => ({ ...(await sweepOpenIntents(now, 20)) })),
      step("stripeEnrich", async () => ({ enriched: await enrichPending(20) })),
    ]),
  ) as Record<string, StepResult>;

  let daily: TickReport["daily"] = "not_due";
  if (new Date(now).getUTCHours() >= 6) {
    const day = dayKey(now);
    if (await claimDailyGate(day)) {
      daily = Object.fromEntries([
        await step("pledges", async () => ({ ...(await pledgeFollowUps(now)) })),
        await step("digests", async () => ({ queued: await sendDailyDigests(day) })),
        await step("metrics", async () => ({ rolledUp: await rollUpDay(dayKey(now - DAY)) })),
      ]) as Record<string, StepResult>;
      // Digest emails were queued after the first drain.
      await drainOutbox(50).catch(() => undefined);
    } else daily = "done_today";
  }
  return { at: now, steps, daily };
}
