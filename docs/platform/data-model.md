# Haven platform: data model, security and data access

This doc covers the backend: data model, security and data-access layer. It is written for the person implementing it and is binding unless the owner overrides it. Sources:
- `docs/CLIENT-SPEC.md` §6–15 and the owner's direction at the bottom of that file
- `HANDOFF.md`
- the Next.js 16 docs in `node_modules/next/dist/docs/`: the Data Security guide, Proxy, `cookies`, `after`, `revalidateTag`/`updateTag`, `serverActions`, `taint`

Where the spec is silent, this doc decides. Every decision that needs owner or professional sign-off is listed in §15.

---

## 0. Decisions at a glance

1. **The browser never talks to Firestore or Storage directly.** Every read and write goes through the Next.js server:
   - Server Components, Server Actions and Route Handlers
   - calling a `server-only` data-access layer (DAL)
   - which uses `firebase-admin` or, in local mode, the local JSON adapter.

   `firestore.rules` and `storage.rules` therefore **deny everything** (§7).
2. **One storage interface (`DocStore`) with two adapters.**
   - `FirestoreAdapter` uses firebase-admin.
   - `LocalJsonAdapter` uses `.data/` and atomic file writes.

   The adapter is selected by env. Local mode refuses to start on Vercel, where the filesystem is read-only, so production must use Firestore (§8).
3. **Three layers. Only the DAL is imported by app code.**
   - `lib/server/db` is the engine.
   - `lib/server/db/repos` holds typed collections.
   - `lib/server/dal` holds the authorisation-aware use cases that return DTOs.
4. **Staff-only authentication.**
   - **Firestore mode:** Firebase Auth (email/password, optional Google), with the ID token exchanged for an httpOnly **session cookie** (`createSessionCookie`).
   - **Local mode:** scrypt-hashed accounts in `.data/auth`, with the first super admin seeded from `.env.local`.

   Roles live in Firestore (`staff/{uid}.roles`), not in custom claims, so a role change takes effect on the next request (§9).
5. **Roles combine.** `roles: Role[]`, because one person in a small NGO often holds two roles. Permissions are the union of the roles.
6. **Child-protection concerns are physically separate.** They have their own collection, DAL module, storage prefix, alert list, audit area and encrypted narrative fields. Only `safeguarding_officer` and `super_admin` can see them, and other staff cannot even see a count. Every read is audited.
7. **Case references.**
   - Format: `HVN-{PP}-{YYYY}-{NNNN}`, generated gap-free inside a Firestore transaction on `counters/{PP}-{YYYY}`.
   - The reference is also the **document id**.
   - Concerns are the exception: they get a random, non-sequential `HVN-XXXX-XXXX`, so neither the category nor the volume leaks (§3).
8. **Status machines.**
   - §13 machines are implemented exactly as specified, as transition tables with a permission and a guard per edge. The admin UI renders them as plain-language "next step" buttons.
   - Concern, appointment, partnership and post machines are derived from §5, §7 and §12, and are marked as such (§5).
9. **Sensitive free text is application-encrypted** (AES-256-GCM, `HAVEN_DATA_KEY`): concern narratives, support-request explanations, case notes and counsellor notes. Firebase console users see only ciphertext (§11.2).
10. **Public forms are Server Actions.** They get Next's built-in Origin check and progressive enhancement. Each one runs: zod → honeypot and time trap → per-IP-hash rate limit → optional Turnstile → transaction create → outbox email. No IP or user agent is stored on any record (§10).
11. **Email uses a transactional outbox** (`emailOutbox`), written in the same transaction as the record change. It is drained by `after()` plus a cron tick. Subjects come from templates and never carry case detail (§4.7).
12. **Retention is explicit.** Every case record carries a `retention` block. A daily cron does hard deletes for low-risk data and creates *review tasks*, not automatic deletes, for safeguarding and financial records (§11.4).

---

## 1. Architecture and file map

```
proxy.ts                          optimistic cookie check for /admin/** (UX only, never the security boundary)
firestore.rules                   deny-all (§7.1)
firestore.indexes.json            composite indexes + TTL + index exemptions (§7.3)
storage.rules                     deny-all (§7.2)
storage.cors.json                 for staff signed-URL uploads only (§7.4)
firebase.json                     points the Firebase CLI at the three files above (deploy only; no emulators)
.env.example                      every variable below, without values (needs `!.env.example` in .gitignore)

lib/model/                        SHARED (client-safe) types: enums, status unions, labels, DTO types. No secrets.
  enums.ts  status.ts  dto.ts  labels.ts
lib/schemas/                      SHARED zod input schemas (client for inline errors, server is authoritative)
  forms/{support,concern,donation,volunteer,partnership,contact,reportRequest,newsletter,dataRequest}.ts
  admin/*.ts                      admin mutation inputs
lib/server/                       every file starts with `import 'server-only'`
  env.ts                          zod-parsed env + backend resolution (§8.1)
  db/
    store.ts                      DocStore / Tx / Filter / ListQuery / Page / FieldOps types
    index.ts                      getStore(): memoised adapter on globalThis
    firestore.ts                  FirestoreAdapter
    local-json.ts                 LocalJsonAdapter
    local-fs.ts                   atomic write, file locks, mtime cache
    convert.ts                    *At <-> Timestamp, cursor encode/decode, id validation
    collections.ts                collection-name constants + path helpers
    repo.ts                       createRepo<T>(): typed wrapper (zod parse on read in dev)
    repos/<collection>.ts         one per collection
  storage/{index,gcs,local}.ts    BlobStore: put/get/stream/move/delete/signedUrl
  auth/{session,firebase,local,permissions,password,invitations,mfa}.ts
  security/{seal,hmac,ratelimit,spam,turnstile,origin,sanitise}.ts
  workflow/{flow,support,concern,donation,resourceRequest,volunteer,partnership,appointment,post}.ts
  dal/{dashboard,search,support,concerns,appointments,donations,recurring,appeals,volunteers,
       partnerships,contact,resources,reportRequests,newsletter,content,posts,media,consents,
       sponsors,staff,audit,privacy,notifications}.ts
  intake/{support,concern,donation,volunteer,partnership,contact,reportRequest,newsletter,dataRequest,upload}.ts
  references.ts  audit.ts  outbox.ts  notify.ts  retention.ts
  export/{csv,datasets}.ts
app/api/
  auth/session/route.ts           POST create session (Firebase mode), DELETE sign out
  uploads/route.ts                public single-file upload (≤4 MB) -> quarantine + signed upload token
  admin/uploads/{sign,local/[id],complete}/route.ts  staff large uploads
  admin/attachments/[...path]/route.ts               audited streamed download
  stripe/{checkout,webhook,portal}/route.ts          (payments doc owns behaviour; data shapes here)
  cron/{tick,retention,editorial}/route.ts           Bearer CRON_SECRET
  dev/{seed,selftest}/route.ts                       404 unless local backend and not Vercel
  dev/files/[...path]/route.ts                       local-mode stand-in for signed URLs (HMAC token, 60 s)
app/m/[...path]/route.ts          public media/resources from `public/` prefix, immutable cache
app/r/[token]/route.ts            controlled-report delivery link (HMAC token) -> 302 to 60 s signed URL
app/admin/export/[dataset]/route.ts  CSV stream (§12)
```

**Dependencies to add** (the implementer installs them, pinned to exact versions):
- `firebase-admin`. Next 16 already externalises it, see `next/dist/lib/server-external-packages.jsonc`.
- `firebase`, for the client auth SDK. Import it only from the `/admin/login` and `/admin/welcome` client components.
- `zod` (v4)
- `server-only`
- `stripe`

Also move **`sharp` from devDependencies to dependencies**, because uploads re-encode images on the server.

**Not adopted:**
- `experimental.taint`. Per `docs/01-app/03-api-reference/05-config/01-next-config-js/taint.md`, it switches the app directory to the React *experimental* channel, which is too risky for the finished landing page. DTO mappers do the job instead (§6.4).
- `authInterrupts` (`forbidden()`/`unauthorized()`). It is canary-only, so the DAL uses `redirect()` and `notFound()`.

---

## 2. Conventions (all collections)

```ts
// lib/model/enums.ts  (client-safe)
export type Millis = number;                    // epoch ms UTC. Org timezone is Africa/Banjul (UTC+0, no DST).
export type Uid = string;                       // Firebase uid, or "loc_<id>" in local mode
export type CountryCode = string;               // lowercase ISO-3166 alpha-2 as in content/world.ts, or "other"
export type Currency = "GMD" | "USD" | "GBP" | "EUR";   // re-export of content/home.ts Currency
export type ProgrammeId = "protection" | "education" | "medical" | "psychological" | "legal" | "family"; // = ProgrammeIconName
export type ContactMethod = "email" | "phone" | "whatsapp" | "sms";
export type AgeBand = "0-4" | "5-9" | "10-14" | "15-17" | "18+" | "unknown";
export type Money = { amountMinor: number; currency: Currency };   // integer minor units (butut, cents, pence)

/** AES-256-GCM envelope, base64url fields. Opened only inside the DAL after the permission check. */
export type Sealed = { $sealed: 1; kid: string; iv: string; tag: string; ct: string };

export type ConsentStamp = { at: Millis; noticeVersion: string };   // e.g. "privacy-2026-10"

export interface BaseDoc {
  createdAt: Millis;
  updatedAt: Millis;
  version: number;              // +1 on every write; admin edits send expectedVersion (optimistic concurrency)
}

export type IntakeSource = "web_form" | "staff_entry" | "moved_from_support" | "moved_from_contact" | "stripe" | "import";

export type RetentionInfo = {
  policy: RetentionPolicyId;    // §11.4
  retainUntil: Millis | null;   // set when the record reaches a terminal state
  legalHold: boolean;           // blocks deletion (set by super_admin / safeguarding_officer with reason)
};

/** Shared shape of every workflow record ("case"). */
export interface CaseDoc<S extends string> extends BaseDoc {
  reference: string;            // also the document id (sequenced HVN-PP-YYYY-NNNN; concerns: random HVN-XXXX-XXXX)
  status: S;
  statusChangedAt: Millis;
  assignedTo: Uid | null;
  assignedName: string | null;  // denormalised for lists; refreshed on staff rename
  assignedAt: Millis | null;
  followUpAt: Millis | null;    // "remind me" date shown on the owner's home
  lastActivityAt: Millis;
  closedAt: Millis | null;
  archived: boolean;            // §12 "close or archive": hides from queues; status unchanged
  archivedAt: Millis | null;
  tags: string[];
  searchTokens: string[];       // lowercase: reference, email, name words, phone last 6 digits. NEVER sealed content.
  retention: RetentionInfo;
  source: IntakeSource;
  isSample?: true;              // seeded demo data (local mode / staging); excluded from exports and stats
}
```

Rules:
- **Timestamps:** any field whose name ends in `At` holds epoch ms in the domain. The `FirestoreAdapter` converts these by name to Firestore `Timestamp`, recursively, so that the console is readable and TTL works. The `LocalJsonAdapter` stores numbers. Nothing else is converted.
- **Money:** always an integer number of minor units plus a currency. Amounts in different currencies are never summed (`totals: Record<Currency, …>`).
- **Ids:**
  - Sequenced collections use the reference as the id (`supportRequests/HVN-SR-2026-0001`).
  - Everything else uses `newId()`, 20 random base62 characters.
  - Both adapters reject ids that do not match `^[A-Za-z0-9_-]{1,64}$`. This also blocks path traversal in local mode.
- **Strings:** trimmed, NFC-normalised, control characters stripped, and capped by length in zod. Enumerations are strict unions; labels live in `lib/model/labels.ts`.
- **Search:** `emailLower` is stored next to `email`.
- **No IPs, user agents or geolocation are stored on any record.** Rate limiting uses a daily-salted HMAC of the IP in `rateLimits`, with a 24 h TTL.

---

## 3. Case references

| Collection | Prefix | Example | Shown to the public? |
|---|---|---|---|
| supportRequests | SR | `HVN-SR-2026-0001` | yes (confirmation screen + email) |
| donations (cash and in-kind) | DN | `HVN-DN-2026-0042` | yes (receipt) |
| receipt numbers (field on donation) | RC | `HVN-RC-2026-0017` | yes (gap-free for finance) |
| recurringGifts | RG | `HVN-RG-2026-0003` | yes |
| appointments | AP | `HVN-AP-2026-0009` | yes (counselling confirmation) |
| reportRequests | RR | `HVN-RR-2026-0011` | yes |
| volunteerApplications | VA | `HVN-VA-2026-0020` | yes |
| partnershipEnquiries | PE | `HVN-PE-2026-0004` | yes |
| contactMessages | CM | `HVN-CM-2026-0130` | yes |
| dataRequests | DR | `HVN-DR-2026-0002` | yes |
| sponsorProfiles | SP | `HVN-SP-0012` (no year: a stable public anonymous code) | yes |
| **safeguardingConcerns** | none | `HVN-K7Q2-M9XD` (random) | yes, on screen only by default |

- **Year:** the UTC year of creation, which is the Banjul year.
- **Number:** padded to 4 digits. Past 9999 it simply grows to `10000`.
- **Gap-free:** the counter read, the increment and the record `create` happen in **one transaction**. If any part fails, nothing commits.
- **Contention:** Firestore sustains about 1 write per second on one document, which is far above Haven's volume.

```ts
// lib/server/references.ts
const PREFIX = {
  supportRequests: "SR", donations: "DN", recurringGifts: "RG", appointments: "AP", reportRequests: "RR",
  volunteerApplications: "VA", partnershipEnquiries: "PE", contactMessages: "CM", dataRequests: "DR",
} as const;
export type SequencedCollection = keyof typeof PREFIX;

export async function createWithReference<T extends { reference: string }>(
  collection: SequencedCollection,
  build: (reference: string) => T,
  extra?: (tx: Tx, reference: string) => void,        // events, audit, outbox in the same commit
): Promise<string> {
  const store = getStore();
  const year = new Date().getUTCFullYear();
  const counter = `counters/${PREFIX[collection]}-${year}`;
  return store.runTransaction(async (tx) => {
    const c = await tx.get<{ next: number }>(counter);           // all reads before writes (Firestore rule)
    const n = c?.next ?? 1;
    const reference = `HVN-${PREFIX[collection]}-${year}-${String(n).padStart(4, "0")}`;
    tx.set(counter, { next: n + 1, updatedAt: Date.now() });
    tx.create(`${collection}/${reference}`, build(reference));   // create() fails if it exists
    extra?.(tx, reference);
    return reference;
  });
}

/** Receipt numbers: same pattern on counters/RC-YYYY, called inside the acknowledgement transaction. */
export async function nextReceiptNumber(tx: Tx, year: number): Promise<string> { /* … */ }

/** Concern refs: Crockford base32 (no I L O U), 8 chars, ~1.1e12 space. Retries create() on collision. */
export function randomConcernRef(): string; // "HVN-K7Q2-M9XD"
```

**Why concerns get random references.**
- A sequential `HVN-CP-2026-0007` would tell anyone who reads the reporter's email or screen that a *child-protection* report was made. The reporter may be a family member living with the person of concern.
- It would also reveal how many concerns Haven receives.

**Normalising staff search input:**
- `sr 2026 12`, `SR-2026-12` and `hvn-sr-2026-0012` all become `HVN-SR-2026-0012`, via `/(?:HVN-?)?([A-Z]{2})-?(\d{4})-?(\d{1,5})/i`.
- `k7q2m9xd` becomes `HVN-K7Q2-M9XD`.

---

## 4. Collections

### 4.0 Index of collections

| Collection | Purpose | Subcollections | Sequenced |
|---|---|---|---|
| `supportRequests` | §6 Get Support, including counselling requests (`category: "counselling"`) | `notes`, `events`, `attachments` | SR |
| `safeguardingConcerns` | §7 child-protection concerns | `actions`, `notes`, `events`, `attachments` | random |
| `appointments` | §5.4/§12 counselling sessions | `notes`, `events` | AP |
| `donations` | §8 cash and in-kind | `notes`, `events` | DN |
| `donationIntents` | Stripe checkout in progress (TTL 48 h) | | |
| `donors` | one profile per donor email (id = emailHash) | | |
| `recurringGifts` | monthly, quarterly and annual plans (Stripe subscription or manual) | `events` | RG |
| `appeals` | donate-able causes: goal, spending plan, totals | `revisions` | |
| `stripeEvents` | webhook idempotency (TTL 90 d) | | |
| `volunteerApplications` | §10 | `notes`, `events` | VA |
| `partnershipEnquiries` | §10 | `notes`, `events` | PE |
| `contactMessages` | §11 | `notes`, `events` | CM |
| `newsletterSubscribers` | double opt-in (id = emailHash) | | |
| `resources` | §9 library (public or controlled) | `revisions` | |
| `reportRequests` | §9 request flow | `notes`, `events` | RR |
| `siteContent` | editable page and section content (draft/published) | `revisions` | |
| `programmes` | the 6 programme pages (§5) | `revisions` | |
| `posts` | news and blog, including AI drafts | `revisions` | |
| `editorialPlans` | monthly AI topic steering | | |
| `aiJobs` | AI drafting runs log | | |
| `testimonials`, `stories`, `teamMembers` | consent-gated content items | `revisions` | |
| `media` | image, video and PDF library | | |
| `mediaConsents` | §15 guardian consent records | `attachments` | |
| `sponsorProfiles` | §10 anonymous sponsorship profiles | `updates` | SP |
| `staff` | staff profiles and roles (id = uid) | | |
| `invitations` | staff invites (id = sha256(token)) | | |
| `auditLog` | security and activity log | | |
| `emailOutbox` | outbox and email log (id = dedupe key) | | |
| `notifications` | in-app notifications per staff member | | |
| `counters` | reference sequences | | |
| `rateLimits` | abuse buckets (TTL 24 h) | | |
| `dataRequests` | §15 access, correction and deletion requests | `events` | DR |
| `retentionQueue` | due retention actions (id = `{collection}~{docId}`) | | |
| `settings` | `org`, `notifications`, `retention`, `forms` docs | | |

