import "server-only";

// Cache tags the back end changes on its own (a Stripe payment moves the totals; the morning job
// publishes a scheduled post). Vercel serves the pages, so their 'use cache' entries live in
// Vercel's cache, while /api runs on Cloud Functions, where revalidateTag() reaches only the
// function's own cache (which keeps nothing: functions/no-store-cache.js). So on Google Cloud the
// same tags are also invalidated in Vercel's cache through its REST API (VERCEL_TOKEN, with
// HAVEN_VERCEL_PROJECT_ID and HAVEN_VERCEL_TEAM_ID). Without a token the pages catch up when their
// cache next revalidates (the cacheLife profiles in next.config.ts), and a warning is logged.

import { revalidateTag } from "next/cache";
import { afterResponse } from "@/lib/server/after";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";

/** "max": serve stale while refreshing (revalidateTag(tag, "max")). "now": the next visit waits for fresh data. */
export function expireTags(tags: readonly string[], how: "max" | "now"): void {
  for (const tag of tags) revalidateTag(tag, how === "now" ? { expire: 0 } : "max");
  if (env.onGoogleCloud && tags.length) afterResponse(() => expireOnVercel([...tags], how));
}

async function expireOnVercel(tags: string[], how: "max" | "now"): Promise<void> {
  const { token, projectId, teamId } = env.vercelApi;
  if (!token || !projectId) {
    log.warn("cache.front_end_not_told", { tags: tags.join(","), note: "VERCEL_TOKEN is not set on the function" });
    return;
  }
  const q = new URLSearchParams({ projectIdOrName: projectId, ...(teamId ? { teamId } : {}) });
  const path = how === "now" ? "dangerously-delete-by-tags" : "invalidate-by-tags";
  try {
    const res = await fetch(`https://api.vercel.com/v1/edge-cache/${path}?${q}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tags: tags.join(",") }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log.warn("cache.front_end_refresh_failed", { status: res.status, tags: tags.join(",") });
  } catch (err) {
    log.warn("cache.front_end_refresh_failed", { err, tags: tags.join(",") });
  }
}
