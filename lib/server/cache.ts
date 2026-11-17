import "server-only";

// Cache tags the back end changes on its own (a Stripe payment moves the totals; the morning job
// publishes a scheduled post). Pages, Server Actions and /api all run in the one Firebase function
// (functions/index.js), so its cache is the site's cache: revalidateTag() here is enough. (Vercel
// only serves static files and passes everything else on; it keeps no copy of a page.)

import { revalidateTag } from "next/cache";

/** "max": serve stale while refreshing (revalidateTag(tag, "max")). "now": the next visit waits for fresh data. */
export function expireTags(tags: readonly string[], how: "max" | "now"): void {
  for (const tag of tags) revalidateTag(tag, how === "now" ? { expire: 0 } : "max");
}
