// The donate experience's client model (public-pages §4.4–4.5): the serialisable data the server hands
// the widget, the widget state, its reducer and the pure helpers (impact hint, live split, currency
// guess, request payload). Isomorphic: no React, no server imports.

import type { CauseKind } from "@/lib/content/schema";
import type { Currency, Frequency, InKindCategory, LocalPaymentMethod } from "@/lib/model/enums";
import { IN_KIND_CATEGORIES } from "@/lib/model/enums";
import { IN_KIND_CATEGORY_LABEL, LOCAL_PAYMENT_METHOD_LABEL } from "@/lib/model/labels";
import { DEFAULT_PAYMENT_SETTINGS } from "@/lib/model/domain/settings";
import type { HomeView } from "@/lib/content/types";
import type { AllocationTone, UiImage } from "@/lib/model/ui";
import { formatMoney, money, toMinor } from "@/lib/money";

export type PaymentRoute = "stripe" | "local";

/** One cause as the widget, picker and panels need it (major units, cause currency). */
export type WidgetCause = {
  slug: string;
  kind: CauseKind;
  title: string;
  eyebrow?: string;
  season: string;
  groupId: string;
  summary: string;
  image: UiImage;
  place?: { code: string; name: string };
  tone: "flame" | "forest" | "clay";
  currency: Currency;
  goal: number;
  raised: number;
  percent: number;
  /** Money figures may be shown (verified, or a seeded placeholder while the switch allows it). */
  showFigures: boolean;
  verified: boolean;
  allocation: Array<{ label: string; percent: number; tone?: AllocationTone; note?: string }>;
  allocationAsOf?: string;
  impactUnits: Array<{ amount: number; currency: Currency; label: string }>;
  presetAmounts: Partial<Record<Currency, number[]>>;
  defaultFrequency: Frequency;
  allowedFrequencies: Frequency[];
  inKindItems: InKindCategory[];
  zakatEligible: boolean;
  live: boolean;
  closed: boolean;
  href: string;
  programmeSlug?: string;
};

export type GivingConfig = {
  currencies: Array<{ code: Currency; name: string; min: number; amounts: number[] }>;
  defaultCurrency: Currency;
  frequencies: Array<{ value: Frequency; label: string }>;
  inKind: Array<{ value: InKindCategory; label: string }>;
  /** Decided on the server (key + STRIPE_CURRENCIES + settings/payment.routes). */
  routes: Record<Currency, PaymentRoute>;
  /** Major units; above it a card gift becomes a bank-transfer pledge. */
  maxOnline: Record<Currency, number>;
  coverFeesPercent: number;
  /** Units per 1 USD (display hints only). */
  fx: Record<Currency, number>;
  /** Pledge-route method chips per currency. */
  methods: Partial<Record<Currency, Array<{ id: LocalPaymentMethod; label: string }>>>;
  donationsEmail: string;
  /** Practice/dev only: "Stripe not configured: pledge mode". */
  pledgeBadge: boolean;
  /** Nothing can be recorded (no backend): show contact details instead of the form. */
  unavailable: boolean;
};

export type DonateMode = "cash" | "in_kind";
export type Step = "choose" | "details" | "redirecting";
export type Condition = "new" | "good" | "mixed";
export type HandoverChoice = "drop_off" | "collection" | "shipping";

export type DonorFields = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  type: "individual" | "organisation";
  organisation: string;
  anonymous: boolean;
  comments: string;
  showComments: boolean;
};

export type DonateState = {
  mode: DonateMode;
  currency: Currency;
  frequency: Frequency;
  /** A preset, or null when the "Other" field (or nothing) is used. */
  amount: number | null;
  other: string;
  coverFees: boolean;
  updates: boolean;
  method: LocalPaymentMethod | null;
  items: InKindCategory[];
  /** The donor changed the in-kind selection (stop pre-checking a cause's items). */
  itemsTouched: boolean;
  description: string;
  condition: Condition | null;
  estValue: string;
  estCurrency: Currency;
  handover: HandoverChoice | null;
  location: string;
  donor: DonorFields;
  step: Step;
  /** Sponsorship code from ?ref= (sponsor-a-child only). */
  ref: string | null;
  attribution: { utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string } | null;
  cancelled: boolean;
  submissionId: string | null;
  /** The donor has changed something (the URL starts mirroring the state). */
  dirty: boolean;
  /** Bumped to ask the widget to scroll into view (impact cards, "Give in kind"). */
  focusTick: number;
};

export const EMPTY_DONOR: DonorFields = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  type: "individual",
  organisation: "",
  anonymous: false,
  comments: "",
  showComments: false,
};