### 4.1 Shared subcollection types

```ts
// {parent}/notes/{id}: internal case notes (§12 "add internal notes")
export interface CaseNote extends BaseDoc {
  authorUid: Uid;
  authorName: string;
  kind: "note" | "call" | "referral" | "follow_up" | "decision" | "info_received";
  body: Sealed;                         // plaintext ≤ 4000 chars before sealing
  editableUntil: Millis;                // author may edit for 15 min; afterwards append-only (corrections = new note)
  deletedAt: Millis | null;             // soft delete by super_admin only, reason in audit
}

// {parent}/events/{id}: the case timeline shown in the admin record (human-readable, non-sensitive)
export interface CaseEvent {
  at: Millis;
  actor: { kind: "staff"; uid: Uid; name: string } | { kind: "system"; job: string } | { kind: "public" } | { kind: "stripe" };
  type:
    | "created" | "status_changed" | "assigned" | "unassigned" | "note_added" | "attachment_added"
    | "attachment_removed" | "email_queued" | "email_sent" | "email_failed" | "referral_recorded"
    | "field_updated" | "moved_to_safeguarding" | "reopened" | "archived" | "unarchived" | "merged";
  from?: string;
  to?: string;
  summary: string;                      // "Fatou moved this to Assigned". Never contains narrative or contact data.
}

// {parent}/attachments/{id}
export type AllowedMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
export interface AttachmentMeta {
  fileName: string;                     // sanitised: [a-z0-9._-], ≤ 80 chars, original extension kept
  mime: AllowedMime;                    // verified by magic bytes, not by the browser's claim
  sizeBytes: number;
  sha256: string;
  storagePath: string;                  // private/cases/{collection}/{docId}/{attId}.{ext}
  label: "id_document" | "medical_report" | "school_invoice" | "legal_document" | "photo" | "consent_form" | "other";
  uploadedBy: { kind: "public" } | { kind: "staff"; uid: Uid; name: string };
  uploadedAt: Millis;
  imageSanitised: boolean;              // true when re-encoded by sharp (EXIF/GPS stripped)
  scan: { status: "not_scanned" | "clean" | "infected"; at: Millis | null };   // Phase 1: not_scanned (§10.6)
  deletedAt: Millis | null;
}
```

Timeline versus audit log:
- `events` is the **case timeline**. It is part of the record, visible to whoever can see the case, and deleted with the case.
- `auditLog` is the **security log** (§4.7). It is append-only, kept separately, and is what the Viewer/Auditor reads.
- A status change writes both, in the same commit.

### 4.2 Support requests (§6), including counselling requests (§5.4)

All requests go into one queue for Programme Officers. A counselling request is a support request with `category: "counselling"` and a `counselling` block. The dedicated counselling form on the Psychological Support page writes the same document. Sessions live in `appointments` (§4.2.3).

```ts
export type SupportCategory =
  | "education" | "medical" | "counselling" | "legal" | "food_supplies" | "family_support" | "other";
// "child-protection concern" (a §6 category) is NOT stored here: the form deep-links to the concern form,
// and a submission with category=child_protection OR immediateDanger=true is written to safeguardingConcerns (§4.2.2).

export type SupportStatus =
  | "new" | "under_review" | "more_info_required" | "assigned" | "referred"
  | "approved" | "support_in_progress" | "completed" | "declined" | "closed";   // §13 exactly

export type Relationship =
  | "self" | "parent" | "guardian" | "relative" | "teacher" | "community_member" | "professional" | "other";

export interface SupportRequest extends CaseDoc<SupportStatus> {
  category: SupportCategory;
  programmeId: ProgrammeId;               // derived: education→education, medical→medical, counselling→psychological,
                                          // legal→legal, food_supplies|family_support|other→family
  applicant: {
    fullName: string;                     // ≤ 120
    relationship: Relationship;
    relationshipOther: string | null;     // ≤ 60
    email: string | null;
    emailLower: string | null;
    phone: string | null;                 // loose E.164: + and 6–20 digits
    country: CountryCode;
    locality: string | null;              // "town or region", ≤ 80. Never a street address.
    preferredContact: ContactMethod;
    bestTimes: string | null;             // ≤ 120
  };                                      // zod: at least one of email/phone, matching preferredContact
  child: { ageBand: AgeBand; numberOfChildren: number | null } | null;   // no child names, ever
  explanation: Sealed;                    // §6 "brief explanation", ≤ 2000 chars
  urgency: "low" | "medium" | "high";
  immediateDanger: false;                 // true is routed to safeguardingConcerns; stored here only as false
  consentToContact: ConsentStamp;         // required
  privacyAcknowledged: ConsentStamp;      // required
  counselling: {
    forWhom: "child" | "parent_or_caregiver" | "family";
    ageBand: AgeBand;
    language: string;                     // free text ≤ 40 ("Wolof", "Hindi", "Arabic", …)
    format: "video" | "phone" | "either";
    preferredTimes: string | null;        // ≤ 200
  } | null;
  education: { level: "pre_school" | "primary" | "secondary" | "vocational" | "other"; needs: ("fees" | "uniform" | "materials" | "hygiene" | "nutrition" | "bedding" | "devices")[] } | null;
  medical: { need: "referral" | "treatment_cost" | "supplies" | "information" } | null;
  legal: { matter: "custody_guardianship" | "documentation" | "abuse_proceedings" | "inheritance" | "other" } | null;
  triage: {
    eligibility: "eligible" | "ineligible" | "unclear" | null;
    verification: { status: "not_started" | "in_progress" | "verified" | "failed"; method: string | null; by: Uid | null; at: Millis | null };  // §6 "checked and verified"
  };
  moreInfo: { requestedAt: Millis; dueAt: Millis; channel: ContactMethod } | null;   // auto-close at dueAt+16 d (§5.1)
  referrals: Array<{ id: string; toName: string; toType: "health" | "legal" | "education" | "protection" | "psychosocial" | "community" | "government" | "other"; at: Millis; by: Uid; outcome: string | null }>;
  decision: { kind: "approved" | "declined"; reasonCode: string | null; note: string | null; by: Uid; at: Millis } | null;
  outcome: { summary: string; at: Millis; by: Uid } | null;          // required to complete; ≤ 500, non-identifying
  closureReason: "completed" | "declined" | "no_response" | "duplicate" | "spam" | "withdrawn" | "moved_to_safeguarding" | "other" | null;
  linkedConcernRef: string | null;        // visible as "Moved to safeguarding" to non-SO roles; ref shown only to SO/SA
  attachmentCount: number;
}
```

#### 4.2.2 Child-protection concerns (§7): restricted

```ts
export type ConcernStatus =
  | "received" | "screening" | "risk_assessed" | "escalated" | "referred" | "monitoring" | "closed";  // derived from §7 workflow
export type RiskLevel = "immediate" | "high" | "medium" | "low" | "no_concern";
export type ConcernType = "physical" | "sexual" | "emotional" | "neglect" | "exploitation" | "trafficking" | "online" | "child_marriage" | "other";
export type YesNoUnsure = "yes" | "no" | "unsure";

export interface SafeguardingConcern extends CaseDoc<ConcernStatus> {
  // reference = doc id = "HVN-XXXX-XXXX"
  reporter: {
    anonymous: boolean;
    identity: Sealed | null;              // { name, email, phone } JSON. null when anonymous.
    lookupHash: string | null;            // HMAC(emailLower) for §15 data-request search; sealed fields aren't searchable
    relationship: Relationship;
    safeFollowUp: Sealed | null;          // { method, times, notes }: §7 "safe method and time for follow-up"
    emailConfirmationAllowed: boolean;    // default false. Confirmation is shown on screen; email only if ticked.
  };
  child: {
    ageBand: AgeBand;                     // §7 "approximate age"
    country: CountryCode;                 // plaintext for safeguarding stats
    location: Sealed;                     // { area, details }: free-text location
  };
  concernTypes: ConcernType[];            // plaintext enums (SO dashboard filters)
  narrative: Sealed;                      // §7 "nature of the concern", ≤ 5000 chars
  inDangerNow: YesNoUnsure;
  authoritiesContacted: YesNoUnsure;
  authorityDetails: Sealed | null;
  consent: ConsentStamp;
  riskLevel: RiskLevel | null;
  risk: { assessedBy: Uid; assessedAt: Millis; rationale: Sealed } | null;
  escalation: { at: Millis; by: Uid; to: "police" | "social_welfare" | "health" | "child_protection_authority" | "other"; externalRef: Sealed | null } | null;
  acknowledgedAt: Millis | null;          // first SO opened it (stops re-alerts)
  realertCount: number;
  suspectedSpam: boolean;                 // honeypot/time-trap hits are KEPT here, flagged, never discarded
  closureReason: "resolved" | "referred_out" | "no_concern" | "duplicate" | "spam" | "other" | null;
  linkedSupportRef: string | null;
}

// safeguardingConcerns/{ref}/actions/{id}: §7 step 6 "actions and follow-ups are recorded"
export interface ConcernAction extends BaseDoc {
  kind: "contacted_authority" | "contacted_service" | "home_visit" | "call" | "meeting" | "follow_up_due" | "follow_up_done" | "other";
  at: Millis;
  dueAt: Millis | null;                   // the earliest open dueAt is mirrored to the parent's `followUpAt` in the same txn,
  doneAt: Millis | null;                  // so "follow-ups due" is a plain query on safeguardingConcerns (no collection-group)
  byUid: Uid;
  byName: string;
  detail: Sealed;
}
```

**Routing into this collection:**
- the concern form (`source: "web_form"`)
- a support-form submission with `category=child_protection` or `immediateDanger=true` (`source: "moved_from_support"`). Nothing is written to `supportRequests`.
- staff using "Move to safeguarding" on a support request or contact message. A new concern is created. Then, in the same transaction, the source record's narrative is replaced with the sealed text "Moved to safeguarding on {date} by {name}", `linkedConcernRef` is set, and the source is closed with `closureReason: "moved_to_safeguarding"`.

#### 4.2.3 Counselling appointments

```ts
export type AppointmentStatus = "scheduled" | "completed" | "no_show" | "cancelled";   // derived (§5.4/§12)

export interface Appointment extends CaseDoc<AppointmentStatus> {
  supportRef: string;                     // HVN-SR-…, never shown to counsellors as a link they can open
  counsellorUid: Uid;                     // assignedTo === counsellorUid (kept in both for generic queues)
  counsellorName: string;
  sessionNumber: number;                  // 1, 2, 3… within the support request
  startsAt: Millis;
  durationMin: 30 | 45 | 60 | 90;
  clientTimezone: string;                 // IANA, for emails ("Africa/Banjul", "Asia/Dhaka")
  mode: "zoom" | "phone" | "in_person";
  zoom: { joinUrl: string; meetingId: string | null; passcode: string | null; source: "manual" | "zoom_api" } | null;
                                          // host start URLs are never stored
  clientSnapshot: {                       // minimal copy at scheduling time, so counsellors never read supportRequests
    displayName: string;                  // first name or initials only
    forWhom: "child" | "parent_or_caregiver" | "family";
    ageBand: AgeBand;
    language: string;
    contactEmail: string | null;          // for system emails; never shown to counsellors
    phoneForCall: string | null;          // only when mode=phone; counsellor sees it from 24 h before to 24 h after
    reasonSummary: string;                // ≤ 300, written by the Programme Officer, non-identifying
  };
  attendance: { status: "attended" | "no_show" | "late_cancel" | "cancelled_by_client" | "cancelled_by_haven"; recordedBy: Uid; recordedAt: Millis } | null;
  reminders: { confirmationQueuedAt: Millis | null; reminder24hQueuedAt: Millis | null; reminder1hQueuedAt: Millis | null };
  followUp: { recommended: boolean; byDate: Millis | null } | null;
  cancelReason: string | null;
}

// appointments/{ref}/notes/{id}: CaseNote with kind "follow_up" only. UI copy: "Keep this brief and non-clinical.
// Clinical notes belong in your professional records, not here." (§12 "limited follow-up notes"; §15 no diagnoses)
```

Rescheduling keeps the status `scheduled`. It updates `startsAt`, cancels the queued reminders by dedupe key and queues new ones (§4.7). An event is logged.

### 4.3 Giving

```ts
export type DonationStatus = "pledged" | "pending" | "received" | "acknowledged" | "allocated" | "completed" | "cancelled"; // §13
export type Frequency = "one_time" | "monthly" | "quarterly" | "annual";
export type InKindCategory =
  | "school_materials" | "clothing" | "bedding" | "food_supplies" | "medical_supplies"
  | "computers_devices" | "furniture" | "professional_services" | "other";            // §8 list
export type AllocationTarget =
  | { type: "general" }
  | { type: "programme"; programmeId: ProgrammeId }
  | { type: "appeal"; appealId: string };

export interface DonorSnapshot {
  fullName: string;
  donorType: "individual" | "organisation";
  organisationName: string | null;
  email: string;
  emailLower: string;
  phone: string | null;                   // optional (PII minimisation)
  country: CountryCode;
}

export interface Donation extends CaseDoc<DonationStatus> {
  kind: "cash" | "in_kind";
  donorId: string;                        // donors/{emailHash}
  donor: DonorSnapshot;                   // snapshot at gift time (receipts must not change retroactively)
  recognition: "named" | "anonymous";     // §8 anonymous-recognition option (public lists only)
  frequency: Frequency;                   // one_time for in-kind
  preferredTarget: AllocationTarget;      // donor's choice ("preferred programme")
  comments: string | null;                // ≤ 1000
  updatesConsent: ConsentStamp | null;    // §8 consent to updates
  cash: {
    amount: Money;
    method: "stripe" | "bank_transfer" | "mobile_money" | "cash" | "cheque" | "other";
    stripe: {
      checkoutSessionId: string | null;
      paymentIntentId: string | null;
      chargeId: string | null;
      customerId: string | null;
      subscriptionId: string | null;
      invoiceId: string | null;
      balanceTransactionId: string | null;
      fee: Money | null;                  // from balance transaction (settlement currency)
      net: Money | null;
      livemode: boolean;
    } | null;                             // §8: card data never stored; Stripe Checkout hosts the card form
    externalRef: string | null;           // bank/mobile-money reference typed by finance
  } | null;
  inKind: {
    categories: InKindCategory[];
    description: string;                  // ≤ 1000
    estimatedValue: Money | null;         // §8 "estimated in-kind value"
    quantity: string | null;              // ≤ 80, free text ("40 school bags")
    condition: "new" | "good" | "used" | null;
    delivery: "drop_off" | "collection" | "shipping" | "to_arrange";
    availableFrom: Millis | null;
    locality: string | null;              // city/region for collection planning, ≤ 80
    received: Array<{ description: string; quantity: string; value: Money | null; receivedAt: Millis; by: Uid }>;
  } | null;
  allocations: Array<{                    // §12 "track programme allocation"; sum ≤ amount (or estimated value)
    id: string;
    target: AllocationTarget;
    amount: Money;                        // same currency as the gift
    at: Millis;
    by: Uid;
    note: string | null;
  }>;
  acknowledgement: { at: Millis; by: Uid | "system"; outboxId: string } | null;
  receipt: { number: string; issuedAt: Millis; pdfPath: string | null } | null;   // private/receipts/{yyyy}/{number}.pdf
  recurringGiftRef: string | null;
  appealId: string | null;                // the appeal the donor came from (attribution), may differ from allocation
  receivedAt: Millis | null;
  completedAt: Millis | null;
  cancelledAt: Millis | null;
  cancelReason: "checkout_failed" | "refunded" | "pledge_withdrawn" | "duplicate" | "other" | null;
  refund: { amount: Money; at: Millis; stripeRefundId: string | null } | null;
}

// donationIntents/{id}: written when a Stripe Checkout Session is created; TTL expireAt = +48 h.
// The Donation (with a DN reference) is created only when money is real (checkout.session.completed), so
// abandoned checkouts never consume references or clutter the finance queue.
export interface DonationIntent {
  createdAt: Millis;
  expireAt: Millis;
  amount: Money;
  frequency: Frequency;
  preferredTarget: AllocationTarget;
  appealId: string | null;
  donor: DonorSnapshot;
  recognition: "named" | "anonymous";
  comments: string | null;
  updatesConsent: ConsentStamp | null;
  checkoutSessionId: string;
  status: "open" | "completed" | "expired";
  donationRef: string | null;             // set in the same transaction that creates the Donation (idempotency)
}

// donors/{emailHash}: emailHash = HMAC-SHA256(HAVEN_LOOKUP_SECRET, emailLower), base64url, 32 chars
export interface Donor extends BaseDoc {
  email: string;
  emailLower: string;
  fullName: string;
  donorType: "individual" | "organisation";
  organisationName: string | null;
  country: CountryCode;
  phone: string | null;
  recognition: "named" | "anonymous";     // latest preference
  updatesConsent: ConsentStamp | null;
  updatesWithdrawnAt: Millis | null;
  stripeCustomerId: string | null;
  totals: Partial<Record<Currency, { lifetimeMinor: number; gifts: number }>>;   // received gifts only, net of refunds
  firstGiftAt: Millis | null;
  lastGiftAt: Millis | null;
  activeRecurring: number;
  searchTokens: string[];
  retention: RetentionInfo;
}

export type RecurringStatus = "incomplete" | "active" | "past_due" | "paused" | "cancelled";   // mirrors Stripe
export interface RecurringGift extends BaseDoc {
  reference: string;                      // HVN-RG-…
  donorId: string;
  donor: Pick<DonorSnapshot, "fullName" | "email" | "emailLower" | "country">;
  amount: Money;
  frequency: Exclude<Frequency, "one_time">;   // Stripe: month×1, month×3, year×1
  target: AllocationTarget;
  provider: "stripe" | "manual";          // manual = bank standing order recorded by finance
  stripe: { customerId: string; subscriptionId: string; latestInvoiceId: string | null } | null;
  status: RecurringStatus;
  startedAt: Millis;
  currentPeriodEnd: Millis | null;
  cancelAt: Millis | null;
  cancelledAt: Millis | null;
  cancelReason: string | null;
  giftCount: number;
  lastPaymentAt: Millis | null;
  lastFailureAt: Millis | null;
  searchTokens: string[];
  retention: RetentionInfo;
}

// appeals/{slug}: donate-able causes, edited by content (copy) and finance (figures)
export interface Appeal extends BaseDoc {
  slug: string;                           // shareable /donate/{slug}
  status: "draft" | "live" | "closed" | "archived";
  draft: AppealContent | null;
  published: AppealContent | null;        // draft/published envelope, as for all content (§4.6)
  programmeId: ProgrammeId | null;
  currency: Currency;                     // goal currency; gifts in other currencies are tracked separately
  goal: Money | null;
  totals: Partial<Record<Currency, { raisedMinor: number; gifts: number }>>;   // incremented in allocation txns
  figures: { mode: "auto" | "manual"; manualRaised: Money | null; verifiedBy: Uid | null; verifiedAt: Millis | null };
                                          // the public "raised" figure shows only when verified (ToR §3)
  opensAt: Millis | null;
  closesAt: Millis | null;
}
export interface AppealContent {
  title: string;
  season: string;
  group: string;
  country: CountryCode;
  summary: string;
  story: string;                          // markdown, no raw HTML
  imageMediaId: string;
  tone: "flame" | "forest" | "clay";
  spendingPlan: Array<{ label: string; percent: number; detail: string | null }>;    // sums to 100: "where the money goes"
  impactUnits: Array<{ amount: Money; label: string }>;                              // "GMD 2,500 keeps one child in school for a term"
}

// stripeEvents/{stripeEventId}: written first in the webhook transaction; duplicate deliveries are no-ops
export interface StripeEventRecord {
  type: string;
  receivedAt: Millis;
  processedAt: Millis | null;
  donationRef: string | null;
  error: string | null;
  expireAt: Millis;                       // TTL +90 d
}
```

