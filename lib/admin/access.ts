// The admin's places and quick actions, derived from permissions (client-safe). Hiding a place is
// UX only: the DAL enforces every read and write with requireStaff (PLAN D84). The access matrix is
// data-model §6 (binding) presented through admin-ux §4.1, §5.1–5.3 and §3.4.

import type { ShellViewer } from "@/lib/model/dto";
import type { Permission, Role } from "@/lib/model/permissions";

export const AREAS = [
  "today",
  "inbox",
  "requests",
  "safeguarding",
  "giving",
  "counselling",
  "library",
  "people",
  "website",
  "posts",
  "media",
  "team",
  "activity",
  "settings",
] as const;
export type Area = (typeof AREAS)[number];

export function isArea(v: unknown): v is Area {
  return typeof v === "string" && (AREAS as readonly string[]).includes(v);
}

/** Any-of permission lists per area and verb. */
export const AREA_PERMS: Record<Area, { read: Permission[]; write?: Permission[]; publish?: Permission[] }> = {
  today: { read: ["dashboard.view"] },
  inbox: {
    read: [
      "support.manage",
      "concern.read",
      "donation.manage",
      "contact.manage",
      "volunteer.manage",
      "partnership.manage",
      "reportRequest.manage",
      "storySubmission.manage",
    ],
    write: [
      "support.manage",
      "concern.manage",
      "donation.manage",
      "contact.manage",
      "volunteer.manage",
      "partnership.manage",
      "reportRequest.manage",
      "storySubmission.manage",
    ],
  },
  requests: { read: ["support.read", "support.summary"], write: ["support.manage"] },
  safeguarding: { read: ["concern.read"], write: ["concern.manage"] },
  giving: {
    read: ["donation.read", "donation.summary", "cause.figures", "sponsor.manage", "sponsor.publish", "donation.recognition"],
    write: ["donation.manage", "cause.figures", "sponsor.manage"],
    publish: ["sponsor.publish"],
  },
  counselling: { read: ["appointment.manage", "appointment.own"], write: ["appointment.manage", "appointment.own"] },
  library: { read: ["resource.manage", "reportRequest.read"], write: ["resource.manage", "reportRequest.manage"], publish: ["resource.publish"] },
  people: {
    read: ["volunteer.read", "partnership.read", "volunteer.summary", "partnership.summary", "referralPartner.manage"],
    write: ["volunteer.manage", "partnership.manage", "referralPartner.manage"],
  },
  website: { read: ["content.read", "content.edit"], write: ["content.edit"], publish: ["content.publish"] },
  posts: { read: ["post.draft", "post.publish"], write: ["post.draft", "post.publish"], publish: ["post.publish"] },
  media: { read: ["media.manage", "consent.manage"], write: ["media.manage", "consent.manage"] },
  team: { read: ["staff.manage"], write: ["staff.manage"] },
  activity: {
    read: [
      "audit.read",
      "audit.read.safeguarding",
      "support.read",
      "content.read",
      "donation.read",
      "reportRequest.read",
      "volunteer.read",
      "partnership.read",
    ],
  },
  settings: {
    read: ["settings.manage", "settings.giving", "content.publish", "support.manage", "concern.manage", "reportRequest.manage"],
    write: ["settings.manage", "settings.giving"],
  },
};

function toSet(perms: ReadonlySet<Permission> | readonly Permission[]): ReadonlySet<Permission> {
  return Array.isArray(perms) ? new Set(perms) : (perms as ReadonlySet<Permission>);
}

export function canSeeArea(perms: ReadonlySet<Permission> | readonly Permission[], area: Area): boolean {
  const set = toSet(perms);
  return AREA_PERMS[area].read.some((p) => set.has(p));
}

/** UX check for showing write or publish controls in an area (the server still decides). */
export function canInArea(perms: ReadonlySet<Permission> | readonly Permission[], area: Area, verb: "read" | "write" | "publish"): boolean {
  const set = toSet(perms);
  const list = AREA_PERMS[area][verb];
  return !!list && list.some((p) => set.has(p));
}

