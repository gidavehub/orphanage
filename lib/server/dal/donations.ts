import "server-only";

// Giving for the team space (admin-ux §6.6; data-model §4.3, §5.2; PLAN D36, D38, D72). Every entry
// point calls requireStaff first. Money is always shown per currency and never added across
// currencies. Card data is never stored: only what Stripe tells us (brand, last 4, reference).

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { getCauses, getProgrammes } from "@/lib/content/public";
import type { Donation, Donor, DonorSnapshot } from "@/lib/model/domain/giving";
import type { AllocationTarget, Currency, Frequency, Handover, InKindCategory, Millis, PaymentMethod, ProgrammeId } from "@/lib/model/enums";
import { FREQUENCY_LABEL, IN_KIND_CATEGORY_LABEL } from "@/lib/model/labels";
import { formatMoney } from "@/lib/money";
import type { StatusOf } from "@/lib/model/status";
import { actorOf, auditTx } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import type { Filter, WithId } from "@/lib/server/db/store";
import { addEventTx, eventActorOf, listEvents } from "@/lib/server/events";
import { donorIdOf, readDonorTx, upsertDonorTx } from "@/lib/server/giving/donors";
import { buildDonation } from "@/lib/server/giving/ledger";
import { consentStamp } from "@/lib/server/intake/pipeline";
import { log } from "@/lib/server/log";
import { allocateReference } from "@/lib/server/references";
import { randomToken } from "@/lib/server/security/hmac";
import { donationMachine, inkindMachine, totalsSlug } from "@/lib/server/workflow/donation";
import { loadForViewer, maskEmail, maskPhone } from "./_shared";
import { shortName } from "./inbox";

type S = StatusOf<"donation">;

/* ── Targets (programmes, causes, where needed most) ───────────────────── */

export type TargetOption = { key: string; label: string; target: AllocationTarget; currency?: Currency };

export async function targetOptions(): Promise<TargetOption[]> {
  await requireStaff("donation.read", "donation.manage");
  const [programmes, causes] = await Promise.all([getProgrammes(), getCauses()]);
  const out: TargetOption[] = [{ key: "general", label: "Where it's needed most", target: { type: "general" } }];
  for (const p of programmes) out.push({ key: `programme:${p.id}`, label: p.title, target: { type: "programme", programmeId: p.id as ProgrammeId } });
  for (const c of causes) {
    if (c.kind === "programme" || c.slug === "general") continue;
    out.push({ key: `cause:${c.slug}`, label: c.title, target: { type: "cause", causeSlug: c.slug }, currency: c.currency as Currency });
  }
  return out;
}

function targetLabel(t: AllocationTarget, options: TargetOption[]): string {
  const key = t.type === "general" ? "general" : t.type === "programme" ? `programme:${t.programmeId}` : `cause:${t.causeSlug}`;
  return options.find((o) => o.key === key)?.label ?? (t.type === "cause" ? t.causeSlug : "Where it's needed most");
}

/* ── The ledger ────────────────────────────────────────────────────────── */

export type GiftRow = {
  ref: string;
  kind: "cash" | "in_kind";
  status: S;
  who: string;
  country: string;
  amount: string;
  frequency: string;
  target: string;
  createdAt: Millis;
  receivedAt: Millis | null;
  online: boolean;
  next: string | null;
};

export type LedgerDTO = {
  month: string;
  rows: GiftRow[];
  totals: Array<{ currency: Currency; amountMinor: number; count: number }>;
  toThank: number;
  notPlaced: number;
  at: Millis;
};

const NEXT: Partial<Record<S, string>> = {
  pledged: "Confirm it arrived",
  pending: "Mark received",
  received: "Say thank you",
  acknowledged: "Put towards…",
  allocated: "Mark complete",
};

function monthBounds(month: string | null, now: Millis): { from: Millis; to: Millis; label: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  const d = new Date(now);
  const y = m ? Number(m[1]) : d.getUTCFullYear();
  const mo = m ? Number(m[2]) - 1 : d.getUTCMonth();
  return { from: Date.UTC(y, mo, 1), to: Date.UTC(y, mo + 1, 1), label: `${y}-${String(mo + 1).padStart(2, "0")}` };
}

