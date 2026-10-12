// GET /api/search?q= (PLAN D115, public-pages §3.22): the top 8 public hits for the search overlay,
// grouped in display order (Programmes · Pages · Ways to give · Resources · News · Stories · Projects ·
// Questions). Public content only, through the same cached readers as the pages. The query is never
// logged or stored.

import { searchSite } from "@/lib/content/public";
import { groupHits } from "@/lib/content/search";

const HEADERS = {
  "Cache-Control": "private, max-age=60",
  "X-Robots-Tag": "noindex",
};

export async function GET(request: Request): Promise<Response> {
  const q = (new URL(request.url).searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const hits = q.length >= 2 ? await searchSite(q, 8) : [];
  return Response.json({ q, total: hits.length, hits, groups: groupHits(hits) }, { headers: HEADERS });
}
