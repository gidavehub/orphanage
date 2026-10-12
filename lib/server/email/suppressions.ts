import "server-only";

// Delivery events from Resend (integrations §4.3): delivered and delayed update the outbox record;
// bounced and complained also stop all future mail to that address (emailSuppressions/{emailHash}),
// and the record shows "Didn't send: address bounced" to staff. Unsubscribes are written by the
// newsletter flow with reason "unsubscribe" (they stop updates only).

import type { EmailSuppression, OutboxEmail } from "@/lib/model/domain/system";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";
import { emailHash } from "@/lib/server/security/hmac";

export type DeliveryEvent = { type: string; data: { email_id?: string; to?: string[] | string } };

const STATE: Record<string, OutboxEmail["deliveryState"]> = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

/** Stops all future email to an address (bounces and complaints). */
export async function suppressAddress(email: string, reason: EmailSuppression["reason"], source: string): Promise<void> {
  const addr = email.trim().toLowerCase();
  if (!addr.includes("@")) return;
  await getStore().set(docPath("emailSuppressions", emailHash(addr)), { reason, at: Date.now(), source } satisfies EmailSuppression);
}

/** Applies one delivery event. Returns what it did (for the route's log line). */
export async function applyDeliveryEvent(evt: DeliveryEvent): Promise<"updated" | "ignored"> {
  const state = STATE[evt.type];
  const messageId = evt.data?.email_id;
  if (!state || !messageId) return "ignored";
  const store = getStore();
  const page = await store.list<OutboxEmail>(C.emailOutbox, { where: [{ field: "providerMessageId", op: "==", value: messageId }], orderBy: { field: "providerMessageId", dir: "asc" }, limit: 1 });
  const rec = page.items[0];
  if (rec) {
    await store.update(docPath("emailOutbox", rec.id), {
      deliveryState: state,
      ...(state === "bounced" ? { lastError: "Didn't send: address bounced" } : state === "complained" ? { lastError: "The person marked this email as spam" } : {}),
    });
  }
  if (state === "bounced" || state === "complained") {
    const to = Array.isArray(evt.data.to) ? evt.data.to : evt.data.to ? [evt.data.to] : (rec?.to ?? []);
    for (const addr of to) await suppressAddress(addr, state === "bounced" ? "bounce" : "complaint", "resend-webhook").catch((err) => log.warn("email.suppress_failed", { err }));
  }
  return rec ? "updated" : "ignored";
}
