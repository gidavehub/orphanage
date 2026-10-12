// GET /admin/export/<dataset>?contact=1&from=2026-01-01&to=2026-12-31 (PLAN D102; admin-ux §6.6):
// a CSV for staff with the dataset's permission. Contact details (names, emails, phones) need the
// contact permission and a sign-in within the last 30 minutes (otherwise /admin/confirm first), and
// every export is logged (sensitive when it carries contacts).

import { NextResponse, type NextRequest } from "next/server";
import { actorOf, audit } from "@/lib/server/audit";
import { has } from "@/lib/server/auth/permissions";
import { getViewer } from "@/lib/server/auth/session";
import { DATASETS } from "@/lib/server/export/datasets";
import { toCsv } from "@/lib/server/export/csv";

const STEP_UP_MS = 30 * 60_000;

export async function GET(request: NextRequest, ctx: { params: Promise<{ dataset: string }> }): Promise<Response> {
  const { dataset } = await ctx.params;
  const ds = DATASETS[dataset];
  const v = await getViewer();
  if (!v) return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.url));
  if (!ds || !has(v, ds.perm)) return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  const sp = request.nextUrl.searchParams;
  const contact = sp.get("contact") === "1" && has(v, ds.contactPerm);
  if (contact && Date.now() - v.authTime > STEP_UP_MS) {
    return NextResponse.redirect(new URL(`/admin/confirm?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.url));
  }
  const parse = (s: string | null, fallback: number) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00Z`) : fallback);
  const from = parse(sp.get("from"), 0);
  const to = parse(sp.get("to"), Date.now() + 86_400_000) + (sp.get("to") ? 86_400_000 : 0);
  const { header, rows } = await ds.rows({ contact, from, to });
  await audit({
    actor: actorOf(v),
    action: "export.run",
    area: "export",
    summary: `${v.displayName} downloaded “${ds.label}”${contact ? " with contact details" : ""} (${rows.length} rows)`,
    feed: true,
    sensitive: contact,
  });
  const name = `haven-${ds.id}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(toCsv(header, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
