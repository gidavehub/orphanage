import "server-only";

// Local (practice-mode) staff accounts and sessions (data-model §9.3, PLAN §4.4, D86, D90, D92).
//   .data/auth/accounts.json  { accounts: { <uid>: LocalAccount } }     scrypt hashes, lockout state
//   .data/auth/sessions.json  { sessions: { <sha256(cookie)>: LocalSession } }
//   .data/auth/resets.json    { resets: { <sha256(token)>: LocalReset } }    1-hour reset links
// Profiles and roles live in staff/{uid} in the DocStore, exactly as in Firestore mode.
// - The first super admin is created from LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD on the first
//   sign-in attempt; without them, and with no accounts at all, the login page offers "Create the
//   first super admin" (createFirstSuperAdmin, local only).
// - 5 failed attempts within 15 minutes lock the account for 15 minutes (plus the per-IP limit).
// - Session cookie value: "loc.<32 random bytes>"; only its sha256 is stored.
// - The first successful local sign-in seeds the practice data (ensurePracticeSeed) when absent.
// Passwords and tokens are never logged or echoed.

import { headers } from "next/headers";
import type { StaffProfile, StaffSession } from "@/lib/model/domain/staff";
import type { Millis, ProgrammeId, Uid } from "@/lib/model/enums";
import { MFA_REQUIRED_ROLES, type Role, type ViewerScope } from "@/lib/model/permissions";
import { audit } from "@/lib/server/audit";
import { getStore } from "@/lib/server/db";
import { docPath, settingsPath } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import { dataPath, readJsonCached, withLock, writeFileAtomic, primeJsonCache } from "@/lib/server/db/local-fs";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { ipHash, randomToken, sha256Id } from "@/lib/server/security/hmac";
import { rateLimit } from "@/lib/server/security/ratelimit";
import { clientIp } from "@/lib/server/security/spam";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "./password";

export type LocalAccount = {
  uid: Uid;
  email: string;
  emailLower: string;
  /** Null for practice accounts without LOCAL_SEED_PASSWORD (one-tap chips only). */
  passwordHash: string | null;
  createdAt: Millis;
  updatedAt: Millis;
  failedCount: number;
  firstFailedAt: Millis | null;
  lockedUntil: Millis | null;
};

export type LocalSession = Omit<StaffSession, "provider"> & { provider: "local" };

type LocalReset = { uid: Uid; createdAt: Millis; expiresAt: Millis; usedAt: Millis | null };

type AccountsFile = { accounts: Record<Uid, LocalAccount> };
type SessionsFile = { sessions: Record<string, LocalSession> };
type ResetsFile = { resets: Record<string, LocalReset> };

const LOCK_AFTER_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const RESET_TTL_MS = 60 * 60_000;
const COOKIE_PREFIX = "loc.";

const accountsFile = () => dataPath("auth", "accounts.json");
const sessionsFile = () => dataPath("auth", "sessions.json");
const resetsFile = () => dataPath("auth", "resets.json");

function assertLocal(): void {
  if (resolveBackend() !== "local") throw new Error("Local sign-in is only available in practice mode.");
}

async function readAccounts(): Promise<AccountsFile> {
  const f = await readJsonCached<AccountsFile>(accountsFile());
  return { accounts: { ...(f?.accounts ?? {}) } };
}

async function readSessions(): Promise<SessionsFile> {
  const f = await readJsonCached<SessionsFile>(sessionsFile());
  return { sessions: { ...(f?.sessions ?? {}) } };
}

async function readResets(): Promise<ResetsFile> {
  const f = await readJsonCached<ResetsFile>(resetsFile());
  return { resets: { ...(f?.resets ?? {}) } };
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(data, null, 1));
  await primeJsonCache(file, data);
}

/** Runs a read-modify-write on the auth files under one lock. */
function withAuthLock<T>(fn: () => Promise<T>): Promise<T> {
  return withLock("auth", fn);
}

/* ── Staff profiles ────────────────────────────────────────────────────── */

export type NewStaffInput = {
  email: string;
  displayName: string;
  roles: Role[];
  viewerScopes?: ViewerScope[];
  programmeScope?: ProgrammeId[] | "all";
  timezone?: string;
  invitedBy?: Uid | null;
  authProvider?: StaffProfile["authProvider"];
  counsellorLanguages?: string[];
  isSample?: boolean;
};

