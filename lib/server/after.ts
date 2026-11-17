import "server-only";

// Work that runs once a response is ready, such as sending queued emails (lib/server/email/outbox.ts).
// On this computer (next dev, next start) that is Next's after(). On Cloud Functions it can't be:
// Cloud Run takes the CPU away the moment a response is sent, so the work would stall until another
// request arrived (a sign-in code could wait minutes). There functions/server.js lends each request
// a hold instead: the tasks run when the response is ready, and the response goes out once they
// settle (at most 20 seconds).

import { after } from "next/server";

type Hold = (task: () => Promise<unknown>) => void;
const HOLD = Symbol.for("haven.request-hold");

/** Runs `task` after this response is ready. Never throws; a failing task is the task's to log. */
export function afterResponse(task: () => Promise<unknown>): void {
  const hold = (globalThis as { [HOLD]?: { get(): Hold | undefined } })[HOLD]?.get();
  if (hold) {
    hold(task);
    return;
  }
  try {
    after(() => task().then(() => undefined));
  } catch {
    // Outside a request (a script or the boot report): just start it.
    void task().catch(() => undefined);
  }
}
