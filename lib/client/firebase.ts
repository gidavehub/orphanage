// The Firebase client for staff sign-in only (PLAN D86, D88, D111; data-model §9.1). Imported only by
// the admin sign-in, code, confirm and invite client components (and lib/client/mfa.ts). It reads
// NEXT_PUBLIC_FIREBASE_* (inlined at build time; never a hard-coded config), imports only firebase/app
// and firebase/auth, keeps auth state in memory (nothing in IndexedDB or localStorage) and never calls
// getAnalytics(). The signed-in Firebase user exists only long enough to mint an ID token, which the
// server exchanges for Haven's own session cookie at POST /api/auth/session; then we sign out locally.

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getMultiFactorResolver,
  inMemoryPersistence,
  initializeAuth,
  multiFactor,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type Auth,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from "firebase/auth";
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

export type FirebaseSignInResult =
  | { kind: "ok"; idToken: string }
  /** The account has a sign-in code: continue at /admin/login/code (the resolver is kept here, in memory). */
  | { kind: "code_required" }
  | { kind: "error"; message: string };

/** Held between /admin/login and /admin/login/code (module state only; lost on reload by design). */
let pendingResolver: MultiFactorResolver | null = null;

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
      return "We couldn't reach the sign-in service. Please check your connection and try again.";
    case "auth/invalid-verification-code":
    case "auth/code-expired":
      return "That code didn't work. Codes change every 30 seconds, so please try the newest one.";
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

/** Email and password sign-in. A required second factor parks the resolver for the code step. */
export async function signInWithPassword(email: string, password: string): Promise<FirebaseSignInResult> {
  const auth = getFirebaseAuth();
  if (!auth) return { kind: "error", message: "Sign-in isn't set up here yet." };
  pendingResolver = null;
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { kind: "ok", idToken: await tokenAndSignOut(auth, cred.user) };
  } catch (err) {
    if (errorCode(err) === "auth/multi-factor-auth-required") {
      const resolver = getMultiFactorResolver(auth, err as MultiFactorError);
      if (resolver.hints.some((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
        pendingResolver = resolver;
        return { kind: "code_required" };
      }
      return { kind: "error", message: "This account uses a kind of sign-in code Haven doesn't support. Please ask a super admin to reset it." };
    }
    return { kind: "error", message: messageFor(errorCode(err)) };
  }
}

/** True while a sign-in is waiting for its 6-digit code. */
export function hasPendingCode(): boolean {
  return pendingResolver !== null;
}

/** Completes a sign-in with the authenticator app's 6-digit code. */
export async function resolveSignInCode(code: string): Promise<FirebaseSignInResult> {
  const auth = getFirebaseAuth();
  const resolver = pendingResolver;
  if (!auth || !resolver) return { kind: "error", message: "Please sign in again." };
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) return { kind: "error", message: "Please sign in again." };
  try {
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.replace(/\D/g, ""));
    const cred = await resolver.resolveSignIn(assertion);
    pendingResolver = null;
    return { kind: "ok", idToken: await tokenAndSignOut(auth, cred.user) };
  } catch (err) {
    return { kind: "error", message: messageFor(errorCode(err)) };
  }
}

/** Forgets a parked sign-in (Cancel on the code step). */
export function clearPendingCode(): void {
  pendingResolver = null;
}

/**
 * Re-authentication for step-up and the idle unlock (D86–D87): signs in again as the same person and
 * returns a fresh ID token for the server to check. Accounts with a code go through the code step.
 */
export async function reauthenticate(email: string, password: string): Promise<FirebaseSignInResult> {
  // A fresh password sign-in proves it is still them; the server checks the token's uid matches.
  return signInWithPassword(email, password);
}

/* ── First sign-in code (TOTP enrolment) ─────────────────────────────── */

// Roles that need a code (D88) set one up at their first sign-in: the server has just checked the
// password and the staff record (POST /api/auth/session answered "enrol_mfa"), so the person signs
// in again here, gets a new authenticator secret, and confirms one code to save it on the account.
// The signed-in user and the secret live in memory only, for this page.

let setupUser: User | null = null;
let setupSecret: TotpSecret | null = null;

export type CodeSetupStart = { kind: "ok"; secretKey: string; uri: string } | { kind: "error"; message: string };

/** Starts setting up a sign-in code: a fresh password sign-in, then a new authenticator secret. */
export async function startCodeSetup(email: string, password: string): Promise<CodeSetupStart> {
  const auth = getFirebaseAuth();
  if (!auth) return { kind: "error", message: "Sign-in isn't set up here yet." };
  await cancelCodeSetup();
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const secret = await TotpMultiFactorGenerator.generateSecret(await multiFactor(cred.user).getSession());
    setupUser = cred.user;
    setupSecret = secret;
    return { kind: "ok", secretKey: secret.secretKey, uri: secret.generateQrCodeUrl(cred.user.email ?? email.trim(), "Haven") };
  } catch (err) {
    const code = errorCode(err);
    await signOut(auth).catch(() => {});
    if (code === "auth/multi-factor-auth-required") return { kind: "error", message: "This account already has a sign-in code. Please sign in again and enter it." };
    if (code === "auth/unverified-email") return { kind: "error", message: "This account's email isn't confirmed yet. Please ask a super admin to send you a new invitation." };
    return { kind: "error", message: messageFor(code) };
  }
}

/** Confirms the first code from the authenticator app and saves the code on the account. */
export async function finishCodeSetup(code: string): Promise<{ kind: "ok" } | { kind: "error"; message: string }> {
  const auth = getFirebaseAuth();
  const user = setupUser;
  const secret = setupSecret;
  if (!auth || !user || !secret) return { kind: "error", message: "Please sign in again to set up your code." };
  try {
    await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code.replace(/\D/g, "")), "Authenticator app");
    await cancelCodeSetup();
    return { kind: "ok" };
  } catch (err) {
    return { kind: "error", message: messageFor(errorCode(err)) };
  }
}

/** Forgets a code set-up in progress and signs out locally. */
export async function cancelCodeSetup(): Promise<void> {
  setupUser = null;
  setupSecret = null;
  const auth = getFirebaseAuth();
  if (auth?.currentUser) await signOut(auth).catch(() => {});
}

/* ── Session exchange ─────────────────────────────────────────────────── */

export type SessionExchangeResult = { ok: true; next: string } | { ok: false; enrolMfa?: true; message: string };

/** POST /api/auth/session with a fresh ID token (same-origin JSON). The server sets the cookie. */
export async function exchangeForSession(idToken: string, opts: { remember: boolean; next?: string | null }): Promise<SessionExchangeResult> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ idToken, remember: opts.remember, next: safeNextPath(opts.next) }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; message?: string };
    if (res.ok && body.ok) return { ok: true, next: safeNextPath(body.next) };
    if (body.next === "enrol_mfa") {
      return { ok: false, enrolMfa: true, message: "Your role needs a sign-in code. Let's set one up now." };
    }
    return { ok: false, message: body.message ?? "That sign-in didn't work. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach Haven. Please check your connection and try again." };
  }
}
