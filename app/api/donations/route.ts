import { submitDonation } from "@/lib/server/intake/donation";
import { sameOriginJsonGuard } from "@/lib/server/security/origin";

// POST /api/donations (public-pages §4.7, PLAN D66): the donate widget's one endpoint for cash and
// in-kind gifts, card and pledge. Same-origin JSON only. Answers
//   { kind: "stripe", url } | { kind: "pledge", next } | { kind: "unavailable", message }
//   | { kind: "error", message, fieldErrors? }
// with 200, 422 (validation), 429 (rate limit), 503 (backend off) or 500. Never cached.

const NO_STORE = { "Cache-Control": "no-store" };
/** A gift form is a few kilobytes at most. */
const MAX_BODY = 32_000;

export async function POST(request: Request): Promise<Response> {
  const denied = sameOriginJsonGuard(request);
  if (denied) return denied;

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) {
      return Response.json({ kind: "error", message: "That form is too large to send. Please shorten your note." }, { status: 413, headers: NO_STORE });
    }
    body = JSON.parse(text);
  } catch {
    return Response.json({ kind: "error", message: "Please refresh the page and try again." }, { status: 400, headers: NO_STORE });
  }

  const out = await submitDonation(body, request);
  return Response.json(out.body, { status: out.status, headers: NO_STORE });
}