/** A complete staff/{uid} document with Haven's defaults (D91). */
export function buildStaffProfile(uid: Uid, input: NewStaffInput, now: Millis = Date.now()): StaffProfile {
  const email = input.email.trim();
  const roles = [...new Set(input.roles)];
  return {
    uid,
    email,
    emailLower: email.toLowerCase(),
    displayName: input.displayName.trim(),
    roles,
    viewerScopes: roles.includes("viewer") ? [...new Set(input.viewerScopes ?? [])] : [],
    programmeScope: input.programmeScope ?? "all",
    status: "active",
    mfa: { required: roles.some((r) => MFA_REQUIRED_ROLES.includes(r)), enrolled: false, enrolledAt: null },
    counsellor: roles.includes("counsellor")
      ? { languages: input.counsellorLanguages ?? ["English"], bio: null, maxPerWeek: 12, acceptingClients: true }
      : null,
    notificationPrefs: { email: { inbox: "instant", handoffs: "instant", sessions: "instant", drafts: "daily_digest" }, inApp: true },
    timezone: input.timezone ?? "Africa/Banjul",
    textSize: "normal",
    tourDoneAt: null,
    zoomPersonalLink: null,
    avatarMediaId: null,
    lastSignInAt: null,
    sessionsRevokedAt: null,
    invitedBy: input.invitedBy ?? null,
    authProvider: input.authProvider ?? "local",
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...(input.isSample ? { isSample: true as const } : {}),
  };
}

/* ── Accounts ──────────────────────────────────────────────────────────── */

export async function findLocalAccountByEmail(email: string): Promise<LocalAccount | null> {
  const lower = email.trim().toLowerCase();
  const { accounts } = await readAccounts();
  return Object.values(accounts).find((a) => a.emailLower === lower) ?? null;
}

export async function getLocalAccount(uid: Uid): Promise<LocalAccount | null> {
  const { accounts } = await readAccounts();
  return accounts[uid] ?? null;
}

export async function localAccountCount(): Promise<number> {
  if (resolveBackend() !== "local") return 0;
  return Object.keys((await readAccounts()).accounts).length;
}

/**
 * Creates a local account and its staff profile. A null password makes a chips-only practice
 * account. Throws when the email is taken. The staff doc is created only when missing.
 */
export async function createLocalAccount(input: NewStaffInput & { password: string | null; uid?: Uid }): Promise<Uid> {
  assertLocal();
  const now = Date.now();
  const emailLower = input.email.trim().toLowerCase();
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const uid = input.uid ?? `loc_${newId(16)}`;
  await withAuthLock(async () => {
    const file = await readAccounts();
    if (Object.values(file.accounts).some((a) => a.emailLower === emailLower)) throw new Error("An account with that email already exists.");
    if (file.accounts[uid]) throw new Error("An account with that id already exists.");
    file.accounts[uid] = {
      uid,
      email: input.email.trim(),
      emailLower,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      failedCount: 0,
      firstFailedAt: null,
      lockedUntil: null,
    };
    await writeJson(accountsFile(), file);
  });
  const store = getStore();
  if (!(await store.get(docPath("staff", uid)))) {
    await store.create(docPath("staff", uid), buildStaffProfile(uid, input, now));
  }
  return uid;
}

/** Sets (or clears, with null) a local account's password. Enforces the policy for non-null values. */
export async function setLocalPassword(uid: Uid, password: string | null, opts?: { skipPolicy?: boolean }): Promise<void> {
  assertLocal();
  if (password !== null && !opts?.skipPolicy) {
    const account = await getLocalAccount(uid);
    const problem = checkPasswordPolicy(password, { email: account?.email });
    if (problem) throw new Error(problem);
  }
  const passwordHash = password ? await hashPassword(password) : null;
  await withAuthLock(async () => {
    const file = await readAccounts();
    const a = file.accounts[uid];
    if (!a) throw new Error("No such account.");
    file.accounts[uid] = { ...a, passwordHash, failedCount: 0, firstFailedAt: null, lockedUntil: null, updatedAt: Date.now() };
    await writeJson(accountsFile(), file);
  });
}

/**
 * Removes a local account, its sessions and its staff document. For selftests and practice clean-up
 * only: real staff are deactivated, never removed.
 */
export async function removeLocalAccount(uid: Uid): Promise<void> {
  assertLocal();
  await withAuthLock(async () => {
    const accounts = await readAccounts();
    if (accounts.accounts[uid]) {
      delete accounts.accounts[uid];
      await writeJson(accountsFile(), accounts);
    }
    const sessions = await readSessions();
    let changed = false;
    for (const [id, s] of Object.entries(sessions.sessions)) {
      if (s.uid === uid) {
        delete sessions.sessions[id];
        changed = true;
      }
    }
    if (changed) await writeJson(sessionsFile(), sessions);
  });
  await getStore().delete(docPath("staff", uid));
}

