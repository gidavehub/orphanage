import "server-only";

// The emailed sign-in code (replaces the authenticator app; owner, 2026-10-19: "get rid of the
// authenticator app requirement… it should only use OTP"). Roles that need a second step (super
// admins, safeguarding and finance officers: MFA_REQUIRED_ROLES) sign in with their password, then
// type a 6-digit code we email to them. Nothing to install, nothing to set up first.
//
// - A code works for 10 minutes and for 5 tries; a new code replaces the last one.
// - One live code per person (staffSignInCodes/{uid}); only an HMAC of the code is stored, with the
//   challenge id the browser holds. The email itself is sealed in the outbox like every other staff
//   email.
// - The session that follows records secondFactor: "email" on its staffSessions record, which the
//   viewer reads as "signed in with a second step" (lib/server/auth/session.ts).

import { randomInt } from "node:crypto";
import type { Millis, Uid } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { drainAfterResponse, enqueueEmail } from "@/lib/server/email/outbox";
import { hmacOf, randomToken, safeEqual } from "@/lib/server/security/hmac";

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_MAX_TRIES = 5;

type Challenge = {
  uid: Uid;
  challengeId: string;
  hash: string;
  expiresAt: Millis;
  tries: number;
  createdAt: Millis;
};

const challengePath = (uid: Uid) => docPath("staffSignInCodes", uid);
const codeHash = (challengeId: string, code: string) => hmacOf(`${challengeId}|${code}`, "sign-in-code");

/** "d•••@gmail.com": enough to know which inbox to open. */
export function emailHint(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "your email";
  return `${user.slice(0, 1)}•••@${domain}`;
}

/**
 * Makes a new code for this person, emails it, and returns the challenge id the browser keeps.
 * Any earlier code for them stops working (one live code at a time).
 */
export async function sendSignInCode(uid: Uid, email: string, firstName: string): Promise<{ challengeId: string; emailHint: string }> {
  const store = getStore();
  const now = Date.now();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const challengeId = randomToken(18);
  // Replaces any earlier code: only the newest email works.
  await store.set(challengePath(uid), { uid, challengeId, hash: codeHash(challengeId, code), expiresAt: now + CODE_TTL_MS, tries: 0, createdAt: now } satisfies Challenge);
  await enqueueEmail({
    template: "staff_sign_in_code",
    to: [email],
    vars: { code, firstName },
    dedupeKey: `code~${challengeId}`,
  });
  drainAfterResponse();
  return { challengeId, emailHint: emailHint(email) };
}

export type CodeCheck = "ok" | "wrong" | "expired" | "too_many";

/** Checks a typed code against the challenge; a right code is used up, a wrong one counts a try. */
export async function checkSignInCode(uid: Uid, challengeId: string, typed: string): Promise<CodeCheck> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(challengeId)) return "expired";
  const code = typed.replace(/\D/g, "");
  const store = getStore();
  const path = challengePath(uid);
  const c = await store.get<Challenge>(path);
  if (!c || c.uid !== uid || !safeEqual(c.challengeId, challengeId) || c.expiresAt < Date.now()) return "expired";
  if (c.tries >= CODE_MAX_TRIES) return "too_many";
  if (code.length === 6 && safeEqual(codeHash(challengeId, code), c.hash)) {
    await store.delete(path);
    return "ok";
  }
  await store.update(path, { tries: c.tries + 1 });
  return c.tries + 1 >= CODE_MAX_TRIES ? "too_many" : "wrong";
}
