import "server-only";

// The Inbox query (admin-ux §6.3, §6.2 "Needs you"; PLAN D83). One small query per kind this person
// triages, run in parallel, merged and ordered by urgency then age. Rows are InboxItem DTOs built
// field by field: never a spread of a record. Concern rows carry only the reference, risk, status and
// dates (concern isolation, §5.5 rule 3): their title is "Safeguarding concern" and the preview is
// always "Details are restricted". Called through records.ts (listInbox) and the Today page.

import type { InboxItem, Page, Urgency } from "@/lib/model/dto";
import type { ContactCategory, CountryCode, Millis, Uid } from "@/lib/model/enums";
import { CONTACT_CATEGORY_LABEL, FREQUENCY_LABEL, IN_KIND_CATEGORY_LABEL, PARTNERSHIP_TYPE_LABEL, STORY_SUBMITTER_ROLE_LABEL, SUPPORT_CATEGORY_LABEL, VOLUNTEER_INTEREST_LABEL } from "@/lib/model/labels";
import { formatMoney } from "@/lib/money";
import type { RecordKind } from "@/lib/model/refs";
import { FLOWS } from "@/lib/model/flows";
import { OPEN_STATUSES, type Workflow } from "@/lib/model/status";
import type { Viewer } from "@/lib/model/viewer";
import { contactCategoriesFor, has, programmeFilterFor } from "@/lib/server/auth/permissions";
import { getStore } from "@/lib/server/db";
import { C, docPath, type CollectionKey } from "@/lib/server/db/collections";
import type { Filter, WithId } from "@/lib/server/db/store";
import { log } from "@/lib/server/log";
import { tryOpenField } from "@/lib/server/security/seal";
import { clampLimit, staffRefs } from "./_shared";

export type InboxTab = "new" | "later" | "mine";

/** The Inbox "Type" chips (admin-ux §6.3). */
export const INBOX_KINDS = ["requests", "concerns", "gifts", "inkind", "reports", "volunteers", "partners", "messages", "stories"] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

export function isInboxKind(v: unknown): v is InboxKind {
  return typeof v === "string" && (INBOX_KINDS as readonly string[]).includes(v);
}

type Raw = Record<string, unknown> & {
  status?: string;
  createdAt?: Millis;
  lastActivityAt?: Millis;
  assignedTo?: Uid | null;
  snoozedUntil?: Millis | null;
  seenBy?: Uid[];
  archived?: boolean;
};

type Source = {
  kind: InboxKind;
  collection: CollectionKey;
  workflow: Workflow;
  /** Filters for the "new" tab (the kind's first status). */
  first: Filter[];
  /** Open statuses for the "mine" and "later" tabs. */
  open: readonly string[];
  /** Extra filters every tab applies (programme scope, contact categories, gift kind). */
  scope: Filter[];
  map: (r: WithId<Raw>, ctx: MapCtx) => Omit<InboxItem, "unread" | "assignee" | "snoozedUntil" | "lastActivityAt" | "createdAt" | "status" | "ref"> | null;
};

type MapCtx = { uid: Uid };

