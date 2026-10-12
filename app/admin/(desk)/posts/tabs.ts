// Posts sub-tabs (admin-ux §6.12): Posts · Topics & milestones (the monthly plan).

import type { Permission } from "@/lib/model/permissions";

export function postsTabs(current: "posts" | "plan", can: (p: Permission) => boolean) {
  const tabs = [{ label: "Posts", href: "/admin/posts", current: current === "posts" }];
  if (can("post.publish") || can("ai.manage")) tabs.push({ label: "Topics & milestones", href: "/admin/posts/plan", current: current === "plan" });
  return tabs;
}
