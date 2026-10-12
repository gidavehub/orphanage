import "server-only";

// Practice data (PLAN §5.2 F2, data-model §9.3, admin-ux §14). Local practice mode only (devOnly
// rules: backend local and not on Vercel). Idempotent: settings/seed records each finished block, so
// a second run creates nothing; a crash part-way resumes at the next unfinished block.
//
// Creates one staff account per role (<role>@haven.test, password LOCAL_SEED_PASSWORD or chips only),
// the settings documents, and `isSample: true` records across every area: support requests (two for
// counselling), safeguarding concerns (random references, sealed narratives), appointments, gifts
// (cash and in-kind, pledged to allocated, with receipts and cause totals), recurring gifts,
// volunteers, partnership enquiries, messages, report requests (one for an unlisted report), newsletter
// subscribers (one unconfirmed), story submissions, the referral directory, sponsorship profiles,
// two resources (one public with a tiny generated PDF, one controlled) and in-app notifications.
// People follow Haven's people mix and family rules; no child is ever named; nothing is real.

import { createHash } from "node:crypto";
import type { Appointment } from "@/lib/model/domain/appointment";
import type { ConcernAction } from "@/lib/model/domain/case";
import type { SafeguardingConcern } from "@/lib/model/domain/concern";
import type { ContactMessage, NewsletterSubscriber, PartnershipEnquiry, ReferralPartner, StorySubmission, VolunteerApplication } from "@/lib/model/domain/engagement";
import type { CauseTotals, Donation, DonationAllocation, Donor, RecurringGift } from "@/lib/model/domain/giving";
import type { ReportRequest, Resource } from "@/lib/model/domain/library";
import {
  DEFAULT_FORMS_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_ORG_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_RETENTION_SETTINGS,
} from "@/lib/model/domain/settings";
import type { SponsorProfile } from "@/lib/model/domain/sponsor";
import type { StaffNotification } from "@/lib/model/domain/staff";
import type { SupportRequest } from "@/lib/model/domain/support";
import type {
  AllocationTarget,
  CaseDoc,
  ConsentStamp,
  Currency,
  IntakeSource,
  Millis,
  Money,
  PaymentMethod,
  ProgrammeId,
  RetentionPolicyId,
  SupportCategory,
  Uid,
} from "@/lib/model/enums";
import type { Role, ViewerScope } from "@/lib/model/permissions";
import { audit } from "@/lib/server/audit";
import { createLocalAccount, findLocalAccountByEmail } from "@/lib/server/auth/local";
import { getStore } from "@/lib/server/db";
import { C, docPath, settingsPath, subDocPath } from "@/lib/server/db/collections";
import { newId } from "@/lib/server/db/convert";
import { withLock } from "@/lib/server/db/local-fs";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import type { Tx } from "@/lib/server/db/store";
import { env } from "@/lib/server/env";
import { addEventTx } from "@/lib/server/events";
import { log } from "@/lib/server/log";
import { allocateReference, createConcernWithRandomRef, createWithReference, nextReceiptNumber, nextSponsorCode } from "@/lib/server/references";
import { emailHash } from "@/lib/server/security/hmac";
import { sealField } from "@/lib/server/security/seal";
import { BLOB_PATH, getBlobStore } from "@/lib/server/storage";
import { devAllowed } from "./guard";

export const SEED_VERSION = 2;

export type SeedReport = {
  /** True when this call created anything. */
  seeded: boolean;
  /** True when every block had already run. */
  alreadySeeded: boolean;
  version: number;
  /** Documents created per collection by this call (zero everywhere on a repeat run). */
  created: Record<string, number>;
  total: number;
  durationMs: number;
};

type SeedState = {
  version: number;
  startedAt: Millis;
  completedAt: Millis | null;
  blocks: Record<string, { at: Millis; refs: string[] }>;
};

/* ── Practice staff (admin-ux §6.1 chips; names follow the people mix) ── */

export const PRACTICE_STAFF: Record<Role, { displayName: string; timezone: string; viewerScopes?: ViewerScope[]; languages?: string[] }> = {
  super_admin: { displayName: "Emanuel Mendy", timezone: "Africa/Banjul" },
  programme_officer: { displayName: "Awa Jallow", timezone: "Africa/Banjul" },
  safeguarding_officer: { displayName: "Maria Sanneh", timezone: "Africa/Banjul" },
  finance_officer: { displayName: "Nur Rahman", timezone: "Africa/Banjul" },
  counsellor: { displayName: "Ayesha Siddiqui", timezone: "Asia/Karachi", languages: ["English", "Urdu"] },
  content_manager: { displayName: "Siti Rahayu", timezone: "Asia/Jakarta" },
  report_manager: { displayName: "Kwame Mensah", timezone: "Africa/Accra" },
  viewer: { displayName: "Farah Haddad", timezone: "Asia/Amman", viewerScopes: ["support_summary", "donations_summary", "engagement", "content"] },
};

/** A second practice account for some roles (v2), so checks can test "not your own" (counsellor B). */
export const PRACTICE_EXTRA_STAFF: Partial<Record<Role, { displayName: string; timezone: string; languages?: string[] }>> = {
  counsellor: { displayName: "Rahul Verma", timezone: "Asia/Kolkata", languages: ["English", "Hindi"] },
};

/** "<role>@haven.test" (D90); the second account of a role is "<role>2@haven.test". */
export function practiceEmail(role: Role, n: 1 | 2 = 1): string {
  return n === 2 ? `${role}2@haven.test` : `${role}@haven.test`;
}