export function initialState(currency: Currency, frequency: Frequency = "one_time"): DonateState {
  return {
    mode: "cash",
    currency,
    frequency,
    amount: null,
    other: "",
    coverFees: false,
    updates: true,
    method: null,
    items: [],
    itemsTouched: false,
    description: "",
    condition: null,
    estValue: "",
    estCurrency: currency,
    handover: null,
    location: "",
    donor: EMPTY_DONOR,
    step: "choose",
    ref: null,
    attribution: null,
    cancelled: false,
    submissionId: null,
    dirty: false,
    focusTick: 0,
  };
}

export type DonateAction =
  | { type: "hydrate"; patch: Partial<DonateState> }
  | { type: "mode"; mode: DonateMode }
  | { type: "currency"; currency: Currency }
  | { type: "frequency"; frequency: Frequency }
  | { type: "preset"; amount: number }
  | { type: "other"; text: string }
  | { type: "example"; amount: number; currency: Currency; preset?: boolean }
  | { type: "toggle"; key: "coverFees" | "updates" }
  | { type: "method"; method: LocalPaymentMethod }
  | { type: "items"; items: InKindCategory[]; touched?: boolean }
  | { type: "field"; key: "description" | "estValue" | "location"; value: string }
  | { type: "condition"; value: Condition }
  | { type: "handover"; value: HandoverChoice }
  | { type: "estCurrency"; currency: Currency }
  | { type: "donor"; patch: Partial<DonorFields> }
  | { type: "step"; step: Step }
  | { type: "focus" };

export function donateReducer(s: DonateState, a: DonateAction): DonateState {
  switch (a.type) {
    case "hydrate":
      return { ...s, ...a.patch };
    case "mode":
      return { ...s, mode: a.mode, step: "choose", dirty: true };
    case "currency":
      // Changing currency clears the amount (today's behaviour) and starts a new submission.
      return a.currency === s.currency ? s : { ...s, currency: a.currency, estCurrency: a.currency, amount: null, other: "", method: null, submissionId: null, dirty: true };
    case "frequency":
      return { ...s, frequency: a.frequency, dirty: true };
    case "preset":
      return { ...s, amount: a.amount, other: "", submissionId: null, dirty: true };
    case "other":
      return { ...s, amount: null, other: a.text, submissionId: null, dirty: true };
    case "example":
      return {
        ...s,
        mode: "cash",
        step: "choose",
        currency: a.currency,
        estCurrency: a.currency,
        amount: a.preset ? a.amount : null,
        other: a.preset ? "" : String(a.amount),
        submissionId: null,
        dirty: true,
        focusTick: s.focusTick + 1,
      };
    case "toggle":
      return { ...s, [a.key]: !s[a.key] };
    case "method":
      return { ...s, method: a.method };
    case "items":
      return { ...s, items: a.items, itemsTouched: a.touched ?? s.itemsTouched };
    case "field":
      return { ...s, [a.key]: a.value };
    case "condition":
      return { ...s, condition: a.value };
    case "handover":
      return { ...s, handover: a.value };
    case "estCurrency":
      return { ...s, estCurrency: a.currency };
    case "donor":
      return { ...s, donor: { ...s.donor, ...a.patch } };
    case "step":
      return { ...s, step: a.step };
    case "focus":
      return { ...s, focusTick: s.focusTick + 1 };
  }
}

/* ── Amounts ───────────────────────────────────────────────────────────── */

/** "1,250.50" → 1250.5; anything else → 0. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** The chosen amount in major units (preset or "Other"). */
export function amountOf(s: Pick<DonateState, "amount" | "other">): number {
  return s.amount ?? parseAmount(s.other);
}

export function presetsFor(cause: WidgetCause | null, config: GivingConfig, currency: Currency): number[] {
  const own = cause?.presetAmounts[currency];
  if (own && own.length === 6) return own;
  return config.currencies.find((c) => c.code === currency)?.amounts ?? [];
}

export function currencyInfo(config: GivingConfig, currency: Currency) {
  return config.currencies.find((c) => c.code === currency) ?? config.currencies[0];
}

/** The fee top-up in major units. */
export function feeOf(amount: number, percent: number): number {
  return Math.round(amount * percent) / 100;
}

/** "USD 51.75" with decimals only when needed. */
export function moneyExact(amount: number, currency: Currency): string {
  return formatMoney({ amountMinor: toMinor(amount, currency), currency });
}

