import "server-only";

// Gifts and in-kind offers (data-model §5.2; admin-ux §6.6; PLAN D36, D38, D72). Edges come from
// FLOWS (`donation` for money, `inkind` for goods, both in the donations collection). This file adds:
//   receive      → receivedAt, donor totals (money only)
//   acknowledge  → the next gap-free receipt number (counters/RC-YYYY) and donation_acknowledgement
//   allocate     → allocations (≤ the amount, same currency) and causeTotals incremented by the delta
//   complete     → only when everything is placed
//   cancel/refund→ allocations reversed out of causeTotals
// After an allocation change, the Server Action expires TAG.donationTotals so public totals update.

import type { Donation, DonationAllocation, DonationCancelReason } from "@/lib/model/domain/giving";
import type { AllocationTarget, Currency, Millis } from "@/lib/model/enums";
import { PROGRAMME_SLUG } from "@/lib/model/enums";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/routes";
import { docPath } from "@/lib/server/db/collections";
import { F, type Tx } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { nextReceiptNumber } from "@/lib/server/references";
import { signTokenFor } from "@/lib/server/security/hmac";
import { absolute } from "@/lib/server/url";
import { defineMachine, type TransitionInput } from "./flow";

const YEAR = 365 * 86_400_000;

export type AllocationInput = { target: AllocationTarget; amountMinor: number; note?: string | null };

export type DonationInput = TransitionInput & {
  /** receive (money): how it arrived and the bank or mobile-money reference */
  method?: Donation["cash"] extends infer C ? (C extends { method: infer M } ? M : never) : never;
  externalRef?: string | null;
  receivedAt?: Millis;
  /** receive (in kind): what arrived */
  received?: { description: string; quantity: string; valueMinor: number | null };
  /** allocate / reallocate */
  allocations?: AllocationInput[];
  /** cancel_pledge / reopen */
  cancelReason?: DonationCancelReason;
  /** refund */
  refundMinor?: number;
  /** acknowledge: send the email (default yes, when there is an address) */
  letThemKnow?: boolean;
  /** Set by the acknowledge patch for its effect (the receipt number allocated in this transaction). */
  _receiptNumber?: string;
};

type R = Donation;

/** The causeTotals document for an allocation target (programme causes share the programme slug). */
export function totalsSlug(t: AllocationTarget): string {
  if (t.type === "general") return "general";
  if (t.type === "programme") return PROGRAMME_SLUG[t.programmeId];
  return t.causeSlug;
}

function giftMoney(r: R): { amountMinor: number; currency: Currency } | null {
  if (r.kind === "cash") return r.cash ? { amountMinor: r.cash.amount.amountMinor, currency: r.cash.amount.currency } : null;
  return r.inKind?.estimatedValue ? { amountMinor: r.inKind.estimatedValue.amountMinor, currency: r.inKind.estimatedValue.currency } : null;
}

const sum = (a: Array<{ amount: { amountMinor: number } }>) => a.reduce((n, x) => n + x.amount.amountMinor, 0);

type Delta = Map<string, { currency: Currency; minor: number; gifts: number }>;

/** Per-slug change of the public totals between two allocation lists (money gifts only). */
function deltaOf(before: DonationAllocation[], after: DonationAllocation[]): Delta {
  const d: Delta = new Map();
  const add = (list: DonationAllocation[], sign: 1 | -1) => {
    const seen = new Set<string>();
    for (const a of list) {
      const slug = totalsSlug(a.target);
      const cur = d.get(slug) ?? { currency: a.amount.currency, minor: 0, gifts: 0 };
      cur.minor += sign * a.amount.amountMinor;
      if (!seen.has(slug)) {
        cur.gifts += sign;
        seen.add(slug);
      }
      d.set(slug, cur);
    }
  };
  add(before, -1);
  add(after, 1);
  return d;
}

