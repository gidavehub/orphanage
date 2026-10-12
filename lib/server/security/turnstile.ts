import "server-only";

// Cloudflare Turnstile, server side (data-model §10.3, integrations §9). Optional: active only when
// both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set; otherwise every check is
// "off" and the honeypot, time trap and rate limits carry the load.
// POST siteverify with secret, response and idempotency_key (no remoteip: minimisation), 3 s timeout.
// Requires success and the expected action. Support and concern FAIL OPEN on "unavailable" (the
// submission is kept and noted); every other form fails closed.
// I7 owns this file in Phase I (widget wiring and any refinement); the contract below is final.

import { randomUUID } from "node:crypto";
import { env, features } from "@/lib/server/env";
import { log } from "@/lib/server/log";

export const TURNSTILE_ACTIONS = [
  "support",
  "concern",
  "donate",
  "manage_link",
  "contact",
  "volunteer",
  "partner",
  "report_request",
  "newsletter",
  "data_request",
  "story",
] as const;
export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[number];

/** "off" = Turnstile not configured; "unavailable" = Cloudflare could not be reached in time. */
export type TurnstileResult = "pass" | "fail" | "unavailable" | "off";

/** Forms that accept a submission when Cloudflare is unreachable. */
export const TURNSTILE_FAIL_OPEN: readonly TurnstileAction[] = ["support", "concern"];

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 3_000;

export function turnstileEnabled(): boolean {
  return features.turnstile;
}

/** The public site key for the widget (passed to client components as a prop), or null when off. */
export function turnstileSiteKey(): string | null {
  return features.turnstile ? env.turnstile.siteKey : null;
}

/** Verifies a widget token for `action`. Never throws. */
export async function verifyTurnstile(token: string | null | undefined, action: TurnstileAction): Promise<TurnstileResult> {
  if (!features.turnstile || !env.turnstile.secret) return "off";
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return "fail";
  const body = new URLSearchParams({ secret: env.turnstile.secret, response: token, idempotency_key: randomUUID() });
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) {
      log.warn("turnstile.http_error", { action, status: res.status });
      return "unavailable";
    }
    const data = (await res.json()) as { success?: boolean; action?: string; "error-codes"?: string[]; metadata?: { result_with_testing_key?: boolean } };
    if (data.success && data.action === action) return "pass";
    // Cloudflare's published testing keys answer without an action. Accept them off production only.
    if (data.success && data.metadata?.result_with_testing_key && env.vercelEnv !== "production") return "pass";
    if (data.success && data.action !== action) log.warn("turnstile.action_mismatch", { action });
    return "fail";
  } catch (err) {
    log.warn("turnstile.unavailable", { action, err });
    return "unavailable";
  }
}

/** Whether a verification result lets the submission through for this form. */
export function turnstileAccepts(result: TurnstileResult, action: TurnstileAction): boolean {
  if (result === "pass" || result === "off") return true;
  if (result === "unavailable") return TURNSTILE_FAIL_OPEN.includes(action);
  return false;
}
