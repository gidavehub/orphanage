import { cronAuthorized, cronUnauthorized, withJobLock } from "@/lib/server/cron";
import { log } from "@/lib/server/log";
import { runTick } from "@/lib/server/tick";

// GET /api/cron/tick (integrations §7.1–7.2; PLAN D110): Vercel Cron (or the pinger) with
// `Authorization: Bearer $CRON_SECRET`. Reading the header first keeps the GET dynamic. One run at a
// time (cronLocks/tick); a second concurrent call answers { locked: true }.

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) return cronUnauthorized();
  const out = await withJobLock("tick", 55_000, () => runTick());
  if (out === "locked") return Response.json({ ok: true, locked: true }, { headers: NO_STORE });
  const failed = Object.entries(out.steps).filter(([, s]) => !s.ok).map(([k]) => k);
  log.info("cron.tick", { failed: failed.length, daily: typeof out.daily === "string" ? out.daily : "ran" });
  return Response.json({ ok: failed.length === 0, ...out }, { headers: NO_STORE });
}