**Stripe events that touch data:**

| Event | Effect |
|---|---|
| `checkout.session.completed` | `paid`: Donation created as `received`. `unpaid` (async methods): Donation created as `pending`. |
| `checkout.session.async_payment_succeeded` | → `received` |
| `checkout.session.async_payment_failed` | → `cancelled` |
| `checkout.session.expired` | intent `expired` (no Donation) |
| `invoice.paid` | creates the recurring Donation, id = reference, idempotent through `stripeEvents` |
| `invoice.payment_failed` | RecurringGift `past_due`, `lastFailureAt` |
| `customer.subscription.updated` / `customer.subscription.deleted` | RecurringGift status mirror |
| `charge.refunded` | Donation → `cancelled` with `refund`, totals decremented |

A received Stripe gift is acknowledged automatically: a receipt number is generated, a receipt email is queued, and the status becomes `acknowledged`, all in one transaction. A gift whose `preferredTarget` is not `general` is also **auto-allocated** to that target and becomes `allocated`. Finance can re-allocate.

**Without Stripe keys:** the donate page records a cash gift as a `pledged` Donation with `method` set to `bank_transfer`, `mobile_money` or `other`. It shows the transfer details from `settings/org` and alerts finance. Nothing breaks.

**GMD:** confirm that Stripe accepts GMD as a presentment currency (§15). If it doesn't, GMD gifts always take the pledge path.

### 4.4 Engagement

```ts
export type VolunteerStatus = "submitted" | "screening" | "interview" | "approved" | "onboarding" | "active" | "inactive" | "declined"; // §13
export type VolunteerInterest =
  | "community_outreach" | "education_support" | "counselling_psychosocial" | "medical_assistance" | "legal_assistance"
  | "fundraising" | "communications" | "research" | "administration" | "technology_support";   // §10 list

export interface VolunteerApplication extends CaseDoc<VolunteerStatus> {
  applicant: {
    fullName: string;
    email: string;
    emailLower: string;
    phone: string | null;
    country: CountryCode;
    locality: string | null;
  };
  isAdult: true;                          // "I am 18 or older": required (safeguarding)
  interests: VolunteerInterest[];         // ≥ 1
  skills: string | null;                  // ≤ 1000
  languages: string[];                    // ≤ 6
  availability: { hoursPerWeek: "1-3" | "4-8" | "9-16" | "17+"; mode: "remote" | "in_person" | "either" };
  motivation: string | null;              // ≤ 1500
  workedWithChildren: boolean;
  backgroundCheckConsent: boolean;        // consent to a check if the role involves children
  safeguardingCheck: { status: "not_required" | "pending" | "cleared" | "not_cleared"; at: Millis | null; by: Uid | null } | null;
                                          // outcome only; check documents are handled offline, never uploaded
  interview: { at: Millis | null; by: Uid | null; outcomeNote: string | null } | null;
  consentToContact: ConsentStamp;
  privacyAcknowledged: ConsentStamp;
  declineReasonCode: string | null;
}

export type PartnershipStatus = "new" | "under_review" | "in_discussion" | "agreed" | "active" | "declined" | "closed";  // derived
export type PartnershipType =
  | "programme" | "corporate_sponsorship" | "technical_assistance" | "institutional_referral"
  | "research_collaboration" | "donation_partnership" | "awareness_campaign" | "other";       // §10 list
export interface PartnershipEnquiry extends CaseDoc<PartnershipStatus> {
  organisation: {
    name: string;
    kind: "ngo" | "company" | "government" | "school" | "health_provider" | "faith_org" | "university" | "other";
    website: string | null;
    country: CountryCode;
  };
  contact: { fullName: string; role: string | null; email: string; emailLower: string; phone: string | null };
  partnershipType: PartnershipType;
  message: string;                        // ≤ 3000
  consentToContact: ConsentStamp;
}

export type ContactStatus = "new" | "replied" | "closed" | "spam";
export type ContactCategory =
  | "general" | "donation" | "partnership" | "volunteering" | "media" | "programme_info" | "resource_request" | "technical_support"; // §11
export interface ContactMessage extends CaseDoc<ContactStatus> {
  fullName: string;
  email: string;
  emailLower: string;
  phone: string | null;
  country: CountryCode;
  subject: string;                        // ≤ 150
  category: ContactCategory;
  message: string;                        // ≤ 3000
  consent: ConsentStamp;
  replies: Array<{ at: Millis; by: Uid; byName: string; outboxId: string }>;   // reply text lives in the outbox (purged 90 d)
  linkedConcernRef: string | null;
}

// newsletterSubscribers/{emailHash}: double opt-in
export interface NewsletterSubscriber extends BaseDoc {
  email: string | null;                   // null after the PII purge of an unsubscribed record
  emailLower: string | null;
  firstName: string | null;
  status: "pending" | "confirmed" | "unsubscribed";
  source: "footer" | "join_section" | "donation" | "volunteer" | "post" | "admin_import";
  interests: ProgrammeId[];
  consent: ConsentStamp;
  confirmTokenHash: string | null;        // sha256 of the emailed token (expires 7 d)
  confirmedAt: Millis | null;
  unsubscribedAt: Millis | null;
  retention: RetentionInfo;
}
```

### 4.5 Resources and report requests (§9)

```ts
export type ResourceCategory =
  | "child_safeguarding" | "child_rights" | "parenting" | "mental_health" | "education" | "medical_information"
  | "legal_information" | "organisational_policies" | "annual_reports" | "research";      // §9 list

export interface Resource extends BaseDoc {
  slug: string;
  status: "draft" | "published" | "archived";
  access: "public" | "controlled";        // public = instant download; controlled = request + approval (§9)
  category: ResourceCategory;
  title: string;
  shortDescription: string;               // ≤ 300 (card)
  executiveSummary: string;               // markdown, ≤ 4000 (preview shown to everyone)
  coverMediaId: string | null;
  publicationDate: Millis;
  programmeIds: ProgrammeId[];
  language: string;
  file: { storagePath: string; sizeBytes: number; pageCount: number | null; sha256: string };
                                          // public → public/resources/{id}/{hash}.pdf ; controlled → private/resources/{id}/{hash}.pdf
  preview: { storagePath: string; pageCount: number } | null;   // optional sample pages PDF, always public/
  downloadCount: number;                  // public downloads via /resources/{slug}/download
  requestCount: number;
  publishedAt: Millis | null;
  publishedBy: Uid | null;
}

export type ReportRequestStatus = "new" | "under_review" | "approved" | "sent" | "declined" | "closed";   // §13
export interface ReportRequest extends CaseDoc<ReportRequestStatus> {
  resourceId: string;
  resourceTitle: string;                  // snapshot
  requester: { fullName: string; organisation: string | null; email: string; emailLower: string; country: CountryCode };
  reason: string;                         // ≤ 1000
  consent: ConsentStamp;
  decision: { kind: "approved" | "declined"; by: Uid; at: Millis; note: string | null; declineReasonCode: string | null } | null;
  delivery: {
    tokenId: string;                      // random id inside the HMAC token, lets us revoke
    expiresAt: Millis;                    // 7 days
    sentAt: Millis | null;                // set by the outbox when the email is accepted → status "sent"
    downloads: number;
    lastDownloadAt: Millis | null;
    revokedAt: Millis | null;
  } | null;
}
```

### 4.6 Content (admin-editable site)

Every editable content item uses the same **draft/published envelope**, so staff always get "Save draft", "Preview" and "Publish". If a document is missing or `published` is null, the public site falls back to the static defaults in `content/*.ts`. The landing page therefore keeps working with an empty database.

```ts
export interface ContentEnvelope<T> extends BaseDoc {
  draft: T | null;
  draftUpdatedBy: Uid | null;
  draftUpdatedAt: Millis | null;
  published: T | null;
  publishedVersion: number;
  publishedAt: Millis | null;
  publishedBy: Uid | null;
  editLock: { uid: Uid; name: string; until: Millis } | null;   // soft lock, 5 min heartbeat: "Aminata is editing"
}
// {doc}/revisions/{publishedVersion}: { payload: T; publishedAt; publishedBy; note }. Keep the last 20 (pruned on publish).

export type SiteContentKey =
  | "site"          // content/site.ts: contacts, socials, tagline, emergency notice, ticker
  | "home"          // content/home.ts sections: hero, about, duo, impact (copy), focus, donate copy, journey, join…
  | "impact"        // admin-updatable statistics (§3) with verification, below
  | "faq"           // content/people.ts faq
  | "about" | "getSupport" | "getInvolved" | "donatePage" | "contact"
  | "policy.safeguarding" | "policy.privacy" | "policy.terms";
// siteContent/{key}: ContentEnvelope<SiteContentPayload[key]>. Payload zod schemas live next to the static defaults
// (content/schemas.ts) so the defaults are type-checked against the same schema.

export interface ImpactStat {
  id: "children_supported" | "families_reached" | "school_fee_interventions" | "counselling_sessions"
    | "medical_cases" | "volunteers_partners" | "donations_received_distributed";   // §3 list
  label: string;
  value: number;
  suffix: string;
  note: string;
  tone: "clay" | "marigold" | "cocoa" | "forest";
  source: string;                         // "Programme records Q3 2026"
  verifiedBy: Uid | null;
  verifiedAt: Millis | null;              // publish is blocked unless every shown stat is verified (§3)
  show: boolean;
}

// programmes/{ProgrammeId}: ContentEnvelope<ProgrammePage>, the §5 nine-part structure
export interface ProgrammePage {
  title: string;
  headline: string;
  overview: string;
  problem: string;
  supportProvided: string[];
  eligibility: string;
  process: Array<{ step: string; detail: string }>;
  notice: string | null;                  // emergency / medical / legal disclaimers (§5)
  contact: { name: string; email: string; phone: string | null };
  relatedResourceIds: string[];
  heroMediaId: string | null;
  spendingPlan: AppealContent["spendingPlan"];   // "where the money goes" for programme-level gifts
}

// testimonials/{id}, stories/{id}, teamMembers/{id}: ContentEnvelope<…> plus consent gating
export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  country: CountryCode;
  kind: "beneficiary" | "donor" | "volunteer" | "partner" | "professional";
  portraitMediaId: string | null;
  consentId: string | null;
  order: number;
}
export interface Story {
  title: string;
  paragraph: string;
  country: CountryCode;
  imageMediaId: string;
  consentId: string | null;
  order: number;
}                                         // stories stay anonymised: no names (HANDOFF)
export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  portraitMediaId: string | null;
  socials: Array<{ icon: string; href: string }>;
  order: number;
}

export type PostStatus = "idea" | "drafting" | "in_review" | "changes_requested" | "scheduled" | "published" | "archived";  // derived
export interface Post extends BaseDoc {
  slug: string;
  status: PostStatus;
  kind: "news" | "blog" | "update";
  title: string;
  excerpt: string;
  body: string;                           // markdown subset, rendered server-side, raw HTML disallowed
  coverMediaId: string | null;
  programmeIds: ProgrammeId[];
  tags: string[];
  authorUid: Uid | null;
  authorName: string;
  origin: "human" | "ai";
  ai: { jobId: string; model: string; promptVersion: string; generatedAt: Millis; notesForReviewer: string } | null;
  review: {
    reviewerUid: Uid;
    reviewedAt: Millis;
    checklist: { factsChecked: boolean; noIdentifyingChildInfo: boolean; imagesConsentedOrIllustrative: boolean; noDiagnosisOrAdvice: boolean };
    note: string | null;
  } | null;                               // REQUIRED (all true) before scheduled/published; AI can never publish
  scheduledFor: Millis | null;
  publishedAt: Millis | null;
  seo: { title: string | null; description: string | null };
  editLock: ContentEnvelope<unknown>["editLock"];
}
// posts/{id}/revisions/{n}: snapshot on each publish

export interface EditorialPlan extends BaseDoc {   // editorialPlans/{yyyy-mm}
  month: string;
  themes: string[];
  milestones: Array<{ title: string; date: Millis | null; detail: string }>;   // "Eid packs delivered in Banjul"
  toneNotes: string;
  postsWanted: number;                    // default 2
  status: "planning" | "ready" | "drafted" | "done";
  generatedPostIds: string[];
}
export interface AiJob {                  // aiJobs/{id}
  kind: "monthly_blog_drafts" | "single_draft";
  planId: string | null;
  status: "queued" | "running" | "succeeded" | "failed";
  startedAt: Millis;
  finishedAt: Millis | null;
  model: string;
  postIds: string[];
  error: string | null;
  triggeredBy: Uid | "cron";
}

export interface MediaAsset extends BaseDoc {   // media/{id}
  kind: "image" | "video" | "pdf";
  storagePath: string;                    // public/media/{id}/{sha256-12}.{ext}. Content-hashed, so a replaced file gets a new URL.
  width: number | null;
  height: number | null;
  sizeBytes: number;
  alt: string;                            // required for images
  caption: string | null;
  credit: string | null;
  aiGenerated: boolean;                   // HANDOFF: AI images are labelled illustrative
  showsChildren: boolean;
  consentIds: string[];
  consentState: "not_required" | "valid" | "missing" | "expired" | "withdrawn";   // denormalised, recomputed daily
  uploadedBy: Uid;
}
// Publish guard (any content/post/appeal/story): every referenced media with showsChildren && !aiGenerated
// must have consentState "valid"; AI-generated child imagery must render the "Illustrative image" label.

export interface MediaConsent extends BaseDoc {   // mediaConsents/{id}: §15 written guardian consent
  subjectCode: string;                    // internal code e.g. "C-014"; names live ONLY in the signed form (attachment)
  guardianRelationship: "mother" | "father" | "guardian" | "self_adult";
  scope: { website: boolean; social: boolean; print: boolean; story: boolean; image: boolean; video: boolean };
  signedAt: Millis;
  expiresAt: Millis;                      // default signedAt + 2 y, or the child's 18th birthday if earlier
  withdrawnAt: Millis | null;
  verifiedBy: Uid;                        // safeguarding_officer or super_admin
  notes: Sealed | null;
}
// mediaConsents/{id}/attachments/{id}: the signed form (private/consents/…)

export interface SponsorProfile extends BaseDoc {   // sponsorProfiles/{code}: §10, strictly anonymous
  code: string;                           // "HVN-SP-0012"
  status: "draft" | "published" | "fully_funded" | "archived";
  ageRange: "3-5" | "6-8" | "9-11" | "12-14" | "15-17";
  supportCategory: ProgrammeId;
  need: { amount: Money; period: "one_off" | "per_term" | "per_month" | "per_year"; description: string };   // ≤ 300
  funded: Money;
  linkedSupportRef: string | null;        // programme_officer/super_admin only; NEVER in the public DTO
  publishedAt: Millis | null;
}
// sponsorProfiles/{code}/updates/{id}: { at, text (programme-level, ≤ 500), by, published }
// Publish lint (server): reject text containing capitalised two-word names, phone/email patterns, or
// "street|road|compound" with a number. The reviewer must still tick "No names, precise locations or medical history".
```

