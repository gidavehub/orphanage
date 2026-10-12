// Money formatting and minor-unit helpers (client-safe). Amounts are stored as integer minor units
// (`Money`); display keeps the ISO code first so mixed-currency causes read unambiguously.

import type { Currency, Money } from "@/lib/model/enums";

const formats = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency, fractionDigits: 0 | 2): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formats.set(key, f);
  }
  return f;
}

/** "GMD 186,000" / "USD 3,400": major units, whole numbers, ISO code first. */
export function money(amount: number, currency: Currency) {
  return formatter(currency, 0).format(amount);
}

export const plainNumber = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

/** Stripe's zero-decimal currencies (integrations §3.2). GMD, USD, GBP and EUR all use 100. */
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function minorFactor(c: string): 1 | 100 {
  return ZERO_DECIMAL.has(c.toUpperCase()) ? 1 : 100;
}

/** Major units → integer minor units (12.5 USD → 1250). */
export function toMinor(major: number, c: Currency): number {
  return Math.round(major * minorFactor(c));
}

/** Integer minor units → major units (1250 → 12.5). */
export function fromMinor(minor: number, c: Currency): number {
  return minor / minorFactor(c);
}

/** "USD 27.50", or "USD 50" for whole amounts. */
export function formatMoney(m: Money): string {
  const major = fromMinor(m.amountMinor, m.currency);
  const whole = Number.isInteger(major);
  return formatter(m.currency, whole ? 0 : 2).format(major);
}

/** The amount to charge when the donor chooses to cover fees: round(base × (1 + percent / 100)). */
export function withCoverFees(baseMinor: number, coverFees: boolean, percent: number): number {
  if (!coverFees || !(percent > 0)) return baseMinor;
  return Math.round(baseMinor * (1 + percent / 100));
}
