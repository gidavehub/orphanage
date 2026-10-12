import "server-only";

// The first-day tour state (admin-ux §6.18): staff/{uid}.tourDoneAt. Read on Today, written when the
// person finishes or skips the tour. Only the person's own record is ever touched.

import type { StaffProfile } from "@/lib/model/domain/staff";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { log } from "@/lib/server/log";

/** True when this person still has the first-day tour to see. Never throws. */
export async function tourPending(): Promise<boolean> {
  const v = await requireStaff();
  try {
    const me = await getStore().get<StaffProfile>(docPath("staff", v.uid));
    return !!me && !me.tourDoneAt;
  } catch (err) {
    log.warn("dal.tour.read_failed", { err });
    return false;
  }
}

/** Marks the tour as done for the signed-in person. */
export async function markTourDone(): Promise<void> {
  const v = await requireStaff();
  try {
    await getStore().update(docPath("staff", v.uid), { tourDoneAt: Date.now() });
  } catch (err) {
    log.warn("dal.tour.write_failed", { err });
  }
}
