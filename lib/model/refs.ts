// Case references (client-safe). data-model §3 with PLAN D74:
//   sequenced  HVN-{PP}-{YYYY}-{NNNN}  gap-free, equal to the document id
//   concerns   HVN-XXXX-XXXX           random Crockford base32 (no I L O U), so nothing leaks
//   receipts   HVN-RC-YYYY-NNNN        field on a donation, gap-free for finance
//   sponsors   HVN-SP-NNNN             stable anonymous public code
// Generation is server-side only (lib/server/references.ts). This module parses and routes.

export const REF_PREFIX = {
  supportRequests: "SR",
  donations: "DN",
  recurringGifts: "RG",
  appointments: "AP",
  reportRequests: "RR",
  volunteerApplications: "VA",
  partnershipEnquiries: "PE",
  contactMessages: "CM",
  dataRequests: "DR",
  storySubmissions: "SS",
} as const;

export type SequencedCollection = keyof typeof REF_PREFIX;
export type RefPrefix = (typeof REF_PREFIX)[SequencedCollection];

export type RecordKind =
  | "support"
  | "concern"
  | "gift"
  | "inkind"
  | "session"
  | "reportRequest"
  | "volunteer"
  | "partner"
  | "message"
  | "recurring"
  | "dataRequest"
  | "story";

const PREFIXES = Object.values(REF_PREFIX) as RefPrefix[];
const COLLECTION_OF_PREFIX = Object.fromEntries(
  (Object.keys(REF_PREFIX) as SequencedCollection[]).map((c) => [REF_PREFIX[c], c]),
) as Record<RefPrefix, SequencedCollection>;

const KIND_OF_PREFIX: Record<RefPrefix, RecordKind> = {
  SR: "support",
  DN: "gift",
  RG: "recurring",
  AP: "session",
  RR: "reportRequest",
  VA: "volunteer",
  PE: "partner",
  CM: "message",
  DR: "dataRequest",
  SS: "story",
};

/** Crockford base32 alphabet without I, L, O and U. */
const CROCKFORD = "0-9A-HJKMNP-TV-Z";

export const SEQ_REF_RE: RegExp = new RegExp(`^HVN-(${PREFIXES.join("|")})-(\\d{4})-(\\d{4,})$`);
export const CONCERN_REF_RE: RegExp = new RegExp(`^HVN-[${CROCKFORD}]{4}-[${CROCKFORD}]{4}$`);
export const RECEIPT_RE: RegExp = /^HVN-RC-(\d{4})-(\d{4,})$/;
export const SPONSOR_RE: RegExp = /^HVN-SP-(\d{4,})$/;

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/**
 * Turns what staff type or say into a canonical reference, or null when it isn't one.
 *   "sr 2026 12", "SR-2026-12", "hvn-sr-2026-0012"  → "HVN-SR-2026-0012"
 *   "rc 2026 17"                                   → "HVN-RC-2026-0017"
 *   "sp 12"                                        → "HVN-SP-0012"
 *   "k7q2m9xd", "HVN K7Q2 M9XD"                    → "HVN-K7Q2-M9XD"
 */
export function normaliseRef(input: string): string | null {
  if (typeof input !== "string") return null;
  const s = input
    .trim()
    .toUpperCase()
    .replace(/[\s_./\\]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!s || s.length > 32) return null;

  const seq = /^(?:HVN-?)?([A-Z]{2})-?(\d{4})-?(\d{1,6})$/.exec(s);
  if (seq) {
    const [, prefix, year, num] = seq;
    const n = Number.parseInt(num, 10);
    if (n > 0 && ((PREFIXES as string[]).includes(prefix) || prefix === "RC")) return `HVN-${prefix}-${year}-${pad4(n)}`;
  }

  const sponsor = /^(?:HVN-?)?SP-?(\d{1,6})$/.exec(s);
  if (sponsor) {
    const n = Number.parseInt(sponsor[1], 10);
    if (n > 0) return `HVN-SP-${pad4(n)}`;
  }

  const concern = /^(?:HVN-?)?([0-9A-Z]{4})-?([0-9A-Z]{4})$/.exec(s);
  if (concern) {
    // Crockford decoding: I and L read as 1, O reads as 0; U never appears.
    const fix = (x: string) => x.replace(/[IL]/g, "1").replace(/O/g, "0");
    const a = fix(concern[1]);
    const b = fix(concern[2]);
    const ref = `HVN-${a}-${b}`;
    if (CONCERN_REF_RE.test(ref)) return ref;
  }
  return null;
}

export function isSequencedRef(ref: string): boolean {
  return SEQ_REF_RE.test(ref);
}

export function isConcernRef(ref: string): boolean {
  return CONCERN_REF_RE.test(ref);
}

/** The collection a canonical reference lives in, or null (receipts, sponsor codes and junk). */
export function collectionOfRef(ref: string): SequencedCollection | "safeguardingConcerns" | null {
  const seq = SEQ_REF_RE.exec(ref);
  if (seq) return COLLECTION_OF_PREFIX[seq[1] as RefPrefix];
  if (CONCERN_REF_RE.test(ref)) return "safeguardingConcerns";
  return null;
}

/** The record kind implied by a canonical reference. DN refs report "gift"; callers that know it is in-kind pass `kind`. */
export function kindOfRef(ref: string): RecordKind | null {
  const seq = SEQ_REF_RE.exec(ref);
  if (seq) return KIND_OF_PREFIX[seq[1] as RefPrefix];
  if (CONCERN_REF_RE.test(ref)) return "concern";
  return null;
}

const KIND_HOME: Record<RecordKind, string> = {
  support: "/admin/requests",
  concern: "/admin/safeguarding",
  gift: "/admin/giving",
  inkind: "/admin/giving",
  recurring: "/admin/giving",
  session: "/admin/counselling",
  reportRequest: "/admin/library/requests",
  volunteer: "/admin/people",
  partner: "/admin/people",
  message: "/admin/inbox",
  story: "/admin/inbox",
  dataRequest: "/admin/settings/data",
};

/**
 * The admin URL of a record's home view (admin-ux §4.2). Unknown references go to Today.
 * Privacy requests open inside Settings › Data; sponsor codes open in Giving › Sponsorship.
 */
export function adminHrefOfRef(ref: string, kind?: RecordKind): string {
  if (SPONSOR_RE.test(ref)) return `/admin/giving/sponsorship/${encodeURIComponent(ref)}`;
  const k = kind ?? kindOfRef(ref);
  if (!k) return "/admin";
  if (k === "dataRequest") return `${KIND_HOME[k]}?ref=${encodeURIComponent(ref)}`;
  return `${KIND_HOME[k]}/${encodeURIComponent(ref)}`;
}
