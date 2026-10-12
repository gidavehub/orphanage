// Session constants shared by proxy.ts, the server auth layer and client sign-in components.
// This module IMPORTS NOTHING (PLAN D18): proxy.ts may only import next/server and this file.

/** Cookie on http://localhost (Safari drops Secure cookies on plain http). */
export const SESSION_COOKIE = "haven_session";
/** Cookie on https: the `__Host-` prefix pins it to this origin, path `/`, Secure. */
export const SESSION_COOKIE_SECURE = "__Host-haven_session";

export function sessionCookieName(secure: boolean): string {
  return secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE;
}

/**
 * Admin pages reachable without a session (D89). Everything else under /admin needs the cookie
 * to be present; the proxy redirects otherwise. Verification always happens in the DAL.
 */
export const PUBLIC_ADMIN_PATHS: readonly RegExp[] = [
  /^\/admin\/login(?:\/code)?\/?$/,
  /^\/admin\/forgot\/?$/,
  /^\/admin\/reset\/[^/]+\/?$/,
  /^\/admin\/invite\/[^/]+\/?$/,
];

export function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some((re) => re.test(pathname));
}

const ADMIN_HOME = "/admin";
const MAX_NEXT_LENGTH = 512;

/**
 * Returns a same-origin admin path that is safe to redirect to after sign-in, or "/admin".
 * Accepts only paths that start with "/admin" (followed by the end, "/", "?" or "#"). Rejects
 * protocol-relative URLs, backslashes, control characters, encoded slashes that could escape the
 * admin, and the sign-in pages themselves (which would loop).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string") return ADMIN_HOME;
  const value = next.trim();
  if (!value || value.length > MAX_NEXT_LENGTH) return ADMIN_HOME;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return ADMIN_HOME;
  if (!/^\/admin(?:[/?#]|$)/.test(value)) return ADMIN_HOME;
  if (value.startsWith("//") || /%2f|%5c/i.test(value.split(/[?#]/, 1)[0])) return ADMIN_HOME;
  const path = value.split(/[?#]/, 1)[0];
  if (path.split("/").some((seg) => seg === ".." || seg === ".")) return ADMIN_HOME;
  if (/^\/admin\/(?:login|locked)(?:[/?#]|$)/.test(value)) return ADMIN_HOME;
  return value;
}

/** Session lifetimes (D86): 12 h for super admins, safeguarding and finance officers; 7 days for others. */
export const SESSION_LIFETIME_MS = { privileged: 43_200_000, standard: 604_800_000 } as const;

/** Roles whose sessions use the privileged (12 h) lifetime. Strings, because this module imports nothing. */
export const PRIVILEGED_SESSION_ROLES: readonly string[] = ["super_admin", "safeguarding_officer", "finance_officer"];

export function sessionLifetimeFor(roles: readonly string[]): number {
  return roles.some((r) => PRIVILEGED_SESSION_ROLES.includes(r)) ? SESSION_LIFETIME_MS.privileged : SESSION_LIFETIME_MS.standard;
}

/** Step-up window (D87): entering Safeguarding, personal-data exports, role and MFA changes, deactivation, data-request completion. */
export const STEP_UP_MS = 1_800_000;
/** Idle time before the client sends the person to /admin/locked (D86). */
export const IDLE_LOCK_MS = 1_800_000;
