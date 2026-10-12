import "server-only";

// Team invitations (admin-ux §6.14; PLAN D88). A super admin invites someone by name, email and role;
// they get `staff_invite` with /admin/invite/<token> (72 hours). The token is never stored: the record
// lives at invitations/{sha256(token)}. Accepting sets a password, creates the account and the staff
// profile, and signs them in. Resending issues a fresh link (the old one stops working).

import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { Invitation } from "@/lib/model/domain/staff";
import type { Millis, Uid } from "@/lib/model/enums";
import { ROLES, VIEWER_SCOPES, type Role, type ViewerScope } from "@/lib/model/permissions";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { createLocalAccount, findLocalAccountByEmail } from "@/lib/server/auth/local";
import { checkPasswordPolicy } from "@/lib/server/auth/password";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { randomToken, sha256Hex } from "@/lib/server/security/hmac";
import { absolute } from "@/lib/server/url";

const TTL = 72 * 3_600_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteInput = { displayName: string; email: string; roles: string[]; viewerScopes?: string[] };

function clean(input: InviteInput): { ok: true; v: { displayName: string; email: string; roles: Role[]; viewerScopes: ViewerScope[] } } | { ok: false; fields: Record<string, string> } {
  const f: Record<string, string> = {};
  const displayName = input.displayName.trim().replace(/\s+/g, " ");
  const email = input.email.trim();
  const roles = [...new Set(input.roles)].filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  const viewerScopes = [...new Set(input.viewerScopes ?? [])].filter((s): s is ViewerScope => (VIEWER_SCOPES as readonly string[]).includes(s));
  if (displayName.length < 2 || displayName.length > 80) f.displayName = "Please give their name.";
  if (!EMAIL_RE.test(email) || email.length > 254) f.email = "Please give their email address.";
  if (!roles.length) f.roles = "Choose what they'll do here.";
  if (roles.includes("viewer") && !viewerScopes.length) f.viewerScopes = "Choose what they can look at.";
  return Object.keys(f).length ? { ok: false, fields: f } : { ok: true, v: { displayName, email, roles, viewerScopes } };
}

/** Roles that open children's or the whole organisation's data: the invite asks for a fresh sign-in. */
export const STEP_UP_ROLES: readonly Role[] = ["super_admin", "safeguarding_officer"];

export async function createInvitation(v: Viewer, input: InviteInput): Promise<ActionResult<{ id: string }>> {
  const c = clean(input);
  if (!c.ok) return actionError({ kind: "validation", fields: c.fields });
  const emailLower = c.v.email.toLowerCase();
  const existing = await getStore().list<{ emailLower: string; status: string }>(C.staff, { where: [{ field: "status", op: "==", value: "active" }], orderBy: { field: "displayName", dir: "asc" }, limit: 100 });
  if (existing.items.some((s) => s.emailLower === emailLower) || (resolveBackend() === "local" && (await findLocalAccountByEmail(emailLower)))) {
    return actionError({ kind: "validation", fields: { email: "Someone on the team already uses this email." } });
  }
  const token = randomToken(32);
  const id = sha256Hex(token);
  const now = Date.now();
  try {
    await getStore().runTransaction(async (tx) => {
      const doc: Invitation = { ...c.v, email: c.v.email, emailLower, invitedBy: v.uid, createdAt: now, expiresAt: now + TTL, acceptedAt: null, revokedAt: null, createdUid: null, expireAt: now + 30 * 86_400_000 };
      tx.create(docPath("invitations", id), doc);
      await enqueueEmailTx(tx, {
        template: "staff_invite",
        to: [c.v.email],
        vars: { firstName: c.v.displayName.split(" ")[0] ?? "", link: absolute(`/admin/invite/${token}`) },
        dedupeKey: `invite~${id.slice(0, 24)}`,
      });
      auditTx(tx, { actor: actorOf(v), action: "staff.invite", area: "staff", summary: `${v.displayName} invited ${c.v.displayName} (${c.v.roles.join(", ")})`, feed: true, sensitive: true, targetPath: docPath("invitations", id) });
    });
    return actionOk({ id });
  } catch (err) {
    log.error("auth.invite_failed", { err });
    return actionError({ kind: "unavailable", message: "The invitation didn't send. Please try again." });
  }
}

