import type { MetadataRoute } from "next";
import { env } from "@/lib/server/env";
import { baseUrl } from "@/lib/server/url";

// /robots.txt (public-pages §7.3, PLAN D114). On Vercel only the production deployment is indexable
// (previews and staging disallow everything); elsewhere the public site is crawlable. Private and
// token pages are disallowed even in production.
const DISALLOW = [
  "/admin",
  "/api/",
  "/donate/thank-you",
  "/donate/receipt",
  "/donate/manage",
  "/search",
  "/unsubscribe",
  "/newsletter/confirm",
  "/privacy/request/verify",
  "/link-expired",
  "/r/",
  "/m/private",
];

export default function robots(): MetadataRoute.Robots {
  if (env.onVercel && env.vercelEnv !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOW },
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
