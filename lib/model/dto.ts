// Client-safe DTOs that the DAL returns and the admin shell, lists and public pages render.
// Built field by field on the server (never a spread of a raw record). Concern rows carry only
// ref, risk, status, age and assignee, and their preview is always "Details are restricted".

import type { EmailTemplateId } from "./email";
import type {
  AgeBand,
  ConsentState,
  CountryCode,
  Currency,
  Millis,
  Money,
  ProgrammeId,
  ReferralOutcome,
  ReferralType,
  ResourceAccess,
  ResourceCategory,
  SupportCategory,
  Uid,
} from "./enums";
import type { Permission, Role } from "./permissions";
import type { RecordKind } from "./refs";
import type { RiskLevel, SponsorProfileStatus, Workflow } from "./status";
import type { UiImage } from "./ui";

/** One page of a cursor-paginated list ("Load more", 25 per page in the admin). */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Derived urgency for Inbox rows and Today (stored urgency stays low | medium | high, D83). */
export type Urgency = "immediate" | "urgent" | "soon" | "normal";

/* ── Staff ─────────────────────────────────────────────────────────────── */

export const STAFF_TONES = ["clay", "cocoa", "forest", "umber", "marigold", "deep"] as const;
export type StaffTone = (typeof STAFF_TONES)[number];

/** A staff member as shown on rows, timelines and pickers. Initials and tone are derived (D91). */
export interface StaffRef {
  uid: Uid;
  name: string;
  initials: string;
  tone: StaffTone;
}

/** Up to two initials from a display name ("Fatou Ceesay" → "FC", "Awa" → "AW"). */
export function staffInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** A stable earth tone for a uid (simple string hash), so a person keeps their colour everywhere. */
export function staffTone(uid: string): StaffTone {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return STAFF_TONES[Math.abs(h) % STAFF_TONES.length];
}

export function toStaffRef(uid: Uid, name: string): StaffRef {
  return { uid, name, initials: staffInitials(name), tone: staffTone(uid) };
}

/** The signed-in person as client components see them (serialisable; no email, no session data). */
export interface ShellViewer {
  uid: Uid;
  displayName: string;
  firstName: string;
  initials: string;
  tone: StaffTone;
  roles: Role[];
  perms: Permission[];
  timezone: string;
  textSize: "normal" | "large";
  mfa: boolean;
  backend: "firestore" | "local";
}

/* ── Inbox, timeline, activity ─────────────────────────────────────────── */

export interface InboxItem {
  ref: string;
  kind: RecordKind;
  workflow: Workflow;
  /** "School fees", "Pledge to confirm", "Volunteer: Education support". Concerns: "Safeguarding concern". */
  title: string;
  /** First name + last initial, "Anonymous", or an organisation name. Concerns: "Restricted". */
  who: string;
  country?: CountryCode;
  /** ≤ 90 characters. Concerns: always "Details are restricted". */
  preview: string;
  urgency: Urgency;
  /** Workflow status id. */
  status: string;
  createdAt: Millis;
  lastActivityAt: Millis;
  assignee?: StaffRef;
  snoozedUntil?: Millis;
  /** True when the viewer has not opened it since the last change (CaseDoc.seenBy). */
  unread: boolean;
  /** True for concerns. */
  restricted: boolean;
  /** Concerns only: the risk level, or null when not yet assessed. */
  risk?: RiskLevel | null;
  /** Phone or WhatsApp follow-up preference shown to staff (D133). */
  contactPreference?: "phone" | "whatsapp" | "sms" | "email";
  nextStep?: { label: string; action: string };
}

export type TimelineKind =
  | "submitted"
  | "status"
  | "assigned"
  | "note"
  | "email"
  | "call"
  | "referral"
  | "document"
  | "session"
  | "allocation"
  | "receipt"
  | "risk"
  | "authority"
  | "system";

export interface ReferralDTO {
  partnerId: string | null;
  partnerName: string;
  type: ReferralType;
  consentToShare: boolean;
  outcome: ReferralOutcome;
  at: Millis;
  note?: string;
}

