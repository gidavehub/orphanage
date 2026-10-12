"use server";

// Settings › Giving Server Actions (PLAN D63, D131). settings/payment is a system doc: saving expires
// its public tag so /donate picks up the routes, limits and instructions on the next request.

import { refresh, updateTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { savePaymentSettings } from "@/lib/server/dal/paymentSettings";

export async function savePaymentSettingsAction(input: unknown): Promise<ActionResult<{ at: Millis }>> {
  const r = await savePaymentSettings(input);
  if (r.ok) {
    updateTag(TAG.settings("payment"));
    refresh();
  }
  return r;
}
