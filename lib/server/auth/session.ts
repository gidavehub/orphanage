import "server-only";

// Staff sessions (data-model §6.4, §9; PLAN D84, D86–D88, D90, D92).
// - getViewer(): request-memoised (React.cache). Reads the session cookie (`__Host-haven_session` on
//   https, `haven_session` on http localhost), verifies it (local token store, or a Firebase session
//   cookie checked locally with no network call), loads staff/{uid} and rejects inactive staff and
//   sessions issued before staff.sessionsRevokedAt. Roles come from the staff document, never claims.
// - requireStaff(...anyOf): no session → redirect to /admin/login; lacking every listed permission →
//   notFound() (the friendly NoAccess page). Call it OUTSIDE try/catch. Route handlers use getViewer()
//   and answer 401 (no session) or 404 (denied), never 403. Never call these inside 'use cache'.
// - requireRecentAuth(): 30-minute step-up (D87), plus the revocation check in Firebase mode.
// - startSession()/endSession(): Server Actions and Route Handlers only (they set cookies).
// Lifetimes (D86): 12 h for super admins, safeguarding and finance officers, 7 days for others.
// "Keep me signed in" unchecked = a browser-session cookie with the same server-side expiry.

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { firstNameOf } from "@/lib/admin/format";
import type { StaffProfile, StaffSession } from "@/lib/model/domain/staff";
import { staffInitials, staffTone, type ShellViewer } from "@/lib/model/dto";
import type { Millis, Uid } from "@/lib/model/enums";
import { isRole, permsFor, type Permission, type Role, type ViewerScope } from "@/lib/model/permissions";
import { SESSION_COOKIE, SESSION_COOKIE_SECURE, STEP_UP_MS, safeNextPath, sessionCookieName, sessionLifetimeFor } from "@/lib/model/session";
import type { Viewer } from "@/lib/model/viewer";
import { audit, actorOf } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { sha256Id } from "@/lib/server/security/hmac";
import { clientIp } from "@/lib/server/security/spam";
import { checkSignInCode, sendSignInCode } from "./email-code";
import { createSessionCookie, mfaRequiredFor, revokeRefreshTokens, verifyIdToken, verifySessionCookie, FRESH_SIGN_IN_MS } from "./firebase";
import {
  createLocalSession,
  listLocalSessions,
  readLocalSession,
  refreshLocalSessionAuth,
  revokeAllLocalSessions,
  revokeLocalSession,
  verifyLocalPasswordFor,
} from "./local";

export type { Viewer } from "@/lib/model/viewer";

type CurrentSession = {
  mode: "local" | "firebase";
  cookie: string;
  sessionId: string;
  uid: Uid;
  issuedAt: Millis;
  authTime: Millis;
  mfa: boolean;
};

async function readCookieValue(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_SECURE)?.value ?? jar.get(SESSION_COOKIE)?.value ?? null;
}

/** The verified session behind this request's cookie, or null. Request-memoised. */
const currentSession = cache(async (): Promise<CurrentSession | null> => {
  const value = await readCookieValue();
  if (!value) return null;
  let backend;
  try {
    backend = resolveBackend();
  } catch {
    return null;
  }
  if (backend === "local") {
    const s = await readLocalSession(value);
    return s ? { mode: "local", cookie: value, sessionId: s.id, uid: s.uid, issuedAt: s.createdAt, authTime: s.authTime, mfa: false } : null;
  }
  if (backend === "firestore") {
    const s = await verifySessionCookie(value, false);
    return s ? { mode: "firebase", cookie: value, sessionId: sha256Id(value), uid: s.uid, issuedAt: s.issuedAt, authTime: s.authTime, mfa: s.mfa } : null;
  }
  return null;
});

