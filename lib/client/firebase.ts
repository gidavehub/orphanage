// The Firebase client for staff sign-in only (PLAN D86, D88, D111; data-model §9.1). Imported only by
// the admin sign-in, code and confirm client components. It reads
// NEXT_PUBLIC_FIREBASE_* (inlined at build time; never a hard-coded config), imports only firebase/app
// and firebase/auth, keeps auth state in memory (nothing in IndexedDB or localStorage) and never calls
// getAnalytics(). The signed-in Firebase user exists only long enough to mint an ID token, which the
// server exchanges for Haven's own session cookie at POST /api/auth/session; then we sign out locally.
// Roles that need a second step get a 6-digit code by email (owner, 2026-10-19: no authenticator
// app, only one-time codes); POST /api/auth/session/code finishes with it.

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { inMemoryPersistence, initializeAuth, signInWithEmailAndPassword, signOut, type Auth, type User } from "firebase/auth";
import { safeNextPath } from "@/lib/model/session";

const APP_NAME = "haven-staff";

/** The public web config, or null when any value is missing (local practice mode needs none). */
export function firebaseWebConfig(): FirebaseOptions | null {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return Object.values(config).every((v) => typeof v === "string" && v.trim()) ? (config as FirebaseOptions) : null;
}

let authInstance: Auth | null = null;

/** The staff Auth instance (in-memory persistence), or null without a web config or outside a browser. */
export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  if (authInstance) return authInstance;
  const config = firebaseWebConfig();
  if (!config) return null;
  const app = getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(config, APP_NAME);
  authInstance = initializeAuth(app, { persistence: inMemoryPersistence });
  return authInstance;
}

/* ── Sign-in ──────────────────────────────────────────────────────────── */

export type FirebaseSignInResult = { kind: "ok"; idToken: string } | { kind: "error"; message: string };

function messageFor(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/missing-password":
      return "That email and password don't match. Please try again.";
    case "auth/too-many-requests":
      return "Too many tries. For your safety, please wait 15 minutes and try again.";
    case "auth/user-disabled":
      return "This account is paused. Please ask a super admin.";
    case "auth/network-request-failed":
      return "We couldn't reach Google's sign-in service from this computer. Please check the internet connection, make sure the computer's date and time are set automatically, and pause any ad-blocker, VPN or antivirus web protection for this site, then try again.";
    default:
      return "That sign-in didn't work. Please try again.";
  }
}

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

async function tokenAndSignOut(auth: Auth, user: User): Promise<string> {
  const token = await user.getIdToken(true);
  await signOut(auth).catch(() => {});
  return token;
}

/** Runs a sign-in call, trying once more after a moment when the network dropped the first try. */
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (errorCode(err) !== "auth/network-request-failed") throw err;
    await new Promise((r) => setTimeout(r, 1200));
    return call();
  }
}

/** Email and password sign-in. The second step, when a role needs one, is an emailed code (server side). */
export async function signInWithPassword(email: string, password: string): Promise<FirebaseSignInResult> {
  const auth = getFirebaseAuth();
  if (!auth) return { kind: "error", message: "Sign-in isn't set up here yet." };
  try {
    const cred = await withRetry(() => signInWithEmailAndPassword(auth, email.trim(), password));
    return { kind: "ok", idToken: await tokenAndSignOut(auth, cred.user) };
  } catch (err) {
    if (errorCode(err) === "auth/multi-factor-auth-required") {
      // An authenticator app linked before codes moved to email.
      return { kind: "error", message: "This account still has an authenticator app linked from before. Please ask a super admin to reset its sign-in, then try again." };
    }
    return { kind: "error", message: messageFor(errorCode(err)) };
  }
}

/**
 * Re-authentication for step-up and the idle unlock (D86–D87): signs in again as the same person and
 * returns a fresh ID token for the server to check. The session keeps the second step it already had.
 */
export async function reauthenticate(email: string, password: string): Promise<FirebaseSignInResult> {
  // A fresh password sign-in proves it is still them; the server checks the token's uid matches.
  return signInWithPassword(email, password);
}

/* ── Session exchange ─────────────────────────────────────────────────── */

/** A code is on its way by email: type it to finish (POST /api/auth/session/code). */
export type EmailCodeStep = { challengeId: string; emailHint: string };

export type SessionExchangeResult = { ok: true; next: string } | { ok: false; emailCode?: EmailCodeStep; message: string };

/** POST /api/auth/session with a fresh ID token (same-origin JSON). The server sets the cookie. */
export async function exchangeForSession(idToken: string, opts: { remember: boolean; next?: string | null }): Promise<SessionExchangeResult> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ idToken, remember: opts.remember, next: safeNextPath(opts.next) }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; message?: string; challengeId?: string; emailHint?: string };
    if (res.ok && body.ok) return { ok: true, next: safeNextPath(body.next) };
    if (body.next === "email_code" && body.challengeId) {
      return { ok: false, emailCode: { challengeId: body.challengeId, emailHint: body.emailHint ?? "your email" }, message: "We've emailed you a sign-in code." };
    }
    return { ok: false, message: body.message ?? "That sign-in didn't work. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach Haven. Please check your connection and try again." };
  }
}

/** POST /api/auth/session/code: the same ID token, the challenge and the emailed code. */
export async function finishWithEmailCode(
  idToken: string,
  step: EmailCodeStep,
  code: string,
  opts: { remember: boolean; next?: string | null }
): Promise<{ ok: true; next: string } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch("/api/auth/session/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ idToken, challengeId: step.challengeId, code, remember: opts.remember, next: safeNextPath(opts.next) }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string; message?: string };
    if (res.ok && body.ok) return { ok: true, next: safeNextPath(body.next) };
    return { ok: false, error: body.error ?? "invalid", message: body.message ?? "That code didn't work. Please try again." };
  } catch {
    return { ok: false, error: "network", message: "We couldn't reach Haven. Please check your connection and try again." };
  }
}
