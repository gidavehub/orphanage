import "server-only";

// Resend transport (integrations §4.1–4.3). One message per outbox record, sent with the outbox id as
// the idempotency key, so a retried drain can never double-send. Mail due more than 2 minutes and at
// most 30 days ahead is handed to Resend's scheduler (`scheduledAt`); later than that it stays queued
// ("deferred") and a later tick hands it off. Redirect mode sends every message to EMAIL_REDIRECT_TO
// instead (the renderer already added the sand "Test copy" banner naming the real recipients).
// 429 and 5xx (and network errors) → "retry" with backoff; validation and other 4xx → "failed".

import { Resend } from "resend";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import type { OutgoingEmail, TransportResult } from "../provider";

const DAY = 86_400_000;
const SCHEDULE_MIN_AHEAD = 2 * 60_000;
const SCHEDULE_MAX_AHEAD = 30 * DAY;

const G = globalThis as typeof globalThis & { __havenResend?: { key: string; client: Resend } };

function client(): Resend | null {
  const key = env.email.resendKey;
  if (!key) return null;
  if (G.__havenResend?.key === key) return G.__havenResend.client;
  const c = new Resend(key);
  G.__havenResend = { key, client: c };
  return c;
}

const RETRY_NAMES = new Set(["rate_limit_exceeded", "application_error", "internal_server_error", "concurrent_idempotent_requests", "daily_quota_exceeded", "monthly_quota_exceeded"]);

function classify(error: { name?: string; message?: string; statusCode?: number | null }): TransportResult {
  const status = error.statusCode ?? 0;
  const message = `${error.name ?? "error"}: ${error.message ?? ""}`.slice(0, 300);
  if (status === 429 || status >= 500 || status === 0 || RETRY_NAMES.has(error.name ?? "")) return { kind: "retry", error: message };
  return { kind: "failed", error: message };
}

/** Sends (or schedules) one message through Resend. */
export async function sendViaResend(msg: OutgoingEmail, mode: "resend" | "redirect"): Promise<TransportResult> {
  const resend = client();
  if (!resend) return { kind: "failed", error: "RESEND_API_KEY is not set." };
  const to = mode === "redirect" ? [env.email.redirectTo ?? ""] : msg.to;
  if (!to.length || !to[0]) return { kind: "failed", error: "No recipient (EMAIL_REDIRECT_TO is empty in redirect mode)." };

  const ahead = msg.scheduledFor - Date.now();
  if (ahead > SCHEDULE_MAX_AHEAD) return { kind: "deferred", until: msg.scheduledFor - SCHEDULE_MAX_AHEAD + DAY };
  const scheduledAt = ahead > SCHEDULE_MIN_AHEAD ? new Date(msg.scheduledFor).toISOString() : undefined;

  try {
    const { data, error } = await resend.emails.send(
      {
        from: msg.from,
        to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
        ...(Object.keys(msg.headers).length ? { headers: msg.headers } : {}),
        ...(msg.attachments.length ? { attachments: msg.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) } : {}),
        ...(scheduledAt ? { scheduledAt } : {}),
        tags: [{ name: "template", value: msg.template.replace(/[^A-Za-z0-9_-]/g, "_") }],
      },
      { idempotencyKey: msg.id.slice(0, 256) },
    );
    if (error) {
      const out = classify(error);
      log.warn("email.resend_error", { id: msg.id, name: error.name, status: error.statusCode, result: out.kind });
      return out;
    }
    const provider = mode === "redirect" ? "redirect" : "resend";
    if (scheduledAt && data?.id) return { kind: "scheduled", provider, providerMessageId: data.id };
    return { kind: "sent", provider, providerMessageId: data?.id ?? null };
  } catch (err) {
    log.warn("email.resend_unreachable", { id: msg.id, err });
    return { kind: "retry", error: err instanceof Error ? err.message.slice(0, 300) : "Resend could not be reached." };
  }
}

/** Cancels a scheduled Resend email. "already_sent" when it went out before the cancel arrived. */
export async function cancelViaResend(providerMessageId: string): Promise<"cancelled" | "already_sent" | "unknown"> {
  const resend = client();
  if (!resend || !providerMessageId) return "unknown";
  try {
    const { error } = await resend.emails.cancel(providerMessageId);
    if (!error) return "cancelled";
    if (/already|sent|delivered/i.test(error.message ?? "")) return "already_sent";
    log.warn("email.resend_cancel_failed", { name: error.name });
    return "unknown";
  } catch (err) {
    log.warn("email.resend_cancel_unreachable", { err });
    return "unknown";
  }
}

/** The Resend client for the delivery webhook's signature check (null without a key). */
export function resendClient(): Resend | null {
  return client();
}
