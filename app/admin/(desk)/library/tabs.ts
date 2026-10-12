// Reports & resources sub-tabs (admin-ux §6.8): Resources · Requests (n), each for the roles that can
// open it. Report managers handle requests; content managers keep the library.

import type { Permission } from "@/lib/model/permissions";

export function libraryTabs(current: "resources" | "requests", can: (p: Permission) => boolean, openRequests?: number) {
  const tabs = [];
  if (can("resource.manage")) tabs.push({ label: "Resources", href: "/admin/library", current: current === "resources" });
  if (can("reportRequest.read") || can("reportRequest.manage")) tabs.push({ label: "Requests", href: "/admin/library/requests", current: current === "requests", ...(openRequests ? { count: openRequests } : {}) });
  return tabs;
}
