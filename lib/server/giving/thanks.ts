import "server-only";

// The thank-you page's read model (public-pages §4.9, integrations §3.11, PLAN D67, D70). Read-only:
// it never creates or changes a record. Variants:
//   paid        a Stripe session whose intent completed (or a pledge since received)
//   processing  a Stripe session still open or confirming
//   pledge      ?ref=&t= for a cash pledge: how to pay, the reference to quote, Copy buttons
//   in_kind     ?ref=&t= for an in-kind offer
//   generic     anything else, including a tampered or expired token (no personal data at all)
// Only the first name, amount, frequency, cause, reference and a masked email ever leave this module.

import type { Donation } from "@/lib/model/domain/giving";
import type { BankDetails, MobileMoneyAccount } from "@/lib/model/domain/settings";
import type { Currency, Frequency, Handover, InKindCategory, LocalPaymentMethod } from "@/lib/model/enums";
import { FREQUENCY_LABEL, HANDOVER_LABEL, IN_KIND_CATEGORY_LABEL, LOCAL_PAYMENT_METHOD_LABEL } from "@/lib/model/labels";
import { normaliseRef } from "@/lib/model/refs";
import { formatMoney, fromMinor } from "@/lib/money";
import { routes } from "@/lib/routes";
import { getCause, getPaymentSettings } from "@/lib/content/public";
import { maskEmail } from "@/lib/server/dal/_shared";
import { effectiveRoutes } from "@/lib/server/payments/routing";
import { verifyToken } from "@/lib/server/security/hmac";
import { readIntentBySession } from "./intents";
import { readDonation } from "./ledger";

export type ThanksCause = { slug: string; title: string; href: string };

export type PayInstructions = {
  currency: Currency;
  bank: (BankDetails & { rows: Array<{ label: string; value: string; copy?: boolean }> }) | null;
  mobileMoney: Array<MobileMoneyAccount & { providerLabel: string }>;
  note: string | null;
};

type Personal = {
  reference: string;
  firstName: string;
  maskedEmail: string;
  cause: ThanksCause | null;
};

export type ThanksView =
  | { variant: "generic" }
  | ({ variant: "processing" } & Partial<Personal>)
  | ({
      variant: "paid";
      amount: string;
      frequency: Frequency;
      frequencyLabel: string;
      recurring: boolean;
      card: boolean;
      updates: boolean;
    } & Personal)
  | ({
      variant: "pledge";
      amount: string;
      amountMajor: number;
      currency: Currency;
      frequency: Frequency;
      frequencyLabel: string;
      recurring: boolean;
      method: { id: LocalPaymentMethod; label: string } | null;
      instructions: PayInstructions | null;
      /** GMD pledges: "Prefer to pay by card? Give in USD instead" (only when USD can be paid by card). */
      cardAlternative: { href: string; label: string } | null;
      updates: boolean;
    } & Personal)
  | ({
      variant: "in_kind";
      handover: Handover;
      handoverLabel: string;
      items: string[];
      updates: boolean;
    } & Personal);

const GENERIC: ThanksView = { variant: "generic" };

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";
}

async function causeOf(slug: string | null): Promise<ThanksCause | null> {
  if (!slug) return null;
  const c = await getCause(slug);
  return c ? { slug: c.slug, title: c.title, href: c.href } : null;
}

function bankRows(b: BankDetails): Array<{ label: string; value: string; copy?: boolean }> {
  const rows: Array<{ label: string; value: string; copy?: boolean }> = [
    { label: "Bank", value: b.bankName },
    { label: "Account name", value: b.accountName, copy: true },
    { label: "Account number", value: b.accountNumber, copy: true },
  ];
  if (b.branch) rows.push({ label: "Branch", value: b.branch });
  if (b.sortCode) rows.push({ label: "Sort code", value: b.sortCode, copy: true });
  if (b.iban) rows.push({ label: "IBAN", value: b.iban, copy: true });
  if (b.swift) rows.push({ label: "SWIFT / BIC", value: b.swift, copy: true });
  return rows.filter((r) => r.value && r.value.trim());
}

const PROVIDER_LABEL: Record<MobileMoneyAccount["provider"], string> = { wave: "Wave", afrimoney: "Afrimoney", qmoney: "QMoney" };