function viewerFrom(staff: StaffProfile, s: CurrentSession, record?: StaffSession | null): Viewer {
  const roles = (Array.isArray(staff.roles) ? staff.roles : []).filter(isRole) as Role[];
  const viewerScopes = (Array.isArray(staff.viewerScopes) ? staff.viewerScopes : []) as ViewerScope[];
  return {
    uid: staff.uid ?? s.uid,
    displayName: staff.displayName,
    email: staff.email,
    roles,
    perms: permsFor(roles, viewerScopes),
    viewerScopes,
    programmeScope: staff.programmeScope ?? "all",
    timezone: staff.timezone || "Africa/Banjul",
    textSize: staff.textSize === "large" ? "large" : "normal",
    authTime: s.authTime,
    // A second step: an emailed code (now), or a Firebase second factor (older sessions).
    mfa: s.mfa || record?.secondFactor === "email",
    backend: s.mode === "firebase" ? "firestore" : "local",
  };
}

/** The signed-in staff member for this request, or null. Request-memoised with React.cache. */
export const getViewer: () => Promise<Viewer | null> = cache(async (): Promise<Viewer | null> => {
  const s = await currentSession();
  if (!s) return null;
  try {
    const store = getStore();
    const paths = [docPath("staff", s.uid), ...(s.mode === "firebase" ? [docPath("staffSessions", s.sessionId)] : [])];
    const [staff, record] = (await store.getMany<StaffProfile | StaffSession>(paths)) as [StaffProfile | null, StaffSession | null | undefined];
    if (!staff || staff.status !== "active") return null;
    if (staff.sessionsRevokedAt && s.issuedAt < staff.sessionsRevokedAt) return null;
    if (record && record.revokedAt) return null;
    return viewerFrom(staff, s, record ?? null);
  } catch (err) {
    if (err instanceof BackendUnavailableError) return null;
    throw err;
  }
});

/**
 * The gate for every admin page, Server Action and DAL function. No session → redirect to sign-in;
 * lacking every listed permission → notFound() (rendered as the friendly NoAccess page).
 */
export async function requireStaff(...anyOf: Permission[]): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/admin/login");
  if (anyOf.length > 0 && !anyOf.some((p) => viewer.perms.has(p))) notFound();
  return viewer;
}

/**
 * Step-up (D87): the last real sign-in must be within 30 minutes, otherwise the person confirms it's
 * them at /admin/confirm and comes back to `nextPath`. In Firebase mode the cookie must also pass the
 * revocation check. Throws redirect, so call it outside try/catch.
 */
export async function requireRecentAuth(v: Viewer, nextPath: string): Promise<void> {
  const next = encodeURIComponent(safeNextPath(nextPath));
  if (Date.now() - v.authTime > STEP_UP_MS) redirect(`/admin/confirm?next=${next}`);
  if (v.backend === "firestore") {
    const value = await readCookieValue();
    const ok = value ? await verifySessionCookie(value, true) : null;
    if (!ok) redirect(`/admin/login?next=${next}`);
  }
}

/* ── Cookies and devices ───────────────────────────────────────────────── */

function isSecureRequest(h: Headers): boolean {
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (proto) return proto === "https";
  return env.onVercel;
}

/**
 * A coarse device label (browser + OS family) for Me › Devices and auth audit entries (D92).
 * Never the raw user agent.
 */
export function deviceLabelFrom(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? "";
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : /curl\//i.test(ua)
                ? "Command line"
                : "Browser";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "Mac"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  return os ? `${browser} on ${os}` : browser;
}

async function setSessionCookie(value: string, opts: { lifetimeMs: number; remember: boolean }): Promise<void> {
  const h = await headers();
  const secure = isSecureRequest(h);
  const jar = await cookies();
  jar.set(sessionCookieName(secure), value, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(opts.remember ? { maxAge: Math.floor(opts.lifetimeMs / 1000) } : {}),
  });
  // Never leave the other variant behind (switching between http and https locally).
  const other = sessionCookieName(!secure);
  if (jar.get(other)) jar.delete(other);
}

/* ── Start and end ─────────────────────────────────────────────────────── */

