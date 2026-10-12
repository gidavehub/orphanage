// POST /api/dev/seed (PLAN §5.2): adds the practice data once (idempotent; a repeat run creates
// nothing) and reports what was created per collection. 404 unless the backend is local and we are
// not on Vercel. `node scripts/dev/seed.mjs --base http://localhost:3001` calls it.

import { devOnly } from "@/lib/server/dev/guard";
import { ensurePracticeSeed } from "@/lib/server/dev/seed";
import { log } from "@/lib/server/log";
import { isSameOrigin } from "@/lib/server/security/origin";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  devOnly();
  if (request.headers.get("origin") && !isSameOrigin(request)) {
    return Response.json({ ok: false, error: "cross_site" }, { status: 403, headers: NO_STORE });
  }
  try {
    const report = await ensurePracticeSeed();
    return Response.json({ ok: true, ...report }, { headers: NO_STORE });
  } catch (err) {
    log.error("dev.seed_failed", { err });
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Seeding failed." }, { status: 500, headers: NO_STORE });
  }
}
