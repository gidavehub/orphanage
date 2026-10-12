// People sub-tabs (admin-ux §6.9): Volunteers · Partners · Directory, each for the roles that can open it.

import type { Permission } from "@/lib/model/permissions";

export function peopleTabs(current: "volunteers" | "partners" | "directory", can: (p: Permission) => boolean, counts: { volunteers?: number; partners?: number } = {}) {
  const tabs = [];
  if (can("volunteer.read") || can("volunteer.summary") || can("volunteer.manage")) tabs.push({ label: "Volunteers", href: "/admin/people", current: current === "volunteers", ...(counts.volunteers ? { count: counts.volunteers } : {}) });
  if (can("partnership.read") || can("partnership.summary") || can("partnership.manage")) tabs.push({ label: "Partners", href: "/admin/people/partners", current: current === "partners", ...(counts.partners ? { count: counts.partners } : {}) });
  if (can("referralPartner.manage")) tabs.push({ label: "Directory", href: "/admin/people/directory", current: current === "directory" });
  return tabs;
}