/**
 * Starts a session after a successful sign-in (Server Action or Route Handler only): sets the
 * httpOnly cookie for the role's lifetime (D86), records the device label (D92), stamps
 * lastSignInAt and writes an `auth.sign_in` audit entry. Firebase mode needs the fresh ID token.
 */
export async function startSession(
  uid: Uid,
  opts: { authTime: Millis; remember: boolean; idToken?: string; device?: string; secondFactor?: "email" | null }
): Promise<void> {
  const backend = resolveBackend();
  if (backend === "unavailable") throw new BackendUnavailableError("Signing in is not switched on yet.");
  const store = getStore();
  const staffPath = docPath("staff", uid);
  const staff = await store.get<StaffProfile>(staffPath);
  if (!staff || staff.status !== "active") throw new Error("This account can't sign in to Haven.");
  const lifetimeMs = sessionLifetimeFor(staff.roles);
  const h = await headers();
  const device = opts.device ?? deviceLabelFrom(h.get("user-agent"));
  const now = Date.now();

  let value: string;
  if (backend === "local") {
    value = (await createLocalSession(uid, { authTime: opts.authTime, lifetimeMs, remember: opts.remember, device })).cookieValue;
  } else {
    if (!opts.idToken) throw new Error("A Firebase ID token is required to start a session.");
    value = await createSessionCookie(opts.idToken, lifetimeMs);
    const record: StaffSession = {
      uid,
      createdAt: now,
      expiresAt: now + lifetimeMs,
      authTime: opts.authTime,
      lastSeenAt: now,
      device: device ?? null,
      remember: opts.remember,
      provider: "firebase",
      revokedAt: null,
      secondFactor: opts.secondFactor ?? null,
    };
    await store.set(docPath("staffSessions", sha256Id(value)), record);
  }
  await setSessionCookie(value, { lifetimeMs, remember: opts.remember });
  await store.update(staffPath, { lastSignInAt: now });
  await audit({
    actor: { kind: "staff", uid, name: staff.displayName, roles: staff.roles },
    action: "auth.sign_in",
    area: "auth",
    summary: `${staff.displayName} signed in`,
    sensitive: true,
    targetPath: staffPath,
    device: device ?? null,
    ip: clientIp(h),
  });
}

export type FirebaseSessionResult =
  | { kind: "ok"; uid: Uid }
  /** Roles that need a second step: a code was emailed; no cookie until it is typed (email-code.ts). */
  | { kind: "code_sent"; challengeId: string; emailHint: string }
  | { kind: "invalid" | "stale" | "not_staff" };

/**
 * Firebase mode (data-model §9.1): exchanges a fresh ID token for a session cookie. Rejects invalid
 * or revoked tokens, sign-ins older than 5 minutes, people without an active staff profile (blocks
 * uninvited Google accounts). Roles that need a second step get a code by email instead of a cookie
 * (finishFirebaseSessionWithCode). Route Handler only.
 */
export async function startFirebaseSession(idToken: string, opts: { remember: boolean; ip?: string | null }): Promise<FirebaseSessionResult> {
  const token = await verifyIdToken(idToken);
  if (!token) return { kind: "invalid" };
  if (Date.now() - token.authTime > FRESH_SIGN_IN_MS) return { kind: "stale" };
  const staffPath = docPath("staff", token.uid);
  const staff = await getStore().get<StaffProfile>(staffPath);
  if (!staff || staff.status !== "active") {
    await audit({
      actor: { kind: "public" },
      action: "auth.sign_in_failed",
      area: "auth",
      summary: "A sign-in by someone without an active Haven account was refused",
      sensitive: true,
      ip: opts.ip ?? undefined,
    });
    return { kind: "not_staff" };
  }
  if (mfaRequiredFor(staff.roles) && !token.mfa) {
    const email = staff.email || token.email;
    if (!email) return { kind: "invalid" };
    const sent = await sendSignInCode(token.uid, email, firstNameOf(staff.displayName));
    return { kind: "code_sent", ...sent };
  }
  await startSession(token.uid, { authTime: token.authTime, remember: opts.remember, idToken });
  return { kind: "ok", uid: token.uid };
}