async function instructionsFor(currency: Currency): Promise<PayInstructions | null> {
  const s = await getPaymentSettings();
  const i = s.instructions[currency];
  if (!i) return null;
  const bank = i.bank && i.bank.accountNumber?.trim() ? { ...i.bank, rows: bankRows(i.bank) } : null;
  const mobileMoney = (i.mobileMoney ?? []).filter((m) => m.number?.trim()).map((m) => ({ ...m, providerLabel: PROVIDER_LABEL[m.provider] ?? m.provider }));
  if (!bank && mobileMoney.length === 0) return null;
  return { currency, bank, mobileMoney, note: i.note?.trim() || null };
}

/** A "nice" amount: 2 significant figures under 1,000, then rounded to tens. */
function nice(n: number): number {
  if (n <= 0) return 0;
  if (n < 10) return Math.max(5, Math.round(n));
  if (n < 1000) return Math.round(n / 5) * 5;
  return Math.round(n / 10) * 10;
}

async function cardAlternativeFor(d: Donation): Promise<{ href: string; label: string } | null> {
  if (!d.cash || d.cash.baseAmount.currency !== "GMD") return null;
  const s = await getPaymentSettings();
  if (effectiveRoutes(s).USD !== "stripe") return null;
  const gmdPerUsd = s.fx.GMD;
  if (!(gmdPerUsd > 0)) return null;
  const usd = nice(fromMinor(d.cash.baseAmount.amountMinor, "GMD") / gmdPerUsd);
  if (usd < 5) return null;
  return {
    href: routes.donate(d.causeSlug ?? undefined, { amount: usd, currency: "USD", frequency: d.frequency }),
    label: `Give about USD ${usd} by card instead`,
  };
}

async function fromDonation(d: Donation): Promise<ThanksView> {
  const personal: Personal = {
    reference: d.reference,
    firstName: firstNameOf(d.donor.fullName),
    maskedEmail: maskEmail(d.donor.email),
    cause: await causeOf(d.causeSlug),
  };
  const updates = d.updatesConsent !== null;
  if (d.status === "cancelled") return GENERIC;

  if (d.kind === "in_kind" && d.inKind) {
    return {
      variant: "in_kind",
      ...personal,
      handover: d.inKind.delivery,
      handoverLabel: HANDOVER_LABEL[d.inKind.delivery],
      items: d.inKind.categories.map((c: InKindCategory) => IN_KIND_CATEGORY_LABEL[c]),
      updates,
    };
  }
  if (!d.cash) return GENERIC;
  const recurring = d.frequency !== "one_time";
  if (d.status === "pledged" || d.status === "pending") {
    const currency = d.cash.amount.currency;
    return {
      variant: "pledge",
      ...personal,
      amount: formatMoney(d.cash.amount),
      amountMajor: fromMinor(d.cash.amount.amountMinor, currency),
      currency,
      frequency: d.frequency,
      frequencyLabel: FREQUENCY_LABEL[d.frequency],
      recurring,
      method: d.cash.localMethod ? { id: d.cash.localMethod, label: LOCAL_PAYMENT_METHOD_LABEL[d.cash.localMethod] } : null,
      instructions: await instructionsFor(currency),
      cardAlternative: await cardAlternativeFor(d),
      updates,
    };
  }
  return {
    variant: "paid",
    ...personal,
    amount: formatMoney(d.cash.amount),
    frequency: d.frequency,
    frequencyLabel: FREQUENCY_LABEL[d.frequency],
    recurring,
    card: d.cash.method === "stripe",
    updates,
  };
}

/** Resolves the variant from the page's search params. Never throws; anything odd → generic. */
export async function resolveThanks(q: { ref?: string | null; t?: string | null; sessionId?: string | null }): Promise<ThanksView> {
  try {
    if (q.sessionId) {
      const intent = await readIntentBySession(q.sessionId);
      if (!intent) return GENERIC;
      if (intent.status === "completed" && intent.donationRef) {
        const d = await readDonation(intent.donationRef);
        if (d) return fromDonation(d);
      }
      if (intent.status === "expired") return GENERIC;
      return {
        variant: "processing",
        firstName: firstNameOf(intent.donor.fullName),
        maskedEmail: maskEmail(intent.donor.email),
        cause: await causeOf(intent.causeSlug),
      };
    }
    if (q.ref && q.t) {
      const ref = normaliseRef(q.ref);
      const token = verifyToken(q.t, "thanks");
      if (!ref || !token || token.sub !== ref) return GENERIC;
      const d = await readDonation(ref);
      return d ? fromDonation(d) : GENERIC;
    }
  } catch {
    return GENERIC;
  }
  return GENERIC;
}