### 4.7 Staff and system

```ts
export type Role =
  | "super_admin" | "content_manager" | "programme_officer" | "safeguarding_officer"
  | "finance_officer" | "counsellor" | "report_manager" | "viewer";
export type ViewerScope = "support_summary" | "donations_summary" | "donations_detail" | "engagement" | "content" | "audit";

export interface StaffProfile extends BaseDoc {   // staff/{uid}
  uid: Uid;
  email: string;
  emailLower: string;
  displayName: string;
  roles: Role[];                          // ≥ 1
  viewerScopes: ViewerScope[];            // used only when roles includes "viewer"
  programmeScope: ProgrammeId[] | "all";  // programme_officer queue filter; default "all"
  status: "active" | "suspended" | "deactivated";
  mfa: { required: boolean; enrolled: boolean; enrolledAt: Millis | null };   // required = role-derived (§9.4)
  counsellor: { languages: string[]; bio: string | null; maxPerWeek: number; acceptingClients: boolean } | null;
  notificationPrefs: { email: "instant" | "daily_digest" | "off"; inApp: boolean };
  avatarMediaId: string | null;
  lastSignInAt: Millis | null;
  sessionsRevokedAt: Millis | null;       // any session issued before this is rejected (§9.2)
  invitedBy: Uid | null;
  authProvider: "password" | "google" | "local";
}

export interface Invitation {             // invitations/{sha256(token)}
  email: string;
  emailLower: string;
  displayName: string;
  roles: Role[];
  viewerScopes: ViewerScope[];
  invitedBy: Uid;
  createdAt: Millis;
  expiresAt: Millis;                      // +72 h
  acceptedAt: Millis | null;
  revokedAt: Millis | null;
  createdUid: Uid | null;
  expireAt: Millis;                       // TTL +30 d
}

export type AuditArea =
  | "auth" | "support" | "safeguarding" | "counselling" | "donations" | "engagement" | "resources"
  | "content" | "staff" | "settings" | "privacy" | "export" | "system";
export interface AuditEntry {             // auditLog/{id}: append-only
  at: Millis;
  actor: { kind: "staff"; uid: Uid; name: string; roles: Role[] } | { kind: "system"; job: string } | { kind: "public" } | { kind: "stripe" };
  action: string;                         // "auth.sign_in", "auth.sign_in_failed", "record.view", "record.create", "record.update",
                                          // "status.change", "assign", "note.add", "attachment.download", "export.run",
                                          // "content.publish", "staff.invite", "staff.roles_change", "staff.deactivate",
                                          // "mfa.reset", "settings.change", "privacy.*", "retention.delete", "retention.anonymise"
  area: AuditArea;
  feed: boolean;                          // true = show in "Recent activity" (creates, status changes, assignments,
                                          // publishes); false = record.view, auth.*, export.run, retention.*
  targetPath: string | null;              // "supportRequests/HVN-SR-2026-0001"
  targetRef: string | null;
  summary: string;                        // "Fatou moved HVN-SR-2026-0001 to Assigned", never sensitive content
  changes: Array<{ field: string; from?: string | number | boolean | null; to?: string | number | boolean | null; redacted?: true }> | null;
                                          // values of sealed/contact fields are always { redacted: true }
  ipHash: string | null;
  requestId: string;
}

export type EmailTemplateId =
  | "support_confirmation" | "support_more_info" | "support_declined" | "concern_alert" | "concern_reporter_confirmation"
  | "donation_acknowledgement" | "inkind_follow_up" | "pledge_instructions" | "recurring_receipt" | "recurring_failed"
  | "counselling_confirmation" | "zoom_reminder_24h" | "zoom_reminder_1h" | "counselling_cancelled"
  | "report_request_confirmation" | "report_delivery" | "report_declined"
  | "volunteer_acknowledgement" | "partnership_acknowledgement" | "contact_confirmation" | "contact_reply"
  | "newsletter_confirm" | "data_request_verify" | "data_request_done"
  | "staff_invite" | "staff_password_reset" | "staff_access_changed" | "staff_alert_digest";   // §14 + system

export interface OutboxEmail {            // emailOutbox/{dedupeKey}: e.g. "support_confirmation~HVN-SR-2026-0001"
  template: EmailTemplateId;
  to: string[];                           // resolved addresses; for staff alerts use toStaffUids and resolve at send time
  toStaffUids: Uid[];
  subject: string;                        // rendered from the template's fixed subject + reference only (§14)
  vars: Record<string, string | number> | Sealed;   // Sealed when vars include anything beyond reference/name/links
  status: "queued" | "sending" | "sent" | "failed" | "cancelled" | "suppressed";
  scheduledFor: Millis;                   // now, or a future time for Zoom reminders
  attempts: number;
  nextAttemptAt: Millis;                  // backoff 1, 5, 30, 120, 720 min, then failed
  leaseUntil: Millis | null;              // claimed in a transaction to prevent double sends (after() + cron)
  lastError: string | null;
  provider: string | null;
  providerMessageId: string | null;
  related: { path: string; reference: string } | null;
  createdAt: Millis;
  sentAt: Millis | null;
  bodyPurgedAt: Millis | null;            // vars nulled at +90 d (cron); metadata kept
  expireAt: Millis;                       // TTL +1 y
}

export interface StaffNotification {      // notifications/{id}
  recipientUid: Uid;
  kind: "new_case" | "assigned_to_you" | "status_changed" | "follow_up_due" | "concern_alert" | "appointment_soon" | "mention" | "system";
  title: string;                          // non-sensitive: "New safeguarding item needs review"
  href: string;                           // /admin/…
  priority: "normal" | "urgent";
  read: boolean;
  createdAt: Millis;
  readAt: Millis | null;
  expireAt: Millis;                       // TTL +90 d
}

export interface Counter { next: number; updatedAt: Millis }   // counters/{PP}-{YYYY}
export interface RateLimitBucket { count: number; windowStart: Millis; expireAt: Millis }  // rateLimits/{sha256(form|ipHash|window)}

export type DataRequestStatus = "unverified" | "verified" | "in_progress" | "completed" | "rejected";
export interface DataRequest extends CaseDoc<DataRequestStatus> {   // §15 correction / deletion
  type: "access" | "correction" | "deletion" | "stop_contact";
  requester: { fullName: string; email: string; emailLower: string; phone: string | null };
  details: string;                        // ≤ 2000
  knownReferences: string[];
  verifyTokenHash: string | null;
  verifiedAt: Millis | null;
  dueAt: Millis;                          // createdAt + 30 d
  findings: Array<{ path: string; action: "corrected" | "deleted" | "anonymised" | "restricted" | "no_action"; reason: string; at: Millis; by: Uid }>;
}

export interface RetentionQueueItem {     // retentionQueue/{collection~docId}
  path: string;
  policy: RetentionPolicyId;
  dueAt: Millis;
  mode: "auto_delete" | "auto_anonymise" | "review";
  createdAt: Millis;
}

// settings/notifications
export interface NotificationSettings {
  concernAlert: { uids: Uid[]; fallbackEmail: string | null; realertAfterMin: 120 };   // default: every active safeguarding_officer
  routes: Partial<Record<"support_new" | "donation_new" | "inkind_new" | "report_request_new" | "volunteer_new" | "partnership_new" | "contact_new", Uid[]>>;
                                          // empty = everyone holding the owning role (§6.2)
}
// settings/org: { timezone: "Africa/Banjul", financialYearStartMonth: 1, bankTransferText, mobileMoneyText,
//                 receiptFooter, charityRegistration, defaultCurrency: "GMD" }
// settings/forms: { supportOpen: boolean, counsellingOpen: boolean, closedMessage }: pause intake without a deploy
```

**Email subject rule (§14).** Each template declares a fixed subject in which the only variable allowed is the reference. Examples: "We've received your request (HVN-SR-2026-0042)" and "Your Haven receipt HVN-RC-2026-0017". The concern alert subject is always "Haven: a new item needs your attention". Its body contains only the reference, a priority word and a sign-in link, never details about the child or the reporter. `outbox.enqueue()` refuses any subject that does not match the template's pattern.

---

## 5. Status machines

`lib/server/workflow/flow.ts` defines a generic machine. Each machine below is a table of `from → to` edges. Every edge has:
- the **permission** needed
- a **guard** (fields that must be present)
- a **staff-facing verb**, rendered as a "next step" button
- **side effects**: email, notification and auto fields

A transition runs in one transaction: read the record, check the edge and the guard, update the record, add an `events` entry, add an `auditLog` entry, and enqueue to the outbox. A failed guard throws `TransitionError` with a plain-language message, for example "Assign someone first, then you can mark this as Assigned."

```ts
type Edge<S, R> = { to: S; perm: Permission; verb: string; guard?: (rec: R, input: TransitionInput) => string | null; effects?: Effect[] };
export type Flow<S extends string, R> = Record<S, Edge<S, R>[]>;
// Reopen edges require a reason (min 10 chars) and are logged as "reopened".
```

The **assignee rule** applies to every machine that has an assignee. A user who holds the manage permission may move any record. The UI shows "My cases" first. There is no edge for an `assignedTo`-only user without the role permission.

### 5.1 Support request (§13, exact states)

| From | To | Verb (button) | Who | Guard and effects |
|---|---|---|---|---|
| new | under_review | Start review | PO, SA | Sets `assignedTo` to the actor if empty |
| new / under_review | declined | Decline | PO, SA | `decision.reasonCode` required. The *support_declined* email is optional: there is a "Let them know" checkbox, ticked by default, and it is sent only if an email address exists. |
| new / under_review | closed | Close (duplicate or spam) | PO, SA | `closureReason` ∈ duplicate, spam, withdrawn |
| under_review | more_info_required | Ask for more information | PO, SA | Message text required. Email *support_more_info* if an email exists, otherwise a "call" note is required. Sets `moreInfo.dueAt` = +14 d. |
| more_info_required | under_review | Information received | PO, SA | Adds an `info_received` note |
| more_info_required | closed | Close: no response | PO, SA, **system** | The system closes it at `dueAt` + 16 d (30 d total), with `closureReason: no_response` |
| under_review | assigned | Assign to… | PO, SA | `assignedTo` required (picker of PO staff). Notifies the assignee. |
| assigned | more_info_required | Ask for more information | PO, SA | As above |
| under_review / assigned | referred | Record a referral | PO, SA | At least one `referrals[]` entry |
| under_review / assigned / referred | approved | Approve support | PO, SA | `triage.verification.status = verified` and `eligibility = eligible` (§6 "checked and verified") |
| assigned / referred | declined | Decline | PO, SA | Reason required |
| approved / referred | support_in_progress | Start support | PO, SA | For counselling, creating the first appointment moves `approved` to `support_in_progress` automatically |
| support_in_progress / referred | completed | Mark as complete | PO, SA | `outcome.summary` required |
| completed / declined | closed | Close case | PO, SA, **system** | The system closes it 30 d after `completed` or `declined`. Sets `retention.retainUntil` (§11.4). |
| closed | under_review | Reopen | PO, SA | Reason required. Only possible while the record still exists (before retention). |
| any open state | closed | Move to safeguarding | PO, SA | Creates a concern (§4.2.2), redacts the source, `closureReason: moved_to_safeguarding` |

PO = programme_officer, SA = super_admin. Archive and unarchive are available on `closed` only, with `support.manage`.

### 5.2 Donation (§13, exact states)

| From | To | Verb | Who | Guard and effects |
|---|---|---|---|---|
| (create) | pledged | — | public form (in-kind offer, offline cash), FO | Email *pledge_instructions* (cash) or *inkind_follow_up* (in-kind) |
| (create) | pending | — | stripe (async payment) | |
| (create) | received | — | stripe (`checkout.session.completed` paid, `invoice.paid`) | Then auto → acknowledged (→ allocated) in the same transaction |
| pledged | pending | Confirm arrangement | FO, SA | In-kind: delivery arranged (`availableFrom`). Cash: transfer promised. |
| pledged / pending | received | Mark as received | FO, SA, stripe | Cash: `cash.amount` and `method` required. In-kind: at least one `inKind.received` line. Sets `receivedAt` and updates donor totals. |
| received | acknowledged | Send thank-you and receipt | FO, SA, system | Generates the receipt number (RC sequence) in the transaction. Email *donation_acknowledgement*. |
| acknowledged | allocated | Allocate to programmes | FO, SA, system | `allocations` total > 0 and ≤ amount. Appeal totals are incremented in the same transaction. |
| allocated | allocated | Change allocation | FO, SA | Totals are adjusted by the delta and logged |
| allocated | completed | Mark funds used / items distributed | FO, SA | `allocations` total = amount |
| pledged / pending | cancelled | Cancel pledge | FO, SA, stripe | Reason required |
| received / acknowledged / allocated | cancelled | Record refund | FO, SA, stripe | `refund` required. Donor and appeal totals are reversed. |

FO = finance_officer. `completed` and `cancelled` are terminal; only SA can reopen `cancelled` → `pledged`, with a reason.

### 5.3 Resource (report) request (§13, exact states)

| From | To | Verb | Who | Effects |
|---|---|---|---|---|
| new | under_review | Start review | RM, SA | |
| new / under_review | approved | Approve and send | RM, SA | Creates the `delivery` token (7 d) and queues *report_delivery* |
| approved | sent | — | **system** (outbox accepted the email) | `delivery.sentAt` |
| approved | approved | Resend link | RM, SA | New token; the old `tokenId` is revoked |
| new / under_review | declined | Decline | RM, SA | Reason code. Optional email *report_declined*. |
| sent / declined | closed | Close | RM, SA, system | The system closes it 14 d after `sent` or `declined` |
| sent | sent | Revoke link | RM, SA | `delivery.revokedAt` |
| closed | under_review | Reopen | RM, SA | Reason |

RM = report_manager. Requests for `public` resources are never created, because those download immediately.

### 5.4 Volunteer (§13, exact states)

| From | To | Verb | Who | Guard |
|---|---|---|---|---|
| submitted | screening | Start screening | PO, SA | Auto-email *volunteer_acknowledgement* was already sent at submission |
| submitted / screening / interview | declined | Decline | PO, SA | Reason code |
| screening | interview | Invite to interview | PO, SA | `interview.at` |
| screening / interview | approved | Approve | PO, SA | Interests that involve children (education, counselling, medical, outreach) require `safeguardingCheck.status ∈ {cleared, not_required}` |
| approved | onboarding | Start onboarding | PO, SA | |
| onboarding | active | Mark active | PO, SA | |
| approved / onboarding / active | inactive | Mark inactive | PO, SA | Sets retention |
| inactive | active | Reactivate | PO, SA | |
| declined | screening | Reopen | SA | Reason |

### 5.5 Child-protection concern (derived from §7; SO and SA only)

| From | To | Verb | Who | Guard and effects |
|---|---|---|---|---|
| (create) | received | — | public, PO/SA (move), SO | Alert *concern_alert* to `settings/notifications.concernAlert` plus an urgent in-app notification. If `inDangerNow=yes`, priority "Immediate". |
| received | screening | Open and screen | SO, SA | Sets `acknowledgedAt`, which stops re-alerts. Opening the record auto-applies this. |
| screening | risk_assessed | Record risk level | SO, SA | `riskLevel` and `risk.rationale` required |
| screening / risk_assessed | closed | Close: no concern / duplicate / spam | SO, SA | `closureReason` required. `no_concern` requires a rationale. |
| risk_assessed / monitoring | escalated | Escalate now | SO, SA | `escalation.to` required. A `contacted_authority` action is required within the same submit (§7 steps 4–5). |
| risk_assessed / escalated / monitoring | referred | Record referral to services | SO, SA | A `contacted_service` action is required |
| risk_assessed / escalated / referred | monitoring | Monitor and follow up | SO, SA | At least one action with a `dueAt` |
| any open state | closed | Close case | SO, SA | `closureReason` and a closing action note. Sets retention to **review** mode (§11.4). |
| closed | screening | Reopen | SO, SA | Reason |

**Re-alert:** the cron tick (every 15 min) re-notifies the whole alert list, plus every super admin, when a concern is still `received` after `realertAfterMin` (120 min). If `inDangerNow=yes`, it does so after 30 min. The re-alert runs at most 3 times.

### 5.6 Appointment, partnership and post (derived)

