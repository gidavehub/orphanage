import "server-only";

// Shared helpers for the admin Data Access Layer (PLAN §4.2, §7.5; data-model §6.4). Every exported
// DAL entry point calls requireStaff(...) first; these helpers take the Viewer it returned. Records
// are only ever read through `readRecordFor()`, which loads the record and checks the viewer may see
// it (IDOR: an id from a URL is never trusted). DTOs are built field by field; never a spread of a
// raw record. Concern records are readable only with `concern.read` (concern isolation, §7.5).

import { notFound } from "next/navigation";
import type { StaffProfile } from "@/lib/model/domain/staff";
import { toStaffRef, type Page, type StaffRef } from "@/lib/model/dto";
import type { ContactCategory, Uid } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import { collectionOfRef, kindOfRef, normaliseRef, type RecordKind } from "@/lib/model/refs";
import type { Workflow } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { canOpenAppointment, canReadContactCategory, hasAny, inProgrammeScope } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { docPath, type CollectionKey } from "@/lib/server/db/collections";
import type { Page as StorePage, WithId } from "@/lib/server/db/store";
import { activeStaff } from "@/lib/server/notify";

/* ── Masking (admin-ux §9.2 Masked; only requester/reporter contact is masked, D125) ─────────── */

const DOT = "•";

/** "fatou.ceesay@gmail.com" → "f•••@gmail.com". Unparseable input is fully masked. */
export function maskEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  const at = e.lastIndexOf("@");
  if (at < 1) return e ? DOT.repeat(6) : "";
  return `${e[0]}${DOT.repeat(3)}${e.slice(at)}`;
}

/** "+220 770 1234" → "+220 ••• ••34": keeps the country code and the last two digits only. */
export function maskPhone(phone: string | null | undefined): string {
  const p = (phone ?? "").trim();
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return DOT.repeat(6);
  const cc = p.startsWith("+") ? `+${digits.slice(0, digits.length > 10 ? 3 : 1)} ` : "";
  return `${cc}${DOT.repeat(3)} ${DOT.repeat(2)}${digits.slice(-2)}`;
}

/* ── Paging ─────────────────────────────────────────────────────────────── */

/** Admin lists load 25 at a time with "Load more" (D124). */
export const PAGE_SIZE = 25;

export function clampLimit(limit: number | undefined, max = 100): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return PAGE_SIZE;
  return Math.min(max, Math.max(1, Math.trunc(limit)));
}

/** Maps a store page to a DTO page. `map` may drop items by returning null. */
export function pageOf<T, U>(page: StorePage<T>, map: (item: WithId<T>) => U | null): Page<U> {
  const items: U[] = [];
  for (const item of page.items) {
    const dto = map(item);
    if (dto !== null) items.push(dto);
  }
  return { items, nextCursor: page.nextCursor };
}

export function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null };
}

/* ── Records by reference ───────────────────────────────────────────────── */

type RecordCollection = Extract<
  CollectionKey,
  | "supportRequests"
  | "safeguardingConcerns"
  | "donations"
  | "recurringGifts"
  | "appointments"
  | "reportRequests"
  | "volunteerApplications"
  | "partnershipEnquiries"
  | "contactMessages"
  | "dataRequests"
  | "storySubmissions"
>;

/** Who may open a record of each collection at all (the record-level check comes after). */
export const READ_PERMS: Record<RecordCollection, Permission[]> = {
  supportRequests: ["support.read", "support.summary", "support.manage"],
  safeguardingConcerns: ["concern.read"],
  // donation.summary is totals only (data-model §8): single gifts and donor names need donation.read.
  donations: ["donation.read", "donation.manage"],
  recurringGifts: ["donation.read", "donation.manage"],
  appointments: ["appointment.manage", "appointment.own"],
  reportRequests: ["reportRequest.read", "reportRequest.manage"],
  volunteerApplications: ["volunteer.read", "volunteer.summary", "volunteer.manage"],
  partnershipEnquiries: ["partnership.read", "partnership.summary", "partnership.manage"],
  contactMessages: ["contact.read", "contact.manage"],
  dataRequests: ["privacy.manage"],
  storySubmissions: ["storySubmission.manage"],
};

