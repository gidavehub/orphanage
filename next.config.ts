import type { NextConfig } from "next";

// Haven's single Next config (PLAN §5.1; next16-notes §15 with D98, D99, D113, D14).
// - Cache Components on: nothing is cached unless it says 'use cache'. Public readers use the custom
//   `content` cacheLife profile; writers invalidate by tag.
// - No webpack key, no experimental.*, no typedRoutes, no images.remotePatterns or localPatterns.
// - Security headers live here (not in proxy.ts): the CSP stays Report-Only (no nonces, so static
//   shells keep working); frame-ancestors 'self' because the admin studio frames the public site.

const isDev = process.env.NODE_ENV === "development";

// `upgrade-insecure-requests` is left out while the policy is Report-Only: browsers ignore it there
// and log a console error on every page. Add it back when the CSP is enforced.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  // Firebase Auth client (staff sign-in pages only)
  "connect-src 'self' https://*.googleapis.com",
  // Firebase Auth helper iframe, Turnstile, privacy-enhanced YouTube embeds in posts
  "frame-src 'self' https://*.firebaseapp.com https://challenges.cloudflare.com https://www.youtube-nocookie.com",
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** Links that carry a secret in the URL: never leak it in a Referer, never cache the response. */
const TOKEN_ROUTES = [
  "/r/:token",
  "/admin/invite/:token",
  "/admin/reset/:token",
  "/donate/manage",
  "/donate/manage/:path*",
  "/donate/receipt/:ref",
  "/unsubscribe",
  "/newsletter/confirm",
  "/privacy/request/verify",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // Public content: serve from cache for 5 minutes on the client, revalidate daily (years of
    // service, seasonal windows), expire after a year. Edits invalidate by tag immediately.
    content: { stale: 300, revalidate: 86_400, expire: 31_536_000 },
  },
  images: {
    // Next 16 defaults to [75] only; hero photography needs a higher tier.
    qualities: [70, 75, 85],
    // WebP only: sources are already WebP, and AVIF encoding hung on at least one generated
    // portrait (story-7) in the optimizer.
    formats: ["image/webp"],
  },
  // Keep local data and raw media sources out of serverless traces.
  outputFileTracingExcludes: { "/*": ["./.data/**/*", "./media-src/**/*"] },

  // Short links for flyers and social bios (public-pages §1.3). Query strings pass through.
  async redirects() {
    return [
      { source: "/volunteer", destination: "/get-involved/volunteer", permanent: true },
      { source: "/partner", destination: "/get-involved/partner", permanent: true },
      { source: "/sponsor", destination: "/get-involved/sponsor", permanent: true },
      { source: "/give", destination: "/donate", permanent: true },
      { source: "/donate/general", destination: "/donate", permanent: true },
      { source: "/report", destination: "/report-a-concern", permanent: true },
      { source: "/help", destination: "/get-support", permanent: true },
      { source: "/blog", destination: "/news", permanent: true },
      { source: "/blog/:slug", destination: "/news/:slug", permanent: true },
    ];
  },

  // D113. When several entries match, the later one wins for the same header key.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      ...TOKEN_ROUTES.map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      })),
    ];
  },
};

export default nextConfig;
