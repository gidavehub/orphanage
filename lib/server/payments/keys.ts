import "server-only";

// Haven's Stripe keys (owner, 2026-11-03: "the keys will be stored with us"). A super admin pastes
// them in Settings › Connections › Card payments, or through the secure link Haven emails another
// super admin (lib/server/dal/stripeKeys.ts). They live in settings/stripe: the secret key and the
// webhook signing secret sealed (AES-256-GCM under HAVEN_DATA_KEY), the publishable key in the clear
// (Stripe made it public by design). Saved keys win; without them the STRIPE_* variables still work.
// Two readers:
// - stripeKeys(): everything, secrets included, for server code that calls Stripe or checks a webhook
//   signature. Memoised per server instance for 30 seconds and forgotten on save, so a change reaches
//   every instance within half a minute. Never inside 'use cache', never handed to a browser.
// - getCardSetup(): mode, currencies, publishable key, whether a webhook is set; no secrets. Cached
//   ('use cache', tag settings:stripe) so static pages such as /donate can read it; saving calls
//   updateTag(TAG.settings("stripe")).

import { cacheLife, cacheTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { StripeKeysDoc } from "@/lib/model/domain/settings";
import type { Currency } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { settingsPath } from "@/lib/server/db/collections";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { tryOpenField } from "@/lib/server/security/seal";

export type StripeMode = "off" | "test" | "live";

/** What a page may know about card payments: never a secret. */
export type CardSetup = {
  /** "saved" in Settings › Connections, from the server's "env" variables, or "none". */
  source: "saved" | "env" | "none";
  /** "off" without a secret key; otherwise the key's own mode. */
  mode: StripeMode;
  /** What the Stripe account can charge. */
  currencies: Currency[];
  publishableKey: string | null;
  /** A webhook signing secret is set (renewals, failures and refunds arrive on their own). */
  webhook: boolean;
};

export type StripeKeys = CardSetup & {
  secretKey: string | null;
  webhookSecret: string | null;
  portalConfigId: string | null;
};

export const STRIPE_KEYS_PATH = settingsPath("stripe");
const MEMO_MS = 30_000;
const G = globalThis as typeof globalThis & { __havenStripeKeys?: { at: number; keys: StripeKeys } };

/** "live" for sk_live_/rk_live_ keys, "test" for any other key, "off" without one. */
export function modeOf(secretKey: string | null | undefined): StripeMode {
  if (!secretKey) return "off";
  return /^(sk|rk)_live_/.test(secretKey) ? "live" : "test";
}

function fromEnv(): StripeKeys {
  const s = env.stripe;
  return {
    source: s.secretKey ? "env" : "none",
    mode: modeOf(s.secretKey),
    currencies: s.currencies,
    publishableKey: s.publishableKey,
    webhook: Boolean(s.webhookSecret),
    secretKey: s.secretKey,
    webhookSecret: s.webhookSecret,
    portalConfigId: s.portalConfigId,
  };
}

function setupOf(doc: StripeKeysDoc): CardSetup {
  return { source: "saved", mode: doc.mode, currencies: doc.currencies, publishableKey: doc.publishableKey, webhook: Boolean(doc.webhookSecret) };
}

/** The saved keys, opened; null (with an error logged) when the data key can't open them. */
function openDoc(doc: StripeKeysDoc): StripeKeys | null {
  const secretKey = tryOpenField<string>(STRIPE_KEYS_PATH, "secretKey", doc.secretKey);
  if (!secretKey) {
    log.error("stripe.keys_unreadable", { note: "settings/stripe could not be opened with the configured data keys" });
    return null;
  }
  const webhookSecret = doc.webhookSecret ? tryOpenField<string>(STRIPE_KEYS_PATH, "webhookSecret", doc.webhookSecret) : null;
  return { ...setupOf(doc), webhook: Boolean(webhookSecret), secretKey, webhookSecret, portalConfigId: doc.portalConfigId };
}

/** Every Stripe key Haven uses, secrets included. Server code only. `maxAgeMs` asks for fresher keys. */
export async function stripeKeys(maxAgeMs: number = MEMO_MS): Promise<StripeKeys> {
  const memo = G.__havenStripeKeys;
  if (memo && Date.now() - memo.at < Math.min(maxAgeMs, MEMO_MS)) return memo.keys;
  try {
    const doc = await getStore().get<StripeKeysDoc>(STRIPE_KEYS_PATH);
    const keys = (doc?.secretKey ? openDoc(doc) : null) ?? fromEnv();
    G.__havenStripeKeys = { at: Date.now(), keys };
    return keys;
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) log.warn("stripe.keys_read_failed", { err });
    // A passing read failure keeps the last keys rather than switching card payments off.
    return memo?.keys ?? fromEnv();
  }
}

/** Drops this instance's memo (after a save or removal). */
export function forgetStripeKeys(): void {
  G.__havenStripeKeys = undefined;
}

/** Mode, currencies and the publishable key, cached for pages. Never a secret. */
export async function getCardSetup(): Promise<CardSetup> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.settings("stripe"));
  let doc: StripeKeysDoc | null = null;
  try {
    doc = await getStore().get<StripeKeysDoc>(STRIPE_KEYS_PATH);
  } catch (err) {
    // Never bake "no card payments" into a production build because one read failed.
    if (resolveBackend() === "firestore" && (env as unknown as { isBuild?: boolean }).isBuild === true) throw err;
    if (!(err instanceof BackendUnavailableError)) log.error("stripe.card_setup_read_failed", { err });
  }
  if (doc?.secretKey) return setupOf(doc);
  const { source, mode, currencies, publishableKey, webhook } = fromEnv();
  return { source, mode, currencies, publishableKey, webhook };
}
