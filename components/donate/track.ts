"use client";

import { trackEvent } from "@/lib/analytics/track";

// Donate funnel events (public-pages §4.11; integrations §8.1): no personal data and never an exact
// amount. Custom events are a paid Vercel feature, so they are off unless NEXT_PUBLIC_ANALYTICS_EVENTS
// is "on" (lib/analytics/track.ts holds the gate).

export type DonateEvent =
  | { name: "donate_view"; data: { cause: string } }
  | { name: "donate_cause_change"; data: { cause: string } }
  | { name: "donate_amount_set"; data: { currency: string; bucket: string } }
  | { name: "donate_checkout_start"; data: { route: string } }
  | { name: "donate_complete"; data: { route: string } };

export function trackDonate(e: DonateEvent): void {
  trackEvent(e.name, e.data);
}