export interface TimelineEntryDTO {
  id: string;
  ref: string;
  at: Millis;
  actor: StaffRef | { system: string } | { public: true } | { stripe: true };
  kind: TimelineKind;
  /** Notes: plain text (opened on the server only for permitted viewers). */
  text?: string;
  from?: string;
  to?: string;
  email?: { template: EmailTemplateId; subject: string; state: "sent" | "outbox" | "scheduled" | "held" | "failed" | "cancelled" };
  referral?: ReferralDTO;
  restricted?: boolean;
  /** Notes may be edited by their author until this time, then they are locked. */
  editableUntil?: Millis;
}

export type ActivityArea =
  | "auth"
  | "support"
  | "safeguarding"
  | "counselling"
  | "donations"
  | "engagement"
  | "resources"
  | "content"
  | "staff"
  | "settings"
  | "privacy"
  | "export"
  | "system";

export interface ActivityItem {
  id: string;
  at: Millis;
  /** "Fatou moved HVN-SR-2026-0001 to Assigned". Never sensitive content. */
  sentence: string;
  area: ActivityArea;
  ref: string | null;
  sensitive: boolean;
  actor: StaffRef | null;
}

/** Badge counts for the shell (every 30 s). `concernsNew` is present only for people who may see concerns. */
export interface PulseDTO {
  inboxNew: number;
  mine: number;
  updatesUnread: number;
  concernsNew?: number;
  latestAt: Millis | null;
}

export interface IntegrationStatus {
  id: "firebase" | "stripe" | "email" | "ai" | "zoom";
  state: "connected" | "test" | "off" | "problem";
  headline: string;
  meaning: string;
  /** Names of the environment variables involved (never their values). */
  envNames: string[];
  lastError?: string;
}

/* ── Media ─────────────────────────────────────────────────────────────── */

/** One choice in MediaPicker (admin). `illustrative` = AI-generated with people visible (D54). */
export interface MediaPickerItem {
  id: string;
  kind: "image" | "video";
  source: "pipeline" | "upload";
  src: string;
  poster?: string;
  alt: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
  caption?: string;
  peopleVisible: boolean;
  childInImage: boolean;
  aiGenerated: boolean;
  illustrative: boolean;
  placeholder: boolean;
  consent: ConsentState;
  status: "active" | "archived" | "withdrawn";
  /** How many published items use it. */
  usedIn?: number;
}

/* ── Public DTOs (lib/server/public/*) ─────────────────────────────────── */

/** A library item on /resources. Never carries file paths. */
export interface ResourceSummary {
  id: string;
  slug: string;
  title: string;
  category: ResourceCategory;
  access: ResourceAccess;
  shortDescription: string;
  cover: UiImage | null;
  /** Publication date (epoch ms; pages format it). */
  publicationDate: Millis;
  programmeIds: ProgrammeId[];
  language: string;
  file: { format: "pdf"; sizeBytes: number; pageCount: number | null } | null;
  featured: boolean;
  /** Seeded placeholder (e.g. "Annual report 2025"), shown with a placeholder note until replaced. */
  placeholder: boolean;
}

/** /resources/[slug]. Public items get a download link; controlled items only a request link. */
export interface ResourceDetail extends ResourceSummary {
  /** Block[] from lib/content/schema.ts (kept structural here so lib/model never imports content). */
  executiveSummary: unknown[];
  preview: { pageCount: number } | null;
  /** `/api/resources/<slug>/download` for public items; null for controlled ones. */
  downloadHref: string | null;
  /** `/request-a-report?report=<slug>` for controlled items; null for public ones. */
  requestHref: string | null;
}

/** An anonymous sponsorship profile on /get-involved/sponsor (D55). No names, places or medical detail. */
export interface SponsorProfilePublic {
  code: string;
  ageBand: AgeBand;
  category: SupportCategory;
  programmeId: ProgrammeId;
  /** Broad country only, or null. */
  country: CountryCode | null;
  need: string;
  amount: Money;
  period: "one_off" | "per_term" | "per_month" | "per_year";
  sponsorsNeeded: number;
  sponsorsCurrent: number;
  status: Extract<SponsorProfileStatus, "published" | "fully_funded">;
  /** Programme-level update only. */
  lastUpdate: { at: Millis; text: string } | null;
}

/** Per-cause, per-currency totals from `causeTotals/{slug}` (D36). Never summed across currencies. */
export type CauseTotalsByCurrency = Partial<Record<Currency, { raisedMinor: number; gifts: number }>>;
