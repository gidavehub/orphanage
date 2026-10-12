import "server-only";

// Honeypot, time trap and client IP (data-model §10.1–10.2, PLAN D94).
// - Honeypot: the visually hidden `company_website` input; any value means a bot.
// - Time trap: the client measures first render → submit and sends `_elapsed` (ms); under 2.5 s is a
//   bot. Pages stay static, so there is no server-issued timestamp. Cheap friction, not security.
// - Bot outcome: a success-looking response with no reference and nothing stored, EXCEPT the concern
//   form, which keeps the submission flagged `suspectedSpam` (a lost genuine concern costs far more).
// The IP is read only to hash it (ipHash); it is never stored on a record.

import { ELAPSED_FIELD, HONEYPOT_FIELD, MIN_ELAPSED_MS } from "@/lib/forms/spam";

export type SpamInput = FormData | Record<string, unknown>;
export type SpamVerdict = { bot: boolean; reason: "honeypot" | "too_fast" | null; elapsedMs: number | null };

function read(input: SpamInput, key: string): unknown {
  if (typeof FormData !== "undefined" && input instanceof FormData) return input.get(key);
  return (input as Record<string, unknown>)[key];
}

/** True when the honeypot field carries any non-blank value. */
export function isHoneypotHit(input: SpamInput): boolean {
  const v = read(input, HONEYPOT_FIELD);
  return typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null && v !== "";
}

/** The client-measured fill time in ms, or null when missing or malformed. */
export function elapsedOf(input: SpamInput): number | null {
  const v = read(input, ELAPSED_FIELD);
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Faster than `minMs` (default 2.5 s), or no timing at all (scripts post without it). */
export function isTooFast(input: SpamInput, minMs: number = MIN_ELAPSED_MS): boolean {
  const ms = elapsedOf(input);
  return ms === null || ms < minMs;
}

export function spamVerdict(input: SpamInput, minMs: number = MIN_ELAPSED_MS): SpamVerdict {
  const elapsedMs = elapsedOf(input);
  if (isHoneypotHit(input)) return { bot: true, reason: "honeypot", elapsedMs };
  if (elapsedMs === null || elapsedMs < minMs) return { bot: true, reason: "too_fast", elapsedMs };
  return { bot: false, reason: null, elapsedMs };
}

/**
 * The client IP for rate limiting only: x-vercel-forwarded-for → x-forwarded-for (first entry) →
 * x-real-ip → "local". Never store it.
 */
export function clientIp(headers: Headers): string {
  const pick = (v: string | null) => (v ? v.split(",")[0]?.trim() : "") || "";
  const ip = pick(headers.get("x-vercel-forwarded-for")) || pick(headers.get("x-forwarded-for")) || pick(headers.get("x-real-ip"));
  return ip.slice(0, 64) || "local";
}
