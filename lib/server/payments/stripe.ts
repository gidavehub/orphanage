import "server-only";

// The Stripe client (integrations §3.12, next16-notes §12). Built lazily from the secret key Haven
// uses (lib/server/payments/keys.ts: saved in Settings › Connections, else STRIPE_SECRET_KEY);
// without one every gift is a pledge. No apiVersion: the SDK pins its own.
// Never import this from client code; never call Stripe during render or inside 'use cache'.

import Stripe from "stripe";
import { stripeKeys } from "./keys";

const G = globalThis as typeof globalThis & { __havenStripe?: { key: string; client: Stripe } };

/** A client for any key (checking pasted keys before they're saved). */
export function stripeClientFor(key: string): Stripe {
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Haven" } });
}

/** The Stripe client, or null when card payments are off. */
export async function getStripe(): Promise<Stripe | null> {
  const { secretKey: key } = await stripeKeys();
  if (!key) return null;
  const memo = G.__havenStripe;
  if (memo && memo.key === key) return memo.client;
  const client = stripeClientFor(key);
  G.__havenStripe = { key, client };
  return client;
}
