// POST /api/auth/session/code: finishes a sign-in with the 6-digit code we emailed (Firebase mode).
// The sign-in page sends the same fresh ID token as POST /api/auth/session, the challenge id that
// route answered with, and the code; a right code sets the session cookie. Same-origin JSON only;
// rate-limited per IP hash with the sign-in limit, and each code allows 5 tries (email-code.ts).

import { z } from "zod";
import { safeNextPath } from "@/lib/model/session";
import { firebaseAuthAvailable } from "@/lib/server/auth/firebase";
import { finishFirebaseSessionWithCode } from "@/lib/server/auth/session";
import { log } from "@/lib/server/log";
import { ipHash } from "@/lib/server/security/hmac";
import { sameOriginJsonGuard } from "@/lib/server/security/origin";
import { rateLimit } from "@/lib/server/security/ratelimit";
import { clientIp } from "@/lib/server/security/spam";

const Body = z.object({
  idToken: z.string().min(20).max(8192),
  challengeId: z.string().min(10).max(64),
  code: z.string().min(4).max(20),
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
    const r = await finishFirebaseSessionWithCode(body.idToken, body.challengeId, body.code, { remember: body.remember, ip });
    switch (r.kind) {
      case "ok":
        return json({ ok: true, next: safeNextPath(body.next) });
      case "wrong":
        return json({ ok: false, error: "wrong", message: "That code isn't right. Check the latest email and try again." }, 401);
      case "too_many":
        return json({ ok: false, error: "too_many", message: "That code has been tried too many times. Send yourself a new one." }, 401);
      case "expired":
        return json({ ok: false, error: "expired", message: "That code has expired. Send yourself a new one." }, 401);
      case "stale":
        return json({ ok: false, error: "stale", message: "That took a little too long. Please sign in again." }, 401);
      case "not_staff":
        return json({ ok: false, error: "not_staff", message: "This account can't sign in to Haven. Please use the invitation you were sent." }, 401);
      default:
        return json({ ok: false, error: "invalid", message: "That sign-in didn't work. Please try again." }, 401);
    }
  } catch (err) {
    log.error("auth.code_route_failed", { err });
    return json({ ok: false, error: "server", message: "Something went wrong. Please try again." }, 500);
  }
}
