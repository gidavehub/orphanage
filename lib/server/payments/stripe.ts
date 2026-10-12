import "server-only";

// The Stripe client (integrations §3.12, next16-notes §12). Constructed lazily and only when
// STRIPE_SECRET_KEY exists; without it every gift is a pledge. No apiVersion: the SDK pins its own.
// Never import this from client code; never call Stripe during render or inside 'use cache'.

import Stripe from "stripe";
import { env, features } from "@/lib/server/env";

const G = globalThis as typeof globalThis & { __havenStripe?: { key: string; client: Stripe } };

/** The Stripe client, or null when card payments are off. */
export function getStripe(): Stripe | null {
  const key = env.stripe.secretKey;
  if (!key) return null;
  const memo = G.__havenStripe;
  if (memo && memo.key === key) return memo.client;
  const client = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Haven" } });
  G.__havenStripe = { key, client };
  return client;
}

/** "off" without a key; "test" for sk_test_/rk_test_; "live" otherwise. */
export function stripeMode(): "off" | "test" | "live" {
  if (!features.stripe) return "off";
  return features.stripeLive ? "live" : "test";
}
