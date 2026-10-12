// GET /api/admin/pulse (admin-ux §3.6, PLAN D83): the shell's badge counts, polled every 30 seconds
// while the tab is visible. 401 when the session ended (the shell reloads into sign-in). Concern
// counts are present only for people who may see concerns. Never cached.

import { getViewer } from "@/lib/server/auth/session";
import { getPulse } from "@/lib/server/dal/dashboard";

const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(): Promise<Response> {
  const v = await getViewer();
  if (!v) return Response.json({ error: "signed_out" }, { status: 401, headers: HEADERS });
  return Response.json(await getPulse(), { headers: HEADERS });
}