/** Deterministic uid of a seeded practice account. */
export function practiceUid(role: Role, n: 1 | 2 = 1): Uid {
  return n === 2 ? `loc_seed_${role}_2` : `loc_seed_${role}`;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

const DAY = 24 * 60 * 60_000;
const HOUR = 60 * 60_000;

type Counts = Record<string, number>;
type Staff = { uid: Uid; name: string };

function bump(counts: Counts, collection: string, n = 1): void {
  counts[collection] = (counts[collection] ?? 0) + n;
}

function stamp(at: Millis): ConsentStamp {
  return { at, noticeVersion: "privacy-2026-10" };
}

function money(currency: Currency, major: number): Money {
  return { amountMinor: Math.round(major * 100), currency };
}

function caseBase<S extends string>(
  reference: string,
  status: S,
  o: {
    createdAt: Millis;
    statusChangedAt?: Millis;
    assignee?: Staff | null;
    policy: RetentionPolicyId;
    tokens: string[];
    closed?: boolean;
    followUpAt?: Millis | null;
    source?: IntakeSource;
  },
): CaseDoc<S> {
  const changed = o.statusChangedAt ?? o.createdAt;
  return {
    reference,
    status,
    statusChangedAt: changed,
    assignedTo: o.assignee?.uid ?? null,
    assignedName: o.assignee?.name ?? null,
    assignedAt: o.assignee ? changed : null,
    followUpAt: o.followUpAt ?? null,
    snoozedUntil: null,
    seenBy: [],
    lastActivityAt: changed,
    closedAt: o.closed ? changed : null,
    archived: false,
    archivedAt: null,
    tags: [],
    searchTokens: o.tokens,
    retention: { policy: o.policy, retainUntil: null, legalHold: false },
    source: o.source ?? "web_form",
    isSample: true,
    createdAt: o.createdAt,
    updatedAt: changed,
    version: 1,
  };
}

function createdEvent(tx: Tx, path: string, at: Millis, summary: string): void {
  addEventTx(tx, path, { type: "created", actor: { kind: "public" }, summary, at });
}

function movedEvent(tx: Tx, path: string, at: Millis, who: Staff, from: string, to: string, label: string): void {
  addEventTx(tx, path, { type: "status_changed", actor: { kind: "staff", uid: who.uid, name: who.name }, summary: `${who.name.split(" ")[0]} moved this to ${label}`, from, to, at });
}

function firstName(full: string): string {
  return full.split(" ")[0];
}

/** A minimal valid one-page PDF with a title line (practice resources only). */
export function tinyPdf(title: string): Buffer {
  const safe = title.replace(/[()\\]/g, "").slice(0, 80);
  const content = `BT /F1 20 Tf 72 720 Td (${safe}) Tj ET\nBT /F1 11 Tf 72 690 Td (Haven practice document. Not a real report.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/* ── Blocks ────────────────────────────────────────────────────────────── */

type BlockCtx = { now: Millis; counts: Counts; staff: Record<Role, Staff>; refs: Record<string, string[]> };
type Block = { name: string; run: (b: BlockCtx) => Promise<string[]> };

async function seedStaff(b: BlockCtx): Promise<string[]> {
  const out: string[] = [];
  for (const role of Object.keys(PRACTICE_STAFF) as Role[]) {
    const p = PRACTICE_STAFF[role];
    const email = practiceEmail(role);
    if (await findLocalAccountByEmail(email)) continue;
    const uid = await createLocalAccount({
      uid: practiceUid(role),
      email,
      password: env.local.seedPassword,
      displayName: p.displayName,
      roles: [role],
      viewerScopes: p.viewerScopes,
      timezone: p.timezone,
      counsellorLanguages: p.languages,
      isSample: true,
    });
    bump(b.counts, C.staff);
    out.push(uid);
  }
  return out;
}

async function seedExtraStaff(b: BlockCtx): Promise<string[]> {
  const out: string[] = [];
  for (const role of Object.keys(PRACTICE_EXTRA_STAFF) as Role[]) {
    const p = PRACTICE_EXTRA_STAFF[role]!;
    const email = practiceEmail(role, 2);
    if (await findLocalAccountByEmail(email)) continue;
    const uid = await createLocalAccount({
      uid: practiceUid(role, 2),
      email,
      password: env.local.seedPassword,
      displayName: p.displayName,
      roles: [role],
      timezone: p.timezone,
      counsellorLanguages: p.languages,
      isSample: true,
    });
    bump(b.counts, C.staff);
    out.push(uid);
  }
  return out;
}

async function seedSettings(b: BlockCtx): Promise<string[]> {
  const store = getStore();
  const docs: Array<[Parameters<typeof settingsPath>[0], object]> = [
    ["payment", DEFAULT_PAYMENT_SETTINGS],
    ["org", DEFAULT_ORG_SETTINGS],
    ["notifications", DEFAULT_NOTIFICATION_SETTINGS],
    ["forms", DEFAULT_FORMS_SETTINGS],
    ["retention", DEFAULT_RETENTION_SETTINGS],
  ];
  const out: string[] = [];
  for (const [id, data] of docs) {
    const path = settingsPath(id);
    if (await store.get(path)) continue;
    await store.create(path, { ...structuredClone(data), updatedAt: b.now });
    bump(b.counts, C.settings);
    out.push(id);
  }
  return out;
}

async function seedReferralPartners(b: BlockCtx): Promise<string[]> {
  const store = getStore();
  const po = b.staff.programme_officer;
  const partners: Array<Omit<ReferralPartner, "createdAt" | "updatedAt" | "version" | "searchTokens" | "createdBy">> = [
    {
      name: "Westcoast Community Health Centre",
      type: "health",
      services: "Child health check-ups, vaccinations and referrals to specialists.",
      country: "gm",
      locality: "West Coast Region",
      contactName: "Duty nurse",
      email: "referrals@westcoast-health.example.org",
      phone: "+220 700 1001",
      website: null,
      notes: "Accepts walk-ins on weekday mornings.",
      programmeIds: ["medical"],
      active: true,
    },
    {
      name: "Coastal Legal Aid Clinic",
      type: "legal",
      services: "Free advice on guardianship, birth registration and inheritance.",
      country: "gm",
      locality: "Kanifing",
      contactName: "Intake desk",
      email: "help@coastal-legal-aid.example.org",
      phone: "+220 700 1002",
      website: null,
      notes: null,
      programmeIds: ["legal", "protection"],
      active: true,
    },
    {
      name: "Bright Steps Counselling Service",
      type: "psychosocial",
      services: "Talking therapy for children and parents, in English and Wolof.",
      country: "gm",
      locality: "Banjul",
      contactName: null,
      email: "hello@brightsteps.example.org",
      phone: null,
      website: null,
      notes: "Waiting list is usually two weeks.",
      programmeIds: ["psychological"],
      active: true,
    },
  ];
  const out: string[] = [];
  for (const p of partners) {
    const id = newId();
    const doc: ReferralPartner & { isSample: true } = {
      ...p,
      createdBy: po.uid,
      searchTokens: buildSearchTokens({ names: [p.name], email: p.email }),
      createdAt: b.now - 40 * DAY,
      updatedAt: b.now - 40 * DAY,
      version: 1,
      isSample: true,
    };
    await store.create(docPath("referralPartners", id), doc);
    bump(b.counts, C.referralPartners);
    out.push(id);
  }
  return out;
}

type SupportSeed = {
  category: SupportCategory;
  status: SupportRequest["status"];
  name: string;
  relationship: SupportRequest["applicant"]["relationship"];
  email: string | null;
  phone: string | null;
  country: string;
  locality: string;
  preferredContact: SupportRequest["applicant"]["preferredContact"];
  ageBand: NonNullable<SupportRequest["child"]>["ageBand"];
  urgency: SupportRequest["urgency"];
  daysAgo: number;
  explanation: string;
  assigned?: boolean;
};

const PROGRAMME_OF: Record<SupportCategory, ProgrammeId> = {
  education: "education",
  medical: "medical",
  counselling: "psychological",
  legal: "legal",
  food_supplies: "family",
  family_support: "family",
  other: "family",
};

const SUPPORT_LABEL: Record<string, string> = {
  under_review: "Under review",
  more_info_required: "More information needed",
  assigned: "Assigned",
  referred: "Referred",
  approved: "Approved",
  support_in_progress: "Support in progress",
  completed: "Completed",
};

async function seedSupport(b: BlockCtx): Promise<string[]> {
  const po = b.staff.programme_officer;
  const seeds: SupportSeed[] = [
    {
      category: "education",
      status: "new",
      name: "Fatou Ceesay",
      relationship: "parent",
      email: "fatou.c@example.org",
      phone: "+220 700 2001",
      country: "gm",
      locality: "Brikama",
      preferredContact: "whatsapp",
      ageBand: "10-14",
      urgency: "medium",
      daysAgo: 0.1,
      explanation: "We need help with school fees and uniforms for the coming term. My husband lost his work this year.",
    },
    {
      category: "medical",
      status: "under_review",
      name: "Rahul Prasad",
      relationship: "parent",
      email: "rahul.p@example.org",
      phone: null,
      country: "in",
      locality: "Bihar",
      preferredContact: "email",
      ageBand: "5-9",
      urgency: "high",
      daysAgo: 2,
      explanation: "Our son needs an eye operation that the local clinic recommended. We cannot cover the cost of the surgery and travel.",
      assigned: true,
    },
    {
      category: "counselling",
      status: "approved",
      name: "Aminata Sowe",
      relationship: "parent",
      email: "aminata.s@example.org",
      phone: "+221 77 000 2003",
      country: "sn",
      locality: "Thiès",
      preferredContact: "phone",
      ageBand: "15-17",
      urgency: "medium",
      daysAgo: 6,
      explanation: "My daughter has been very withdrawn since we moved. She would like to talk to someone outside the family.",
      assigned: true,
    },
    {
      category: "counselling",
      status: "support_in_progress",
      name: "Nusrat Akter",
      relationship: "guardian",
      email: "nusrat.a@example.org",
      phone: null,
      country: "bd",
      locality: "Khulna Division",
      preferredContact: "email",
      ageBand: "10-14",
      urgency: "medium",
      daysAgo: 20,
      explanation: "After a loss in the family, my nephew is struggling to sleep and to go to school. We would like support for him and for me as his guardian.",
      assigned: true,
    },
    {
      category: "legal",
      status: "more_info_required",
      name: "Omar Khalil",
      relationship: "parent",
      email: "omar.k@example.org",
      phone: "+962 7 9000 2005",
      country: "jo",
      locality: "Irbid",
      preferredContact: "email",
      ageBand: "0-4",
      urgency: "low",
      daysAgo: 9,
      explanation: "We need advice on registering our youngest child's birth, as we lost our documents when we moved.",
      assigned: true,
    },
    {
      category: "food_supplies",
      status: "assigned",
      name: "Dewi Lestari",
      relationship: "parent",
      email: null,
      phone: "+62 812 0000 2006",
      country: "id",
      locality: "East Nusa Tenggara",
      preferredContact: "whatsapp",
      ageBand: "5-9",
      urgency: "high",
      daysAgo: 3,
      explanation: "We are a family of six and need help with food for the next month while my husband recovers from an injury.",
      assigned: true,
    },
    {
      category: "family_support",
      status: "referred",
      name: "Babacar Ndiaye",
      relationship: "parent",
      email: "babacar.n@example.org",
      phone: null,
      country: "sn",
      locality: "Kaolack",
      preferredContact: "email",
      ageBand: "10-14",
      urgency: "medium",
      daysAgo: 14,
      explanation: "We need help finding a community programme that supports single fathers with three children.",
      assigned: true,
    },
    {
      category: "other",
      status: "completed",
      name: "Layla Mansour",
      relationship: "parent",
      email: "layla.m@example.org",
      phone: null,
      country: "eg",
      locality: "Minya",
      preferredContact: "email",
      ageBand: "5-9",
      urgency: "low",
      daysAgo: 35,
      explanation: "We asked for bedding and warm clothes for two children before the cold season.",
      assigned: true,
    },
  ];

  const partnersRefs = b.refs.referralPartners ?? [];
  const out: string[] = [];
  for (const s of seeds) {
    const createdAt = b.now - s.daysAgo * DAY;
    const changedAt = s.status === "new" ? createdAt : createdAt + Math.min(s.daysAgo * DAY * 0.5, 2 * DAY);
    const assignee = s.assigned ? po : null;
    const ref = await createWithReference<SupportRequest>(
      "supportRequests",
      (reference) => {
        const path = docPath("supportRequests", reference);
        const emailLower = s.email ? s.email.toLowerCase() : null;
        const approvedLike = ["approved", "support_in_progress", "completed"].includes(s.status);
        return {
          ...caseBase(reference, s.status, {
            createdAt,
            statusChangedAt: changedAt,
            assignee,
            policy: approvedLike ? "support.supported" : "support.unsupported",
            tokens: buildSearchTokens({ reference, email: s.email, names: [s.name], phone: s.phone }),
            closed: false,
            followUpAt: s.status === "more_info_required" ? b.now + 5 * DAY : null,
          }),
          category: s.category,
          programmeId: PROGRAMME_OF[s.category],
          applicant: {
            fullName: s.name,
            relationship: s.relationship,
            relationshipOther: null,
            email: s.email,
            emailLower,
            phone: s.phone,
            country: s.country,
            locality: s.locality,
            preferredContact: s.preferredContact,
            safeToContact: true,
            bestTimes: s.preferredContact === "phone" ? "Weekday afternoons" : null,
          },
          child: { ageBand: s.ageBand, numberOfChildren: s.category === "food_supplies" ? 4 : 1 },
          explanation: sealField(path, "explanation", s.explanation),
          urgency: s.urgency,
          immediateDanger: false,
          consentToContact: stamp(createdAt),
          privacyAcknowledged: stamp(createdAt),
          counselling:
            s.category === "counselling"
              ? {
                  forWhom: s.relationship === "guardian" ? "family" : "child",
                  ageBand: s.ageBand,
                  language: s.country === "bd" ? "Bengali" : "French",
                  format: "video",
                  preferredDays: ["tue", "thu"],
                  preferredPeriods: ["afternoon"],
                  preferredTimes: null,
                  timezone: s.country === "bd" ? "Asia/Dhaka" : "Africa/Dakar",
                }
              : null,
          education: s.category === "education" ? { level: "secondary", needs: ["fees", "uniform", "materials"], amountNeeded: money("GMD", 9500) } : null,
          medical: s.category === "medical" ? { need: "treatment_cost" } : null,
          legal: s.category === "legal" ? { matter: "documentation" } : null,
          food: s.category === "food_supplies" ? { householdSize: 6, childrenInHousehold: 4 } : null,
          triage: {
            eligibility: approvedLike || s.status === "referred" ? "eligible" : s.status === "new" ? null : "unclear",
            verification: approvedLike
              ? { status: "verified", method: "Phone call and school letter", by: po.uid, at: changedAt }
              : { status: s.status === "new" ? "not_started" : "in_progress", method: null, by: null, at: null },
          },
          moreInfo: s.status === "more_info_required" ? { requestedAt: changedAt, dueAt: changedAt + 14 * DAY, channel: "email" } : null,
          referrals:
            s.status === "referred" && partnersRefs[2]
              ? [
                  {
                    id: newId(12),
                    partnerId: partnersRefs[2],
                    toName: "Bright Steps Counselling Service",
                    toType: "psychosocial",
                    consentToShare: true,
                    outcome: "waiting",
                    outcomeAt: null,
                    note: null,
                    at: changedAt,
                    by: po.uid,
                  },
                ]
              : [],
          decision: approvedLike ? { kind: "approved", reasonCode: null, note: null, by: po.uid, at: changedAt } : null,
          outcome: s.status === "completed" ? { summary: "Bedding and warm clothes were delivered to the family.", at: changedAt, by: po.uid } : null,
          closureReason: null,
          linkedConcernRef: null,
          attachmentCount: 0,
        };
      },
      (tx, reference) => {
        const path = docPath("supportRequests", reference);
        createdEvent(tx, path, createdAt, "Request received through the website");
        if (s.status !== "new") movedEvent(tx, path, changedAt, po, "new", s.status, SUPPORT_LABEL[s.status] ?? s.status);
      },
    );
    bump(b.counts, C.supportRequests);
    out.push(ref);
  }
  return out;
}

async function seedConcerns(b: BlockCtx): Promise<string[]> {
  const so = b.staff.safeguarding_officer;
  type ConcernSeed = {
    status: SafeguardingConcern["status"];
    riskLevel: SafeguardingConcern["riskLevel"];
    anonymous: boolean;
    relationship: SafeguardingConcern["reporter"]["relationship"];
    ageBand: SafeguardingConcern["child"]["ageBand"];
    country: string;
    types: SafeguardingConcern["concernTypes"];
    inDangerNow: SafeguardingConcern["inDangerNow"];
    hoursAgo: number;
    narrative: string;
    location: { area: string; details: string };
    rationale?: string;
  };
  const seeds: ConcernSeed[] = [
    {
      status: "received",
      riskLevel: null,
      anonymous: true,
      relationship: "community_member",
      ageBand: "10-14",
      country: "gm",
      types: ["neglect"],
      inDangerNow: "no",
      hoursAgo: 1.5,
      narrative: "Practice record: a neighbour's child is often left alone in the evenings without a meal, and the family seems to be under great strain.",
      location: { area: "Practice area A", details: "Practice details only" },
    },
    {
      status: "risk_assessed",
      riskLevel: "high",
      anonymous: false,
      relationship: "teacher",
      ageBand: "5-9",
      country: "sn",
      types: ["physical", "emotional"],
      inDangerNow: "unsure",
      hoursAgo: 30,
      narrative: "Practice record: a teacher noticed repeated unexplained marks and that the pupil has become frightened of going home.",
      location: { area: "Practice area B", details: "Practice details only" },
      rationale: "Practice rationale: repeated signs over several weeks and the child's own fear of going home.",
    },
    {
      status: "monitoring",
      riskLevel: "medium",
      anonymous: false,
      relationship: "relative",
      ageBand: "15-17",
      country: "bd",
      types: ["child_labour"],
      inDangerNow: "no",
      hoursAgo: 24 * 12,
      narrative: "Practice record: an aunt is worried that her niece has left school to work long hours in a workshop.",
      location: { area: "Practice area C", details: "Practice details only" },
      rationale: "Practice rationale: not in immediate danger; school attendance and working hours need follow-up.",
    },
  ];
  const out: string[] = [];
  for (const s of seeds) {
    const createdAt = b.now - s.hoursAgo * HOUR;
    const changedAt = s.status === "received" ? createdAt : createdAt + 2 * HOUR;
    const ref = await createConcernWithRandomRef<SafeguardingConcern>(
      (reference) => {
        const path = docPath("safeguardingConcerns", reference);
        const reporterEmail = `reporter.${reference.slice(4, 8).toLowerCase()}@example.org`;
        return {
          ...caseBase(reference, s.status, {
            createdAt,
            statusChangedAt: changedAt,
            assignee: s.status === "received" ? null : so,
            policy: "concern",
            tokens: [reference.toLowerCase()],
            followUpAt: s.status === "monitoring" ? b.now + 3 * DAY : null,
          }),
          reporter: {
            anonymous: s.anonymous,
            identity: s.anonymous ? null : sealField(path, "reporter.identity", { name: "Practice reporter", email: reporterEmail, phone: null }),
            lookupHash: s.anonymous ? null : emailHash(reporterEmail),
            relationship: s.relationship,
            safeFollowUp: s.anonymous ? null : sealField(path, "reporter.safeFollowUp", { method: "email", times: "Weekdays", notes: null }),
            emailConfirmationAllowed: false,
          },
          child: { ageBand: s.ageBand, country: s.country, location: sealField(path, "child.location", s.location) },
          concernTypes: s.types,
          narrative: sealField(path, "narrative", s.narrative),
          inDangerNow: s.inDangerNow,
          authoritiesContacted: "no",
          authorityDetails: null,
          consent: stamp(createdAt),
          riskLevel: s.riskLevel,
          risk: s.rationale ? { assessedBy: so.uid, assessedAt: changedAt, rationale: sealField(path, "risk.rationale", s.rationale) } : null,
          escalation: null,
          acknowledgedAt: s.status === "received" ? null : createdAt + HOUR,
          realertCount: 0,
          suspectedSpam: false,
          closureReason: null,
          closure: null,
          linkedSupportRef: null,
        };
      },
      (tx, reference) => {
        const path = docPath("safeguardingConcerns", reference);
        createdEvent(tx, path, createdAt, "Concern received through the website");
        if (s.status !== "received") {
          addEventTx(tx, path, {
            type: "status_changed",
            actor: { kind: "staff", uid: so.uid, name: so.name },
            summary: `${firstName(so.name)} moved this to ${s.status === "monitoring" ? "Monitoring" : "Reviewed"}`,
            from: "received",
            to: s.status,
            at: changedAt,
          });
        }
        if (s.status === "monitoring") {
          const actionId = newId();
          const actionPath = subDocPath("safeguardingConcerns", reference, "actions", actionId);
          const action: ConcernAction = {
            kind: "follow_up_due",
            at: changedAt,
            dueAt: b.now + 3 * DAY,
            doneAt: null,
            byUid: so.uid,
            byName: so.name,
            detail: sealField(actionPath, "detail", "Practice action: check school attendance with the family."),
            createdAt: changedAt,
            updatedAt: changedAt,
            version: 1,
          };
          tx.create(actionPath, action);
        }
      },
    );
    bump(b.counts, C.safeguardingConcerns);
    out.push(ref);
  }
  return out;
}

async function seedAppointments(b: BlockCtx): Promise<string[]> {
  const counsellor = b.staff.counsellor;
  const po = b.staff.programme_officer;
  const support = b.refs.supportRequests ?? [];
  const sr3 = support[2];
  const sr4 = support[3];
  if (!sr3 || !sr4) return [];
  const at = (days: number, hourUtc: number) => {
    const d = new Date(b.now + days * DAY);
    d.setUTCHours(hourUtc, 0, 0, 0);
    return d.getTime();
  };
  type ApptSeed = { supportRef: string; n: number; status: Appointment["status"]; startsAt: Millis; client: string; language: string; tz: string; link: boolean };
  const seeds: ApptSeed[] = [
    { supportRef: sr4, n: 1, status: "completed", startsAt: at(-14, 9), client: "Nusrat A.", language: "Bengali", tz: "Asia/Dhaka", link: true },
    { supportRef: sr4, n: 2, status: "no_show", startsAt: at(-7, 9), client: "Nusrat A.", language: "Bengali", tz: "Asia/Dhaka", link: true },
    { supportRef: sr4, n: 3, status: "scheduled", startsAt: at(2, 9), client: "Nusrat A.", language: "Bengali", tz: "Asia/Dhaka", link: true },
    { supportRef: sr3, n: 1, status: "cancelled", startsAt: at(-1, 15), client: "Aminata S.", language: "French", tz: "Africa/Dakar", link: false },
  ];
  const out: string[] = [];
  for (const s of seeds) {
    const createdAt = Math.min(s.startsAt - 3 * DAY, b.now - HOUR);
    const done = s.status !== "scheduled";
    const ref = await createWithReference<Appointment>(
      "appointments",
      (reference) => ({
        ...caseBase(reference, s.status, {
          createdAt,
          statusChangedAt: done ? Math.min(s.startsAt + HOUR, b.now) : createdAt,
          assignee: counsellor,
          policy: "appointment",
          tokens: buildSearchTokens({ reference, extra: [s.supportRef.toLowerCase()] }),
          closed: done,
          source: "staff_entry",
        }),
        supportRef: s.supportRef,
        counsellorUid: counsellor.uid,
        counsellorName: counsellor.name,
        sessionNumber: s.n,
        startsAt: s.startsAt,
        durationMin: 45,
        clientTimezone: s.tz,
        mode: "zoom",
        zoom: s.link ? { joinUrl: "https://zoom.us/j/1000000001", meetingId: null, passcode: null, source: "manual" } : null,
        clientSnapshot: {
          displayName: s.client,
          forWhom: s.supportRef === sr4 ? "family" : "child",
          ageBand: s.supportRef === sr4 ? "10-14" : "15-17",
          language: s.language,
          contactEmail: s.supportRef === sr4 ? "nusrat.a@example.org" : "aminata.s@example.org",
          phoneForCall: null,
          reasonSummary: "Support after a difficult change in the family.",
        },
        attendance:
          s.status === "completed"
            ? { status: "attended", recordedBy: counsellor.uid, recordedAt: s.startsAt + HOUR }
            : s.status === "no_show"
              ? { status: "no_show", recordedBy: counsellor.uid, recordedAt: s.startsAt + HOUR }
              : s.status === "cancelled"
                ? { status: "cancelled_by_client", recordedBy: po.uid, recordedAt: s.startsAt - 6 * HOUR }
                : null,
        reminders: { confirmationQueuedAt: s.link ? createdAt : null, reminder24hQueuedAt: null, reminder1hQueuedAt: null },
        followUp: s.status === "completed" ? { recommended: true, byDate: s.startsAt + 14 * DAY } : null,
        cancelReason: s.status === "cancelled" ? "The family asked to find a new time." : null,
        icsSequence: 0,
      }),
      (tx, reference) => {
        addEventTx(tx, docPath("appointments", reference), {
          type: "created",
          actor: { kind: "staff", uid: po.uid, name: po.name },
          summary: `${firstName(po.name)} booked session ${s.n}`,
          at: createdAt,
        });
      },
    );
    bump(b.counts, C.appointments);
    out.push(ref);
  }
  return out;
}

type DonorSeed = { name: string; email: string; country: string; type?: "individual" | "organisation"; org?: string };

const DONORS: Record<string, DonorSeed> = {
  kofi: { name: "Kofi Asante", email: "kofi.asante@example.org", country: "gh" },
  mariama: { name: "Mariama Bah", email: "mariama.bah@example.org", country: "gm" },
  imran: { name: "Imran Qureshi", email: "imran.q@example.org", country: "pk" },
  yusuf: { name: "Yusuf Rahman", email: "yusuf.r@example.org", country: "bd" },
  hana: { name: "Hana Saleh", email: "hana.saleh@example.org", country: "jo" },
  arjun: { name: "Arjun Mehta", email: "arjun.mehta@example.org", country: "in" },
  grace: { name: "Grace Okafor", email: "grace.okafor@example.org", country: "ng", type: "organisation", org: "Okafor Family Trust" },
  ahmed: { name: "Ahmed Farouk", email: "ahmed.farouk@example.org", country: "eg" },
};

async function seedGiving(b: BlockCtx): Promise<string[]> {
  const store = getStore();
  const fo = b.staff.finance_officer;
  type GiftSeed = {
    donor: keyof typeof DONORS;
    kind: "cash" | "in_kind";
    status: Donation["status"];
    currency: Currency;
    major: number;
    daysAgo: number;
    frequency?: Donation["frequency"];
    method?: PaymentMethod;
    localMethod?: NonNullable<Donation["cash"]>["localMethod"];
    target?: AllocationTarget;
    causeSlug?: string | null;
    recurring?: 0 | 1;
  };
  const seeds: GiftSeed[] = [
    { donor: "kofi", kind: "cash", status: "pledged", currency: "USD", major: 50, daysAgo: 1, method: "bank_transfer", localMethod: "bank_transfer", causeSlug: "education" },
    { donor: "mariama", kind: "cash", status: "pledged", currency: "GMD", major: 2500, daysAgo: 3, method: "mobile_money", localMethod: "wave", causeSlug: "general" },
    { donor: "imran", kind: "cash", status: "received", currency: "GBP", major: 40, daysAgo: 5, method: "bank_transfer", localMethod: "bank_transfer", causeSlug: "medical" },
    { donor: "yusuf", kind: "cash", status: "acknowledged", currency: "USD", major: 100, daysAgo: 9, method: "bank_transfer", localMethod: "bank_transfer", causeSlug: "general" },
    { donor: "hana", kind: "cash", status: "allocated", currency: "EUR", major: 75, daysAgo: 15, method: "bank_transfer", localMethod: "bank_transfer", target: { type: "cause", causeSlug: "education" }, causeSlug: "education" },
    { donor: "kofi", kind: "cash", status: "allocated", currency: "USD", major: 25, daysAgo: 20, frequency: "monthly", method: "bank_transfer", target: { type: "cause", causeSlug: "medical" }, causeSlug: "medical", recurring: 1 },
    { donor: "mariama", kind: "cash", status: "allocated", currency: "GMD", major: 5000, daysAgo: 25, method: "mobile_money", localMethod: "wave", target: { type: "cause", causeSlug: "general" }, causeSlug: "general" },
    { donor: "arjun", kind: "cash", status: "acknowledged", currency: "USD", major: 200, daysAgo: 30, method: "bank_transfer", localMethod: "bank_transfer", causeSlug: "education" },
    { donor: "grace", kind: "in_kind", status: "pledged", currency: "USD", major: 0, daysAgo: 2, causeSlug: null },
    { donor: "ahmed", kind: "in_kind", status: "received", currency: "USD", major: 0, daysAgo: 12, causeSlug: null },
  ];

  const out: string[] = [];
  const donorTotals = new Map<string, { seed: DonorSeed; totals: Partial<Record<Currency, { lifetimeMinor: number; gifts: number }>>; first: Millis; last: Millis; recurring: number }>();
  const causeTotals: Record<string, CauseTotals> = {};

  // Recurring gifts first, so the monthly gift can point at its plan.
  const recurringRefs: string[] = [];
  const plans: Array<{ donor: keyof typeof DONORS; amount: Money; frequency: RecurringGift["frequency"]; status: RecurringGift["status"]; cause: string; daysAgo: number }> = [
    { donor: "kofi", amount: money("USD", 25), frequency: "monthly", status: "active", cause: "medical", daysAgo: 50 },
    { donor: "hana", amount: money("GBP", 30), frequency: "quarterly", status: "paused", cause: "education", daysAgo: 120 },
  ];
  for (const p of plans) {
    const d = DONORS[p.donor];
    const startedAt = b.now - p.daysAgo * DAY;
    const ref = await createWithReference<RecurringGift & { isSample: true }>("recurringGifts", (reference) => ({
      reference,
      donorId: emailHash(d.email),
      donor: { fullName: d.name, email: d.email, emailLower: d.email.toLowerCase(), country: d.country },
      amount: p.amount,
      frequency: p.frequency,
      target: { type: "cause", causeSlug: p.cause },
      causeSlug: p.cause,
      provider: "manual",
      stripe: null,
      status: p.status,
      startedAt,
      currentPeriodEnd: null,
      cancelAt: null,
      cancelledAt: null,
      cancelReason: null,
      giftCount: p.status === "active" ? 2 : 1,
      lastPaymentAt: p.status === "active" ? b.now - 20 * DAY : startedAt,
      lastFailureAt: null,
      searchTokens: buildSearchTokens({ reference, email: d.email, names: [d.name] }),
      retention: { policy: "donation.financial", retainUntil: null, legalHold: false },
      createdAt: startedAt,
      updatedAt: startedAt,
      version: 1,
      isSample: true,
    }));
    bump(b.counts, C.recurringGifts);
    recurringRefs.push(ref);
    out.push(ref);
  }

  for (const s of seeds) {
    const d = DONORS[s.donor];
    const donorId = emailHash(d.email);
    const createdAt = b.now - s.daysAgo * DAY;
    const received = ["received", "acknowledged", "allocated"].includes(s.status);
    const receivedAt = received ? createdAt + 2 * HOUR : null;
    const amount = money(s.currency, s.major);
    const target: AllocationTarget = s.target ?? (s.causeSlug && s.causeSlug !== "general" ? { type: "cause", causeSlug: s.causeSlug } : { type: "general" });
    const acknowledged = s.status === "acknowledged" || s.status === "allocated";

    const ref = await getStore().runTransaction(async (tx) => {
      const reference = await allocateReference(tx, "donations", { now: b.now });
      const receipt = acknowledged && s.kind === "cash" ? await nextReceiptNumber(tx, undefined, { now: b.now }) : null;
      const path = docPath("donations", reference);
      const allocations: DonationAllocation[] =
        s.status === "allocated" ? [{ id: newId(12), target, amount, at: createdAt + DAY, by: fo.uid, note: null }] : [];
      const doc: Donation = {
        ...caseBase(reference, s.status, {
          createdAt,
          statusChangedAt: s.status === "pledged" ? createdAt : createdAt + DAY,
          assignee: s.status === "pledged" ? null : fo,
          policy: s.status === "pledged" ? "donation.unfulfilled" : "donation.financial",
          tokens: buildSearchTokens({ reference, email: d.email, names: [d.name, d.org], extra: receipt ? [receipt.toLowerCase()] : [] }),
          source: "web_form",
        }),
        kind: s.kind,
        donorId,
        donor: {
          fullName: d.name,
          donorType: d.type ?? "individual",
          organisationName: d.org ?? null,
          email: d.email,
          emailLower: d.email.toLowerCase(),
          phone: null,
          country: d.country,
        },
        recognition: s.donor === "yusuf" ? "anonymous" : "named",
        frequency: s.frequency ?? "one_time",
        preferredTarget: target,
        causeSlug: s.causeSlug ?? null,
        sponsorRef: null,
        comments: null,
        updatesConsent: s.donor === "hana" || s.donor === "arjun" ? stamp(createdAt) : null,
        attribution: null,
        cash:
          s.kind === "cash"
            ? {
                amount,
                baseAmount: amount,
                coverFees: false,
                method: s.method ?? "bank_transfer",
                localMethod: s.localMethod ?? null,
                stripe: null,
                externalRef: received ? `PRACTICE-${reference.slice(-4)}` : null,
              }
            : null,
        inKind:
          s.kind === "in_kind"
            ? {
                categories: s.donor === "grace" ? ["school_materials"] : ["clothing"],
                description: s.donor === "grace" ? "Forty school bags with exercise books and pens." : "Two boxes of warm children's clothes in good condition.",
                estimatedValue: s.donor === "grace" ? money("USD", 400) : null,
                quantity: s.donor === "grace" ? "40 school bags" : "2 boxes",
                condition: s.donor === "grace" ? "new" : "good",
                delivery: s.donor === "grace" ? "drop_off" : "collection",
                availableFrom: s.donor === "grace" ? b.now + 5 * DAY : null,
                locality: s.donor === "grace" ? "Lagos" : "Cairo",
                received: s.status === "received" ? [{ description: "Warm children's clothes", quantity: "2 boxes", value: null, receivedAt: createdAt + DAY, by: fo.uid }] : [],
              }
            : null,
        allocations,
        acknowledgement: acknowledged ? { at: createdAt + DAY, by: fo.uid, outboxId: `donation_acknowledgement~${reference}` } : null,
        receipt: receipt ? { number: receipt, issuedAt: createdAt + DAY, pdfPath: null } : null,
        recurringGiftRef: s.recurring ? (recurringRefs[0] ?? null) : null,
        receivedAt: s.kind === "in_kind" && s.status === "received" ? createdAt + DAY : receivedAt,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
        refund: null,
      };
      tx.create(path, doc);
      createdEvent(tx, path, createdAt, s.kind === "cash" ? "Gift pledged through the website" : "Items offered through the website");
      if (s.status !== "pledged") {
        addEventTx(tx, path, {
          type: "status_changed",
          actor: { kind: "staff", uid: fo.uid, name: fo.name },
          summary: `${firstName(fo.name)} moved this to ${s.status === "received" ? "Received" : s.status === "acknowledged" ? "Thanked" : "Allocated"}`,
          from: "pledged",
          to: s.status,
          at: createdAt + DAY,
        });
      }
      return reference;
    });
    bump(b.counts, C.donations);
    out.push(ref);

    const entry = donorTotals.get(donorId) ?? { seed: d, totals: {}, first: createdAt, last: createdAt, recurring: 0 };
    entry.first = Math.min(entry.first, createdAt);
    entry.last = Math.max(entry.last, createdAt);
    if (received && s.kind === "cash") {
      const t = entry.totals[s.currency] ?? { lifetimeMinor: 0, gifts: 0 };
      entry.totals[s.currency] = { lifetimeMinor: t.lifetimeMinor + amount.amountMinor, gifts: t.gifts + 1 };
    }
    if (s.recurring) entry.recurring = 1;
    donorTotals.set(donorId, entry);

    if (s.status === "allocated" && target.type === "cause") {
      const totals = (causeTotals[target.causeSlug] ??= {});
      const cur = totals[s.currency] ?? { raisedMinor: 0, gifts: 0 };
      totals[s.currency] = { raisedMinor: cur.raisedMinor + amount.amountMinor, gifts: cur.gifts + 1 };
    }
  }

  for (const [id, e] of donorTotals) {
    const path = docPath("donors", id);
    if (await store.get(path)) continue;
    const donor: Donor & { isSample: true } = {
      email: e.seed.email,
      emailLower: e.seed.email.toLowerCase(),
      fullName: e.seed.name,
      donorType: e.seed.type ?? "individual",
      organisationName: e.seed.org ?? null,
      country: e.seed.country,
      phone: null,
      recognition: "named",
      updatesConsent: null,
      updatesWithdrawnAt: null,
      stripeCustomerId: null,
      totals: e.totals,
      firstGiftAt: e.first,
      lastGiftAt: e.last,
      activeRecurring: e.recurring,
      searchTokens: buildSearchTokens({ email: e.seed.email, names: [e.seed.name, e.seed.org] }),
      retention: { policy: "donor.profile", retainUntil: null, legalHold: false },
      createdAt: e.first,
      updatedAt: e.last,
      version: 1,
      isSample: true,
    };
    await store.create(path, donor);
    bump(b.counts, C.donors);
  }

  for (const [slug, totals] of Object.entries(causeTotals)) {
    const path = docPath("causeTotals", slug);
    if (await store.get(path)) continue;
    await store.create(path, { ...totals, updatedAt: b.now });
    bump(b.counts, C.causeTotals);
  }
  return out;
}

async function seedEngagement(b: BlockCtx): Promise<string[]> {
  const po = b.staff.programme_officer;
  const cm = b.staff.content_manager;
  const fo = b.staff.finance_officer;
  const rm = b.staff.report_manager;
  const out: string[] = [];

  type VolSeed = { name: string; email: string; country: string; status: VolunteerApplication["status"]; interests: VolunteerApplication["interests"]; daysAgo: number; languages: string[] };
  const volunteers: VolSeed[] = [
    { name: "Chinedu Eze", email: "chinedu.eze@example.org", country: "ng", status: "submitted", interests: ["education_support"], daysAgo: 1, languages: ["English", "Igbo"] },
    { name: "Priya Nair", email: "priya.nair@example.org", country: "in", status: "screening", interests: ["counselling_psychosocial"], daysAgo: 6, languages: ["English", "Malayalam"] },
    { name: "Hassan Jobe", email: "hassan.jobe@example.org", country: "gm", status: "interview", interests: ["community_outreach"], daysAgo: 11, languages: ["English", "Wolof", "Mandinka"] },
    { name: "Aisyah Putri", email: "aisyah.putri@example.org", country: "id", status: "approved", interests: ["communications"], daysAgo: 25, languages: ["English", "Indonesian"] },
  ];
  for (const v of volunteers) {
    const createdAt = b.now - v.daysAgo * DAY;
    const changedAt = v.status === "submitted" ? createdAt : createdAt + DAY;
    const ref = await createWithReference<VolunteerApplication>(
      "volunteerApplications",
      (reference) => ({
        ...caseBase(reference, v.status, {
          createdAt,
          statusChangedAt: changedAt,
          assignee: v.status === "submitted" ? null : po,
          policy: "volunteer.former",
          tokens: buildSearchTokens({ reference, email: v.email, names: [v.name] }),
        }),
        applicant: { fullName: v.name, email: v.email, emailLower: v.email.toLowerCase(), phone: null, country: v.country, locality: null },
        isAdult: true,
        interests: v.interests,
        skills: "Teaching, mentoring and organising community events.",
        languages: v.languages,
        availability: { hoursPerWeek: "4-8", mode: v.country === "gm" ? "in_person" : "remote", days: ["weekends"] },
        motivation: "I would like to help children get a fair start, as others once helped my family.",
        workedWithChildren: v.interests[0] !== "communications",
        workedWithChildrenNote: null,
        backgroundCheckConsent: true,
        safeguardingCheck: v.status === "approved" ? { status: "not_required", at: changedAt, by: po.uid } : v.status === "submitted" ? null : { status: "pending", at: null, by: null },
        interview: v.status === "interview" ? { at: b.now + 3 * DAY, by: po.uid, outcomeNote: null } : null,
        heardFrom: "social_media",
        onboardingChecklist: [],
        consentToContact: stamp(createdAt),
        privacyAcknowledged: stamp(createdAt),
        safeguardingAcknowledged: stamp(createdAt),
        declineReasonCode: null,
      }),
      (tx, reference) => {
        const path = docPath("volunteerApplications", reference);
        createdEvent(tx, path, createdAt, "Application received through the website");
        if (v.status !== "submitted") movedEvent(tx, path, changedAt, po, "submitted", v.status, v.status === "screening" ? "Screening" : v.status === "interview" ? "Interview" : "Approved");
      },
    );
    bump(b.counts, C.volunteerApplications);
    out.push(ref);
  }

  type PartnerSeed = { org: string; kind: PartnershipEnquiry["organisation"]["kind"]; country: string; contact: string; email: string; status: PartnershipEnquiry["status"]; type: PartnershipEnquiry["partnershipType"]; programme: ProgrammeId | null; daysAgo: number };
  const partnerships: PartnerSeed[] = [
    { org: "Bright Futures Learning Centre", kind: "school", country: "gh", contact: "Ama Owusu", email: "ama.owusu@example.org", status: "new", type: "programme", programme: "education", daysAgo: 2 },
    { org: "Crescent Health Clinic", kind: "health_provider", country: "ma", contact: "Youssef Amrani", email: "youssef.amrani@example.org", status: "under_review", type: "institutional_referral", programme: "medical", daysAgo: 8 },
    { org: "Sahel Legal Aid Network", kind: "legal_practice", country: "sn", contact: "Ousmane Diallo", email: "ousmane.diallo@example.org", status: "in_discussion", type: "technical_assistance", programme: "legal", daysAgo: 21 },
  ];
  for (const p of partnerships) {
    const createdAt = b.now - p.daysAgo * DAY;
    const changedAt = p.status === "new" ? createdAt : createdAt + 2 * DAY;
    const ref = await createWithReference<PartnershipEnquiry>(
      "partnershipEnquiries",
      (reference) => ({
        ...caseBase(reference, p.status, {
          createdAt,
          statusChangedAt: changedAt,
          assignee: p.status === "new" ? null : po,
          policy: "partnership",
          tokens: buildSearchTokens({ reference, email: p.email, names: [p.contact, p.org] }),
        }),
        organisation: { name: p.org, kind: p.kind, website: null, country: p.country },
        contact: { fullName: p.contact, role: "Director", email: p.email, emailLower: p.email.toLowerCase(), phone: null },
        partnershipType: p.type,
        programmeId: p.programme,
        message: "We would like to explore working together to reach more families in our area.",
        heardFrom: "partner_organisation",
        consentToContact: stamp(createdAt),
      }),
      (tx, reference) => {
        const path = docPath("partnershipEnquiries", reference);
        createdEvent(tx, path, createdAt, "Enquiry received through the website");
        if (p.status !== "new") movedEvent(tx, path, changedAt, po, "new", p.status, p.status === "under_review" ? "Under review" : "Talking");
      },
    );
    bump(b.counts, C.partnershipEnquiries);
    out.push(ref);
  }

  type MsgSeed = { name: string; email: string; country: string; category: ContactMessage["category"]; status: ContactMessage["status"]; subject: string; message: string; daysAgo: number; owner: Staff };
  const messages: MsgSeed[] = [
    { name: "Ibrahim Touray", email: "ibrahim.t@example.org", country: "gm", category: "general", status: "new", subject: "Visiting your office", message: "Is it possible to visit your office to learn more about your work?", daysAgo: 0.3, owner: cm },
    { name: "Sara Mahmoud", email: "sara.m@example.org", country: "eg", category: "donation", status: "new", subject: "Giving through my employer", message: "My employer matches donations. Can you send the details they need?", daysAgo: 1, owner: fo },
    { name: "Ravi Kumar", email: "ravi.k@example.org", country: "in", category: "partnership", status: "replied", subject: "Our school would like to help", message: "Our school runs a charity week each year and we would love to support Haven.", daysAgo: 4, owner: po },
    { name: "Nadia Hussain", email: "nadia.h@example.org", country: "pk", category: "media", status: "new", subject: "Interview request", message: "I write for a community radio programme and would like to interview your team.", daysAgo: 2, owner: cm },
    { name: "Efua Mensah", email: "efua.m@example.org", country: "gh", category: "programme_info", status: "closed", subject: "Education programme ages", message: "Which ages does your education programme support?", daysAgo: 10, owner: po },
    { name: "Mohammed Ali", email: "mohammed.ali@example.org", country: "sd", category: "resource_request", status: "new", subject: "Parenting materials", message: "Do you have printed parenting guides we could share at our community centre?", daysAgo: 1.5, owner: rm },
  ];
  for (const m of messages) {
    const createdAt = b.now - m.daysAgo * DAY;
    const changedAt = m.status === "new" ? createdAt : createdAt + DAY;
    const ref = await createWithReference<ContactMessage>(
      "contactMessages",
      (reference) => ({
        ...caseBase(reference, m.status, {
          createdAt,
          statusChangedAt: changedAt,
          assignee: m.status === "new" ? null : m.owner,
          policy: "contact",
          tokens: buildSearchTokens({ reference, email: m.email, names: [m.name] }),
          closed: m.status === "closed",
        }),
        fullName: m.name,
        email: m.email,
        emailLower: m.email.toLowerCase(),
        phone: null,
        country: m.country,
        subject: m.subject,
        category: m.category,
        programmeId: m.category === "programme_info" ? "education" : null,
        message: m.message,
        consent: stamp(createdAt),
        replies: m.status === "replied" ? [{ at: changedAt, by: m.owner.uid, byName: m.owner.name, outboxId: `contact_reply~${reference}` }] : [],
        linkedConcernRef: null,
      }),
      (tx, reference) => {
        const path = docPath("contactMessages", reference);
        createdEvent(tx, path, createdAt, "Message received through the website");
        if (m.status !== "new") movedEvent(tx, path, changedAt, m.owner, "new", m.status, m.status === "replied" ? "Replied" : "Done");
      },
    );
    bump(b.counts, C.contactMessages);
    out.push(ref);
  }
  return out;
}

async function seedLibrary(b: BlockCtx): Promise<string[]> {
  const store = getStore();
  const cm = b.staff.content_manager;
  const rm = b.staff.report_manager;
  const blobs = getBlobStore();
  const out: string[] = [];

  const resources: Array<{ id: string; title: string; access: Resource["access"]; category: Resource["category"]; summary: string; programmes: ProgrammeId[] }> = [
    {
      id: "sample-positive-parenting-guide",
      title: "Positive parenting: a short guide",
      access: "public",
      category: "parenting",
      summary: "Simple, everyday ideas for calm and caring parenting, for parents and caregivers.",
      programmes: ["family", "psychological"],
    },
    {
      id: "sample-safeguarding-practice-review",
      title: "Safeguarding practice review 2025",
      access: "controlled",
      category: "child_safeguarding",
      summary: "How Haven reviewed its safeguarding practice this year. Shared with partner organisations on request.",
      programmes: ["protection"],
    },
  ];
  for (const r of resources) {
    const path = docPath("resources", r.id);
    if (await store.get(path)) {
      out.push(r.id);
      continue;
    }
    const pdf = tinyPdf(r.title);
    const sha = createHash("sha256").update(pdf).digest("hex");
    const storagePath = r.access === "public" ? BLOB_PATH.publicResource(r.id, sha.slice(0, 12)) : BLOB_PATH.privateResource(r.id, sha.slice(0, 12));
    await blobs.put(storagePath, pdf, "application/pdf");
    const publishedAt = b.now - 60 * DAY;
    const doc: Resource & { isSample: true } = {
      slug: r.id,
      status: "published",
      access: r.access,
      category: r.category,
      title: r.title,
      shortDescription: r.summary,
      executiveSummary: [{ id: "b1", type: "paragraph", text: r.summary }],
      coverMediaId: null,
      publicationDate: publishedAt,
      programmeIds: r.programmes,
      language: "English",
      file: { storagePath, sizeBytes: pdf.length, pageCount: 1, sha256: sha },
      preview: null,
      downloadCount: 0,
      requestCount: r.access === "controlled" ? 2 : 0,
      featured: r.access === "public",
      placeholder: false,
      publishedAt,
      publishedBy: cm.uid,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      version: 1,
      isSample: true,
    };
    await store.create(path, doc);
    bump(b.counts, C.resources);
    out.push(r.id);
  }

  const controlled = resources[1];
  type ReqSeed = { name: string; org: string | null; email: string; country: string; status: ReportRequest["status"]; listed: boolean; daysAgo: number; reason: string };
  const requests: ReqSeed[] = [
    { name: "Halima Bello", org: "Child Rights Forum", email: "halima.bello@example.org", country: "ng", status: "new", listed: true, daysAgo: 1, reason: "We are reviewing our own safeguarding policy and would like to learn from yours." },
    { name: "Tariq Aziz", org: "Youth Trust", email: "tariq.aziz@example.org", country: "pk", status: "under_review", listed: true, daysAgo: 4, reason: "Our board asked for examples of safeguarding reviews from partner organisations." },
    { name: "Lina Santos", org: null, email: "lina.santos@example.org", country: "ph", status: "new", listed: false, daysAgo: 2, reason: "I am a student researching education programmes for children in West Africa." },
  ];
  for (const q of requests) {
    const createdAt = b.now - q.daysAgo * DAY;
    const changedAt = q.status === "new" ? createdAt : createdAt + DAY;
    const ref = await createWithReference<ReportRequest>(
      "reportRequests",
      (reference) => ({
        ...caseBase(reference, q.status, {
          createdAt,
          statusChangedAt: changedAt,
          assignee: q.status === "new" ? null : rm,
          policy: "report_request",
          tokens: buildSearchTokens({ reference, email: q.email, names: [q.name, q.org] }),
        }),
        resourceId: q.listed ? controlled.id : null,
        resourceTitle: q.listed ? controlled.title : "Education programme evaluation 2024",
        requestedTitle: q.listed ? null : "Education programme evaluation 2024",
        requester: { fullName: q.name, organisation: q.org, email: q.email, emailLower: q.email.toLowerCase(), country: q.country },
        reason: q.reason,
        consent: stamp(createdAt),
        decision: null,
        delivery: null,
      }),
      (tx, reference) => {
        const path = docPath("reportRequests", reference);
        createdEvent(tx, path, createdAt, "Request received through the website");
        if (q.status !== "new") movedEvent(tx, path, changedAt, rm, "new", q.status, "Under review");
      },
    );
    bump(b.counts, C.reportRequests);
    out.push(ref);
  }
  return out;
}

async function seedSubscribersAndStories(b: BlockCtx): Promise<string[]> {
  const store = getStore();
  const cm = b.staff.content_manager;
  const out: string[] = [];
  const subscribers: Array<{ email: string; firstName: string; status: NewsletterSubscriber["status"]; source: NewsletterSubscriber["source"]; daysAgo: number }> = [
    { email: "zainab.k@example.org", firstName: "Zainab", status: "confirmed", source: "footer", daysAgo: 40 },
    { email: "samuel.o@example.org", firstName: "Samuel", status: "confirmed", source: "join_section", daysAgo: 22 },
    { email: "meera.s@example.org", firstName: "Meera", status: "confirmed", source: "donation", daysAgo: 15 },
    { email: "tunde.a@example.org", firstName: "Tunde", status: "pending", source: "footer", daysAgo: 1 },
  ];
  for (const s of subscribers) {
    const id = emailHash(s.email);
    const path = docPath("newsletterSubscribers", id);
    if (await store.get(path)) continue;
    const createdAt = b.now - s.daysAgo * DAY;
    const doc: NewsletterSubscriber & { isSample: true } = {
      email: s.email,
      emailLower: s.email.toLowerCase(),
      firstName: s.firstName,
      status: s.status,
      source: s.source,
      interests: [],
      consent: stamp(createdAt),
      confirmTokenHash: null,
      confirmedAt: s.status === "confirmed" ? createdAt + HOUR : null,
      unsubscribedAt: null,
      retention: { policy: s.status === "pending" ? "newsletter.unconfirmed" : "newsletter.unsubscribed", retainUntil: null, legalHold: false },
      createdAt,
      updatedAt: createdAt,
      version: 1,
      isSample: true,
    };
    await store.create(path, doc);
    bump(b.counts, C.newsletterSubscribers);
    out.push(id);
  }

  const stories: Array<{ role: StorySubmission["submitterRole"]; status: StorySubmission["status"]; displayName: string | null; country: string; programme: ProgrammeId | null; story: string; contact: { name: string; email: string }; daysAgo: number }> = [
    {
      role: "beneficiary",
      status: "new",
      displayName: null,
      country: "gm",
      programme: "education",
      story: "When school fees became too much for us, Haven helped with fees and books. My daughter is now preparing for her exams with real hope for the future.",
      contact: { name: "Practice parent", email: "story.parent@example.org" },
      daysAgo: 1,
    },
    {
      role: "volunteer",
      status: "reviewing",
      displayName: "Priya N.",
      country: "in",
      programme: "psychological",
      story: "Volunteering with Haven's online sessions showed me how much a calm hour of listening can mean to a family going through a hard time.",
      contact: { name: "Priya Nair", email: "priya.nair@example.org" },
      daysAgo: 6,
    },
  ];
  for (const s of stories) {
    const createdAt = b.now - s.daysAgo * DAY;
    const changedAt = s.status === "new" ? createdAt : createdAt + DAY;
    const ref = await createWithReference<StorySubmission>(
      "storySubmissions",
      (reference) => {
        const path = docPath("storySubmissions", reference);
        return {
          ...caseBase(reference, s.status, {
            createdAt,
            statusChangedAt: changedAt,
            assignee: s.status === "new" ? null : cm,
            policy: "story_submission",
            tokens: buildSearchTokens({ reference }),
          }),
          submitterRole: s.role,
          publishWithoutName: s.displayName === null,
          displayName: s.displayName,
          country: s.country,
          programmeId: s.programme,
          story: s.story,
          contact: sealField(path, "contact", { ...s.contact, phone: null }),
          contactLookupHash: emailHash(s.contact.email),
          publishConsent: stamp(createdAt),
          privacyAcknowledged: stamp(createdAt),
          parentOrGuardian: s.role === "beneficiary",
          attachmentCount: 0,
          createdItem: null,
          declineReason: null,
        };
      },
      (tx, reference) => {
        const path = docPath("storySubmissions", reference);
        createdEvent(tx, path, createdAt, "Story shared through the website");
        if (s.status !== "new") movedEvent(tx, path, changedAt, cm, "new", s.status, "Reviewing");
      },
    );
    bump(b.counts, C.storySubmissions);
    out.push(ref);
  }
  return out;
}

async function seedSponsors(b: BlockCtx): Promise<string[]> {
  const po = b.staff.programme_officer;
  const cm = b.staff.content_manager;
  const support = b.refs.supportRequests ?? [];
  const seeds: Array<{
    status: SponsorProfile["status"];
    ageBand: SponsorProfile["ageBand"];
    category: SupportCategory;
    country: string | null;
    need: SponsorProfile["need"];
    funded: Money;
    needed: number;
    current: number;
    linked: string | null;
  }> = [
    {
      status: "published",
      ageBand: "10-14",
      category: "education",
      country: "gm",
      need: { amount: money("USD", 150), period: "per_term", description: "School fees, a uniform and books for the coming term." },
      funded: money("USD", 60),
      needed: 3,
      current: 1,
      linked: null,
    },
    {
      status: "fully_funded",
      ageBand: "5-9",
      category: "family_support",
      country: "sn",
      need: { amount: money("USD", 40), period: "per_month", description: "A monthly food parcel for a family of five." },
      funded: money("USD", 40),
      needed: 2,
      current: 2,
      linked: null,
    },
    {
      status: "draft",
      ageBand: "15-17",
      category: "education",
      country: "gm",
      need: { amount: money("USD", 300), period: "one_off", description: "Fees for a vocational training course." },
      funded: money("USD", 0),
      needed: 2,
      current: 0,
      linked: support[0] ?? null,
    },
  ];
  const out: string[] = [];
  for (const s of seeds) {
    const createdAt = b.now - 30 * DAY;
    const code = await getStore().runTransaction(async (tx) => {
      const c = await nextSponsorCode(tx, { now: b.now });
      const published = s.status !== "draft";
      const doc: SponsorProfile & { isSample: true } = {
        code: c,
        status: s.status,
        ageBand: s.ageBand,
        supportCategory: s.category,
        programmeId: PROGRAMME_OF[s.category],
        country: s.country,
        need: s.need,
        funded: s.funded,
        sponsorsNeeded: s.needed,
        sponsorsCurrent: s.current,
        linkedSupportRef: s.linked,
        review: published ? { by: cm.uid, at: createdAt + DAY } : null,
        publishedAt: published ? createdAt + DAY : null,
        publishedBy: published ? cm.uid : null,
        createdAt,
        updatedAt: createdAt + DAY,
        version: 1,
        isSample: true,
      };
      tx.create(docPath("sponsorProfiles", c), doc);
      if (published) {
        tx.create(subDocPath("sponsorProfiles", c, "updates", newId()), {
          at: createdAt + 10 * DAY,
          text: "Thanks to sponsors, the programme supported more children this term.",
          by: po.uid,
          published: true,
        });
      }
      return c;
    });
    bump(b.counts, C.sponsorProfiles);
    out.push(code);
  }
  return out;
}

async function seedNotifications(b: BlockCtx): Promise<string[]> {
  const store = getStore();
  const s = b.staff;
  const support = b.refs.supportRequests ?? [];
  const giving = (b.refs.giving ?? []).filter((r) => r.startsWith("HVN-DN-"));
  const reqs = (b.refs.library ?? []).filter((r) => r.startsWith("HVN-RR-"));
  const stories = (b.refs.engagement2 ?? []).filter((r) => r.startsWith("HVN-SS-"));
  const items: Array<Pick<StaffNotification, "recipientUid" | "kind" | "title" | "href" | "priority">> = [
    { recipientUid: s.safeguarding_officer.uid, kind: "concern_alert", title: "New safeguarding item needs review", href: "/admin/safeguarding", priority: "urgent" },
    { recipientUid: s.programme_officer.uid, kind: "new_case", title: "New request to review", href: support[0] ? `/admin/requests/${support[0]}` : "/admin/requests", priority: "normal" },
    { recipientUid: s.finance_officer.uid, kind: "new_case", title: "New pledge to confirm", href: giving[0] ? `/admin/giving/${giving[0]}` : "/admin/giving", priority: "normal" },
    { recipientUid: s.content_manager.uid, kind: "new_case", title: "A new story was shared", href: stories[0] ? `/admin/inbox/${stories[0]}` : "/admin/inbox", priority: "normal" },
    { recipientUid: s.report_manager.uid, kind: "new_case", title: "New report request", href: reqs[0] ? `/admin/library/requests/${reqs[0]}` : "/admin/library/requests", priority: "normal" },
    { recipientUid: s.counsellor.uid, kind: "appointment_soon", title: "Session coming up in two days", href: "/admin/counselling", priority: "normal" },
  ];
  const out: string[] = [];
  await store.batch((w) => {
    for (const n of items) {
      const id = newId();
      const doc: StaffNotification = { ...n, read: false, createdAt: b.now - HOUR, readAt: null, expireAt: b.now + 90 * DAY };
      w.create(docPath("notifications", id), doc);
      out.push(id);
    }
  });
  bump(b.counts, C.notifications, items.length);
  return out;
}

const BLOCKS: Block[] = [
  { name: "staff", run: seedStaff },
  { name: "settings", run: seedSettings },
  { name: "referralPartners", run: seedReferralPartners },
  { name: "supportRequests", run: seedSupport },
  { name: "concerns", run: seedConcerns },
  { name: "appointments", run: seedAppointments },
  { name: "giving", run: seedGiving },
  { name: "engagement", run: seedEngagement },
  { name: "library", run: seedLibrary },
  { name: "engagement2", run: seedSubscribersAndStories },
  { name: "sponsors", run: seedSponsors },
  { name: "notifications", run: seedNotifications },
  { name: "extraStaff", run: seedExtraStaff },
];

function staffMap(): Record<Role, Staff> {
  const out = {} as Record<Role, Staff>;
  for (const role of Object.keys(PRACTICE_STAFF) as Role[]) out[role] = { uid: practiceUid(role), name: PRACTICE_STAFF[role].displayName };
  return out;
}

const G = globalThis as typeof globalThis & { __havenSeedRun?: Promise<SeedReport> | null };

async function runSeed(): Promise<SeedReport> {
  const started = Date.now();
  const store = getStore();
  const statePath = settingsPath("seed");
  const counts: Counts = {};
  const existing = await store.get<SeedState>(statePath);
  if (existing?.completedAt && existing.version >= SEED_VERSION) {
    return { seeded: false, alreadySeeded: true, version: existing.version, created: {}, total: 0, durationMs: Date.now() - started };
  }
  const state: SeedState = existing ? { ...existing, blocks: { ...existing.blocks } } : { version: SEED_VERSION, startedAt: started, completedAt: null, blocks: {} };
  if (!existing) await store.set(statePath, state);

  const ctx: BlockCtx = { now: started, counts, staff: staffMap(), refs: Object.fromEntries(Object.entries(state.blocks).map(([k, v]) => [k, v.refs])) };
  for (const block of BLOCKS) {
    if (state.blocks[block.name]) continue;
    const refs = await block.run(ctx);
    ctx.refs[block.name] = refs;
    state.blocks[block.name] = { at: Date.now(), refs };
    await store.set(statePath, state);
  }
  state.completedAt = Date.now();
  state.version = SEED_VERSION;
  await store.set(statePath, state);

  const total = Object.values(counts).reduce((a, n) => a + n, 0);
  await audit({
    actor: { kind: "system", job: "practice-seed" },
    action: "system.seed",
    area: "system",
    summary: `Practice data was added (${total} records)`,
  });
  log.info("dev.seed.done", { total });
  return { seeded: total > 0, alreadySeeded: false, version: SEED_VERSION, created: counts, total, durationMs: Date.now() - started };
}

/**
 * Seeds practice mode once (idempotent; safe to call on every local sign-in). Local backend off
 * Vercel only. `reset` is not supported: practice data is never deleted by code.
 */
export async function ensurePracticeSeed(opts?: { reset?: false }): Promise<SeedReport> {
  void opts;
  if (!devAllowed()) throw new Error("Practice data can only be added in local practice mode.");
  if (G.__havenSeedRun) return G.__havenSeedRun;
  const run = withLock("seed", runSeed).finally(() => {
    G.__havenSeedRun = null;
  });
  G.__havenSeedRun = run;
  return run;
}