export type Place = {
  area: Area;
  label: string;
  href: string;
  /** lucide-react icon name. */
  icon: string;
  badge?: "inbox" | "concerns" | "posts";
};

const PLACE: Record<Area, Omit<Place, "area">> = {
  today: { label: "Today", href: "/admin", icon: "House" },
  inbox: { label: "Inbox", href: "/admin/inbox", icon: "Inbox", badge: "inbox" },
  requests: { label: "Requests", href: "/admin/requests", icon: "HandHeart" },
  safeguarding: { label: "Safeguarding", href: "/admin/safeguarding", icon: "ShieldCheck", badge: "concerns" },
  giving: { label: "Giving", href: "/admin/giving", icon: "Heart" },
  counselling: { label: "Sessions", href: "/admin/counselling", icon: "CalendarHeart" },
  library: { label: "Reports", href: "/admin/library", icon: "BookOpen" },
  people: { label: "People", href: "/admin/people", icon: "Users" },
  website: { label: "Website", href: "/admin/website", icon: "Globe" },
  posts: { label: "Posts", href: "/admin/posts", icon: "Newspaper", badge: "posts" },
  media: { label: "Photos", href: "/admin/media", icon: "Image" },
  team: { label: "Team", href: "/admin/team", icon: "UserCog" },
  activity: { label: "Activity", href: "/admin/activity", icon: "History" },
  settings: { label: "Settings", href: "/admin/settings", icon: "Settings" },
};

/** One-line descriptions for the Places sheet and the More card. */
export const PLACE_DESCRIPTION: Record<Area, string> = {
  today: "What needs you, at a glance",
  inbox: "Everything new that needs a first reply",
  requests: "Requests for support, from start to finish",
  safeguarding: "Child-protection concerns (restricted)",
  giving: "Gifts, causes, receipts and where the money goes",
  counselling: "Counselling sessions and who is waiting for a time",
  library: "Reports, resources and report requests",
  people: "Volunteers, partners and the referral directory",
  website: "Edit the public website and key information",
  posts: "Updates and articles, drafts and reviews",
  media: "Photos and files, with consent records",
  team: "Staff accounts and what each person can open",
  activity: "Who did what, and when",
  settings: "Connections, emails, giving setup and data",
};

/** The place for an area, with the counsellor's "My sessions" label when they only see their own. */
export function placeFor(area: Area, perms: ReadonlySet<Permission> | readonly Permission[]): Place {
  const set = toSet(perms);
  const base = PLACE[area];
  if (area === "counselling" && set.has("appointment.own") && !set.has("appointment.manage")) {
    return { area, ...base, label: "My sessions" };
  }
  return { area, ...base };
}

/** Which role's layout leads when a person holds several (admin-ux §5.3). */
const ROLE_PRECEDENCE: readonly Role[] = [
  "super_admin",
  "safeguarding_officer",
  "finance_officer",
  "programme_officer",
  "content_manager",
  "report_manager",
  "counsellor",
  "viewer",
];

/** Desktop pill order per role (admin-ux §5.3). Today is always first. */
const PILL_ORDER: Record<Role, readonly Area[]> = {
  super_admin: ["today", "inbox", "requests", "giving", "website", "posts"],
  content_manager: ["today", "website", "posts", "media", "library"],
  programme_officer: ["today", "inbox", "requests", "counselling", "people"],
  safeguarding_officer: ["today", "safeguarding", "inbox", "requests", "counselling"],
  finance_officer: ["today", "inbox", "giving"],
  counsellor: ["today", "counselling"],
  report_manager: ["today", "inbox", "library"],
  viewer: ["today", "requests", "giving", "people", "website", "library"],
};

/** Phone dock slot 2 per role. */
const DOCK_PRIMARY: Record<Role, Area> = {
  super_admin: "inbox",
  content_manager: "posts",
  programme_officer: "inbox",
  safeguarding_officer: "safeguarding",
  finance_officer: "giving",
  counsellor: "counselling",
  report_manager: "inbox",
  viewer: "today",
};

