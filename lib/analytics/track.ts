"use client";

import { track } from "@vercel/analytics";

// Custom analytics events (integrations §8.1). Custom events are a paid Vercel feature, so they are
// off unless NEXT_PUBLIC_ANALYTICS_EVENTS is "on" (and off with NEXT_PUBLIC_ANALYTICS=off). Never
// personal data: names, emails, references or exact amounts (amounts are bucketed by the caller).

export type EventData = Record<string, string | number | boolean | null>;

const ON = (process.env.NEXT_PUBLIC_ANALYTICS_EVENTS ?? "").toLowerCase() === "on" && (process.env.NEXT_PUBLIC_ANALYTICS ?? "").toLowerCase() !== "off";

/** Sends one event, or nothing when events are off. Never throws. */
export function trackEvent(name: string, data?: EventData): void {
  if (!ON) return;
  try {
    track(name, data);
  } catch {
    // Analytics must never break the page.
  }
}

/** "<25" | "25-99" | "100-499" | "500+" in major units (never the exact amount). */
export function amountBucket(major: number): string {
  if (major < 25) return "<25";
  if (major < 100) return "25-99";
  if (major < 500) return "100-499";
  return "500+";
}
