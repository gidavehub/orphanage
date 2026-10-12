"use server";

// Team & roles Server Actions (admin-ux §6.14; PLAN D87, D88). Super admins only (staff.manage). Changing
// someone's access, pausing them, resetting their code or inviting a super admin or safeguarding
// officer asks for a sign-in within the last 30 minutes: the client then sends them to /admin/confirm.

import { refresh } from "next/cache";
import { actionError, type ActionResult } from "@/lib/forms/types";
import { STEP_UP_MS } from "@/lib/model/session";
import type { Viewer } from "@/lib/model/viewer";
import { createInvitation, resendInvitation, revokeInvitation, STEP_UP_ROLES, type InviteInput } from "@/lib/server/auth/invitations";
import { requireStaff } from "@/lib/server/auth/session";
import { resetSignInCode, setRoles, setStaffStatus } from "@/lib/server/dal/staff";
import { drainAfterResponse } from "@/lib/server/email/outbox";

const UID = /^[A-Za-z0-9_-]{6,128}$/;
const INVITE = /^[a-f0-9]{64}$/;

/** `paths: ["step-up"]` tells the client to send the person to /admin/confirm and back. */
function stepUp(v: Viewer): ActionResult<never> | null {
  return Date.now() - v.authTime > STEP_UP_MS ? actionError({ kind: "forbidden", message: "Please confirm it's you first.", paths: ["step-up"] }) : null;
}

function settle<T>(r: ActionResult<T>, mail = false): ActionResult<T> {
  if (r.ok) {
    if (mail) drainAfterResponse();
    refresh();
  }
  return r;
}

export async function inviteAction(input: InviteInput): Promise<ActionResult<{ id: string }>> {
  const v = await requireStaff("staff.manage");
  if (input.roles.some((r) => (STEP_UP_ROLES as readonly string[]).includes(r))) {
    const s = stepUp(v);
    if (s) return s;
  }
  return settle(await createInvitation(v, { displayName: String(input.displayName ?? ""), email: String(input.email ?? ""), roles: Array.isArray(input.roles) ? input.roles.map(String) : [], viewerScopes: Array.isArray(input.viewerScopes) ? input.viewerScopes.map(String) : [] }), true);
}

export async function resendInviteAction(id: string): Promise<ActionResult<{ id: string }>> {
  const v = await requireStaff("staff.manage");
  if (!INVITE.test(id)) return actionError({ kind: "not_allowed", message: "That invitation doesn't exist." });
  return settle(await resendInvitation(v, id), true);
}

export async function revokeInviteAction(id: string): Promise<ActionResult<{ id: string }>> {
  const v = await requireStaff("staff.manage");
  return settle(await revokeInvitation(v, id));
}

export async function setRolesAction(uid: string, roles: string[], viewerScopes: string[]): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("staff.manage");
  if (!UID.test(uid)) return actionError({ kind: "not_allowed", message: "That person isn't on the team." });
  const s = stepUp(v);
  if (s) return s;
  return settle(await setRoles(v, uid, roles.map(String), viewerScopes.map(String)), true);
}

export async function setStatusAction(uid: string, status: "active" | "suspended" | "deactivated"): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("staff.manage");
  if (!UID.test(uid) || !["active", "suspended", "deactivated"].includes(status)) return actionError({ kind: "not_allowed", message: "That isn't possible." });
  const s = stepUp(v);
  if (s) return s;
  return settle(await setStaffStatus(v, uid, status), true);
}

export async function resetCodeAction(uid: string): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff("staff.manage");
  if (!UID.test(uid)) return actionError({ kind: "not_allowed", message: "That person isn't on the team." });
  const s = stepUp(v);
  if (s) return s;
  return settle(await resetSignInCode(v, uid), true);
}
