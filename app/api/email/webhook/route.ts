import { Resend } from "resend";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { applyDeliveryEvent, type DeliveryEvent } from "@/lib/server/email/suppressions";

// POST /api/email/webhook (integrations §4.3, optional): Resend delivery events, verified with
// RESEND_WEBHOOK_SECRET (Svix signature headers) on the raw body. Without the secret it answers 503.
// Logs carry the event type only.

export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const secret = env.email.resendWebhookSecret;
  if (!secret) return new Response("Email delivery events are not configured.", { status: 503, headers: NO_STORE });
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return new Response("Missing signature.", { status: 400, headers: NO_STORE });
  const payload = await request.text();

  let evt: DeliveryEvent;
  try {
    // Verifying needs no API key; the client is only the SDK's entry point.
    evt = new Resend(env.email.resendKey ?? "re_verify_only").webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret }) as unknown as DeliveryEvent;
  } catch {
    return new Response("Invalid signature.", { status: 400, headers: NO_STORE });
  }

  try {
    const result = await applyDeliveryEvent(evt);
    log.info("email.webhook", { type: evt.type, result });
    return Response.json({ received: true, result }, { headers: NO_STORE });
  } catch (err) {
    log.error("email.webhook_failed", { type: evt.type, err });
    return new Response("Retry later.", { status: 500, headers: NO_STORE });
  }
}