- **Appointment:**
  - Programme officers can make these changes:
    - `scheduled → cancelled`, with "Cancel session" and a reason. This cancels queued reminders and sends *counselling_cancelled*.
    - re-time a `scheduled` appointment, with "Reschedule".
  - The **assigned counsellor** or a programme officer can make these changes:
    - `scheduled → completed` with "Mark attended" (attendance `attended`)
    - `scheduled → no_show` with "Mark no-show"
    - `scheduled → cancelled` with "Client cancelled"
  - Counsellors can also set or replace `zoom.joinUrl` and add follow-up notes on their own appointments.
  - `completed` and `no_show` can be corrected back to `scheduled` within 48 h by a programme officer or super admin.
- **Partnership:**
  - Programme officers and super admins move it `new → under_review → in_discussion → agreed → active → closed`.
  - Any open state can go → `declined`.
  - `closed` → `under_review` to reopen.
- **Contact message:**
  - `new → replied`: "Reply", which sends a *contact_reply* email.
  - `new` or `replied` → `closed`.
  - Any state → `spam`.
  - The owning roles per category (§6.2) can do this.
- **Post:**
  - The publishing path is `idea → drafting → in_review → (changes_requested ↔ drafting) → scheduled | published → archived`.
  - These moves need `post.draft`: drafting, and submitting for review.
  - These moves need `post.publish`: requesting changes, scheduling, publishing and archiving.
  - Before `scheduled` or `published`:
    - the `review` checklist must be all true
    - every image must pass the consent guard
  - The system only ever moves `scheduled → published`, at `scheduledFor`.
  - An `origin:"ai"` post enters at `in_review`, and **only a human holding `post.publish` can move it on.**
- **Recurring gift:** mirrors Stripe through the webhook. Finance can set `manual` plans to `active`, `paused` or `cancelled`.
- **Data request:**
  - The requester's verification link moves `unverified → verified`.
  - A super admin moves `verified → in_progress → completed`, or to `rejected` with a reason.
  - If a request is still `unverified` after 14 days, it is deleted.

---

## 6. Roles and permissions (§12)

### 6.1 Permission catalogue

```ts
// lib/server/auth/permissions.ts
export type Permission =
  | "dashboard.view"
  | "support.read" | "support.manage" | "support.export" | "support.summary"
  | "concern.read" | "concern.manage"
  | "appointment.manage" | "appointment.own"
  | "donation.read" | "donation.contact" | "donation.manage" | "donation.export" | "donation.summary" | "donation.recognition" | "appeal.figures"
  | "volunteer.read" | "volunteer.manage" | "volunteer.export" | "volunteer.summary"
  | "partnership.read" | "partnership.manage" | "partnership.export" | "partnership.summary"
  | "contact.read" | "contact.manage"                 // narrowed by category routing (§6.2)
  | "newsletter.read" | "newsletter.export"
  | "resource.read" | "resource.manage" | "resource.publish"
  | "reportRequest.read" | "reportRequest.manage" | "reportRequest.export"
  | "content.read" | "content.edit" | "content.publish" | "impact.verify"
  | "post.draft" | "post.publish" | "ai.manage"
  | "media.manage" | "consent.status" | "consent.manage"
  | "sponsor.manage" | "sponsor.publish"
  | "staff.directory" | "staff.manage" | "audit.read" | "audit.read.safeguarding" | "audit.export"
  | "settings.manage" | "privacy.manage" | "outbox.read";

const ALL = "*" as const;
export const ROLE_PERMS: Record<Role, readonly Permission[] | typeof ALL> = {
  super_admin: ALL,
  content_manager: ["dashboard.view", "content.read", "content.edit", "content.publish", "post.draft", "post.publish", "ai.manage",
    "media.manage", "consent.status", "resource.read", "resource.manage", "resource.publish", "reportRequest.read",
    "newsletter.read", "newsletter.export", "contact.read", "contact.manage", "sponsor.publish", "donation.recognition", "staff.directory"],
  programme_officer: ["dashboard.view", "support.read", "support.manage", "support.export", "appointment.manage",
    "volunteer.read", "volunteer.manage", "volunteer.export", "partnership.read", "partnership.manage", "partnership.export",
    "contact.read", "contact.manage", "sponsor.manage", "post.draft", "resource.read", "donation.summary", "staff.directory"],
  safeguarding_officer: ["dashboard.view", "concern.read", "concern.manage", "consent.status", "consent.manage",
    "audit.read.safeguarding", "staff.directory"],
  finance_officer: ["dashboard.view", "donation.read", "donation.contact", "donation.manage", "donation.export", "donation.summary",
    "appeal.figures", "contact.read", "contact.manage", "staff.directory"],
  counsellor: ["dashboard.view", "appointment.own", "resource.read", "staff.directory"],
  report_manager: ["dashboard.view", "resource.read", "reportRequest.read", "reportRequest.manage", "reportRequest.export",
    "contact.read", "contact.manage", "staff.directory"],
  viewer: ["dashboard.view", "staff.directory"],     // + scopes below; never any *.manage / *.contact
};
export const VIEWER_SCOPE_PERMS: Record<ViewerScope, Permission[]> = {
  support_summary: ["support.summary"],
  donations_summary: ["donation.summary"],
  donations_detail: ["donation.summary", "donation.read"],            // no donation.contact → emails/phones stripped
  engagement: ["volunteer.summary", "partnership.summary"],
  content: ["content.read", "resource.read", "reportRequest.read"],
  audit: ["audit.read", "audit.export"],                               // excludes area "safeguarding"
};
// "*" expands to every Permission (including concern.*, audit.read.safeguarding).
```

### 6.2 Collection-level matrix

Key:
- **M**: read and manage, including status changes, notes and assignment
- **R**: read
- **S**: summary DTO only (no names, contact details or narrative)
- **Own**: only records assigned to them
- **P**: may publish
- **—**: no access. The route returns **404**, not 403, so it doesn't reveal that the record exists.

Super Admin has M/P on every row.

| Area / collection | Content Mgr | Programme Off. | Safeguarding Off. | Finance Off. | Counsellor | Report Mgr | Viewer (by scope) |
|---|---|---|---|---|---|---|---|
| Dashboard tiles (§6.5) | content tiles | support, counselling, engagement | concerns | giving | my sessions | requests | scope tiles |
| supportRequests (+notes, attachments) | — | M (+export) | — | — | — | — | S (`support_summary`) |
| **safeguardingConcerns** (+actions, notes, attachments) | — | — (can *create* through "Move to safeguarding") | **M** (no export) | — | — | — | — |
| appointments | — | M (all) | — | — | **Own**: view, Zoom link, attendance, follow-up notes | — | — |
| donations, donors, recurringGifts | recognition list only | S (allocation totals per programme) | — | M (+export) | — | — | S, or R without contact (`donations_detail`) |
| appeals | M/P (copy, images, spending plan) | R | — | M (goal, figures verification) | — | — | R (`content`) |
| volunteerApplications | — | M (+export) | — | — | — | — | S (`engagement`) |
| partnershipEnquiries | — | M (+export) | — | — | — | — | S (`engagement`) |
| contactMessages | M: general, media, technical_support | M: general, partnership, volunteering, programme_info | — (receives moved items as concerns) | M: donation | — | M: resource_request | — |
| newsletterSubscribers | M (+export) | — | — | — | — | — | — |
| resources | M/P | R | — | — | R (published) | R | R (`content`) |
| reportRequests | R | — | — | — | — | M (+export) | R (`content`) |
| posts, editorialPlans, aiJobs | M/P | draft only (own drafts, submit for review) | — | — | — | — | R (`content`) |
| siteContent, programmes, testimonials, stories, teamMembers | M/P | — | — | — | — | — | R (`content`) |
| impact stats | edit (not verify) | — | — | — | — | — | R (`content`) |
| media | M | upload for own drafts | — | — | — | — | — |
| mediaConsents | status only (valid / expired, scope) | — | M (incl. signed forms) | — | — | — | — |
| sponsorProfiles | P (publish) | M (draft, linked case) | — | R (funding) | — | — | — |
| staff | directory | directory | directory | directory | directory | directory | directory |
| invitations, settings | — | — | — | — | — | — | — |
| auditLog | own activity | own activity | own + area `safeguarding` | own activity | own activity | own activity | R (`audit`, excluding safeguarding) |
| emailOutbox | — (sees emails on case timelines) | — | — | — | — | — | — |
| dataRequests | — | — | — | — | — | — | — |

Super-admin-only:
- impact `verify`
- staff management, invitations and MFA reset
- settings
- dataRequests
- outbox monitor and retry
- the retention review queue (SO shares it for concerns)

**Contact category routing** (`lib/server/dal/contact.ts`):

```ts
export const CONTACT_OWNERS: Record<ContactCategory, Role[]> = {
  general: ["content_manager", "programme_officer"],
  donation: ["finance_officer"],
  partnership: ["programme_officer"],
  volunteering: ["programme_officer"],
  media: ["content_manager"],
  programme_info: ["programme_officer"],
  resource_request: ["report_manager"],
  technical_support: ["content_manager"],
};
// list query: where category in categoriesFor(viewer)  (super_admin: all). Staff can re-route a message (audited).
```

### 6.3 Field-level rules

These are enforced only by the DTO mappers in `lib/server/dal/*`. Raw repository objects never leave the DAL.

| Record | Field group | Visible to |
|---|---|---|
| SupportRequest | `applicant.*`, `explanation` (opened), `notes`, `attachments` | support.read (PO, SA) |
| | reference, category, programme, urgency, status, country, created/closed, assignee name, days open | support.summary (Viewer) |
| | `linkedConcernRef` value | concern.read only; others see the boolean "Moved to safeguarding" |
| SafeguardingConcern | everything, with sealed fields opened on the detail view only (lists show reference, age band, country, types, risk, status, age of case) | concern.read |
| Appointment | `clientSnapshot.contactEmail` | appointment.manage only |
| | `clientSnapshot.phoneForCall` | the assigned counsellor between `startsAt − 24 h` and `startsAt + 24 h`, plus appointment.manage |
| | `supportRef` | appointment.manage. Counsellors see "Case on file" with no link. |
| | notes | the author counsellor, plus appointment.manage |
| Donation / Donor / RecurringGift | `donor.email`, `donor.phone`, `comments`, Stripe ids | donation.contact (FO, SA) |
| | name, organisation, country, amounts, status, allocations, receipt no. | donation.read (incl. Viewer `donations_detail`) |
| | per-programme / per-appeal totals by currency | donation.summary |
| | public recognition list: `fullName` if recognition = named, else "Anonymous friend" | donation.recognition (content manager, for an optional donor wall) |
| VolunteerApplication | contact, motivation, `safeguardingCheck`, interview | volunteer.read |
| | status, interests, country, created | volunteer.summary |
| MediaConsent | `subjectCode`, scope, dates, state | consent.status |
| | `notes` (opened), signed-form attachment | consent.manage (SO, SA) |
| SponsorProfile | `linkedSupportRef` | sponsor.manage |
| StaffProfile | `displayName`, `roles`, avatar, `counsellor.languages` | staff.directory (everyone) |
| | email, status, MFA, last sign-in | staff.manage |
| AuditEntry | entries with `area: "safeguarding"` | audit.read.safeguarding (SO, SA) |

### 6.4 Enforcement in code

```ts
// lib/server/auth/session.ts
export type Viewer = {
  uid: Uid;
  displayName: string;
  email: string;
  roles: Role[];
  perms: ReadonlySet<Permission>;
  viewerScopes: ViewerScope[];
  programmeScope: ProgrammeId[] | "all";
  authTime: Millis;                      // last real sign-in (for step-up)
  mfa: boolean;
  backend: "firebase" | "local";
};
export const getViewer = cache(async (): Promise<Viewer | null> => { /* §9.2 */ });

export async function requireStaff(...anyOf: Permission[]): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/admin/login");
  if (anyOf.length && !anyOf.some((p) => v.perms.has(p))) notFound();   // don't reveal existence
  return v;
}
/** Step-up: last real sign-in within maxAgeMs AND the cookie passes verifySessionCookie(cookie, checkRevoked=true). */
export async function requireRecentAuth(v: Viewer, nextPath: string, maxAgeMs = 12 * 3600_000): Promise<void> {
  if (Date.now() - v.authTime > maxAgeMs || !(await sessionStillValid({ checkRevoked: true })))
    redirect(`/admin/confirm?next=${encodeURIComponent(nextPath)}`);   // nextPath: app-relative, validated to start with "/admin/"
}
```

Rules for implementers:
1. Every DAL function begins with `requireStaff(...)`. This includes functions called from Server Actions: per the Next Data Security guide, page-level checks do **not** cover actions.
2. Record-level checks:
   - Appointments: `rec.counsellorUid === v.uid || v.perms.has("appointment.manage")`.
   - Contact messages: category routing.
   - Support requests: `programmeScope`.
   - **IDOR:** every check loads the record and verifies it, so an id passed in a URL is never trusted.
3. DTO mappers (`toSupportDetailDTO(rec, v)`) build new objects field by field. A spread of a raw record (`...rec`) is **banned**, with a lint rule `no-restricted-syntax` on `SpreadElement` inside `lib/server/dal/**/dto*.ts`.
4. Sealed fields are opened (`open(sealed)`) only inside detail mappers, after the permission check.
5. Server Action return values carry only `{ ok, reference?, fieldErrors? }`, never records.
6. **Step-up:** `requireRecentAuth` (last sign-in within 12 h, and `verifySessionCookie(…, checkRevoked=true)`) applies to these actions:
   - opening the concerns area
   - any export
   - staff and role management
   - MFA reset
   - data-request actions
   - settings
7. Safeguarding audit:
   - `dal/concerns.ts` writes a `record.view` audit entry on **every** detail view and every attachment download.
   - `dal/support.ts` does the same for detail views and attachment downloads.

### 6.5 Dashboard tiles (counts)

Counts use Firestore `count()` aggregation, which costs one read per 1,000 index entries. They run in parallel. Each viewer computes only the tiles they are permitted, and the result is cached for 30 s per `(uid)` in a per-process LRU. **The concern tile is never computed for viewers without `concern.read`.**

| Tile (§12 main view) | Query | Permission |
|---|---|---|
| New support requests | supportRequests `archived==false && status in [new]` | support.read / support.summary |
| Needs your attention | supportRequests `assignedTo==me && status in [under_review, more_info_required, assigned, referred, approved, support_in_progress]` | support.read |
| Pending child-protection concerns | safeguardingConcerns `status in [received, screening, risk_assessed, escalated]` (+ red badge when any is `received`) | concern.read |
| Donation enquiries | donations `kind==cash && status in [pledged, pending]` | donation.read |
| In-kind offers | donations `kind==in_kind && status in [pledged, pending]` | donation.read |
| Counselling sessions this week | appointments `status==scheduled && startsAt in [now, +7d]` (counsellor: `+ counsellorUid==me`) | appointment.manage / appointment.own |
| Resource requests | reportRequests `status in [new, under_review]` | reportRequest.read |
| Volunteer applications | volunteerApplications `archived==false && status in [submitted, screening]` | volunteer.read / summary |
| Partnership enquiries | partnershipEnquiries `archived==false && status in [new, under_review]` | partnership.read / summary |
| Published resources | resources `status==published` | resource.read |
| Posts awaiting review | posts `status==in_review` | post.publish |
| Recent activity | auditLog `feed == true && area in areasFor(viewer)` orderBy `at desc` limit 10 | dashboard.view |

---

## 7. Firebase rules and project configuration

### 7.1 `firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Haven: browsers never read or write Firestore. Every access goes through the Next.js server,
    // which uses the Admin SDK (rules do not apply to it) and enforces roles in lib/server/dal.
    // Keep this deny-all. If a realtime feature is ever added, open ONE narrow path, e.g.:
    //   match /notifications/{id} {
    //     allow read: if request.auth != null && resource.data.recipientUid == request.auth.uid;
    //   }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 7.2 `storage.rules`

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Deny-all. Public files are streamed by app/m/[...path] (public/ prefix only, immutable cache);
    // private files are streamed by audited admin routes or reached through 60-second signed URLs.
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**Bucket layout.** Bucket location must match Firestore (§15). Settings: uniform bucket-level access on, public access prevention **enforced**, soft delete 30 d.

```
public/media/{mediaId}/{sha12}.{ext}          images/videos/PDF covers referenced by content (content-hashed)
public/resources/{resourceId}/{sha12}.pdf     public resource files + preview PDFs
private/resources/{resourceId}/{sha12}.pdf    controlled reports
private/cases/{collection}/{docId}/{attId}.{ext}
private/consents/{consentId}/{attId}.{ext}
private/receipts/{yyyy}/{receiptNumber}.pdf
quarantine/{uploadId}                         unvalidated uploads; lifecycle rule: delete age > 1 day
```

### 7.3 `firestore.indexes.json`

The composite indexes below are the complete set of DAL queries. A query outside this list is a review failure: add the index in the same PR.