/** Applies a totals change to causeTotals/{slug} (creating the document the first time). */
async function applyTotals(tx: Tx, r: R, delta: Delta, now: Millis): Promise<void> {
  if (r.kind !== "cash" || r.cash?.stripe?.livemode === false) return;
  for (const [slug, v] of delta) {
    if (!v.minor && !v.gifts) continue;
    const path = docPath("causeTotals", slug);
    const existing = await tx.get<Record<string, unknown>>(path);
    if (existing) tx.update(path, { [`${v.currency}.raisedMinor`]: F.increment(v.minor), [`${v.currency}.gifts`]: F.increment(v.gifts), updatedAt: now });
    else tx.set(path, { [v.currency]: { raisedMinor: Math.max(0, v.minor), gifts: Math.max(0, v.gifts) }, updatedAt: now });
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

function buildMachine<W extends "donation" | "inkind">(workflow: W) {
  return defineMachine<W, R, DonationInput>({
    workflow,
    collection: "donations",
    area: "donations",
    guards: {
      receive: ({ record, input }) => {
        if (record.kind === "cash") return record.cash?.amount?.amountMinor ? null : "The gift has no amount yet.";
        if (!input.received?.description?.trim() && !(record.inKind?.received ?? []).length) return "Note what arrived first.";
        return null;
      },
      allocate: ({ record, input }) => allocationProblem(record, input),
      reallocate: ({ record, input }) => allocationProblem(record, input),
      complete: ({ record }) => {
        const m = giftMoney(record);
        if (record.kind === "cash" && m && sum(record.allocations) !== m.amountMinor) return "Place the whole amount before marking it complete.";
        if (record.kind === "in_kind" && !record.allocations.length) return "Say which programme the items went to first.";
        return null;
      },
      cancel_pledge: ({ input }) => (input.cancelReason ? null : "Choose why the pledge is cancelled."),
      refund: ({ input, record }) => {
        const m = giftMoney(record);
        if (!m) return "This gift has no amount to refund.";
        if (!input.refundMinor || input.refundMinor <= 0 || input.refundMinor > m.amountMinor) return "Enter how much was refunded (up to the gift amount).";
        return null;
      },
    },
    patches: {
      receive: ({ record, input, now, viewer }) => {
        const at = input.receivedAt && input.receivedAt <= now ? input.receivedAt : now;
        if (record.kind === "cash") {
          return {
            receivedAt: at,
            ...(input.method ? { "cash.method": input.method } : {}),
            ...(input.externalRef !== undefined ? { "cash.externalRef": input.externalRef?.trim().slice(0, 80) || null } : {}),
          };
        }
        const line = input.received
          ? [{ description: input.received.description.trim().slice(0, 300), quantity: input.received.quantity.trim().slice(0, 80), value: input.received.valueMinor && record.inKind?.estimatedValue ? { amountMinor: input.received.valueMinor, currency: record.inKind.estimatedValue.currency } : null, receivedAt: at, by: viewer?.uid ?? "system" }]
          : [];
        return { receivedAt: at, "inKind.received": [...(record.inKind?.received ?? []), ...line] };
      },
      acknowledge: async ({ tx, now, viewer, input }) => {
        const number = await nextReceiptNumber(tx);
        input._receiptNumber = number;
        return { receipt: { number, issuedAt: now, pdfPath: null }, acknowledgement: { at: now, by: viewer?.uid ?? "system", outboxId: `donation_acknowledgement~${number}` } };
      },
      allocate: ({ input, record, now, viewer }) => ({ allocations: toAllocations(record, input, now, viewer?.uid ?? "system") }),
      reallocate: ({ input, record, now, viewer }) => ({ allocations: toAllocations(record, input, now, viewer?.uid ?? "system") }),
      complete: ({ now }) => ({ completedAt: now }),
      cancel_pledge: ({ input, now }) => ({ cancelledAt: now, cancelReason: input.cancelReason! }),
      refund: ({ input, record, now }) => ({
        cancelledAt: now,
        cancelReason: "refunded",
        refund: { amount: { amountMinor: input.refundMinor!, currency: giftMoney(record)!.currency }, at: now, stripeRefundId: null },
        allocations: [],
      }),
      reopen: () => ({ cancelledAt: null, cancelReason: null }),
    },
    effects: {
      receive: ({ tx, record, now }) => {
        if (record.kind !== "cash" || !record.cash || record.cash.stripe?.livemode === false) return;
        const cur = record.cash.amount.currency;
        tx.update(docPath("donors", record.donorId), {
          [`totals.${cur}.lifetimeMinor`]: F.increment(record.cash.amount.amountMinor),
          [`totals.${cur}.gifts`]: F.increment(1),
          lastGiftAt: now,
          updatedAt: now,
        });
      },
      acknowledge: async ({ tx, record, ref, path, now, input }) => {
        // The receipt number was allocated in this transaction's patch.
        const number = input._receiptNumber ?? null;
        const email = record.donor.email;
        if (!number || input.letThemKnow === false || !email) return;
        const m = giftMoney(record);
        const token = signTokenFor("receipt", ref, YEAR);
        await enqueueEmailTx(tx, {
          template: "donation_acknowledgement",
          to: [email],
          vars: {
            reference: ref,
            receiptNumber: number,
            firstName: record.recognition === "anonymous" ? "" : firstName(record.donor.fullName),
            amount: m ? formatMoney({ amountMinor: m.amountMinor, currency: m.currency }) : "In kind",
            date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Banjul" }).format(record.receivedAt ?? now),
            link: absolute(routes.receipt(ref, token)),
          },
          related: { path, reference: ref },
          dedupeKey: number,
        });
      },
      allocate: ({ tx, record, input, now }) => applyTotals(tx, record, deltaOf([], toAllocations(record, input, now, "x")), now),
      reallocate: ({ tx, record, input, now }) => applyTotals(tx, record, deltaOf(record.allocations, toAllocations(record, input, now, "x")), now),
      refund: ({ tx, record, now }) => applyTotals(tx, record, deltaOf(record.allocations, []), now),
    },
    summary: ({ edge, actorName, ref }) => `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`,
  });
}

function allocationProblem(record: R, input: DonationInput): string | null {
  const list = input.allocations ?? [];
  if (!list.length) return "Choose where the gift goes.";
  if (list.some((a) => !Number.isFinite(a.amountMinor) || a.amountMinor <= 0)) return "Every line needs an amount above zero.";
  const m = giftMoney(record);
  const total = list.reduce((n, a) => n + Math.round(a.amountMinor), 0);
  if (record.kind === "cash" && m && total > m.amountMinor) return `That's more than the gift: ${formatMoney({ amountMinor: total - m.amountMinor, currency: m.currency })} too much.`;
  return null;
}

function toAllocations(record: R, input: DonationInput, now: Millis, by: string): DonationAllocation[] {
  const currency = giftMoney(record)?.currency ?? "USD";
  return (input.allocations ?? []).map((a, i) => ({
    id: `al-${now.toString(36)}-${i}`,
    target: a.target,
    amount: { amountMinor: Math.round(a.amountMinor), currency },
    at: now,
    by,
    note: a.note?.trim().slice(0, 200) || null,
  }));
}

export const donationMachine = buildMachine("donation");
export const inkindMachine = buildMachine("inkind");
