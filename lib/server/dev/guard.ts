import "server-only";

// Practice-mode helpers (/api/dev/*, one-tap role chips) exist only on a local backend off Vercel
// (PLAN D90). Impossible on Vercel; works under `next dev` and `next start` for QA.

import { notFound } from "next/navigation";
import { env, resolveBackend } from "@/lib/server/env";

/** A site address on this computer (or a .localhost/.test name): practice helpers may run there. */
const LOCAL_SITE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9.-]+\.localhost|[a-z0-9.-]+\.test)(:\d+)?$/i;

/** True when practice-mode helpers may run. */
export function devAllowed(): boolean {
  if (env.onVercel) return false;
  // Hosted anywhere else with a real address but no Firebase keys: still no practice sign-in.
  if (env.siteUrl && !LOCAL_SITE.test(env.siteUrl)) return false;
  try {
    return resolveBackend() === "local";
  } catch {
    return false;
  }
}

/**
 * First statement of every dev route and dev-only action: serves a 404 unless the backend is local
 * and we are not on Vercel. Throws (notFound), so call it outside try/catch.
 */
export function devOnly(): void {
  if (!devAllowed()) notFound();
}
