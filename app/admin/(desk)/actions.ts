"use server";

import { publishDuePosts } from "@/lib/content/posts";
import { requireStaff } from "@/lib/server/auth/session";

/**
 * Today's client effect (PLAN D110): publishes scheduled posts whose time has come, so a schedule
 * works even before the tick cron is connected. Any signed-in staff member may trigger it; the
 * scheduler itself checks each post's status and time.
 */
export async function publishDueNow(): Promise<{ published: number }> {
  await requireStaff("dashboard.view");
  const r = await publishDuePosts();
  return { published: r.published.length };
}

/** The first-day tour ended (finished or skipped). */
export async function finishTour(): Promise<void> {
  const { markTourDone } = await import("@/lib/server/dal/tour");
  await markTourDone();
}
