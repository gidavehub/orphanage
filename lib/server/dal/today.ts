import "server-only";

// Today's cards beyond the counts (admin-ux §6.2, §5.4; PLAN D83, D125): what needs this person,
// what's coming up, this month at Haven, the website's state and (super admins) connection notices.
// Every section is computed only when the viewer may see that area, and each one degrades to null
// on a failed read so Today always renders. Gifts are listed per currency and never added together.

import { contentStore } from "@/lib/content/store";
import type { InboxItem } from "@/lib/model/dto";
import type { Currency, Millis } from "@/lib/model/enums";
import type { Viewer } from "@/lib/model/viewer";
import { has, hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { Filter } from "@/lib/server/db/store";
import { integrationStatuses } from "@/lib/server/integrations/status";
import { log } from "@/lib/server/log";
import { inboxFor } from "./inbox";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type ComingUpItem = {
  id: string;
  at: Millis;
  kind: "session" | "post";
  title: string;
  detail: string;
  href: string;
  /** "Join Zoom", "Add a link". */
  action?: { label: string; href: string };
};

export type TodayDTO = {
  at: Millis;
  needsYou: { items: InboxItem[]; total: number };
  comingUp: ComingUpItem[] | null;
  thisMonth: {
    gifts: Array<{ currency: Currency; amountMinor: number; count: number }> | null;
    requestsHandled: number | null;
    sessionsHeld: number | null;
    volunteersActive: number | null;
  };
  website: { changesNotLive: number; inReview: number; aiReady: number; scheduled: number; impactCheckedAt: Millis | null } | null;
  connections: Array<{ id: string; headline: string; meaning: string }>;
};

async function safe<T>(what: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    log.warn("dal.today.read_failed", { what, err });
    return fallback;
  }
}

