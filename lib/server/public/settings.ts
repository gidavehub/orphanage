import "server-only";

// Public reads of system settings (PLAN D21, D63; data-model §8.6). Cached readers ('use cache' +
// cacheLife('content') + cacheTag(TAG.settings(…))) over settings/{payment,org,forms}, merged over
// the built-in defaults key by key, so a missing or partly written document never breaks a page.
// Never personal data: `updatedBy` is dropped. Finance and super admins edit these in Settings ›
// Giving (A4) and Settings › Data (A9); their Server Actions call updateTag(TAG.settings(…)).

import { cacheLife, cacheTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import { CURRENCIES, type Currency } from "@/lib/model/enums";
import {
  DEFAULT_FORMS_SETTINGS,
  DEFAULT_ORG_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  type FormsSettings,
  type OrgSettings,
  type PaymentInstruction,
  type PaymentRoute,
  type PaymentSettings,
  type ReceiptSettings,
} from "@/lib/model/domain/settings";
import { getStore } from "@/lib/server/db";
import { settingsPath } from "@/lib/server/db/collections";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** One settings document, or null. A Firestore failure during `next build` throws (never bake defaults into production). */
async function readSettingsDoc(id: "payment" | "org" | "forms"): Promise<Raw | null> {
  try {
    const doc = await getStore().get<Raw>(settingsPath(id));
    return isRecord(doc) ? doc : null;
  } catch (err) {
    if (resolveBackend() === "firestore" && (env as unknown as { isBuild?: boolean }).isBuild === true) throw err;
    log.error("public.settings_read_failed", { id, err });
    return null;
  }
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string";
const bool = (v: unknown): v is boolean => typeof v === "boolean";

function perCurrency<T>(base: Record<Currency, T>, raw: unknown, ok: (v: unknown) => v is T): Record<Currency, T> {
  const out = { ...base };
  if (!isRecord(raw)) return out;
  for (const c of CURRENCIES) if (ok(raw[c])) out[c] = raw[c] as T;
  return out;
}

const isRoute = (v: unknown): v is PaymentRoute => v === "stripe" || v === "local";

function instructionOf(raw: unknown, fallback: PaymentInstruction | undefined): PaymentInstruction | undefined {
  if (!isRecord(raw)) return fallback ? structuredClone(fallback) : undefined;
  const base = fallback ?? { methods: [], bank: null, mobileMoney: [], note: null };
  return {
    methods: Array.isArray(raw.methods) ? (raw.methods.filter(str) as PaymentInstruction["methods"]) : [...base.methods],
    bank: isRecord(raw.bank) ? (structuredClone(raw.bank) as unknown as PaymentInstruction["bank"]) : raw.bank === null ? null : base.bank,
    mobileMoney: Array.isArray(raw.mobileMoney)
      ? (raw.mobileMoney.filter(isRecord).map((m) => ({ provider: m.provider, name: String(m.name ?? ""), number: String(m.number ?? "") })) as PaymentInstruction["mobileMoney"])
      : [...base.mobileMoney],
    note: str(raw.note) ? raw.note : raw.note === null ? null : base.note,
  };
}

function receiptOf(raw: unknown): ReceiptSettings {
  const base = DEFAULT_PAYMENT_SETTINGS.receipt;
  if (!isRecord(raw)) return { ...base };
  return {
    legalName: str(raw.legalName) ? raw.legalName : base.legalName,
    registration: str(raw.registration) ? raw.registration : base.registration,
    goodsServicesStatement: bool(raw.goodsServicesStatement) ? raw.goodsServicesStatement : base.goodsServicesStatement,
    signatory: str(raw.signatory) ? raw.signatory : base.signatory,
    footer: str(raw.footer) ? raw.footer : base.footer,
    autoSend: bool(raw.autoSend) ? raw.autoSend : base.autoSend,
  };
}

/** settings/payment merged over the defaults (routes, instructions, FX, cover fees, limits, receipts). */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.settings("payment"));
  const raw = await readSettingsDoc("payment");
  const d = DEFAULT_PAYMENT_SETTINGS;
  if (!raw) return structuredClone(d);
  const instructions: PaymentSettings["instructions"] = {};
  for (const c of CURRENCIES) {
    const i = instructionOf(isRecord(raw.instructions) ? raw.instructions[c] : undefined, d.instructions[c]);
    if (i) instructions[c] = i;
  }
  return {
    routes: perCurrency(d.routes, raw.routes, isRoute),
    instructions,
    fx: perCurrency(d.fx, raw.fx, (v): v is number => finite(v) && v > 0),
    coverFeesPercent: finite(raw.coverFeesPercent) && raw.coverFeesPercent >= 0 && raw.coverFeesPercent <= 20 ? raw.coverFeesPercent : d.coverFeesPercent,
    maxOnline: perCurrency(d.maxOnline, raw.maxOnline, (v): v is number => finite(v) && v > 0),
    receipt: receiptOf(raw.receipt),
    ...(finite(raw.updatedAt) ? { updatedAt: raw.updatedAt } : {}),
  };
}

/** settings/org: timezone, financial-year start and the two-person concern close (D51, D83). */
export async function getOrgSettings(): Promise<OrgSettings> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.settings("org"));
  const raw = await readSettingsDoc("org");
  const d = DEFAULT_ORG_SETTINGS;
  if (!raw) return { ...d };
  const month = raw.financialYearStartMonth;
  return {
    timezone: str(raw.timezone) && raw.timezone ? raw.timezone : d.timezone,
    financialYearStartMonth: finite(month) && Number.isInteger(month) && month >= 1 && month <= 12 ? month : d.financialYearStartMonth,
    concernTwoPersonClose: bool(raw.concernTwoPersonClose) ? raw.concernTwoPersonClose : d.concernTwoPersonClose,
    ...(finite(raw.updatedAt) ? { updatedAt: raw.updatedAt } : {}),
  };
}

/** settings/forms: lets staff pause intake without a deploy. */
export async function getFormsSettings(): Promise<FormsSettings> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.settings("forms"));
  const raw = await readSettingsDoc("forms");
  const d = DEFAULT_FORMS_SETTINGS;
  if (!raw) return { ...d };
  return {
    supportOpen: bool(raw.supportOpen) ? raw.supportOpen : d.supportOpen,
    counsellingOpen: bool(raw.counsellingOpen) ? raw.counsellingOpen : d.counsellingOpen,
    closedMessage: str(raw.closedMessage) && raw.closedMessage.trim() ? raw.closedMessage : null,
    ...(finite(raw.updatedAt) ? { updatedAt: raw.updatedAt } : {}),
  };
}