export type PendingInviteDTO = { id: string; displayName: string; email: string; roles: Role[]; createdAt: Millis; expiresAt: Millis; expired: boolean };

export async function listPendingInvitations(): Promise<PendingInviteDTO[]> {
  const out: Array<WithId<Invitation>> = [];
  try {
    const page = await getStore().list<Invitation>(C.invitations, { orderBy: { field: "createdAt", dir: "desc" }, limit: 100 });
    out.push(...page.items);
  } catch (err) {
    log.warn("auth.invites_list_failed", { err });
  }
  const now = Date.now();
  return out
    .filter((i) => !i.acceptedAt && !i.revokedAt)
    .map((i) => ({ id: i.id, displayName: i.displayName, email: i.email, roles: i.roles, createdAt: i.createdAt, expiresAt: i.expiresAt, expired: i.expiresAt <= now }));
}

export async function revokeInvitation(v: Viewer, id: string): Promise<ActionResult<{ id: string }>> {
  if (!/^[a-f0-9]{64}$/.test(id)) return actionError({ kind: "not_allowed", message: "That invitation doesn't exist." });
  const done = await getStore().runTransaction(async (tx) => {
    const inv = await tx.get<Invitation>(docPath("invitations", id));
    if (!inv || inv.acceptedAt || inv.revokedAt) return false;
    tx.update(docPath("invitations", id), { revokedAt: Date.now() });
    auditTx(tx, { actor: actorOf(v), action: "staff.invite_revoke", area: "staff", summary: `${v.displayName} cancelled the invitation for ${inv.displayName}`, feed: true, targetPath: docPath("invitations", id) });
    return true;
  });
  return done ? actionOk({ id }) : actionError({ kind: "not_allowed", message: "That invitation was already used or cancelled." });
}

/** A fresh link for the same person (the old link stops working). */
export async function resendInvitation(v: Viewer, id: string): Promise<ActionResult<{ id: string }>> {
  const inv = /^[a-f0-9]{64}$/.test(id) ? await getStore().get<Invitation>(docPath("invitations", id)) : null;
  if (!inv || inv.acceptedAt) return actionError({ kind: "not_allowed", message: "That invitation was already used." });
  await revokeInvitation(v, id);
  return createInvitation(v, { displayName: inv.displayName, email: inv.email, roles: inv.roles, viewerScopes: inv.viewerScopes });
}

/** The invitation behind a link, if it can still be accepted. */
export async function peekInvitation(token: string): Promise<{ displayName: string; email: string; roles: Role[] } | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const inv = await getStore().get<Invitation>(docPath("invitations", sha256Hex(token)));
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= Date.now()) return null;
  return { displayName: inv.displayName, email: inv.email, roles: inv.roles };
}

/** Accepts an invitation with a new password (practice mode creates the local account). */
export async function acceptInvitation(token: string, password: string): Promise<{ ok: true; uid: Uid } | { ok: false; message: string; field?: string }> {
  const id = sha256Hex(token);
  const inv = await getStore().get<Invitation>(docPath("invitations", id));
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= Date.now()) return { ok: false, message: "This invitation has expired or was already used. Ask your super admin for a new one." };
  const problem = checkPasswordPolicy(password, { email: inv.email, name: inv.displayName });
  if (problem) return { ok: false, message: problem, field: "password" };
  if (resolveBackend() !== "local") return { ok: false, message: "Accounts are created through Haven's sign-in service. Ask your super admin to finish setting you up." };
  let uid: Uid;
  try {
    uid = await createLocalAccount({ email: inv.email, displayName: inv.displayName, roles: inv.roles, viewerScopes: inv.viewerScopes, invitedBy: inv.invitedBy, password, authProvider: "local" });
  } catch (err) {
    log.warn("auth.accept_failed", { err });
    return { ok: false, message: "An account with this email already exists. Try signing in instead." };
  }
  await getStore().runTransaction(async (tx) => {
    tx.update(docPath("invitations", id), { acceptedAt: Date.now(), createdUid: uid });
    auditTx(tx, { actor: { kind: "staff", uid, name: inv.displayName, roles: inv.roles }, action: "staff.invite_accept", area: "staff", summary: `${inv.displayName} accepted their invitation`, feed: true, sensitive: true, targetPath: docPath("staff", uid) });
  });
  return { ok: true, uid };
}
