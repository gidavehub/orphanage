// Staff-facing dates, relative times and greetings (client-safe). Dates always use the staff
// member's own timezone (Viewer.timezone); Haven's org timezone is Africa/Banjul.

import type { Millis } from "@/lib/model/enums";

export { formatMoney, money } from "@/lib/money";

export const ORG_TIMEZONE = "Africa/Banjul";

const formatters = new Map<string, Intl.DateTimeFormat>();

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return ORG_TIMEZONE;
  }
}

function fmt(tz: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const zone = safeZone(tz);
  const key = `${zone}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: zone });
    formatters.set(key, f);
  }
  return f;
}

/**
 * "12 Oct 2026" (short), "Monday, 12 October 2026 at 14:30" (long) or "14:30" (time), in the given
 * timezone.
 */
export function formatStaffDate(ms: Millis, tz: string, style: "short" | "long" | "time" = "short"): string {
  if (!Number.isFinite(ms)) return "";
  if (style === "time") return fmt(tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
  if (style === "long") {
    return fmt(tz, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(ms);
  }
  return fmt(tz, { day: "numeric", month: "short", year: "numeric" }).format(ms);
}

/** "12 Oct, 14:30", for timelines and lists. */
export function formatStaffDateTime(ms: Millis, tz: string): string {
  if (!Number.isFinite(ms)) return "";
  return fmt(tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", "in 2 hours", or a date after 30 days. */
export function relativeTime(ms: Millis, now: Millis): string {
  if (!Number.isFinite(ms) || !Number.isFinite(now)) return "";
  const diff = now - ms;
  const abs = Math.abs(diff);
  const future = diff < 0;
  if (abs < 45_000) return "just now";
  let text: string;
  if (abs < HOUR) text = plural(Math.max(1, Math.round(abs / MINUTE)), "minute");
  else if (abs < DAY) text = plural(Math.round(abs / HOUR), "hour");
  else if (abs < 2 * DAY) return future ? "tomorrow" : "yesterday";
  else if (abs < 30 * DAY) text = plural(Math.round(abs / DAY), "day");
  else return fmt(ORG_TIMEZONE, { day: "numeric", month: "short", year: "numeric" }).format(ms);
  return future ? `in ${text}` : `${text} ago`;
}

/** Greeting for the person's local time of day. */
export function greetingFor(now: Millis, tz: string): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(fmt(tz, { hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** The first word of a display name, for greetings ("Hi Fatou"). */
export function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}
