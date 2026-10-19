import "server-only";

// Firebase Authentication (Admin SDK) for staff sign-in in Firestore mode (data-model §9.1–9.2, §9.4;
// PLAN D86–D88). The browser signs in with firebase/auth (in-memory persistence), sends the ID token
// to POST /api/auth/session, and the server mints an httpOnly session cookie; roles that need a second
// step finish with an emailed code first (email-code.ts; no authenticator app since 2026-10-19). Roles always come from staff/{uid}, never custom claims.
// Compiled now; exercised when FIREBASE_SERVICE_ACCOUNT_JSON exists (I8 preflight).

import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import type { Millis, Uid } from "@/lib/model/enums";
import { MFA_REQUIRED_ROLES, type Role } from "@/lib/model/permissions";
import { adminApp } from "@/lib/server/db/firestore";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

/** A fresh sign-in is required to mint a session: auth_time must be within 5 minutes. */
export const FRESH_SIGN_IN_MS = 5 * 60_000;

/** Firebase session cookies live between 5 minutes and 14 days. */
const MIN_COOKIE_MS = 5 * 60_000;
const MAX_COOKIE_MS = 14 * 24 * 60 * 60_000;

/** Firebase mode is active: Firestore backend and the public web config present. */
export function firebaseAuthAvailable(): boolean {
  try {
    return resolveBackend() === "firestore" && env.firebase.webConfig !== null;
  } catch {
    return false;
  }
}

function auth(): Auth {
  return getAuth(adminApp());
}

export type VerifiedIdToken = { uid: Uid; authTime: Millis; mfa: boolean; email: string | null; decoded: DecodedIdToken };

/** Verifies an ID token with the revocation check. Null when invalid, expired or revoked. */
export async function verifyIdToken(idToken: string): Promise<VerifiedIdToken | null> {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 8192) return null;
  try {
    const decoded = await auth().verifyIdToken(idToken, true);
    return {
      uid: decoded.uid,
      authTime: decoded.auth_time * 1000,
      mfa: Boolean(decoded.firebase?.sign_in_second_factor),
      email: decoded.email ?? null,
      decoded,
    };
  } catch (err) {
    log.warn("auth.firebase.id_token_rejected", { code: (err as { code?: string })?.code ?? null });
    return null;
  }
}

/** Mints a session cookie for `expiresInMs` (clamped to Firebase's 5 min – 14 days). */
export async function createSessionCookie(idToken: string, expiresInMs: number): Promise<string> {
  const expiresIn = Math.min(MAX_COOKIE_MS, Math.max(MIN_COOKIE_MS, Math.floor(expiresInMs)));
  return auth().createSessionCookie(idToken, { expiresIn });
}

export type VerifiedSession = { uid: Uid; issuedAt: Millis; authTime: Millis; expiresAt: Millis; mfa: boolean };

/**
 * Verifies a session cookie. `checkRevoked` false is a local signature check with no network call
 * (every request); true also checks revocation (step-up and sensitive actions).
 */
export async function verifySessionCookie(cookie: string, checkRevoked = false): Promise<VerifiedSession | null> {
  if (typeof cookie !== "string" || cookie.length < 20 || cookie.length > 8192) return null;
  try {
    const d = await auth().verifySessionCookie(cookie, checkRevoked);
    return { uid: d.uid, issuedAt: d.iat * 1000, authTime: d.auth_time * 1000, expiresAt: d.exp * 1000, mfa: Boolean(d.firebase?.sign_in_second_factor) };
  } catch {
    return null;
  }
}

/** Revokes every refresh token of a person ("Sign out on all devices", deactivation). */
export async function revokeRefreshTokens(uid: Uid): Promise<void> {
  await auth().revokeRefreshTokens(uid);
}

/** Roles that must finish signing in with a second step: an emailed code (D88; lib/server/auth/email-code.ts). */
export function mfaRequiredFor(roles: readonly Role[]): boolean {
  return roles.some((r) => MFA_REQUIRED_ROLES.includes(r));
}

/** True when the token or session was created with a second factor. */
export function hasSecondFactor(v: { mfa: boolean }): boolean {
  return v.mfa;
}

/** Disables or re-enables a Firebase user (deactivation; A9). */
export async function setFirebaseUserDisabled(uid: Uid, disabled: boolean): Promise<void> {
  await auth().updateUser(uid, { disabled });
}

/** Removes every enrolled second factor (super-admin MFA reset with step-up; A9). */
export async function resetFirebaseMfa(uid: Uid): Promise<void> {
  await auth().updateUser(uid, { multiFactor: { enrolledFactors: null } });
}

/** Creates a Firebase user for an accepted invitation (A9). Returns the new uid. */
export async function createFirebaseUser(input: { email: string; password: string; displayName: string }): Promise<Uid> {
  const user = await auth().createUser({ email: input.email, password: input.password, displayName: input.displayName, emailVerified: true });
  return user.uid;
}

/** Removes a Firebase user that was created but never got a staff profile (a lost invitation race). */
export async function deleteFirebaseUser(uid: Uid): Promise<void> {
  await auth().deleteUser(uid);
}

/** A password-reset link from Firebase (sent through the outbox as staff_password_reset; A9). */
export async function firebasePasswordResetLink(email: string, continueUrl?: string): Promise<string> {
  return auth().generatePasswordResetLink(email, continueUrl ? { url: continueUrl } : undefined);
}
