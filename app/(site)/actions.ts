"use server";

// Site-wide Server Actions (PLAN D22). `subscribe` is the newsletter sign-up used by the landing
// JoinSphere, the footer and post pages (double opt-in, D103): runIntake → newsletterSubscribers
// (`pending`) + the `newsletter_confirm` email held in the Outbox. `undoUnsubscribe` is the Undo
// button on /unsubscribe.

import { formDataOf, type FormState } from "@/lib/forms/types";
import { resubscribeByToken, subscribeNewsletter, type UnsubscribeOutcome } from "@/lib/server/intake/newsletter";

export async function subscribe(prev: FormState, formData: FormData): Promise<FormState> {
  void prev;
  return subscribeNewsletter(formData);
}

export async function undoUnsubscribe(prev: UnsubscribeOutcome | null, formData: FormData): Promise<UnsubscribeOutcome> {
  void prev;
  const token = formDataOf(formData).get("token");
  return resubscribeByToken(typeof token === "string" ? token : null);
}
