"use server";

// The secure-link save (/admin/keys/<token>). The link must still work and belong to the signed-in
// super admin; then it's the same checked save as Settings › Connections › Card payments.

import { updateTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import { actionError, type ActionResult } from "@/lib/forms/types";
import { getViewer } from "@/lib/server/auth/session";
import { peekKeyLink, saveStripeKeys, type StripeKeysInput, type StripeKeysSaved } from "@/lib/server/dal/stripeKeys";

export async function saveKeysViaLinkAction(token: string, input: StripeKeysInput): Promise<ActionResult<StripeKeysSaved>> {
  const link = await peekKeyLink(typeof token === "string" ? token : "");
  if (!link) return actionError({ kind: "not_allowed", message: "This link has stopped working. Ask for a new one." });
  const v = await getViewer();
  if (!v || v.uid !== link.recipientUid) return actionError({ kind: "not_allowed", message: `This link is for ${link.recipientName}. Sign in as them to use it.` });
  const r = await saveStripeKeys(v, input && typeof input === "object" ? input : {}, { via: "link", linkId: link.id });
  if (r.ok) updateTag(TAG.settings("stripe"));
  return r;
}
