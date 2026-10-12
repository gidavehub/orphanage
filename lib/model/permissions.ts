// Roles and permissions (client-safe). Binding source: data-model §6.1–6.2, plus PLAN D47 and D85.
// The server enforces these in lib/server/auth; the admin UI uses them only to hide or grey things.

import type { ContactCategory } from "./enums";

export const ROLES = [
  "super_admin",
  "content_manager",
  "programme_officer",
  "safeguarding_officer",
  "finance_officer",
  "counsellor",
  "report_manager",
  "viewer",
] as const;
export type Role = (typeof ROLES)[number];
export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/** Read scopes a super admin grants to a `viewer` (Viewer/Auditor) account. */
export const VIEWER_SCOPES = ["support_summary", "donations_summary", "donations_detail", "engagement", "content", "audit"] as const;
export type ViewerScope = (typeof VIEWER_SCOPES)[number];

export const ALL_PERMISSIONS = [
  "dashboard.view",
  "support.read",
  "support.manage",
  "support.export",
  "support.summary",
  "concern.read",
  "concern.manage",
  "appointment.manage",
  "appointment.own",
  "donation.read",
  "donation.contact",
  "donation.manage",
  "donation.export",
  "donation.summary",
  "donation.recognition",
  "cause.figures",
  "volunteer.read",
  "volunteer.manage",
  "volunteer.export",
  "volunteer.summary",
  "partnership.read",
  "partnership.manage",
  "partnership.export",
  "partnership.summary",
  "contact.read",
  "contact.manage",
  "newsletter.read",
  "newsletter.export",
  "resource.read",
  "resource.manage",
  "resource.publish",
  "reportRequest.read",
  "reportRequest.manage",
  "reportRequest.export",
  "content.read",
  "content.edit",
  "content.publish",
  "impact.verify",
  "post.draft",
  "post.publish",
  "ai.manage",
  "media.manage",
  "consent.status",
  "consent.manage",
  "sponsor.manage",
  "sponsor.publish",
  "staff.directory",
  "staff.manage",
  "audit.read",
  "audit.read.safeguarding",
  "audit.export",
  "settings.manage",
  "settings.giving",
  "privacy.manage",
  "outbox.read",
  "storySubmission.manage",
  "referralPartner.manage",
  "supporters.send",
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];
export function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (ALL_PERMISSIONS as readonly string[]).includes(v);
}

/**
 * Permissions per role. `"*"` (super admin) expands to every permission, including concern.* and
 * audit.read.safeguarding. D85 grants content.edit/content.publish (plus content.read) to the
 * programme, finance, safeguarding and report roles; the content field groups narrow what each may
 * actually change (lib/content/access.ts). D47: impact.verify for programme and finance officers.
 */
export const ROLE_PERMS: Record<Role, readonly Permission[] | "*"> = {
  super_admin: "*",
  content_manager: [
    "dashboard.view",
    "content.read",
    "content.edit",
    "content.publish",
    "post.draft",
    "post.publish",
    "ai.manage",
    "media.manage",
    "consent.status",
    "resource.read",
    "resource.manage",
    "resource.publish",
    "reportRequest.read",
    "newsletter.read",
    "newsletter.export",
    "contact.read",
    "contact.manage",
    "sponsor.publish",
    "donation.recognition",
    "staff.directory",
    "storySubmission.manage",
    "supporters.send",
  ],
  programme_officer: [
    "dashboard.view",
    "support.read",
    "support.manage",
    "support.export",
    "appointment.manage",
    "volunteer.read",
    "volunteer.manage",
    "volunteer.export",
    "partnership.read",
    "partnership.manage",
    "partnership.export",
    "contact.read",
    "contact.manage",
    "sponsor.manage",
    "post.draft",
    "resource.read",
    "donation.summary",
    "staff.directory",
    "content.read",
    "content.edit",
    "content.publish",
    "impact.verify",
    "referralPartner.manage",
  ],
  safeguarding_officer: [
    "dashboard.view",
    "concern.read",
    "concern.manage",
    "consent.status",
    "consent.manage",
    "audit.read.safeguarding",
    "staff.directory",
    "content.read",
    "content.edit",
    "content.publish",
  ],
  finance_officer: [
    "dashboard.view",
    "donation.read",
    "donation.contact",
    "donation.manage",
    "donation.export",
    "donation.summary",
    "cause.figures",
    "contact.read",
    "contact.manage",
    "staff.directory",
    "content.read",
    "content.edit",
    "content.publish",
    "impact.verify",
    "settings.giving",
  ],
  counsellor: ["dashboard.view", "appointment.own", "resource.read", "staff.directory"],
  report_manager: [
    "dashboard.view",
    "resource.read",
    "reportRequest.read",
    "reportRequest.manage",
    "reportRequest.export",
    "contact.read",
    "contact.manage",
    "staff.directory",
    "content.read",
    "content.edit",
    "content.publish",
  ],
  // + scopes below; never any *.manage or *.contact
  viewer: ["dashboard.view", "staff.directory"],
};

export const VIEWER_SCOPE_PERMS: Record<ViewerScope, readonly Permission[]> = {
  support_summary: ["support.summary"],
  donations_summary: ["donation.summary"],
  // no donation.contact: emails and phones are stripped
  donations_detail: ["donation.summary", "donation.read"],
  engagement: ["volunteer.summary", "partnership.summary"],
  content: ["content.read", "resource.read", "reportRequest.read"],
  // excludes area "safeguarding"
  audit: ["audit.read", "audit.export"],
};

/** Union of every role's permissions, plus viewer scopes when the person holds the `viewer` role. */
export function permsFor(roles: readonly Role[], viewerScopes: readonly ViewerScope[]): ReadonlySet<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) {
    const grant = ROLE_PERMS[role];
    if (!grant) continue;
    if (grant === "*") return new Set(ALL_PERMISSIONS);
    for (const p of grant) out.add(p);
  }
  if (roles.includes("viewer")) {
    for (const scope of viewerScopes) for (const p of VIEWER_SCOPE_PERMS[scope] ?? []) out.add(p);
  }
  return out;
}

export function hasPermission(perms: ReadonlySet<Permission> | readonly Permission[], p: Permission): boolean {
  return Array.isArray(perms) ? perms.includes(p) : (perms as ReadonlySet<Permission>).has(p);
}

export function hasAnyPermission(perms: ReadonlySet<Permission> | readonly Permission[], anyOf: readonly Permission[]): boolean {
  return anyOf.some((p) => hasPermission(perms, p));
}

/** Roles that must use a TOTP sign-in code in Firebase mode (D88). */
export const MFA_REQUIRED_ROLES: readonly Role[] = ["super_admin", "safeguarding_officer", "finance_officer"];

/** Which roles triage each contact-form category (data-model §6.2). Super admins see every category. */
export const CONTACT_OWNERS: Record<ContactCategory, Role[]> = {
  general: ["content_manager", "programme_officer"],
  donation: ["finance_officer"],
  partnership: ["programme_officer"],
  volunteering: ["programme_officer"],
  media: ["content_manager"],
  programme_info: ["programme_officer"],
  resource_request: ["report_manager"],
  technical_support: ["content_manager"],
};

/** Contact categories a person may read, from their roles (super admin: all). */
export function contactCategoriesForRoles(roles: readonly Role[]): ContactCategory[] {
  if (roles.includes("super_admin")) return Object.keys(CONTACT_OWNERS) as ContactCategory[];
  return (Object.keys(CONTACT_OWNERS) as ContactCategory[]).filter((c) => CONTACT_OWNERS[c].some((r) => roles.includes(r)));
}
