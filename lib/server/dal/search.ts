import "server-only";

// Find (admin-ux §3.5). A typed reference opens that record if this person may open it; otherwise
// the words are matched against each record's `searchTokens` (names, email, phone tail: data-model
// §8.5) across the collections this person may read, with the record-level check on every hit.
// Concerns are never searched by words (they store only their reference). Results carry a label,
// the record's stage and a link: never personal data beyond a short name, never narrative.

import { STATUS_LABEL, WORKFLOW_LABEL } from "@/lib/model/labels";
import { adminHrefOfRef, normaliseRef, type RecordKind } from "@/lib/model/refs";
import type { StatusOf } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { hasAny } from "@/lib/server/auth/permissions";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, type CollectionKey } from "@/lib/server/db/collections";
import { queryTokens } from "@/lib/server/db/search-tokens";
import { log } from "@/lib/server/log";
import { canOpenRecord, READ_PERMS, WORKFLOW_OF } from "./_shared";
import { shortName } from "./inbox";
import { findByReference } from "./records";

export type AdminSearchHit = {
  type: "record";
  ref: string;
  recordKind: RecordKind;
  /** "Support request · Under review", or "Safeguarding concern". */
  title: string;
  /** "Fatou C." (never for concerns). */
  who?: string;
  href: string;
  restricted: boolean;
};

type Searchable = Exclude<keyof typeof READ_PERMS, "safeguardingConcerns" | "recurringGifts" | "dataRequests">;

const SEARCHABLE: Searchable[] = ["supportRequests", "donations", "appointments", "reportRequests", "volunteerApplications", "partnershipEnquiries", "contactMessages", "storySubmissions"];

const KIND_OF: Record<Searchable, RecordKind> = {
  supportRequests: "support",
  donations: "gift",
  appointments: "session",
  reportRequests: "reportRequest",
  volunteerApplications: "volunteer",
  partnershipEnquiries: "partner",
  contactMessages: "message",
  storySubmissions: "story",
};

type Raw = Record<string, unknown> & { status?: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function whoOf(c: Searchable, r: Raw): string {
  switch (c) {
    case "supportRequests":
      return shortName(str(obj(r.applicant).fullName));
    case "donations": {
      const d = obj(r.donor);
      return str(d.donorType) === "organisation" && str(d.organisationName) ? str(d.organisationName) : shortName(str(d.fullName));
    }
    case "appointments":
      return str(obj(r.clientSnapshot).displayName).split(/\s+/)[0] ?? "";
    case "reportRequests":
      return shortName(str(obj(r.requester).fullName));
    case "volunteerApplications":
      return shortName(str(obj(r.applicant).fullName));
    case "partnershipEnquiries":
      return str(obj(r.organisation).name).slice(0, 60);
    case "contactMessages":
      return shortName(str(r.fullName));
    case "storySubmissions":
      return r.publishWithoutName ? "Name withheld" : str(r.displayName);
  }
}

async function byWords(v: Viewer, query: string): Promise<AdminSearchHit[]> {
  const token = queryTokens(query)[0];
  if (!token) return [];
  const collections = SEARCHABLE.filter((c) => hasAny(v, ...READ_PERMS[c]));
  const pages = await Promise.all(
    collections.map((c) =>
      getStore()
        .list<Raw>(C[c as CollectionKey], { where: [{ field: "searchTokens", op: "array-contains", value: token }], orderBy: { field: "createdAt", dir: "desc" }, limit: 5 })
        .then((p) => p.items)
        .catch((err) => {
          log.warn("dal.search.read_failed", { collection: c, err });
          return [] as Array<Raw & { id: string }>;
        }),
    ),
  );
  const hits: AdminSearchHit[] = [];
  collections.forEach((c, i) => {
    for (const r of pages[i] ?? []) {
      if (!canOpenRecord(v, c, r)) continue;
      const inKind = c === "donations" && r.kind === "in_kind";
      const workflow = inKind ? "inkind" : WORKFLOW_OF[c];
      const labels = STATUS_LABEL[workflow] as Record<string, string>;
      const stage = labels[(r.status ?? "") as StatusOf<typeof workflow>] ?? "";
      const kind: RecordKind = inKind ? "inkind" : KIND_OF[c];
      hits.push({
        type: "record",
        ref: r.id,
        recordKind: kind,
        title: stage ? `${WORKFLOW_LABEL[workflow]} · ${stage}` : WORKFLOW_LABEL[workflow],
        who: whoOf(c, r) || undefined,
        href: adminHrefOfRef(r.id, kind),
        restricted: false,
      });
    }
  });
  return hits.slice(0, 8);
}

/** At most 8 hits (Find shows 8 records): an exact reference, else name, email or phone matches. */
export async function searchAll(q: string): Promise<AdminSearchHit[]> {
  const v = await requireStaff();
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  if (!query) return [];
  const ref = normaliseRef(query);
  if (ref) {
    const hit = await findByReference(ref);
    if (hit) {
      return [
        {
          type: "record",
          ref: hit.ref,
          recordKind: hit.kind,
          title: hit.restricted || !hit.stage ? hit.title : `${hit.title} · ${hit.stage}`,
          href: hit.href,
          restricted: hit.restricted,
        },
      ];
    }
  }
  if (query.length < 2) return [];
  return byWords(v, query);
}
