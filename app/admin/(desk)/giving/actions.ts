"use server";

// Giving Server Actions (admin-ux §6.6). The DAL and the workflow engine check donation.manage and
// the record; allocation changes expire the public totals tag so cause pages update (D36, D38).

import { drainAfterResponse } from "@/lib/server/email/outbox";
import { refresh, updateTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { ActionResult } from "@/lib/forms/types";
import { actionError } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { STEP_UP_MS } from "@/lib/model/session";
import { requireStaff } from "@/lib/server/auth/session";
import { sendCardPaymentLinks } from "@/lib/server/payments/pay";
import { refundDonation } from "@/lib/server/payments/refunds";
import { getDonateConfig } from "@/lib/content/public";
import { recordGift, targetOptions, type RecordGiftInput } from "@/lib/server/dal/donations";
import { donationMachine, inkindMachine, type DonationInput } from "@/lib/server/workflow/donation";
import { transitionResult } from "@/lib/server/workflow/flow";

export async function moveGift(
  ref: string,
  kind: "cash" | "in_kind",
  edgeId: string,
  expectedVersion: number,
  input: DonationInput = {},
): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  const v = await requireStaff("donation.manage");
  if (!/^[a-z_]{2,40}$/.test(edgeId)) return actionError({ kind: "not_allowed", message: "That step isn't available." });
  const machine = kind === "in_kind" ? inkindMachine : donationMachine;
  const r = await transitionResult(() => machine.transition({ ref, edgeId, actor: v, expectedVersion, input: input as never }));
  if (r.ok) {
    if (edgeId === "allocate" || edgeId === "reallocate" || edgeId === "refund") updateTag(TAG.donationTotals);
    drainAfterResponse();
    refresh();
  }
  return r;
}

export async function recordGiftAction(input: RecordGiftInput): Promise<ActionResult<{ ref: string }>> {
  const r = await recordGift(input);
  if (r.ok) {
    drainAfterResponse();
    refresh();
  }
  return r;
}

/** Options for the "Record a gift" sheet: where a gift can go, and the currencies on offer. */
export async function giftSheetOptions(): Promise<{ targets: Array<{ key: string; label: string; target: unknown }>; currencies: string[] }> {
  await requireStaff("donation.manage");
  const [targets, config] = await Promise.all([targetOptions(), getDonateConfig()]);
  return { targets: targets.map((t) => ({ key: t.key, label: t.label, target: t.target })), currencies: config.currencies.map((c) => c.code) };
}

/** Refund a card gift through Stripe (full when amountMinor is null). Asks for a recent sign-in. */
export async function refundCardAction(ref: string, amountMinor: number | null): Promise<ActionResult<{ requested: number }>> {
  const v = await requireStaff("donation.manage");
  if (Date.now() - v.authTime > STEP_UP_MS) return actionError({ kind: "forbidden", message: "Please confirm it's you first.", paths: ["step-up"] });
  if (typeof ref !== "string" || !/^HVN-DN-\d{4}-\d{4,}$/.test(ref)) return actionError({ kind: "not_allowed", message: "That gift doesn't exist." });
  const r = await refundDonation(ref, typeof amountMinor === "number" && Number.isFinite(amountMinor) ? amountMinor : null, v);
  if (r.ok) refresh();
  return r;
}

/** Send card payment links to donors who asked to pay by card while it was off. */
export async function sendPayLinksAction(refs: string[]): Promise<ActionResult<{ queued: number }>> {
  const v = await requireStaff("donation.manage");
  const clean = Array.isArray(refs) ? refs.filter((r) => typeof r === "string" && /^HVN-DN-\d{4}-\d{4,}$/.test(r)).slice(0, 100) : [];
  const out = await sendCardPaymentLinks(clean, v);
  refresh();
  return { ok: true, data: out };
}

