import "server-only";

// Team & roles and Me (admin-ux §6.14, §6.17; PLAN D88, D91, D92). Super admins see the team, change
// roles, pause or deactivate (never delete: history stays for the audit) and reset sign-in codes.
// Every change is logged, and the last active super admin can't be removed or paused. Me edits one's
// own name, timezone, text size, email preferences and password, and lists one's devices.

import { AREAS, canSeeArea, placeFor } from "@/lib/admin/access";
import { actionError, actionOk, type ActionResult } from "@/lib/forms/types";
import type { NotificationDelivery, NotificationTopic, StaffProfile } from "@/lib/model/domain/staff";
import type { Millis, Uid } from "@/lib/model/enums";
import { ROLE_LABEL } from "@/lib/model/labels";
import { permsFor, ROLES, VIEWER_SCOPES, type Role, type ViewerScope } from "@/lib/model/permissions";
import type { Viewer } from "@/lib/model/viewer";
import { actorOf, auditTx } from "@/lib/server/audit";
import { resetFirebaseMfa, setFirebaseUserDisabled } from "@/lib/server/auth/firebase";
import { listPendingInvitations, type PendingInviteDTO } from "@/lib/server/auth/invitations";
import { revokeAllLocalSessions, setLocalPassword, verifyLocalPasswordFor } from "@/lib/server/auth/local";
import { checkPasswordPolicy } from "@/lib/server/auth/password";
import { listStaffSessions, requireStaff, type StaffSessionInfo } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { absolute } from "@/lib/server/url";