/** True when the login page should offer "Create the first super admin" (local, no accounts, no env admin). */
export async function needsFirstAdmin(): Promise<boolean> {
  if (resolveBackend() !== "local") return false;
  if (env.local.adminEmail && env.local.adminPassword) return false;
  return (await localAccountCount()) === 0;
}

/** Creates the first super admin from the login page. Only when local and no account exists yet. */
export async function createFirstSuperAdmin(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ ok: true; uid: Uid } | { ok: false; message: string }> {
  if (resolveBackend() !== "local") return { ok: false, message: "This is only possible in practice mode." };
  if ((await localAccountCount()) > 0) return { ok: false, message: "A team member already exists. Please sign in instead." };
  const problem = checkPasswordPolicy(input.password, { email: input.email, name: input.displayName });
  if (problem) return { ok: false, message: problem };
  try {
    const uid = await createLocalAccount({ email: input.email, password: input.password, displayName: input.displayName, roles: ["super_admin"] });
    await audit({ actor: { kind: "system", job: "first-admin" }, action: "staff.create", area: "staff", summary: "The first super admin account was created", sensitive: true, targetPath: docPath("staff", uid) });
    return { ok: true, uid };
  } catch (err) {
    log.error("auth.local.first_admin_failed", { err });
    return { ok: false, message: "We couldn't create the account. Please try again." };
  }
}

function titleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Admin";
  const words = local.split(/[._-]+/).filter(Boolean);
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return name || "Admin";
}

/**
 * D86 bootstrap: when LOCAL_ADMIN_EMAIL and LOCAL_ADMIN_PASSWORD are set and no account uses that
 * email, create it as a super admin (once). The password is never logged.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  if (resolveBackend() !== "local") return;
  const email = env.local.adminEmail;
  const password = env.local.adminPassword;
  if (!email || !password) return;
  if (await findLocalAccountByEmail(email)) return;
  try {
    const uid = await createLocalAccount({ email, password, displayName: titleFromEmail(email), roles: ["super_admin"] });
    await audit({ actor: { kind: "system", job: "bootstrap" }, action: "staff.create", area: "staff", summary: "The local super admin account was created", sensitive: true, targetPath: docPath("staff", uid) });
  } catch (err) {
    // A concurrent attempt may have created it a moment ago.
    if (!(await findLocalAccountByEmail(email))) log.error("auth.local.bootstrap_failed", { err });
  }
}

/* ── Sign-in ───────────────────────────────────────────────────────────── */

export type LocalSignInResult =
  | { ok: true; uid: Uid; authTime: Millis }
  | { ok: false; reason: "invalid" | "locked" | "inactive" | "rate_limited" | "unavailable"; lockedUntil?: Millis };

async function requestIp(): Promise<string | null> {
  try {
    return clientIp(await headers());
  } catch {
    return null;
  }
}

async function recordFailure(uid: Uid, now: Millis): Promise<Millis | null> {
  return withAuthLock(async () => {
    const file = await readAccounts();
    const a = file.accounts[uid];
    if (!a) return null;
    const inWindow = a.firstFailedAt !== null && now - a.firstFailedAt < FAILURE_WINDOW_MS;
    const failedCount = inWindow ? a.failedCount + 1 : 1;
    const lockedUntil = failedCount >= LOCK_AFTER_FAILURES ? now + LOCK_MS : a.lockedUntil;
    file.accounts[uid] = { ...a, failedCount, firstFailedAt: inWindow ? a.firstFailedAt : now, lockedUntil, updatedAt: now };
    await writeJson(accountsFile(), file);
    return lockedUntil && lockedUntil > now ? lockedUntil : null;
  });
}

async function clearFailures(uid: Uid): Promise<void> {
  await withAuthLock(async () => {
    const file = await readAccounts();
    const a = file.accounts[uid];
    if (!a || (a.failedCount === 0 && !a.lockedUntil)) return;
    file.accounts[uid] = { ...a, failedCount: 0, firstFailedAt: null, lockedUntil: null, updatedAt: Date.now() };
    await writeJson(accountsFile(), file);
  });
}

/**
 * Checks an email and password against the local accounts (Server Action `signIn` calls this, then
 * startSession). Rate-limited per IP; locks the account after repeated failures; audits failures.
 */
