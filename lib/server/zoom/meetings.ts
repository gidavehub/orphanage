import "server-only";

// Zoom meetings for counselling sessions (integrations §6.2). Without ZOOM_* credentials counsellors
// paste links by hand and these return null (or do nothing). With them, a meeting can be made in one
// click, moved when the session is rescheduled and deleted when it is cancelled. Failures never block
// the session: the counsellor can always paste a link instead.

import type { Millis } from "@/lib/model/enums";
import { features } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { createMeeting, deleteMeeting, startUrl, updateMeeting } from "./client";

export type ZoomMeetingRequest = {
  /** The appointment reference (HVN-AP-…), for logs only; never in the topic. */
  reference: string;
  startsAt: Millis;
  durationMin: number;
  /** IANA timezone of the session. */
  timezone: string;
  /** The counsellor's Zoom user (email or id), or ZOOM_DEFAULT_HOST. */
  hostUser?: string | null;
};

export function zoomApiOn(): boolean {
  return features.zoomApi;
}

/** Creates a Zoom meeting and returns its join URL, or null when the Zoom API is not configured. */
export async function createZoomMeeting(req: ZoomMeetingRequest): Promise<{ joinUrl: string; meetingId: string; passcode: string | null } | null> {
  if (!features.zoomApi) return null;
  return createMeeting({ startsAt: req.startsAt, durationMin: req.durationMin, hostUser: req.hostUser });
}

/** Moves a meeting made through the API (reschedule). Never throws. */
export async function moveZoomMeeting(meetingId: string, startsAt: Millis, durationMin: number): Promise<void> {
  if (!features.zoomApi || !meetingId) return;
  await updateMeeting(meetingId, startsAt, durationMin).catch((err) => log.warn("zoom.update_failed", { err }));
}

/** Deletes a meeting made through the API (cancellation). Never throws. */
export async function removeZoomMeeting(meetingId: string): Promise<void> {
  if (!features.zoomApi || !meetingId) return;
  await deleteMeeting(meetingId).catch((err) => log.warn("zoom.delete_failed", { err }));
}

/** The host start link for the assigned counsellor, fetched fresh; null when unavailable. */
export async function hostStartUrl(meetingId: string): Promise<string | null> {
  if (!features.zoomApi || !meetingId) return null;
  return startUrl(meetingId).catch(() => null);
}
