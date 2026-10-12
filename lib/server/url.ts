import "server-only";

// Absolute URLs for emails, Stripe return URLs and metadata (integrations §2.3, PLAN D112).
// With a request: production uses the canonical origin, everything else the request's own origin
// (previews and localhost). Without one (emails rendered in after() or by cron):
// NEXT_PUBLIC_SITE_URL → (production) https://VERCEL_PROJECT_PRODUCTION_URL → https://VERCEL_URL →
// http://localhost:3001.

import { env } from "./env";

const LOCAL_ORIGIN = "http://localhost:3001";

export function baseUrl(req?: Request): string {
  if (env.vercelEnv === "production" && env.siteUrl) return env.siteUrl;
  // No custom domain yet: production's stable *.vercel.app address, never a per-deployment one.
  if (env.vercelEnv === "production" && env.vercelProductionUrl) return `https://${env.vercelProductionUrl}`;
  if (req) {
    try {
      return new URL(req.url).origin;
    } catch {
      // fall through to the configured origin
    }
  }
  if (env.siteUrl) return env.siteUrl;
  if (env.vercelUrl) return `https://${env.vercelUrl}`;
  return LOCAL_ORIGIN;
}

/** An absolute URL for an app path ("/donate" → "https://…/donate"). Absolute http(s) URLs pass through. */
export function absolute(path: string, req?: Request): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl(req)}/`).toString();
}
