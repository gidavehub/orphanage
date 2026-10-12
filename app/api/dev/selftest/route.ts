// GET /api/dev/selftest?suite=<name> (PLAN §5.2): runs one selftest suite ("all" runs every suite)
// and returns { suite, passed, failed, cases[] }. 404 unless the backend is local and we are not on
// Vercel. `node scripts/qa/data-selftest.mjs --base http://localhost:3001` runs the suites.

import { connection, type NextRequest } from "next/server";
import { devOnly } from "@/lib/server/dev/guard";
import { runSelftest, suiteNames } from "@/lib/server/dev/selftest";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest): Promise<Response> {
  devOnly();
  await connection();
  const params = request.nextUrl.searchParams;
  const name = params.get("suite") ?? "all";
  const report = await runSelftest(name, params);
  if (!report) {
    return Response.json({ error: "unknown_suite", suites: [...(await suiteNames()), "all"] }, { status: 404, headers: NO_STORE });
  }
  return Response.json(report, { headers: NO_STORE });
}
