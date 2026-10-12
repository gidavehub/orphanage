import "server-only";

// Calendar invitations for counselling sessions (integrations §6.4; PLAN §6.2 A5). One VEVENT per
// appointment, keyed by the HVN-AP reference so a reschedule (a higher SEQUENCE) replaces the earlier
// invite in the client's calendar and a cancellation (METHOD:CANCEL) removes it. The text stays as
// general as the email: no category of need, no names beyond "Haven".

export type IcsEvent = {
  /** The appointment reference; becomes the event UID. */
  reference: string;
  startsAt: number;
  durationMin: number;
  /** Bumped on each reschedule. */
  sequence: number;
  /** Where to join (Zoom link), when there is one. */
  url?: string | null;
  method?: "REQUEST" | "CANCEL";
  /** Fixed at "Haven appointment" unless given. */
  summary?: string;
  organiserEmail?: string | null;
};

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** RFC 5545 text escaping. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Folds lines longer than 75 octets (RFC 5545 §3.1). Continuation lines start with a space, which
 * counts towards their 75, so they carry at most 74 octets of content.
 */
function fold(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  let max = 75;
  while (Buffer.byteLength(rest, "utf8") > max) {
    let cut = max;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > max) cut--;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
    max = 74;
  }
  parts.push(rest);
  return parts.join("\r\n ");
}

/** The .ics file for one session (CRLF line endings, folded). */
export function buildIcs(e: IcsEvent, now: number = Date.now()): string {
  const method = e.method ?? "REQUEST";
  const end = e.startsAt + e.durationMin * 60_000;
  const description = e.url ? `Join your appointment: ${e.url}\nIf you need to change the time, reply to the email we sent you.` : "If you need to change the time, reply to the email we sent you.";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Haven//Appointments//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${esc(e.reference)}@haven`,
    `SEQUENCE:${Math.max(0, Math.trunc(e.sequence))}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.summary ?? "Haven appointment")}`,
    `DESCRIPTION:${esc(description)}`,
    ...(e.url ? [`URL:${esc(e.url)}`, `LOCATION:${esc(e.url)}`] : []),
    ...(e.organiserEmail ? [`ORGANIZER;CN=Haven:mailto:${e.organiserEmail}`] : []),
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(method === "CANCEL"
      ? []
      : ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Haven appointment", "TRIGGER:-PT30M", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