```json
{
  "indexes": [
    { "collectionGroup": "supportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "archived", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "supportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "assignedTo", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "lastActivityAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "supportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "programmeId", "order": "ASCENDING" }, { "fieldPath": "archived", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "supportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "category", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "supportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },

    { "collectionGroup": "safeguardingConcerns", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "archived", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "safeguardingConcerns", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "riskLevel", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "safeguardingConcerns", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "assignedTo", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "lastActivityAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "supportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "statusChangedAt", "order": "ASCENDING" } ] },
    { "collectionGroup": "reportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "statusChangedAt", "order": "ASCENDING" } ] },

    { "collectionGroup": "appointments", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "counsellorUid", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "startsAt", "order": "ASCENDING" } ] },
    { "collectionGroup": "appointments", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "startsAt", "order": "ASCENDING" } ] },
    { "collectionGroup": "appointments", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "supportRef", "order": "ASCENDING" }, { "fieldPath": "startsAt", "order": "ASCENDING" } ] },

    { "collectionGroup": "donations", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "kind", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "donations", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "donations", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "kind", "order": "ASCENDING" }, { "fieldPath": "receivedAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "donations", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "donorId", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "donations", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "recurringGiftRef", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "donations", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "recurringGifts", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },

    { "collectionGroup": "volunteerApplications", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "archived", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "volunteerApplications", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "interests", "arrayConfig": "CONTAINS" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "partnershipEnquiries", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "archived", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "contactMessages", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "category", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "reportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "reportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "resourceId", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "newsletterSubscribers", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },

    { "collectionGroup": "resources", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "category", "order": "ASCENDING" }, { "fieldPath": "publicationDate", "order": "DESCENDING" } ] },
    { "collectionGroup": "resources", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "publicationDate", "order": "DESCENDING" } ] },
    { "collectionGroup": "posts", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "publishedAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "posts", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "kind", "order": "ASCENDING" }, { "fieldPath": "publishedAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "posts", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "scheduledFor", "order": "ASCENDING" } ] },

    { "collectionGroup": "emailOutbox", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "nextAttemptAt", "order": "ASCENDING" } ] },
    { "collectionGroup": "notifications", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "recipientUid", "order": "ASCENDING" }, { "fieldPath": "read", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "notifications", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "recipientUid", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "auditLog", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "area", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" } ] },
    { "collectionGroup": "auditLog", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "feed", "order": "ASCENDING" }, { "fieldPath": "area", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" } ] },
    { "collectionGroup": "auditLog", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "actor.uid", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" } ] },
    { "collectionGroup": "auditLog", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "targetPath", "order": "ASCENDING" }, { "fieldPath": "at", "order": "DESCENDING" } ] },
    { "collectionGroup": "dataRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },

    { "collectionGroup": "volunteerApplications", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "partnershipEnquiries", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "contactMessages", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "reportRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "recurringGifts", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "appointments", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "dataRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] }
  ],
  "fieldOverrides": [
    { "collectionGroup": "rateLimits",       "fieldPath": "expireAt", "ttl": true, "indexes": [] },
    { "collectionGroup": "donationIntents",  "fieldPath": "expireAt", "ttl": true, "indexes": [] },
    { "collectionGroup": "stripeEvents",     "fieldPath": "expireAt", "ttl": true, "indexes": [] },
    { "collectionGroup": "notifications",    "fieldPath": "expireAt", "ttl": true, "indexes": [] },
    { "collectionGroup": "invitations",      "fieldPath": "expireAt", "ttl": true, "indexes": [] },
    { "collectionGroup": "emailOutbox",      "fieldPath": "expireAt", "ttl": true, "indexes": [] },
    { "collectionGroup": "posts",            "fieldPath": "body", "indexes": [] },
    { "collectionGroup": "supportRequests",  "fieldPath": "explanation", "indexes": [] },
    { "collectionGroup": "safeguardingConcerns", "fieldPath": "narrative", "indexes": [] },
    { "collectionGroup": "notes",            "fieldPath": "body", "indexes": [] },
    { "collectionGroup": "emailOutbox",      "fieldPath": "vars", "indexes": [] }
  ]
}
```

Firestore TTL deletes documents within about 24 h of expiry, not on the second. Code that reads TTL'd documents must check `expireAt` itself.

### 7.4 Other project settings (Firebase/GCP console checklist)

- **Projects.** Two Firebase projects: `haven-prod` and `haven-staging`. Vercel *Production* env vars point to prod; *Preview* points to staging. Preview deployments never touch real data.
- **Location.** Firestore Native mode in `eur3` (multi-region EU), with the Storage bucket in `EU`. The Vercel function region is `fra1`, close to Firestore. The location cannot be changed after creation, so the owner must confirm it (§15).
- **Service account.** A dedicated `haven-server@` account with only these roles:
  - Cloud Datastore User
  - Storage Object Admin, on the bucket only
  - Firebase Authentication Admin
  - Service Account Token Creator, on itself, for signed URLs

  Do not use the default "Firebase Admin SDK" key with Editor rights.
- **GCP project membership.** At most 2 owners, both with 2-step verification. The developer gets *Viewer* on prod after handover. Sealed fields (§11.2) mean console access does not expose narratives.
- **Auth.**
  - Enable Email/Password and, optionally, Google.
  - **Disable sign-up**. This needs the Identity Platform upgrade.
  - Authorised domains: the production domain, the staging domain and `localhost`.
- **Identity Platform upgrade.** Required for TOTP MFA and for blocking sign-up. The free tier covers email and Google sign-in for Haven's staff count.
- **Deploying rules and indexes.** Use `npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage`. This needs no Java; only the emulators need Java.
- **`storage.cors.json`.** Needed only for staff signed-URL PUTs:

  ```json
  [{ "origin": ["https://haven.org.gm", "https://*.vercel.app"], "method": ["PUT"], "responseHeader": ["Content-Type", "x-goog-content-length-range"], "maxAgeSeconds": 3600 }]
  ```

  Apply it with `gcloud storage buckets update gs://BUCKET --cors-file=storage.cors.json`.

### 7.5 Why public forms write through the server only (recommended and adopted)

1. **Validation and minimisation are authoritative.**
   - The server-side zod schema strips unknown fields, caps lengths and normalises values.
   - Expressing equivalent checks in rules would be brittle, and a client could still add fields such as `status: "approved"`.
2. **Gap-free references and side effects are atomic.** The counter, the record, the timeline event, the audit entry and the outbox email all commit in one transaction. Rules cannot create the email or the alert.
3. **Field encryption needs the key on the server.** Concern narratives must be sealed before storage.
4. **Rate limiting and anti-abuse need a trusted place.** Without the server, Haven would need App Check plus Cloud Functions, and Cloud Functions require the Blaze plan.
5. **Rules stay deny-all.** That is the smallest possible attack surface: there is nothing to misconfigure, and no Firestore read path exists from the internet.
6. **Local mode behaves the same.** The same code path runs against `.data/`, so everything can be verified on localhost now.
7. **Performance.** The public bundle never ships the Firebase SDK, which protects the landing page's LCP work. The client SDK is loaded only on `/admin/login` and `/admin/welcome`.

The cost: every submission is one function invocation. That is fine for this traffic.

---

## 8. Data-access layer

### 8.1 Backend selection (`lib/server/env.ts`)

```ts
export type Backend = "firestore" | "local" | "unavailable";
export function resolveBackend(): Backend {
  const forced = process.env.HAVEN_BACKEND as "firestore" | "local" | undefined;
  const hasFirebase = Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
  const onVercel = process.env.VERCEL === "1";
  if (forced === "firestore" && !hasFirebase) throw new Error("HAVEN_BACKEND=firestore but FIREBASE_* are missing");
  if (forced === "local" && onVercel) throw new Error("Local data cannot run on Vercel (read-only filesystem)");
  if (forced) return forced;
  if (hasFirebase) return "firestore";
  return onVercel ? "unavailable" : "local";
}
```

- **`unavailable`** happens only on Vercel without credentials.
  - The public site renders from the static content defaults.
  - Forms show a warm message: "Our forms are being set up. Please email or call us." It includes `site.contact`.
  - The donate page still links to Stripe if Stripe keys exist. With no database it cannot record an intent, so Checkout is disabled there.
  - `/admin` shows a setup page.
- **Auth follows the data backend.** `firestore` uses Firebase Auth; `local` uses local auth. Mixed modes are not allowed.
- **Badge.** `/admin` shows a persistent "Local test data" badge in local mode, so staff never confuse it with the real system.

**Environment variables** (also listed in `.env.example`):

