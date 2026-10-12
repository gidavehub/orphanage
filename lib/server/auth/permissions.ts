import "server-only";

// Server-side permission helpers (data-model §6.2–6.4, PLAN D84–D85). The catalogue and role grants
// live in lib/model/permissions.ts (client-safe); this module applies them to a Viewer and to records.
// Denials never reveal that a record exists: assertCan() calls notFound(), which renders the friendly
// NoAccess page in the admin (call it outside try/catch). Route handlers answer 404, never 403.

import { notFound } from "next/navigation";
import type { AuditArea } from "@/lib/model/domain/system";
import type { ContactCategory, ProgrammeId, Uid } from "@/lib/model/enums";
import { contactCategoriesForRoles, type Permission } from "@/lib/model/permissions";
import type { Viewer } from "@/lib/model/viewer";

export function has(v: Viewer, p: Permission): boolean {
  return v.perms.has(p);
}

export function hasAny(v: Viewer, ...anyOf: Permission[]): boolean {
  return anyOf.some((p) => v.perms.has(p));
}

export function hasAll(v: Viewer, ...allOf: Permission[]): boolean {
  return allOf.every((p) => v.perms.has(p));
}

/** Requires at least one of the permissions; otherwise notFound() (no existence leak). */
export function assertCan(v: Viewer, ...anyOf: Permission[]): void {
  if (anyOf.length > 0 && !hasAny(v, ...anyOf)) notFound();
}

/** Same check as a boolean-returning guard, for code paths that answer with ActionResult instead. */
export function can(v: Viewer, ...anyOf: Permission[]): boolean {
  return anyOf.length === 0 || hasAny(v, ...anyOf);
}

/** Appointments: programme officers see every session; counsellors only their own (data-model §6.4). */
export function canOpenAppointment(v: Viewer, appt: { counsellorUid: Uid }): boolean {
  if (v.perms.has("appointment.manage")) return true;
  return v.perms.has("appointment.own") && appt.counsellorUid === v.uid;
}

/** The counsellor may see a phone number for a call only from 24 h before to 24 h after the start. */
export function canSeeCallPhone(v: Viewer, appt: { counsellorUid: Uid; startsAt: number }, now: number): boolean {
  if (v.perms.has("appointment.manage")) return true;
  const day = 24 * 60 * 60_000;
  return appt.counsellorUid === v.uid && now >= appt.startsAt - day && now <= appt.startsAt + day;
}

/** Contact-form categories this person triages (data-model §6.2 routing; super admin: all). */
export function contactCategoriesFor(v: Viewer): ContactCategory[] {
  if (!v.perms.has("contact.read")) return [];
  return contactCategoriesForRoles(v.roles);
}

export function canReadContactCategory(v: Viewer, category: ContactCategory): boolean {
  return contactCategoriesFor(v).includes(category);
}

/** Support requests: a programme officer's queue may be limited to some programmes. */
export function inProgrammeScope(v: Viewer, programmeId: ProgrammeId | null | undefined): boolean {
  if (v.roles.includes("super_admin") || v.programmeScope === "all") return true;
  if (!programmeId) return true;
  return v.programmeScope.includes(programmeId);
}

/** The programmes to filter a queue by, or null for "all". */
export function programmeFilterFor(v: Viewer): ProgrammeId[] | null {
  if (v.roles.includes("super_admin") || v.programmeScope === "all") return null;
  return [...v.programmeScope];
}

const ALL_AREAS: readonly AuditArea[] = [
  "auth",
  "support",
  "safeguarding",
  "counselling",
  "donations",
  "engagement",
  "resources",
  "content",
  "staff",
  "settings",
  "privacy",
  "export",
  "system",
];

/**
 * Activity areas this person may read (Today's "Recent activity", Activity filters). Super admins:
 * all. `audit.read` (viewer audit scope): every area except safeguarding. Safeguarding entries need
 * `audit.read.safeguarding` or `concern.read`. Others: the areas their own work touches.
 */
export function auditAreasFor(v: Viewer): AuditArea[] {
  if (v.roles.includes("super_admin")) return [...ALL_AREAS];
  const out = new Set<AuditArea>();
  if (v.perms.has("audit.read")) for (const a of ALL_AREAS) if (a !== "safeguarding") out.add(a);
  if (v.perms.has("audit.read.safeguarding") || v.perms.has("concern.read")) out.add("safeguarding");
  if (hasAny(v, "support.read", "support.summary")) out.add("support");
  if (hasAny(v, "appointment.manage", "appointment.own")) out.add("counselling");
  if (hasAny(v, "donation.read", "donation.summary", "donation.manage")) out.add("donations");
  if (hasAny(v, "volunteer.read", "partnership.read", "contact.read", "newsletter.read", "volunteer.summary", "partnership.summary", "storySubmission.manage"))
    out.add("engagement");
  if (hasAny(v, "resource.read", "reportRequest.read")) out.add("resources");
  if (hasAny(v, "content.edit", "content.publish", "post.draft", "post.publish", "media.manage")) out.add("content");
  if (v.perms.has("staff.manage")) out.add("staff");
  if (hasAny(v, "settings.manage", "settings.giving")) out.add("settings");
  if (v.perms.has("privacy.manage")) out.add("privacy");
  if (hasAny(v, "audit.export", "support.export", "donation.export", "volunteer.export", "partnership.export", "reportRequest.export", "newsletter.export"))
    out.add("export");
  return ALL_AREAS.filter((a) => out.has(a));
}

/** True when this person may read an audit entry of `area` (others' entries; everyone sees their own). */
export function canReadAuditArea(v: Viewer, area: AuditArea): boolean {
  return auditAreasFor(v).includes(area);
}
