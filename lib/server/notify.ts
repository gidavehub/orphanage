import "server-only";

// In-app staff notifications (data-model §4.7, admin-ux §8, PLAN D109, D133).
// recipientsFor(route) resolves who hears about a new item:
// - settings/notifications.routes[route] when it lists active people;
// - otherwise everyone active holding the owning role (contact messages by category, §6.2; support
//   requests narrowed by programme scope);
// - concern alerts: settings/notifications.concernAlert.uids, default every active safeguarding
//   officer; super admins when no safeguarding officer is active (D109);
// - nobody holding the role → super admins, so nothing is lost.
// Titles are never sensitive ("New safeguarding item needs review"); links point at /admin/….
// Concern details never reach a notification (PLAN §7.5).

import { randomBytes } from "node:crypto";
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings, type NotifyRouteId } from "@/lib/model/domain/settings";
import type { StaffNotification, StaffProfile } from "@/lib/model/domain/staff";
import type { ContactCategory, ProgrammeId, Uid } from "@/lib/model/enums";
import { CONTACT_OWNERS, permsFor, type Role } from "@/lib/model/permissions";
import { getStore } from "@/lib/server/db";
import { C, settingsPath } from "@/lib/server/db/collections";
import { BackendUnavailableError, type Tx, type WithId } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";

export type NotifyRoute = NotifyRouteId | "concern_alert" | "post_review" | "finance_alert" | "system";

export type NotifyInput = {
  recipientUids: Uid[];
  kind: StaffNotification["kind"];
  /** Non-sensitive title. */
  title: string;
  /** /admin/… */
  href: string;
  priority?: "normal" | "urgent";
};

const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

const ROUTE_ROLES: Record<Exclude<NotifyRoute, "contact_new">, Role[]> = {
  support_new: ["programme_officer"],
  donation_new: ["finance_officer"],
  inkind_new: ["finance_officer"],
  finance_alert: ["finance_officer"],
  report_request_new: ["report_manager"],
  volunteer_new: ["programme_officer"],
  partnership_new: ["programme_officer"],
  story_new: ["content_manager"],
  post_review: ["content_manager"],
  data_request_new: ["super_admin"],
  concern_alert: ["safeguarding_officer"],
  system: ["super_admin"],
};

/** Every active staff member (staff is small: at most a few hundred). */
export async function activeStaff(): Promise<Array<WithId<StaffProfile>>> {
  const out: Array<WithId<StaffProfile>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const page: { items: Array<WithId<StaffProfile>>; nextCursor: string | null } = await getStore().list<StaffProfile>(C.staff, {
      where: [{ field: "status", op: "==", value: "active" }],
      orderBy: { field: "displayName", dir: "asc" },
      limit: 100,
      cursor,
    });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

function uidOf(s: WithId<StaffProfile>): Uid {
  return s.uid ?? s.id;
}

async function notificationSettings(): Promise<NotificationSettings> {
  const doc = await getStore().get<NotificationSettings>(settingsPath("notifications"));
  return {
    concernAlert: { ...DEFAULT_NOTIFICATION_SETTINGS.concernAlert, ...(doc?.concernAlert ?? {}) },
    routes: { ...(doc?.routes ?? {}) },
  };
}

/** Active super admins' uids. */
export async function superAdminUids(staff?: Array<WithId<StaffProfile>>): Promise<Uid[]> {
  return (staff ?? (await activeStaff())).filter((s) => s.roles?.includes("super_admin")).map(uidOf);
}

/** Staff who should hear about a new item on this route. Never throws (logs and returns []). */
export async function recipientsFor(route: NotifyRoute, opts?: { contactCategory?: ContactCategory; programmeId?: ProgrammeId | null }): Promise<Uid[]> {
  try {
    const [staff, settings] = await Promise.all([activeStaff(), notificationSettings()]);
    const active = new Map(staff.map((s) => [uidOf(s), s]));
    const admins = staff.filter((s) => s.roles?.includes("super_admin")).map(uidOf);

    if (route === "concern_alert") {
      const configured = (settings.concernAlert.uids ?? []).filter((uid) => {
        const s = active.get(uid);
        return s ? permsFor(s.roles ?? [], s.viewerScopes ?? []).has("concern.read") : false;
      });
      if (configured.length) return configured;
      const officers = staff.filter((s) => s.roles?.includes("safeguarding_officer")).map(uidOf);
      return officers.length ? officers : admins;
    }

    if (route !== "post_review" && route !== "finance_alert" && route !== "system") {
      const listed = (settings.routes[route] ?? []).filter((uid) => active.has(uid));
      if (listed.length) return listed;
    }

    const roles: Role[] = route === "contact_new" ? (opts?.contactCategory ? CONTACT_OWNERS[opts.contactCategory] : ["content_manager", "programme_officer"]) : ROUTE_ROLES[route];
    let holders = staff.filter((s) => roles.some((r) => s.roles?.includes(r)));
    if (route === "support_new" && opts?.programmeId) {
      const pid = opts.programmeId;
      holders = holders.filter((s) => s.programmeScope === "all" || !Array.isArray(s.programmeScope) || s.programmeScope.includes(pid));
    }
    const uids = holders.map(uidOf);
    return uids.length ? uids : admins;
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) log.error("notify.recipients_failed", { route, err });
    return [];
  }
}

function docs(n: NotifyInput, now: number): Array<[string, StaffNotification]> {
  const unique = [...new Set(n.recipientUids)].filter(Boolean);
  return unique.map((uid) => [
    `${C.notifications}/${randomBytes(15).toString("base64url")}`,
    {
      recipientUid: uid,
      kind: n.kind,
      title: n.title.slice(0, 140),
      href: n.href.startsWith("/admin") ? n.href : "/admin",
      priority: n.priority ?? "normal",
      read: false,
      createdAt: now,
      readAt: null,
      expireAt: now + NINETY_DAYS,
    },
  ]);
}

/** Queues the notifications inside an existing transaction (resolve recipients before it). */
export function notifyTx(tx: Tx, n: NotifyInput): void {
  for (const [path, doc] of docs(n, Date.now())) tx.create(path, doc);
}

/** Sends notifications on their own. Never throws to the caller. */
export async function notify(n: NotifyInput): Promise<void> {
  const items = docs(n, Date.now());
  if (items.length === 0) return;
  try {
    await getStore().batch((b) => {
      for (const [path, doc] of items) b.create(path, doc);
    });
  } catch (err) {
    if (err instanceof BackendUnavailableError) log.warn("notify.unavailable", { kind: n.kind, count: items.length });
    else log.error("notify.write_failed", { kind: n.kind, count: items.length, err });
  }
}

/** Resolves the route's recipients and notifies them. Never throws. */
export async function notifyRoute(
  route: NotifyRoute,
  n: Omit<NotifyInput, "recipientUids">,
  opts?: { contactCategory?: ContactCategory; programmeId?: ProgrammeId | null },
): Promise<Uid[]> {
  const recipientUids = await recipientsFor(route, opts);
  await notify({ ...n, recipientUids });
  return recipientUids;
}
