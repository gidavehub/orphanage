import "server-only";

// Redacting logger (data-model §11.3). Never log request bodies, form values, emails or tokens:
// record the event name, references and paths. Values under sensitive keys are replaced, long strings
// truncated, and errors reduced to their name and message (stack traces only in development).

import { env } from "./env";

/** Key words whose values are always redacted (matched per camelCase / snake_case word, case-insensitive). */
export const REDACT_KEYS: readonly string[] = [
  "email",
  "phone",
  "name",
  "narrative",
  "explanation",
  "token",
  "password",
  "idToken",
  "secret",
  "cookie",
  "authorization",
  "privateKey",
  "apiKey",
  "ip",
];

const REDACT_WORDS = new Set(REDACT_KEYS.map((k) => k.toLowerCase()));
const MAX_STRING = 300;
const MAX_ITEMS = 20;
const MAX_DEPTH = 4;

function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_.-]+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (REDACT_WORDS.has(lower)) return true;
  return words(key).some((w) => REDACT_WORDS.has(w));
}

function clean(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    const digest = (value as Error & { digest?: unknown }).digest;
    return {
      error: value.name,
      message: value.message.slice(0, MAX_STRING),
      ...(typeof digest === "string" ? { digest } : {}),
      ...(env.nodeEnv !== "production" && value.stack ? { stack: value.stack.split("\n").slice(0, 6).join("\n") } : {}),
    };
  }
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => clean(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? "[redacted]" : clean(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** The redacted copy of a metadata object, as it would be logged. */
export function redact(meta: Record<string, unknown>): Record<string, unknown> {
  return clean(meta, 0) as Record<string, unknown>;
}

function write(level: "info" | "warn" | "error", event: string, meta?: Record<string, unknown>): void {
  const line = meta ? `[haven] ${event} ${JSON.stringify(redact(meta))}` : `[haven] ${event}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info(event: string, meta?: Record<string, unknown>): void {
    write("info", event, meta);
  },
  warn(event: string, meta?: Record<string, unknown>): void {
    write("warn", event, meta);
  },
  error(event: string, meta?: Record<string, unknown>): void {
    write("error", event, meta);
  },
};