/** A friendly round number for converted hints. */
export function niceAmount(n: number): number {
  if (n <= 0) return 0;
  if (n < 20) return Math.max(1, Math.round(n));
  if (n < 200) return Math.round(n / 5) * 5;
  if (n < 2000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
}

export type ImpactHint = { amount: number; currency: Currency; label: string; approximate: boolean; below: boolean };

/**
 * The largest example at or below the chosen amount, in the chosen currency. Examples in another
 * currency are converted with the FX table, rounded to a nice number and marked approximate. Below
 * every example, the smallest one is returned with `below: true` ("From …").
 */
export function impactHint(cause: WidgetCause | null, currency: Currency, amount: number, fx: Record<Currency, number>): ImpactHint | null {
  if (!cause || cause.impactUnits.length === 0) return null;
  const inCurrency = cause.impactUnits.filter((u) => u.currency === currency).map((u) => ({ ...u, approximate: false }));
  const pool =
    inCurrency.length > 0
      ? inCurrency
      : cause.impactUnits
          .map((u) => {
            const from = fx[u.currency];
            const to = fx[currency];
            if (!(from > 0) || !(to > 0)) return null;
            return { amount: niceAmount((u.amount / from) * to), currency, label: u.label, approximate: true };
          })
          .filter((u): u is { amount: number; currency: Currency; label: string; approximate: boolean } => u !== null && u.amount > 0);
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => a.amount - b.amount);
  if (!(amount > 0)) return null;
  const fit = sorted.filter((u) => u.amount <= amount).pop();
  if (fit) return { ...fit, below: false };
  return { ...sorted[0], below: true };
}

/** The live split of a gift across the cause's allocation lines (2-decimal money). */
export function splitOf(cause: WidgetCause, amount: number, currency: Currency): Array<{ label: string; value: string; percent: number; tone?: AllocationTone }> {
  return cause.allocation.map((p) => ({ label: p.label, percent: p.percent, tone: p.tone, value: moneyExact((amount * p.percent) / 100, currency) }));
}

/* ── Currency default (public-pages §4.4) ──────────────────────────────── */

const EUROZONE = new Set([
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Helsinki",
  "Europe/Athens",
  "Europe/Luxembourg",
  "Europe/Bratislava",
  "Europe/Ljubljana",
  "Europe/Tallinn",
  "Europe/Riga",
  "Europe/Vilnius",
  "Europe/Malta",
  "Asia/Nicosia",
  "Europe/Zagreb",
  "Europe/Monaco",
  "Atlantic/Madeira",
  "Atlantic/Canary",
  "Atlantic/Azores",
]);

export const CURRENCY_STORAGE_KEY = "haven.donate.currency";

/** Last choice (localStorage) → time-zone guess → USD, restricted to enabled currencies. */
export function guessCurrency(enabled: Currency[]): Currency {
  const ok = (c: string | null | undefined): c is Currency => !!c && (enabled as string[]).includes(c);
  try {
    const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (ok(saved)) return saved;
  } catch {
    // storage blocked: fall through
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const guess = tz === "Africa/Banjul" ? "GMD" : tz === "Europe/London" ? "GBP" : EUROZONE.has(tz) ? "EUR" : null;
    if (ok(guess)) return guess;
  } catch {
    // no Intl time zone
  }
  return ok("USD") ? "USD" : enabled[0];
}

export function rememberCurrency(c: Currency): void {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, c);
  } catch {
    // storage blocked: nothing to remember
  }
}

/* ── In-kind labels ────────────────────────────────────────────────────── */

const LABEL_TO_CATEGORY = new Map<string, InKindCategory>(
  (IN_KIND_CATEGORIES as readonly InKindCategory[]).map((c) => [IN_KIND_CATEGORY_LABEL[c].toLowerCase(), c]),
);

/** donate.config / cause labels ("Food supplies") → categories; unknown labels → "other". */
export function categoryOfLabel(label: string): InKindCategory {
  const key = label.trim().toLowerCase();
  const direct = LABEL_TO_CATEGORY.get(key);
  if (direct) return direct;
  if (/school|book|stationer/.test(key)) return "school_materials";
  if (/cloth|shoe|uniform/.test(key)) return "clothing";
  if (/bed|blanket|mattress/.test(key)) return "bedding";
  if (/food|meal|rice/.test(key)) return "food_supplies";
  if (/medic|health/.test(key)) return "medical_supplies";
  if (/computer|laptop|tablet|device/.test(key)) return "computers_devices";
  if (/furniture|desk|chair/.test(key)) return "furniture";
  if (/service|professional/.test(key)) return "professional_services";
  return "other";
}

/* ── The request (lib/server/payments/schemas.ts DonationRequestInput) ─── */

export type DonationPayload = Record<string, unknown>;