async function allStaff(): Promise<Array<WithId<StaffProfile>>> {
  const out: Array<WithId<StaffProfile>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 10; i++) {
    const page: { items: Array<WithId<StaffProfile>>; nextCursor: string | null } = await getStore().list<StaffProfile>(C.staff, { orderBy: { field: "displayName", dir: "asc" }, limit: 100, cursor });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

export type TeamMemberDTO = { uid: Uid; name: string; roles: Role[]; roleNames: string[]; status: StaffProfile["status"]; lastSignInAt: Millis | null; mfa: { required: boolean; enrolled: boolean }; sample: boolean };

export async function getTeam(): Promise<{ members: TeamMemberDTO[]; invitations: PendingInviteDTO[]; now: Millis }> {
  await requireStaff("staff.manage");
  const [staff, invitations] = await Promise.all([allStaff(), listPendingInvitations()]);
  return {
    members: staff.map((s) => ({
      uid: s.uid ?? s.id,
      name: s.displayName,
      roles: s.roles,
      roleNames: s.roles.map((r) => ROLE_LABEL[r]?.name ?? r),
      status: s.status,
      lastSignInAt: s.lastSignInAt,
      mfa: { required: s.mfa.required, enrolled: s.mfa.enrolled },
      sample: s.isSample === true,
    })),
    invitations,
    now: Date.now(),
  };
}

export type PersonDTO = TeamMemberDTO & {
  email: string;
  viewerScopes: ViewerScope[];
  keys: string[];
  timezone: string;
  sessions: Array<{ id: string; device: string; lastSeenAt: Millis; current: boolean }>;
  isLastSuperAdmin: boolean;
  isMe: boolean;
  version: number;
  now: Millis;
};

export async function getPerson(uid: string): Promise<PersonDTO | null> {
  const v = await requireStaff("staff.manage");
  const staff = await allStaff();
  const s = staff.find((x) => (x.uid ?? x.id) === uid);
  if (!s) return null;
  const perms = permsFor(s.roles, s.viewerScopes);
  const sessions: StaffSessionInfo[] = await listStaffSessions(uid).catch(() => []);
  const activeAdmins = staff.filter((x) => x.status === "active" && x.roles.includes("super_admin"));
  return {
    uid,
    name: s.displayName,
    email: s.email,
    roles: s.roles,
    roleNames: s.roles.map((r) => ROLE_LABEL[r]?.name ?? r),
    viewerScopes: s.viewerScopes,
    status: s.status,
    lastSignInAt: s.lastSignInAt,
    mfa: { required: s.mfa.required, enrolled: s.mfa.enrolled },
    sample: s.isSample === true,
    keys: AREAS.filter((a) => a !== "today" && canSeeArea(perms, a)).map((a) => placeFor(a, perms).label),
    timezone: s.timezone,
    sessions: sessions.map((x) => ({ id: x.id, device: x.device ?? "A browser", lastSeenAt: x.lastSeenAt ?? x.createdAt, current: x.current })),
    isLastSuperAdmin: s.roles.includes("super_admin") && s.status === "active" && activeAdmins.length <= 1,
    isMe: uid === v.uid,
    version: s.version ?? 0,
    now: Date.now(),
  };
}

async function writeStaff(v: Viewer, uid: string, build: (s: StaffProfile, admins: number) => { patch: Partial<StaffProfile>; summary: string; email?: boolean; quiet?: boolean } | string): Promise<ActionResult<{ version: number }>> {
  const staff = await allStaff();
  const admins = staff.filter((x) => x.status === "active" && x.roles.includes("super_admin")).length;
  try {
    const out = await getStore().runTransaction(async (tx) => {
      const s = await tx.get<StaffProfile>(docPath("staff", uid));
      if (!s) return "That person isn't on the team.";
      const b = build(s, admins);
      if (typeof b === "string") return b;
      const version = (s.version ?? 0) + 1;
      tx.update(docPath("staff", uid), { ...b.patch, version, updatedAt: Date.now() });
      auditTx(tx, { actor: actorOf(v), action: "staff.update", area: "staff", summary: b.summary, feed: !b.quiet, sensitive: !b.quiet, targetPath: docPath("staff", uid) });
      if (b.email) {
        await enqueueEmailTx(tx, { template: "staff_access_changed", to: [s.email], vars: { firstName: s.displayName.split(" ")[0] ?? "", link: absolute("/admin/login") }, dedupeKey: `access~${uid}~${version}` });
      }
      return { version };
    });
    if (typeof out === "string") return actionError({ kind: "not_allowed", message: out });
    return actionOk(out);
  } catch (err) {
    log.error("dal.staff.write_failed", { uid, err });
    return actionError({ kind: "unavailable", message: "That didn't save. Please try again." });
  }
}

/** New roles (and viewer areas). The last active super admin keeps that role. */
export async function setRoles(v: Viewer, uid: string, roles: string[], viewerScopes: string[]): Promise<ActionResult<{ version: number }>> {
  const r = [...new Set(roles)].filter((x): x is Role => (ROLES as readonly string[]).includes(x));
  const scopes = [...new Set(viewerScopes)].filter((x): x is ViewerScope => (VIEWER_SCOPES as readonly string[]).includes(x));
  if (!r.length) return actionError({ kind: "validation", fields: { roles: "Choose at least one role." } });
  return writeStaff(v, uid, (s, admins) => {
    if (s.roles.includes("super_admin") && !r.includes("super_admin") && s.status === "active" && admins <= 1) return "Haven needs at least one super admin. Make someone else a super admin first.";
    return {
      patch: { roles: r, viewerScopes: r.includes("viewer") ? scopes : [], mfa: { ...s.mfa, required: r.some((x) => x === "super_admin" || x === "safeguarding_officer" || x === "finance_officer") } },
      summary: `${v.displayName} changed ${s.displayName}'s access to ${r.map((x) => ROLE_LABEL[x]?.name ?? x).join(", ")}`,
      email: true,
    };
  });
}

/** Pause (suspend), restore or deactivate. Pausing signs them out everywhere; history is kept. */
export async function setStaffStatus(v: Viewer, uid: string, status: "active" | "suspended" | "deactivated"): Promise<ActionResult<{ version: number }>> {
  if (uid === v.uid && status !== "active") return actionError({ kind: "not_allowed", message: "You can't pause your own access. Ask another super admin." });
  const r = await writeStaff(v, uid, (s, admins) => {
    if (status !== "active" && s.roles.includes("super_admin") && s.status === "active" && admins <= 1) return "This is the last super admin. Make someone else a super admin first.";
    const words = status === "active" ? "restored" : status === "suspended" ? "paused" : "deactivated";
    return { patch: { status, ...(status !== "active" ? { sessionsRevokedAt: Date.now() } : {}) }, summary: `${v.displayName} ${words} ${s.displayName}'s access`, email: status === "active" };
  });
  if (r.ok && status !== "active") {
    if (resolveBackend() === "local") await revokeAllLocalSessions(uid).catch(() => 0);
    else await setFirebaseUserDisabled(uid, true).catch((err) => log.warn("dal.staff.disable_failed", { uid, err }));
  } else if (r.ok && resolveBackend() !== "local") await setFirebaseUserDisabled(uid, false).catch(() => undefined);
  return r;
}

/** Resets their sign-in code (Firebase TOTP); practice mode has no codes. */
export async function resetSignInCode(v: Viewer, uid: string): Promise<ActionResult<{ version: number }>> {
  if (resolveBackend() === "local") return actionError({ kind: "not_allowed", message: "Practice mode has no sign-in codes, so there's nothing to reset." });
  const r = await writeStaff(v, uid, (s) => ({ patch: { mfa: { ...s.mfa, enrolled: false, enrolledAt: null }, sessionsRevokedAt: Date.now() }, summary: `${v.displayName} reset ${s.displayName}'s sign-in code`, email: true }));
  if (r.ok) await resetFirebaseMfa(uid).catch((err) => log.warn("dal.staff.mfa_reset_failed", { uid, err }));
  return r;
}

/* ── Me ────────────────────────────────────────────────────────────────── */

export type MeDTO = {
  uid: Uid;
  name: string;
  email: string;
  roleNames: string[];
  timezone: string;
  textSize: "normal" | "large";
  prefs: Record<NotificationTopic, NotificationDelivery>;
  lockedTopics: NotificationTopic[];
  mfa: { required: boolean; enrolled: boolean; practice: boolean };
  sessions: Array<{ id: string; device: string; lastSeenAt: Millis; current: boolean }>;
  version: number;
  now: Millis;
};

export async function getMe(): Promise<MeDTO> {
  const v = await requireStaff();
  const s = await getStore().get<StaffProfile>(docPath("staff", v.uid));
  const sessions: StaffSessionInfo[] = await listStaffSessions(v.uid).catch(() => []);
  return {
    uid: v.uid,
    name: s?.displayName ?? v.displayName,
    email: s?.email ?? "",
    roleNames: v.roles.map((r) => ROLE_LABEL[r]?.name ?? r),
    timezone: s?.timezone ?? "Africa/Banjul",
    textSize: s?.textSize ?? "normal",
    prefs: s?.notificationPrefs?.email ?? { inbox: "instant", handoffs: "instant", sessions: "instant", drafts: "daily_digest" },
    lockedTopics: v.roles.includes("safeguarding_officer") ? ["inbox"] : [],
    mfa: { required: s?.mfa.required ?? false, enrolled: s?.mfa.enrolled ?? false, practice: resolveBackend() === "local" },
    sessions: sessions.map((x) => ({ id: x.id, device: x.device ?? "A browser", lastSeenAt: x.lastSeenAt ?? x.createdAt, current: x.current })),
    version: s?.version ?? 0,
    now: Date.now(),
  };
}

export type MeInput = { name: string; timezone: string; textSize: "normal" | "large"; prefs: Partial<Record<NotificationTopic, NotificationDelivery>> };

export async function updateMe(input: MeInput): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return actionError({ kind: "validation", fields: { name: "Please give your name." } });
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: input.timezone });
  } catch {
    return actionError({ kind: "validation", fields: { timezone: "Choose a timezone." } });
  }
  const DELIVERY = ["instant", "daily_digest", "off"];
  return writeStaff(v, v.uid, (s) => {
    const prefs = { ...s.notificationPrefs.email };
    for (const [k, d] of Object.entries(input.prefs)) {
      if (!(k in prefs) || !DELIVERY.includes(String(d))) continue;
      if (k === "inbox" && v.roles.includes("safeguarding_officer") && d === "off") continue;
      prefs[k as NotificationTopic] = d as NotificationDelivery;
    }
    return { patch: { displayName: name, timezone: input.timezone, textSize: input.textSize === "large" ? "large" : "normal", notificationPrefs: { ...s.notificationPrefs, email: prefs } }, summary: `${name} updated their profile`, quiet: true };
  });
}

export async function changeMyPassword(current: string, next: string): Promise<ActionResult<{ version: number }>> {
  const v = await requireStaff();
  if (resolveBackend() !== "local") return actionError({ kind: "not_allowed", message: "Change your password from the sign-in page (Forgot your password?)." });
  if (!(await verifyLocalPasswordFor(v.uid, current))) return actionError({ kind: "validation", fields: { current: "That isn't your current password." } });
  const s = await getStore().get<StaffProfile>(docPath("staff", v.uid));
  const problem = checkPasswordPolicy(next, { email: s?.email, name: s?.displayName });
  if (problem) return actionError({ kind: "validation", fields: { next: problem } });
  await setLocalPassword(v.uid, next);
  return actionOk({ version: s?.version ?? 0 });
}
