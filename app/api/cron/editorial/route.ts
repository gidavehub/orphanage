import { editorialDue, runMonthlyDraft } from "@/lib/server/ai/monthly";
import { cronAuthorized, cronUnauthorized, withJobLock } from "@/lib/server/cron";
import { log } from "@/lib/server/log";

// GET /api/cron/editorial (integrations §5.6, §7.1): daily at 08:00 UTC. Acts only on the configured
// day of the month (Posts › Plan) and only while monthly drafting is switched on. The draft waits in
// review: nothing is ever published by this job.

export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) return cronUnauthorized();
  const due = await editorialDue();
  if (!due.due) return Response.json({ ok: true, skipped: due.reason }, { headers: NO_STORE });
  const out = await withJobLock("editorial", 10 * 60_000, () => runMonthlyDraft({ trigger: "cron" }));
  if (out === "locked") return Response.json({ ok: true, locked: true }, { headers: NO_STORE });
  log.info("cron.editorial", { created: Boolean(out.created), reason: out.reason ?? null });
  return Response.json({ ok: true, ...out }, { headers: NO_STORE });
}