export const WORKFLOW_OF: Record<RecordCollection, Workflow> = {
  supportRequests: "support",
  safeguardingConcerns: "concern",
  donations: "donation",
  recurringGifts: "recurring",
  appointments: "appointment",
  reportRequests: "reportRequest",
  volunteerApplications: "volunteer",
  partnershipEnquiries: "partnership",
  contactMessages: "contact",
  dataRequests: "dataRequest",
  storySubmissions: "storySubmission",
};

type RawRecord = Record<string, unknown> & {
  status?: string;
  kind?: string;
  programmeId?: string;
  category?: ContactCategory;
  counsellorUid?: Uid;
};

/** True when this viewer may open this record (collection permission + record-level rules). */
export function canOpenRecord(v: Viewer, collection: RecordCollection, rec: RawRecord): boolean {
  if (!hasAny(v, ...READ_PERMS[collection])) return false;
  switch (collection) {
    case "supportRequests":
      return inProgrammeScope(v, (rec.programmeId as never) ?? null);
    case "appointments":
      return typeof rec.counsellorUid === "string" && canOpenAppointment(v, { counsellorUid: rec.counsellorUid });
    case "contactMessages":
      return !!rec.category && canReadContactCategory(v, rec.category);
    default:
      return true;
  }
}

export type LoadedRecord = {
  ref: string;
  collection: RecordCollection;
  kind: RecordKind;
  workflow: Workflow;
  path: string;
  record: WithId<RawRecord>;
};

/**
 * Loads a record by its reference for this viewer, or null when it does not exist OR the viewer may
 * not open it (the two are indistinguishable on purpose: no existence leak, D84).
 */
export async function readRecordFor(v: Viewer, input: string): Promise<LoadedRecord | null> {
  const ref = normaliseRef(input);
  if (!ref) return null;
  const collection = collectionOfRef(ref) as RecordCollection | null;
  if (!collection || !(collection in READ_PERMS)) return null;
  // Cheap permission check before any read: concern refs are never even looked up without concern.read.
  if (!hasAny(v, ...READ_PERMS[collection])) return null;
  const path = docPath(collection, ref);
  const record = await getStore().get<RawRecord>(path);
  if (!record || !canOpenRecord(v, collection, record)) return null;
  const kind: RecordKind = collection === "donations" && record.kind === "in_kind" ? "inkind" : (kindOfRef(ref) ?? "support");
  const workflow: Workflow = collection === "donations" && record.kind === "in_kind" ? "inkind" : WORKFLOW_OF[collection];
  return { ref, collection, kind, workflow, path, record };
}

/** Like readRecordFor, but renders the friendly NoAccess page instead of returning null. */
export async function loadForViewer(v: Viewer, input: string): Promise<LoadedRecord> {
  const loaded = await readRecordFor(v, input);
  if (!loaded) notFound();
  return loaded;
}

/* ── Staff names ────────────────────────────────────────────────────────── */

/** uid → StaffRef for every active staff member (names on rows, timelines and pickers). */
export async function staffRefs(): Promise<Map<Uid, StaffRef>> {
  const staff = await activeStaff();
  return new Map(staff.map((s: WithId<StaffProfile>) => [s.uid ?? s.id, toStaffRef(s.uid ?? s.id, s.displayName)]));
}

/** The person NoAccess tells people to ask: the earliest active super admin's first name. */
export async function askAdminName(): Promise<string | null> {
  await requireStaff();
  try {
    const admins = (await activeStaff())
      .filter((s) => Array.isArray(s.roles) && s.roles.includes("super_admin"))
      // Real accounts before practice ones, then the longest-standing first.
      .sort((a, b) => Number(!!a.isSample) - Number(!!b.isSample) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const first = admins[0]?.displayName?.trim().split(/\s+/)[0];
    return first || null;
  } catch {
    return null;
  }
}

