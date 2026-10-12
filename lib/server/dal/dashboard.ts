import "server-only";

// Counts for the shell badges (the 30-second pulse) and Today's "At a glance" tiles (admin-ux §3.6,
// §6.2; data-model §6.5; PLAN D83). Each count is a real `count()` over the collections this person
// may see, run in parallel; nothing is computed for collections they cannot open. Concern counts
// exist only for people with `concern.read` (concern isolation: others cannot even see a count).
// Results are memoised per uid for 30 seconds in this process (a module Map, never 'use cache').

import { FLOWS } from "@/lib/model/flows";
import type { PulseDTO } from "@/lib/model/dto";
import type { Millis, Uid } from "@/lib/model/enums";
import { OPEN_STATUSES } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { contactCategoriesFor, has, hasAny, programmeFilterFor } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { Filter } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";

const MEMO_MS = 30_000;
const DAY = 86_400_000;

type Memo<T> = Map<Uid, { at: Millis; value: T }>;
const pulseMemo: Memo<PulseDTO> = new Map();
const dashboardMemo: Memo<DashboardDTO> = new Map();

function remember<T>(memo: Memo<T>, uid: Uid, now: Millis, compute: () => Promise<T>): Promise<T> {
  const hit = memo.get(uid);
  if (hit && now - hit.at < MEMO_MS) return Promise.resolve(hit.value);
  return compute().then((value) => {
    memo.set(uid, { at: now, value });
    if (memo.size > 500) {
      for (const [k, v] of memo) if (now - v.at >= MEMO_MS) memo.delete(k);
    }
    return value;
  });
}

/** A count that never takes the page down: a failed or unindexed query counts as 0 and is logged. */
async function safeCount(collection: string, where: Filter[]): Promise<number> {
  try {
    return await getStore().count(collection, where);
  } catch (err) {
    log.warn("dal.dashboard.count_failed", { collection, err });
    return 0;
  }
}

/** The newest createdAt among matching records, or null. */
async function newestAt(collection: string, where: Filter[]): Promise<Millis | null> {
  try {
    const page = await getStore().list<{ createdAt?: Millis }>(collection, { where, orderBy: { field: "createdAt", dir: "desc" }, limit: 1 });
    const at = page.items[0]?.createdAt;
    return typeof at === "number" ? at : null;
  } catch (err) {
    log.warn("dal.dashboard.newest_failed", { collection, err });
    return null;
  }
}

const notArchived: Filter = { field: "archived", op: "==", value: false };

/** "New" items this person triages, per collection (what the Inbox badge counts). */
function inboxQueries(v: Viewer): Array<{ collection: string; where: Filter[] }> {
  const q: Array<{ collection: string; where: Filter[] }> = [];
  if (has(v, "support.manage")) {
    const where: Filter[] = [notArchived, { field: "status", op: "==", value: FLOWS.support.initial }];
    const scope = programmeFilterFor(v);
    if (scope) where.push(scope.length === 1 ? { field: "programmeId", op: "==", value: scope[0] } : { field: "programmeId", op: "in", value: scope });
    if (!scope || scope.length) q.push({ collection: C.supportRequests, where });
  }
  if (has(v, "concern.read")) q.push({ collection: C.safeguardingConcerns, where: [notArchived, { field: "status", op: "==", value: FLOWS.concern.initial }] });
  if (has(v, "donation.manage")) q.push({ collection: C.donations, where: [{ field: "status", op: "==", value: FLOWS.donation.initial }] });
  if (has(v, "contact.manage")) {
    const cats = contactCategoriesFor(v);
    if (cats.length) {
      q.push({
        collection: C.contactMessages,
        where: [{ field: "status", op: "==", value: FLOWS.contact.initial }, cats.length === 1 ? { field: "category", op: "==", value: cats[0] } : { field: "category", op: "in", value: cats }],
      });
    }
  }
  if (has(v, "volunteer.manage")) q.push({ collection: C.volunteerApplications, where: [notArchived, { field: "status", op: "==", value: FLOWS.volunteer.initial }] });
  if (has(v, "partnership.manage")) q.push({ collection: C.partnershipEnquiries, where: [notArchived, { field: "status", op: "==", value: FLOWS.partnership.initial }] });
  if (has(v, "reportRequest.manage")) q.push({ collection: C.reportRequests, where: [{ field: "status", op: "==", value: FLOWS.reportRequest.initial }] });
  if (has(v, "storySubmission.manage")) q.push({ collection: C.storySubmissions, where: [notArchived, { field: "status", op: "==", value: FLOWS.storySubmission.initial }] });
  return q;
}

