// POST /api/dev/session?role=<role>[&n=2] (PLAN D90): practice sign-in as the seeded <role>@haven.test
// account, or its second account <role>2@haven.test (seeding practice data first if needed). Sets the session cookie. 404 unless the backend
// is local and we are not on Vercel. QA scripts call it with curl (no Origin header); a browser
// request from another site is refused.
//   curl -s -X POST "http://localhost:3001/api/dev/session?role=finance_officer" -c jar

import type { NextRequest } from "next/server";
import { ROLES, isRole } from "@/lib/model/permissions";
import { devOnly } from "@/lib/server/dev/guard";
import { devSignInAs } from "@/lib/server/dev/session";
import { log } from "@/lib/server/log";
import { isSameOrigin } from "@/lib/server/security/origin";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest): Promise<Response> {
  devOnly();
  if (request.headers.get("origin") && !isSameOrigin(request)) {
    return Response.json({ ok: false, error: "cross_site" }, { status: 403, headers: NO_STORE });
  }
  const role = request.nextUrl.searchParams.get("role");
  if (!isRole(role)) {
    return Response.json({ ok: false, error: "unknown_role", roles: ROLES }, { status: 400, headers: NO_STORE });
  }
  try {
    const ageMin = Number(request.nextUrl.searchParams.get("authAgeMin") ?? 0);
    const n = request.nextUrl.searchParams.get("n") === "2" ? 2 : 1;
    await devSignInAs(role, { authAgeMs: Number.isFinite(ageMin) ? ageMin * 60_000 : 0, n });
    return Response.json({ ok: true, role, next: "/admin" }, { headers: NO_STORE });
  } catch (err) {
    log.error("dev.session_failed", { role, err });
    return Response.json({ ok: false, error: "failed", message: err instanceof Error ? err.message : "Sign-in failed." }, { status: 500, headers: NO_STORE });
  }
}
