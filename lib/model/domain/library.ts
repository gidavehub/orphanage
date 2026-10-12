// Resources and report requests (data-model §4.5 with PLAN D44, D59, D101). Types only.

import type { BaseDoc, CaseDoc, ConsentStamp, CountryCode, Millis, ProgrammeId, ResourceAccess, ResourceCategory, Uid } from "../enums";
import type { ReportRequestStatus, ResourceStatus } from "../status";

/** resources/{id}. Public files live under public/resources/…, controlled files under private/resources/…. */
export interface Resource extends BaseDoc {
  slug: string;
  status: ResourceStatus;
  /** public = instant download; controlled = request and approval. */
  access: ResourceAccess;
  category: ResourceCategory;
  title: string;
  /** ≤ 300 (card). */
  shortDescription: string;
  /** Block[] from lib/content/schema.ts, rendered by components/content/Blocks.tsx (D44). */
  executiveSummary: unknown[];
  coverMediaId: string | null;
  publicationDate: Millis;
  programmeIds: ProgrammeId[];
  language: string;
  /** Null for a request-only placeholder with no file yet (D6). */
  file: { storagePath: string; sizeBytes: number; pageCount: number | null; sha256: string } | null;
  /** Optional sample pages PDF, always public. */
  preview: { storagePath: string; pageCount: number } | null;
  /** Public downloads via /api/resources/[slug]/download. */
  downloadCount: number;
  requestCount: number;
  featured: boolean;
  /** Seeded placeholder (e.g. "Annual report 2025"). */
  placeholder: boolean;
  publishedAt: Millis | null;
  publishedBy: Uid | null;
}

export interface ReportRequest extends CaseDoc<ReportRequestStatus> {
  /** Null when the person asked for a report that is not listed (D59). */
  resourceId: string | null;
  /** Snapshot of the listed title, or the person's description of an unlisted report. */
  resourceTitle: string;
  /** Set for unlisted requests: what they described. */
  requestedTitle: string | null;
  requester: { fullName: string; organisation: string | null; email: string; emailLower: string; country: CountryCode };
  /** ≤ 1500. */
  reason: string;
  consent: ConsentStamp;
  decision: { kind: "approved" | "declined"; by: Uid; at: Millis; note: string | null; declineReasonCode: string | null } | null;
  delivery: {
    /** Random id inside the HMAC token, so a link can be revoked. */
    tokenId: string;
    /** 7 days. */
    expiresAt: Millis;
    /** Set when the outbox accepted the email → status "sent". */
    sentAt: Millis | null;
    downloads: number;
    lastDownloadAt: Millis | null;
    revokedAt: Millis | null;
  } | null;
}
