# Haven platform: the binding build plan

**Status:** binding. **Date:** 2026-10-10. **Owner:** lead architect.

**This file overrides the seven design docs** in `docs/platform/` (`next16-notes.md`, `design-system.md`, `content-model.md`, `data-model.md`, `admin-ux.md`, `public-pages.md`, `integrations.md`) **wherever they disagree.** When this file is silent, the owning doc (§1.2) decides. When the owning doc is silent, ask the lead; do not invent a third answer.

---

## 1. Purpose and how to use this file

### 1.1 What this is

Seven specialists wrote seven long design docs in parallel. They disagree on about a hundred points: file paths, names, enums, routes, statuses, storage shapes. This file:

1. settles every disagreement in one line each (§2, the Decisions register);
2. says what is in scope now and what is deferred (§3);
3. fixes the final architecture (§4);
4. specifies the foundation, Phase F, down to files and exported signatures (§5);
5. splits the remaining work into phases of parallel work packages with **disjoint file ownership** (§6);
6. lists the rules every builder follows (§7) and the questions only the owner can answer (§8).

Requirements come from `docs/CLIENT-SPEC.md` (the **owner's direction at its bottom overrides the spec**) and `HANDOFF.md` (people-mix and imagery rules, open client items).

### 1.2 Order of reading for a builder

1. **This file, §7 (Global rules)**, completely.
2. **Your work package** in §5 or §6: owned files, what to build, acceptance criteria, verification.
3. **The decisions in §2** that touch your area (search for your topic).
4. **The owning doc sections** your package cites. Read them in full before coding.
5. For any Next.js API: `node_modules/next/dist/docs/` (Next 16.3.6). If your memory disagrees with the bundled docs, the docs win.

**Precedence:** PLAN.md › owning doc › other docs › your memory.

**Which doc owns what** (after PLAN.md):

| Area | Owning doc |
|---|---|
| Next.js patterns, config, proxy, caching mechanics, error files | `next16-notes.md` |
| Storage (DocStore/BlobStore), operational collections, auth, roles and permissions, statuses and transitions, references, security, uploads, retention, exports | `data-model.md` |
| Content schema, seeds, content read path and write pipeline, media model, post model and body format, studio data contract | `content-model.md` |
| Tokens, UI primitives (`components/ui/**`), visual language (public and admin), accessibility rules | `design-system.md` |
| Public routes, URLs, slugs, page UX and copy, donate UX, SEO | `public-pages.md` |
| Admin IA, admin URLs, screens, UX, admin microcopy, per-role navigation | `admin-ux.md` |
| Env vars, Stripe, email, AI, Zoom, cron, analytics, Turnstile | `integrations.md` |

**Phantom docs.** Several docs cite sibling docs that do not exist. Read them as: "IA doc" = `public-pages.md`; "auth doc" / "backend doc" = `data-model.md`; "payments doc" / "notifications doc" / "automation doc" / "email doc" = `integrations.md`; "architecture doc" = `next16-notes.md` + this file; "resources doc" = `data-model.md` §4.5 + `public-pages.md` §3.9–3.11.

### 1.3 Phases at a glance

| Phase | What | Packages | Runs |
|---|---|---|---|
| **F** | Foundation: contracts, data engine, content, UI kit, shells, practice mode | F1–F5 | Wave 1: F1. Wave 2: F2, F3, F4 in parallel. Wave 3: F5 |
| **P** | Public site: every page, donate, forms, hubs, SEO | P1–P8 | Parallel |
| **A** | Admin: every place and screen | A1–A9 | Parallel. P and A file sets are disjoint, so the lead may run P and A as one wave |
| **I** | Integrations: Stripe, email transport, AI, Zoom, cron, analytics, Turnstile, Firebase go-live kit | I1–I8 | Parallel, after P3, A4, A5 and A8 |
| **Q** | Quality: a11y, performance, security, QA automation, docs | Q1–Q6 | Parallel, last |

Each phase ends with a **lead gate** (build, QA scripts, screenshots). Builders never run `next build`.

---

## 2. Decisions register

One line each: **Topic:** decision (what it overrides). "§" refers to the named doc's sections. Every builder must follow these, even where the doc they are reading says otherwise.

### 2.1 App structure and Next.js

- **D1. Root layouts:** exactly one root, `app/layout.tsx`. The admin's `app/admin/layout.tsx` is a non-root layout (noindex metadata, no Lenis, no GSAP). Fonts stay in the root; no `lib/fonts.ts` (overrides admin-ux §0.2, §4.3, §15).
- **D2. Admin route group:** `app/admin/(desk)/…` holds every signed-in screen, at admin-ux §4.2's URLs. Auth pages sit outside `(desk)`. `(desk)/loading.tsx` is mandatory (overrides admin-ux §4.3 `app/(admin)/admin/(shell)`).
- **D3. Session reads in layouts:** no layout awaits the session at top level. `(desk)/layout.tsx` renders the shell inside `<Suspense>` through a small async child. Split-view layouts (Inbox, Requests, Safeguarding, Counselling, report requests) fetch their list in a Suspense child. Every page, Server Action and Route Handler calls `requireStaff` itself (overrides admin-ux §3.8, §4.3 code samples).
- **D4. Path hooks:** `usePathname`, `useParams`, `useSearchParams` and `useSelectedLayoutSegment` are read only in tiny client leaves wrapped in `<Suspense>`: `ActiveNavMarker`, `MobileMenuCloser`, `RouteScrollReset`, the donate widget's param reader (fallback = widget skeleton), `StudioBridge`, `SheetHost`, `SplitView`. SmoothScroll gets no pathname effect (overrides design-system §4.1–4.2, public-pages §4.3, §5.2–5.3).
- **D5. Segment config:** `dynamicParams`, `dynamic`, `revalidate`, `fetchCache` and `runtime` exports are forbidden everywhere. Unknown slugs call `notFound()`. Programme pages call `notFound()` for any slug outside the six (overrides public-pages §1.1, §3.4, §4.1; integrations §3.6 `runtime`).
- **D6. generateStaticParams:** must return at least one entry. Every dynamic collection route has at least one seed. Resources get a seeded placeholder ("Annual report 2025", request-only) (overrides content-model §8.1, data-model §4.5 seeds).
- **D7. Lenis:** `SmoothScroll` lives only in `app/(site)/layout.tsx` (overrides content-model §4.7–4.8).
- **D8. Not-found pages:** `app/not-found.tsx` (unmatched URLs) renders `SiteChrome` + `NotFoundBody` itself. `app/(site)/not-found.tsx` renders `NotFoundBody` inside the site layout. Copy per public-pages §3.23 (overrides next16 §3 bare header, design-system §4.1 copy).
- **D9. Landmarks:** `SkipLink` is the first focusable element in the site and admin layouts. `SiteChrome` owns the site's single `<main id="main" tabIndex={-1}>`; `AdminShell` owns the admin's. Pages, including the landing, never render `<main>` (overrides public-pages §1.5, content-model §4.7, design-system §3.1).
- **D10. Error files:** `app/global-error.tsx`, `app/(site)/error.tsx` and `app/admin/(desk)/error.tsx`, all `'use client'`, props `{ error, retry }`. No root `app/error.tsx` (overrides design-system §4.1/App B, public-pages §3.23 `reset()`).
- **D11. Donate routes:** `(site)/donate/(give)/{layout,page,[cause]/page,[cause]/opengraph-image}`; `donate/thank-you`, `donate/manage` (+`choose`) and `donate/receipt/[ref]` outside `(give)`. Reserved cause slugs: `thank-you`, `general`, `in-kind`, `api`, `manage`, `receipt` (overrides next16 §3).
- **D12. Offline:** `experimental.useOffline` stays off; `lib/admin/net.ts` uses `navigator.onLine` plus failed-fetch detection (admin-ux §3.7).
- **D13. unstable_cache:** never used. data-model §8.6's helpers are replaced by `'use cache'` readers (overrides data-model §8.6).
- **D14. cacheLife:** every public reader uses the custom profile `content` (`stale 300, revalidate 86400, expire 31536000`) declared in `next.config.ts` (overrides next16 §0.5, §7.2 `'max'`).
- **D15. Year and years of service:** computed inside `getSiteSettings()` (`'use cache'`, `cacheLife('content')`) and passed as props to Footer and Founder. No `CurrentYear.tsx` (overrides next16 §2.2).
- **D16. Invalidation calls:** Server Actions call `updateTag(tag)`. Route handlers and cron call `revalidateTag(tag, 'max')`, except cron-published posts, which use `revalidateTag(tag, { expire: 0 })` (overrides content-model §7.4).

### 2.2 Module layout

- **D17. Server tree:** every server-only module lives under `lib/server/**` (`env, url, log, db, storage, auth, security, references, audit, events, notify, cron, workflow, intake, dal, public, email, payments, giving, ai, zoom, calendar, export, retention, dev`), each starting with `import 'server-only'`. Content code lives in `lib/content/**`, client-safe shared code in `lib/model/**`. next16-notes code samples are read with these paths (overrides next16 §5, §7.2, §11–13).
- **D18. Proxy-safe constants:** cookie names, public admin paths and auth timings live in `lib/model/session.ts`, which imports nothing (overrides next16 §4 and the contracts audit's `lib/auth/constants.ts`).
- **D19. Shared enums:** the single home is `lib/model/enums.ts`, client-safe, importing nothing from `content/*`. `content/home.ts`'s `Currency` becomes a re-export until the legacy file is deleted (overrides next16 §5, content-model §3.2/§4.8, admin-ux §5.1, data-model §4.7).
- **D20. Status sources:** `lib/model/status.ts` (unions), `lib/model/flows.ts` (edges), `lib/model/labels.ts` (labels), `lib/model/status-meta.ts` (tones and icons). There is no `lib/status.ts` and no `lib/admin/workflows.ts` (overrides design-system §3.4/App A, admin-ux §7, contracts audit).
- **D21. Public read façade:** public pages import data only from `lib/content/public.ts`. It wraps `lib/content/read.ts` and re-exports the cached system readers in `lib/server/public/*` (payment settings, cause totals, resources, sponsor profiles) and `searchSite`. No `lib/data/public.ts`, no `lib/content/home.ts` getter (overrides public-pages §2.5, next16 §7.2, data-model §8.6).
- **D22. Actions and schemas:** Server Actions are thin `actions.ts` files beside their route segment; the logic lives in `lib/server/{intake,dal,giving}`. The single cross-screen exception is `lib/content/actions.ts`. Public form schemas: `lib/schemas/forms/<form>.ts`. Admin inputs: `lib/schemas/admin/<area>.ts`. Content: `lib/content/schema.ts`. Action names follow public-pages (`submitSupportRequest`, …). No `app/(site)/_actions/`, no `lib/admin/actions/` (overrides public-pages §2.4, admin-ux §4.3, next16 §6).
- **D23. Media helpers:** `lib/media/pipeline.ts` (relative imports only) and `lib/media/index.ts`. No `lib/media.ts`, because it would make `@/lib/media` ambiguous (overrides design-system §2.13/App B).
- **D24. Navigation:** code in `lib/nav.ts`. Items and routes follow public-pages §5.1 (`short`, `homeAnchor`). Programme children are derived from the programmes collection. `match` is a `string[]` of path prefixes, because functions cannot cross from `getSiteChrome()` to the client Header (overrides design-system §4.2, public-pages §5.1, `content/nav.ts`).
- **D25. Routes module:** `lib/routes.ts` exports the `routes.*` builders, `routeHref(RouteKey)`, the `once`↔`one_time` URL mapping and the programme slug map. Stored CTAs point at the **final** page URLs from day one (overrides content-model §9 step 7's interim anchors).
- **D26. Form results:** `lib/forms/types.ts` exports `FormState` (every `useActionState` form, public and admin; `fieldErrors` holds the first message as a string; `values` are echoed back) and `ActionResult` (admin content and transition mutations; error kinds `validation | conflict | forbidden | blocked | unavailable | not_allowed`). next16's `ActionState`, public-pages' `lib/forms/state.ts` and data-model's `{ ok, … }` are dropped (overrides next16 §6.1, public-pages §2.4, data-model §6.4 rule 5, contracts audit file name).
- **D27. UI component import rule:** `components/ui/**` (incl. cards and form) never import `lib/content/**` or `lib/server/**`. They take plain props (`UiImage`, strings, numbers) from `lib/model/ui.ts`. Server parents map view-models to props (fills a gap; overrides contracts audit `ArticleCard({ card: PostCard })`).

### 2.3 Storage and data

- **D28. One engine:** one `DocStore` and one `BlobStore`. `ContentStore` is a thin adapter over `DocStore`. Local data lives only in `.data/{db,storage,auth,keys,mailbox,locks}`. No `.data/content/*`, `.data/uploads`, `.data/audit/*.jsonl`, `.data/causes.json` or `.data/outbox*` (overrides content-model §4.2, public-pages §2.4/§4.2/§4.8, next16 §7.2).
- **D29. Document ids:** `^(?!\.)(?!.*\.\.)[A-Za-z0-9_~.-]{1,128}$`. Dots allow content ids (`home.hero`), `~` allows retention ids (`collection~id`), a leading `-` or `_` allows base64url hashes. `/` and `..` are never allowed (overrides data-model §2, contracts audit regex).
- **D30. Time:** every persisted field ending in `At` is epoch-ms `Millis`, in operational records **and** content payloads and envelopes. ISO strings appear only in DTOs and view-models. Date-only fields that do not end in `At` stay `YYYY-MM-DD` (overrides content-model §3.2–3.3, §7.1).
- **D31. Content envelope:** content-model's `StoredRecord` plus a `versions` subcollection (keep 20). `editLock` is dropped; the optimistic `version` is the only concurrency control (overrides data-model §4.6 `ContentEnvelope`, `revisions`).
- **D32. Content storage names:** singletons in `siteContent/{docId}` with content-model's dotted ids (`siteContent/home.hero`). Collections in top-level collections with content-model names. data-model §4.6's content types (`ContentEnvelope`, `ProgrammePage`, `Testimonial`, `Story`, `TeamMember`, `Appeal`, `AppealContent`, `ImpactStat`, `EditorialPlan`, its `Post`, its `MediaAsset`) are superseded. data-model keeps the operational collections (overrides data-model §4.0/§4.6, content-model §4.2 `content/{docId}`, next16 §7.2, admin-ux §6.10 slot ids).
- **D33. Backend naming:** `Backend = 'firestore' | 'local' | 'unavailable'` everywhere. `Viewer.backend` is `'firestore' | 'local'`. ContentStore and media storage report the same union. `practiceMode = backend === 'local'`. No `features.firebase` or `features.localWrites` (overrides next16 §11, content-model §4.2/§6.3, admin-ux §3.7, data-model §8.1 internal inconsistency).
- **D34. Firebase server credentials:** `FIREBASE_SERVICE_ACCOUNT_JSON` (one line); the split `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` trio is an undocumented fallback. The bucket is `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`. The variable is **not** in `.env.local` yet, so **local mode is the active mode today** (overrides data-model §8.1, content-model §4.2/§6.3; corrects integrations §1).
- **D35. Firebase project:** `orphanage-project-511119` is production. Until a staging project exists, Vercel Preview gets no Firebase server credentials and resolves to `unavailable` (overrides data-model §7.4).
- **D36. System totals:** per-cause, per-currency totals live in system docs `causeTotals/{slug}` (`Partial<Record<Currency, { raisedMinor, gifts }>>`), incremented inside allocation transactions. They are not stored on the content cause doc, so money writes never collide with an editor's `version` (overrides data-model §4.3 `Appeal.totals` and the conflicts audit's "on the cause doc").

### 2.4 Content model

- **D37. Causes:** one content collection, `causes`. Schema = content-model `Cause` + public-pages fields: `kind: general | programme | appeal | project | sponsorship` (seasonality = `season` + `startsAt/endsAt`), `defaultFrequency`, `allowedFrequencies`, `inKindItems`, `zakatEligible`, `allocation[].tone`. `AllocationTarget` becomes `{ type: 'cause'; causeSlug }`, `Donation.appealId` becomes `causeSlug`, and Stripe metadata uses `haven_target: 'cause:<slug>'` and `haven_cause` (overrides data-model §4.3, public-pages §4.2, integrations §3.3, contracts audit `haven_appeal`).
- **D38. Public "raised":** `offlineRaised` (admin-ux's "raised before Haven's records began") + `causeTotals[slug][cause.currency].raisedMinor` + finance-entered converted contributions (AllocationEditor). Shown only when `verification.status === 'verified'`. Never summed across currencies. The only FX table is `settings/payment.fx`, used for display hints and to prefill the finance field (overrides content-model §3.5, data-model §4.3, admin-ux §6.6, public-pages §2.5).
- **D39. Cause status:** `status: active | paused | completed` + envelope `visibility` + `startsAt/endsAt`. Admin chips are derived: Upcoming (before `startsAt`), Live (active, in window), Ended (completed or past `endsAt`), Hidden (visibility hidden). Public "closed" = completed or past `endsAt` (overrides data-model §4.3, public-pages §4.2, admin-ux §6.6).
- **D40. Programme slugs:** `child-protection`, `education`, `medical`, `counselling`, `legal`, `family-community`. Each programme has one `kind: 'programme'` cause with the same slug. `ProgrammeId` values stay `protection | education | medical | psychological | legal | family`. No `/donate?programme=` (overrides content-model §8.1).
- **D41. Programme schema:** content-model `Programme` + `fullTitle` + `resourceCategories`. Notice tone mapping: `emergency`→emergency, `eligibility`→info, `medical | legal | assessment`→disclaimer. "Who can ask" and "What we'll ask for" are two `criteria` lists inside `eligibility`. data-model's `ProgrammePage` is removed (overrides public-pages §2.5, data-model §4.6).
- **D42. Posts:** content-model `Post`: `Block[]` body, `PostCategory`, `excerpt`, `cover`, `publishAt`, five statuses (`draft | in_review | scheduled | published | archived`), six-item review checklist. Additions: `format: 'update' | 'article'`, `origin.via` and `origin.promptVersion`. "Changes requested" = back to `draft` with `review.notes`. No `idea`/`drafting` statuses, no markdown, no react-markdown, no ProseMirror storage. The editor is a block-card editor emitting `Block[]`; TipTap only if it is confined to inline marks inside one paragraph block and serialises to `InlineText` (overrides data-model §4.6/§5.6, public-pages §3.15, admin-ux §6.12, design-system App A).
- **D43. Updates on the public site:** `format: 'update'` renders as a compact `UpdateCard` in `/news` and in the home News section, has a short `/news/[slug]` page, and is included in RSS and the sitemap (fills a coverage gap).
- **D44. Long text:** every staff-authored long-text field is `Block[]`, rendered only by `components/content/Blocks.tsx`: programme overview/problem, cause story, project body, policy body, team bio, `Resource.executiveSummary`. Policy TOC is built from heading blocks (overrides public-pages §3.9/§3.13/§3.21/§4.2, data-model §4.3/§4.5, admin-ux §6.8/§6.10).
- **D45. Stats:** content-model `stats` collection with `Verification`, plus `asOf` and, for finance stats, `amounts: Partial<Record<Currency, number>>`. The ToR §3 set is: `children-supported`, `families-reached`, `school-fee-interventions`, `counselling-sessions`, `medical-cases`, `volunteers-partners`, `donations-received`, `donations-distributed`. Existing landing ids (`active-volunteers`, `community-partners`, `monthly-donors`) remain. Sections reference stats by id; the admin `stat` field edits the referenced record (overrides data-model §4.6 `ImpactStat`, public-pages §2.5/§3.12, admin-ux §6.10).
- **D46. Unverified figures:** seeded placeholder stats render with the automatic placeholder note and an "Illustrative" chip until launch. A staff edit to any stat value cannot be published unless it is verified. The super admin flips `settings.site.figures.hideUnverified` from the Before-launch checklist; after that, unverified stats never render (overrides content-model §0.11, public-pages §3.12, admin-ux §6.10, data-model §4.6).
- **D47. Who verifies:** `impact.verify` is granted to programme_officer (programme and organisation stats), finance_officer (finance stats) and super_admin. Content managers edit label and note only. "I've checked this figure" appears only for those roles (overrides data-model §6.1, admin-ux §6.10).
- **D48. Editorial plan:** content-model's `settings.editorial` + `reviewerUids` + `length`; topics carry `month`. `editorialPlans` is dropped; `aiJobs` stays (overrides data-model §4.6, admin-ux §6.12).
- **D49. FAQ:** content-model `Faq` with `placements` extended by `safeguarding` and `about`. Public group pills filter on placements (donations = `donate`). Programme FAQs use the programme's `faqIds` (overrides public-pages §3.20).
- **D50. Project, story, team and policy fields:** `Project` + `status: upcoming | ongoing | completed`, `startedAt`, `endedAt`, `gallery: MediaRef[]`, `outcomes[{ label, value, verified }]`, `causeSlug`, `body: Block[]`. `Story` + `featured`. `TeamMember` + `languages`, `bio: Block[]`. `Policy` + `pdf?: MediaRef`. Policy slugs: `safeguarding`, `privacy`, `terms`. The "Draft, pending professional review" banner shows while `lastReview?.reviewer !== 'professional'` (overrides content-model §3.5, public-pages §3.13–3.14, §3.21).
- **D51. Site facts:** `settings.contact` + `teamEmails { support, safeguarding, donations, partnerships, media, privacy }`, `hours`, `responseTimes`, a phone per office (incl. the US office). `settings.safety` + `emergencyContacts[]` (only verified ones render). `settings.site` + `registrations[]` and `figures.hideUnverified`. Money configuration lives only in `settings/payment` (D63). data-model `settings/org` keeps only `timezone`, `financialYearStartMonth` and `concernTwoPersonClose` (overrides public-pages §2.5, data-model §4.7, content-model §3.4).
- **D52. Page intros:** every public page's hero and section copy is an editable `pages.<key>` doc with one generic `PageDoc` shape (hero + seo + a keyed `sections` map). Seed values are public-pages' copy, in `content/seed/pages/<key>.ts`. Only interface microcopy stays in code (overrides public-pages §2.5/§3 `content/pages/*.ts`).
- **D53. Media and consent:** content-model `MediaAsset`. Consent records live in data-model's `mediaConsents`; `Consent.recordRef` points there. data-model's consent vocabulary replaces content-model's: `state: not_required | valid | missing | expired | withdrawn`, scope `{ website, social, print, story, image, video }`, `expiresAt` (overrides content-model §3.2/§6.1, data-model §4.6 `MediaAsset`).
- **D54. Illustrative labels:** both. A per-image `ImageCredit` chip wherever `illustrative` (= `aiGenerated && peopleVisible`) is true, except the landing hero, **and** content-model's footer notice while any such image is live (overrides public-pages §2.2 sole chip, content-model §6.5 sole footer).
- **D55. Sponsorship:** data-model `sponsorProfiles` (code `HVN-SP-NNNN`, statuses `draft | published | fully_funded | archived`) + `sponsorsNeeded`, `sponsorsCurrent`, `ageBand: AgeBand`. Admin: Giving › Sponsorship (programme officer drafts, content manager publishes). Deep link: `/get-involved/sponsor?ref=HVN-SP-NNNN`; giving goes to cause `sponsor-a-child` (overrides public-pages §3.19, admin-ux §4.1–4.2).
- **D56. Allocation shape:** one `AllocationPart = { label, percent, note?, tone? }` on causes (planned split, "where the money goes"). data-model's `spendingPlan` is dropped (fills a coverage gap).
- **D57. Annual allocation summary:** new content collection `allocationSummaries` (id `fy-YYYY`): per-currency received and spent by programme, plus admin and fees, with `Verification`. Finance edits it in Giving › Where it went, prefilled from allocations. It feeds `/impact` "Where the money went" and links to the annual report (fills a coverage gap; overrides admin-ux §6.6's Phase 2 deferral).
- **D58. Story submissions:** new collection `storySubmissions` (sequenced prefix `SS`; `CaseDoc` statuses `new | reviewing | published | declined | closed`; sealed contact; consent stamps; parent/guardian flag; adult-only photo through the quarantine upload). Content managers triage them in the Inbox (record kind `story`). "Turn into story / testimonial" creates a draft item with consent `missing`. Template `story_acknowledgement` (fills a coverage gap; overrides data-model §4.0).
- **D59. Unlisted report:** `ReportRequest.resourceId: string | null` + `requestedTitle` (overrides data-model §4.5).
- **D60. Studio slots:** slot ids equal content-model doc ids; field limits come from the zod schemas; `lib/studio/registry.ts` is generated from `lib/content/registry.ts`. Collection-backed slots edit items through `saveItem`, or point to their manager (`managedIn`: programmes, causes, posts, projects). No manifesto-line slot (overrides admin-ux §6.10).
- **D61. Publish model:** content-model's write pipeline (validation, field groups, gate, audit, versions, conflicts) + `publishAll(keys[])` and `discardDraft` for admin-ux's PublishSheet. Autosave calls `saveDoc({ intent: 'draft' })`. Key information uses `intent: 'publish'` and `restoreDocVersion` for its 10-second Undo (overrides content-model §5.1–5.2 single button, admin-ux §6.10–6.11 mechanics).
- **D62. Draft Mode:** preview route `app/api/admin/studio/preview/route.ts` (`requireStaff` → `draftMode().enable()` → redirect to `path?studio=1`). Exit is the `exitPreview()` Server Action in `lib/content/actions.ts`. One banner, `PreviewBanner`. `getContent` checks only `draftMode().isEnabled` (no cookies inside the cache scope). `StudioBridge` is a client leaf reading `useSearchParams().get('studio')` inside Suspense, rendered by a server leaf that checks draftMode (overrides content-model §4.6 `/api/preview`, admin-ux §4.2 exit route and layout `searchParams`).

### 2.5 Money and giving

- **D63. Configuration split:** display config (currencies, minimums, presets, frequencies, in-kind list) is the content doc `donate.config`. Payment config (per-currency routes, instructions, FX, cover-fees percent, `maxOnline`, receipt settings) is the system doc `settings/payment`. Both are edited in Settings › Giving. data-model's `settings/org` money fields are removed (overrides data-model §4.7, content-model §3.4, public-pages §2.5).
- **D64. Frequency token:** `one_time` in code, storage, API and Stripe metadata. Public URLs may show `frequency=once`; `lib/routes.ts` maps it at the URL boundary only (overrides public-pages §4.1–4.7).
- **D65. Donation fields:** `Donation` and `DonationIntent` gain `cash.coverFees: boolean`, `cash.baseAmount: Money` and `attribution { utmSource, utmMedium, utmCampaign, referrer }`. `DonationRequest` carries `submissionId` and `_elapsed`; the donor field is `fullName` (overrides data-model §4.3, public-pages §4.4/§4.7).
- **D66. Donate endpoint:** `POST /api/donations` (cash and in-kind; Stripe and pledge) returns `{ kind: 'stripe', url } | { kind: 'pledge', next } | { kind: 'unavailable', message } | { kind: 'error', message, fieldErrors? }`. No `/api/stripe/checkout`. No Stripe.js anywhere (hosted Checkout) (overrides next16 §6/§12.1, data-model §1, design-system §7 item 10).
- **D67. When records exist:** Stripe gifts create a `donationIntents` doc (TTL 48 h) at checkout; the `Donation` is created only by the webhook, `/api/stripe/return` or the tick sweeper. A pledge creates a `Donation` (`pledged`) immediately. The thank-you page is read-only (overrides public-pages §4.7–4.8, next16 §12.1).
- **D68. Stripe event mapping:** integrations §3.6. Payment mode: Donation on `checkout.session.completed`. Subscription mode: `RecurringGift` on completion, and a Donation for every `invoice.paid` with amount > 0. data-model §4.3's table is corrected to match (overrides data-model §4.3, public-pages §4.7).
- **D69. Webhook idempotency:** `stripeEvents/{id}` is written inside the domain transaction; receipts go through the outbox. No separate claim step (overrides next16 §12.2).
- **D70. Recurring self-service:** the Stripe Customer Portal by magic link at `/donate/manage` is in Phase 1; the thank-you copy says so (overrides public-pages §4.9).
- **D71. Limits:** online maximums come from `settings/payment.maxOnline` (defaults USD 10,000, GBP 8,000, EUR 9,000, GMD 700,000). The donation rate limit is 10 per hour per IP hash (overrides public-pages §4.4/§4.7).
- **D72. Gift stages:** data-model's ids and order. Allocations may be saved while `received` without changing status; the gift auto-advances to `allocated` once it is acknowledged and fully allocated. In-kind gifts use `DonationStatus` with admin-ux's helper labels; design-system's in-kind status list is dropped (overrides admin-ux §6.6/§7, design-system App A).
- **D73. Countries:** person and organisation `country` fields (donors, requesters, volunteers, partners, contacts, report requests, staff) use the full ISO list in `lib/countries.ts`; `CountrySelect` lists The Gambia and presence countries first on beneficiary forms. `content/world.ts` validates only content `place` fields (overrides data-model §2/§10.5, content-model §3.2, public-pages §2.4, contracts audit `countrySchema`).

### 2.6 References, enums and workflows

- **D74. References:** data-model in full. Sequenced `HVN-{PP}-{YYYY}-{NNNN}`, gap-free, equal to the doc id, prefixes `SR, DN, RG, AP, RR, VA, PE, CM, DR, SS`. Concerns are random `HVN-XXXX-XXXX` (Crockford). Receipts `HVN-RC-YYYY-NNNN`. Sponsor profiles `HVN-SP-NNNN`. Find uses `normaliseRef()` (overrides admin-ux §4.4/§3.5 `S26-0142`, public-pages §0.6/§2.4 `HVN-7KQ2MX`, design-system §3.3, next16 §6.1).
- **D75. Support transitions:** data-model §5.1's edge table is binding. `StatusStepper` renders only allowed edges and their guards (verification before `approved`, outcome summary before `completed`) (overrides admin-ux §7 supportFlow).
- **D76. Concerns:** data-model statuses `received | screening | risk_assessed | escalated | referred | monitoring | closed` and five risk levels incl. `no_concern`. Labels: received "New", screening "Screening", risk_assessed "Reviewed". "Not yet assessed" = `riskLevel: null` (overrides admin-ux §7 concernFlow, design-system App A).
- **D77. Counselling:** a counselling request is a support request (`HVN-SR`, category `counselling`). Sessions are `appointments` (`HVN-AP`, `scheduled | completed | no_show | cancelled`). "Waiting for a time" = counselling SR in `approved` or `support_in_progress` with no scheduled appointment. "Confirmed / Link sent" = `scheduled` with `reminders.confirmationQueuedAt` set. Attended/Missed = `completed`/`no_show`. Follow-up is a field, not a status (overrides admin-ux §4.4/§5.2/§7, design-system App A, integrations §6.3 wording).
- **D78. Partnerships and messages:** data-model ids. Labels: `in_discussion` "Talking", `agreed` "Agreement", contact `closed` "Done". No `paused` in Phase 1 (use closed + reopen) (overrides admin-ux §6.9/§6.19/§7, design-system App A).
- **D79. Danger or child protection on the support form:** a support submission with `immediateDanger = true` or category `child_protection` is written **only** as a concern (`source: moved_from_support`), with an identical success screen. The safeguarding officer can create a linked support request (`linkedSupportRef`). admin-ux's "Immediate danger: Yes" S-record chip, the routing of S records to SO Inboxes and the SO Today card for flagged requests are removed (overrides public-pages §3.5–3.6, admin-ux §5.2/§5.4/§6.4; rejects the coverage audit's split rule).
- **D80. Support category:** data-model's `education | medical | counselling | legal | food_supplies | family_support | other` everywhere, URL included. The URL parameter is `?type=`. `child_protection` exists only as a form option and routes per D79 (overrides content-model §3.5/§8.1, public-pages §2.5/§3.5–3.6).
- **D81. Public form enums:** data-model's snake_case enums are canonical, extended: relationship + `grandparent`, `social_worker`, `young_person`, `institution`; concern types + `child_labour`, `bullying`, `harmful_practice` (replacing `child_marriage`); in-kind condition + `mixed`; partner kinds + `orphanage_childrens_home`, `legal_practice`; volunteer `availability.days[]`; `heardFrom` on volunteer and partnership. Labels in `lib/model/labels.ts`. URL tokens use canonical values (`/contact?category=programme_info`). Where data-model and public-pages enumerate the same field differently, data-model ids win and public-pages labels map 1:1 (overrides public-pages §3.6–3.8, §3.17–3.18, §4.4).
- **D82. Age bands:** one `AgeBand` (`0-4 | 5-9 | 10-14 | 15-17 | 18+ | unknown`) for support, concern, appointment and sponsor records (overrides data-model §2 sponsor ranges, public-pages §3.7/§3.19, admin-ux §6.4–6.5).
- **D83. Admin data additions:** `CaseDoc` + `snoozedUntil` and `seenBy: Uid[]`; new `referralPartners` collection (admin-ux Directory); `referrals[]` + `partnerId`, `consentToShare`, `outcome: waiting | accepted | declined | completed`; volunteer `onboardingChecklist`; concern `closure.secondSignOffBy`, required for high/immediate risk while `settings/org.concernTwoPersonClose` is true (default true, owner question). Stored urgency stays `low | medium | high`; admin-ux "immediate" is derived. Pulse counts use `count()` with a 30-second per-uid memo, never `counters`. The Inbox loads up to 100 per kind through parallel cursor queries (overrides data-model §2/§4.2, admin-ux §4.5/§6.3/§6.9, §16 risk 8, §3.8).

### 2.7 Auth and access

- **D84. requireStaff:** `requireStaff(...anyOf: Permission[]): Promise<Viewer>` in `lib/server/auth/session.ts`; `roles: Role[]` everywhere (never `user.role`). No session → redirect to `/admin/login?next=`. Lacking every listed permission → `notFound()`; `app/admin/(desk)/not-found.tsx` renders admin-ux's `NoAccess` copy, worded to cover "not here, or not open to your role" (no existence leak, friendly). Route handlers use `getViewer()` and return 401 (no session) or 404 (denied), never 403. `placesFor()` and `can()` are computed from `viewer.perms`; content field groups use `viewer.roles` plus permissions (overrides next16 §5 redirect-with-notice, admin-ux §5.5 area/verb and 403, content-model §5.2 single role).
- **D85. Permission matrix:** data-model §6.1–6.2 is binding, with these grants added: `content.edit` + `content.publish` for programme_officer (programmes, projects), finance_officer (cause money fields, `donate.config`, finance stats, `allocationSummaries`), safeguarding_officer (`settings.safety`, programme notices, locked FAQs, safeguarding policy, emergency notice) and report_manager (`pages.resources`), each narrowed by content-model field groups; `impact.verify` per D47; new permissions `settings.giving` (FO), `storySubmission.manage` (CM), `referralPartner.manage` (PO), `supporters.send` (CM); `appeal.figures` renamed `cause.figures`. data-model's SO, PO-notes and contact-routing choices stand. The emergency notice is editable by SO and SA (overrides admin-ux §5.1–5.2/§6.11, content-model §5.3 partially).
- **D86. Sessions:** Firebase mode exchanges the ID token at `POST /api/auth/session` (same-origin check). Local mode signs in with a Server Action. Cookie `__Host-haven_session` over https, `haven_session` on http localhost; the proxy accepts both. Lifetime 12 h for SA/SO/FO, 7 days for others. "Keep me signed in" unchecked = browser-session cookie with server-side expiry at the role limit; checked = the role limit. Sign-out = Server Action, then `window.location.replace('/admin/login')`. `/admin/locked` after 30 minutes idle (client timer); unlocking re-authenticates and refreshes `authTime` (overrides next16 §5–6 8 h, admin-ux §6.1 14 d, data-model §1 `DELETE` sign-out).
- **D87. Step-up:** `requireRecentAuth(viewer, nextPath)` with a **30-minute** window, for: entering Safeguarding, personal-data exports, role and MFA changes, staff deactivation, data-request completion. `/admin/confirm?next=` renders admin-ux's "Confirm it's you" sheet full-screen (overrides data-model §6.4 12 h, contracts audit `STEP_UP_MS.standard`).
- **D88. MFA:** TOTP required for SA, SO and FO. No backup codes (Identity Platform TOTP has none); recovery is a super-admin reset. URLs: `/admin/invite/[token]`, `/admin/forgot`, `/admin/reset/[token]`, `/admin/login/code` (the MFA resolver is held in client module state). Reset copy says "1 hour". "Sign out everywhere else" becomes "Sign out on all devices" (overrides admin-ux §6.1/§6.17/§4.2, data-model §9.5 `/admin/welcome`).
- **D89. Proxy:** optimistic cookie-presence check only, matcher `/admin/:path*`, exempting `/admin/login`, `/admin/login/code`, `/admin/forgot`, `/admin/reset/*`, `/admin/invite/*`. All response headers come from `next.config.ts headers()` (overrides data-model §9.2, admin-ux §5.5 rule 2).
- **D90. Practice sign-in:** the one-tap role chips and `POST /api/dev/session` work only when `backend === 'local' && !process.env.VERCEL` (impossible on Vercel; works under `next start` for QA). Both sign in as seeded `<role>@haven.test` accounts through one dev-only function with that guard (overrides admin-ux §6.1/§16 risk 9 `NODE_ENV` guard).
- **D91. Staff profile:** data-model `StaffProfile`/`Viewer` + `timezone`, `textSize`, `tourDoneAt`, `zoomPersonalLink`; `notificationPrefs.email: Record<'inbox' | 'handoffs' | 'sessions' | 'drafts', 'instant' | 'daily_digest' | 'off'>`. admin-ux "paused" = `suspended`; "invited" is derived from `invitations`; viewer access uses `viewerScopes` (no `viewerAreas`/`extraAreas`); initials and tone are derived (overrides next16 §5 `Staff`, admin-ux §4.5/§6.14/§6.17).
- **D92. Staff devices:** a coarse device label (browser + OS family) on auth audit entries and on `staffSessions/{id}` (Firebase) or `.data/auth/sessions.json` (local) backs the Me › Devices list. No raw IPs; the daily-salted `ipHash` stays. data-model's "no user agents" rule applies to public submissions only (overrides data-model §0.10/§2 wording, admin-ux §6.15/§6.17 scope).
- **D93. Audit:** one `auditLog` collection, data-model's `AuditEntry` + `sensitive: boolean` (true for record views, field reveals, exports, auth and role changes). Content writes use `area: 'content'` and data-model action strings (`content.publish`, …) (overrides content-model §4.2/§5.4, admin-ux §6.15).

### 2.8 Forms, uploads and files

- **D94. Spam controls:** data-model field names (`company_website` honeypot, `_elapsed` ≥ 2,500 ms), thresholds, rate-limit table and IP source order (`x-vercel-forwarded-for` first). The concern form never discards a submission; it keeps it flagged `suspectedSpam` (overrides public-pages §2.4/§4.7, next16 §6.1).
- **D95. QuickExit:** design-system's component, fixed bottom-left (ScrollTop owns bottom-right). Triggers: click and Shift ×3 (no Esc ×2, which collides with closing dialogs). Action: clear sessionStorage, then `location.replace('https://www.google.com/search?q=weather')`. No drafts at all on the support and concern forms (a `beforeunload` guard instead); other forms may keep drafts in sessionStorage (overrides design-system §3.4/§6.2 trigger, public-pages §2.2 placement and destination).
- **D96. Public case uploads:** `POST /api/uploads`, one file per request, ≤ 4 MB, through the function: magic-byte check, sharp re-encode (EXIF/GPS stripped), quarantine, HMAC upload token. Up to 5 files per form; PDF, JPEG, PNG, WebP. The client downscales first. No `/api/uploads/sign`, no `/api/uploads/local/*` (overrides next16 §6, public-pages §2.4/§9).
- **D97. Staff uploads:** images go through `POST /api/admin/media/upload` (multipart ≤ 4 MB, sharp → WebP). PDFs and other large files use `/api/admin/uploads/{sign,local/[id],complete}`. Resource files are capped at 25 MB (overrides data-model §10.6 partially, content-model §6.3, admin-ux §6.8).
- **D98. Public media serving:** one same-origin route, `app/m/[...path]/route.ts`, in every mode, serving only the `public/` prefix. Keys: `public/media/{mediaId}/{sha256-12}.webp`, `public/resources/{id}/{sha256-12}.pdf`. Withdrawn media → 410. Media: `Cache-Control: public, max-age=86400, s-maxage=86400`; `immutable` only under `public/resources`. No `images.remotePatterns`, no firebasestorage in the CSP, no `/uploads/*`, no `/api/media/*`, no `unoptimized` (overrides next16 §6/§14/§15, content-model §0.9/§6.4, design-system §7.5).
- **D99. images.localPatterns:** never set. If it ever is, it must list `/media/**`, `/m/**`, `/brush/**`, `/flags/**`, `/art/**` and `/textures/**` with `search: ''` (overrides design-system §7.5).
- **D100. Private files:** `app/api/admin/attachments/[...path]` (audited, `Content-Disposition: attachment`, CSP sandbox) and, locally, `app/api/dev/files/[...path]` (HMAC, 60 s). No `/api/admin/files/*` (overrides admin-ux §4.2/§14).
- **D101. Resource downloads:** `GET /api/resources/[slug]/download` increments `downloadCount` and 302s to `/m/public/resources/…`. Controlled reports are delivered through `/r/[token]` (overrides integrations §8.2 field name `downloads`).
- **D102. Exports:** `app/admin/export/[dataset]/route.ts` with data-model §12's datasets and rules, behind `requireRecentAuth`. admin-ux's ExportSheet maps gifts→`donations`, inkind→`in-kind`, allocations→`donation-allocations`, activity→`audit-log` (overrides next16 §6, admin-ux §4.2 `/api/admin/export`).
- **D103. Newsletter:** double opt-in (`newsletter_confirm`, 7-day token). `/newsletter/confirm?token=` (noindex) shows the welcome on screen. Subscriber count and export live in Settings › Newsletter (CM) (overrides public-pages §1.1/§3.24).
- **D104. Privacy requests:** public `/privacy/request` and `/privacy/request/verify?token=`, `dataRequests` with `DR` refs, verification email, 30-day deadline. The privacy policy links there; the Contact form's "Privacy or data request" option is a link there, not a stored contact category. Settings › Data lists requests with Find records, Correct, Delete, Anonymise, Restrict and the countdown (overrides public-pages §3.8/§3.21, admin-ux §6.16).
- **D105. Retention UI:** data-model §11.4's policy table in `settings/retention`; Settings › Data edits each policy within allowed values; concerns stay review-only (overrides admin-ux §6.16 "1/3/5/7 years").

### 2.9 Email, cron, AI and analytics

- **D106. Outbox:** integrations §1 as reconciled: `emailOutbox` in every mode; statuses include `scheduled` and `held`; local mailbox files at `.data/mailbox/{id}.html`; the one viewer is `/admin/settings/email-log` ("Outbox" in practice mode). No `/admin/dev/mailbox`, no `.data/outbox*` (overrides data-model §8.1/§8.4, public-pages §4.8).
- **D107. Templates and subjects:** integrations §4.4 ids and subjects, plus `story_acknowledgement` ("Thank you for sharing your story (HVN-SS-…)") and `supporter_update` ("An update from Haven"). Staff-facing names say **"Haven team"** instead of "Haven Desk" (e.g. "Haven team: something new for you"). public-pages' "New message: {category}" is dropped. admin-ux's escalation alert is `concern_alert` with priority "Immediate" (overrides public-pages §3.24, admin-ux §8/§6.5, integrations §4.4 wording, data-model §4.7).
- **D108. Concern reporter email:** sent only when the reporter chose Email as the safe follow-up method **and** ticked `emailConfirmationAllowed`. Subject carries no reference. The random reference is shown on screen to every reporter, anonymous ones included (overrides public-pages §3.7/§3.24, admin-ux §8).
- **D109. Concern alert recipients:** `settings/notifications.concernAlert` (default: every active SO). Super admins join on the last re-alert. If no active SO exists, super admins receive the initial alert (overrides admin-ux §8, public-pages §3.24).
- **D110. Cron:** integrations §7: `/api/cron/{tick,retention,editorial}` only, Hobby-safe `vercel.json`. Due posts publish inside tick and from an admin client effect that calls a Server Action, never during render. A 15-minute tick (Vercel Pro, or the GitHub/cron-job.org pinger) is **required in production**, because in-app concern re-alerts do not go through Resend (overrides next16 §13, content-model §7.4, integrations §0.12 "optional pinger").
- **D111. Analytics and the Firebase snippet:** Vercel Web Analytics on the public site only. `getAnalytics()` is never called. The Firebase client app is initialised only in the admin sign-in, code, confirm and invite client components, from `NEXT_PUBLIC_FIREBASE_*` (never a hard-coded config), importing only `firebase/app` and `firebase/auth`, through `lib/client/firebase.ts`. `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` stays unused. GA4 is an owner question (overrides next16 §15 GA4 note and the pasted console snippet).
- **D112. Env names:** `NEXT_PUBLIC_SITE_URL` with `baseUrl()`; `HAVEN_HMAC_SECRET` signs every token. `SITE_URL`, `SESSION_SECRET` and `DONATION_LINK_SECRET` are not used. Local sessions use the random token store (overrides data-model §8.1, next16 §11, public-pages §4.7).

### 2.10 Headers and SEO

- **D113. Security headers:** `next.config.ts headers()` is the single source. All routes: `Content-Security-Policy-Report-Only` (next16 §15 policy + `https://challenges.cloudflare.com` in `script-src` and `frame-src`, `https://www.youtube-nocookie.com` in `frame-src`, no firebasestorage in `img-src`, `frame-ancestors 'self'`), `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. `/admin/:path*`: `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`, `Referrer-Policy: same-origin`. Token routes (`/r/:token`, `/admin/invite/:token`, `/admin/reset/:token`, `/donate/manage`, `/donate/receipt/:ref`, `/unsubscribe`, `/newsletter/confirm`, `/privacy/request/verify`): `Referrer-Policy: no-referrer`, `Cache-Control: no-store` (overrides next16 §15 `'none'`/`DENY`, content-model §4.6).
- **D114. robots.ts:** public-pages §7.1/§7.3 (env-aware; non-production disallows everything) plus disallow `/donate/receipt`, `/donate/manage`, `/r/`, `/newsletter/confirm`, `/privacy/request/verify` (overrides next16 §9).
- **D115. Site search:** built in Phase P: `searchSite()` over an in-memory index of public content (< 500 docs, never private collections), `GET /api/search`, the working overlay and `/search` (overrides content-model §2.1 row 20, design-system §4.2 static index).

### 2.11 Design and UI

- **D116. Tokens:** design-system §1.8 values. admin-ux reuses `shadow-soft`/`shadow-card-hover`, `rounded-control` (22px) for admin cards, `coral-100` for urgent-soft, `marigold-100` for attention-soft, and the `paper` utility for the canvas. Only `--color-restricted-soft` and `--shadow-dock` are added. No raw hex in components (overrides admin-ux §10.1/§3.1, contracts audit token list).
- **D117. Admin focus:** `AdminShell` sets `--focus: forest`. Marigold focus appears only on dark surfaces (overrides admin-ux §6.1, §15 check 3).
- **D118. White on coral:** small white text sits on `coral-800`. Emails use design-system hex values (coral-800 text, `coral-100` `#fdebe6` background) (overrides HANDOFF accessibility note, public-pages §2.4, integrations §4.5).
- **D119. No switches:** no toggle switches anywhere in the admin; use Segmented ("Showing / Hidden"), choice cards or sentence checkboxes. `Switch.tsx` is not built (overrides design-system §3.3/§5.5).
- **D120. One primitive each:** design-system paths and names own every primitive. Mapping: DuoCard→`ActionCard`, NewsCard→`ArticleCard`/`UpdateCard`, FaqAccordion→`Accordion variant="card"`, BioDrawer→`Sheet`, CheckboxPills/FilterPills/FilterChips→`Chips`, ChoiceCards→`RadioCards`, StepCards→`Timeline variant="process"`, FinalCta→`CtaBand variant="default"`, TextField/TextArea→form kit with `density="admin"`. Page composites live in `components/public/<area>/`, `components/donate/`, `components/seo/`; admin composites only in `components/admin/**`. Turnstile is `components/ui/form/Turnstile.tsx`. Toasts are the in-house `components/ui/Toast.tsx` (`useToast`); **sonner is not added** (overrides public-pages §2.2–2.4, admin-ux §4.3/§9, integrations §9).
- **D121. PageHero:** design-system props (`crumbs`) and variants `photo | programme | plain | article`, plus `editorial` for public-pages' VU chapter pages (it counts as that page's one VU chapter). Mapping: calm→`plain`, document→`article` (news, resource detail) or `plain` with `meta` (policies). public-pages picks each page's variant (overrides public-pages §2.2).
- **D122. Closing band:** design-system `CtaBand` with variants `default` (coral VU, = FinalCta), `safeguarding`, `volunteer`. public-pages decides where it appears; never after a sensitive form (overrides public-pages §2.1–2.2).
- **D123. Notice tones:** design-system `emergency | info | success | warning | danger | disclaimer`. public-pages' `review` = `info`; emergency uses design-system's deep style (overrides public-pages §2.2, contracts audit `review` tone).
- **D124. Anchors, breadcrumbs, pagination:** `scroll-padding-top` 84px (104px ≥ 80rem), `AnchorLink` uses the same offsets; breadcrumb separators are marigold heart glyphs, collapsing to "… / Parent / Current". Numbered `Pagination` with rel prev/next on `/news` (9 per page) and `/resources` (12 per page). Admin lists use cursor "Load more" (25 per page) (overrides public-pages §5.4–5.5, design-system §3.6 public LoadMore and admin Pagination).
- **D125. Admin identity and IA:** admin-ux owns IA, navigation, the phone dock (Today · role place · ＋ New · Find · Places), split view ≥ 1024px, pushed routes on phones, the record surface and masking (only reporter/requester contact is masked; no blur). The admin's name is **"Haven team"** everywhere (title template `%s · Haven team`). Visual values come from design-system. Today's KPI count-up runs once and never under reduced motion (overrides design-system §5.2/§5.5 "Haven Desk", blur and "no counters"; next16 §9; integrations §4.1/§4.4).
- **D126. Public chrome scope:** only Programmes gets a mega panel (design-system styling); others are dropdowns. Design-system's story detail pages, public `DateSlots` booking and Accessibility page are dropped (Accessibility statement: Phase 2) (overrides design-system §4.2/§4.4).
- **D127. Dependencies:** approved additions: `resend@6.32.1`, `@anthropic-ai/sdk@0.131.0`, `@vercel/analytics@2.0.1`, `cmdk`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (exact versions ≥ 14 days old). Pin `stripe@23.0.0`. Move `sharp` and `@google/genai` to `dependencies`. Not added: sonner, react-markdown, remark-gfm, `@tiptap/*`, nodemailer, react-email, `ics`. F1 installs everything; nobody else edits `package.json` (overrides content-model §9 step 2, data-model §1, admin-ux §9, public-pages §3.15).

### 2.12 Scope additions (from the coverage audit)

- **D128. Home final call to action:** a `home.finalCta` slot (CtaBand default, spec copy "Your Support Will Positively Impact a Child's Welfare and Future.", buttons Donate Now / Become a Volunteer / Request Support) after News, seeded **hidden** so the approved landing stays pixel-identical. Switching it on is an owner question.
- **D129. Supporter updates:** Posts gains "Send to supporters": a published post or update goes to confirmed subscribers plus donors with updates consent (optional cause filter), through the outbox as `supporter_update` (Resend batch in production, held locally), with List-Unsubscribe and the suppression list.
- **D130. Before-launch checklist:** `/admin/website/launch` (SA) from `getLaunchReadiness()`, with deep links: placeholder records, unverified stats + the hideUnverified switch, AI child images in use, contact values still equal to seeds, partners without permission, policies without professional review, missing PROD env vars.
- **D131. Settings › Giving:** per-currency routing as choice cards ("GMD gifts: mobile money or bank" / "card"), mobile-money providers and instructions, `maxOnline`, cover-fees %, receipt text, bank details, helper FX, presets and the in-kind item list.
- **D132. Projects admin:** Website › Projects edits the `projects` collection (status, dates, gallery through MediaPicker's consent gate, verified outcomes, cause link). Three projects are seeded with slugs from `content/home.ts`.
- **D133. Phone and WhatsApp preferences:** staff see each person's contact preference; a Today task and the "Log a call" composer cover people who asked for phone or WhatsApp. No automated SMS/WhatsApp.
- **D134. People-mix constant:** one dependency-free `content/people-mix.ts` (target shares, allowed groups) used by `scripts/media/manifest.mjs`, `scripts/media/audit-mix.mjs` and `lib/server/ai/imageStyle.ts`, so the founder's pending decision changes one value. The mother-and-father family rule and dignity rules are unchanged.
- **D135. Admin home-screen install:** `public/admin.webmanifest` referenced from the admin layout's `metadata.manifest` ("Add to home screen"). The native app stays deferred.

### 2.13 Corrections to the contracts audit (applied in §5)

- **D136.** `ContactCategory` has no `privacy` value (D104). `HavenMeta.haven_appeal` → `haven_cause` (D37). `DonorInput.name` → `fullName` (D65). `ShellViewer.backend` → `'firestore' | 'local'` (D33). `countrySchema` = ISO, plus a separate `placeSchema` = `content/world.ts` (D73). `CountrySelect` always lists all ISO countries with a `priority` prop (D73).
- **D137.** `requireRecentAuth` has one 30-minute window (D87). `QuickExit` has no Esc trigger (D95). `Notice` has no `review` tone (D123). `PageHero` gains `editorial` (D121). Only two new tokens (D116). No sonner (D120).
- **D138.** Collections: drop `appeals`, `editorialPlans`, `teamMembers`; add `causeTotals`, `storySubmissions`, `referralPartners`, `staffSessions`, `allocationSummaries` (content), `emailSuppressions`, `metrics`, `cronLocks`, `mediaUploads`. Content subcollection is `versions` (not `revisions`). `RecordKind` and `REF_PREFIX` gain `story`/`SS`.
- **D139.** `lib/content/public.ts` (façade), `lib/content/search.ts`, `lib/content/launch.ts`, `lib/content/ids.ts`, `lib/seo/meta.ts`, `lib/model/{session,viewer,ui,email,status-meta}.ts` and `components/content/Blocks.tsx` are Phase F files. Cards take primitive props (D27). `Composer`, `PersonPicker`, `KpiTile` and `MediaPicker` are Phase F admin primitives, because several admin packages share them. Content Server Actions are split into `lib/content/actions.ts` (docs, items, publish, preview), `lib/content/post-actions.ts` (post workflow) and `lib/content/media-actions.ts` (media), so the studio and posts packages own separate files; exported names are unchanged.

### 2.14 Remaining items

- **D140. Cache tags:** content-model's scheme, exported only from next16's registry `lib/cache/tags.ts`: `content:<docId>`, `col:<collection>`, `<collection>:<id|slug>`, `media`, `donations:totals`, `settings:<key>`, `col:resources`, `resources:<slug>`, `col:sponsorProfiles`, `sponsorProfiles:<code>`. Studio publishes call the per-doc and per-collection tags, never `content:<page>` (overrides next16 §7.2, data-model §8.6, admin-ux §6.10).
- **D141. Phantom docs and public IA:** the mapping in §1.2 is binding. `public-pages.md` §1.1 is the binding public route list (overrides next16 §3 "IA doc", content-model's "IA/auth/payments/resources doc" references, design-system §4.2/§4.4 extra pages).

---

## 3. Coverage

### 3.1 Coverage-audit gaps folded into scope

| Gap | Fix | Built in |
|---|---|---|
| Home final CTA (§3) | D128, hidden by default | P2 (render), F3 (schema/seed) |
| Seven ToR impact stats; "only verified figures" | D45–D47, launch switch D130 | F3, P6, A7 |
| Testimonials intake through `/stories/share` | D58 | P6 (form), A2 (Inbox), F3 (schema) |
| Child-protection category and immediate danger | D79 | P4, A3 |
| "Donor may receive approved impact updates" | D129 | A8, I3 |
| "See exactly where the money goes" | D56–D57 + per-cause "received so far / put towards" | P3, P6, A4 |
| Quick picture-and-paragraph updates | D42–D43 | A8, P6, P2 |
| Blog body format | D42, D44 | F3, F5 (`Blocks`), A8 |
| Editing landing content and key information | D51, D60–D62, D113 (frame-ancestors) | A7 |
| No sidebar, no toggles | D119, D125 | F5, all A |
| Projects page and its admin | D50, D132 | P6, A7 |
| Sponsorship admin and model | D55 | A4, P7 |
| International donors and partners | D73 | F1 (`lib/countries.ts`), F4 (`CountrySelect`) |
| One reference format | D74 | F1, F2 |
| One route/file map, one auth helper, single root | §4, D1–D5, D84 | F |
| One set of status machines and enums | D20, D75–D82 | F1 |
| Content backends unified | D28, D31–D32 | F2, F3 |
| Shared public primitives | D120–D124 | F4 |
| Correction and deletion process | D104 | P5, A9 |
| Client inputs and open questions consolidated | §8 + HANDOFF.md register + D130 | Q6, A7 |
| Payment methods per currency in admin | D131 | A4 |
| People-mix sign-off | D134, §8 | I4, Q6 |
| Phased delivery | §1.3, §5, §6 | this file |
| Firebase project and analytics snippet | D34–D35, D111 | F1, F5, I7, I8 |
| Contact phone per office incl. US | D51 | F3, A7 |
| Phone/WhatsApp follow-up visibility | D133 | A1, A2 |

### 3.2 Deferred (with reasons)

The owner wants everything built. Code for every Phase 1 feature is complete in this plan, including Stripe and Firebase paths that cannot be verified until keys arrive (they are verified in local or stub mode now and with real keys later, with no code changes). Only these items are deferred:

| Item | Phase | Why |
|---|---|---|
| AI customer-service line (phone, messages, US number) | 2 | Not in any design; needs telephony vendor and budget. Phase 1 keeps FAQs and key information structured so they can feed it, and adds the US phone to contact settings. |
| Automated SMS and WhatsApp sending | 2 | ToR §16 Phase Two. Phase 1 records preferences and shows them to staff (D133). |
| Beneficiary portal and public case-status tracker | 2 | ToR §16; a reference lookup invites enumeration. Status changes reach people by email. |
| Multilingual interface | 2 | ToR §16. Admin strings stay in `lib/admin/copy.ts`, public microcopy in `pages.*`, `html lang` set. Safeguarding wording is never machine-translated. |
| Native mobile app | 2 | ToR §16. The admin is phone-first, with an admin web manifest (D135). |
| E-consent | 2 | ToR §16. Phase 1 records consent with the signed form attached privately (D53). |
| Automated calendar, advanced case management, advanced financial reports, advanced impact dashboard, partner-system integrations | 2 | ToR §16. Covered in Phase 1 by `.ics`, scheduled reminders, the referral directory, CSV exports, the annual allocation summary and internal metrics. |
| Staff upload of replacement landing videos | 2 | content-model §6.7: Phase 1 lets staff pick among the existing pipeline videos. Phase 2 adds signed MP4 upload (H.264, poster required, fingerprinted names). |
| Public Accessibility statement page | 2 | D126. |
| Partnership `paused` status | 2 | D78. |
| Vercel Speed Insights | 2 | integrations §11. |
| Live verification against Firebase and Stripe | when keys arrive | Code is complete; I8 and I1 ship the preflight scripts and fixtures. |

Rejected outright (not deferred): story detail pages, public counselling booking, `/team`, `/testimonials`, `/appeals`, cookie banner (none needed while analytics is cookieless).

---

## 4. Final architecture

### 4.1 Route tree

Owner package in brackets. `(…)` = route group (no URL segment).

```
app/
  layout.tsx                       [F5 → P8] root: html/body, 4 fonts, globals.css, noscript, base metadata (metadataBase from NEXT_PUBLIC_SITE_URL), viewport
  not-found.tsx                    [F5] SiteChrome + NotFoundBody (unmatched URLs)
  global-error.tsx                 [F5] 'use client', own <html><body>, { error, retry }
  icon.svg  opengraph-image.tsx    [existing; F5 day-0 fix → P8]
  robots.ts  sitemap.ts            [F5 minimal → P8 full]
  (site)/
    layout.tsx                     [F5] SkipLink, SmoothScroll, SiteChrome(chrome), RouteScrollReset, PreviewBanner, StudioBridgeSlot, SiteAnalytics, ToastProvider
    page.tsx                       [F5 move → P2] landing
    actions.ts                     [F5 stub → P7] subscribe()
    error.tsx  not-found.tsx       [F5]
    about/                         [P5]
    programmes/  programmes/[slug]/{page,loading,opengraph-image}         [P5]
    get-support/  get-support/request/{page,actions}                       [P4]
    report-a-concern/{page,actions}                                        [P4]
    contact/{page,actions}                                                 [P4]
    resources/  resources/[slug]/{page,loading}                            [P7]
    request-a-report/{page,actions}                                        [P7]
    impact/                                                                [P6]
    projects/  projects/[slug]/{page,loading}                              [P6]
    stories/  stories/share/{page,actions}                                 [P6]
    news/  news/[slug]/{page,loading,opengraph-image}  news/rss.xml/route.ts  [P6]
    get-involved/  …/volunteer/{page,actions}  …/partner/{page,actions}  …/sponsor/  [P7]
    donate/(give)/{layout,page}  donate/(give)/[cause]/{page,loading,opengraph-image}  [P3]
    donate/thank-you/                                                      [P3]
    donate/manage/{page,actions}  donate/manage/choose/  donate/receipt/[ref]/  [I2]
    faq/  policies/  policies/[slug]/{page,loading}                        [P5]
    privacy/request/{page,actions}  privacy/request/verify/                [P5]
    search/                                                                [P1]
    unsubscribe/{page,actions}  newsletter/confirm/                        [P7]
  admin/
    layout.tsx                     [F5] non-root: noindex, title template "%s · Haven team", manifest, admin canvas
    login/{page,actions}  login/code/  confirm/{page,actions}  locked/     [F5]
    forgot/{page,actions}  reset/[token]/{page,actions}  invite/[token]/{page,actions}  [A9]
    export/[dataset]/route.ts                                              [A9]
    (desk)/
      layout.tsx loading.tsx error.tsx not-found.tsx                       [F5]
      page.tsx                                                             [A1] Today
      inbox/{layout,page}  inbox/[ref]/                                    [A2]
      requests/{layout,page}  requests/[ref]/                              [A2]
      r/[ref]/                                                             [A2]
      safeguarding/{layout,page}  safeguarding/[ref]/                      [A3]
      giving/  giving/[ref]/  giving/[ref]/receipt/  giving/causes/  giving/causes/[slug]/
        giving/where-it-goes/  giving/sponsorship/  giving/sponsorship/[code]/  [A4]
      counselling/{layout,page}  counselling/[ref]/                        [A5]
      library/  library/new/  library/[id]/  library/requests/{layout,page}  library/requests/[ref]/  [A5]
      people/  people/{volunteers,partners,directory}/  people/[ref]/      [A6]
      website/  website/[page]/  website/key-info/  website/changes/  website/launch/  website/projects/  [A7]
      media/                                                               [A7]
      posts/  posts/new/  posts/[id]/  posts/[id]/send/  posts/review/  posts/review/[id]/  posts/plan/  [A8]
      team/  team/[uid]/  me/  activity/                                   [A9]
      help/  help/[guide]/                                                 [A1]
      settings/page.tsx  settings/{connections,email-log,data}/            [A9]
      settings/giving/                                                     [A4]
      settings/newsletter/                                                 [A8]
      settings/emails/  settings/emails/[template]/                        [I3]
  api/
    auth/session/route.ts          [F2] POST (Firebase ID-token exchange)
    donations/route.ts             [P3] POST
    donations/pay/route.ts         [I2] GET ?t=
    stripe/webhook/route.ts  stripe/return/route.ts   [I1]
    stripe/portal/route.ts         [I2]
    email/webhook/route.ts         [I3] Resend events → suppressions
    search/route.ts                [P1]
    resources/[slug]/download/route.ts  [P7]
    uploads/route.ts               [P4] public case uploads
    cron/tick/route.ts  cron/retention/route.ts   [I6]
    cron/editorial/route.ts        [I4]
    admin/pulse/route.ts  admin/search/route.ts   [A1]
    admin/studio/preview/route.ts  admin/media/upload/route.ts   [A7]
    admin/uploads/{sign,local/[id],complete}/route.ts            [A5]
    admin/attachments/[...path]/route.ts                          [A2]
    dev/{seed,selftest,session}/route.ts  dev/files/[...path]/route.ts   [F2] 404 unless local && !VERCEL
    dev/content/route.ts           [F3] same guard
  m/[...path]/route.ts             [F5] public blobs, 410 when withdrawn
  r/[token]/route.ts               [P7] controlled-report delivery
proxy.ts                           [F1]
next.config.ts                     [F1]
vercel.json  instrumentation.ts    [I6]
```

Short-link redirects (public-pages §1.3) live in `next.config.ts`.

### 4.2 Layering

```
Client components ──props──▶ only client-safe modules: lib/model/**, lib/forms/**, lib/schemas/**, lib/routes.ts,
                             lib/nav.ts, lib/money.ts, lib/countries.ts, lib/admin/{access,copy,format}.ts, lib/client/**
Public pages (RSC) ────────▶ lib/content/public.ts ──▶ lib/content/read.ts ('use cache') ──▶ lib/content/store.ts ─┐
                                                   └─▶ lib/server/public/* ('use cache') ─────────────────────────┤
Public actions/routes ─────▶ lib/server/intake/<form>.ts ──▶ intake/pipeline.ts ─────────────────────────────────┤
Admin pages/actions/routes ▶ lib/server/dal/<area>.ts (requireStaff first; DTOs field by field) ──▶ repos ─────┤
                             lib/server/workflow/<area>.ts (guards/effects) ──▶ workflow/flow.ts ─────────────────┤
                             lib/content/actions.ts (content writes) ─────────────────────────────────────────────┤
                                                                                                                   ▼
                             lib/server/db (DocStore: LocalJsonAdapter | FirestoreAdapter), lib/server/storage (BlobStore)
Cross-cutting (server): env, auth/session, security/*, references, audit, events, notify, email/outbox, cron
```

Import rules (enforced by `eslint.config.mjs` `no-restricted-imports`, F1):
1. `components/**`, `lib/model/**`, `lib/forms/**`, `lib/schemas/**`, `lib/routes.ts`, `lib/nav.ts`, `lib/client/**` never import `@/lib/server/**`, `@/lib/content/{read,store,actions,defaults,public}` or `@/content/seed/**`.
2. `app/**` never imports `@/lib/server/db/**` or `@/lib/server/storage/**` (go through dal, intake, public, content), except `app/api/dev/**`, `app/m/**` and `app/api/admin/attachments/**`.
3. Only `lib/content/defaults.ts` and `lib/server/public/resources.ts` import `@/content/seed/**`.
4. `firebase/*` is imported only by `lib/client/firebase.ts` and `lib/client/mfa.ts`; `firebase-admin/*` only by `lib/server/db/firestore.ts`, `lib/server/storage/gcs.ts`, `lib/server/auth/firebase.ts`.
5. Legacy `@/content/{home,people,programmes,site,nav}` may be imported only by files listed in the rule's allowlist; the list shrinks to zero at the P gate, when the lead deletes those files.
6. `content/world.ts`, `content/media-map.ts`, `content/media-credits.ts`, `content/people-mix.ts` and `lib/media/pipeline.ts` use relative imports only and never import `server-only` (scripts load them through Node type stripping).

### 4.3 Data modes

`resolveBackend()` in `lib/server/env.ts`:
1. `HAVEN_BACKEND=firestore|local` forces a mode (`local` on Vercel throws at boot).
2. `FIREBASE_SERVICE_ACCOUNT_JSON` (or the split trio) present → `firestore`.
3. Otherwise `local` when not on Vercel, `unavailable` on Vercel.

| | `local` (today) | `firestore` | `unavailable` (Vercel, no creds) |
|---|---|---|---|
| Content reads | `.data/db` merged over seeds | Firestore merged over seeds (a build-time read failure throws) | seeds only |
| Content writes | atomic JSON writes | Firestore transactions | refused: `ActionResult { kind: 'unavailable' }` |
| Public forms | records in `.data/db` | Firestore | friendly "being set up" state with contacts (`FormState code 'unavailable'`) |
| Donations | pledge (Stripe test keys work if set) | pledge or Stripe | `{ kind: 'unavailable' }` with bank/mobile-money contacts |
| Files | `.data/storage/{public,private,quarantine}` | private GCS bucket | uploads hidden ("our team will ask you securely") |
| Sealing key | `.data/keys/data.key` auto-created | `HAVEN_DATA_KEY` required | n/a |
| Admin | practice mode: sand ribbon, chips, Outbox | normal | setup page listing missing env |

### 4.4 Auth modes

| | Local (practice) | Firebase |
|---|---|---|
| Active when | backend `local` | backend `firestore` + `NEXT_PUBLIC_FIREBASE_*` |
| Sign-in | Server Action `signIn` in `app/admin/login/actions.ts` → `localSignIn` → `startSession` | client `firebase/auth` email+password (+ TOTP at `/admin/login/code`) → `POST /api/auth/session` with the ID token → `createSessionCookie` |
| Cookie value | `loc.<32 random bytes>`; sha256 stored in `.data/auth/sessions.json` | Firebase session cookie (`verifySessionCookie`) |
| First super admin | `LOCAL_ADMIN_EMAIL`/`LOCAL_ADMIN_PASSWORD` bootstrap on first sign-in; if unset and no accounts exist, a "Create the first super admin" form (local only) | `scripts/data/create-super-admin.mjs` (I8), then invitations |
| Other staff | seeded `<role>@haven.test` (password `LOCAL_SEED_PASSWORD`, or chips only if unset), invitations | invitations only (no self sign-up) |
| MFA | skipped; badge "Local test sign-in: two-step verification is skipped" | TOTP required for SA, SO, FO |
| Roles | `staff/{uid}.roles` in `.data/db` | `staff/{uid}.roles` in Firestore (no custom claims) |

Session lifetimes, step-up and idle lock: D86–D87. `getViewer()` is wrapped in `React.cache`, rejects inactive staff and cookies issued before `sessionsRevokedAt`.

### 4.5 Caching (Cache Components on)

- **Public readers** (`lib/content/read.ts`, `lib/server/public/*.ts`, `lib/media/index.ts`): `'use cache'` + `cacheLife('content')` + `cacheTag(...)` from `lib/cache/tags.ts`. They never read `cookies()` or `headers()`. They read `draftMode()` (allowed inside `'use cache'`; it bypasses the cache).
- **Tags** (exact strings, only from `TAG.*`): `content:<docId>`, `col:<collection>`, `<collection>:<id|slug>`, `media`, `donations:totals`, `settings:<payment|org|forms>`, `col:resources`, `resources:<slug>`, `col:sponsorProfiles`, `sponsorProfiles:<code>`. Tags never contain personal data.
- **Writers:** Server Actions → `updateTag`. Route handlers, webhooks, cron → `revalidateTag(tag, 'max')`; cron-published posts → `revalidateTag(tag, { expire: 0 })`.
- **Admin pages** are dynamic (session cookie) under `(desk)/loading.tsx`. Personal data is never cached across users; per-uid memo (30 s) for dashboard counts lives in a module `Map`, not `'use cache'`.
- **Time:** `new Date()`, `Date.now()`, `Math.random()`, `crypto.randomUUID()` only inside `'use cache'`, after `await connection()` inside Suspense, or in effects, handlers, actions and routes.

### 4.6 Environment variables (final names)

Exact `.env.example` content: integrations §10.1, with `NEXT_PUBLIC_SITE_URL=http://localhost:3001` (Haven's dev port). Builders never edit `.env.local`; the lead does.

| Variable | Tag | Today in `.env.local` |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | PROD | no (dev uses request origin) |
| `HAVEN_BACKEND` | OPT | no |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | PROD | **no** (commented placeholder) |
| `NEXT_PUBLIC_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,STORAGE_BUCKET,APP_ID}` | PROD | yes |
| `NEXT_PUBLIC_FIREBASE_{MESSAGING_SENDER_ID,MEASUREMENT_ID}` | unused | yes (ignored) |
| `HAVEN_DATA_KEY`, `HAVEN_DATA_KEY_ID`, `HAVEN_DATA_KEYS_OLD` | PROD (firestore) | no (local key file) |
| `HAVEN_HMAC_SECRET`, `HAVEN_LOOKUP_SECRET` | PROD | no (dev-derived fallback with warning) |
| `CRON_SECRET` | PROD | lead adds for I6 tests |
| `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`, `LOCAL_SEED_PASSWORD` | LOCAL | lead adds before the F gate |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | PROD-REC | no |
| `STRIPE_CURRENCIES`, `STRIPE_PORTAL_CONFIGURATION_ID` | OPT | no |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | unused | commented |
| `RESEND_API_KEY`, `EMAIL_FROM` | PROD | no → mailbox mode |
| `EMAIL_REPLY_TO`, `EMAIL_REDIRECT_TO`, `EMAIL_PROVIDER`, `RESEND_WEBHOOK_SECRET` | OPT | no |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, `AI_IMAGES` | OPT | no → template writer |
| `GOOGLE_APPLICATION_CREDENTIALS` | LOCAL | no (never point it at the Optiq key for app runtime) |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_DEFAULT_HOST` | OPT | no → pasted links |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | OPT | no |
| `NEXT_PUBLIC_ANALYTICS`, `NEXT_PUBLIC_ANALYTICS_EVENTS` | OPT | no (defaults vercel / off) |

`lib/server/env.ts` is the only reader of `process.env`, apart from `NEXT_PUBLIC_*` reads in `lib/client/firebase.ts` and `components/analytics/SiteAnalytics.tsx`.

### 4.7 Local `.data/` layout (gitignored)

```
.data/db/<collection>/_docs.json                    one file per collection (data-model §8.4)
.data/db/<collection>/<docId>/<sub>/_docs.json      subcollections (notes, events, attachments, actions, versions, updates)
.data/storage/{public,private,quarantine}/…         BlobStore local driver (D98 key layout)
.data/auth/{accounts,sessions,resets}.json          local auth
.data/keys/data.key                                 local sealing key
.data/mailbox/<outboxId>.html                       held email previews
.data/locks/                                        cross-process locks
```

Never delete `.data/`. Seeding is idempotent.

---

## 5. Phase F: Foundation

### 5.0 Packages, waves and order

| Wave | Package | Title | Starts when |
|---|---|---|---|
| 1 | **F1** | Contracts and config | immediately (after the lead's pre-flight) |
| 2 | **F2** | Data, security, auth and services engine | F1 done |
| 2 | **F3** | Content and media | F1 done |
| 2 | **F4** | UI kit (public, forms, cards) | F1 done |
| 3 | **F5** | Shells, admin chrome and integration | F2, F3, F4 done |

Rules for Phase F:
- F1 writes the pure contract modules **for real** and writes **final-signature stubs** for every module that one wave-2 package imports from another, or that wave 3 and later phases fill in: the engine entry points (`lib/server/db/index.ts`, `lib/server/auth/session.ts`, `lib/server/audit.ts`, `lib/server/notify.ts`, `lib/server/storage/index.ts`), the public system readers (`lib/server/public/{settings,totals,resources,sponsors}.ts`) and the selftest suites (`lib/server/dev/suites/*.ts`). When wave 2 starts, each stub's ownership passes to the package named in its owner list. Exported names and types must not change.
- F2 likewise creates **stubs** that later phases fill (listed in F2). F5 creates the **UI seam stubs** (record views and global sheets) that A packages fill.
- A stub has the final exported signature, compiles, and degrades gracefully (`null`, empty list, `{ kind: 'off' }` or a friendly "not switched on yet" UI). It never throws during render.

**Lead pre-flight (before F1):**
1. Capture the landing baseline against the current code: `node scripts/qa/shoot.mjs --url http://localhost:3001/ --full` at 1440×900 and 375×812, plus `hero-frames.mjs` and `donate-flow.mjs`; copy to `media-src/qa/baseline/`.
2. Add to `.env.local`: `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`, `LOCAL_SEED_PASSWORD` (test values, never printed), and later `CRON_SECRET` for I6.
3. After F1's `npm install`, restart the dev server on port 3001.

### 5.1 F1 — Contracts and config (wave 1)

**Owns:** `next.config.ts`, `proxy.ts`, `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `eslint.config.mjs`; `lib/model/**`; `lib/forms/{types,spam}.ts`; `lib/schemas/common.ts`; `lib/countries.ts`; `lib/routes.ts`; `lib/nav.ts`; `lib/money.ts`; `lib/cache/tags.ts`; `lib/content/ids.ts`; `lib/admin/{access,copy,format}.ts`; `lib/server/{env,url,log}.ts`; `lib/server/email/types.ts`; `lib/server/ai/types.ts`; `lib/server/payments/{metadata,schemas}.ts`; `lib/server/db/{store,collections}.ts`; `lib/server/dev/{guard,types}.ts` (real); stubs `lib/server/db/index.ts`, `lib/server/auth/session.ts`, `lib/server/audit.ts`, `lib/server/notify.ts`, `lib/server/storage/index.ts`, `lib/server/public/{settings,totals,resources,sponsors}.ts`, `lib/server/dev/suites/{index,store,refs,seal,outbox,auth,workflow,content,rbac,stripe,email,ai,zoom,retention}.ts`.

**Config files:**

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: { content: { stale: 300, revalidate: 86_400, expire: 31_536_000 } },
  images: { qualities: [70, 75, 85], formats: ['image/webp'] },          // AVIF stays off; no remotePatterns, no localPatterns (D98–D99)
  outputFileTracingExcludes: { '/*': ['./.data/**/*', './media-src/**/*'] },
  async redirects() { /* public-pages §1.3, all permanent */ },
  async headers() { /* D113 exactly */ },
};                                                                         // no webpack key, no experimental.*
```

```ts
// proxy.ts — imports only next/server and lib/model/session
export function proxy(request: NextRequest): NextResponse   // isPublicAdminPath → next(); no SESSION_COOKIE/SESSION_COOKIE_SECURE → redirect `/admin/login?next=${safeNextPath(path+search)}`
export const config = { matcher: ['/admin/:path*'] }
```

- `.env.example`: integrations §10.1 verbatim except `NEXT_PUBLIC_SITE_URL=http://localhost:3001`.
- `.gitignore`: add `!.env.example` and `/.data/`.
- `package.json`: D127 (install, exact pins, move `sharp` and `@google/genai` to dependencies; add scripts `"typecheck": "tsc --noEmit"`, `"seed": "node scripts/dev/seed.mjs"`).
- `eslint.config.mjs`: §4.2 import rules.

**Client-safe model (`lib/model/**`, no `server-only`, no env, no imports from `content/*` except `content/world.ts` in `lib/countries.ts`):**

```ts
// lib/model/enums.ts
export type Millis = number; export type Uid = string; export type CountryCode = string   // ISO 3166-1 alpha-2 or 'other'
export const CURRENCIES = ['GMD','USD','GBP','EUR'] as const;              export type Currency = (typeof CURRENCIES)[number]
export const FREQUENCIES = ['one_time','monthly','quarterly','annual'] as const; export type Frequency = (typeof FREQUENCIES)[number]
export const PROGRAMME_IDS = ['protection','education','medical','psychological','legal','family'] as const; export type ProgrammeId = (typeof PROGRAMME_IDS)[number]
export const PROGRAMME_SLUGS = ['child-protection','education','medical','counselling','legal','family-community'] as const; export type ProgrammeSlug = (typeof PROGRAMME_SLUGS)[number]
export const PROGRAMME_SLUG: Record<ProgrammeId, ProgrammeSlug>             // protection→child-protection, psychological→counselling, family→family-community
export function programmeIdOfSlug(slug: string): ProgrammeId | null
export type ContactMethod = 'email' | 'phone' | 'whatsapp' | 'sms'
export const AGE_BANDS = ['0-4','5-9','10-14','15-17','18+','unknown'] as const; export type AgeBand = (typeof AGE_BANDS)[number]
export type Money = { amountMinor: number; currency: Currency }
export type Sealed = { $sealed: 1; kid: string; iv: string; tag: string; ct: string }
export type ConsentStamp = { at: Millis; noticeVersion: string }
export interface BaseDoc { createdAt: Millis; updatedAt: Millis; version: number }
export type IntakeSource = 'web_form' | 'staff_entry' | 'moved_from_support' | 'moved_from_contact' | 'stripe' | 'import'
export type RetentionPolicyId = /* data-model §11.4 ids, as in the contracts audit */
export type RetentionInfo = { policy: RetentionPolicyId; retainUntil: Millis | null; legalHold: boolean }
export interface CaseDoc<S extends string> extends BaseDoc {
  reference: string; status: S; statusChangedAt: Millis; assignedTo: Uid | null; assignedName: string | null; assignedAt: Millis | null
  followUpAt: Millis | null; snoozedUntil: Millis | null; seenBy: Uid[]; lastActivityAt: Millis; closedAt: Millis | null
  archived: boolean; archivedAt: Millis | null; tags: string[]; searchTokens: string[]; retention: RetentionInfo; source: IntakeSource; isSample?: true }
export type AllocationTarget = { type: 'general' } | { type: 'programme'; programmeId: ProgrammeId } | { type: 'cause'; causeSlug: string }
export function targetKey(t: AllocationTarget): string                    // 'general' | 'programme:education' | 'cause:eid-clothes-gifts'
export const SUPPORT_CATEGORIES = ['education','medical','counselling','legal','food_supplies','family_support','other'] as const; export type SupportCategory
export type SupportFormCategory = SupportCategory | 'child_protection'      // form-only (D79)
export const CONTACT_CATEGORIES = ['general','donation','partnership','volunteering','media','programme_info','resource_request','technical_support'] as const; export type ContactCategory
export type Relationship, ConcernType, InKindCategory, InKindCondition, Handover, PartnerKind, ResourceCategory, ResourceAccess, Urgency3 /* data-model §4 lists + D81 extensions */
```

```ts
// lib/model/session.ts — imports NOTHING (proxy-safe)
export const SESSION_COOKIE = 'haven_session'; export const SESSION_COOKIE_SECURE = '__Host-haven_session'
export function sessionCookieName(secure: boolean): string
export const PUBLIC_ADMIN_PATHS: readonly RegExp[]                        // ^/admin/login(/code)?/?$, ^/admin/forgot/?$, ^/admin/reset/[^/]+/?$, ^/admin/invite/[^/]+/?$
export function isPublicAdminPath(pathname: string): boolean
export function safeNextPath(next: string | null | undefined): string    // same-origin '/admin…' only, else '/admin'
export const SESSION_LIFETIME_MS = { privileged: 43_200_000, standard: 604_800_000 } as const   // 12 h SA/SO/FO, 7 d others
export const STEP_UP_MS = 1_800_000; export const IDLE_LOCK_MS = 1_800_000
```

```ts
// lib/model/permissions.ts — data-model §6.1–6.2 + D47 + D85
export const ROLES = ['super_admin','content_manager','programme_officer','safeguarding_officer','finance_officer','counsellor','report_manager','viewer'] as const; export type Role
export type ViewerScope = 'support_summary' | 'donations_summary' | 'donations_detail' | 'engagement' | 'content' | 'audit'
export type Permission = /* data-model §6.1 list with 'appeal.figures'→'cause.figures', + 'settings.giving' | 'storySubmission.manage' | 'referralPartner.manage' | 'supporters.send' */
export const ALL_PERMISSIONS: readonly Permission[]
export const ROLE_PERMS: Record<Role, readonly Permission[] | '*'>
export const VIEWER_SCOPE_PERMS: Record<ViewerScope, readonly Permission[]>
export function permsFor(roles: Role[], viewerScopes: ViewerScope[]): ReadonlySet<Permission>
export const MFA_REQUIRED_ROLES: readonly Role[]                          // super_admin, safeguarding_officer, finance_officer
export const CONTACT_OWNERS: Record<ContactCategory, Role[]>              // data-model §6.2 routing
```

```ts
// lib/model/viewer.ts (types only; server returns Viewer, client receives ShellViewer)
export type Viewer = { uid: Uid; displayName: string; email: string; roles: Role[]; perms: ReadonlySet<Permission>; viewerScopes: ViewerScope[]
  programmeScope: ProgrammeId[] | 'all'; timezone: string; textSize: 'normal' | 'large'; authTime: Millis; mfa: boolean; backend: 'firestore' | 'local' }
export type SystemActor = { kind: 'system'; job: string }
```

```ts
// lib/model/ui.ts
export type UiImage = { src: string; alt: string; width?: number; height?: number; blurDataURL?: string; focal?: { x: number; y: number }; illustrative?: boolean; decorative?: boolean }
export type UiVideo = { src: string; poster: string; label?: string }
export type Tone = 'forest' | 'marigold' | 'clay' | 'cocoa' | 'coral' | 'umber' | 'deep'
export type AllocationTone = Tone
```

```ts
// lib/model/email.ts
export const EMAIL_TEMPLATE_IDS = [/* integrations §4.4 ids + 'story_acknowledgement' + 'supporter_update' */] as const
export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number]
```

```ts
// lib/model/status.ts — statuses only (categories live in enums.ts)
export type SupportStatus, ConcernStatus, RiskLevel, AppointmentStatus, DonationStatus, RecurringStatus, VolunteerStatus,
  PartnershipStatus, ContactStatus, ReportRequestStatus, DataRequestStatus, PostStatus      // exactly as the contracts audit
export type StorySubmissionStatus = 'new' | 'reviewing' | 'published' | 'declined' | 'closed'
export type SponsorProfileStatus = 'draft' | 'published' | 'fully_funded' | 'archived'
export type Workflow = 'support' | 'concern' | 'appointment' | 'donation' | 'inkind' | 'recurring' | 'volunteer' | 'partnership' | 'contact' | 'reportRequest' | 'dataRequest' | 'post' | 'storySubmission'
export type StatusOf<W extends Workflow>; export const OPEN_STATUSES: { [W in Workflow]: readonly StatusOf<W>[] }
```

```ts
// lib/model/flows.ts — pure data; edges exactly data-model §5.1–5.6, post per content-model §7.1, storySubmission new→reviewing→published|declined→closed
export type Ask = 'reason' | 'reasonAndEmail' | 'emailTemplate' | 'referral' | 'risk' | 'secondSignOff' | 'schedule' | 'allocation' | 'refund' | 'outcome' | 'assignee'
export type EdgeActor = Permission | 'system' | 'stripe' | 'public' | 'assigned_counsellor'
export interface EdgeSpec<S extends string> { from: readonly S[] | 'any_open'; to: S; who: readonly EdgeActor[]; verb: string; asks?: Ask; reopen?: true; sendsEmail?: boolean }
export interface FlowSpec<S extends string> { workflow: Workflow; initial: S; path: readonly S[]; pauses: readonly S[]; exits: readonly S[]; terminal: readonly S[]; edges: readonly EdgeSpec<S>[] }
export const FLOWS: { [W in Workflow]: FlowSpec<StatusOf<W>> }
export function edgesFrom<W extends Workflow>(w: W, from: StatusOf<W>): EdgeSpec<StatusOf<W>>[]
export function allowedEdges<W extends Workflow>(w: W, from: StatusOf<W>, perms: ReadonlySet<Permission>, ctx?: { isAssignedCounsellor?: boolean }): EdgeSpec<StatusOf<W>>[]
export function toStepperFlow<W extends Workflow>(w: W): { path; pauses; exits; labels; next; verbs; asks; initial }   // admin-ux §7 shape, derived
```

```ts
// lib/model/labels.ts — STATUS_LABEL (admin-ux wording, D76–D78), PROGRAMME_LABEL, CURRENCY_NAME, FREQUENCY_LABEL, ROLE_LABEL,
//   CONTACT_CATEGORY_LABEL, SUPPORT_CATEGORY_LABEL (+ child_protection form label), AGE_BAND_LABEL, RISK_LABEL, and a label map for every enum in enums.ts
// lib/model/status-meta.ts — StatusTone, STATUS_META, statusMeta(), RISK_META (incl. 'unassessed'), KIND_TINT, URGENCY_META  (design-system App A keyed by snake_case ids)
```

```ts
// lib/model/refs.ts — data-model §3 (D74)
export const REF_PREFIX = { supportRequests: 'SR', donations: 'DN', recurringGifts: 'RG', appointments: 'AP', reportRequests: 'RR',
  volunteerApplications: 'VA', partnershipEnquiries: 'PE', contactMessages: 'CM', dataRequests: 'DR', storySubmissions: 'SS' } as const
export type SequencedCollection = keyof typeof REF_PREFIX
export type RecordKind = 'support' | 'concern' | 'gift' | 'inkind' | 'session' | 'reportRequest' | 'volunteer' | 'partner' | 'message' | 'recurring' | 'dataRequest' | 'story'
export const SEQ_REF_RE: RegExp; export const CONCERN_REF_RE: RegExp; export const RECEIPT_RE: RegExp; export const SPONSOR_RE: RegExp
export function normaliseRef(input: string): string | null              // 'sr 2026 12' → 'HVN-SR-2026-0012'; 'k7q2m9xd' → 'HVN-K7Q2-M9XD'
export function collectionOfRef(ref: string): SequencedCollection | 'safeguardingConcerns' | null
export function adminHrefOfRef(ref: string, kind?: RecordKind): string
```

```ts
// lib/model/dto.ts — Page<T>, Urgency ('immediate'|'urgent'|'soon'|'normal', derived), StaffRef, ShellViewer (backend 'firestore'|'local'),
//   InboxItem, TimelineKind, TimelineEntryDTO, ActivityItem, PulseDTO, IntegrationStatus, MediaPickerItem
//   — as in the contracts audit, with D33 applied. Concern rows carry only ref/risk/status/age/assignee; preview 'Details are restricted'.
// lib/model/domain/*.ts — record interfaces, data-model §4 verbatim with these amendments:
//   case.ts (CaseNote, CaseEvent, AttachmentMeta, ConcernAction) · support.ts (SupportRequest: category SupportCategory, immediateDanger always false,
//   referrals[] { partnerId|null, toName, toType, consentToShare, outcome: 'waiting'|'accepted'|'declined'|'completed', at }) ·
//   concern.ts (+ linkedSupportRef, emailConfirmationAllowed, suspectedSpam, closure { by, at, reason, secondSignOffBy, secondSignOffAt }) ·
//   appointment.ts · giving.ts (Donation: causeSlug, cash.coverFees, cash.baseAmount, attribution; DonationIntent: + submissionId, recurringGiftRef,
//   coverFees, baseAmount, attribution; Donor.fullName; RecurringGift; StripeEventRecord; CauseTotals) ·
//   engagement.ts (VolunteerApplication + availability.days[], heardFrom, onboardingChecklist; PartnershipEnquiry + heardFrom; ContactMessage;
//   NewsletterSubscriber; StorySubmission; ReferralPartner) · library.ts (Resource with executiveSummary: Block-compatible unknown[]; ReportRequest
//   resourceId string|null + requestedTitle) · media.ts (MediaConsent with consentState + scope object; MediaUpload) · sponsor.ts (SponsorProfile +
//   ageBand, sponsorsNeeded, sponsorsCurrent) · staff.ts (StaffProfile + timezone, textSize, tourDoneAt, zoomPersonalLink, notificationPrefs per D91;
//   Invitation; StaffSession; StaffNotification) · system.ts (AuditEntry + sensitive, device; OutboxEmail with scheduled/held, preview, deliveryState;
//   EmailSuppression; Counter; RateLimitBucket; DataRequest; RetentionQueueItem; CronLock; Metric; AiJob) ·
//   settings.ts (PaymentSettings per D63; OrgSettings { timezone, financialYearStartMonth, concernTwoPersonClose }; NotificationSettings;
//   FormsSettings; RetentionSettings; EmailCopySettings)
//   Removed (superseded): Appeal, AppealContent, ImpactStat, ContentEnvelope, ProgrammePage, Post, TeamMember, Testimonial, Story, MediaAsset, EditorialPlan.
```

**Forms, schemas, routes, money, tags:**

```ts
// lib/forms/types.ts (isomorphic; NOT 'use server')
export type FieldErrors<K extends string = string> = Partial<Record<K, string>>
export type FormErrorCode = 'validation' | 'rate_limited' | 'challenge' | 'unavailable' | 'closed' | 'server'
export type FormState<K extends string = string, D = undefined> =
  | { status: 'idle' }
  | { status: 'error'; code: FormErrorCode; message: string; fieldErrors?: FieldErrors<K>; values?: Partial<Record<K, string>> }
  | { status: 'success'; reference?: string; title?: string; message?: string; data?: D }
export const IDLE: FormState
export type ActionResult<T = { version: number; at: Millis }> = { ok: true; data: T } | { ok: false; error:
  | { kind: 'validation'; fields: Record<string, string> } | { kind: 'conflict'; message: string; current: { version: number; updatedBy: string; updatedAt: Millis } }
  | { kind: 'forbidden'; message: string; paths?: string[] } | { kind: 'blocked'; message: string; reasons: string[] }
  | { kind: 'unavailable'; message: string } | { kind: 'not_allowed'; message: string } }
export function zodToFieldErrors(err: z.ZodError): FieldErrors
export function formError(code: FormErrorCode, message?: string, extra?: { fieldErrors?: FieldErrors; values?: Record<string, string> }): FormState
export function formSuccess(reference?: string, message?: string): FormState
export function valuesOf(fd: FormData, keys?: string[]): Record<string, string>   // never files, never the honeypot
export const UNAVAILABLE_MESSAGE: string
// lib/forms/spam.ts: HONEYPOT_FIELD='company_website', ELAPSED_FIELD='_elapsed', MIN_ELAPSED_MS=2500, TURNSTILE_FIELD='cf-turnstile-response', SUBMISSION_ID_FIELD='submissionId'
```

```ts
// lib/schemas/common.ts (zod 4)
export const str: (max: number, opts?: { min?: number; multiline?: boolean }) => z.ZodString     // trim, NFC, strip control chars except \n
export const emailSchema, phoneSchema, consentSchema /* z.literal('on') */, refSchema, idSchema
export const countrySchema   // ISO 3166-1 alpha-2 from lib/countries.ts, or 'other' (D73)
export const placeSchema     // content/world.ts codes (content fields only)
export const currencySchema, frequencySchema, programmeIdSchema, programmeSlugSchema, ageBandSchema, contactMethodSchema, supportCategorySchema, supportFormCategorySchema
export const moneyMajorSchema: (c: Currency) => z.ZodNumber
export function optionalStr(max: number): z.ZodType<string | null>
// lib/countries.ts
export const COUNTRIES: ReadonlyArray<{ code: string; name: string }>    // all ISO 3166-1 alpha-2
export function countryName(code: string): string; export function isIsoCountry(code: string): boolean
export const PRESENCE_FIRST: readonly string[]                            // 'GM' then content/world.ts codes
```

```ts
// lib/routes.ts — public-pages §1.1 (D25)
export { PROGRAMME_SLUG, programmeIdOfSlug } from './model/enums'
export const RESERVED_CAUSE_SLUGS: readonly string[]                      // thank-you, general, in-kind, api, manage, receipt
export type RouteKey = 'top' | 'about' | 'programmes' | 'involved' | 'impact' | 'donate' | 'getSupport' | 'support' | 'report' | 'stories' | 'tellStory'
  | 'faq' | 'news' | 'contact' | 'volunteer' | 'partner' | 'sponsor' | 'projects' | 'resources' | 'requestReport' | 'policies'
export function routeHref(key: RouteKey, on?: 'home'): string             // final URLs; only 'top' becomes '#top' on home; 'support' = /get-support/request
export const routes: { home: '/'; about(hash?: string): string; programmes(): string; programme(slug: ProgrammeSlug): string
  donate(cause?: string, q?: { amount?: number; currency?: Currency; frequency?: Frequency; mode?: 'in-kind'; ref?: string }): string  // writes frequency=once for one_time
  thankYou(q: { sessionId?: string; ref?: string; t?: string }): string; manage(): string; receipt(ref: string, t: string): string
  request(type?: SupportFormCategory): string; concern(): string; contact(q?: { category?: ContactCategory; programme?: ProgrammeSlug; subject?: string }): string
  resources(q?: { category?: ResourceCategory; page?: number }): string; resource(slug: string): string; requestReport(slug?: string): string
  news(q?: { category?: string; page?: number }): string; post(slug: string): string; projects(): string; project(slug: string): string
  stories(): string; shareStory(): string; involved(): string; volunteer(): string; partner(q?: { programme?: ProgrammeSlug; type?: PartnerKind }): string
  sponsor(ref?: string): string; impact(): string; faq(): string; policies(): string; policy(slug: 'safeguarding' | 'privacy' | 'terms'): string
  privacyRequest(): string; search(q?: string): string; unsubscribe(token: string): string; newsletterConfirm(token: string): string
  admin: { home: '/admin'; login(next?: string): string; record(ref: string): string; place(area: Area): string } }
export function parseDonateQuery(sp: URLSearchParams): { amount?: number; currency?: Currency; frequency?: Frequency; mode?: 'in-kind'; ref?: string }  // once → one_time
```

```ts
// lib/nav.ts — public-pages §5.1 items, D24, D126
export type NavLink, NavFeature, NavItem     // contracts audit shapes; match: string[]
export function buildMainNav(programmes: Array<{ id: ProgrammeId; slug: ProgrammeSlug; title: string; navBlurb: string }>): NavItem[]
export function buildFooterLinks(programmes: …, policies: Array<{ slug: string; title: string }>): { quick: NavLink[]; programmes: NavLink[]; legal: NavLink[] }
export function isActive(item: NavItem, pathname: string): boolean
// lib/money.ts — keep money(), plainNumber; add minorFactor, toMinor, fromMinor, formatMoney(Money), withCoverFees(baseMinor, coverFees, percent). Currency from lib/model/enums.
```

```ts
// lib/content/ids.ts
export const DOC_IDS = ['settings.site','settings.contact','settings.safety','settings.announcements','settings.chrome','settings.seo','settings.editorial',
  'home.layout','home.hero','home.world','home.partners','home.programmes','home.about','home.duo','home.manifesto','home.impact','home.focus',
  'home.appeals','home.donate','home.doors','home.stories','home.founder','home.team','home.restoring','home.testimonials','home.journey',
  'home.projects','home.faq','home.join','home.news','home.finalCta','donate.config',
  'pages.about','pages.programmes','pages.getSupport','pages.requestSupport','pages.reportConcern','pages.contact','pages.resources',
  'pages.requestReport','pages.impact','pages.projects','pages.stories','pages.shareStory','pages.news','pages.getInvolved','pages.volunteer',
  'pages.partner','pages.sponsor','pages.donate','pages.thankYou','pages.faq','pages.policies','pages.search','pages.privacyRequest','pages.notFound'] as const
export type DocId = (typeof DOC_IDS)[number]
export const COLLECTION_NAMES = ['programmes','causes','stats','stories','testimonials','team','faqs','partners','projects','posts','policies','media','allocationSummaries'] as const
export type CollectionName = (typeof COLLECTION_NAMES)[number]
// lib/cache/tags.ts
export const TAG = { doc: (id: DocId) => `content:${id}`, col: (c: CollectionName | 'resources' | 'sponsorProfiles') => `col:${c}`,
  item: (c: CollectionName | 'resources' | 'sponsorProfiles', key: string) => `${c}:${key}`, media: 'media', donationTotals: 'donations:totals',
  settings: (k: 'payment' | 'org' | 'forms') => `settings:${k}` } as const
export function tagsForItem(c: CollectionName, item: { id: string; slug?: string }): string[]
```

```ts
// lib/admin/access.ts — contracts audit (AREAS, AREA_PERMS, Place, canSeeArea, placesFor, quickActionsFor, GlobalSheet). copy.ts: COPY + t(). format.ts: formatStaffDate, relativeTime, greetingFor.
```

**Server contracts:**

```ts
// lib/server/env.ts — contracts audit `env`, `resolveBackend()`, `firebaseServiceAccount()`, `features`, `devSecret()` (D33–D35)
// lib/server/url.ts — baseUrl(req?), absolute(path, req?)     // no req: NEXT_PUBLIC_SITE_URL → https://VERCEL_URL → http://localhost:3001
// lib/server/log.ts — log.{info,warn,error}(event, meta?), REDACT_KEYS
// lib/server/email/types.ts — re-export EmailTemplateId; EmailBlock, EmailDoc, EmailVars, TemplateDef, EditableCopy (contracts audit)
// lib/server/ai/types.ts — AiProviderId, TextModel, ImageModel, AiRefusal, AiIncomplete, Flag (contracts audit)
// lib/server/payments/metadata.ts — HavenMeta (zod + type) with haven_cause (D37); payments/schemas.ts — DonorInput (fullName), Attribution,
//   DonationRequest (D65), DonationRequestSchema, DonationResponse (D66)
// lib/server/db/store.ts — Scalar, DocData, WithId, Filter, ListQuery, Page, FieldOp, F, Tx, DocStore, ConflictError, NotFoundError,
//   MissingIndexError, BackendUnavailableError (data-model §8.2 verbatim)
// lib/server/db/collections.ts — C (D138 list), CollectionKey, SUB { notes, events, attachments, actions, versions, updates }, docPath(), subPath()
```

**Stubs** (final signatures; F2 owns them from wave 2):

```ts
// lib/server/db/index.ts      export function getStore(): DocStore; export function storeAvailable(): boolean
// lib/server/auth/session.ts  export const getViewer: () => Promise<Viewer | null>; export async function requireStaff(...anyOf: Permission[]): Promise<Viewer>
//                             export async function requireRecentAuth(v: Viewer, nextPath: string): Promise<void>
//                             export async function startSession(uid: Uid, opts: { authTime: Millis; remember: boolean; idToken?: string; device?: string }): Promise<void>
//                             export async function endSession(opts?: { everywhere?: boolean }): Promise<void>; export function toShellViewer(v: Viewer): ShellViewer
// lib/server/audit.ts         export type AuditInput; export function auditTx(tx: Tx, e: AuditInput): void; export async function audit(e: AuditInput): Promise<void>
//                             export function actorOf(v: Viewer | SystemActor): AuditActor; export function redactChanges(changes, sensitiveFields): AuditChange[]
// lib/server/notify.ts        export type NotifyRoute; recipientsFor(); notifyTx(); notify()   (contracts audit)
// lib/server/storage/index.ts export interface BlobStore; getBlobStore(); BLOB_PATH; publicUrl()  (contracts audit)
// lib/server/public/settings.ts  getPaymentSettings(): Promise<PaymentSettings>; getOrgSettings(): Promise<OrgSettings>; getFormsSettings(): Promise<FormsSettings>  (stub: defaults)
// lib/server/public/totals.ts    getCauseTotals(): Promise<Record<string, Partial<Record<Currency, { raisedMinor: number; gifts: number }>>>>                    (stub: {})
// lib/server/public/resources.ts getResources(o?: { category?: ResourceCategory; q?: string; access?: ResourceAccess; page?: number }): Promise<{ items: ResourceSummary[]; total: number }>;
//                                getResource(slug: string): Promise<ResourceDetail | null>                                                                       (stub: seed-backed)
// lib/server/public/sponsors.ts  getSponsorProfiles(o?: { category?: SupportCategory; ageBand?: AgeBand }): Promise<SponsorProfilePublic[]>                     (stub: [])
//   (ResourceSummary, ResourceDetail, SponsorProfilePublic are public DTOs in lib/model/dto.ts; no private fields such as file paths of controlled resources)
// lib/server/dev/suites/<name>.ts  export const suite: Suite   (stub: zero cases). Owners: F2 index/store/refs/seal/outbox/auth/workflow · F3 content · F5 rbac ·
//                                  I1 stripe · I3 email · I4 ai · I5 zoom · I6 retention
```

```ts
// real (F1)
// lib/server/dev/types.ts  export type SuiteCase = { name: string; ok: boolean; detail?: string }; export type Suite = { name: string; run(params: URLSearchParams): Promise<SuiteCase[]> }
// lib/server/dev/guard.ts  export function devOnly(): void   // notFound() unless resolveBackend() === 'local' && !env.onVercel
```

**Acceptance (F1):**
- `npx tsc --noEmit` reports zero errors in F1-owned files; `npx eslint lib/model lib/forms lib/schemas lib/routes.ts lib/nav.ts lib/money.ts lib/cache lib/content/ids.ts lib/admin lib/server proxy.ts next.config.ts` clean.
- `node -e` smoke (or a scratch tsx check): `normaliseRef('sr 2026 12') === 'HVN-SR-2026-0012'`; `allowedEdges('support','under_review', permsFor(['programme_officer'],[]))` contains `approved` and `referred`; `routes.donate('education',{frequency:'one_time'})` contains `frequency=once`; `permsFor(['content_manager'],[])` lacks `concern.read`.
- `curl -sI http://localhost:3001/admin` → 307 to `/admin/login?next=%2Fadmin`; `curl -sI http://localhost:3001/` shows the D113 headers (after the lead restarts the dev server).
- `git status` shows `.env.example` as a new file and no `.data/` entries.

### 5.2 F2 — Data, security, auth and services engine (wave 2)

**Owns:** `lib/server/db/{index,local-json,local-fs,firestore,convert,repo,search-tokens}.ts`; `lib/server/storage/{index,local,gcs}.ts`; `lib/server/security/{seal,hmac,ratelimit,spam,origin,turnstile,sanitise}.ts`; `lib/server/auth/{session,permissions,local,password,firebase}.ts`; `lib/server/{references,audit,events,notify,cron}.ts`; `lib/server/email/{templates/index,render,provider,outbox}.ts`, `lib/server/email/transports/{mailbox,resend}.ts`; `lib/server/workflow/flow.ts`; `lib/server/intake/pipeline.ts`; `lib/server/payments/{stripe,routing}.ts` + stubs `lib/server/payments/{checkout,portal,pay,refunds}.ts`; stubs `lib/server/ai/{provider,assist,monthly,cover}.ts`, `lib/server/zoom/meetings.ts`; `lib/server/integrations/status.ts`; `lib/server/dev/{seed,session,selftest}.ts`, `lib/server/dev/suites/{index,store,refs,seal,outbox,auth,workflow}.ts`; `app/api/auth/session/route.ts`; `app/api/dev/{seed,selftest,session}/route.ts`; `app/api/dev/files/[...path]/route.ts`; `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `storage.cors.json`; `scripts/dev/seed.mjs`; `scripts/qa/data-selftest.mjs`.

**Build** (data-model §1–§3, §6.4, §7, §8.1–8.5, §9, §10.1–10.4, §11.1–11.3; integrations §2, §3.2, §4.2–4.3):
- **DocStore engine:** `LocalJsonAdapter` fully working (atomic tmp+fsync+rename with Windows EPERM/EBUSY/EACCES retry, per-file and global tx mutex, cross-process lock in `.data/locks`, mtime+size read cache, `MissingIndexError` from `firestore.indexes.json`, `*At` as numbers, D29 ids). `FirestoreAdapter` implemented against `firebase-admin` (modular imports, `preferRest`, `ignoreUndefinedProperties`, `*At`↔Timestamp, n+1 cursor paging, `count()`, `recursiveDelete`, `expectedVersion`), compiled but untested until keys arrive. `getStore()` memoised on `globalThis`.
- **BlobStore:** local driver complete (signed URLs = `/api/dev/files/<path>?t=<hmac 60 s>`); GCS driver implemented against `firebase-admin/storage`.
- **Security:** `seal/open` (AES-256-GCM, AAD = docPath + field), `hmac` (D112 token purposes incl. `upload`, `delivery`, `reset`, `invite`, `newsletter_confirm`, `data_request_verify`, `dev_file`), `ratelimit` (data-model §10.4 table + `story`, `manage_link`, `ai_assist`), `spam` (D94), `origin` (same-origin + JSON content type), `turnstile` (verify; fail-open for support/concern; `'off'` without keys), `sanitise`.
- **Auth:** `session.ts` real (D84, D86–D87; lacking perms → `notFound()`; `requireStaff` must be called outside try/catch), `permissions.ts` (`has`, `hasAny`, `assertCan`, `canOpenAppointment`, `contactCategoriesFor`, `inProgrammeScope`, `auditAreasFor`), `local.ts`/`password.ts` (data-model §9.3, D86 bootstrap, first-admin creation allowed only when zero accounts and local), `firebase.ts` (`createSessionCookie`, `verifySessionCookie`, `revokeRefreshTokens`, MFA-required check). `app/api/auth/session/route.ts` POST (same-origin, ID token → session, records `staffSessions`).
- **Case plumbing:** `references.ts` (`createWithReference`, `allocateReference`, `nextReceiptNumber`, `nextSponsorCode`, `randomConcernRef`), `audit.ts` (D93), `events.ts` (`addEventTx`, `listEvents`, `addNoteTx` sealed), `notify.ts` (in-app notifications, `recipientsFor` with D109), `cron.ts` (`cronAuthorized`, `withJobLock`).
- **Email (mailbox mode complete):** `outbox.ts` (`enqueueEmailTx`, `enqueueEmail`, `cancelEmail`, `drainOutbox`; dedupe id; subject asserted against the template pattern; sensitive vars sealed), `provider.ts` (`emailMode()`), `render.ts` (one-column brand HTML + text, design-system hex D118), `transports/mailbox.ts` (status `held`, preview stored, `.data/mailbox/{id}.html`), `transports/resend.ts` **stub** (I3 fills), `templates/index.ts` (every id → generic fallback: heading + reference + links + emergency block for sensitive public templates).
- **Workflow engine:** `workflow/flow.ts` `defineMachine()` (one transaction: read → edge from `FLOWS` + permission + guard → status/version/timestamps → events → audit → effects (outbox/notify)); `TransitionError`. Area guards/effects are later packages' files.
- **Intake:** `intake/pipeline.ts` `runIntake()` (honeypot/time-trap → rate limit → optional Turnstile → zod → create → `after(drainOutbox)`), `consentStamp()`, `PRIVACY_NOTICE_VERSION = 'privacy-2026-10'`.
- **Payments contracts:** `stripe.ts` `getStripe()`, `routing.ts` `effectiveRoutes()`. Stubs with final signatures: `checkout.ts` `startCheckout(req: DonationRequest & { mode: 'cash' }, ctx: { intentId: string; baseUrl: string }): Promise<{ url: string } | null>` (null = Stripe off → caller pledges); `portal.ts` `portalSessionFor(donorId: string, idx: number | null, base: string): Promise<string | null>`; `pay.ts` `payLinkSession(ref: string, base: string): Promise<string | null>` and `sendCardPaymentLinks(refs: string[], v: Viewer): Promise<{ queued: number }>`; `refunds.ts` `refundDonation(ref: string, amountMinor: number | null, v: Viewer): Promise<ActionResult>` (returns `unavailable` without Stripe).
- **AI and Zoom stubs:** `ai/provider.ts` `textModels(): TextModel[]` (`[]`), `imageModel(): ImageModel | null` (`null`), `aiAvailable(): boolean` (`false`); `ai/assist.ts` `assist(req: { kind: 'tighten' | 'warmer' | 'shorter' | 'title' | 'excerpt'; text: string }): Promise<{ kind: 'ok'; text: string } | { kind: 'off'; message: string }>`; `ai/monthly.ts` `runMonthlyDraft(opts: { force?: boolean; month?: string }): Promise<{ created: string | null; reason?: string }>` (stub returns `{ created: null, reason: 'not_built' }`; I4 implements); `ai/cover.ts` `generateCover(postId: string): Promise<{ mediaId: string } | { kind: 'off' }>`; `zoom/meetings.ts` `createZoomMeeting(…): Promise<{ joinUrl: string } | null>` (null without `ZOOM_*`).
- **Integration status:** `integrationStatuses()` (env-only), `checkIntegration()` (env-only for now; I6 adds probes), `practiceRibbon()`.
- **Practice mode:** every dev route starts with `devOnly()` (F1); `dev/session.ts` `devSignInAs(role: Role): Promise<void>`; `dev/seed.ts` `ensurePracticeSeed(opts?: { reset?: false }): Promise<SeedReport>` (idempotent via `settings/seed`): one account per role `<role>@haven.test` (+ staff docs, timezones, notification prefs), settings docs (`payment` with GMD local default, `org`, `notifications`, `forms`, `retention`), and `isSample: true` records: 8 support requests across categories and statuses (2 counselling), 3 concerns (random refs, sealed narratives, varied risk), 4 appointments, 10 donations (pledged, received, acknowledged, allocated; 2 in-kind), 2 recurring gifts, 4 volunteer applications, 3 partnership enquiries, 6 contact messages, 3 report requests (one unlisted), 4 newsletter subscribers (one unconfirmed), 2 story submissions, 3 referral partners, 3 sponsor profiles (one draft), 2 resources (one public with a tiny generated PDF at `public/resources/...`, one controlled), `causeTotals` for 3 causes, notifications. `ensurePracticeSeed()` also runs lazily on the first local sign-in. `scripts/dev/seed.mjs --base http://localhost:3001` calls `POST /api/dev/seed`.
- **Selftest:** `dev/selftest.ts` runner + real suites `{store,refs,seal,outbox,auth,workflow}` (the other suite stubs belong to F3, F5 and Phase I). `GET /api/dev/selftest?suite=<name>` returns `{ suite, passed, failed, cases[] }`. `scripts/qa/data-selftest.mjs --base <url>` runs all suites.
- **Rules files:** deny-all `firestore.rules` and `storage.rules`, the index list from data-model §7.3 (+ indexes for D83 queries), `firebase.json`, `storage.cors.json`.

**Acceptance (F2):**
- `node scripts/qa/data-selftest.mjs --base http://localhost:3001` → suites store, refs, seal, outbox, auth, workflow all pass: create conflict, transaction atomicity, **gap-free refs under 20 concurrent creates**, cursor paging, `in` and `array-contains`, `count`, `MissingIndexError`, recursive delete, `*At` round trip, seal/open with wrong AAD fails, outbox enqueue → `held` + mailbox file, subject with a name in it rejected, a support edge transition writes event + audit in one transaction.
- `node scripts/dev/seed.mjs --base http://localhost:3001` twice: first run reports created counts per collection; second run reports zero created.
- `curl -s -X POST "http://localhost:3001/api/dev/session?role=finance_officer" -c jar` sets `haven_session`; `GET /api/dev/selftest?suite=auth` with that jar shows `getViewer().roles = ['finance_officer']`.
- grep for a seeded concern's narrative sentence in `.data/db` → 0 hits (sealed).
- `HAVEN_BACKEND=firestore` without credentials → boot log says Firestore credentials are missing (no crash of public pages); `tsc` compiles `firestore.ts`, `gcs.ts`, `firebase.ts`.

### 5.3 F3 — Content and media (wave 2)

**Owns:** `lib/content/{schema,types,registry,access,inline,defaults,store,resolve,read,public,search,actions,post-actions,media-actions,gate,diff,posts,launch}.ts`; `lib/media/{pipeline,index}.ts`; `lib/seo/meta.ts`; `content/seed/**`; `lib/server/dev/suites/content.ts`; `app/api/dev/content/route.ts`; edits to legacy `content/home.ts` (re-export `img/video/poster` from `lib/media/pipeline` and `Currency` from `lib/model/enums`; nothing else).

**Build** (content-model §3–§7 with D37–D62):
- **Schema** (`schema.ts`, zod 4, every post-launch field with `.default()`, layout limits as schema limits): every `DocId` and `CollectionName` from `lib/content/ids.ts`; primitives (`MediaRef`, `Cta { label, to: RouteKey }`, `InlineText`, `HeadingLines`, `SectionHeader`, `Seo`, `Verification` (Millis), `Consent` (D53 vocabulary), `StoredRecord<T>` without `editLock`); `Programme` (D41), `Cause` (D37–D39), `Stat` (D45), `Story` (D50), `Testimonial`, `TeamMember` (D50), `Faq` (D49), `Partner`, `Project` (D50), `Post` (D42), `Policy` (D50), `MediaAsset` (D53), `AllocationSummary` (D57), `Block` union (content-model §7.2), `PageDoc` (D52: `{ hero: { eyebrow?, title: HeadingLines, intro?, media?: MediaRef }, seo: Seo, sections: Record<string, { eyebrow?, title?: HeadingLines, body?: Block[], items?: Array<{ title: string; text?: InlineText; icon?: string }>, cta?: Cta }> }`), settings docs with D51 additions, `home.finalCta` (`{ visible: boolean; title; text; buttons: Cta[] }`, default `visible: false`), `settings.editorial` (D48). Exports `DocSchemas`, `ItemSchemas`, `DocData<K>`, `Item<C>`.
- **Types** (`types.ts`): `Resolved<T>`, `ResolvedImage` (= `UiImage` + `assetId`), `ResolvedVideo`, `ResolvedStat`, view-models `SiteChrome`, `HomeView`, `PostCard`, `CauseView`, `ResolvedProgramme`, `ResolvedPost`, `ResolvedStory`, `PageView`.
- **Registry and access:** `DOCS`, `COLLECTIONS` (label, schema, edit roles, field groups per content-model §5.3 + D85, tags, previewPath, publishGate); `canEditDoc(roles, id)`, `canEditCollection(roles, c)`, `deniedPaths(roles, spec, changedPaths)`.
- **Store:** `contentStore()` over `getStore()`: singletons `siteContent/{docId}`, items in their collections, `versions` subcollection (keep 20), `mode: Backend` (D33).
- **Seeds:** `content/seed/{site,home,donate,programmes,causes,stats,stories,team,testimonials,faqs,partners,projects,posts,policies,allocation,resources,media-meta,index}.ts` and `content/seed/pages/<key>.ts` for every `pages.*` id. Values verbatim from today's `content/*.ts` and hard-coded component copy (content-model §3.7); `// CLIENT` values flagged `placeholder: true`. Causes: `general` + six programme causes (D40) + today's eight appeals + `sponsor-a-child`. Stats: D45 set. Posts: three published placeholders from `content/people.ts → news`. Projects: three from `content/home.ts → projects` with slugs. Policies: three drafts (`lastReview` not professional). Resources: one placeholder "Annual report 2025" (D6). Pages: draft copy from public-pages §3 per page. Dev parses every default at module load and throws loudly.
- **Read path:** `read.ts` exactly as the contracts audit's list (getContent, getCollection, getSiteSettings with `year` and `yearsOfService` (D15), getSiteChrome, getHomeContent, getStats, getProgrammes/getProgramme, getCauses/getCause (raised per D38 using `getCauseTotals` from the F1 stub `lib/server/public/totals.ts`), getPosts/getLatestPosts/getPost/getAdjacentPosts/getPublishedPostSlugs, getStories, getTestimonials, getTeam, getFaqs, getProjects/getProject, getPolicies/getPolicy, getPage(key), getAllocationSummary, getDonateConfig) + `resolve.ts` + merge-over-defaults + `reportInvalid`. Firestore mode + build-time read failure → throw (never bake seeds into production by accident).
- **Façade:** `public.ts` re-exports the read functions and `getCauseTotals`, `getPaymentSettings`, `getResources`, `getResource`, `getSponsorProfiles` (from `lib/server/public/*`) and `searchSite` (from `search.ts`). Pages import nothing else for data.
- **Dev content route:** `POST /api/dev/content` (`devOnly()`): `{ id: DocId, data, publish?: boolean }` saves and optionally publishes a singleton through the store and revalidates its tags; `{ action: 'aiDraft' }` calls `createAiDraft` with a sample brief. Later packages use it in acceptance checks.
- **Search stub:** `search.ts` `searchSite(q: string, limit?: number): Promise<SearchHit[]>` returns `[]`; `SearchHit = { type: 'programme' | 'page' | 'resource' | 'news' | 'story' | 'faq' | 'cause' | 'project'; title: string; snippet: string; href: string }`. P1 implements.
- **Write pipeline (complete):** every signature from the contracts audit, split per D139: `actions.ts` (`saveDoc`, `discardDraft`, `restoreDocVersion`, `saveItem`, `setItemVisibility`, `reorderItems`, `deleteItem`, `confirmPlaceholder`, `publishAll`, `exitPreview`), `post-actions.ts` (`submitPost`, `requestChanges`, `approvePost`, `unpublishPost`), `media-actions.ts` (`createMediaAsset`, `replaceMediaFile`, `updateMediaMeta`, `withdrawConsent`), implementing the eight-step pipeline (content-model §5.2) with `requireStaff`, field groups, `gate.ts` (consent/permission/allocation/review/policyReview and the D46 stat rule), `diff.ts`, audit (D93), versions and `updateTag`. Media actions read `mediaUploads/{uploadId}` and move blobs with `getBlobStore()`; the upload route that writes `mediaUploads` is A7's.
- **Posts and launch:** `posts.ts` `createAiDraft(post, actor)` and `publishDuePosts(now?)`; `launch.ts` `getLaunchReadiness(): Promise<LaunchItem[]>` (D130).
- **Media:** `pipeline.ts` (img/video/poster/ref, `pipelineAssets()` from media-map + media-credits + `content/seed/media-meta.ts`; relative imports only), `index.ts` (`getMediaIndex()` cached with tag `media`; `readMediaIndexUncached()`; `mediaUrl()`; `isIllustrative()`); add the `fallback-warm` image id (reuse an existing warm non-people pipeline image; no new generation).
- **SEO helper:** `lib/seo/meta.ts` `buildMetadata(i: { title: string; description: string; path: string; image?: string; noindex?: boolean; type?: 'website' | 'article' }): Metadata`.

**Acceptance (F3):**
- `npx tsc --noEmit` clean for F3 files; eslint clean on `lib/content lib/media lib/seo content/seed`.
- `GET /api/dev/selftest?suite=content`: every default parses; `getHomeContent()` deep-equals today's landing values (spot list: hero slide count, appeals count and currencies, FAQ count, team count); `saveDoc('home.impact', intent:'draft')` leaves `getContent` published value unchanged; publish changes it; stale `baseVersion` → `conflict`; content_manager editing a cause `goal` → `forbidden` with paths; a stat value change without verification → `blocked`.
- `getPublishedPostSlugs()`, `getProjects()`, `getProgrammes()`, `getCauses()`, `getPolicies()` and resources defaults are non-empty (D6).
- `node --experimental-strip-types -e "import('./lib/media/pipeline.ts')"` loads (relative-import rule).

### 5.4 F4 — UI kit (wave 2)

**Owns:** `app/globals.css`; `components/ui/**` (existing files edited + new); `components/ui/form/**`; `components/ui/cards/**`; `components/art/BrushEdge.tsx`; `components/layout/{PageHero,CtaBand,FormShell,PolicyShell,SkipLink,NotFoundBody}.tsx`; `components/seo/JsonLd.tsx`.

**Build** (design-system §1.8, §2, §3, §6 with D116–D124; public-pages §2.2–2.4 behaviour; admin-ux §9.2 props merged):
- **Tokens and CSS:** design-system §1.8 additions + `--color-restricted-soft` + `--shadow-dock` (D116), `.prose-haven`, skeleton keyframes, `scroll-padding-top` (D124), view-transition base CSS, reduced-motion rules.
- **Existing edits:** `Button` (variants `marigold-ink`, `coral-ink`, `danger`; `loading`; `block`), `Eyebrow` (`tone`), `AutoVideo` (pause in effect cleanup, next16 §2.2 item 6).
- **New primitives** (signatures from the contracts audit with D27, D95, D121, D123 applied): `Section`, `SectionIntro`, `Breadcrumbs` (heart separators, BreadcrumbList JSON-LD via `JsonLd`), `RiseWords` (extracted from Hero without changing Hero yet), `Prose`, `Notice`, `QuickExit` (D95), `Badge`, `StatusPill` (reads `lib/model/status-meta.ts`), `ToastProvider`/`useToast` (in-house, action + duration for Undo), `Sheet` (native `<dialog>`, right/bottom/auto, `dirty` guard), `Modal`/`ConfirmDialog`, `EmptyState` (doodle art), `Skeleton` (+ `SkeletonCard`, `SkeletonRow`, `SkeletonHero`), `Spinner`, `Timeline` (`process` | `activity`), `Tabs`, `Accordion` (`card` | `flush`), `IconButton`, `IconDisc`, `Avatar` (staff only), `ArrowLink`, `AnchorLink`, `SearchField`, `DataList`, `Pagination` + `LoadMore`, `Toc`, `ShareRow`, `AllocationBar`, `ImageCredit`.
- **Form kit:** `Field`, `Fieldset`, `Input`, `Textarea` (counter), `Select`, `Checkbox`, `Radio`, `RadioCards` (+ `CheckCards`, `ChoiceCards` aliases), `Segmented`, `Chips`, `SubmitButton`, `ErrorSummary`, `FormSuccess`, `Honeypot`, `CountrySelect` (D73: all ISO, `priority` prop), `PhoneInput`, `FileDrop` (posts one file per request to a given `uploadUrl`, shows progress, client downscale for images), `Stepper` + `components/ui/form/useStepper.ts`, `MoneyField`, `Turnstile` (**stub**: renders `null`; I7 fills). Skins `donat | vu`; density `default | admin`; 16px inputs; visible labels; `aria-describedby`; reads `FormState`.
- **Cards** (primitive props, D27; markup copied from the landing sections so P2 can adopt them pixel-identically): `Card`, `ProgrammeCard`, `ServiceCard`, `CauseCard`, `ArticleCard`, `UpdateCard`, `ResourceCard`, `StoryCard`, `PersonCard`, `StatCard` (`size: 'lg' | 'sm'`), `ActionCard`, `ProjectCard`.
- **Layout pieces:** `PageHero` (5 variants), `CtaBand` (3 variants), `FormShell`, `PolicyShell` (Toc + Prose + meta), `SkipLink`, `NotFoundBody` (public-pages §3.23 copy, search input, 4 buttons), `BrushEdge`, `JsonLd` (escaped `<`).

**Acceptance (F4):**
- `npx tsc --noEmit` clean for F4 files; `npx eslint components/ui components/art/BrushEdge.tsx components/layout components/seo` clean.
- No component under `components/ui/**` imports `lib/content/**` or `lib/server/**` (eslint rule passes).
- No gallery page is added; the kit is exercised by F5's shells and Phase P pages. F4's final report lists every component with its exported props.
- Contrast: every functional text/background pair used by the kit meets WCAG AA (design-system §6.1 table); marigold buttons carry night text in the `marigold-ink` variant.

### 5.5 F5 — Shells, admin chrome and integration (wave 3)

**Owns:** `app/layout.tsx`; `app/not-found.tsx`; `app/global-error.tsx`; `app/opengraph-image.tsx` (day-0 fix); `app/sitemap.ts`, `app/robots.ts` (minimal, no `new Date()`); `app/(site)/{layout,page,error,not-found,actions}.tsx|ts`; delete `app/page.tsx` (moved); `app/admin/layout.tsx`; `app/admin/(desk)/{layout,loading,error,not-found}.tsx`; `app/admin/(desk)/page.tsx` (**placeholder Today**, A1 replaces); `app/admin/{login,login/code,confirm,locked}/**`; `app/m/[...path]/route.ts`; `components/layout/{SiteChrome,Header,Footer}.tsx` (props + day-0 only); `components/sections/Founder.tsx` (day-0 prop only); `lib/motion/RouteScrollReset.tsx`; `lib/motion/SmoothScroll.tsx` (no behaviour change; only if needed for the move); `components/layout/ActiveNavMarker.tsx`, `components/layout/MobileMenuCloser.tsx`; `components/content/{Blocks,PreviewBanner,StudioSlot,StudioBridgeSlot,StudioBridge}.tsx` (`StudioBridge` is a no-op stub for A7); `components/analytics/SiteAnalytics.tsx` (stub returning `null`, I7 fills); `components/admin/shell/**`; `components/admin/ui/{StatusStepper,ListRow,Masked,Composer,PersonPicker,KpiTile,MediaPicker}.tsx`; `components/admin/auth/**`; UI seam stubs `components/admin/records/{SupportView,GiftView,InKindView,SessionView,ReportRequestView,VolunteerView,PartnerView,MessageView,StoryView}.tsx` and `components/admin/sheets/{RecordGiftSheet,LogRequestSheet,LogConcernSheet,PostUpdateSheet,WriteArticleSheet,BookSessionSheet,AddNoteSheet,AddReportSheet,UploadMediaSheet,InviteSheet}.tsx`; `lib/client/firebase.ts`; `lib/server/dal/{_shared,records,timeline,search,dashboard,activity,notifications}.ts`; `lib/server/public/{settings,totals,resources,sponsors}.ts` (implements the F1 stubs); `lib/server/dev/suites/rbac.ts`; `scripts/qa/rbac.mjs`.

**Build:**
- **Root and site layouts** (next16 §3, D1, D7–D10, public-pages §1.5): root keeps html/body/fonts/globals/noscript; `generateMetadata` from `getSiteSettings()`; `SmoothScroll` moves into `(site)/layout.tsx`; `(site)/layout.tsx` = `SkipLink` + `SmoothScroll` + `ToastProvider` + `SiteChrome chrome={await getSiteChrome()}` + `<Suspense fallback={null}><RouteScrollReset/></Suspense>` + `<Suspense fallback={null}><PreviewBanner/></Suspense>` + `<Suspense fallback={null}><StudioBridgeSlot/></Suspense>` + `SiteAnalytics`. No `cookies()`/`headers()`.
- **Landing move:** `app/page.tsx` → `app/(site)/page.tsx` without Header/Footer/ScrollTop/`<main>`; pass `yearsOfService` to `Founder` (D15). Sections otherwise unchanged (P2 does the props refactor).
- **Chrome:** `SiteChrome` (Header + `<main id="main" tabIndex={-1}>` + Footer + ScrollTop + footer illustrative notice when `chrome.anyIllustrativeInUse`); Header and Footer accept `chrome` props (Footer year from props), keep today's visuals and links (P1 rebuilds them); `ActiveNavMarker` and `MobileMenuCloser` leaves in Suspense (D4).
- **Day-0 fixes** (next16 §2.2): Footer year, Founder years, OG `readFile` at module scope, sitemap without `new Date()` (lists `/` only until P8).
- **Content components:** `Blocks.tsx` renders every `Block` kind with `Prose`, headings with ids (TOC), `InlineText` via `lib/content/inline.ts`, images via `next/image` + `ImageCredit`, video only as youtube-nocookie iframe; `PreviewBanner` (draftMode, `exitPreview` button); `StudioSlot` (always `<div data-studio-slot={id} style={{display:'contents'}}>`, no runtime read); `StudioBridgeSlot` (server leaf: draftMode on → `<StudioBridge/>`).
- **`/m` route** (D98): `public/` prefix only; asset status lookup for `public/media/{mediaId}/…` → 410 when withdrawn; headers per D98; streams through `getBlobStore()`.
- **Admin frame** (D2–D3, D9, D84, D117, D125, D135): `app/admin/layout.tsx` (metadata noindex, title template, `manifest: '/admin.webmanifest'`, admin canvas, `--focus: forest`, SkipLink); `(desk)/layout.tsx` = `<Suspense fallback={<AdminShellSkeleton/>}><ShellWithViewer>{children}</ShellWithViewer></Suspense>` where `ShellWithViewer` awaits `getViewer()` (redirects to login when null) and renders `AdminShell` with `toShellViewer(v)`, `placesFor`, `practiceRibbon()`; `loading.tsx` skeleton; `not-found.tsx` = `NoAccess`; `error.tsx` with "Please refresh, we've updated the site" for stale actions.
- **Shell components** (admin-ux §3, contracts audit props): `AdminShell` (TopBar ≥ 1024, BottomDock < 768, ribbons, SheetHost, ToastProvider, 30 s pulse polling of `/api/admin/pulse` when visible — the route is A1's; until then the shell tolerates 404), `TopBar`, `BottomDock`, `PageHeader`, `SplitView`, `SheetHost` (`?do=` in Suspense; registry imports the ten sheet stubs), `NoAccess`, `PracticeRibbon`, `RestrictedBanner`, `AdminShellSkeleton`.
- **Admin primitives:** `StatusStepper`, `ListRow`, `Masked` (reveal via a passed Server Action that audits), `Composer` (notes, calls, emails; offline-safe draft in sessionStorage for non-sensitive notes only), `PersonPicker`, `KpiTile` (= `StatCard size="sm"`), `MediaPicker` (props: `items: MediaPickerItem[]`, `value`, `onChange`, `uploadHref?`, `requireConsentFor?: 'child'`).
- **Auth UI** (data-model §9, admin-ux §6.1, D86–D90): `/admin/login` (static shell + client form; mode prop from server: local → Server Action `signIn`; firebase → `lib/client/firebase.ts` sign-in → `/api/auth/session`; practice chips per D90 calling `signInAsRole`; "Create the first super admin" form per §4.4), `/admin/login/code` (TOTP resolver), `/admin/confirm` (step-up re-auth, updates `authTime`), `/admin/locked` (idle unlock), sign-out action + full reload. `lib/client/firebase.ts`: `getFirebaseAuth(): Auth | null` from `NEXT_PUBLIC_FIREBASE_*`, `firebase/app` + `firebase/auth` only.
- **Cross-area DAL stubs with real minimal behaviour:** `_shared.ts` (`maskEmail`, `maskPhone`, `loadForViewer`, page helpers), `records.ts` (`findByReference`, `listInbox` returning `[]` until A2), `timeline.ts` (`listTimeline` from events), `search.ts` (`searchAll` refs-only), `dashboard.ts` (`getPulse`, `getDashboard` with real `count()` per permitted collection), `activity.ts` (`listActivity` basic), `notifications.ts` (`listNotifications`, `markRead`). Every function calls `requireStaff` first and returns DTOs field by field.
- **Public system readers:** `settings.ts` (`getPaymentSettings`, `getOrgSettings`, `getFormsSettings`; defaults when absent), `totals.ts` (`getCauseTotals` from `causeTotals`), `resources.ts` and `sponsors.ts` (seed-backed defaults: `getResources`, `getResource`, `getSponsorProfiles` returning published profiles; P7 completes). All `'use cache'` + `cacheLife('content')` + tags.
- **Practice wiring:** the first local sign-in calls `ensurePracticeSeed()`; RBAC selftest suite `rbac.ts` exercises `requireStaff` for each seeded role against representative permissions; `scripts/qa/rbac.mjs --base <url>` signs in per role via `/api/dev/session` and asserts `/admin` 200, `/admin/safeguarding` 404 for non-SO roles (the page does not exist yet, so 404 for all is acceptable until A3; the script's A3 assertions are behind `--phase a`).

**Acceptance (F5) = Phase F gate (lead runs the build):**
1. `npx tsc --noEmit` and `npm run lint` clean across the repo.
2. Lead: `npx next build` → zero blocking-prerender errors; `npx next start -p 3100`.
3. Landing unchanged: `shoot.mjs --url http://localhost:3100/` at 1440×900 and 375×812 matches the baseline section by section; `hero-frames.mjs` and `donate-flow.mjs` pass; `a11y.mjs` shows no new violations; GSAP pins rebuild after navigating `/` → `/nope` → back.
4. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/nope` → 404 with Header, Footer and the 404 copy.
5. `curl -sI http://localhost:3100/` has the D113 headers; `/admin/login` has `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`.
6. `data-selftest.mjs`, `seed.mjs` (idempotent) and `rbac.mjs` pass against port 3100.
7. In a browser: `/admin` → login; sign in with `LOCAL_ADMIN_*` → Today placeholder inside the shell with the sand practice ribbon; chips sign in as each role and the pill/dock places differ per `placesFor`; sign-out does a full reload; `/admin` at 360px shows the bottom dock and no horizontal scroll.
8. `GET /m/public/resources/<seeded>.pdf` → 200 `application/pdf`.

---

## 6. Build phases after F

**How to read a package:** *Owns* lists the files the package may create or edit in that phase (directories include everything below them). Everything else is **read-only**. F-owned contracts (`lib/model/**`, `lib/forms/**`, `lib/schemas/common.ts`, `lib/routes.ts`, `lib/cache/tags.ts`, `lib/content/{ids,schema,types}.ts`, `lib/server/db/**`, `lib/server/auth/session.ts`, `components/ui/**`, `app/globals.css`, …) are read-only in every later phase unless a package lists them. If you need a change in a file you do not own, do not edit it: put the exact request (file, change, reason) in your final report, and work around it with a local composite in your own files.

**Standard verification for every package** (in addition to its own list):
```
npx tsc --noEmit                       # zero errors in your owned files (report others' errors, don't fix them)
npx eslint <your owned paths>          # clean
curl / scripts against http://localhost:3001 (the lead's dev server). Check the page <title> contains "Haven" before trusting a port.
```

### 6.1 Phase P — Public site (8 packages, parallel)

#### P1 — Chrome, navigation and search
- **Owns:** `components/layout/{Header,Footer,FooterGiantText,MobileMenu,NavDropdown,SearchOverlay,Ticker,ScrollTop,MegaPanel,ActiveNavMarker,MobileMenuCloser}.tsx`, `lib/nav.ts`, `lib/content/search.ts`, `app/api/search/route.ts`, `app/(site)/search/**`, `content/seed/site.ts`, `content/seed/pages/{search,notFound}.ts`.
- **Build:** public-pages §5.1–5.6 (real routes, split-button dropdowns, short labels 1280–1399px, Programmes mega panel only per D126, mobile menu with close-on-navigate leaf, footer columns from `buildFooterLinks`, safeguarding row, offices and contact from `settings.contact`); design-system §4.2–4.3 visuals; active state via `ActiveNavMarker` + `aria-current` (D4); `searchSite()` index (titles, summaries, headings of programmes, pages, causes, posts, stories, FAQs, projects, public resources; never private collections) (D115); `GET /api/search?q=` top 8 grouped; overlay (200 ms debounce, chips → links per public-pages §3.22); `/search?q=` (noindex, empty and no-result states).
- **Acceptance:** `node scripts/qa/nav-fit.mjs --url http://localhost:3001/` passes 1280–1440; every href produced by `buildMainNav`/`buildFooterLinks` is a real route (list them in the report; P gate's `links.mjs` checks 200); on `/programmes/education` the Programmes item has `aria-current="page"`; `curl -s "http://localhost:3001/api/search?q=school"` returns an Education programme hit and no `HVN-` references; `/search?q=zzzz` shows the empty state with chips; the mobile menu closes on navigation, Esc closes it and focus returns to the trigger; landing header screenshots unchanged at 1440 and 375 except intended link targets.

#### P2 — Landing page: props, cards, retargets
- **Owns:** `app/(site)/page.tsx`, `components/sections/**` **except** `Donate.tsx` and `Appeals.tsx`, `components/public/home/**`, `content/seed/home.ts`, `content/seed/media-meta.ts`.
- **Build:** content-model §4.7–4.8 props refactor (each section takes props from `getHomeContent()` with the same variable names; JSX bodies untouched); adopt F4 cards (ProgrammeCard, StatCard, ArticleCard/UpdateCard, StoryCard, ActionCard, ProjectCard, Accordion) without visual change; public-pages §6 retargets through `routeHref`/`routes`; a `StudioSlot` around every section (id = its doc id); `ImageCredit` where illustrative except the hero (D54); stats by id (D45); News from `getLatestPosts(3)`; `home.finalCta` rendered only when `visible` (D128); JoinSphere's form calls `subscribe` from `app/(site)/actions.ts`; no section imports legacy `content/*.ts`.
- **Acceptance:** `shoot.mjs --url http://localhost:3001/` at 1440×900 and 375×812 match the F baseline (any pixel difference explained in the report); `hero-frames.mjs` matches; `grep -rE "@/content/(home|people|programmes|site|nav)" components/sections "app/(site)/page.tsx"` returns nothing; every landing CTA href is a real route; with `home.finalCta.visible = true` (set through `POST /api/dev/content`) the band renders with three buttons, and after setting it back to false nothing renders; editing `home.impact` the same way changes the Impact heading on the next request.

#### P3 — Donate experience
- **Owns:** `app/(site)/donate/(give)/**`, `app/(site)/donate/thank-you/**`, `components/donate/**`, `components/sections/{Donate,Appeals}.tsx`, `lib/donate-intent.ts`, `app/api/donations/route.ts`, `lib/server/giving/{ledger,donors,intents,pledge,thanks}.ts`, `lib/server/intake/donation.ts`, `content/seed/{causes,donate}.ts`, `content/seed/pages/{donate,thankYou}.ts`, `scripts/qa/donate-flow.mjs`, `scripts/qa/forms/donation.mjs`.
- **Build:** public-pages §4.1–4.10: URL grammar (`parseDonateQuery`), `(give)` layout with the sticky, persistent `DonateWidget` (cash and in-kind, presets per currency from `donate.config`, frequency, cover fees, donor details, `submissionId`, `_elapsed`, honeypot, attribution from UTM), `CausePicker`, `AllocationPanel` (D56, "received so far / put towards" from totals when verified), `ImpactExamples`, other ways to give, donate FAQ (placement `donate`), mobile sticky bar, OG image per cause, `/donate#causes` list; integrations §3.2 routing, §3.11 pledges (DN ref, `pledge_instructions`, donor upsert by `emailHash`, updates consent), Stripe branch calls `startCheckout` and falls back to pledge when it returns `null`; `donationIntents` written before calling Stripe (D67); thank-you variants (pledge with instructions via signed `t`, in-kind, Stripe paid/processing read from intents, generic) and D70 copy; landing `Donate.tsx` becomes `DonateWidget variant="landing"` and `Appeals.tsx` uses `CauseCard` + `requestDonation`; D37–D40, D63–D67, D71.
- **Acceptance:** `/donate`, `/donate/education`, `/donate/eid-clothes-gifts?mode=in-kind` render; switching cause keeps the entered amount (no remount); `curl -X POST /api/donations` (cash, USD 50, monthly, no Stripe key) → `{ kind: 'pledge', next }`, a `HVN-DN-2026-NNNN` donation `pledged`, a donor keyed by `emailHash`, outbox `pledge_instructions~HVN-DN-…` with status `held`, and a mailbox file; in-kind POST → `inkind_follow_up` held; a GMD gift pledges even with a Stripe test key set; honeypot → fake success, no record; 11th POST in an hour → rate-limited error; thank-you with a tampered `t` shows the generic variant; `/donate/xyz-unknown` → 404; `node scripts/qa/donate-flow.mjs --url http://localhost:3001/` passes; `node scripts/qa/forms/donation.mjs --base http://localhost:3001` passes.

#### P4 — Help, safeguarding and contact forms
- **Owns:** `app/(site)/get-support/**`, `app/(site)/report-a-concern/**`, `app/(site)/contact/**`, `app/api/uploads/route.ts`, `lib/schemas/forms/{support,concern,contact}.ts`, `lib/server/intake/{support,concern,contact,upload}.ts`, `components/public/help/**`, `content/seed/pages/{getSupport,requestSupport,reportConcern,contact}.ts`, `scripts/qa/forms/{support,concern,contact}.mjs`.
- **Build:** public-pages §3.5–3.8 (hub; multi-step request form with category extras, `?type=` prefill, counselling scheduling preferences; concern form with calm hero, QuickExit, anonymous mode; contact with the concern redirect and the privacy link D104); data-model §4.2 (sealed explanation), §4.2.2 (random ref, sealed narrative, alert list, re-alerts queued with `scheduledFor`), §10 pipeline (D94) and uploads (D96: magic bytes, sharp re-encode, quarantine, HMAC upload tokens, ≤ 4 MB, ≤ 5 files); D79–D82, D108–D109; emails `support_confirmation`, `concern_alert` (+ re-alerts), `concern_reporter_confirmation` (conditional), `contact_confirmation`, `staff_alert` via notify routes; no drafts and a `beforeunload` guard on support and concern (D95).
- **Acceptance:** support submit → `HVN-SR-2026-NNNN` on screen, explanation sealed (grep of the text in `.data/db` → 0); `immediateDanger=yes` → **no** `supportRequests` doc, one `safeguardingConcerns` doc (`source: moved_from_support`), identical success screen, `concern_alert` queued, no concern detail in any notification title; anonymous concern → `HVN-XXXX-XXXX` on screen and no reporter email unless method email + `emailConfirmationAllowed`; honeypot concern → kept with `suspectedSpam: true`; a 5 MB upload rejected; a PNG with GPS EXIF stored without EXIF; an `.exe` renamed `.pdf` rejected; Shift ×3 on `/report-a-concern` navigates away with no sessionStorage keys left; `node scripts/qa/forms/{support,concern,contact}.mjs --base http://localhost:3001` pass (subjects match template patterns).

#### P5 — About, programmes, FAQ, policies, privacy requests
- **Owns:** `app/(site)/{about,programmes,faq,policies,privacy}/**`, `lib/schemas/forms/dataRequest.ts`, `lib/server/intake/dataRequest.ts`, `components/public/{about,programmes,faq,policies}/**`, `content/seed/{programmes,team,faqs,policies,partners}.ts`, `content/seed/pages/{about,programmes,faq,policies,privacyRequest}.ts`, `scripts/qa/forms/dataRequest.mjs`.
- **Build:** public-pages §3.2–3.4, §3.20–3.21; content-model §8 nine-part programme page (seed copy in §8.2 style for all six), notice mapping (D41), eligibility lists, request CTA `routes.request(category)`, donate CTA `routes.donate(slug)`, partner CTA; programme OG images; team `Sheet` with languages and bio (D50); where-we-work map reuse; FAQ group pills (D49); policies with `PolicyShell`, heading-block TOC, review banner, optional PDF (D50); `/privacy/request` + verify page + `data_request_verify` (D104).
- **Acceptance:** the six programme URLs and their OG images return 200; `/programmes/foo` → 404; each programme shows its emergency notice and two eligibility lists, and its CTAs point to `/get-support/request?type=…` and `/donate/<slug>`; `/policies/safeguarding` shows the review banner and a TOC; `/privacy/request` submit → `HVN-DR-2026-NNNN` + `data_request_verify` held; following the verify link sets the request `verified`; `/faq` pills filter; the team drawer traps and restores focus.

#### P6 — News, stories, projects, impact
- **Owns:** `app/(site)/{news,stories,projects,impact}/**`, `lib/schemas/forms/story.ts`, `lib/server/intake/story.ts`, `components/public/{news,stories,projects,impact}/**`, `content/seed/{posts,stories,testimonials,projects,stats,allocation}.ts`, `content/seed/pages/{news,stories,shareStory,projects,impact}.ts`, `scripts/qa/forms/story.mjs`.
- **Build:** public-pages §3.12–3.15; `/news` (9 per page, category filter, `UpdateCard` for updates D43), `/news/[slug]` (Blocks, reading time, related, OG), RSS route (`'use cache'`); stories as picture-and-paragraph with anchors and copy-link; `/stories/share` → `storySubmissions` + `story_acknowledgement` (D58); projects index/detail with gallery and verified outcomes only (D50); `/impact`: the D45 stat set with D46 behaviour, `AllocationSummary` "where the money went" (D57), map, projects, stories, report link.
- **Acceptance:** `/news` lists the three seeded posts; `/news/rss.xml` parses as RSS 2.0 with three items; `/news/<seed-slug>` and its OG image return 200; `/projects/<each seeded slug>` 200; `/impact` shows "Illustrative" on unverified stats and hides them when `settings.site.figures.hideUnverified` is true (set through `POST /api/dev/content`); story submit → `HVN-SS-2026-NNNN` + email held; `/stories/anything` → 404.

#### P7 — Get involved, resources, reports, newsletter
- **Owns:** `app/(site)/{get-involved,resources,request-a-report,unsubscribe,newsletter}/**`, `app/(site)/actions.ts`, `app/api/resources/[slug]/download/route.ts`, `app/r/[token]/route.ts`, `lib/schemas/forms/{volunteer,partnership,reportRequest,newsletter}.ts`, `lib/server/intake/{volunteer,partnership,reportRequest,newsletter}.ts`, `lib/server/public/{resources,sponsors}.ts`, `components/public/{involved,resources}/**`, `content/seed/resources.ts`, `content/seed/pages/{getInvolved,volunteer,partner,sponsor,resources,requestReport}.ts`, `scripts/qa/forms/{volunteer,partnership,reportRequest,newsletter}.mjs`.
- **Build:** public-pages §3.9–3.11, §3.16–3.19, §3.23 (unsubscribe); data-model §4.4–4.5 (volunteer, partnership, newsletter double opt-in D103, resources, report requests incl. D59); resources library (12 per page, URL filters, public download D101, controlled → request); `/r/[token]` delivery (verify HMAC, 302 to a 60-s signed URL, expired page); sponsorship profiles (D55; published only; no names, precise places or medical history; `?ref=` deep link to `/donate/sponsor-a-child?ref=`); the landing `subscribe` action.
- **Acceptance:** volunteer → `HVN-VA-…` + `volunteer_acknowledgement` held; partner → `HVN-PE-…`; report request for a listed and an "Other / not listed" report → `HVN-RR-…` with `resourceId: null` and `requestedTitle`; subscribe → `newsletter_confirm` held and the subscriber unconfirmed; the confirm link confirms; `/unsubscribe?token=` unsubscribes and Undo re-subscribes; `/resources/annual-report-2025` shows the request path; `GET /api/resources/<public-slug>/download` → 302 to `/m/public/resources/…` and `downloadCount` +1; `/get-involved/sponsor` lists only published profiles; `/r/garbage` → expired page, not 500.

#### P8 — SEO, sitemap, metadata, motion polish
- **Owns:** `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `app/globals.css`, `components/seo/**`, `lib/motion/**`, `scripts/qa/links.mjs`.
- **Build:** public-pages §7 (metadata audit of every page's `generateMetadata`, reported as change requests to the owning packages; root Organization/NGO JSON-LD in `app/layout.tsx`; `components/seo/{OrgJsonLd,ArticleJsonLd,FaqJsonLd}.tsx` for the Q phase to adopt, while Phase P pages use the F4 `JsonLd` directly), sitemap from cached getters with `updatedAt` (Millis → ISO), robots per D114, social image check (WhatsApp/Twitter sizes), §2.7 motion (`<ViewTransition>` crossfade, reduced-motion audit), `RouteScrollReset` refinements, `links.mjs` (crawl from `/`, report non-200 internal links and `#` hrefs).
- **Acceptance:** `/sitemap.xml` lists every public route and seeded slug and excludes admin, api, thank-you, search, manage, receipt; `/robots.txt` disallows everything when `VERCEL_ENV !== 'production'`; every `application/ld+json` block on 10 sampled pages parses as JSON; `node scripts/qa/links.mjs --url http://localhost:3001/` reports 0 broken links at the P gate; `shoot.mjs --reduced` shows no transitions.

**P gate (lead):** build + start on 3100; all P acceptance lists; `links.mjs` 0 broken; `overflow.mjs 375 768 1280 1440` on every public route; `a11y.mjs` on new routes (functional UI 0 violations; landing exceptions unchanged); landing screenshots vs baseline; lead deletes legacy `content/{home,people,programmes,site,nav}.ts` once nothing imports them and empties the eslint allowlist.

### 6.2 Phase A — Admin (9 packages, parallel)

Common to every A package: admin-ux §1 rules, §10–§13 visual/motion/microcopy/mobile, §14 degrading, §15 acceptance checks 1–8 for each screen you build (check 4 uses `rbac.mjs`; check 5 uses the leaks check from Q5 when available, otherwise inspect payloads with `curl` + grep). Every screen works at 360px. Every list uses cursor "Load more". Every mutation calls `requireStaff` and returns `ActionResult`/`FormState`. Record pages call `requireStaff` at the top (inside `(desk)/loading.tsx`'s boundary).

#### A1 — Shell completion, Today, Find, Help
- **Owns:** `app/admin/(desk)/page.tsx`, `app/admin/(desk)/help/**`, `app/api/admin/{pulse,search}/route.ts`, `components/admin/shell/**`, `components/admin/today/**`, `lib/admin/{commands,hotkeys,net}.ts`, `lib/server/dal/{dashboard,search,notifications}.ts`, `content/admin-help.ts`, `public/admin.webmanifest`.
- **Build:** admin-ux §3 (Places sheet, Quick actions, Find with `cmdk`, Updates drawer + pulse, ribbons, offline banner D12), §5.3–5.4 and §6.2 (Today per role: greeting, what needs you, quick actions, snapshot with count-up D125, coming up; D133 phone/WhatsApp tasks; publishes due posts through a client effect calling a Server Action that runs `publishDuePosts` D110), §6.18 (Help guides + first-day tour, ToR §16 orientation), D83 pulse, D135 manifest.
- **Acceptance:** for each seeded role (via `/api/dev/session`), Today's cards match admin-ux §5.4 (FO: gifts to thank; SO: concerns; counsellor: own sessions only); `/api/admin/pulse` for a non-SO has no `concernsNew` key; Find "sr 2026 1" opens `HVN-SR-2026-0001`; searching a word from a seeded concern narrative returns nothing; Ctrl/Cmd+K opens Find; offline banner appears with the network off; `overflow.mjs` at 360 on `/admin` (with session cookie) shows no horizontal scroll.

#### A2 — Inbox, Requests, Messages, Story submissions
- **Owns:** `app/admin/(desk)/{inbox,requests,r}/**`, `app/api/admin/attachments/[...path]/route.ts`, `components/admin/records/{RecordPanel,SupportView,MessageView,StoryView,ReferralSheet,DeclineSheet,InboxList,SwipeRow}.tsx`, `components/admin/sheets/{LogRequestSheet,AddNoteSheet}.tsx`, `lib/server/dal/{records,timeline,support,contact,storySubmissions,notes}.ts`, `lib/server/workflow/{support,contact,storySubmission}.ts`, `lib/schemas/admin/{support,contact,story,notes}.ts`.
- **Build:** admin-ux §3.8 split view (list in a Suspense child, D3), §6.3 Inbox (tabs new/later/mine, snooze, `seenBy`, swipe, keys, multi-select; D83 parallel queries), §6.4 request view (StatusStepper with `allowedEdges` + guards D75, Timeline, sealed notes, Masked reveal with audit, referral sheet listing `referralPartners` read-only, decline with `support_declined`, more-info with `support_more_info`), §6.19 messages and "turn into…" (support request / volunteer / partner; reply with `contact_reply`), story submissions with "Turn into story / testimonial" through `saveItem` (D58), `/admin/r/[ref]` (D74), private attachments route (D100). No danger chip (D79).
- **Acceptance:** as CM the Inbox lists messages and story submissions and no concerns; as PO it lists support requests; `under_review → approved` without verification shows the guard sentence; `completed` requires an outcome; a transition writes an event, an audit entry and (when sending) an outbox entry; a stale version shows the conflict toast; revealing a phone writes a `sensitive` audit entry; `/admin/r/HVN-SR-2026-0001` redirects to `/admin/requests/HVN-SR-2026-0001`; as counsellor `/admin/requests` → NoAccess (404); `/admin/inbox` HTML/RSC payload contains no concern narrative text.

#### A3 — Safeguarding
- **Owns:** `app/admin/(desk)/safeguarding/**`, `components/admin/safeguarding/**`, `components/admin/sheets/LogConcernSheet.tsx`, `lib/server/dal/concerns.ts`, `lib/server/workflow/concern.ts`, `lib/schemas/admin/concern.ts`.
- **Build:** admin-ux §6.5 (restricted look, `RestrictedBanner`, step-up D87, five risk choices + "not yet assessed" D76, actions log, authority referrals with its own sheet, two-person closure D83, every open audited `sensitive`), data-model §4.2.2/§5.5, re-alert cancellation on acknowledgement (`cancelEmail`), linked support request creation (D79), page title "Concern · Haven team", "Log a concern" sheet for staff entry.
- **Acceptance:** SO with `authTime` older than 30 min → `/admin/confirm?next=…`; after confirming, the list opens; CM, PO, FO, counsellor, RM and viewer get NoAccess (404) on `/admin/safeguarding` and on a concern URL; each open writes an audit entry with `sensitive: true`; closing a high-risk concern alone is refused until a second SO signs off; acknowledging cancels the queued re-alerts (outbox `cancelled`); the narrative appears only in this place's payloads.

#### A4 — Giving, causes, sponsorship, Settings › Giving
- **Owns:** `app/admin/(desk)/giving/**`, `app/admin/(desk)/settings/giving/**`, `components/admin/giving/**`, `components/admin/records/{GiftView,InKindView}.tsx`, `components/admin/sheets/RecordGiftSheet.tsx`, `lib/server/dal/{donations,recurring,causes,sponsors,allocations,paymentSettings}.ts`, `lib/server/workflow/donation.ts`, `lib/server/giving/{allocate,acknowledge,receipts}.ts`, `lib/schemas/admin/{giving,sponsor,paymentSettings}.ts`.
- **Build:** admin-ux §6.6 (ledger with kind/stage/programme/month filters; record a gift (cash, in-kind, manual); gift and in-kind views with StatusStepper D72; AllocationEditor per currency with the cross-currency contribution field prefilled from FX; acknowledge → `nextReceiptNumber` + `donation_acknowledgement`; printable receipt page (A4 and Letter print CSS); pledge "Mark as received"; causes list (derived chips D39) and cause editor (`saveItem`, field groups: FO money, CM words) incl. verification; where-it-goes editor for `allocationSummaries` D57; Sponsorship sub-tab D55 with publish lint (no names, precise places, medical history) and programme-level updates composer); `causeTotals` updates inside allocation transactions + `updateTag(TAG.donationTotals)` (D36, D38); Settings › Giving D131 (`donate.config` + `settings/payment`).
- **Acceptance:** recording a USD 100 gift creates a DN ref; allocating 100% to `education` adds 10,000 minor USD to `causeTotals/education`; `/donate/education` shows the new raised figure on the next request only when the cause is verified; acknowledging issues `HVN-RC-2026-0001` (gap-free on a second gift) and holds the email; the receipt page prints on one page; a CM editing a cause goal gets the forbidden toast; a sponsor profile mentioning a first name cannot be published; switching GMD to card in Settings › Giving persists to `settings/payment` and `/donate` honours it.

#### A5 — Counselling and the Reports & resources library
- **Owns:** `app/admin/(desk)/{counselling,library}/**`, `app/api/admin/uploads/{sign,local/[id],complete}/route.ts`, `components/admin/{counselling,library}/**`, `components/admin/records/{SessionView,ReportRequestView}.tsx`, `components/admin/sheets/{BookSessionSheet,AddReportSheet}.tsx`, `lib/server/dal/{appointments,resources,reportRequests}.ts`, `lib/server/workflow/{appointment,reportRequest}.ts`, `lib/server/calendar/ics.ts`, `lib/schemas/admin/{appointment,resource,reportRequest}.ts`.
- **Build:** admin-ux §6.7 (week strip + agenda, "Waiting for a time" D77, counsellors see their own only, booking in staff timezone with the client's timezone shown, pasted Zoom link validation, "Send the invitation" → `counselling_confirmation` with `.ics`, `zoom_reminder_24h`/`_1h` queued with `scheduledFor` and cancelled on reschedule or cancel, attendance, sealed counsellor notes); integrations §6.1, §6.3–6.4; admin-ux §6.8 library (resource CRUD, public vs controlled, `executiveSummary` blocks, PDF upload ≤ 25 MB via the signed flow D97), report requests split view, approve → `report_delivery` with a `/r/<token>` link, decline → `report_declined`.
- **Acceptance:** booking a session for a counselling SR creates `HVN-AP-…`; three emails exist (confirmation held; two reminders held with `scheduledFor`); rescheduling cancels and re-queues the reminders; counsellor A gets 404 on counsellor B's session; a 2 MB PDF uploads through sign → local PUT → complete and appears on `/resources` with a working download; approving a report request holds `report_delivery` whose `/r/` link 302s to a signed dev file URL.

#### A6 — People: volunteers, partners, referral directory
- **Owns:** `app/admin/(desk)/people/**`, `components/admin/people/**`, `components/admin/records/{VolunteerView,PartnerView}.tsx`, `lib/server/dal/{volunteers,partnerships,referralPartners}.ts`, `lib/server/workflow/{volunteer,partnership}.ts`, `lib/schemas/admin/{volunteer,partnership,referralPartner}.ts`.
- **Build:** admin-ux §6.9 (kanban on desktop with `@dnd-kit` plus a keyboard "Move to…" menu, stage lists on phones, onboarding checklist D83, directory CRUD with `referralPartner.manage`), data-model §5.4/§5.6, D78 labels.
- **Acceptance:** dragging a volunteer along an allowed edge transitions it and a disallowed drop is refused with a sentence; keyboard move works; partnership columns read New · Under review · Talking · Agreement · Active; a new directory entry appears in A2's referral sheet.

#### A7 — Website studio, key information, projects, launch checklist, media library
- **Owns:** `app/admin/(desk)/{website,media}/**`, `app/api/admin/studio/preview/route.ts`, `app/api/admin/media/upload/route.ts`, `components/admin/{studio,media}/**`, `components/admin/sheets/UploadMediaSheet.tsx`, `components/content/StudioBridge.tsx`, `lib/studio/**`, `lib/media/process.ts`, `lib/content/{actions,media-actions,gate,diff,launch,registry,access}.ts` (implementation only; exported names and signatures frozen), `lib/server/dal/{media,consents}.ts`, `lib/schemas/admin/media.ts`.
- **Build:** admin-ux §6.10 studio (iframe in Draft Mode via the preview route D62, outline + slot sheets, `SchemaForm` generated from the registry D60, autosave drafts, PublishSheet with `publishAll`/discard D61, changes and history, device switch, phone outline view, `StudioBridge` messaging and carousel pause), §6.11 Key information (D51; publish + 10-s Undo), Website › Projects (D132), stat editing with the verify checkbox (D46–D47), launch checklist page (D130), §6.13 media library (upload → sharp WebP, consent questions, `mediaConsents` with private form attachment, withdraw → 410 + fallback), D53–D54, D64.
- **Acceptance:** as CM `/admin/website/home` shows the page in an iframe with the preview banner; editing a hero line saves a draft that a signed-out browser does not see; "Put changes live" shows it to everyone on the next request; a second tab with a stale version gets the conflict sheet; a CM cannot change a cause goal (forbidden paths shown); uploading a JPEG with GPS stores `public/media/<id>/<sha12>.webp` without EXIF and serves it via `/m` 200; withdrawing consent makes that URL 410 and the page shows the warm fallback; the launch checklist lists seeded placeholders and flipping "Hide unverified figures" hides them on `/impact`.

#### A8 — Posts, AI review, plan, supporter updates
- **Owns:** `app/admin/(desk)/posts/**`, `app/admin/(desk)/settings/newsletter/**`, `components/admin/posts/**`, `components/admin/sheets/{PostUpdateSheet,WriteArticleSheet}.tsx`, `lib/content/{posts,post-actions}.ts` (exported signatures frozen), `lib/server/dal/{posts,newsletter,supporters}.ts`, `lib/schemas/admin/{post,supporters}.ts`.
- **Build:** admin-ux §6.12 (list tabs; phone Update composer; block-card article editor emitting `Block[]` D42; cover via MediaPicker; SafetyCheck heuristics; review screen with sources side by side and the six-item checklist; scheduling; plan board on `settings.editorial` D48; "Draft this month's story now" calls `runMonthlyDraft({ force: true })` (stub until I4); "Help me write" calls `assist()` and explains when it is off), D129 "Send to supporters" (`posts/[id]/send`, audience preview with counts, `supporter_update` per recipient through the outbox, List-Unsubscribe, suppressions), Settings › Newsletter (count, export link to `newsletter` dataset).
- **Acceptance:** an Update created at 375px goes draft → in review → (reviewer approves with the checklist) → published and appears on `/news` and the home News; a scheduled post whose `publishAt` has passed publishes when Today loads; a draft created through `POST /api/dev/content` `{ action: 'aiDraft' }` shows in Review with `origin.kind = 'ai'` and flags; "Send to supporters" queues one held email per confirmed subscriber and consented donor and none for unconfirmed subscribers.

#### A9 — Team and access, Me, Activity, Settings, exports
- **Owns:** `app/admin/(desk)/{team,me,activity}/**`, `app/admin/(desk)/settings/page.tsx`, `app/admin/(desk)/settings/{connections,email-log,data}/**`, `app/admin/{forgot,reset,invite}/**`, `app/admin/export/[dataset]/route.ts`, `components/admin/{team,settings,activity,me}/**`, `components/admin/sheets/InviteSheet.tsx`, `lib/server/auth/{invitations,mfa}.ts`, `lib/client/mfa.ts`, `lib/server/dal/{staff,activity,privacy,outbox,retentionSettings}.ts`, `lib/server/export/{csv,datasets}.ts`, `lib/schemas/admin/{staff,settings,privacy}.ts`.
- **Build:** admin-ux §6.14 (invite → `staff_invite`, roles + viewer scopes, pause = suspend, deactivate with reassignment prompt, MFA reset with step-up, last-SA guard), §6.17 Me (profile, text size, notification prefs D91, password change, sign-in code enrolment (Firebase TOTP; local shows the skipped badge), devices D92, "Sign out on all devices"), auth pages (D88; local reset token 1 h), §6.15 Activity (filters, sensitive, `auditAreasFor`), §6.16 Settings overview, Connections (`integrationStatuses()` + "Send me a test email" → `email_test`), Email log / Outbox (held previews in a sandboxed iframe, statuses), Data (retention D105, privacy requests D104, backups text), exports D102 (CSV formula-injection escaping, `requireRecentAuth`, audit).
- **Acceptance:** inviting a CM holds `staff_invite` with `/admin/invite/<token>`; accepting creates the account and staff doc and signs in; forgot → reset works with a 1-hour local token; deactivating the last SA is refused; Activity's sensitive filter lists record views and reveals; the email log shows held emails with previews; exporting `donations` asks for recent auth and escapes a donor name starting with `=`; non-SA roles get NoAccess on Settings › Data.

**A gate (lead):** build + start; `rbac.mjs --phase a` (all eight roles, every place); admin-ux §15 checks 1–8 on every screen (`overflow.mjs` and `a11y.mjs` with the session cookie, 0 violations in the admin); leaks check (no concern narrative outside Safeguarding payloads); every email-sending action produces an outbox entry with the right subject.

### 6.3 Phase I — Integrations (8 packages, parallel; after P3, A4, A5, A8)

#### I1 — Stripe payments core
- **Owns:** `lib/server/payments/{checkout,products,apply,events,enrich,reconcile}.ts`, `lib/server/payments/handlers/**`, `app/api/stripe/{webhook,return}/route.ts`, `lib/server/dev/suites/stripe.ts`, `scripts/qa/stripe-webhook.mjs`, `scripts/qa/fixtures/stripe/**`.
- **Build:** integrations §3.3–3.6, §3.10 (deterministic products per cause, metadata contract D37, hosted Checkout `ui_mode: 'hosted_page'`, intents D67, return route reconcile + 303, webhook raw body + `constructEvent`, idempotency D69, event mapping D68, enrichment, sweeper), uses P3's ledger and A4's allocate/acknowledge.
- **Acceptance (no keys):** `GET /api/dev/selftest?suite=stripe` passes with fixture events fed straight to `dispatch()`: one-time completion → one Donation; duplicate event → no second; subscription completion → RecurringGift, `invoice.paid` ×2 → two Donations; `charge.refunded` → refund status; out-of-order events converge; GMD never reaches Stripe. `POST /api/stripe/webhook` without `STRIPE_WEBHOOK_SECRET` → 503. With test keys later: `scripts/qa/stripe-webhook.mjs` and a real `4242…` checkout (owner/lead step).

#### I2 — Donor self-service, pay links, refunds, receipts
- **Owns:** `lib/server/payments/{portal,pay,refunds}.ts`, `app/api/stripe/portal/route.ts`, `app/api/donations/pay/route.ts`, `app/(site)/donate/{manage,receipt}/**`, `components/public/manage/**`, `components/admin/giving/{RefundSheet,PayLinksPanel}.tsx`, and in this phase `app/admin/(desk)/giving/page.tsx` and `app/admin/(desk)/giving/[ref]/page.tsx` (mount the two components only).
- **Build:** integrations §3.7–3.9, §3.11 (magic link `donor_manage_link` with rate limit `manage_link`, portal by token, pay links `card_payment_link`, receipts page by token, refunds from admin with step-up), D70.
- **Acceptance:** `/donate/manage` request → `donor_manage_link` held (rate-limited); without a Stripe key the manage page explains card management is being set up; a valid receipt token renders the receipt and a tampered one does not; "Send card payment links" without Stripe shows the not-switched-on message; refund without Stripe returns `unavailable`.

#### I3 — Email transport and templates
- **Owns:** `lib/server/email/templates/**`, `lib/server/email/transports/resend.ts`, `lib/server/email/{copy,suppressions,digest}.ts`, `app/api/email/webhook/route.ts`, `app/admin/(desk)/settings/emails/**`, `components/admin/emails/**`, `lib/server/dev/suites/email.ts`.
- **Build:** integrations §4 (modes, Resend batch + `scheduledAt`, every template and subject D107, editable copy `settings/emailCopy`, suppressions, List-Unsubscribe on the updates footer, digest, redirect mode), design-system hex (D118).
- **Acceptance:** `GET /api/dev/selftest?suite=email` renders every template id with sample vars; every subject matches its pattern; sensitive templates carry no category words; `/admin/settings/emails/support_confirmation` edits the greeting and the preview updates; with `RESEND_API_KEY` unset the mode is `mailbox`.

#### I4 — AI writing and cover images
- **Owns:** `lib/server/ai/**` (except `types.ts`), `app/api/cron/editorial/route.ts`, `content/people-mix.ts`, `scripts/media/{manifest,audit-mix}.mjs` (import the constant only), `lib/server/dev/suites/ai.ts`.
- **Build:** integrations §5 (provider selection, Anthropic and Gemini adapters, template writer, public-safe fact sheet, validators, assist, monthly job, covers with people-mix rotation and labelled illustrative children only on opt-in), D134. No new image generation in this package's verification.
- **Acceptance (no keys):** `AI_PROVIDER` unset → `runMonthlyDraft({ force: true })` creates one `in_review` template draft with TODO flags, and a second call in the same month creates none; `GET /api/cron/editorial` without the bearer → 401; a fact sheet with an injected number makes the validator flag it; `assist()` returns `{ kind: 'off' }`; no outbound network calls; `node scripts/media/audit-mix.mjs` still reports the same share.

#### I5 — Zoom and calendar
- **Owns:** `lib/server/zoom/**`, `lib/server/calendar/**` (in this phase), `components/admin/counselling/CreateZoomButton.tsx`, `lib/server/dev/suites/zoom.ts`.
- **Build:** integrations §6.2–6.4 (Server-to-Server OAuth, meeting create/update/delete, no host start URLs stored, `.ics` REQUEST/CANCEL with SEQUENCE, reminder robustness on reschedule).
- **Acceptance:** without `ZOOM_*` the button is absent and `createZoomMeeting` returns `null`; the zoom suite validates `.ics` output (VEVENT, UID stable across reschedules, SEQUENCE increments, CANCEL on cancel).

#### I6 — Cron, retention, metrics and ops
- **Owns:** `app/api/cron/{tick,retention}/route.ts`, `lib/server/{tick,retention,metrics}.ts`, `lib/server/integrations/probe.ts`, `vercel.json`, `.github/workflows/cron-tick.yml`, `instrumentation.ts`, `lib/server/dev/suites/retention.ts`.
- **Build:** integrations §7.1–7.3 and §8.2, data-model §11.4 (retention deletes, anonymise, review tasks, outbox body purge), D110 (pinger shipped and documented as required), `bootReport()`, live `checkIntegration()` probes.
- **Acceptance:** `GET /api/cron/tick` without the bearer → 401; with `CRON_SECRET` (lead sets it) → JSON summary with each step's result; two concurrent calls → one `'locked'`; the daily block runs once per UTC day; the retention suite's dry run lists due items without deleting concerns; the dev server log shows the boot report of missing PROD variables.

#### I7 — Analytics and Turnstile
- **Owns:** `components/analytics/SiteAnalytics.tsx`, `lib/analytics/track.ts`, `components/ui/form/Turnstile.tsx`, `lib/server/security/turnstile.ts` (in this phase).
- **Build:** integrations §8.1 (Vercel Web Analytics, public only, `beforeSend` URL normalisation, env-gated custom events), §9 (explicit-render Turnstile, fail-open for support and concern).
- **Acceptance:** `NEXT_PUBLIC_ANALYTICS=off` → no analytics script on `/`; `/admin` never loads it; with the Cloudflare always-pass test keys the contact form submits with a token; without keys no widget renders and forms still work.

#### I8 — Firebase go-live kit
- **Owns:** `lib/server/db/firestore.ts`, `lib/server/storage/gcs.ts`, `lib/server/auth/firebase.ts` (in this phase, fixes only), `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `storage.cors.json`, `scripts/data/{push-local,create-super-admin}.mjs`, `scripts/qa/firebase-preflight.mjs`, `docs/platform/FIREBASE-GO-LIVE.md`.
- **Build:** data-model §7, §8.3, §9.1/§9.4, §14 step 7; content-model §9 step 14 (push `.data` to Firestore/Storage, dry-run by default); Identity Platform checklist (TOTP, blocking sign-up, password policy); first super admin script.
- **Acceptance (no creds):** `node scripts/qa/firebase-preflight.mjs` reports "credentials absent", validates the rules and index JSON and lists the console steps; `node scripts/data/push-local.mjs --dry-run` lists what would be copied; `HAVEN_BACKEND=firestore` without creds fails with a clear boot message. With creds later: the selftest passes on Firestore and the rules deny client access.

**I gate (lead):** build + start; every I acceptance list; full practice-mode run-through (integrations §12 "Done").

### 6.4 Phase Q — Quality (6 packages, parallel)

#### Q1 — Public site QA and fixes
- **Owns:** `app/(site)/**`, `app/{layout,not-found,global-error,opengraph-image,sitemap,robots}.*`, `components/{layout,sections,public,donate,content,seo,art,analytics}/**`, `app/globals.css`, `lib/motion/**`, `lib/analytics/**`, `lib/seo/**`.
- **Build:** design-system §6–§7 audits; public-pages §8 checks; fix what you find in owned files.
- **Acceptance:** `a11y.mjs` 0 violations on functional UI at 375 and 1280 for every public route (landing brand exceptions documented, unchanged unless the owner decides); `overflow.mjs 375 768 1280 1440` clean on every route; `lcp.mjs` ≤ 2.5 s (4× CPU mobile) on `/`, `/donate/education`, `/programmes/education`, `/news/<slug>`; `lighthouse.mjs` mobile performance ≥ 85 on those; reduced-motion pass; Activity back-navigation keeps pins and pauses videos.

#### Q2 — Admin QA and fixes
- **Owns:** `app/admin/**`, `components/admin/**`, `lib/admin/**`, `lib/studio/**`, `lib/client/**`, `public/admin.webmanifest`.
- **Acceptance:** admin-ux §15 checks 1–8 on every screen for all eight roles; real-phone-width checks at 360/390; sheets trap and restore focus; no toggle switches anywhere (`grep -ri "role=\"switch\"" components app` → 0).

#### Q3 — Security and privacy review and fixes
- **Owns:** `lib/server/**`, `app/api/**`, `app/m/**`, `app/r/**`, `proxy.ts`, `next.config.ts`, `firestore.rules`, `storage.rules`.
- **Build:** review against §7.5 and data-model §6, §10, §11: every DAL entry calls `requireStaff`; DTOs field by field; concern side channels (search, pulse, notifications, email subjects and bodies, AI inputs, Activity sentences, page titles, CSVs); token routes; upload paths; rate limits; secrets never in client bundles (lead greps `.next/static` for secret variable names after the build); CSP report review (stays Report-Only).
- **Acceptance:** written findings list in the final report with each fixed or ticketed; leaks check 0 hits; `rbac.mjs --phase a` passes; an unauthenticated POST to every admin action returns redirect/404, never data.

#### Q4 — Shared layer conformance
- **Owns:** `components/ui/**`, `lib/content/**`, `lib/media/**`, `lib/model/**`, `lib/forms/**`, `lib/schemas/**`, `lib/routes.ts`, `lib/nav.ts`, `lib/money.ts`, `lib/countries.ts`, `content/seed/**`, `eslint.config.mjs`, `package.json`.
- **Build:** apply the change requests other packages reported against shared files (the lead hands Q4 the consolidated list); dead-code removal; exact version pins; schema `.default()` coverage; contrast of every kit variant.
- **Acceptance:** `npx tsc --noEmit` and `npm run lint` clean; every change request closed or explained; no unused exports in `components/ui/**` (`npx ts-prune` style check via a scratch script, not committed).

#### Q5 — QA automation suite
- **Owns:** `scripts/qa/**` (except files owned earlier that it only extends with flags), `scripts/qa/lib/**`.
- **Build:** `forms.mjs` runner over `scripts/qa/forms/*.mjs`; `rbac.mjs` completion; `leaks.mjs` (sign in as each role, fetch every admin route and API, assert no seeded concern narrative or contact appears outside Safeguarding); `--cookie` support in `shoot.mjs`, `overflow.mjs` and `a11y.mjs`; `practice-run.mjs` (end-to-end: submit every public form, triage each in the admin, check outbox subjects).
- **Acceptance:** each script runs green against `http://localhost:3100` after the lead's build; each prints a one-line summary and exits non-zero on failure.

#### Q6 — Docs and handoff
- **Owns:** `README.md`, `HANDOFF.md`, `.env.example`, `docs/platform/RUNBOOK.md`, `content/admin-help.ts` (in this phase).
- **Build:** README (run, seed, practice mode, QA scripts, ports); HANDOFF.md rewritten as the single client-input and open-questions register (§8 + ToR §18 items + operational items: domain and Vercel plan, sending domain and team mailboxes, Stripe entity, mobile-money accounts, named admins and safeguarding officers, `HAVEN_DATA_KEY` escrow, Firestore region); RUNBOOK (go-live order: Firebase, keys, Resend DNS, Stripe webhook, cron pinger or Pro, launch checklist, hideUnverified); final `.env.example` check against `lib/server/env.ts`.
- **Acceptance:** every env var read in `lib/server/env.ts` appears in `.env.example` and vice versa (scripted grep); every `// CLIENT` marker in seeds is listed in HANDOFF.md.

---

## 7. Global rules for every builder

### 7.1 Next.js 16 (from next16-notes §0, adapted to this plan)

1. **Cache Components is on.** Nothing is cached unless it says `'use cache'`. `export const dynamic | revalidate | fetchCache | dynamicParams | runtime` are forbidden (D5).
2. **`proxy.ts`, not middleware.** It only checks cookie presence on `/admin/:path*` (D89).
3. **Every admin page, Server Action and Route Handler calls `requireStaff(...)` itself** (`lib/server/auth/session.ts`). Neither proxy nor a layout is a security boundary. Call `requireStaff` outside `try/catch` (it throws redirect/notFound).
4. **Server Actions for forms; Route Handlers** for `/api/donations`, Stripe, cron, uploads, search, pulse, media serving, downloads and dev routes. Files never go through a Server Action.
5. **Public reads** are `'use cache'` + `cacheLife('content')` + `cacheTag(TAG…)`. **Writes:** `updateTag` in Server Actions; `revalidateTag(tag, 'max')` in route handlers and cron (`{ expire: 0 }` for cron-published posts). Never the one-argument `revalidateTag`.
6. **`params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are async.** Await them inside `<Suspense>` or under a `loading.tsx`, never at the top of a layout. Layouts never receive `searchParams`.
7. **No `new Date()`, `Date.now()`, `Math.random()` or `crypto.randomUUID()` during render** (only in `'use cache'`, after `await connection()` in Suspense, or in effects, handlers, actions and routes).
8. **Node runtime only;** never `export const runtime`. `firebase-admin` and `stripe` stay server-side.
9. **Secrets** have no prefix and are read only through `lib/server/env.ts`. `NEXT_PUBLIC_*` are inlined at build time.
10. **Webhooks** read the raw body with `await request.text()`.
11. **Cron handlers** check `Authorization: Bearer ${CRON_SECRET}` as their first statement.
12. **Images:** `preload`, not `priority`; no query strings on local `src`; a replaced image always gets a new URL (content-hashed).
13. **`error.tsx` gets `{ error, retry }`;** use `retry`.
14. **Do not use** `forbidden()`/`unauthorized()`, `global-not-found`, `unstable_cache`, `unstable_noStore`, `experimental.useOffline`, `experimental.taint`, parallel routes without `default.tsx`.
15. **Activity:** hidden routes stay mounted. Effects must clean up (pause videos, kill GSAP, clear timers). Logout is a full page reload. Every dynamic segment has a `loading.tsx` or passes `params` into a Suspense child. Path hooks only in Suspense-wrapped leaves (D4). `'use client'`/`'use server'`/file-level `'use cache'` are the first statement; `'use server'` files export only async functions.

### 7.2 Process and ownership

- Edit **only** files your package owns. Need something else changed? Put the request in your final report.
- **No git operations** (no commit, stash, checkout, reset, branch). The working tree has uncommitted work and is shared by parallel builders.
- **Never run `next build`, `next start` or `next dev`.** The lead runs builds (one at a time) and owns the dev server on **port 3001**. **Port 3000 belongs to another project** — never target it. Always pass `--url http://localhost:3001/…` (or `--base`) to QA scripts; `shoot.mjs` defaults to 3000.
- Do not `npm install` or edit `package.json` (F1 and Q4 only).
- Never delete or reset `.data/`; seeding is idempotent. Never print credentials or `.env.local` values.
- Before finishing: `npx tsc --noEmit` (zero errors in your files), `npx eslint <owned paths>`, your acceptance checks, and a final report listing: files created/edited, deviations from this plan with reasons, change requests for files you do not own, and anything left as a stub.
- Read the owning doc sections cited by your package before coding. If a doc and this plan disagree, follow this plan and note it.

### 7.3 Design

- **Same brand as the landing page.** Donat voice by default; at most **one** Voices United chapter per inner page (D121). Use tokens and utilities from `app/globals.css`; no raw hex in components.
- **Admin:** "Haven team" — warm, simple, sentence-style. **No sidebar, no toggle switches, no walls of settings.** Pill bar on desktop, bottom dock on phones, sheets for editing, Undo over confirm (admin-ux §0). Focus ring forest on light surfaces.
- **Accessibility:** WCAG 2.2 AA for all functional UI (forms, statuses, admin, legal pages, anything a person must read to get help). 16px inputs, visible labels, error summary, `aria-describedby`, 44px targets. Landing brand pairings are documented exceptions, unchanged.
- **Motion:** IntersectionObserver + CSS for reveals; GSAP only for pins and scrubs; respect reduced motion; `cv-auto` never on sticky, pinned or edge-overflowing elements.
- **Primitives exist once** (D120). Do not fork a primitive into your area; compose it.

### 7.4 Imagery, people mix and safeguarding of images

- **No new image or video generation** unless your package explicitly says so (none in this plan's verification steps). Reuse pipeline media.
- If a package does generate (only with the lead's go-ahead): people mix ≈ one third Black, the rest mostly South and Southeast Asian plus Arab, from the poorest regions, **no white people** (pending founder sign-off, §8); families are a mother and a father with their children; the child is always the one being helped; dignified and hopeful, never extreme; no school crests or signage; no weapons. Run `node scripts/media/audit-mix.mjs` afterwards.
- **Never hard-code `/media/...` paths.** Use `img()`, `video()`, `poster()` or `ref()` from `lib/media/pipeline.ts`, or `MediaRef` + the media index.
- Every AI image with people carries the "Illustrative image" label (D54). No real child's name, face with identifying detail, or precise location ever appears in content, seeds or samples.

### 7.5 Security and privacy

- **Only the DAL touches records.** `app/**` never imports `lib/server/db` or `lib/server/storage` (§4.2). DTOs are built field by field (no `...record` spreads).
- **Concern isolation:** a concern's details never appear outside the Safeguarding place: not in Inbox previews, Find, pulse, notifications, email subjects or bodies, AI input, Activity sentences, page titles, CSVs or logs. Other roles cannot even see a count.
- **Sealed fields:** support explanations, concern narratives, case notes, counsellor notes and story-submission contacts are sealed with `seal()`.
- **Emails:** subjects are template-fixed; the only variable is the reference (D107). Sensitive bodies carry first name, reference, dates and links only.
- **No secrets client-side.** No personal data in URLs, cache tags or logs. `log` redacts.
- **Uploads** only through D96–D97 routes. **CSV** cells starting with `= + - @` are escaped.
- **Practice-mode helpers** (`/api/dev/*`, chips) are guarded by `devOnly()` (D90).
- `dangerouslySetInnerHTML` only in `JsonLd` (escaped) and the sandboxed email preview iframe (`srcdoc`).

### 7.6 Content and data

- Public pages read through `lib/content/public.ts` only. Content ids, field names and limits come from `lib/content/schema.ts`; do not add fields — use the `PageDoc.sections` map or request a schema change.
- Every `*At` is Millis (D30). Long text is `Block[]` (D44). Seeds keep today's values verbatim; client-supplied values carry `placeholder: true` and a `// CLIENT` comment.
- References come only from `lib/server/references.ts`; statuses and edges only from `lib/model/{status,flows}.ts`; labels only from `lib/model/labels.ts`.

---

## 8. Open questions for the owner

1. **Home final call to action** (D128): switch on the spec's closing band ("Your Support Will Positively Impact a Child's Welfare and Future.") below News? It is built and hidden.
2. **People mix:** the founder asked (2026-09-28) to also see Hispanic and white families; the current rule excludes white people. Confirm which rule stands (one constant, D134).
3. **Google Analytics:** wanted? It sets cookies and would need a consent banner; today the site uses cookieless Vercel Analytics only.
4. **Vercel plan:** Pro (15-minute cron, needed for in-app concern re-alerts) or Hobby plus a free pinger?
5. **Stripe:** which legal entity and country own the account; settlement bank; nonprofit pricing; receipt legal text (registered name, numbers, "no goods or services" line); test GMD by card before enabling it?
6. **Local payments:** Wave / Afrimoney / QMoney merchant names and numbers, and bank details per currency.
7. **Domain and email:** the domain, DNS access for the sending domain, and the team mailboxes (support, safeguarding, donations, partnerships, media, privacy).
8. **Firebase:** Firestore/Storage region (EU `eur3` recommended; cannot change later); create a staging project?; enable Google sign-in?; who holds the `HAVEN_DATA_KEY` backup?
9. **People and safeguarding:** named staff and their roles; named safeguarding alert recipients; risk-level definitions; must a second person sign off closing high/immediate concerns (built on by default)?
10. **Retention and finance:** confirm retention periods with a professional; the financial year start.
11. **AI and Zoom:** which AI provider and whose billing; a licensed Zoom host, and whether to enable automatic meeting links.
12. **Cross-currency causes:** may a GBP gift count towards a USD cause at a finance-set rate?
13. **Updates from the field:** may programme officers put Updates live directly, or always via review (built: review)?
14. **Small items:** remove the unsourced "5.0" rating badge on Testimonials?; seasonal greetings on Today?; Zakat-eligibility wording, tax-deductibility statement and the AI byline wording; is "Haven" final, and should "The Orphanage Project" appear as the legal name?