/** Open records assigned to this person, per collection. */
function mineQueries(v: Viewer): Array<{ collection: string; where: Filter[] }> {
  const mine = (collection: string, statuses: readonly string[]) => ({
    collection,
    where: [
      { field: "assignedTo", op: "==", value: v.uid },
      { field: "status", op: "in", value: [...statuses] },
    ] as Filter[],
  });
  const q: Array<{ collection: string; where: Filter[] }> = [];
  if (hasAny(v, "support.manage", "support.read")) q.push(mine(C.supportRequests, OPEN_STATUSES.support));
  if (has(v, "concern.read")) q.push(mine(C.safeguardingConcerns, OPEN_STATUSES.concern));
  if (has(v, "donation.manage")) q.push(mine(C.donations, OPEN_STATUSES.donation));
  if (has(v, "contact.manage")) q.push(mine(C.contactMessages, OPEN_STATUSES.contact));
  if (has(v, "volunteer.manage")) q.push(mine(C.volunteerApplications, OPEN_STATUSES.volunteer));
  if (has(v, "partnership.manage")) q.push(mine(C.partnershipEnquiries, OPEN_STATUSES.partnership));
  if (has(v, "reportRequest.manage")) q.push(mine(C.reportRequests, OPEN_STATUSES.reportRequest));
  if (has(v, "storySubmission.manage")) q.push(mine(C.storySubmissions, OPEN_STATUSES.storySubmission));
  if (hasAny(v, "appointment.own", "appointment.manage")) {
    q.push({ collection: C.appointments, where: [{ field: "counsellorUid", op: "==", value: v.uid }, { field: "status", op: "==", value: "scheduled" }] });
  }
  return q;
}

async function computePulse(v: Viewer): Promise<PulseDTO> {
  const inbox = inboxQueries(v);
  const [inboxCounts, newest, mineCounts, updatesUnread, concernsNew] = await Promise.all([
    Promise.all(inbox.map((x) => safeCount(x.collection, x.where))),
    Promise.all(inbox.map((x) => newestAt(x.collection, x.where))),
    Promise.all(mineQueries(v).map((x) => safeCount(x.collection, x.where))),
    safeCount(C.notifications, [
      { field: "recipientUid", op: "==", value: v.uid },
      { field: "read", op: "==", value: false },
    ]),
    has(v, "concern.read") ? safeCount(C.safeguardingConcerns, [notArchived, { field: "status", op: "==", value: FLOWS.concern.initial }]) : Promise.resolve(null),
  ]);
  const latest = newest.filter((x): x is Millis => typeof x === "number");
  const pulse: PulseDTO = {
    inboxNew: inboxCounts.reduce((a, b) => a + b, 0),
    mine: mineCounts.reduce((a, b) => a + b, 0),
    updatesUnread,
    latestAt: latest.length ? Math.max(...latest) : null,
  };
  // The key is absent, not zero, for people who may not see concerns (§7.5).
  if (concernsNew !== null) pulse.concernsNew = concernsNew;
  return pulse;
}

/** Badge counts for the shell, polled every 30 seconds while the tab is visible. */
export async function getPulse(): Promise<PulseDTO> {
  const v = await requireStaff();
  return remember(pulseMemo, v.uid, Date.now(), () => computePulse(v));
}

/* ── Today's tiles ──────────────────────────────────────────────────────── */

export type DashboardTileId =
  | "support_new"
  | "support_mine"
  | "concerns_open"
  | "donation_enquiries"
  | "inkind_offers"
  | "sessions_week"
  | "report_requests"
  | "volunteer_applications"
  | "partnership_enquiries"
  | "resources_live"
  | "posts_review";

