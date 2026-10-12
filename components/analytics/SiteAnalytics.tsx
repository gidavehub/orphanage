"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Public-site analytics (PLAN D111; integrations §8.1): Vercel Web Analytics, cookieless (no banner
// needed). Rendered once by the site layout and never by the admin. Before anything is sent, token
// and reference URLs are collapsed to their route and every query parameter except utm_* is removed,
// so no token, session id, reference or email ever leaves the browser. NEXT_PUBLIC_ANALYTICS=off
// switches it off.

const NORMALISE: Array<[RegExp, string]> = [
  [/^\/donate\/receipt\/[^/?#]+/, "/donate/receipt/[ref]"],
  [/^\/r\/[^/?#]+/, "/r/[token]"],
  [/^\/m\/.*/, "/m/[file]"],
  // Never tracked.
  [/^\/admin(\/|$).*/, ""],
];

function beforeSend(e: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const u = new URL(e.url);
    for (const [re, to] of NORMALISE) {
      if (!re.test(u.pathname)) continue;
      if (!to) return null;
      u.pathname = to;
    }
    const keep = new URLSearchParams();
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = u.searchParams.get(k);
      if (v) keep.set(k, v.slice(0, 80));
    }
    u.search = keep.toString();
    u.hash = "";
    return { ...e, url: u.toString() };
  } catch {
    return null;
  }
}

export function SiteAnalytics(): React.ReactNode {
  const mode = (process.env.NEXT_PUBLIC_ANALYTICS ?? "").toLowerCase();
  if (mode === "off") return null;
  // The collector exists only on Vercel deployments (NEXT_PUBLIC_VERCEL_ENV is set there); elsewhere
  // NEXT_PUBLIC_ANALYTICS=on turns it on deliberately.
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV && mode !== "on") return null;
  return <Analytics beforeSend={beforeSend} />;
}