const MAX_PILL = 6;

/**
 * The places this person may open, split into the desktop pill (≤ 6), the More card, and the phone
 * dock's main place. Multi-role people get the leading role's order, topped up from their other roles.
 */
export function placesFor(v: Pick<ShellViewer, "roles" | "perms">): { pill: Place[]; more: Place[]; dockPrimary: Place } {
  const perms = toSet(v.perms);
  const visible = AREAS.filter((a) => canSeeArea(perms, a));
  const roles = ROLE_PRECEDENCE.filter((r) => v.roles.includes(r));
  const lead: Role = roles[0] ?? "viewer";

  const pillAreas: Area[] = [];
  for (const role of roles.length ? roles : (["viewer"] as Role[])) {
    for (const area of PILL_ORDER[role]) {
      if (pillAreas.length >= MAX_PILL) break;
      if (visible.includes(area) && !pillAreas.includes(area)) pillAreas.push(area);
    }
  }
  if (!pillAreas.includes("today")) pillAreas.unshift("today");

  const moreAreas = visible.filter((a) => !pillAreas.includes(a));
  const dockArea = visible.includes(DOCK_PRIMARY[lead]) ? DOCK_PRIMARY[lead] : (pillAreas.find((a) => a !== "today") ?? "today");

  return {
    pill: pillAreas.map((a) => placeFor(a, perms)),
    more: moreAreas.map((a) => placeFor(a, perms)),
    dockPrimary: placeFor(dockArea, perms),
  };
}

/* ── Quick actions (＋ New) and global sheets (?do=) ─────────────────── */

export type GlobalSheet =
  | "record-gift"
  | "log-request"
  | "log-concern"
  | "post-update"
  | "write-article"
  | "book-session"
  | "add-note"
  | "add-report"
  | "upload-media"
  | "invite";

export const GLOBAL_SHEETS: readonly GlobalSheet[] = [
  "post-update",
  "record-gift",
  "log-request",
  "log-concern",
  "book-session",
  "add-note",
  "write-article",
  "add-report",
  "upload-media",
  "invite",
];

export function isGlobalSheet(v: unknown): v is GlobalSheet {
  return typeof v === "string" && (GLOBAL_SHEETS as readonly string[]).includes(v);
}

const QUICK_ACTIONS: ReadonlyArray<{ id: GlobalSheet; label: string; icon: string; anyOf: Permission[] }> = [
  { id: "post-update", label: "Post an update", icon: "PenLine", anyOf: ["post.draft"] },
  { id: "record-gift", label: "Record a gift", icon: "Heart", anyOf: ["donation.manage"] },
  { id: "log-request", label: "Log a request from a call or visit", icon: "Phone", anyOf: ["support.manage", "concern.manage"] },
  { id: "log-concern", label: "Log a concern from a call", icon: "ShieldAlert", anyOf: ["concern.manage"] },
  { id: "book-session", label: "Book a session", icon: "CalendarClock", anyOf: ["appointment.manage"] },
  { id: "add-note", label: "Add a follow-up note", icon: "NotebookPen", anyOf: ["appointment.own"] },
  { id: "write-article", label: "Write an article", icon: "FileText", anyOf: ["post.publish"] },
  { id: "add-report", label: "Add a report", icon: "FilePlus", anyOf: ["resource.manage"] },
  { id: "upload-media", label: "Upload photos", icon: "Upload", anyOf: ["media.manage", "post.draft"] },
  { id: "invite", label: "Invite someone", icon: "UserPlus", anyOf: ["staff.manage"] },
];

/** Quick actions this person may start, in the order admin-ux §3.4 lists them. */
export function quickActionsFor(v: Pick<ShellViewer, "perms">): Array<{ id: GlobalSheet; label: string; icon: string }> {
  const perms = toSet(v.perms);
  return QUICK_ACTIONS.filter((a) => a.anyOf.some((p) => perms.has(p))).map(({ id, label, icon }) => ({ id, label, icon }));
}
