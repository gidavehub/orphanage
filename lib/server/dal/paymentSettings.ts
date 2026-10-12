import "server-only";

// Settings › Giving (admin-ux §6.16; PLAN D63, D71, D131): settings/payment for finance and super
// admins, plus the donate.config content doc (saved through saveDoc). Saving checks `settings.giving`,
// refuses a stale form (someone else saved since it was loaded) and audits the changed fields; bank
// and mobile-money numbers are recorded as changed without their values.

import { loadDoc } from "@/lib/content/read";
import { contentStore } from "@/lib/content/store";
import type { DocData } from "@/lib/content/types";
import type { AuditChange } from "@/lib/model/domain/system";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { DEFAULT_PAYMENT_SETTINGS, type PaymentSettings } from "@/lib/model/domain/settings";
import { CURRENCIES, type Currency, type Millis } from "@/lib/model/enums";
import { PaymentSettingsInput } from "@/lib/schemas/admin/paymentSettings";
import { actorOf, auditTx } from "@/lib/server/audit";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { settingsPath } from "@/lib/server/db/collections";
import { env, features } from "@/lib/server/env";
import { getPaymentSettings } from "@/lib/server/public/settings";

export type GivingSettingsDTO = {
  payment: PaymentSettings;
  /** 0 when settings/payment was never written (the defaults are in use). */
  baseUpdatedAt: number;
  donate: { value: DocData<"donate.config">; version: number };
  /** Card payments can actually run for this currency (a Stripe key exists and the account charges it). */
  cardReady: Record<Currency, boolean>;
  stripeConnected: boolean;
};

export async function getGivingSettings(): Promise<GivingSettingsDTO> {
  await requireStaff("settings.giving", "settings.manage");
  const [raw, payment, donate, rec] = await Promise.all([
    getStore().get<{ updatedAt?: number }>(settingsPath("payment")),
    getPaymentSettings(),
    loadDoc("donate.config", { preview: true }),
    contentStore().getDoc("donate.config"),
  ]);
  return {
    payment,
    baseUpdatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
    donate: { value: donate, version: rec?.version ?? 0 },
    cardReady: Object.fromEntries(CURRENCIES.map((c) => [c, features.stripe && env.stripe.currencies.includes(c)])) as Record<Currency, boolean>,
    stripeConnected: features.stripe,
  };
}

function flat(o: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (o && typeof o === "object" && !Array.isArray(o)) {
    for (const [k, val] of Object.entries(o)) flat(val, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) out[prefix] = Array.isArray(o) ? JSON.stringify(o) : o;
  return out;
}

const scalar = (x: unknown): AuditChange["from"] => (typeof x === "string" || typeof x === "number" || typeof x === "boolean" ? x : null);

/** Recorded as "changed", never with their values. */
const QUIET = /(accountNumber|iban|sortCode|swift|mobileMoney)/;

class StaleSettings extends Error {
  constructor(
    readonly at: number,
    readonly by: string,
  ) {
    super("stale settings");
  }
}

export async function savePaymentSettings(input: unknown): Promise<ActionResult<{ at: Millis }>> {
  const v = await requireStaff("settings.giving", "settings.manage");
  const parsed = PaymentSettingsInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join(".") || "_form"] ??= i.message;
    return actionError({ kind: "validation", fields });
  }
  const { baseUpdatedAt, ...next } = parsed.data;
  try {
    const at = await getStore().runTransaction(async (tx) => {
      const cur = await tx.get<Partial<PaymentSettings> & { updatedAt?: number; updatedBy?: string }>(settingsPath("payment"));
      const curAt = typeof cur?.updatedAt === "number" ? cur.updatedAt : 0;
      if (curAt !== baseUpdatedAt) throw new StaleSettings(curAt, cur?.updatedBy ?? "");
      const now = Date.now();
      const before = flat({ ...DEFAULT_PAYMENT_SETTINGS, ...(cur ?? {}), updatedAt: undefined, updatedBy: undefined });
      const after = flat(next);
      const changed = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      tx.set(settingsPath("payment"), { ...next, updatedAt: now, updatedBy: v.uid });
      auditTx(tx, {
        actor: actorOf(v),
        action: "settings.update",
        area: "settings",
        summary: `${v.displayName} updated Settings › Giving`,
        feed: true,
        targetPath: settingsPath("payment"),
        changes: changed.slice(0, 50).map((field): AuditChange => (QUIET.test(field) ? { field, redacted: true } : { field, from: scalar(before[field]), to: scalar(after[field]) })),
      });
      return now;
    });
    return actionOk({ at });
  } catch (err) {
    if (err instanceof StaleSettings) {
      return actionError({
        kind: "conflict",
        message: "Someone else saved these settings while you were editing. Reload to see their changes.",
        current: { version: 0, updatedBy: err.by, updatedAt: err.at },
      });
    }
    throw err;
  }
}