const DAY = 86_400_000;
const PER_KIND = 60;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** "Fatou Ceesay" → "Fatou C."; organisations stay whole. */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Someone";
  if (parts.length === 1) return parts[0]!.slice(0, 30);
  return `${parts[0]!.slice(0, 24)} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

function clip(text: string, max = 90): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function country(v: unknown): CountryCode | undefined {
  return typeof v === "string" && /^[a-z]{2}$/.test(v) ? (v as CountryCode) : undefined;
}

function sources(v: Viewer): Source[] {
  const out: Source[] = [];
  const notArchived: Filter = { field: "archived", op: "==", value: false };

  if (has(v, "support.manage") || has(v, "support.read")) {
    const scope: Filter[] = [];
    const programmes = programmeFilterFor(v);
    if (programmes && !programmes.length) {
      // No programmes in scope: nothing to triage.
    } else {
      if (programmes) scope.push(programmes.length === 1 ? { field: "programmeId", op: "==", value: programmes[0] } : { field: "programmeId", op: "in", value: programmes });
      out.push({
        kind: "requests",
        collection: "supportRequests",
        workflow: "support",
        first: [notArchived, { field: "status", op: "==", value: FLOWS.support.initial }],
        open: OPEN_STATUSES.support,
        scope,
        map: (r) => {
          const applicant = obj(r.applicant);
          const urgency: Urgency = r.urgency === "high" ? "urgent" : r.urgency === "medium" ? "soon" : "normal";
          const explanation = tryOpenField<string>(docPath("supportRequests", r.id), "explanation", r.explanation as never);
          const pref = str(applicant.preferredContact);
          return {
            kind: "support",
            workflow: "support",
            title: SUPPORT_CATEGORY_LABEL[r.category as keyof typeof SUPPORT_CATEGORY_LABEL] ?? "Support request",
            who: shortName(str(applicant.fullName)),
            country: country(applicant.country),
            preview: explanation ? clip(explanation) : "",
            urgency,
            restricted: false,
            ...(pref === "phone" || pref === "whatsapp" || pref === "sms" || pref === "email" ? { contactPreference: pref } : {}),
            nextStep: r.status === "new" ? { label: "Take it", action: "take" } : { label: "Open", action: "open" },
          };
        },
      });
    }
  }

  if (has(v, "concern.read")) {
    out.push({
      kind: "concerns",
      collection: "safeguardingConcerns",
      workflow: "concern",
      first: [notArchived, { field: "status", op: "==", value: FLOWS.concern.initial }],
      open: OPEN_STATUSES.concern,
      scope: [],
      map: (r) => {
        const risk = (r.riskLevel ?? null) as InboxItem["risk"];
        const urgency: Urgency = risk === "immediate" ? "immediate" : risk === "high" ? "urgent" : "soon";
        return {
          kind: "concern",
          workflow: "concern",
          title: "Safeguarding concern",
          who: "Restricted",
          preview: "Details are restricted",
          urgency,
          restricted: true,
          risk,
          nextStep: { label: "Open", action: "open" },
        };
      },
    });
  }

  if (has(v, "donation.manage") || has(v, "donation.read")) {
    for (const k of ["gifts", "inkind"] as const) {
      const inKind = k === "inkind";
      out.push({
        kind: k,
        collection: "donations",
        workflow: inKind ? "inkind" : "donation",
        first: [{ field: "status", op: "==", value: "pledged" }],
        open: inKind ? OPEN_STATUSES.inkind.filter((s) => s !== "allocated") : OPEN_STATUSES.donation.filter((s) => s !== "allocated"),
        scope: [{ field: "kind", op: "==", value: inKind ? "in_kind" : "cash" }],
        map: (r) => {
          const donor = obj(r.donor);
          const who = str(donor.donorType) === "organisation" && str(donor.organisationName) ? str(donor.organisationName) : shortName(str(donor.fullName));
          if (inKind) {
            const ik = obj(r.inKind);
            const cats = Array.isArray(ik.categories) ? (ik.categories as string[]) : [];
            const label = cats.map((c) => IN_KIND_CATEGORY_LABEL[c as keyof typeof IN_KIND_CATEGORY_LABEL] ?? c).join(", ");
            return {
              kind: "inkind" as RecordKind,
              workflow: "inkind",
              title: `In-kind offer${label ? ` · ${label}` : ""}`,
              who,
              country: country(donor.country),
              preview: clip(str(ik.description)),
              urgency: "normal",
              restricted: false,
              nextStep: { label: "Arrange", action: "open" },
            };
          }
          const cash = obj(r.cash);
          const amount = obj(cash.amount);
          const money = typeof amount.amountMinor === "number" && typeof amount.currency === "string" ? formatMoney(amount as never) : "";
          const freq = str(r.frequency);
          const freqLabel = freq && freq !== "one_time" ? ` ${(FREQUENCY_LABEL[freq as keyof typeof FREQUENCY_LABEL] ?? freq).toLowerCase()}` : "";
          return {
            kind: "gift" as RecordKind,
            workflow: "donation",
            title: r.status === "pledged" ? "Pledge to confirm" : "Gift",
            who,
            country: country(donor.country),
            preview: clip(`${money}${freqLabel}${str(r.comments) ? ` · ${str(r.comments)}` : ""}`),
            urgency: "normal",
            restricted: false,
            nextStep: { label: r.status === "pledged" ? "Confirm" : "Open", action: "open" },
          };
        },
      });
    }
  }

  if (has(v, "contact.manage") || has(v, "contact.read")) {
    const cats = contactCategoriesFor(v);
    if (cats.length) {
      out.push({
        kind: "messages",
        collection: "contactMessages",
        workflow: "contact",
        first: [{ field: "status", op: "==", value: FLOWS.contact.initial }],
        open: OPEN_STATUSES.contact,
        scope: [cats.length === 1 ? { field: "category", op: "==", value: cats[0] } : { field: "category", op: "in", value: cats }],
        map: (r) => ({
          kind: "message",
          workflow: "contact",
          title: `Message · ${CONTACT_CATEGORY_LABEL[r.category as ContactCategory] ?? "General"}`,
          who: shortName(str(r.fullName)),
          country: country(r.country),
          preview: clip(str(r.subject) || str(r.message)),
          urgency: "normal",
          restricted: false,
          nextStep: { label: "Reply", action: "open" },
        }),
      });
    }
  }

  if (has(v, "volunteer.manage") || has(v, "volunteer.read")) {
    out.push({
      kind: "volunteers",
      collection: "volunteerApplications",
      workflow: "volunteer",
      first: [notArchived, { field: "status", op: "==", value: FLOWS.volunteer.initial }],
      open: OPEN_STATUSES.volunteer,
      scope: [],
      map: (r) => {
        const a = obj(r.applicant);
        const interests = Array.isArray(r.interests) ? (r.interests as string[]) : [];
        const first = interests[0] ? (VOLUNTEER_INTEREST_LABEL[interests[0] as keyof typeof VOLUNTEER_INTEREST_LABEL] ?? interests[0]) : "";
        return {
          kind: "volunteer",
          workflow: "volunteer",
          title: `Volunteer${first ? `: ${first}` : ""}`,
          who: shortName(str(a.fullName)),
          country: country(a.country),
          preview: clip(str(r.motivation)),
          urgency: "normal",
          restricted: false,
          nextStep: r.status === "submitted" ? { label: "Start screening", action: "open" } : { label: "Open", action: "open" },
        };
      },
    });
  }

  if (has(v, "partnership.manage") || has(v, "partnership.read")) {
    out.push({
      kind: "partners",
      collection: "partnershipEnquiries",
      workflow: "partnership",
      first: [notArchived, { field: "status", op: "==", value: FLOWS.partnership.initial }],
      open: OPEN_STATUSES.partnership,
      scope: [],
      map: (r) => {
        const org = obj(r.organisation);
        return {
          kind: "partner",
          workflow: "partnership",
          title: `Partnership · ${PARTNERSHIP_TYPE_LABEL[r.partnershipType as keyof typeof PARTNERSHIP_TYPE_LABEL] ?? "Enquiry"}`,
          who: str(org.name).slice(0, 60) || "An organisation",
          country: country(org.country),
          preview: clip(str(r.message)),
          urgency: "normal",
          restricted: false,
          nextStep: { label: "Open", action: "open" },
        };
      },
    });
  }

  if (has(v, "reportRequest.manage") || has(v, "reportRequest.read")) {
    out.push({
      kind: "reports",
      collection: "reportRequests",
      workflow: "reportRequest",
      first: [{ field: "status", op: "==", value: FLOWS.reportRequest.initial }],
      open: OPEN_STATUSES.reportRequest,
      scope: [],
      map: (r) => {
        const req = obj(r.requester);
        return {
          kind: "reportRequest",
          workflow: "reportRequest",
          title: `Report request · ${clip(str(r.resourceTitle), 50)}`,
          who: str(req.organisation) ? `${shortName(str(req.fullName))}, ${clip(str(req.organisation), 30)}` : shortName(str(req.fullName)),
          country: country(req.country),
          preview: clip(str(r.reason)),
          urgency: "normal",
          restricted: false,
          nextStep: { label: "Review", action: "open" },
        };
      },
    });
  }

  if (has(v, "storySubmission.manage")) {
    out.push({
      kind: "stories",
      collection: "storySubmissions",
      workflow: "storySubmission",
      first: [notArchived, { field: "status", op: "==", value: FLOWS.storySubmission.initial }],
      open: OPEN_STATUSES.storySubmission,
      scope: [],
      map: (r) => ({
        kind: "story",
        workflow: "storySubmission",
        title: `Story from ${(STORY_SUBMITTER_ROLE_LABEL[r.submitterRole as keyof typeof STORY_SUBMITTER_ROLE_LABEL] ?? "someone").toLowerCase()}`,
        who: r.publishWithoutName ? "Name withheld" : str(r.displayName) || "Someone",
        country: country(r.country),
        preview: clip(str(r.story)),
        urgency: "normal",
        restricted: false,
        nextStep: { label: "Read", action: "open" },
      }),
    });
  }
  return out;
}

const URGENCY_RANK: Record<Urgency, number> = { immediate: 0, urgent: 1, soon: 2, normal: 3 };

/** Collections with the (archived, snoozedUntil) index: the only ones that can be put aside. */
const SNOOZABLE: ReadonlySet<CollectionKey> = new Set(["supportRequests", "contactMessages", "volunteerApplications", "partnershipEnquiries", "storySubmissions"]);

function matches(r: Raw, filters: Filter[]): boolean {
  return filters.every((f) => {
    const value = r[f.field];
    if (f.op === "==") return value === f.value;
    if (f.op === "in") return (f.value as unknown[]).includes(value);
    return true;
  });
}

/**
 * One kind's rows for a tab, each query shaped to an index that exists (firestore.indexes.json):
 *   new   → the kind's first-status filters + scope, newest first
 *   mine  → (assignedTo, status, lastActivityAt↓); scope filtered here
 *   later → (archived, snoozedUntil) for kinds that can be put aside; status and scope filtered here
 */
async function readSource(s: Source, tab: InboxTab, uid: Uid, now: Millis): Promise<Array<WithId<Raw>>> {
  try {
    if (tab === "new") {
      const page = await getStore().list<Raw>(C[s.collection], { where: [...s.first, ...s.scope], orderBy: { field: "createdAt", dir: "desc" }, limit: PER_KIND });
      return page.items;
    }
    if (tab === "mine") {
      const page = await getStore().list<Raw>(C[s.collection], {
        where: [
          { field: "assignedTo", op: "==", value: uid },
          { field: "status", op: "in", value: [...s.open] },
        ],
        orderBy: { field: "lastActivityAt", dir: "desc" },
        limit: PER_KIND,
      });
      return page.items.filter((r) => matches(r, s.scope));
    }
    if (!SNOOZABLE.has(s.collection)) return [];
    const page = await getStore().list<Raw>(C[s.collection], {
      where: [
        { field: "archived", op: "==", value: false },
        { field: "snoozedUntil", op: ">", value: now },
      ],
      orderBy: { field: "snoozedUntil", dir: "asc" },
      limit: PER_KIND,
    });
    return page.items.filter((r) => typeof r.status === "string" && s.open.includes(r.status) && matches(r, s.scope));
  } catch (err) {
    log.warn("dal.inbox.read_failed", { collection: s.collection, tab, err });
    return [];
  }
}

/** Offset cursors ("o:25"): the merged list is small (≤ 60 per kind). */
function offsetOf(cursor: string | null | undefined): number {
  const m = /^o:(\d{1,5})$/.exec(cursor ?? "");
  return m ? Number(m[1]) : 0;
}

/** The merged, ordered Inbox for a viewer the caller has already checked. */
export async function inboxFor(
  v: Viewer,
  opts: { tab?: InboxTab; kind?: InboxKind | null; cursor?: string | null; limit?: number; now?: Millis } = {},
): Promise<Page<InboxItem> & { counts: Partial<Record<InboxKind, number>>; at: Millis }> {
  const tab = opts.tab ?? "new";
  const now = opts.now ?? Date.now();
  const all = sources(v);
  const chosen = opts.kind ? all.filter((s) => s.kind === opts.kind) : all;
  const [rowsBySource, staff] = await Promise.all([Promise.all(chosen.map((s) => readSource(s, tab, v.uid, now))), staffRefs()]);

  const counts: Partial<Record<InboxKind, number>> = {};
  const items: InboxItem[] = [];
  chosen.forEach((s, i) => {
    let n = 0;
    for (const r of rowsBySource[i] ?? []) {
      if (r.archived === true) continue;
      const snoozed = typeof r.snoozedUntil === "number" && r.snoozedUntil > now;
      if (tab === "later" ? !snoozed : snoozed) continue;
      // Gifts and in-kind share a collection; the scope filter separates them, but stay defensive.
      const base = s.map(r, { uid: v.uid });
      if (!base) continue;
      const assignee = typeof r.assignedTo === "string" ? staff.get(r.assignedTo) : undefined;
      items.push({
        ...base,
        ref: r.id,
        status: str(r.status),
        createdAt: typeof r.createdAt === "number" ? r.createdAt : 0,
        lastActivityAt: typeof r.lastActivityAt === "number" ? r.lastActivityAt : typeof r.createdAt === "number" ? r.createdAt : 0,
        unread: !(Array.isArray(r.seenBy) && r.seenBy.includes(v.uid)),
        ...(assignee ? { assignee } : {}),
        ...(snoozed ? { snoozedUntil: r.snoozedUntil as Millis } : {}),
      });
      n++;
    }
    counts[s.kind] = (counts[s.kind] ?? 0) + n;
  });

  // Support requests waiting five days with no first response read as urgent (admin-ux §6.3).
  for (const it of items) {
    if (it.workflow === "support" && it.status === "new" && it.urgency !== "immediate" && now - it.createdAt > 5 * DAY) it.urgency = "urgent";
  }
  items.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || b.createdAt - a.createdAt);

  const limit = clampLimit(opts.limit);
  const start = offsetOf(opts.cursor);
  const slice = items.slice(start, start + limit);
  return { items: slice, nextCursor: start + limit < items.length ? `o:${start + limit}` : null, counts, at: now };
}

/** The Inbox kinds this viewer triages at all (which "Type" chips to show). */
export function inboxKindsFor(v: Viewer): InboxKind[] {
  return [...new Set(sources(v).map((s) => s.kind))];
}
