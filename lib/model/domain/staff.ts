// Staff accounts, invitations, sessions and in-app notifications
// (data-model §4.7 with PLAN D86, D88, D91, D92). Types only.

import type { BaseDoc, Millis, ProgrammeId, Uid } from "../enums";
import type { Role, ViewerScope } from "../permissions";

export type NotificationTopic = "inbox" | "handoffs" | "sessions" | "drafts";
export type NotificationDelivery = "instant" | "daily_digest" | "off";

/** staff/{uid}. "Paused" in the admin is `suspended`; "invited" is derived from invitations (D91). */
export interface StaffProfile extends BaseDoc {
  uid: Uid;
  email: string;
  emailLower: string;
  displayName: string;
  /** At least one. Permissions are the union of the roles. */
  roles: Role[];
  /** Used only when roles include "viewer". */
  viewerScopes: ViewerScope[];
  /** Programme officer queue filter; default "all". */
  programmeScope: ProgrammeId[] | "all";
  status: "active" | "suspended" | "deactivated";
  /** required = role-derived (super admin, safeguarding, finance). */
  mfa: { required: boolean; enrolled: boolean; enrolledAt: Millis | null };
  counsellor: { languages: string[]; bio: string | null; maxPerWeek: number; acceptingClients: boolean } | null;
  notificationPrefs: { email: Record<NotificationTopic, NotificationDelivery>; inApp: boolean };
  /** IANA timezone for staff-facing dates ("Africa/Banjul", "America/Los_Angeles"). */
  timezone: string;
  textSize: "normal" | "large";
  tourDoneAt: Millis | null;
  /** A counsellor's own Zoom room, offered when booking. */
  zoomPersonalLink: string | null;
  avatarMediaId: string | null;
  lastSignInAt: Millis | null;
  /** Any session issued before this is rejected. */
  sessionsRevokedAt: Millis | null;
  invitedBy: Uid | null;
  authProvider: "password" | "google" | "local";
  isSample?: true;
}

/** invitations/{sha256(token)}. */
export interface Invitation {
  email: string;
  emailLower: string;
  displayName: string;
  roles: Role[];
  viewerScopes: ViewerScope[];
  invitedBy: Uid;
  createdAt: Millis;
  /** +72 hours. */
  expiresAt: Millis;
  acceptedAt: Millis | null;
  revokedAt: Millis | null;
  createdUid: Uid | null;
  /** TTL +30 days. */
  expireAt: Millis;
}

/**
 * staffSessions/{id} (Firebase mode) or an entry in .data/auth/sessions.json (local mode): backs the
 * Me › Devices list (D92). A coarse device label only; never raw IPs or user agents.
 */
export interface StaffSession {
  uid: Uid;
  createdAt: Millis;
  expiresAt: Millis;
  authTime: Millis;
  lastSeenAt: Millis;
  /** "Chrome on Windows", "Safari on iPhone". */
  device: string | null;
  /** "Keep me signed in" was ticked. */
  remember: boolean;
  provider: "firebase" | "local";
  revokedAt: Millis | null;
}

/** notifications/{id}: in-app updates (TTL 90 days). Titles are never sensitive. */
export interface StaffNotification {
  recipientUid: Uid;
  kind: "new_case" | "assigned_to_you" | "status_changed" | "follow_up_due" | "concern_alert" | "appointment_soon" | "mention" | "system";
  /** "New safeguarding item needs review". */
  title: string;
  /** /admin/… */
  href: string;
  priority: "normal" | "urgent";
  read: boolean;
  createdAt: Millis;
  readAt: Millis | null;
  expireAt: Millis;
}
