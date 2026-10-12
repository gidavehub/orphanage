import "server-only";

// CSRF defence for Route Handlers that browsers POST to (next16-notes §6.2, data-model §9.1).
// Server Actions get Next's built-in Origin check; route handlers do not, so each one requires:
// - an Origin (or, failing that, Sec-Fetch-Site: same-origin) whose host equals the request host
//   (x-forwarded-host ?? host);
// - `content-type: application/json`, which forces a CORS preflight for cross-site requests.
// Failures answer 403/415 with a JSON body and no detail.

/** The host this request was addressed to (behind Vercel's proxy, x-forwarded-host). */
function requestHost(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.toLowerCase();
  const host = req.headers.get("host")?.trim();
  if (host) return host.toLowerCase();
  try {
    return new URL(req.url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the browser says this request came from our own pages. */
export function isSameOrigin(req: Request): boolean {
  const host = requestHost(req);
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    try {
      return new URL(origin).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }
  // Some same-origin requests omit Origin; Fetch Metadata still tells us.
  return req.headers.get("sec-fetch-site") === "same-origin";
}

/** True for `application/json` bodies (with or without a charset). */
export function isJsonRequest(req: Request): boolean {
  const type = req.headers.get("content-type") ?? "";
  return /^application\/json(\s*;|$)/i.test(type.trim());
}

function deny(status: 403 | 415, message: string): Response {
  return Response.json({ kind: "error", message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Returns a ready error Response when the request is cross-site or not JSON, otherwise null:
 *   const denied = sameOriginJsonGuard(request); if (denied) return denied;
 */
export function sameOriginJsonGuard(req: Request): Response | null {
  if (!isSameOrigin(req)) return deny(403, "This request must come from the Haven website.");
  if (!isJsonRequest(req)) return deny(415, "Please send JSON.");
  return null;
}

/** Same-origin check only (multipart upload routes, which cannot be JSON). */
export function sameOriginGuard(req: Request): Response | null {
  return isSameOrigin(req) ? null : deny(403, "This request must come from the Haven website.");
}