export type CodeSessionResult = { kind: "ok"; uid: Uid } | { kind: "wrong" | "expired" | "too_many" | "invalid" | "stale" | "not_staff" };

/**
 * Finishes a sign-in with the emailed code: the same fresh ID token as before plus the code. A right
 * code starts the session, marked as signed in with a second step. Route Handler only.
 */
export async function finishFirebaseSessionWithCode(
  idToken: string,
  challengeId: string,
  code: string,
  opts: { remember: boolean; ip?: string | null }
): Promise<CodeSessionResult> {
  const token = await verifyIdToken(idToken);
  if (!token) return { kind: "invalid" };
  if (Date.now() - token.authTime > FRESH_SIGN_IN_MS) return { kind: "stale" };
  const staffPath = docPath("staff", token.uid);
  const staff = await getStore().get<StaffProfile>(staffPath);
  if (!staff || staff.status !== "active") return { kind: "not_staff" };
  const check = await checkSignInCode(token.uid, challengeId, code);
  if (check !== "ok") {
    await audit({
      actor: { kind: "staff", uid: token.uid, name: staff.displayName, roles: staff.roles },
      action: "auth.sign_in_failed",
      area: "auth",
      summary: `${staff.displayName} typed a sign-in code that did not work`,
      sensitive: true,
      targetPath: staffPath,
      ip: opts.ip ?? undefined,
    });
    return { kind: check };
  }
  await startSession(token.uid, { authTime: token.authTime, remember: opts.remember, idToken, secondFactor: "email" });
  return { kind: "ok", uid: token.uid };
}

/**
 * Ends this session (and, with `everywhere`, every session of this person: local tokens, Firebase
 * refresh tokens and staff.sessionsRevokedAt). The client then does
 * window.location.replace('/admin/login') so no hidden route keeps the previous person's screens.
 */
