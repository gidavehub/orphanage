// Counselling sessions (data-model §4.2.3 with D77). Types only.
// "Waiting for a time" = a counselling support request in approved or support_in_progress with no
// scheduled appointment. "Confirmed / Link sent" = scheduled with reminders.confirmationQueuedAt set.

import type { AgeBand, CaseDoc, Millis, Uid } from "../enums";
import type { AppointmentStatus } from "../status";

export interface Appointment extends CaseDoc<AppointmentStatus> {
  /** HVN-SR-…; never shown to counsellors as a link they can open. */
  supportRef: string;
  /** assignedTo === counsellorUid (kept in both for generic queues). */
  counsellorUid: Uid;
  counsellorName: string;
  /** 1, 2, 3… within the support request. */
  sessionNumber: number;
  startsAt: Millis;
  durationMin: 30 | 45 | 60 | 90;
  /** IANA, for emails ("Africa/Banjul", "Asia/Dhaka"). */
  clientTimezone: string;
  mode: "zoom" | "phone" | "in_person";
  /** Host start URLs are never stored. */
  zoom: { joinUrl: string; meetingId: string | null; passcode: string | null; source: "manual" | "zoom_api" } | null;
  /** Minimal copy at scheduling time, so counsellors never read supportRequests. */
  clientSnapshot: {
    /** First name or initials only. */
    displayName: string;
    forWhom: "child" | "parent_or_caregiver" | "family";
    ageBand: AgeBand;
    language: string;
    /** For system emails; never shown to counsellors. */
    contactEmail: string | null;
    /** Only when mode = phone; the counsellor sees it from 24 h before to 24 h after. */
    phoneForCall: string | null;
    /** ≤ 300, written by the programme officer, non-identifying. */
    reasonSummary: string;
  };
  attendance: {
    status: "attended" | "no_show" | "late_cancel" | "cancelled_by_client" | "cancelled_by_haven";
    recordedBy: Uid;
    recordedAt: Millis;
  } | null;
  reminders: { confirmationQueuedAt: Millis | null; reminder24hQueuedAt: Millis | null; reminder1hQueuedAt: Millis | null };
  /** Follow-up is a field, not a status (D77). */
  followUp: { recommended: boolean; byDate: Millis | null } | null;
  cancelReason: string | null;
  /** Bumped on each reschedule so .ics updates replace the previous invite. */
  icsSequence: number;
}