export function buildPayload(
  s: DonateState,
  cause: string,
  extra: { elapsed: number; honeypot: string; submissionId: string; pledgeInstead?: boolean },
): DonationPayload {
  const donor = {
    fullName: s.donor.fullName.trim(),
    email: s.donor.email.trim(),
    phone: s.donor.phone.trim() || undefined,
    country: s.donor.country,
    type: s.donor.type,
    organisation: s.donor.type === "organisation" ? s.donor.organisation.trim() : undefined,
    anonymous: s.donor.anonymous,
    comments: s.donor.comments.trim() || undefined,
    updates: s.updates,
  };
  const common = {
    submissionId: extra.submissionId,
    cause,
    donor,
    attribution: s.attribution ?? undefined,
    company_website: extra.honeypot,
    _elapsed: Math.max(0, Math.round(extra.elapsed)),
  };
  if (s.mode === "cash") {
    return {
      mode: "cash",
      ...common,
      ref: s.ref ?? undefined,
      currency: s.currency,
      amount: amountOf(s),
      frequency: s.frequency,
      coverFees: s.coverFees,
      method: s.method ?? undefined,
      ...(extra.pledgeInstead ? { pledgeInstead: true } : {}),
    };
  }
  const est = parseAmount(s.estValue);
  return {
    mode: "in_kind",
    ...common,
    items: s.items,
    description: s.description.trim(),
    condition: s.condition ?? undefined,
    estValue: est > 0 ? { amount: est, currency: s.estCurrency } : undefined,
    handover: s.handover ?? undefined,
    location: s.location.trim(),
  };
}

/** "USD 50 · Monthly · Education" for the details step and the sticky bar. */
export function summaryLine(s: DonateState, causeTitle: string, frequencyLabel: string, coverFeesPercent: number): string {
  if (s.mode === "in_kind") return `${s.items.length} in-kind item type${s.items.length === 1 ? "" : "s"} · ${causeTitle}`;
  const value = amountOf(s);
  const total = s.coverFees ? value + feeOf(value, coverFeesPercent) : value;
  return `${moneyExact(total, s.currency)} · ${frequencyLabel} · ${causeTitle}`;
}

/** Bucket for analytics (never the exact amount). */
export function amountBucket(amount: number, currency: Currency, fx: Record<Currency, number>): string {
  const usd = fx[currency] > 0 ? amount / fx[currency] : amount;
  if (usd < 25) return "<25";
  if (usd < 100) return "25-99";
  if (usd < 500) return "100-499";
  return "500+";
}

export { money };

/* ── Landing fallback ──────────────────────────────────────────────────── */

/**
 * The landing card's data when the page has not passed the server-assembled `giving` prop: built from
 * the home doc's donate slice (display config, appeals, programmes) with the payment defaults. Every
 * gift then pledges, which is exactly today's behaviour without a Stripe key; the server still decides
 * the real route for every submission.
 */
export function givingFromHome(d: HomeView["donate"]): { config: GivingConfig; causes: WidgetCause[] } {
  const p = DEFAULT_PAYMENT_SETTINGS;
  const inKind: GivingConfig["inKind"] = [];
  for (const label of d.config.inKind) {
    const value = categoryOfLabel(label);
    if (!inKind.some((i) => i.value === value)) inKind.push({ value, label });
  }
  const methods: GivingConfig["methods"] = {};
  for (const c of d.config.currencies) {
    const list = p.instructions[c.code]?.methods ?? [];
    if (list.length) methods[c.code] = list.map((id) => ({ id, label: LOCAL_PAYMENT_METHOD_LABEL[id] }));
  }
  const base = (slug: string, title: string, kind: CauseKind, currency: Currency): WidgetCause => ({
    slug,
    kind,
    title,
    season: "",
    groupId: "",
    summary: "",
    image: { src: "", alt: "", decorative: true },
    tone: "forest",
    currency,
    goal: 0,
    raised: 0,
    percent: 0,
    showFigures: false,
    verified: false,
    allocation: [],
    impactUnits: [],
    presetAmounts: {},
    defaultFrequency: "one_time",
    allowedFrequencies: d.config.frequencies.map((f) => f.value),
    inKindItems: [],
    zakatEligible: false,
    live: true,
    closed: false,
    href: slug === "general" ? "/donate" : `/donate/${slug}`,
  });
  return {
    config: {
      currencies: d.config.currencies,
      defaultCurrency: d.config.defaultCurrency,
      frequencies: d.config.frequencies,
      inKind,
      routes: Object.fromEntries(d.config.currencies.map((c) => [c.code, "local"])) as Record<Currency, PaymentRoute>,
      maxOnline: p.maxOnline,
      coverFeesPercent: p.coverFeesPercent,
      fx: p.fx,
      methods,
      donationsEmail: "",
      pledgeBadge: false,
      unavailable: false,
    },
    causes: [
      base("general", "Where it’s needed most", "general", d.config.defaultCurrency),
      ...d.programmes.map((pr) => base(pr.slug, pr.title, "programme", "USD")),
      ...d.causes.map((c) => base(c.slug, c.title, "appeal", c.currency)),
    ],
  };
}