export async function endSession(opts?: { everywhere?: boolean }): Promise<void> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE_SECURE)?.value ?? jar.get(SESSION_COOKIE)?.value ?? null;
  if (value) {
    try {
      const backend = resolveBackend();
      const store = getStore();
      const now = Date.now();
      let uid: Uid | null = null;
      if (backend === "local") {
        const s = await readLocalSession(value);
        uid = s?.uid ?? null;
        if (opts?.everywhere && uid) await revokeAllLocalSessions(uid);
        else await revokeLocalSession(value);
      } else if (backend === "firestore") {
        const s = await verifySessionCookie(value, false);
        uid = s?.uid ?? null;
        const own = docPath("staffSessions", sha256Id(value));
        if (await store.get(own)) await store.update(own, { revokedAt: now });
        if (opts?.everywhere && uid) {
          await revokeRefreshTokens(uid);
          const mine = await store.list<StaffSession>(C.staffSessions, { where: [{ field: "uid", op: "==", value: uid }], orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
          await store.batch((b) => {
            for (const r of mine.items) if (!r.revokedAt) b.update(docPath("staffSessions", r.id), { revokedAt: now });
          });
        }
      }
      if (uid) {
        const staffPath = docPath("staff", uid);
        const staff = await store.get<StaffProfile>(staffPath);
        if (opts?.everywhere && staff) await store.update(staffPath, { sessionsRevokedAt: now });
        if (staff) {
          await audit({
            actor: { kind: "staff", uid, name: staff.displayName, roles: staff.roles },
            action: opts?.everywhere ? "auth.sign_out_everywhere" : "auth.sign_out",
            area: "auth",
            summary: opts?.everywhere ? `${staff.displayName} signed out on all devices` : `${staff.displayName} signed out`,
            sensitive: true,
            targetPath: staffPath,
          });
        }
      }
    } catch (err) {
      log.error("auth.sign_out_failed", { err });
    }
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(SESSION_COOKIE_SECURE);
}

/**
 * Records a fresh real sign-in for the current session (D86–D87): the step-up confirm page and the
 * idle unlock. Local mode checks the password; Firebase mode takes a fresh ID token for the same
 * person and re-mints the cookie. Server Actions and Route Handlers only.
 */
export async function refreshSessionAuth(input: { password?: string; idToken?: string }): Promise<"ok" | "invalid" | "no_session"> {
  const s = await currentSession();
  if (!s) return "no_session";
  const viewer = await getViewer();
  if (!viewer) return "no_session";
  const now = Date.now();
  if (s.mode === "local") {
    if (!input.password || !(await verifyLocalPasswordFor(s.uid, input.password))) {
      await audit({ actor: actorOf(viewer), action: "auth.confirm_failed", area: "auth", summary: `${viewer.displayName} could not confirm it was them`, sensitive: true });
      return "invalid";
    }
    if (!(await refreshLocalSessionAuth(s.cookie, now))) return "no_session";
  } else {
    const token = input.idToken ? await verifyIdToken(input.idToken) : null;
    if (!token || token.uid !== s.uid || now - token.authTime > FRESH_SIGN_IN_MS) return "invalid";
    const store = getStore();
    const old = docPath("staffSessions", s.sessionId);
    const previous = await store.get<StaffSession>(old);
    await startSession(s.uid, { authTime: token.authTime, remember: previous?.remember ?? false, idToken: input.idToken, secondFactor: previous?.secondFactor ?? null });
    if (previous) await store.update(old, { revokedAt: now });
    return "ok";
  }
  await audit({ actor: actorOf(viewer), action: "auth.confirm", area: "auth", summary: `${viewer.displayName} confirmed it was them`, sensitive: true });
  return "ok";
}

/* ── Devices (Me › Devices, A9) ────────────────────────────────────────── */

export type StaffSessionInfo = StaffSession & { id: string; current: boolean };

/** A person's live sessions, newest first; `current` marks this browser. */
export async function listStaffSessions(uid: Uid): Promise<StaffSessionInfo[]> {
  const s = await currentSession();
  const backend = resolveBackend();
  const now = Date.now();
  if (backend === "local") {
    return (await listLocalSessions(uid)).map((x) => ({ ...x, current: x.id === s?.sessionId }));
  }
  if (backend !== "firestore") return [];
  const page = await getStore().list<StaffSession>(C.staffSessions, {
    where: [{ field: "uid", op: "==", value: uid }],
    orderBy: { field: "createdAt", dir: "desc" },
    limit: 50,
  });
  return page.items.filter((r) => !r.revokedAt && r.expiresAt > now).map((r) => ({ ...r, current: r.id === s?.sessionId }));
}

/** Signs one device out. Returns false when the session is not this person's. */
export async function revokeStaffSession(uid: Uid, sessionId: string): Promise<boolean> {
  const backend = resolveBackend();
  if (backend === "local") {
    const mine = await listLocalSessions(uid);
    if (!mine.some((x) => x.id === sessionId)) return false;
    await revokeLocalSession(sessionId);
    return true;
  }
  if (backend !== "firestore") return false;
  const store = getStore();
  const path = docPath("staffSessions", sessionId);
  const rec = await store.get<StaffSession>(path);
  if (!rec || rec.uid !== uid) return false;
  await store.update(path, { revokedAt: Date.now() });
  return true;
}

/** The serialisable shell view of a viewer for client components (no email, no session data). */
export function toShellViewer(v: Viewer): ShellViewer {
  return {
    uid: v.uid,
    displayName: v.displayName,
    firstName: firstNameOf(v.displayName),
    initials: staffInitials(v.displayName),
    tone: staffTone(v.uid),
    roles: [...v.roles],
    perms: [...v.perms].sort(),
    timezone: v.timezone,
    textSize: v.textSize,
    mfa: v.mfa,
    backend: v.backend,
  };
}
