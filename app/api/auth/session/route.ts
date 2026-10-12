// POST /api/auth/session (data-model §9.1, PLAN D86–D88): Firebase mode only. The staff sign-in page
// signs in with firebase/auth and sends { idToken, remember, next } here; we answer with the session
// cookie set, { next: "enrol_mfa" } (no cookie) for required-MFA roles without a second factor, or an
// error. Same-origin JSON only; rate-limited per IP hash (login: 10 per 15 minutes).
// Local practice mode signs in with the `signIn` Server Action instead, so this answers 404 there.

import { z } from "zod";
import { safeNextPath } from "@/lib/model/session";
import { firebaseAuthAvailable } from "@/lib/server/auth/firebase";
import { startFirebaseSession } from "@/lib/server/auth/session";
import { log } from "@/lib/server/log";
import { ipHash } from "@/lib/server/security/hmac";
import { sameOriginJsonGuard } from "@/lib/server/security/origin";
import { rateLimit } from "@/lib/server/security/ratelimit";
import { clientIp } from "@/lib/server/security/spam";

const Body = z.object({
  idToken: z.string().min(20).max(8192),
  remember: z.boolean().default(false),
  next: z.string().max(512).optional(),
});

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request): Promise<Response> {
  const denied = sameOriginJsonGuard(request);
  if (denied) return denied;
  if (!firebaseAuthAvailable()) return json({ ok: false, error: "not_available" }, 404);

  const ip = clientIp(request.headers);
  const rl = await rateLimit("login", ipHash(ip));
  if (!rl.ok) {
    return json({ ok: false, error: "rate_limited", message: "Too many sign-in attempts. Please wait a few minutes and try again." }, 429, {
      "Retry-After": String(rl.retryAfterSec),
    });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  try {
    const result = await startFirebaseSession(body.idToken, { remember: body.remember, ip });
    switch (result.kind) {
      case "ok":
        return json({ ok: true, next: safeNextPath(body.next) });
      case "enrol_mfa":
        return json({ ok: false, next: "enrol_mfa" });
      case "stale":
        return json({ ok: false, error: "stale", message: "Please sign in again." }, 401);
      case "not_staff":
        return json({ ok: false, error: "not_staff", message: "This account can't sign in to Haven. Please use the invitation you were sent." }, 401);
      default:
        return json({ ok: false, error: "invalid", message: "That sign-in didn't work. Please try again." }, 401);
    }
  } catch (err) {
    log.error("auth.session_route_failed", { err });
    return json({ ok: false, error: "server", message: "Something went wrong. Please try again." }, 500);
  }
}
