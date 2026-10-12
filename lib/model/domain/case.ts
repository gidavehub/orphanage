// Shared case subcollections (data-model §4.1). Types only.

import type { BaseDoc, Millis, Sealed, Uid } from "../enums";

/** {parent}/notes/{id}: internal case notes. The body is always sealed. */
export interface CaseNote extends BaseDoc {
  authorUid: Uid;
  authorName: string;
  kind: "note" | "call" | "referral" | "follow_up" | "decision" | "info_received";
  /** Plaintext ≤ 4000 characters before sealing (counsellor notes ≤ 1000). */
  body: Sealed;
  /** The author may edit for 15 minutes; afterwards notes are append-only (corrections are new notes). */
  editableUntil: Millis;
  /** Soft delete by a super admin only, with the reason in the audit log. */
  deletedAt: Millis | null;
}

export type CaseEventActor =
  | { kind: "staff"; uid: Uid; name: string }
  | { kind: "system"; job: string }
  | { kind: "public" }
  | { kind: "stripe" };

export type CaseEventType =
  | "created"
  | "status_changed"
  | "assigned"
  | "unassigned"
  | "note_added"
  | "attachment_added"
  | "attachment_removed"
  | "email_queued"
  | "email_sent"
  | "email_failed"
  | "referral_recorded"
  | "referral_updated"
  | "field_updated"
  | "moved_to_safeguarding"
  | "reopened"
  | "archived"
  | "unarchived"
  | "snoozed"
  | "merged";

/** {parent}/events/{id}: the human-readable case timeline. Never narrative or contact data. */
export interface CaseEvent {
  at: Millis;
  actor: CaseEventActor;
  type: CaseEventType;
  from?: string;
  to?: string;
  /** "Fatou moved this to Assigned". */
  summary: string;
}

export const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIMES)[number];

export type AttachmentLabel = "id_document" | "medical_report" | "school_invoice" | "legal_document" | "photo" | "consent_form" | "other";

/** {parent}/attachments/{id}. Files live privately at private/cases/{collection}/{docId}/{attId}.{ext}. */
export interface AttachmentMeta {
  /** Sanitised: [a-z0-9._-], ≤ 80 characters, original extension kept. */
  fileName: string;
  /** Verified by magic bytes, not by the browser's claim. */
  mime: AllowedMime;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  label: AttachmentLabel;
  uploadedBy: { kind: "public" } | { kind: "staff"; uid: Uid; name: string };
  uploadedAt: Millis;
  /** True when re-encoded by sharp (EXIF and GPS stripped). */
  imageSanitised: boolean;
  scan: { status: "not_scanned" | "clean" | "infected"; at: Millis | null };
  deletedAt: Millis | null;
}

/** safeguardingConcerns/{ref}/actions/{id}: actions and follow-ups (§7 step 6). */
export interface ConcernAction extends BaseDoc {
  kind: "contacted_authority" | "contacted_service" | "home_visit" | "call" | "meeting" | "follow_up_due" | "follow_up_done" | "other";
  at: Millis;
  /** The earliest open dueAt is mirrored to the parent's followUpAt in the same transaction. */
  dueAt: Millis | null;
  doneAt: Millis | null;
  byUid: Uid;
  byName: string;
  detail: Sealed;
}