/** The first moment of this calendar month (UTC; close enough for a monthly summary). */
function monthStart(now: Millis): Millis {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

async function count(collection: string, where: Filter[]): Promise<number> {
  return getStore().count(collection, where);
}

async function needsYou(v: Viewer, now: Millis): Promise<TodayDTO["needsYou"]> {
  const [fresh, mine] = await Promise.all([inboxFor(v, { tab: "new", limit: 100, now }), inboxFor(v, { tab: "mine", limit: 100, now })]);
  const seen = new Set<string>();
  const merged: InboxItem[] = [];
  for (const it of [...fresh.items, ...mine.items]) {
    if (seen.has(it.ref)) continue;
    seen.add(it.ref);
    merged.push(it);
  }
  const rank = { immediate: 0, urgent: 1, soon: 2, normal: 3 } as const;
  merged.sort((a, b) => rank[a.urgency] - rank[b.urgency] || b.createdAt - a.createdAt);
  return { items: merged.slice(0, 5), total: merged.length };
}

async function comingUp(v: Viewer, now: Millis): Promise<ComingUpItem[]> {
  const out: ComingUpItem[] = [];
  if (hasAny(v, "appointment.manage", "appointment.own")) {
    const where: Filter[] = [
      { field: "status", op: "==", value: "scheduled" },
      { field: "startsAt", op: ">=", value: now - HOUR },
      { field: "startsAt", op: "<", value: now + 36 * HOUR },
    ];
    if (!has(v, "appointment.manage")) where.unshift({ field: "counsellorUid", op: "==", value: v.uid });
    const page = await getStore().list<Record<string, unknown>>(C.appointments, { where, orderBy: { field: "startsAt", dir: "asc" }, limit: 8 });
    for (const a of page.items) {
      const client = (a.clientSnapshot ?? {}) as { displayName?: string };
      const zoom = (a.zoom ?? null) as { joinUrl?: string } | null;
      const counsellor = typeof a.counsellorName === "string" ? a.counsellorName.split(/\s+/)[0] : "";
      const href = `/admin/counselling/${encodeURIComponent(a.id)}`;
      out.push({
        id: a.id,
        at: a.startsAt as Millis,
        kind: "session",
        title: `Session with ${client.displayName?.split(/\s+/)[0] ?? "a client"}`,
        detail: [counsellor, a.mode === "zoom" ? (zoom?.joinUrl ? "Zoom ready" : "No Zoom link yet") : a.mode === "phone" ? "By phone" : "In person"].filter(Boolean).join(" · "),
        href,
        ...(a.mode === "zoom" ? (zoom?.joinUrl && a.counsellorUid === v.uid ? { action: { label: "Join Zoom", href: zoom.joinUrl } } : !zoom?.joinUrl ? { action: { label: "Add a link", href } } : {}) : {}),
      });
    }
  }
  if (hasAny(v, "post.publish", "post.draft")) {
    const posts = await contentStore().listItems("posts");
    for (const rec of posts) {
      const p = (rec.draft ?? rec.published) as { status?: string; publishAt?: number; title?: string } | null;
      if (!p || p.status !== "scheduled" || typeof p.publishAt !== "number") continue;
      if (p.publishAt < now - HOUR || p.publishAt > now + 2 * DAY) continue;
      out.push({ id: rec.id, at: p.publishAt, kind: "post", title: `“${p.title ?? "A post"}” goes live`, detail: "Scheduled post", href: `/admin/posts/${encodeURIComponent(rec.id)}` });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 6);
}

async function thisMonth(v: Viewer, now: Millis): Promise<TodayDTO["thisMonth"]> {
  const start = monthStart(now);
  const [gifts, requestsHandled, sessionsHeld, volunteersActive] = await Promise.all([
    hasAny(v, "donation.read", "donation.summary")
      ? safe(
          "gifts",
          async () => {
            // (kind, receivedAt↓) index; received-or-later stages are filtered here. Up to 500 gifts a month.
            type Gift = { status?: string; cash?: { amount?: { amountMinor?: number; currency?: Currency } }; receivedAt?: Millis | null };
            const items: Gift[] = [];
            let cursor: string | null = null;
            for (let i = 0; i < 5; i++) {
              const page: { items: Gift[]; nextCursor: string | null } = await getStore().list<Gift>(C.donations, {
                where: [
                  { field: "kind", op: "==", value: "cash" },
                  { field: "receivedAt", op: ">=", value: start },
                ],
                orderBy: { field: "receivedAt", dir: "desc" },
                limit: 100,
                cursor,
              });
              items.push(...page.items.filter((d) => d.status === "received" || d.status === "acknowledged" || d.status === "allocated"));
              if (!page.nextCursor) break;
              cursor = page.nextCursor;
            }
            const page = { items };
            const by = new Map<Currency, { amountMinor: number; count: number }>();
            for (const d of page.items) {
              const at = typeof d.receivedAt === "number" ? d.receivedAt : 0;
              const amt = d.cash?.amount;
              if (at < start || !amt || typeof amt.amountMinor !== "number" || !amt.currency) continue;
              const cur = by.get(amt.currency) ?? { amountMinor: 0, count: 0 };
              by.set(amt.currency, { amountMinor: cur.amountMinor + amt.amountMinor, count: cur.count + 1 });
            }
            return [...by.entries()].map(([currency, x]) => ({ currency, ...x })).sort((a, b) => b.count - a.count);
          },
          null,
        )
      : Promise.resolve(null),
    hasAny(v, "support.read", "support.summary") ? safe("handled", () => count(C.supportRequests, [{ field: "closedAt", op: ">=", value: start }]), null) : Promise.resolve(null),
    hasAny(v, "appointment.manage", "appointment.own")
      ? safe(
          "sessions",
          () =>
            count(C.appointments, [
              ...(has(v, "appointment.manage") ? [] : [{ field: "counsellorUid", op: "==", value: v.uid } as Filter]),
              { field: "status", op: "==", value: "completed" },
              { field: "startsAt", op: ">=", value: start },
            ]),
          null,
        )
      : Promise.resolve(null),
    hasAny(v, "volunteer.read", "volunteer.summary")
      ? safe(
          "volunteers",
          () =>
            count(C.volunteerApplications, [
              { field: "status", op: "==", value: "active" },
              { field: "statusChangedAt", op: ">=", value: start },
            ]),
          null,
        )
      : Promise.resolve(null),
  ]);
  return { gifts, requestsHandled, sessionsHeld, volunteersActive };
}

async function website(v: Viewer): Promise<TodayDTO["website"]> {
  if (!hasAny(v, "content.edit", "post.publish", "post.draft")) return null;
  const store = contentStore();
  const { DOC_IDS, COLLECTION_NAMES } = await import("@/lib/content/ids");
  const [docs, collections] = await Promise.all([
    Promise.all(DOC_IDS.map((id) => store.getDoc(id).catch(() => null))),
    Promise.all(COLLECTION_NAMES.map((c) => store.listItems(c).catch(() => []))),
  ]);
  let changesNotLive = docs.filter((d) => d && d.draft != null).length;
  let inReview = 0;
  let aiReady = 0;
  let scheduled = 0;
  let impactCheckedAt: Millis | null = null;
  COLLECTION_NAMES.forEach((c, i) => {
    for (const rec of collections[i] ?? []) {
      if (c === "posts") {
        const p = (rec.draft ?? rec.published) as { status?: string; origin?: { kind?: string } } | null;
        if (p?.status === "in_review") {
          inReview++;
          if (p.origin?.kind === "ai") aiReady++;
        }
        if (p?.status === "scheduled") scheduled++;
        continue;
      }
      if (rec.draft != null) changesNotLive++;
      if (c === "stats") {
        const s = (rec.published ?? rec.draft) as { verification?: { verifiedAt?: number } } | null;
        const at = s?.verification?.verifiedAt;
        if (typeof at === "number" && (!impactCheckedAt || at > impactCheckedAt)) impactCheckedAt = at;
      }
    }
  });
  return { changesNotLive, inReview, aiReady, scheduled, impactCheckedAt };
}

/** Everything Today shows beyond the counts, for the signed-in person. */
export async function getToday(): Promise<TodayDTO> {
  const v = await requireStaff("dashboard.view");
  const now = Date.now();
  const [ny, cu, tm, web] = await Promise.all([
    safe("needs", () => needsYou(v, now), { items: [], total: 0 }),
    safe("coming", () => comingUp(v, now), null),
    thisMonth(v, now),
    safe("website", () => website(v), null),
  ]);
  const connections = v.roles.includes("super_admin")
    ? integrationStatuses()
        .filter((s) => s.state === "off" || s.state === "problem")
        .map((s) => ({ id: s.id, headline: s.headline, meaning: s.meaning }))
    : [];
  return { at: now, needsYou: ny, comingUp: cu, thisMonth: tm, website: web, connections };
}
