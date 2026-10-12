// Media consent records and staff upload staging (data-model §4.6 with PLAN D53, D97). Types only.
// The media assets themselves are content (content-model MediaAsset in lib/content/schema.ts).

import type { BaseDoc, ConsentScope, ConsentState, Millis, Sealed, Uid } from "../enums";

/**
 * mediaConsents/{id}: written guardian consent (§15). Names live ONLY in the signed form, which is
 * a private attachment (mediaConsents/{id}/attachments/{id}). Content `Consent.recordRef` points here.
 */
export interface MediaConsent extends BaseDoc {
  /** Internal code, e.g. "C-014". */
  subjectCode: string;
  guardianRelationship: "mother" | "father" | "guardian" | "self_adult";
  scope: ConsentScope;
  signedAt: Millis;
  /** Default signedAt + 2 years, or the child's 18th birthday if earlier. */
  expiresAt: Millis;
  withdrawnAt: Millis | null;
  /** Safeguarding officer or super admin. */
  verifiedBy: Uid;
  notes: Sealed | null;
  /** Denormalised state, recomputed daily and on every change. */
  consentState: ConsentState;
  /** Media assets covered by this record. */
  mediaIds: string[];
}

/**
 * mediaUploads/{uploadId}: a staff upload that passed validation and re-encoding and waits to be
 * claimed by createMediaAsset / replaceMediaFile (the upload route writes it; content actions read it).
 */
export interface MediaUpload {
  createdAt: Millis;
  /** TTL: unclaimed uploads expire after 1 day. */
  expireAt: Millis;
  uploadedBy: Uid;
  kind: "image" | "pdf";
  mime: "image/webp" | "application/pdf";
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  /** PDFs: pages counted when the upload completes. */
  pageCount?: number | null;
  /** Where the processed file waits (quarantine/{uploadId}). */
  tempPath: string;
  /** EXIF and GPS removed by sharp. */
  metadataStripped: boolean;
  /** Original file name, sanitised, for the library's "file" line. */
  fileName: string;
  status: "pending" | "claimed";
  claimedAt: Millis | null;
  mediaId: string | null;
}
