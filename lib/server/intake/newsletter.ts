import "server-only";

// Newsletter double opt-in (PLAN D103, data-model §4.4, public-pages §3.23).
//
//   subscribeNewsletter: runIntake (backend → honeypot + time trap → 5/hour per IP hash → zod), then a
//     second limit of 3 confirmation emails per address per day. One transaction writes
//     newsletterSubscribers/{emailHash} as `pending` with a hash of a signed 7-day token and queues
//     `newsletter_confirm`. Someone already confirmed gets the same answer and no email, so the form
//     never reveals who is subscribed.
//   confirmNewsletter: the link in that email. pending → confirmed; an unsubscribe suppression for the
//     address is lifted (they asked again, and confirmed).
//   unsubscribeByToken / resubscribeByToken: /unsubscribe?token= (the `unsubscribe` purpose, no expiry,
//     sub = emailHash, the same link donor updates carry). Unsubscribing writes an `unsubscribe`
//     suppression, which only stops update emails; receipts and replies still arrive. Undo lifts it.
// Links are never single-use (mail scanners prefetch them), so every outcome is idempotent.

import type { FormState } from "@/lib/forms/types";
import type { NewsletterSubscriber } from "@/lib/model/domain/engagement";
import type { EmailSuppression } from "@/lib/model/domain/system";
import { routes } from "@/lib/routes";
import { emailLowerOf } from "@/lib/schemas/common";
import { newsletterSchema, type NewsletterField } from "@/lib/schemas/forms/newsletter";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { BackendUnavailableError } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { consentStamp, runIntake } from "@/lib/server/intake/pipeline";
import { log } from "@/lib/server/log";
import { emailHash, sha256Hex, signToken, signTokenFor, tokensAvailable, verifyToken } from "@/lib/server/security/hmac";
import { rateLimit } from "@/lib/server/security/ratelimit";
import { absolute } from "@/lib/server/url";

const DAY = 24 * 60 * 60 * 1000;
/** The confirmation link works for 7 days (D103). */
export const NEWSLETTER_CONFIRM_TTL_MS = 7 * DAY;

const SENT_TITLE = "Check Your Inbox";
const sentMessage = (email: string) =>
  `We've sent a confirmation link to ${email}. Open it within 7 days to start receiving our updates. If it doesn't arrive, check your spam folder.`;
const NO_TOKENS_MESSAGE = "Sign-ups are paused for a moment. Please try again later.";

/* ── Subscribe ─────────────────────────────────────────────────────────── */

/** The landing, footer and post sign-up forms. Success carries a title and message, never a reference. */
export async function subscribeNewsletter(input: FormData | Record<string, unknown>, request?: Request): Promise<FormState<NewsletterField>> {
  return runIntake({
    form: "newsletter",
    input,
    request,
    schema: newsletterSchema,
    echoKeys: ["email", "firstName"],
    isOpen: async () => tokensAvailable() || NO_TOKENS_MESSAGE,
    fakeSuccess: () => ({ status: "success", title: SENT_TITLE, message: sentMessage("your address") }),
    create: async (d) => {
      const emailLower = emailLowerOf(d.email);
      const id = emailHash(emailLower);
      const sent = { title: SENT_TITLE, message: sentMessage(d.email) };

      const perAddress = await rateLimit("newsletter_address", id);
      if (!perAddress.ok) return sent;

      const path = docPath("newsletterSubscribers", id);
      const token = signTokenFor("newsletter_confirm", id, NEWSLETTER_CONFIRM_TTL_MS);
      await getStore().runTransaction(async (tx) => {
        const now = Date.now();
        const existing = await tx.get<NewsletterSubscriber>(path);
        if (existing?.status === "confirmed") return;
        const doc: NewsletterSubscriber = {
          email: d.email,
          emailLower,
          firstName: d.firstName ?? existing?.firstName ?? null,
          status: "pending",
          source: d.source,
          interests: existing?.interests ?? [],
          consent: consentStamp(now),
          confirmTokenHash: sha256Hex(token),
          confirmedAt: existing?.confirmedAt ?? null,
          unsubscribedAt: existing?.unsubscribedAt ?? null,
          retention: { policy: "newsletter.unconfirmed", retainUntil: null, legalHold: false },
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          version: (existing?.version ?? 0) + 1,
        };
        await enqueueEmailTx(tx, {
          template: "newsletter_confirm",
          to: [d.email],
          vars: { ...(d.firstName ? { firstName: d.firstName } : {}), link: absolute(routes.newsletterConfirm(token)) },
          dedupeKey: `${id}~${now}`,
        });
        tx.set(path, doc);
      });
      return sent;
    },
  }) as Promise<FormState<NewsletterField>>;
}

