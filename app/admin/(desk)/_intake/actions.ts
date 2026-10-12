"use server";

// Quick actions that log something from a call or visit (admin-ux §3.4): a support request or a
// safeguarding concern, through the same checks as the website forms (lib/server/intake).

import { requireStaff } from "@/lib/server/auth/session";
import { drainAfterResponse } from "@/lib/server/email/outbox";
import { logConcernByStaff } from "@/lib/server/intake/concern";
import { logSupportByStaff } from "@/lib/server/intake/support";

export async function logRequestAction(input: Record<string, unknown>) {
  const v = await requireStaff("support.manage", "concern.manage");
  const r = await logSupportByStaff(v, input && typeof input === "object" ? input : {});
  if (r.ok) drainAfterResponse();
  return r;
}

export async function logConcernAction(input: Record<string, unknown>) {
  const v = await requireStaff("concern.manage");
  const r = await logConcernByStaff(v, input && typeof input === "object" ? input : {});
  if (r.ok) drainAfterResponse();
  return r;
}
