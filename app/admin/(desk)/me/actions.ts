"use server";

// Me (admin-ux §6.17): one's own profile, email preferences, password and devices. Everyone signed in.

import { refresh } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import { listStaffSessions, requireStaff, revokeStaffSession } from "@/lib/server/auth/session";
import { changeMyPassword, updateMe, type MeInput } from "@/lib/server/dal/staff";

export async function saveMeAction(input: MeInput): Promise<ActionResult<{ version: number }>> {
  const r = await updateMe({
    name: String(input.name ?? ""),
    timezone: String(input.timezone ?? ""),
    textSize: input.textSize === "large" ? "large" : "normal",
    prefs: input.prefs && typeof input.prefs === "object" ? input.prefs : {},
  });
  if (r.ok) refresh();
  return r;
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult<{ version: number }>> {
  return changeMyPassword(String(current ?? ""), String(next ?? ""));
}

export async function signOutDeviceAction(sessionId: string): Promise<ActionResult<{ count: number }>> {
  const v = await requireStaff();
  if (typeof sessionId !== "string" || sessionId.length > 200) return actionError({ kind: "not_allowed", message: "That device isn't signed in." });
  const ok = await revokeStaffSession(v.uid, sessionId);
  if (!ok) return actionError({ kind: "not_allowed", message: "That device isn't signed in." });
  refresh();
  return actionOk({ count: 1 });
}

/** Signs out every other device; this one stays signed in. */
export async function signOutOthersAction(): Promise<ActionResult<{ count: number }>> {
  const v = await requireStaff();
  const sessions = await listStaffSessions(v.uid);
  let count = 0;
  for (const s of sessions) if (!s.current && (await revokeStaffSession(v.uid, s.id))) count++;
  refresh();
  return actionOk({ count });
}
