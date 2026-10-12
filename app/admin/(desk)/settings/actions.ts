"use server";

// Settings Server Actions (admin-ux §6.16). The DAL checks settings.manage / privacy.manage. Completing
// or rejecting a privacy request asks for a sign-in within the last 30 minutes (PLAN D87).

import { refresh } from "next/cache";
import { actionError, type ActionResult } from "@/lib/forms/types";
import type { RetentionPolicySetting } from "@/lib/model/domain/settings";
import type { Millis } from "@/lib/model/enums";
import { STEP_UP_MS } from "@/lib/model/session";
import { requireStaff } from "@/lib/server/auth/session";
import { moveDataRequest, saveRetention, sendTestEmail } from "@/lib/server/dal/settings";

const EDGE = /^(start|complete|reject)$/;

export async function sendTestEmailAction(): Promise<ActionResult<{ id: string; mode: string }>> {
  return sendTestEmail();
}

export async function saveRetentionAction(changes: Record<string, RetentionPolicySetting>, baseUpdatedAt: Millis | null): Promise<ActionResult<{ updatedAt: Millis }>> {
  const r = await saveRetention(changes && typeof changes === "object" ? changes : {}, typeof baseUpdatedAt === "number" ? baseUpdatedAt : null);
  if (r.ok) refresh();
  return r;
}

export async function moveDataRequestAction(ref: string, edgeId: string, version: number, input: { note?: string; reason?: string } = {}): Promise<ActionResult<{ version: number; at: Millis; status: string }>> {
  if (!EDGE.test(edgeId)) return actionError({ kind: "not_allowed", message: "That step isn't available." });
  const v = await requireStaff("privacy.manage");
  if (edgeId !== "start" && Date.now() - v.authTime > STEP_UP_MS) return actionError({ kind: "forbidden", message: "Please confirm it's you first.", paths: ["step-up"] });
  const r = await moveDataRequest(ref, edgeId, version, input);
  if (r.ok) refresh();
  return r;
}
