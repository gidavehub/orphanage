"use server";

// Settings › Connections › Card payments Server Actions. Saving or removing the keys expires the card
// setup's tag, so /donate and every status card pick up the change on the next request.

import { refresh, updateTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { requireStaff } from "@/lib/server/auth/session";
import { cancelKeyLink, removeStripeKeys, saveStripeKeys, sendKeyLinks, type StripeKeysInput, type StripeKeysSaved } from "@/lib/server/dal/stripeKeys";

export async function saveStripeKeysAction(input: StripeKeysInput): Promise<ActionResult<StripeKeysSaved>> {
  const v = await requireStaff("settings.manage");
  const r = await saveStripeKeys(v, input && typeof input === "object" ? input : {}, { via: "settings" });
  if (r.ok) {
    updateTag(TAG.settings("stripe"));
    refresh();
  }
  return r;
}

export async function removeStripeKeysAction(): Promise<ActionResult<{ at: Millis }>> {
  const v = await requireStaff("settings.manage");
  const r = await removeStripeKeys(v);
  if (r.ok) {
    updateTag(TAG.settings("stripe"));
    refresh();
  }
  return r;
}

export async function sendKeyLinksAction(uids: string[]): Promise<ActionResult<{ sent: number }>> {
  const v = await requireStaff("settings.manage");
  const r = await sendKeyLinks(v, uids);
  if (r.ok) refresh();
  return r;
}

export async function cancelKeyLinkAction(id: string): Promise<ActionResult<{ id: string }>> {
  const v = await requireStaff("settings.manage");
  const r = await cancelKeyLink(v, typeof id === "string" ? id : "");
  if (r.ok) refresh();
  return r;
}