| Variable | Scope | Notes |
|---|---|---|
| `HAVEN_BACKEND` | server | optional override: `firestore` or `local` |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET` | server | the private key with `\n` escapes, replaced on load |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | client (login pages only) | the web config is not secret |
| `HAVEN_DATA_KEY`, `HAVEN_DATA_KEY_ID` | server, **sensitive** | 32-byte base64 AES key and its id (`k1`). Required in Firestore mode. Local mode auto-creates `.data/keys/data.key`. |
| `HAVEN_DATA_KEYS_OLD` | server, sensitive | JSON `{ "k0": "base64…" }` for decrypting during rotation |
| `HAVEN_HMAC_SECRET` | server, sensitive | signs tokens (uploads, delivery, verify, unsubscribe), salts IP hashes. Rotatable: outstanding links stop working. |
| `HAVEN_LOOKUP_SECRET` | server, sensitive | emailHash ids. **Never rotate** (ids depend on it). |
| `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD` | `.env.local` only | first local super admin (§9.3) |
| `LOCAL_SEED_PASSWORD` | `.env.local` only | password for the seeded per-role test accounts |
| `CRON_SECRET` | server | Bearer for `/api/cron/*` |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | server / client | optional (§10.3) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | server | optional. Absent means the pledge path (§4.3). |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | server | optional. Absent means manual Zoom links. |
| `SITE_URL` | server | absolute links in emails |
| email provider vars | server | owned by the notifications doc. Without them, local mode writes `.data/outbox/*.html` and a dev mailbox page at `/admin/dev/mailbox`. |

**Gitignore additions:** `/.data/` and `!.env.example`. The current `.env*` rule would otherwise ignore the example file.

### 8.2 The store interface

```ts
// lib/server/db/store.ts
export type Scalar = string | number | boolean | null;
export type DocData = Record<string, unknown>;
export type WithId<T> = T & { id: string };

export type Filter =
  | { field: string; op: "==" | "<" | "<=" | ">" | ">="; value: Scalar }
  | { field: string; op: "in"; value: Scalar[] }                    // ≤ 30 values
  | { field: string; op: "array-contains"; value: Scalar };
// Deliberately NOT supported: "!=", "not-in", "array-contains-any", OR queries. Keeps adapters at parity
// and every query index-backed. Use explicit `in` lists of statuses instead.

export interface ListQuery {
  where?: Filter[];
  orderBy: { field: string; dir: "asc" | "desc" };    // single order field; id is the implicit tiebreaker
  limit: number;                                       // 1–100 (UI pages use 25)
  cursor?: string | null;                              // opaque base64url of [orderValue, id]
}
export interface Page<T> { items: WithId<T>[]; nextCursor: string | null }

export type FieldOp =
  | { $op: "increment"; by: number }
  | { $op: "arrayUnion"; values: Scalar[] }
  | { $op: "arrayRemove"; values: Scalar[] }
  | { $op: "delete" };
export const F = {
  increment: (by: number): FieldOp => ({ $op: "increment", by }),
  arrayUnion: (...values: Scalar[]): FieldOp => ({ $op: "arrayUnion", values }),
  arrayRemove: (...values: Scalar[]): FieldOp => ({ $op: "arrayRemove", values }),
  delete: (): FieldOp => ({ $op: "delete" }),
};

export interface Tx {
  get<T>(path: string): Promise<WithId<T> | null>;     // all gets must precede writes (Firestore semantics)
  create<T>(path: string, data: T): void;              // fails the commit if the doc exists
  set<T>(path: string, data: T): void;
  update(path: string, patch: DocData): void;          // dotted keys ("triage.verification.status") + FieldOps
  delete(path: string): void;
}

export interface DocStore {
  readonly kind: "firestore" | "local";
  get<T>(path: string): Promise<WithId<T> | null>;
  getMany<T>(paths: string[]): Promise<Array<WithId<T> | null>>;
  create<T>(path: string, data: T): Promise<void>;
  set<T>(path: string, data: T): Promise<void>;
  update(path: string, patch: DocData, opts?: { expectedVersion?: number }): Promise<void>;  // throws ConflictError
  delete(path: string, opts?: { recursive?: boolean }): Promise<void>;   // recursive: subcollections too
  list<T>(collectionPath: string, q: ListQuery): Promise<Page<T>>;
  count(collectionPath: string, where?: Filter[]): Promise<number>;
  listIds(collectionPath: string): Promise<string[]>;  // maintenance only (retention, export)
  runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
  batch(write: (b: Omit<Tx, "get">) => void): Promise<void>;   // ≤ 500 ops
}
export class ConflictError extends Error {}   // "Someone else saved changes a moment ago. Reload to see them."
export class NotFoundError extends Error {}
```

```ts
// lib/server/db/repo.ts: typed collection wrapper used by repos/*.ts
export function createRepo<T extends object>(collection: string, schema: z.ZodType<T>) {
  return {
    path: (id: string) => `${collection}/${id}`,
    get: (id: string) => getStore().get<T>(`${collection}/${id}`).then((d) => (d && DEV ? parseOrThrow(schema, d) : d)),
    list: (q: ListQuery) => getStore().list<T>(collection, q),
    count: (where?: Filter[]) => getStore().count(collection, where),
    sub: (id: string, sub: string) => `${collection}/${id}/${sub}`,
  };
}
// repos/supportRequests.ts exports: repo, OPEN_STATUSES, buildSearchTokens(rec), anonymise(rec) (§11.5)
```

### 8.3 FirestoreAdapter (`lib/server/db/firestore.ts`)

- **Initialisation.**
  - `initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket })`, guarded by `getApps()` and memoised on `globalThis.__havenFirestore`. The guard matters because dev HMR reloads modules.
  - `initializeFirestore(app, { preferRest: true, ignoreUndefinedProperties: true })`. REST cuts cold-start time on Vercel, and the gRPC channel is not needed.
- **Conversion** (`convert.ts`): `toFirestore()` converts values under `*At` keys to `Timestamp`. `FieldOp`s map to `FieldValue.increment/arrayUnion/arrayRemove/delete`. `fromFirestore()` converts back to millis.
- **`list`:** `query.where(...).orderBy(field, dir).orderBy(FieldPath.documentId(), dir).limit(n + 1)`, with `startAfter(value, id)` decoded from the cursor. Fetching `n + 1` tells whether there is a next page.
- **`count`:** `query.count().get()` → `data().count`.
- **`delete` with `recursive`:** `firestore.recursiveDelete(ref)`.
- **`update` with `expectedVersion`:** runs a transaction that compares `version` and throws `ConflictError`.
- **Runtime:** route handlers that use it run on the Node runtime, which is the default. Never set `runtime = "edge"` on anything that imports the DAL. Proxy cannot import it either: keep `proxy.ts` to cookie presence only.

### 8.4 LocalJsonAdapter (`lib/server/db/local-json.ts`)

**Layout.** `.data/` mirrors Firestore paths and is gitignored:

```
.data/
  db/supportRequests/_docs.json                       { "HVN-SR-2026-0001": { …doc }, … }
  db/supportRequests/HVN-SR-2026-0001/notes/_docs.json
  db/counters/_docs.json
  storage/public/… storage/private/… storage/quarantine/…
  auth/accounts.json  auth/sessions.json
  keys/data.key                                       auto-generated 32 bytes (dev only)
  outbox/<dedupeKey>.html                             rendered emails for the dev mailbox
  locks/
```

**Atomic writes** (`local-fs.ts`):
1. Write `file.<pid>.<rand>.tmp` in the same directory.
2. `fh.sync()`, then close.
3. `fs.rename(tmp, file)`.
4. **On Windows, retry the rename** on `EPERM`, `EBUSY` and `EACCES`: up to 10 tries with a 15–150 ms backoff. Antivirus and indexers briefly lock files.
5. On final failure, delete the tmp file and throw.

**Concurrency.**
- An in-process async mutex per file, plus one global transaction mutex.
- A cross-process lock, `locks/db.lock`, created with `fs.open(path, "wx")` and holding the pid and a timestamp. It is broken if stale for more than 10 s. This makes `next dev`, `next start` and scripts safe together.
- Every `runTransaction` holds the global lock, reads fresh from disk, buffers writes and checks `create` conflicts. It then commits by writing all touched files: every tmp file first, then the renames.
- A crash between renames can leave a partial commit. That is acceptable for dev data. `npm run data:reset` reseeds.

**Reads.** Parsed files are cached in memory, keyed by `mtimeMs + size`, so reads pick up writes from other processes.

**Queries.** `list`, `count` and `array-contains` are evaluated in memory:
- filters, then a sort on `[orderField, id]`, then the cursor, then the limit
- the same comparison semantics as Firestore: `null` sorts first, and type order is null < boolean < number < string
- **Parity:** a query whose filter fields are not covered by `firestore.indexes.json` throws `MissingIndexError` in local mode too. The adapter loads the JSON at start. Production surprises are caught on localhost.

**Guards.** The constructor throws if `process.env.VERCEL === "1"`. It works under `next dev` and `next start` alike.

**Scale.** It is fine up to about 10k documents per collection, which is plenty for dev and demos.

**Storage counterpart** (`lib/server/storage/local.ts`): files go under `.data/storage/` using the same path keys as the bucket.
- `signedUrl()` returns `/api/dev/files/<path>?t=<hmac token, 60 s>`.
- Public paths are served by the same `app/m/[...path]` route.

### 8.5 DAL query catalogue

All list functions return `Page<DTO>` with 25 items and a "Load more" cursor. That suits a phone-first admin better than numbered pages.

| Need | DAL function | Store query |
|---|---|---|
| Queue by status | `listSupport({ statuses, archived=false, programmeId?, category? })` | the `archived, status, createdAt` index (or the programme / category variant) |
| My work | `listMySupport()` | `assignedTo == me && status in OPEN` by `lastActivityAt desc` |
| Find by reference | `findByReference(ref)` | direct `get(collection/ref)`, with the collection inferred from the prefix; random refs → `safeguardingConcerns` (only when concern.read) |
| Find by email or name | `searchAll(q)` | normalise, then `searchTokens array-contains token` on each collection the viewer may read (parallel, 5 per collection); results grouped by area |
| Counsellor's sessions | `listMyAppointments({ from })` | `counsellorUid == me && status == scheduled && startsAt >= from` |
| Session calendar (PO) | `listAppointments({ from, to })` | `status in [scheduled, completed, no_show] && startsAt in range` |
| Donations | `listDonations({ kind, statuses })` | the `kind, status, createdAt` index |
| Donor history | `listDonorGifts(donorId)` | `donorId == x` by `createdAt desc` |
| Follow-ups due (any area) | `listFollowUpsDue(area)` | `followUpAt <= now + 2d` ordered by `followUpAt asc` (automatic single-field index). Concerns: the DAL verifies concern.read first. |
| Auto-close candidates (cron) | `supportDueForClose()` | `status in [completed, declined]` by `statusChangedAt asc`. `more_info_required` is an equality query, filtered in memory on `moreInfo.dueAt`. |
| Outbox to send | `claimDueEmails(limit)` | `status == queued && nextAttemptAt <= now`, then a per-document lease transaction |
| Timeline | `listEvents(path)` | subcollection `events`, by `at desc` |
| Dashboard | `getDashboard()` | §6.5 |
| Activity | `listActivity()` | auditLog `feed == true && area in areasFor(viewer)` by `at desc` |
| Find a donor or subscriber by email | `findDonor(email)`, `findSubscriber(email)` | direct `get(donors/{emailHash})`, `get(newsletterSubscribers/{emailHash})` |

**Search tokens** are built on write by `buildSearchTokens(rec)`:
- the reference, and the reference without the `HVN-` prefix
- `emailLower`, and the part before the `@`
- each lowercase name word of at least 2 characters
- the last 6 digits of the phone number

At most 20 tokens. Never tokenise sealed or narrative text.

Special cases:
- Concerns: `searchTokens = [reference]` only. A concern is found by its reference with a direct `get`. For privacy requests it is found by `reporter.lookupHash` (an equality query on the automatic index).
- Every collection that `searchAll` touches has a `(searchTokens CONTAINS, createdAt DESC)` index in §7.3.
- Donors and newsletter subscribers are found by email with a direct `get` on the emailHash id.

### 8.6 Public reads and caching

**Helpers.** Public pages read content through `lib/server/public/*.ts`:
- `getContent(key)`
- `getProgramme(id)`
- `listPublishedPosts()`
- `getPost(slug)`
- `listResources()`
- `listAppeals()`
- `listTestimonials()`
- `getImpact()`

**Fallback.** Each helper returns the `published` payload, or the static `content/*.ts` default when it is null.

**Caching.**
- Each helper is wrapped in `unstable_cache` with tags. That works in Next 16 without opting in to Cache Components. If the architecture doc enables `cacheComponents`, swap it for `'use cache'` + `cacheTag` with the **same tag names**.
- Tags: `content:<key>`, `programme:<id>`, `posts`, `post:<slug>`, `resources`, `resource:<slug>`, `appeals`, `testimonials`, `stories`, `team`, `impact`, `sponsors`.

**Invalidation.**
- In admin Server Actions, call `updateTag(tag)`, so editors see their change immediately.
- In route handlers, cron and the Stripe webhook (appeal totals), call `revalidateTag(tag, "max")`. Per the Next 16 docs, the single-argument form is deprecated.

**Admin data is never cached.** It is dynamic through `cookies()`.

---

## 9. Authentication (staff only)

The public site has no accounts. Donor and beneficiary portals are Phase 2.

### 9.1 Firebase mode: sign-in, then a session cookie

1. **Sign in on the client.** `/admin/login` is a client component using the Firebase JS SDK with `inMemoryPersistence`, so nothing is left in IndexedDB.
   - Email and password: `signInWithEmailAndPassword`.
   - Google, optional: `signInWithPopup`. Popup rather than redirect, because the redirect flow breaks under Safari's storage partitioning when `authDomain` differs from the site.
   - If MFA is enrolled, the SDK raises `auth/multi-factor-auth-required`. The page then shows the 6-digit TOTP step (`getMultiFactorResolver` → `TotpMultiFactorGenerator.assertionForSignIn`).
2. **Exchange the token.** The client sends `POST /api/auth/session { idToken }`. The route handler then:
   1. `assertSameOrigin(req)`
   2. rate-limits `login` per IP hash: 10 per 15 min
   3. `verifyIdToken(idToken, true)`
   4. rejects the token if `now − auth_time > 5 min`, so only a fresh sign-in can mint a session
   5. loads `staff/{uid}` and rejects if the document is missing or `status !== "active"`. This blocks Google accounts that were never invited.
   6. MFA policy (§9.4): if the roles require MFA and `decoded.firebase.sign_in_second_factor` is absent, it responds `{ next: "enrol_mfa" }` **without** a cookie.
   7. `createSessionCookie(idToken, { expiresIn })`. `expiresIn` is **12 h** if the roles include super_admin, safeguarding_officer or finance_officer, and **7 d** otherwise. Non-technical staff on phones should not have to sign in daily unless they handle the most sensitive data.
   8. `(await cookies()).set(SESSION_COOKIE, value, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge })`. `cookies()` is async in Next 16, and cookies can only be set in Route Handlers and Server Functions.
   9. writes `lastSignInAt` and an `auth.sign_in` audit entry
   10. The client then calls `signOut()` on the SDK.
3. **Cookie name.** `__Host-haven_session` when `secure` (production over HTTPS), otherwise `haven_session` for localhost over http. `sameSite: "lax"` rather than `strict`, so that links in alert emails open the admin already signed in.
4. **Sign out.** A Server Action deletes the cookie. "Sign out of all devices" also calls `revokeRefreshTokens(uid)` and sets `staff.sessionsRevokedAt = now`.

### 9.2 Per-request verification (`getViewer`)

1. Read the cookie. In Firebase mode, run `verifySessionCookie(cookie, false)`, which is local signature verification with no network call.
2. Load `staff/{uid}` (cached per request with React `cache`). Reject if:
   - `status !== "active"`, or
   - `decoded.iat * 1000 < staff.sessionsRevokedAt`.

   This makes deactivation and role changes **immediate**. Roles are read from the document, never from custom claims.
3. `authTime = decoded.auth_time * 1000`; `mfa = Boolean(decoded.firebase.sign_in_second_factor)`.
4. Sensitive steps (§6.4, rule 6) call `verifySessionCookie(cookie, true)`, the revocation check, through `requireRecentAuth`.

`proxy.ts` (Next 16's replacement for middleware):
- matches `/admin/:path*`, excluding `/admin/login`, `/admin/welcome/*` and `/admin/reset/*`
- redirects to `/admin/login?next=…` when the cookie is **absent**. Login honours `next` only when it starts with `/admin/` (no open redirect).
- adds the headers `X-Robots-Tag: noindex`, `Cache-Control: private, no-store` and `Referrer-Policy: same-origin`

It does **no** verification and no data access. Per the Next docs, Proxy is only an optimistic check.

### 9.3 Local fallback auth (dev and `next start` on localhost)

- **Accounts.** `.data/auth/accounts.json` holds entries of the form `{ uid: "loc_<id>", email, emailLower, passwordHash, createdAt, failedCount, lockedUntil }`. Profiles and roles live in `.data/db/staff/_docs.json`, the same as in Firestore.
- **Hashing.**
  - `passwordHash = "scrypt$16384$8$1$<salt b64>$<key b64>"`: node `crypto.scrypt` with N=16384, r=8, p=1, a 16-byte salt and a 64-byte key.
  - Verified with `timingSafeEqual`.
  - When an email is unknown, hash a dummy anyway, so response timing does not reveal which emails exist.
- **Lockout.** 5 failed attempts in 15 min lock the account for 15 min, in addition to the per-IP rate limit.
- **Sessions.**
  - The cookie value is `loc.<32 random bytes base64url>`.
  - `.data/auth/sessions.json` stores the `sha256` of the token with `{ uid, createdAt, expiresAt, authTime }`.
  - Lifetimes are the same as Firebase mode. Expired entries are pruned on write.
- **Seeding the first admin.** On the first local sign-in attempt, if `accounts.json` has no super admin and `LOCAL_ADMIN_EMAIL` and `LOCAL_ADMIN_PASSWORD` are set in `.env.local`, the code creates that super admin. The password is never logged or echoed.
- **Test accounts.** `POST /api/dev/seed`, run through `node scripts/dev/seed.mjs`, creates one account per role, `<role>@haven.test` (e.g. `safeguarding_officer@haven.test`), with `LOCAL_SEED_PASSWORD`. It also creates sample records flagged `isSample: true` and imports the content defaults as published content. Credentials stay in `.env.local` and are never printed.
- **MFA.** Not enforced in local mode. The admin badge reads "Local test sign-in: two-step verification is skipped".
- **Production guard.** Local auth is impossible on Vercel because the backend resolves to `unavailable`.

### 9.4 MFA policy

- **Mechanism.** TOTP authenticator-app MFA through Identity Platform. SMS is not used: it costs money and is weak against SIM swaps.
- **Who must enrol.**
  - **Mandatory:** super_admin, safeguarding_officer, finance_officer. `staff.mfa.required` is derived from the roles.
  - **Strongly encouraged:** everyone else. A warm dashboard card reads "Protect your account in 2 minutes", and the authenticator setup has picture steps.
  - **Enforcement:** session creation refuses a required-MFA user without a second factor and routes them to enrolment. Enrolment happens on the client, right after sign-in:
    1. `multiFactor(user).getSession()`
    2. `TotpMultiFactorGenerator.generateSecret`
    3. show the QR code
    4. verify the code
    5. `enroll`
    6. re-authenticate
    7. exchange the token for a session
- **Recovery.** A super admin can reset someone's MFA with `auth.updateUser(uid, { multiFactor: { enrolledFactors: null } })`. This needs step-up and a reason, is audited, and emails the affected user. At least **two** super admins are recommended, so one can recover the other.
- **Google sign-in** does not bypass MFA. Identity Platform applies the second factor after any first factor.

### 9.5 Invitation flow (no self sign-up)

1. **Invite.** A super admin opens Team → "Invite someone" and enters a name, email and roles (with viewer scopes if applicable). This writes `invitations/{sha256(token)}` with `expiresAt +72 h` and queues a *staff_invite* email whose link is `/admin/welcome/{token}`. The token is 32 random bytes, base64url.
2. **Welcome page.** It validates the token hash, the expiry and that the invitation is not revoked or accepted. The invitee chooses a password or "Continue with Google". With Google, the Google email must equal the invited email.
3. **Account creation.** One server action does all of this:
   - Firebase mode: `auth.createUser({ email, password, displayName, emailVerified: true })`, or the Google uid is linked.
   - Local mode: an account with a scrypt hash.
   - `staff/{uid}` is created, `acceptedAt` is set, and `staff.invite_accepted` is audited.
4. **MFA.** If the roles require it, the user goes straight to MFA enrolment, then to the dashboard with a first-run tour.
5. **Password reset.**
   - The "Forgot password" Server Action always answers "If that email belongs to a Haven team member, we've sent a link." It is rate-limited.
   - Firebase mode: `generatePasswordResetLink`, sent through the outbox.
   - Local mode: a token in `.data` (1 h) leading to `/admin/reset/{token}`.
6. **Deactivation.** Status becomes `deactivated`. Firebase mode also runs `updateUser(uid, { disabled: true })` and `revokeRefreshTokens`. `sessionsRevokedAt` is set to now. The UI then prompts the admin to reassign the person's open cases.
7. **Last super admin.** The UI and DAL refuse to remove the role from, or deactivate, the last active super admin.

**Password policy:** at least 12 characters and at most 128. Reject passwords that contain the email's local part, "haven", or one of a 200-entry common-password denylist (`lib/server/auth/password.ts`). In Firebase mode, also set the same minimum in the Identity Platform password policy.

---

## 10. Abuse protection and validation for public forms

### 10.1 Pipeline

Each public form is a Server Action in `app/(site)/…/actions.ts`, delegating to `lib/server/intake/<form>.ts`:

```ts
export async function submitSupport(prev: FormState, fd: FormData): Promise<FormState> {
  const ip = clientIp(await headers());                 // x-vercel-forwarded-for → x-forwarded-for[0] → "local"
  const ipHash = hmac(`${ip}|${utcDate()}`);            // daily-rotating; never stored on records
  if (isHoneypotHit(fd) || isTooFast(fd, 2500)) return fakeSuccess();   // §10.2 (concern form excepted)
  const rl = await rateLimit("support", ipHash);        // §10.4
  if (!rl.ok) return { ok: false, formError: "rate_limited" };
  if (turnstileEnabled() && !(await verifyTurnstile(fd.get("cf-turnstile-response"), ip))) return { ok: false, formError: "challenge" };
  const parsed = supportInput.safeParse(Object.fromEntries(fd));   // lib/schemas/forms/support.ts
  if (!parsed.success) return { ok: false, fieldErrors: flatten(parsed.error) };
  const ref = await intake.support.create(parsed.data, { uploadTokens: fd.getAll("upload") });
  after(() => drainOutbox());
  return { ok: true, reference: ref };
}
```

`after()` runs on the platform's max duration. Unsent mail is also picked up by the cron tick (§10.7).

### 10.2 Honeypot and time trap

- **Honeypot.** A text input named `company_website`. It is visually hidden (an off-screen class, not `display:none`), and carries `tabIndex={-1}`, `autoComplete="off"` and `aria-hidden="true"`. Any value means a bot.
- **Time trap.** The client measures the time from first render to submit and sends it as `_elapsed` (ms). Under 2.5 s means a bot. This deliberately avoids server-issued timestamps, because form pages stay **static** (prerendered) for performance. It is cheap friction, not security. Turnstile is the real gate when it is enabled.
- **Bot outcome.** For every form **except the concern form**, a hit returns a success-looking response with no reference and stores nothing.
- **Concern form exception.** A hit is never discarded. It is stored with `suspectedSpam: true`, but no alert email is sent; it appears in a separate "Possible spam" tab for the SO. A lost genuine concern costs far more than a spam entry.

### 10.3 Turnstile (optional)

- Active only when both `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set.
- Use the invisible or managed widget.
- Verify server-side with `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`, sending the secret, the response and `remoteip`, with a 3 s timeout.
- **Fail open on timeout** for the concern and support forms (log it); fail closed for the others.
- The widget's script loads only on form pages, never on the landing page.

### 10.4 Rate limits (per IP hash, fixed window)

| Form | Limit | When exceeded |
|---|---|---|
| Support request / counselling | 5 per hour, 20 per day | Friendly "Please try again later" with phone and email |
| **Concern** | 10 per hour | Never a bare error: show the emergency notice (`site.emergencyNotice`) plus the phone number, and still accept if the honeypot is clean and the payload is valid (store with `suspectedSpam`) |
| Donation (checkout or pledge) | 10 per hour | |
| Volunteer, partnership, contact | 5 per hour each | |
| Report request | 10 per hour | |
| Newsletter | 5 per hour; and 3 confirmation emails per address per day | |
| Data request | 3 per day | |
| Upload | 20 per hour | |
| Staff login | 10 per 15 min per IP; local: 5 failures → 15-min account lock | |

- **Implementation** (`security/ratelimit.ts`):
  - Firestore mode runs a transaction on `rateLimits/{sha256(form|ipHash|windowStart)}`, incrementing `count` with `expireAt = windowEnd + 1 d` (TTL).
  - Local mode uses an in-memory map.
- **Edge layer:** enable Vercel Firewall rate-limit rules or Attack Challenge Mode for `POST` on form paths when the plan allows it.

### 10.5 Validation, sanitisation and PII minimisation

- **One zod schema per form**, in `lib/schemas/forms/*`. It is imported by the client form for inline errors and by the server as the authority.
  - `z.object` strips unknown keys, so stray fields are never stored.
  - Strings are trimmed and NFC-normalised, with `\p{Cc}` stripped except `\n`. Every string has a `max`.
  - Emails go through `z.email()`, lowercased into `emailLower`.
  - Phone: `^\+?[0-9 ()-]{6,24}$`, normalised by stripping spaces.
  - Country must be in the `content/world.ts` codes or `"other"`.
  - Enumerations are strict.
  - Consent checkboxes are `z.literal("on")`, which the server converts to a `ConsentStamp` with the current notice version.
- **Rendering.** User text is shown in the admin as plain text, never as HTML. Markdown is allowed only in staff-authored content, rendered server-side with raw HTML disabled.
- **Minimisation:**
  - no date of birth anywhere
  - **no child names** (the form copy says "Please don't include the child's name")
  - locality limited to "town or region"
  - phone optional when an email is given
  - no ID numbers
  - volunteers' background-check documents are handled offline
  - only the outcome of a check is recorded
  - no IP or user agent on records
  - Stripe holds the card data
  - analytics must be cookieless and never receive form values (architecture doc)

### 10.6 Uploads (support requests and legal documents; staff)

**Public uploads** (`POST /api/uploads`):
- Same-origin check, rate limit, one file per request, **≤ 4 MB** (below Vercel's 4.5 MB body limit).
- The client downscales photos first: canvas to JPEG at 2000 px and quality 0.85.
- Accepted types are PDF, JPEG, PNG and WebP, **verified by magic bytes**.
- Images are re-encoded with sharp (`rotate()` then `.jpeg({ quality: 85 })` / `.webp()`), which strips EXIF, including GPS (§15: no precise locations).
- PDFs must start with `%PDF-` and must not be encrypted.
- The file is stored at `quarantine/{uploadId}`.
- The response is `uploadToken = HMAC({ uploadId, sha256, mime, size, exp: +2 h })`.
- The form then submits the tokens (at most 5). Inside the create flow, intake verifies each token, moves the file to `private/cases/…` and writes `attachments/{id}`. Unclaimed quarantine files expire after 1 day (bucket lifecycle rule, or a local cron sweep).

**Staff uploads** (resources up to 50 MB, media):
- `POST /api/admin/uploads/sign` returns a v4 signed PUT URL valid for 15 min, with a fixed `contentType` and `extensionHeaders: { "x-goog-content-length-range": "0,52428800" }`.
- Local mode returns `/api/admin/uploads/local/{id}`.
- The browser PUTs the file, then calls `POST /api/admin/uploads/complete`, which validates the magic bytes and size, computes the sha256 and moves the file to its final content-hashed path.

**Downloads:**
- Case attachments are **streamed** by `/api/admin/attachments/[...path]` after the parent-record permission check. Headers: `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Content-Security-Policy: sandbox`. Every download is audited.
- Large controlled resources redirect to a 60-second signed URL.

**Virus scanning:**
- Phase 1 has none. Its mitigations are the strict type allow-list, image re-encoding, `attachment` disposition and the staff guidance "open PDFs in the browser viewer".
- Phase 2 option: a Cloud Run ClamAV scanner on bucket-finalize events.

### 10.7 Cron (one endpoint, idempotent)

`GET /api/cron/tick` (Bearer `CRON_SECRET`, every 15 min) does the following:
- drains the outbox (due and scheduled, including Zoom reminders)
- publishes posts whose `scheduledFor` has passed
- re-alerts concerns (§5.5)
- auto-closes support requests (§5.1) and report requests (§5.3)
- sends follow-up-due notifications

`/api/cron/retention` runs daily (§11.4). `/api/cron/editorial` runs monthly (AI drafts).

**Scheduler.** Use Vercel Cron if the plan is Pro. The Hobby plan only allows daily cron, so in that case use a GitHub Actions `schedule:` workflow that curls the endpoint with the secret. Zoom reminders and concern re-alerts **need** the 15-minute tick.

---

## 11. Privacy, retention and recovery (§15)

### 11.1 Transport and headers

- HTTPS only: Vercel provides it.
- HSTS (`max-age=63072000; includeSubDomains; preload`), set in `next.config.ts` `headers()`.
- Admin and delivery routes: `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. `/r/[token]` and `/admin/welcome/[token]` carry secrets in the path.
- The CSP is owned by the architecture doc.

### 11.2 Field encryption (`lib/server/security/seal.ts`)

- **Cipher.** AES-256-GCM with a random 12-byte IV. The AAD is the document path plus the field name, which stops ciphertext being swapped between records.
- **Output.** `Sealed { kid, iv, tag, ct }`. `seal(value, aad)` and `open(sealed, aad)` take JSON-serialisable values.
- **Which fields are sealed:**
  - concern: `reporter.identity`, `reporter.safeFollowUp`, `child.location`, `narrative`, `authorityDetails`, `risk.rationale`, `escalation.externalRef`
  - concern `actions.detail`
  - every `notes.body`
  - `supportRequest.explanation`
  - `mediaConsent.notes`
  - outbox `vars` when they include more than the reference, name and links
- **Rotation.**
  - Set a new `HAVEN_DATA_KEY`/`HAVEN_DATA_KEY_ID` and move the old key into `HAVEN_DATA_KEYS_OLD`.
  - `open()` selects the key by `kid`.
  - `scripts/ops/reseal.mjs` (an admin-only route plus a script) re-encrypts records in batches.
- **Key custody.**
  - The key lives in Vercel env as a *Sensitive* variable.
  - Keep a copy in the organisation's password manager and a sealed offline copy with the director.
  - **Losing the key makes sealed fields unrecoverable, including from backups.**

### 11.3 Logging

- Never log request bodies, form values, emails or tokens.
- `lib/server/log.ts` redacts the keys `email`, `phone`, `name`, `narrative`, `explanation`, `token`, `password` and `idToken`.
- Errors record the reference and path only.
- Stripe webhook logs record event ids only.

### 11.4 Retention periods

These are a starting policy. They need professional and legal review before launch (§15 "Professional review of policies"). The values live in `settings/retention` so they can change without a deploy.

When a record reaches a terminal state, the DAL sets `retention.retainUntil` and upserts `retentionQueue/{collection~id}`. The daily cron then:
- applies `auto_delete` or `auto_anonymise` items that are due and not on `legalHold`
- turns `review` items into tasks in the "Records to review" panel (super admin, and the SO for concerns)

Every action is audited (`retention.*`).

| Policy id | Applies to | Kept for | Then |
|---|---|---|---|
| `support.unsupported` | Support requests closed as declined, no_response, duplicate, spam or withdrawn | 2 years after closure | auto_delete (recursive, with attachments) |
| `support.supported` | Support requests that reached approved or later | 7 years after closure | review (delete or extend) |
| `appointment` | Appointments and their notes | Same as the linked support request | deleted with it |
| `concern` | Safeguarding concerns | The later of: closure + 7 years, or the child's estimated 25th birthday (from the age band) | **review only, never automatic**. The SO confirms destruction, and the record is kept if any allegation relates to staff or volunteers. |
| `donation.financial` | Received, acknowledged, allocated, completed and refunded donations; receipts | 7 years after the end of the financial year of receipt | auto_anonymise: donor PII removed; amounts, dates and allocations kept |
| `donation.unfulfilled` | Cancelled pledges | 2 years | auto_delete |
| `donor.profile` | Donor profiles | 2 years after the last gift, unless there is an active recurring gift or a live updates consent | auto_anonymise |
| `volunteer.declined` | Declined applications | 1 year after the decision | auto_delete |
| `volunteer.former` | Inactive volunteers | 6 years after becoming inactive (safeguarding: who worked with children) | review |
| `partnership` | Partnership enquiries | 3 years after closure | auto_delete |
| `contact` | Contact messages | 2 years after closure | auto_delete |
| `report_request` | Report requests | 2 years after closure | auto_delete |
| `newsletter.unconfirmed` | Unconfirmed subscribers | 30 days | auto_delete |
| `newsletter.unsubscribed` | Unsubscribed subscribers | PII purged after 30 days | Only the id hash is kept, as a suppression record |
| `data_request` | Data requests | 3 years after completion (proof of compliance) | auto_delete |
| `audit` | Audit log | 7 years | auto_delete in batches |
| `outbox` | Email outbox | Body (`vars`) 90 days; metadata 1 year | TTL |
| `ephemeral` | rateLimits | 1 day | TTL |
| | donationIntents | 2 days | TTL |
| | stripeEvents | 90 days | TTL |
| | notifications | 90 days | TTL |
| | invitations | 30 days | TTL |
| | quarantine uploads | 1 day | TTL |
| `media.consent` | Consent records | While any published media references them, plus 6 years after withdrawal or expiry | review. On withdrawal, the content using the media is unpublished **immediately** and the media flagged. |

**Deletion mechanics:**
- Deleting a record runs `store.delete(path, { recursive: true })`, then `blobs.deletePrefix(private/cases/{collection}/{id}/)`, then an audit entry.
- The audit log keeps only the reference and the policy, never the content.

### 11.5 Correction and deletion requests (§15 "process to correct or delete information")

1. **Request form.** `/privacy/request` asks for a name, email, request type, details and any references (`dataRequests`, DR reference). An email verification link (`data_request_verify`, 7 d) confirms that the requester controls the address. A request still unverified after 14 d is deleted.
2. **Find records.** A super admin opens the request (step-up auth) and clicks "Find records". `dal/privacy.findPersonalData(emailLower)` searches:
   - `searchTokens array-contains emailLower` across supportRequests, donations, donors, recurringGifts, volunteerApplications, partnershipEnquiries, contactMessages, reportRequests, newsletterSubscribers and dataRequests
   - appointments by `clientSnapshot.contactEmail`
   - concerns by `reporter.lookupHash`. This search runs only for a super admin, and a hit is shown as "1 safeguarding record (handled by the Safeguarding Officer)".
3. **Choose an action per record.**
   - **Correct:** edit the field. The audit entry records the field name, with values redacted.
   - **Delete:** recursive delete.
   - **Anonymise:** `repo.anonymise(rec)` replaces PII with "Removed on request" and nulls emails and phones, keeping amounts, dates and status for statistics.
   - **Restrict:** for legal-retention cases (financial records within 7 years, safeguarding records), set `legalHold` with the reason recorded and stop all contact.
4. **Close.** The super admin completes the request and *data_request_done* is sent. The deadline is 30 days (`dueAt`), shown as a countdown on the request.
5. **Backups.** Deleted data persists in backups until they rotate (up to 98 days, §11.6). The privacy policy must say "removed from backups within 100 days".

### 11.6 Backups and recovery

**Firestore:**
- **Point-in-time recovery** on (7 days).
- **Scheduled backups:**
  - daily, kept 7 days: `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d`
  - weekly, kept 14 weeks (98 d)
- **Restore drill:** each quarter, restore into a scratch database with `gcloud firestore databases restore`, then open a few records through a staging deployment pointed at it. The drill is written down in `docs/platform/runbook.md` (operations doc).

**Storage:**
- Soft delete at 30 days.
- Lifecycle: `quarantine/` deleted after 1 day.
- Files are never overwritten, because paths are content-hashed, so versioning is unnecessary.

**Auth:** staff can always be re-invited, because `staff/*` is in Firestore. No auth export is needed. The local password hashes in `.data` are dev-only.

**Keys:** `HAVEN_DATA_KEY` escrow (§11.2) is part of the backup plan. A backup without its key is useless for sealed fields.

**Local mode:** `.data/` is disposable dev data. `npm run data:reset` wipes and reseeds it, and nothing in it is real.

---

## 12. Exports (CSV)

**Route.** `GET /admin/export/[dataset]?status=…&from=YYYY-MM-DD&to=YYYY-MM-DD&contact=1`.
- The query string carries **filters only, never personal data**.
- The route requires the dataset permission and `requireRecentAuth`.
- It streams a `ReadableStream`, reading pages of 500 records, up to 20,000 rows. Beyond that it asks the user to narrow the date range.
- Every run writes an `export.run` audit entry recording the dataset, filters, row count and whether contact details were included.
- `isSample` records are excluded.

**Format:**
- UTF-8 with a BOM, so Excel on Windows opens accents correctly.
- CRLF line endings and RFC 4180 quoting.
- Header row in plain English.
- Dates as `YYYY-MM-DD HH:mm` in Africa/Banjul, plus raw ISO columns only where the dataset says so.
- Money as decimal major units with a separate `Currency` column. Currencies are never summed.
- **Formula-injection guard:** a cell starting with `= + - @ \t \r` is prefixed with `'`.
- Headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="haven-<dataset>-<yyyy-mm-dd>.csv"`, `Cache-Control: no-store`.

**Never exported:**
- safeguarding concerns: no CSV at all. The SO has an audited single-case "Print summary" page, watermarked with the viewer's name and the time.
- sealed fields and narratives
- notes
- attachments
- staff secrets
- Zoom links

| Dataset | Permission | Columns (★ = only with `contact=1` and the contact permission) |
|---|---|---|
| `donations` | donation.export (FO, SA); Viewer `donations_detail` without ★ | Reference, Created, Received, Kind, Status, Donor name, Donor type, Organisation, ★Email, ★Phone, Country, Amount, Currency, Frequency, Method, Preferred programme/appeal, Allocation summary ("Education 60%; General 40%"), Receipt no., Acknowledged on, Stripe payment id, Stripe fee, Net, Recognition, Updates consent, ★Comments |
| `donation-allocations` | donation.export | Donation reference, Received, Target type, Target name, Amount, Currency, Allocated on, Allocated by |
| `in-kind` | donation.export | Reference, Offered, Status, Donor name, ★Email, ★Phone, Categories, Description, Quantity, Estimated value, Currency, Delivery, Available from, Received on, Received items |
| `recurring-gifts` | donation.export | Reference, Donor name, ★Email, Amount, Currency, Frequency, Target, Provider, Status, Started, Next charge, Gifts made, Last payment |
| `support-requests` | support.export (PO, SA); Viewer `support_summary` without ★ | Reference, Submitted, Category, Programme, Urgency, Status, Country, Assigned officer, Days open, Closed on, Closure reason, Outcome summary, ★Applicant name, ★Relationship, ★Email, ★Phone, ★Preferred contact |
| `appointments` | appointment.manage | Reference, Case reference, Counsellor, Date, Duration, Mode, Status, Attendance, Session no. |
| `volunteers` | volunteer.export (§12 "export contacts") | Reference, Submitted, Status, Name, ★Email, ★Phone, Country, Interests, Skills, Languages, Hours/week, Mode, Assigned to, Follow-up date |
| `partners` | partnership.export | Reference, Submitted, Status, Organisation, Org type, Country, Partnership type, Contact name, ★Email, ★Phone, Website |
| `report-requests` | reportRequest.export | Reference, Submitted, Resource, Status, Name, Organisation, ★Email, Country, Reason, Decided on, Sent on, Downloads |
| `newsletter` | newsletter.export | Email, First name, Confirmed on, Source, Interests (confirmed subscribers only; export is the only way to reach them in a mail tool) |
| `audit-log` | audit.export (SA, Viewer `audit`) | Time, Actor, Roles, Action, Area, Reference, Summary. Area `safeguarding` is included only for SA. |

---

## 13. Verifying on localhost (what "done" means for this layer)

These scripts follow the existing `scripts/qa/*.mjs` convention. They run against `npm run dev` (usually port 3001) or `next start`:
- `node scripts/dev/seed.mjs`: seeds roles, sample records and content (§9.3).
- `node scripts/qa/data-selftest.mjs`: calls `/api/dev/selftest`, which runs the `DocStore` contract suite against the active adapter:
  - create conflict
  - transaction atomicity
  - gap-free references under 20 concurrent creates
  - cursor pagination
  - `in` and `array-contains`
  - `count`
  - `MissingIndexError`
  - recursive delete
  - `*At` round-trip
- `node scripts/qa/rbac.mjs`: signs in as every seeded role and asserts the matrix in §6.2. For example:
  - a counsellor gets 404 on `/admin/support` and on another counsellor's appointment
  - only the SO and SA reach `/admin/safeguarding`
  - the viewer's donation DTO has no emails
- `node scripts/qa/forms.mjs`: submits every public form with valid input, honeypot input and over-limit input. It then asserts:
  - references were created
  - the outbox has the right templates
  - subjects contain no case details
  - a concern submitted through the support form landed in `safeguardingConcerns`

---

## 14. Build order

1. `lib/model`, `lib/schemas`, `env.ts`, `store.ts`, `local-json.ts`, `convert.ts`, `references.ts`, then the selftest.
2. `seal.ts`, `hmac.ts`, `ratelimit.ts`, `spam.ts`, `audit.ts`, `outbox.ts` (local mailbox).
3. Local auth, `session.ts`, `permissions.ts`, `proxy.ts`, seed, then the rbac script.
4. Intake for all public forms, then the forms script. Uploads.
5. The DAL per area, with workflow machines, dashboard and search.
6. Exports and retention cron.
7. `firestore.ts`, `gcs.ts`, Firebase auth and MFA, then the rules and index files. Run against `haven-staging` once credentials arrive. The selftest must pass on both adapters.

---

## 15. Open questions for the owner and risks

**Questions:**
1. Firestore and Storage location: `eur3`/`EU` (recommended, GDPR-grade) or `nam5`/US. It cannot be changed later.
2. Confirm the retention periods in §11.4 with a safeguarding and legal professional, especially concerns (25th birthday or 7 years) and finance (7 years). What is the financial year?
3. Who are the named Safeguarding Officers who receive concern alerts, and is there a fallback distribution address?
4. Does Stripe support GMD for Haven's account? If not, GMD gifts use the pledge path.
5. Vercel plan: Pro, for 15-minute cron and the firewall, or Hobby plus a GitHub Actions scheduler?
6. Should Google sign-in be enabled, and on which Workspace domain?

**Risks:**
- Losing `HAVEN_DATA_KEY` destroys sealed narratives permanently.
- `HAVEN_LOOKUP_SECRET` must never rotate.
- Firestore TTL is lazy, up to about 24 h.
- `x-goog-content-length-range` on signed PUTs must be tested against the real bucket.
- Local adapter commits are not crash-atomic across several files. That is acceptable for dev only.
- Super admins can read concerns by design. That access is audited, not prevented.