/* ── Confirm ───────────────────────────────────────────────────────────── */

export type ConfirmOutcome =
  | { state: "confirmed"; firstName: string | null }
  | { state: "already"; firstName: string | null }
  | { state: "expired" }
  | { state: "unavailable" };

/** Confirms a sign-up from its email link. Never throws. */
export async function confirmNewsletter(token: string | null | undefined): Promise<ConfirmOutcome> {
  const claim = verifyToken(token, "newsletter_confirm");
  if (!claim || !token) return { state: "expired" };
  const path = docPath("newsletterSubscribers", claim.sub);
  try {
    return await getStore().runTransaction(async (tx): Promise<ConfirmOutcome> => {
      const now = Date.now();
      const sub = await tx.get<NewsletterSubscriber>(path);
      const suppression = await tx.get<EmailSuppression>(docPath("emailSuppressions", claim.sub));
      if (!sub) return { state: "expired" };
      if (sub.status === "confirmed") return { state: "already", firstName: sub.firstName };
      if (sub.status !== "pending" || sub.confirmTokenHash !== sha256Hex(token)) return { state: "expired" };
      tx.update(path, {
        status: "confirmed",
        confirmedAt: now,
        confirmTokenHash: null,
        unsubscribedAt: null,
        retention: { policy: "newsletter.unsubscribed", retainUntil: null, legalHold: false },
        updatedAt: now,
        version: sub.version + 1,
      });
      if (suppression?.reason === "unsubscribe") tx.delete(docPath("emailSuppressions", claim.sub));
      return { state: "confirmed", firstName: sub.firstName };
    });
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) log.error("newsletter.confirm_failed", { err });
    return { state: "unavailable" };
  }
}

/* ── Unsubscribe and undo ──────────────────────────────────────────────── */

/** The never-expiring unsubscribe link for an address (newsletter and donor updates). */
export function unsubscribeUrlFor(email: string): string {
  return absolute(routes.unsubscribe(signToken({ p: "unsubscribe", sub: emailHash(email), exp: null })));
}

export type UnsubscribeOutcome = { state: "unsubscribed" | "resubscribed" } | { state: "expired" } | { state: "unavailable" };

/** /unsubscribe?token=: stops update emails for the address. Idempotent; never throws. */
export async function unsubscribeByToken(token: string | null | undefined): Promise<UnsubscribeOutcome> {
  const claim = verifyToken(token, "unsubscribe");
  if (!claim) return { state: "expired" };
  const subPath = docPath("newsletterSubscribers", claim.sub);
  const supPath = docPath("emailSuppressions", claim.sub);
  try {
    await getStore().runTransaction(async (tx) => {
      const now = Date.now();
      const sub = await tx.get<NewsletterSubscriber>(subPath);
      const suppression = await tx.get<EmailSuppression>(supPath);
      if (sub && sub.status !== "unsubscribed") {
        tx.update(subPath, {
          status: "unsubscribed",
          unsubscribedAt: now,
          confirmTokenHash: null,
          retention: { policy: "newsletter.unsubscribed", retainUntil: null, legalHold: false },
          updatedAt: now,
          version: sub.version + 1,
        });
      }
      // A bounce or complaint already stops everything; leave it in place.
      if (!suppression) tx.set(supPath, { reason: "unsubscribe", at: now, source: "unsubscribe_link" } satisfies EmailSuppression);
    });
    return { state: "unsubscribed" };
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) log.error("newsletter.unsubscribe_failed", { err });
    return { state: "unavailable" };
  }
}

/** The Undo button on /unsubscribe: lifts the unsubscribe and restores a confirmed subscription. */
export async function resubscribeByToken(token: string | null | undefined): Promise<UnsubscribeOutcome> {
  const claim = verifyToken(token, "unsubscribe");
  if (!claim) return { state: "expired" };
  const subPath = docPath("newsletterSubscribers", claim.sub);
  const supPath = docPath("emailSuppressions", claim.sub);
  try {
    await getStore().runTransaction(async (tx) => {
      const now = Date.now();
      const sub = await tx.get<NewsletterSubscriber>(subPath);
      const suppression = await tx.get<EmailSuppression>(supPath);
      // Only someone who had confirmed goes straight back on the list; the rest stay as they were.
      if (sub && sub.status === "unsubscribed" && sub.confirmedAt && sub.email) {
        tx.update(subPath, { status: "confirmed", unsubscribedAt: null, updatedAt: now, version: sub.version + 1 });
      }
      if (suppression?.reason === "unsubscribe") tx.delete(supPath);
    });
    return { state: "resubscribed" };
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) log.error("newsletter.resubscribe_failed", { err });
    return { state: "unavailable" };
  }
}
