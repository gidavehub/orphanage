// Changed-path diffs for content writes (content-model §5.2, §5.4). Isomorphic and pure.
// Used for field-group checks ("slides.2.title.0" → the hero group), the audit trail (≤ 30 entries,
// values cut to 200 characters, media as ids) and the publish sheet's readable change list.

import type { AuditChange } from "@/lib/model/domain/system";

export type Change = { path: string; before: unknown; after: unknown };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const isMediaRef = (v: unknown): v is { $media: string } => isPlainObject(v) && typeof v.$media === "string" && Object.keys(v).length === 1;

/** Every leaf path whose value differs between `before` and `after`. Missing and undefined are equal. */
export function diffPaths(before: unknown, after: unknown, prefix = ""): Change[] {
  const out: Change[] = [];
  walk(before, after, prefix, out);
  return out;
}

function walk(a: unknown, b: unknown, path: string, out: Change[]): void {
  if (a === b) return;
  if (a === undefined && b === undefined) return;
  if (isMediaRef(a) && isMediaRef(b)) {
    if (a.$media !== b.$media) out.push({ path, before: a, after: b });
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) walk(a[i], b[i], join(path, String(i)), out);
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) walk(a[k], b[k], join(path, k), out);
    return;
  }
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return;
  out.push({ path, before: a, after: b });
}

function join(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

/**
 * Paths present in `input` that the schema dropped from `parsed` (unknown keys). The write pipeline
 * rejects them instead of silently discarding staff input.
 */
export function extraPaths(input: unknown, parsed: unknown, prefix = ""): string[] {
  const out: string[] = [];
  if (Array.isArray(input) && Array.isArray(parsed)) {
    input.forEach((v, i) => out.push(...extraPaths(v, parsed[i], join(prefix, String(i)))));
    return out;
  }
  if (isPlainObject(input) && isPlainObject(parsed)) {
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      if (!(k in parsed)) out.push(join(prefix, k));
      else out.push(...extraPaths(v, parsed[k], join(prefix, k)));
    }
  }
  return out;
}

/** Top-level keys touched by a set of changes ("slides", "text"). */
export function changedKeys(changes: readonly Change[]): string[] {
  return [...new Set(changes.map((c) => c.path.split(".")[0]).filter(Boolean))];
}

function show(v: unknown): string | number | boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v.length > 200 ? `${v.slice(0, 199)}…` : v;
  if (isMediaRef(v)) return `media:${v.$media}`;
  const s = JSON.stringify(v);
  return s.length > 200 ? `${s.slice(0, 199)}…` : s;
}

/** The audit form of a diff: at most 30 entries, values stringified and cut to 200 characters. */
export function summarizeChanges(changes: readonly Change[], max = 30): AuditChange[] {
  const out: AuditChange[] = changes.slice(0, max).map((c) => ({ field: c.path || "(all)", from: show(c.before), to: show(c.after) }));
  if (changes.length > max) out.push({ field: `…and ${changes.length - max} more`, from: null, to: null });
  return out;
}

/** "Hero slide 2 · headline"-style label for one path, for the publish sheet. */
export function readablePath(path: string): string {
  return path
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()))
    .join(" · ");
}