export async function localSignIn(email: string, password: string, opts?: { ip?: string | null; seed?: boolean }): Promise<LocalSignInResult> {
  if (resolveBackend() !== "local") return { ok: false, reason: "unavailable" };
  const now = Date.now();
  const ip = opts?.ip ?? (await requestIp());
  if (ip) {
    const rl = await rateLimit("login", ipHash(ip, now), now);
    if (!rl.ok) return { ok: false, reason: "rate_limited" };
  }
  await ensureBootstrapAdmin();

  const account = await findLocalAccountByEmail(String(email ?? ""));
  const passwordOk = await verifyPassword(String(password ?? ""), account?.passwordHash ?? null);
  if (!account) return { ok: false, reason: "invalid" };
  if (account.lockedUntil && account.lockedUntil > now) return { ok: false, reason: "locked", lockedUntil: account.lockedUntil };
  if (!passwordOk) {
    const lockedUntil = await recordFailure(account.uid, now);
    await audit({
      actor: { kind: "public" },
      action: "auth.sign_in_failed",
      area: "auth",
      summary: lockedUntil ? "A sign-in failed and the account was paused for 15 minutes" : "A sign-in failed",
      sensitive: true,
      targetPath: docPath("staff", account.uid),
      ip: ip ?? undefined,
    });
    return lockedUntil ? { ok: false, reason: "locked", lockedUntil } : { ok: false, reason: "invalid" };
  }
  const staff = await getStore().get<StaffProfile>(docPath("staff", account.uid));
  if (!staff || staff.status !== "active") return { ok: false, reason: "inactive" };
  await clearFailures(account.uid);
  if (opts?.seed !== false) await seedOnFirstSignIn();
  return { ok: true, uid: account.uid, authTime: now };
}

/** Confirms the signed-in person's password (step-up confirm, idle unlock). */
export async function verifyLocalPasswordFor(uid: Uid, password: string): Promise<boolean> {
  if (resolveBackend() !== "local") return false;
  const account = await getLocalAccount(uid);
  const ok = await verifyPassword(password, account?.passwordHash ?? null);
  if (!account) return false;
  if (!ok) await recordFailure(account.uid, Date.now());
  return ok && !(account.lockedUntil && account.lockedUntil > Date.now());
}

async function seedOnFirstSignIn(): Promise<void> {
  try {
    if (await getStore().get(settingsPath("seed"))) return;
    const { ensurePracticeSeed } = await import("@/lib/server/dev/seed");
    await ensurePracticeSeed();
  } catch (err) {
    log.error("auth.local.seed_failed", { err });
  }
}

/* ── Sessions ──────────────────────────────────────────────────────────── */

/** The stored id of a session cookie (also the Me › Devices id). */
export function localSessionId(cookieValue: string): string {
  return sha256Id(cookieValue);
}

export function isLocalCookie(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(COOKIE_PREFIX) && value.length > COOKIE_PREFIX.length + 20 && value.length < 200;
}

function prune(sessions: Record<string, LocalSession>, now: Millis): void {
  for (const [id, s] of Object.entries(sessions)) if (s.expiresAt <= now || (s.revokedAt && now - s.revokedAt > 86_400_000)) delete sessions[id];
}

export async function createLocalSession(
  uid: Uid,
  opts: { authTime: Millis; lifetimeMs: number; remember: boolean; device?: string | null },
): Promise<{ cookieValue: string; sessionId: string; expiresAt: Millis }> {
  assertLocal();
  const now = Date.now();
  const cookieValue = `${COOKIE_PREFIX}${randomToken(32)}`;
  const sessionId = localSessionId(cookieValue);
  const expiresAt = now + opts.lifetimeMs;
  await withAuthLock(async () => {
    const file = await readSessions();
    prune(file.sessions, now);
    file.sessions[sessionId] = {
      uid,
      createdAt: now,
      expiresAt,
      authTime: opts.authTime,
      lastSeenAt: now,
      device: opts.device ?? null,
      remember: opts.remember,
      provider: "local",
      revokedAt: null,
    };
    await writeJson(sessionsFile(), file);
  });
  return { cookieValue, sessionId, expiresAt };
}

/** The live session behind a cookie, or null (unknown, expired or revoked). */
export async function readLocalSession(cookieValue: string, now: Millis = Date.now()): Promise<(LocalSession & { id: string }) | null> {
  if (!isLocalCookie(cookieValue)) return null;
  const id = localSessionId(cookieValue);
  const f = await readJsonCached<SessionsFile>(sessionsFile());
  const s = f?.sessions?.[id];
  if (!s || s.revokedAt || s.expiresAt <= now) return null;
  return { ...s, id };
}

