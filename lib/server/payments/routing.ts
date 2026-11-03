import "server-only";

// Per-currency routing (integrations §3.2, PLAN D63, D71, D131). A currency goes to Stripe Checkout
// only when all three agree: a Stripe key exists, the card setup lists the currency (what the account
// can charge: Settings › Connections, else STRIPE_CURRENCIES), and finance chose "card" in Settings ›
// Giving (settings/payment.routes). Callers pass getCardSetup() (lib/server/payments/keys.ts).
// Everything else is the local route: a pledge with bank or mobile-money instructions. GMD defaults
// to local. Server Components pass the result to client widgets as a prop (never decided client-side).

import type { PaymentRoute, PaymentSettings } from "@/lib/model/domain/settings";
import { CURRENCIES, type Currency } from "@/lib/model/enums";
import type { CardSetup } from "./keys";

export type { PaymentRoute } from "@/lib/model/domain/settings";

export function effectiveRoutes(s: PaymentSettings, card: Pick<CardSetup, "mode" | "currencies">): Record<Currency, PaymentRoute> {
  const out = {} as Record<Currency, PaymentRoute>;
  for (const c of CURRENCIES) {
    out[c] = card.mode !== "off" && card.currencies.includes(c) && s.routes?.[c] === "stripe" ? "stripe" : "local";
  }
  return out;
}

/** The route for one gift: card only when routed to Stripe AND within the online maximum (major units). */
export function routeForGift(s: PaymentSettings, card: Pick<CardSetup, "mode" | "currencies">, currency: Currency, amountMajor: number): PaymentRoute {
  if (effectiveRoutes(s, card)[currency] !== "stripe") return "local";
  const max = s.maxOnline?.[currency];
  return typeof max === "number" && amountMajor > max ? "local" : "stripe";
}

/** True when any currency can be paid by card right now. */
export function anyCardRoute(s: PaymentSettings, card: Pick<CardSetup, "mode" | "currencies">): boolean {
  return Object.values(effectiveRoutes(s, card)).includes("stripe");
}
