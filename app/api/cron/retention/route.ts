import { cronAuthorized, cronUnauthorized, withJobLock } from "@/lib/server/cron";
import { log } from "@/lib/server/log";
import { runRetention } from "@/lib/server/retention";

// GET /api/cron/retention (integrations §7.1; data-model §11.4): nightly at 02:30 UTC. `?dryRun=1`
// lists what is due without changing anything. Never deletes a safeguarding concern.

export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) return cronUnauthorized();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const out = await withJobLock("retention", 290_000, () => runRetention({ dryRun }));
  if (out === "locked") return Response.json({ ok: true, locked: true }, { headers: NO_STORE });
  log.info("cron.retention", { dryRun, due: out.due.length, deleted: out.deleted, anonymised: out.anonymised, reviews: out.reviews });
  // Paths only (no personal data) so the run can be checked.
  return Response.json({ ok: true, ...out }, { headers: NO_STORE });
}
