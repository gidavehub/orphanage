import "server-only";

// Signed tokens and keyed hashes (data-model §8.1, §10; integrations §2.4; PLAN D112).
// HAVEN_HMAC_SECRET signs every link token and salts IP hashes (rotating it invalidates open links).
// HAVEN_LOOKUP_SECRET derives donor/subscriber ids from email addresses (never rotate it).
// Locally a missing secret falls back to a development-only derived value; on Vercel signing is
// refused (callers switch the link off) and verification returns null.
//
// Token format: base64url(JSON { p, sub, exp, d? }) + "." + base64url(HMAC-SHA256). Tokens are opaque,
// carry no personal data, and are never single-use (mail scanners prefetch links).

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Millis } from "@/lib/model/enums";
import { devSecret } from "@/lib/server/env";

export type TokenPurpose =
  /** /donate/thank-you?ref=&t= (pledge), sub = DN ref, 7 days. */
  | "thanks"
  /** /api/stripe/portal?t=, sub = donorId, 60 min (request) or 7 days (in receipts). */
  | "portal"
  /** /donate/receipt/[ref]?t=, sub = DN ref, 1 year. */
  | "receipt"
  /** /api/donations/pay?t=, sub = DN ref, 14 days. */
  | "pay"
  /** Donor-update and newsletter unsubscribe, sub = emailHash, no expiry. */
  | "unsubscribe"
  /** Public case upload (D96), sub = uploadId, d = { sha256, mime, size }, 2 hours. */
  | "upload"
  /** Staff signed PUT in local mode (D97), sub = storage path, d = { contentType, maxBytes }. */
  | "staff_upload"
  /** Controlled report delivery /r/[token], sub = report request ref, d = { tokenId }, 7 days. */
  | "delivery"
  /** Local password reset /admin/reset/[token], sub = uid, 1 hour. */
  | "reset"
  /** Staff invitation /admin/invite/[token], sub = invitation id. */
  | "invite"
  /** Newsletter double opt-in, sub = emailHash, 7 days. */
  | "newsletter_confirm"
  /** Privacy request email check, sub = DR ref, 7 days. */
  | "data_request_verify"
  /** Local stand-in for signed URLs (/api/dev/files/<path>?t=), sub = path, 60 seconds. */
  | "dev_file"
  /** Donor magic link to /donate/manage, sub = donorId. */
  | "manage";

export type TokenData = Record<string, string | number | boolean | null>;

export type TokenPayload = { p: TokenPurpose; sub: string; exp: Millis | null; d?: TokenData };

const SIGNING_CONTEXT = "haven.token.v1";
const MAX_TOKEN_LENGTH = 2048;

/** True when tokens can be signed here (a secret is configured, or we are off Vercel). */
export function tokensAvailable(): boolean {
  try {
    devSecret("hmac");
    return true;
  } catch {
    return false;
  }
}

function mac(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(`${SIGNING_CONTEXT}.${body}`).digest();
}

/**
 * Signs a token. `exp` is an absolute epoch-ms time, or null for "no expiry" (unsubscribe only).
 * Throws when no signing secret is available (Vercel without HAVEN_HMAC_SECRET): callers degrade.
 */
export function signToken(payload: { p: TokenPurpose; sub: string; exp: Millis | null; d?: TokenData }): string {
  if (!payload.sub) throw new Error("A token needs a subject.");
  const secret = devSecret("hmac");
  const body: TokenPayload = { p: payload.p, sub: payload.sub, exp: payload.exp, ...(payload.d ? { d: payload.d } : {}) };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${encoded}.${mac(secret, encoded).toString("base64url")}`;
}

/** Signs a token that expires `ttlMs` from now. */
export function signTokenFor(p: TokenPurpose, sub: string, ttlMs: number, d?: TokenData): string {
  return signToken({ p, sub, exp: Date.now() + ttlMs, d });
}

/**
 * Verifies purpose, expiry and the MAC (constant time). Returns the subject and data, or null for any
 * malformed, tampered, expired or wrong-purpose token. Never throws.
 */
export function verifyToken(token: string | null | undefined, p: TokenPurpose, now: Millis = Date.now()): { sub: string; exp: Millis | null; d?: TokenData } | null {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let secret: string;
  try {
    secret = devSecret("hmac");
  } catch {
    return null;
  }
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  const expected = mac(secret, encoded);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let body: TokenPayload;
  try {
    body = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }
  if (!body || body.p !== p || typeof body.sub !== "string" || !body.sub) return null;
  if (body.exp !== null && (typeof body.exp !== "number" || body.exp < now)) return null;
  return { sub: body.sub, exp: body.exp, ...(body.d ? { d: body.d } : {}) };
}

/* ── Keyed hashes ──────────────────────────────────────────────────────── */

/** UTC calendar day "YYYY-MM-DD". */
export function utcDay(now: Millis = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** HMAC-SHA256 of `value` under the signing secret, base64url. */
export function hmacOf(value: string, purpose: string): string {
  return createHmac("sha256", devSecret("hmac")).update(`${purpose}|${value}`).digest("base64url");
}

/**
 * Daily-salted hash of a client IP (rate limits, audit). Never store the IP itself. The salt changes
 * every UTC day, so hashes cannot be linked across days.
 */
export function ipHash(ip: string, now: Millis = Date.now()): string {
  return hmacOf(`${ip}|${utcDay(now)}`, "ip").slice(0, 22);
}

/**
 * Stable id derived from an email address: donors/{emailHash}, newsletterSubscribers/{emailHash},
 * emailSuppressions/{emailHash}, concern reporter lookupHash. HMAC under HAVEN_LOOKUP_SECRET, 32 chars.
 */
export function emailHash(email: string): string {
  const lower = email.trim().toLowerCase();
  return createHmac("sha256", devSecret("lookup")).update(lower).digest("base64url").slice(0, 32);
}

/** sha256, hex. */
export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** sha256, base64url (ids for invitation and reset tokens, session ids). */
export function sha256Id(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("base64url");
}

/** A random URL-safe secret (32 bytes by default). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
