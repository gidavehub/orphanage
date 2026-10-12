import "server-only";

// Activity (admin-ux §6.15; data-model §6.5 "Recent activity"; PLAN D93). F5 ships the basic feed used
// by Today's "Recently" card: entries flagged `feed`, limited to the areas this person may read
// (auditAreasFor: safeguarding entries only with concern.read or audit.read.safeguarding). A9 adds the
// full Activity page (who, dates, sensitive filter). Sentences are written non-sensitive at the source.

import { AREA_PERMS } from "@/lib/admin/access";
import type { AuditEntry } from "@/lib/model/domain/system";
import { toStaffRef, type ActivityArea, type ActivityItem, type Page } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import { auditAreasFor, hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { Filter, WithId } from "@/lib/server/db/store";
import { clampLimit, emptyPage, pageOf } from "./_shared";

/** Newest first. `area` narrows to one area (when the person may read it). */
export async function listActivity(opts: { area?: ActivityArea; cursor?: string | null; limit?: number } = {}): Promise<Page<ActivityItem>> {
  const v = await requireStaff(...AREA_PERMS.activity.read, "dashboard.view");
  const allowed = auditAreasFor(v);
  const areas = opts.area ? allowed.filter((a) => a === opts.area) : allowed;
  if (areas.length === 0) return emptyPage<ActivityItem>();
  const where: Filter[] = [
    { field: "feed", op: "==", value: true },
    areas.length === 1 ? { field: "area", op: "==", value: areas[0] } : { field: "area", op: "in", value: areas.slice(0, 30) },
  ];
  const page = await getStore().list<AuditEntry>(C.auditLog, {
    where,
    orderBy: { field: "at", dir: "desc" },
    limit: clampLimit(opts.limit),
    cursor: opts.cursor ?? null,
  });
  return pageOf(page, (e) =>
    areas.includes(e.area)
      ? {
          id: e.id,
          at: e.at,
          sentence: String(e.summary ?? "").slice(0, 200),
          area: e.area,
          ref: e.targetRef ?? null,
          sensitive: e.sensitive === true,
          actor: e.actor?.kind === "staff" ? toStaffRef(e.actor.uid, e.actor.name) : null,
        }
      : null,
  );
}

function toItem(e: WithId<AuditEntry>): ActivityItem {
  return {
    id: e.id,
    at: e.at,
    sentence: String(e.summary ?? "").slice(0, 200),
    area: e.area,
    ref: e.targetRef ?? null,
    sensitive: e.sensitive === true,
    actor: e.actor?.kind === "staff" ? toStaffRef(e.actor.uid, e.actor.name) : null,
  };
}

export type ActivityLogDTO = Page<ActivityItem> & {
  areas: ActivityArea[];
  /** True for the audit readers (super admin, audit.read): "Only sensitive" and every entry by a person. */
  full: boolean;
  tz: string;
  now: Millis;
};

/**
 * The Activity page (admin-ux §6.15; PLAN D93). Everyone gets the feed of the areas they may read.
 * Audit readers can also see "Only sensitive" (record views, reveals, exports, sign-ins, role
 * changes) and everything one person did. Entries outside the person's areas are always dropped.
 */
export async function listActivityLog(opts: { area?: string | null; sensitive?: boolean; who?: string | null; cursor?: string | null }): Promise<ActivityLogDTO> {
  // The Activity place itself (Today's "Recently" card uses listActivity with dashboard.view).
  const v = await requireStaff(...AREA_PERMS.activity.read);
  const allowed = auditAreasFor(v);
  const full = v.roles.includes("super_admin") || hasAny(v, "audit.read");
  const area = allowed.find((a) => a === opts.area) ?? null;
  const base = { areas: allowed, full, tz: v.timezone, now: Date.now() };
  const who = full && opts.who && /^[A-Za-z0-9_-]{6,128}$/.test(opts.who) ? opts.who : null;
  const sensitive = full && opts.sensitive === true;
  if (!sensitive && !who) return { ...(await listActivity({ area: area ?? undefined, cursor: opts.cursor, limit: 40 })), ...base };
  const where: Filter[] = who ? [{ field: "actor.uid", op: "==", value: who }] : [{ field: "sensitive", op: "==", value: true }];
  const page = await getStore().list<AuditEntry>(C.auditLog, { where, orderBy: { field: "at", dir: "desc" }, limit: 60, cursor: opts.cursor ?? null });
  return {
    ...pageOf(page, (e) => (allowed.includes(e.area) && (!area || e.area === area) && (!sensitive || e.sensitive === true) ? toItem(e) : null)),
    ...base,
  };
}

