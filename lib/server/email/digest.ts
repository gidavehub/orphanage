import "server-only";

// The morning summary (integrations §4.4 `staff_alert_digest`; admin-ux §8): once a day, staff who
// chose "once a day" for any email topic get one email with how many updates are waiting (a count
// and a sign-in link only; never what they are about).

import type { StaffProfile } from "@/lib/model/domain/staff";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import { enqueueEmail } from "@/lib/server/email/outbox";
import { log } from "@/lib/server/log";
import { activeStaff } from "@/lib/server/notify";
import { absolute } from "@/lib/server/url";

/** Queues today's summaries. Returns how many were queued. */
export async function sendDailyDigests(day: string): Promise<number> {
  const staff: Array<WithId<StaffProfile>> = await activeStaff().catch(() => []);
  let queued = 0;
  for (const s of staff) {
    const prefs = s.notificationPrefs?.email ?? {};
    if (!Object.values(prefs).includes("daily_digest")) continue;
    const uid = s.uid ?? s.id;
    try {
      const count = await getStore().count(C.notifications, [
        { field: "recipientUid", op: "==", value: uid },
        { field: "read", op: "==", value: false },
      ]);
      if (count === 0) continue;
      const r = await enqueueEmail({ template: "staff_alert_digest", toStaffUids: [uid], vars: { count, link: absolute("/admin") }, dedupeKey: `${day}~${uid}` });
      if (!r.deduped) queued++;
    } catch (err) {
      log.warn("digest.failed", { err });
    }
  }
  return queued;
}
