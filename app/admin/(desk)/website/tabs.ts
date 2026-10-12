// Website sub-tabs (admin-ux §6.10–6.11, D130): Pages (the studio) · Key information · Before launch.

import type { Permission } from "@/lib/model/permissions";

export function websiteTabs(current: "pages" | "key-info" | "launch" | "changes", can: (p: Permission) => boolean) {
  const tabs = [
    { label: "Pages", href: "/admin/website/home", current: current === "pages" },
    { label: "Key information", href: "/admin/website/key-info", current: current === "key-info" },
    { label: "Changes", href: "/admin/website/changes", current: current === "changes" },
  ];
  if (can("content.publish")) tabs.push({ label: "Before launch", href: "/admin/website/launch", current: current === "launch" });
  return tabs;
}