/** Records a fresh real sign-in on this session (step-up confirm, idle unlock). */
export async function refreshLocalSessionAuth(cookieValue: string, authTime: Millis): Promise<boolean> {
  const id = localSessionId(cookieValue);
  return withAuthLock(async () => {
    const file = await readSessions();
    const s = file.sessions[id];
    if (!s || s.revokedAt || s.expiresAt <= Date.now()) return false;
    file.sessions[id] = { ...s, authTime, lastSeenAt: Date.now() };
    await writeJson(sessionsFile(), file);
    return true;
  });
}

/** Ends one session by cookie value or session id. */
export async function revokeLocalSession(cookieOrId: string): Promise<void> {
  if (resolveBackend() !== "local") return;
  const id = isLocalCookie(cookieOrId) ? localSessionId(cookieOrId) : cookieOrId;
  await withAuthLock(async () => {
    const file = await readSessions();
    const s = file.sessions[id];
    if (!s || s.revokedAt) return;
    file.sessions[id] = { ...s, revokedAt: Date.now() };
    await writeJson(sessionsFile(), file);
  });
}

/** Ends every session of a person ("Sign out on all devices", deactivation). Returns how many. */
export async function revokeAllLocalSessions(uid: Uid): Promise<number> {
  if (resolveBackend() !== "local") return 0;
  return withAuthLock(async () => {
    const file = await readSessions();
    const now = Date.now();
    let n = 0;
    for (const [id, s] of Object.entries(file.sessions)) {
      if (s.uid === uid && !s.revokedAt) {
        file.sessions[id] = { ...s, revokedAt: now };
        n++;
      }
    }
    if (n) await writeJson(sessionsFile(), file);
    return n;
  });
}

/** A person's live sessions, newest first (Me › Devices). */
export async function listLocalSessions(uid: Uid): Promise<Array<LocalSession & { id: string }>> {
  if (resolveBackend() !== "local") return [];
  const { sessions } = await readSessions();
  const now = Date.now();
  return Object.entries(sessions)
    .filter(([, s]) => s.uid === uid && !s.revokedAt && s.expiresAt > now)
    .map(([id, s]) => ({ ...s, id }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/* ── Password reset (local) ────────────────────────────────────────────── */

/** A 1-hour reset token for /admin/reset/[token] (only its hash is stored). */
export async function createLocalResetToken(uid: Uid): Promise<string> {
  assertLocal();
  const token = randomToken(32);
  const now = Date.now();
  await withAuthLock(async () => {
    const file = await readResets();
    for (const [k, r] of Object.entries(file.resets)) if (r.expiresAt <= now || r.usedAt) delete file.resets[k];
    file.resets[sha256Id(token)] = { uid, createdAt: now, expiresAt: now + RESET_TTL_MS, usedAt: null };
    await writeJson(resetsFile(), file);
  });
  return token;
}

/** The account a reset token belongs to, without using it, or null. */
export async function peekLocalResetToken(token: string): Promise<Uid | null> {
  if (resolveBackend() !== "local" || typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const { resets } = await readResets();
  const r = resets[sha256Id(token)];
  return r && !r.usedAt && r.expiresAt > Date.now() ? r.uid : null;
}

/** Sets a new password with a reset token (one use), clears lockout and signs out every session. */
export async function consumeLocalResetToken(
  token: string,
  newPassword: string,
): Promise<{ ok: true; uid: Uid } | { ok: false; reason: "invalid" | "policy"; message: string }> {
  const uid = await peekLocalResetToken(token);
  if (!uid) return { ok: false, reason: "invalid", message: "This link has expired or was already used. Please ask for a new one." };
  const account = await getLocalAccount(uid);
  const problem = checkPasswordPolicy(newPassword, { email: account?.email });
  if (problem) return { ok: false, reason: "policy", message: problem };
  const used = await withAuthLock(async () => {
    const file = await readResets();
    const key = sha256Id(token);
    const r = file.resets[key];
    if (!r || r.usedAt || r.expiresAt <= Date.now()) return false;
    file.resets[key] = { ...r, usedAt: Date.now() };
    await writeJson(resetsFile(), file);
    return true;
  });
  if (!used) return { ok: false, reason: "invalid", message: "This link has expired or was already used. Please ask for a new one." };
  await setLocalPassword(uid, newPassword, { skipPolicy: true });
  await revokeAllLocalSessions(uid);
  return { ok: true, uid };
}