export type DashboardTile = {
  id: DashboardTileId;
  /** A count sentence fragment: "new support requests". */
  label: string;
  count: number;
  /** Where the tile goes (a filtered list). */
  href: string;
  /** Concern tile: shown with a lock and no colour alarm (admin-ux §3.1). */
  restricted?: true;
};

export type DashboardDTO = { tiles: DashboardTile[]; at: Millis };

async function computeDashboard(v: Viewer, now: Millis): Promise<DashboardDTO> {
  const jobs: Array<Promise<DashboardTile | null>> = [];
  const tile = (id: DashboardTileId, label: string, href: string, collection: string, where: Filter[], restricted?: true) =>
    jobs.push(safeCount(collection, where).then((count) => ({ id, label, count, href, ...(restricted ? { restricted } : {}) })));

  if (hasAny(v, "support.read", "support.summary")) {
    tile("support_new", "new support requests", "/admin/requests?stage=new", C.supportRequests, [notArchived, { field: "status", op: "==", value: "new" }]);
  }
  if (has(v, "support.read")) {
    tile("support_mine", "requests need your attention", "/admin/requests?who=mine", C.supportRequests, [
      { field: "assignedTo", op: "==", value: v.uid },
      { field: "status", op: "in", value: ["under_review", "more_info_required", "assigned", "referred", "approved", "support_in_progress"] },
    ]);
  }
  if (has(v, "concern.read")) {
    tile("concerns_open", "concerns open", "/admin/safeguarding", C.safeguardingConcerns, [{ field: "status", op: "in", value: ["received", "screening", "risk_assessed", "escalated"] }], true);
  }
  if (has(v, "donation.read")) {
    tile("donation_enquiries", "gift enquiries", "/admin/giving?kind=cash&stage=pledged", C.donations, [
      { field: "kind", op: "==", value: "cash" },
      { field: "status", op: "in", value: ["pledged", "pending"] },
    ]);
    tile("inkind_offers", "in-kind offers", "/admin/giving?kind=kind", C.donations, [
      { field: "kind", op: "==", value: "in_kind" },
      { field: "status", op: "in", value: ["pledged", "pending"] },
    ]);
  }
  if (hasAny(v, "appointment.manage", "appointment.own")) {
    const where: Filter[] = [
      { field: "status", op: "==", value: "scheduled" },
      { field: "startsAt", op: ">=", value: now },
      { field: "startsAt", op: "<", value: now + 7 * DAY },
    ];
    if (!has(v, "appointment.manage")) where.unshift({ field: "counsellorUid", op: "==", value: v.uid });
    tile("sessions_week", "sessions in the next 7 days", "/admin/counselling", C.appointments, where);
  }
  if (has(v, "reportRequest.read")) {
    tile("report_requests", "report requests", "/admin/library/requests", C.reportRequests, [{ field: "status", op: "in", value: ["new", "under_review"] }]);
  }
  if (hasAny(v, "volunteer.read", "volunteer.summary")) {
    tile("volunteer_applications", "volunteer applications", "/admin/people/volunteers", C.volunteerApplications, [
      notArchived,
      { field: "status", op: "in", value: ["submitted", "screening"] },
    ]);
  }
  if (hasAny(v, "partnership.read", "partnership.summary")) {
    tile("partnership_enquiries", "partnership enquiries", "/admin/people/partners", C.partnershipEnquiries, [
      notArchived,
      { field: "status", op: "in", value: ["new", "under_review"] },
    ]);
  }
  if (has(v, "resource.read")) {
    tile("resources_live", "resources live", "/admin/library", C.resources, [{ field: "status", op: "==", value: "published" }]);
  }
  if (has(v, "post.publish")) {
    tile("posts_review", "posts waiting for review", "/admin/posts/review", C.posts, [{ field: "status", op: "==", value: "in_review" }]);
  }
  const tiles = (await Promise.all(jobs)).filter((t): t is DashboardTile => t !== null);
  return { tiles, at: now };
}

/** Today's "At a glance" counts: only the tiles this person may see (zero counts included). */
export async function getDashboard(): Promise<DashboardDTO> {
  const v = await requireStaff("dashboard.view");
  const now = Date.now();
  return remember(dashboardMemo, v.uid, now, () => computeDashboard(v, now));
}
