import "server-only";

// Selftest suite "zoom" (PLAN §6.3 I5): without ZOOM_* nothing reaches Zoom and the button is off;
// the calendar file is a valid VEVENT whose UID stays the same across reschedules, whose SEQUENCE goes
// up, which cancels with METHOD:CANCEL, folds long lines and carries no client details.

import { buildIcs } from "@/lib/server/calendar/ics";
import { env } from "@/lib/server/env";
import { createZoomMeeting, zoomApiOn } from "@/lib/server/zoom/meetings";
import { caseRecorder } from "../selftest";
import type { Suite } from "../types";

const field = (ics: string, name: string) => ics.split("\r\n").find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1) ?? null;

export const suite: Suite = {
  name: "zoom",
  async run() {
    const t = caseRecorder();
    const base = { reference: "HVN-AP-2026-0042", startsAt: Date.UTC(2026, 10, 3, 14, 0), durationMin: 45, url: "https://zoom.us/j/1234567890?pwd=abc" };

    await t.check("without Zoom details, no meeting is made and the button is hidden", async () => {
      if (env.zoom.accountId && env.zoom.clientId && env.zoom.clientSecret) return "skipped: Zoom is connected";
      const r = await createZoomMeeting({ reference: base.reference, startsAt: base.startsAt, durationMin: 45, timezone: "Africa/Banjul" });
      return r === null && !zoomApiOn();
    });

    await t.check("the invitation is one valid VEVENT with CRLF line endings", () => {
      const ics = buildIcs({ ...base, sequence: 0 });
      const ok = ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n") && (ics.match(/BEGIN:VEVENT/g) ?? []).length === 1 && field(ics, "METHOD") === "REQUEST" && field(ics, "STATUS") === "CONFIRMED" && /^\d{8}T\d{6}Z$/.test(field(ics, "DTSTART") ?? "");
      return ok ? true : ics.slice(0, 300);
    });

    await t.check("a reschedule keeps the UID and raises SEQUENCE", () => {
      const a = buildIcs({ ...base, sequence: 0 });
      const b = buildIcs({ ...base, startsAt: base.startsAt + 86_400_000, sequence: 1 });
      return field(a, "UID") === field(b, "UID") && field(a, "SEQUENCE") === "0" && field(b, "SEQUENCE") === "1" && field(a, "DTSTART") !== field(b, "DTSTART");
    });

    await t.check("a cancellation is METHOD:CANCEL with STATUS:CANCELLED and no alarm", () => {
      const c = buildIcs({ ...base, sequence: 2, method: "CANCEL" });
      return field(c, "METHOD") === "CANCEL" && field(c, "STATUS") === "CANCELLED" && !c.includes("BEGIN:VALARM") && field(c, "UID") === field(buildIcs({ ...base, sequence: 0 }), "UID");
    });

    await t.check("long lines are folded to 75 octets", () => {
      const ics = buildIcs({ ...base, sequence: 0, url: `https://zoom.us/j/1234567890?pwd=${"x".repeat(120)}` });
      return ics.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75);
    });

    await t.check("the file names no client and no need", () => {
      const ics = buildIcs({ ...base, sequence: 0 });
      return field(ics, "SUMMARY") === "Haven appointment" && !/counsell|therapy|support request|child/i.test(ics);
    });

    return t.cases;
  },
};