export async function listGifts(opts: { month?: string | null } = {}): Promise<LedgerDTO> {
  await requireStaff("donation.read", "donation.manage");
  const now = Date.now();
  const { from, to, label } = monthBounds(opts.month ?? null, now);
  const [options, items] = await Promise.all([
    targetOptions(),
    (async () => {
      const out: Array<WithId<Donation>> = [];
      let cursor: string | null = null;
      for (let i = 0; i < 5; i++) {
        const where: Filter[] = [
          { field: "createdAt", op: ">=", value: from },
          { field: "createdAt", op: "<", value: to },
        ];
        const page: { items: Array<WithId<Donation>>; nextCursor: string | null } = await getStore().list<Donation>(C.donations, { where, orderBy: { field: "createdAt", dir: "desc" }, limit: 100, cursor });
        out.push(...page.items);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return out;
    })().catch((err) => {
      log.warn("dal.donations.list_failed", { err });
      return [] as Array<WithId<Donation>>;
    }),
  ]);

  const totals = new Map<Currency, { amountMinor: number; count: number }>();
  let toThank = 0;
  let notPlaced = 0;
  const rows: GiftRow[] = items.map((d) => {
    const cash = d.kind === "cash" ? d.cash : null;
    if (cash && ["received", "acknowledged", "allocated", "completed"].includes(d.status) && cash.stripe?.livemode !== false) {
      const t = totals.get(cash.amount.currency) ?? { amountMinor: 0, count: 0 };
      totals.set(cash.amount.currency, { amountMinor: t.amountMinor + cash.amount.amountMinor, count: t.count + 1 });
    }
    if (d.status === "received") toThank++;
    if (d.status === "acknowledged") notPlaced++;
    const est = d.inKind?.estimatedValue;
    return {
      ref: d.id,
      kind: d.kind,
      status: d.status,
      who: d.recognition === "anonymous" ? `Anonymous (${shortName(d.donor.fullName)})` : d.donor.donorType === "organisation" && d.donor.organisationName ? d.donor.organisationName : shortName(d.donor.fullName),
      country: d.donor.country,
      amount: cash ? formatMoney(cash.amount) : est ? `In kind ≈ ${formatMoney(est)}` : "In kind",
      frequency: FREQUENCY_LABEL[d.frequency] ?? d.frequency,
      target: d.kind === "in_kind" ? (d.inKind?.categories ?? []).map((c) => IN_KIND_CATEGORY_LABEL[c] ?? c).join(", ") || "In kind" : targetLabel(d.preferredTarget, options),
      createdAt: d.createdAt,
      receivedAt: d.receivedAt,
      online: d.cash?.method === "stripe",
      next: NEXT[d.status] ?? null,
    };
  });
  return {
    month: label,
    rows,
    totals: [...totals.entries()].map(([currency, t]) => ({ currency, ...t })).sort((a, b) => b.count - a.count),
    toThank,
    notPlaced,
    at: now,
  };
}

/* ── One gift ──────────────────────────────────────────────────────────── */

export type GiftDetailDTO = {
  ref: string;
  kind: "cash" | "in_kind";
  workflow: "donation" | "inkind";
  status: S;
  version: number;
  createdAt: Millis;
  receivedAt: Millis | null;
  amount: { amountMinor: number; currency: Currency } | null;
  amountLabel: string;
  frequency: string;
  method: string | null;
  externalRef: string | null;
  online: boolean;
  donor: {
    name: string;
    type: string;
    country: string;
    email: { value: string; masked: boolean } | null;
    phone: { value: string; masked: boolean } | null;
    anonymous: boolean;
    updates: boolean;
  };
  preferred: string;
  comments: string | null;
  sponsorRef: string | null;
  inKind: { items: string; description: string; quantity: string | null; condition: string | null; delivery: string; locality: string | null; received: Array<{ description: string; quantity: string; at: Millis }> } | null;
  allocations: Array<{ id: string; label: string; key: string; amountMinor: number; currency: Currency; note: string | null }>;
  placedMinor: number;
  receipt: { number: string; issuedAt: Millis } | null;
  acknowledgedAt: Millis | null;
  cancelReason: string | null;
  /** Refunded so far (card refunds can be partial). */
  refundedMinor: number;
  canWrite: boolean;
  edges: string[];
  history: Array<{ status: S; at: Millis }>;
  options: TargetOption[];
  otherGifts: number;
};

const METHOD_LABEL: Record<string, string> = { stripe: "Card (Stripe)", bank_transfer: "Bank transfer", mobile_money: "Mobile money", cash: "Cash", cheque: "Cheque", other: "Other" };

export async function getGiftDetail(ref: string): Promise<GiftDetailDTO> {
  const v = await requireStaff("donation.read", "donation.manage");
  const loaded = await loadForViewer(v, ref);
  if (loaded.collection !== "donations") throw new Error("Not a gift.");
  const d = loaded.record as unknown as WithId<Donation>;
  const canWrite = has(v, "donation.manage");
  const summaryOnly = !has(v, "donation.read") && !canWrite;
  const workflow = d.kind === "in_kind" ? "inkind" : "donation";
  const machine = d.kind === "in_kind" ? inkindMachine : donationMachine;
  const [options, events, others] = await Promise.all([
    targetOptions(),
    listEvents(loaded.path, { limit: 60 }),
    getStore()
      .count(C.donations, [{ field: "donorId", op: "==", value: d.donorId }])
      .catch(() => 1),
  ]);
  const history: GiftDetailDTO["history"] = [{ status: "pledged", at: d.createdAt }];
  for (const e of [...events.items].reverse()) if (e.type === "status_changed" && e.to) history.push({ status: e.to as S, at: e.at });
  const amount = d.kind === "cash" ? (d.cash ? { amountMinor: d.cash.amount.amountMinor, currency: d.cash.amount.currency } : null) : d.inKind?.estimatedValue ? { amountMinor: d.inKind.estimatedValue.amountMinor, currency: d.inKind.estimatedValue.currency } : null;
  const seeContact = canWrite || v.roles.includes("super_admin");
  return {
    ref: loaded.ref,
    kind: d.kind,
    workflow,
    status: d.status,
    version: d.version,
    createdAt: d.createdAt,
    receivedAt: d.receivedAt,
    amount,
    amountLabel: amount ? formatMoney(amount) : "In kind",
    frequency: FREQUENCY_LABEL[d.frequency] ?? d.frequency,
    method: d.cash ? (METHOD_LABEL[d.cash.method] ?? d.cash.method) + (d.cash.localMethod ? ` · ${d.cash.localMethod.replace(/_/g, " ")}` : "") : null,
    externalRef: d.cash?.externalRef ?? null,
    online: d.cash?.method === "stripe",
    donor: {
      name: summaryOnly ? shortName(d.donor.fullName) : d.donor.fullName,
      type: d.donor.donorType === "organisation" ? `Organisation${d.donor.organisationName ? `: ${d.donor.organisationName}` : ""}` : "Individual",
      country: d.donor.country,
      email: d.donor.email && !summaryOnly ? (seeContact ? { value: d.donor.email, masked: false } : { value: maskEmail(d.donor.email), masked: true }) : null,
      phone: d.donor.phone && !summaryOnly ? (seeContact ? { value: d.donor.phone, masked: false } : { value: maskPhone(d.donor.phone), masked: true }) : null,
      anonymous: d.recognition === "anonymous",
      updates: !!d.updatesConsent,
    },
    preferred: targetLabel(d.preferredTarget, options),
    comments: summaryOnly ? null : d.comments,
    sponsorRef: d.sponsorRef,
    inKind: d.inKind
      ? {
          items: (d.inKind.categories ?? []).map((c) => IN_KIND_CATEGORY_LABEL[c] ?? c).join(", "),
          description: d.inKind.description,
          quantity: d.inKind.quantity,
          condition: d.inKind.condition,
          delivery: d.inKind.delivery.replace(/_/g, " "),
          locality: d.inKind.locality,
          received: (d.inKind.received ?? []).map((r) => ({ description: r.description, quantity: r.quantity, at: r.receivedAt })),
        }
      : null,
    allocations: (d.allocations ?? []).map((a) => ({
      id: a.id,
      label: targetLabel(a.target, options),
      key: a.target.type === "general" ? "general" : a.target.type === "programme" ? `programme:${a.target.programmeId}` : `cause:${a.target.causeSlug}`,
      amountMinor: a.amount.amountMinor,
      currency: a.amount.currency,
      note: a.note,
    })),
    placedMinor: (d.allocations ?? []).reduce((n, a) => n + a.amount.amountMinor, 0),
    receipt: d.receipt ? { number: d.receipt.number, issuedAt: d.receipt.issuedAt } : null,
    acknowledgedAt: d.acknowledgement?.at ?? null,
    cancelReason: d.cancelReason,
    refundedMinor: d.refund?.amount.amountMinor ?? 0,
    canWrite,
    edges: canWrite ? machine.allowedFor({ status: d.status }, v).map((e) => e.id) : [],
    history,
    options,
    otherGifts: Math.max(0, others - 1),
  };
}

/* ── Receipt ───────────────────────────────────────────────────────────── */

export type ReceiptDTO = {
  number: string;
  ref: string;
  issuedAt: Millis;
  donor: string;
  amount: string;
  frequency: string;
  receivedAt: Millis | null;
  kind: "cash" | "in_kind";
  items: string | null;
};

/** The receipt for a gift that has been thanked (A4 printable page; the public receipt uses the same). */
export async function receiptFor(ref: string, opts: { public?: boolean } = {}): Promise<ReceiptDTO | null> {
  if (!opts.public) await requireStaff("donation.read", "donation.manage");
  const d = await getStore().get<Donation>(docPath("donations", ref));
  if (!d || !d.receipt) return null;
  const amount = d.kind === "cash" && d.cash ? formatMoney(d.cash.amount) : d.inKind?.estimatedValue ? `In kind, estimated ${formatMoney(d.inKind.estimatedValue)}` : "In kind";
  return {
    number: d.receipt.number,
    ref,
    issuedAt: d.receipt.issuedAt,
    donor: d.recognition === "anonymous" ? "Anonymous donor" : d.donor.donorType === "organisation" && d.donor.organisationName ? d.donor.organisationName : d.donor.fullName,
    amount,
    frequency: FREQUENCY_LABEL[d.frequency] ?? d.frequency,
    receivedAt: d.receivedAt,
    kind: d.kind,
    items: d.inKind ? (d.inKind.categories ?? []).map((c) => IN_KIND_CATEGORY_LABEL[c] ?? c).join(", ") + (d.inKind.quantity ? ` (${d.inKind.quantity})` : "") : null,
  };
}

/* ── Record a gift (staff) ─────────────────────────────────────────────── */

export type RecordGiftInput = {
  donor: { fullName: string; type: "individual" | "organisation"; organisation: string | null; email: string | null; phone: string | null; country: string; anonymous: boolean; updates: boolean };
  kind: "cash" | "in_kind";
  currency: Currency;
  amountMinor: number;
  method: PaymentMethod;
  externalRef: string | null;
  frequency: Frequency;
  receivedAt: Millis | null;
  inKind: { categories: InKindCategory[]; description: string; quantity: string | null } | null;
  target: AllocationTarget;
  arrived: boolean;
};

/** Creates a gift recorded by finance (cash, bank, mobile money, in kind). Returns the DN reference. */
export async function recordGift(input: RecordGiftInput): Promise<ActionResult<{ ref: string }>> {
  const v = await requireStaff("donation.manage");
  const name = input.donor.fullName.trim();
  if (name.length < 2) return actionError({ kind: "validation", fields: { fullName: "Write the giver's name." } });
  if (input.kind === "cash" && (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0)) return actionError({ kind: "validation", fields: { amount: "Enter the amount." } });
  if (input.kind === "in_kind" && !input.inKind?.description?.trim()) return actionError({ kind: "validation", fields: { description: "Describe what was given." } });
  const email = input.donor.email?.trim() || null;
  const snapshot: DonorSnapshot = {
    fullName: name.slice(0, 100),
    donorType: input.donor.type,
    organisationName: input.donor.type === "organisation" ? input.donor.organisation?.trim().slice(0, 120) || null : null,
    email: email ?? "",
    emailLower: (email ?? "").toLowerCase(),
    phone: input.donor.phone?.trim() || null,
    country: (input.donor.country || "gm") as DonorSnapshot["country"],
  };
  const donorId = email ? donorIdOf(email) : `offline-${randomToken(9)}`;
  try {
    const ref = await getStore().runTransaction(async (tx) => {
      const now = Date.now();
      const existing: WithId<Donor> | null = email ? await readDonorTx(tx, donorId) : null;
      const reference = await allocateReference(tx, "donations", { now });
      const path = docPath("donations", reference);
      const money = { amountMinor: Math.round(input.amountMinor), currency: input.currency };
      const status = input.arrived ? "received" : "pledged";
      tx.create(
        path,
        buildDonation(reference, now, {
          kind: input.kind,
          status,
          source: "staff_entry",
          donorId,
          donor: snapshot,
          recognition: input.donor.anonymous ? "anonymous" : "named",
          frequency: input.kind === "in_kind" ? "one_time" : input.frequency,
          preferredTarget: input.target,
          causeSlug: input.target.type === "cause" ? input.target.causeSlug : input.target.type === "programme" ? totalsSlug(input.target) : null,
          sponsorRef: null,
          comments: null,
          updatesConsent: input.donor.updates ? consentStamp(now) : null,
          attribution: null,
          ...(input.kind === "cash"
            ? { cash: { amount: money, baseAmount: money, coverFees: false, method: input.method, localMethod: null } }
            : { inKind: { categories: input.inKind!.categories, description: input.inKind!.description.trim().slice(0, 1000), estimatedValue: input.amountMinor > 0 ? money : null, condition: null, delivery: "drop_off" as Handover, locality: null } }),
          receivedAt: input.arrived ? (input.receivedAt && input.receivedAt <= now ? input.receivedAt : now) : null,
        }),
      );
      if (input.kind === "cash" && input.externalRef?.trim()) tx.update(path, { "cash.externalRef": input.externalRef.trim().slice(0, 80) });
      if (input.kind === "in_kind" && input.inKind?.quantity) tx.update(path, { "inKind.quantity": input.inKind.quantity.trim().slice(0, 80) });
      if (email) upsertDonorTx(tx, existing, { donorId, snapshot, recognition: input.donor.anonymous ? "anonymous" : "named", updatesConsent: input.donor.updates ? consentStamp(now) : null, now });
      if (input.arrived && input.kind === "cash" && email) {
        // Lifetime totals move when money is received.
        tx.update(docPath("donors", donorId), { [`totals.${input.currency}.lifetimeMinor`]: existing ? (existing.totals?.[input.currency]?.lifetimeMinor ?? 0) + money.amountMinor : money.amountMinor, [`totals.${input.currency}.gifts`]: (existing?.totals?.[input.currency]?.gifts ?? 0) + 1 });
      }
      addEventTx(tx, path, { type: "created", actor: eventActorOf(v), summary: `${v.displayName.split(" ")[0]} recorded this gift`, at: now });
      auditTx(tx, { actor: actorOf(v), action: "donation.record", area: "donations", summary: `${v.displayName} recorded gift ${reference}`, feed: true, targetPath: path, targetRef: reference });
      return reference;
    });
    return actionOk({ ref });
  } catch (err) {
    log.warn("dal.donations.record_failed", { err });
    return actionError({ kind: "unavailable", message: "The gift didn't save. Please try again." });
  }
}
