import "server-only";

// Output and file-name hygiene (data-model §10.5–10.6, §12; PLAN §7.5).
// User text is always shown as plain text; these helpers cover the places where text leaves the app
// in another format (HTML emails, CSV exports, file names, outbound links).

import { cleanText } from "@/lib/schemas/common";

export { cleanText };

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * A safe stored file name: lowercase [a-z0-9._-], at most 80 characters, the original extension kept
 * (when it is short and alphanumeric), never empty, never starting with a dot.
 */
export function sanitiseFileName(name: string, fallbackBase = "file"): string {
  const raw = String(name ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .split(/[\\/]/)
    .pop()!
    .toLowerCase();
  const dot = raw.lastIndexOf(".");
  const extRaw = dot > 0 ? raw.slice(dot + 1) : "";
  const ext = /^[a-z0-9]{1,5}$/.test(extRaw) ? extRaw : "";
  const baseRaw = dot > 0 ? raw.slice(0, dot) : raw;
  let base = baseRaw
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  if (!base) base = fallbackBase;
  const max = 80 - (ext ? ext.length + 1 : 0);
  base = base.slice(0, max).replace(/[.-]+$/g, "") || fallbackBase;
  return ext ? `${base}.${ext}` : base;
}

/**
 * One CSV cell (RFC 4180) with formula-injection defence: a value starting with = + - @ (or a tab or
 * carriage return) is prefixed with an apostrophe so spreadsheets show it as text.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV line from cells. */
export function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** True for an absolute http(s) URL without credentials. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** True for a site-relative path ("/donate"), never protocol-relative ("//evil"). */
export function isSafeRelativePath(value: string): boolean {
  return /^\/(?![/\\])/.test(value) && !/[\u0000-\u001f\\]/.test(value);
}

/** Plain text of at most `max` characters for previews and summaries (control characters removed). */
export function truncateText(value: string, max: number): string {
  const s = cleanText(String(value ?? ""), false);
  return s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…` : s;
}
