# Haven platform: the public website

Status: design, ready to build. Audience: the implementer. Scope: every public route beyond the landing page, the dedicated donate experience, navigation, link retargeting, SEO, and build order. Admin, the storage layer, email templates and the Stripe account setup are covered by sibling docs in `docs/platform/`. This doc states only the **contract** it needs from them (§2.5, §4.7).

Sources: `docs/CLIENT-SPEC.md` (the ToR, abbreviated "§n" below) plus the **owner's direction** at its foot, which overrides the spec. Also `HANDOFF.md`, `README.md`, and the landing code (`app/page.tsx`, `components/**`, `content/**`). Next.js is **16.3.6**. Every Next-specific claim below was checked against `node_modules/next/dist/docs/` (paths are cited inline as `docs:`).

House rules that apply to every page in this doc:
- **Visual system:** the same as the landing page. Tokens are in `app/globals.css` (forest `#1f715a`, marigold `#f5af08`, coral `#f25e44`, clay, cocoa, umber, sand, paper, cream, vu-cream). Fonts: Nunito (`font-sans`), Anton (`font-display`), Caveat (`font-script`) and Inter (`font-grotesk`). Brush masks come from `public/brush/*.svg`, plus the `paper` texture, `Reveal`, `BrushReveal`, `Counter` and `ProgressBar`. **No new colours and no new fonts.**
- **People mix:** about one third Black; the rest South Asian, Southeast Asian and Arab. No white people. Families are a mother and a father with their children. Children are shown only with dignity, and the child is always the one being helped. No school crests. Every new image must have its `eth` tag and pass `node scripts/media/audit-mix.mjs`. Any child image carries `childPlaceholder: true`.
- **Safeguarding (§15):** no children's full names or precise locations. Case files and applications are never published. Every child image or story needs consent. Automated tools never "diagnose".

---

## 0. Decisions at a glance

1. **Route group.** Public pages live in `app/(site)/`. Header, Footer, ScrollTop and SmoothScroll (Lenis) move from `app/page.tsx` and `app/layout.tsx` into `app/(site)/layout.tsx`, so the admin gets a clean shell. URLs don't change.
2. **The chrome always routes to real pages.** "Chrome" here means the header, mega menu, mobile menu and footer. The landing page keeps in-page anchors in only two places: **Home/logo → `#top`** and **Appeals "Donate Now" → `#donate`**, which preselects the landing's quick-give card. Everything else, including the hero's "Support a Child", goes to a page (§5.4, §6).
3. **The donate experience** lives at `/donate` and `/donate/[cause]`. A route-group layout keeps the donate widget **sticky and mounted while the cause changes**. The URL is always the shareable state.
4. **One `Cause` model** covers general giving, the 6 programmes, the appeals, funded projects and sponsorship. Its slugs mirror the programme slugs (`/programmes/education` pairs with `/donate/education`).
5. **Stripe Checkout runs only when it is configured** and when that currency is routed to Stripe. In every other case the gift becomes a **pledge** with bank and mobile-money instructions. **GMD routes to local payment by default** (§4.6).
6. **Forms** use Server Actions with `useActionState`, and Zod schemas shared by client and server. Every form has the same states: idle, field errors, submitting, success with a reference, and server error. References are neutral and non-sequential (`HVN-7KQ2MX`).
7. **Report a Concern** is a separate, calm page with a **Quick exit** button. Nothing is saved in the browser, and the reporter can stay anonymous.
8. **Merges** (justified in §1.2):
   - Team folds into `/about#team`.
   - Testimonials intake folds into `/stories/share`.
   - Give in kind lives inside the donate widget (`?mode=in-kind`).
   - The appeal "landing pages" are the donate pages.
   - Stories have no detail pages.
9. **Navigation fit.** The pill nav gains real top-level links with separate chevron buttons. Short labels are used from 1280 to 1399px so the pill still passes `scripts/qa/nav-fit.mjs`.
10. **Pages stay statically prerendered.** Public pages never call `cookies()` or `headers()`. URL-driven UI reads `useSearchParams` inside `<Suspense>` (docs: `03-api-reference/04-functions/use-search-params.md`). Admin publishing triggers revalidation (see the backend doc).

---

## 1. Sitemap

### 1.1 Routes

| Route | Page | Rendering | File |
|---|---|---|---|
| `/` | Landing (unchanged order; links retargeted, §6) | static | `app/(site)/page.tsx` (moved from `app/page.tsx`) |
| `/about` | Who we are, vision, mission, values, approach, founder, team, partners, where we work | static | `app/(site)/about/page.tsx` |
| `/programmes` | Programme index | static | `app/(site)/programmes/page.tsx` |
| `/programmes/[slug]` ×6 | `child-protection`, `education`, `medical`, `counselling`, `legal`, `family-community` | SSG, `dynamicParams = false` | `app/(site)/programmes/[slug]/page.tsx` (+ `opengraph-image.tsx`) |
| `/get-support` | "You Do Not Have to Face It Alone" hub | static | `app/(site)/get-support/page.tsx` |
| `/get-support/request` | Request Support form (`?type=` prefill) | static shell + Server Action | `app/(site)/get-support/request/page.tsx` |
| `/report-a-concern` | Child-protection concern form (§7) | static shell + Server Action | `app/(site)/report-a-concern/page.tsx` |
| `/resources` | Library, with `?category=&q=&access=&page=` | SSG + client filters | `app/(site)/resources/page.tsx` |
| `/resources/[slug]` | Resource or report detail, with download or request | SSG, `dynamicParams = true` | `app/(site)/resources/[slug]/page.tsx` |
| `/request-a-report` | Report request form (`?report=slug`) | static shell + Server Action | `app/(site)/request-a-report/page.tsx` |
| `/impact` | Verified stats, money allocation, map, projects, stories, reports | SSG (revalidated on publish) | `app/(site)/impact/page.tsx` |
| `/projects` | Projects index ("View All Projects") | SSG | `app/(site)/projects/page.tsx` |
| `/projects/[slug]` | Project detail | SSG, `dynamicParams = true` | `app/(site)/projects/[slug]/page.tsx` |
| `/stories` | Stories of Hope (picture and paragraph) | SSG | `app/(site)/stories/page.tsx` |
| `/stories/share` | Tell Your Story (also the testimonial intake) | static shell + Server Action | `app/(site)/stories/share/page.tsx` |
| `/news` | Blog index, with `?category=&page=` | SSG | `app/(site)/news/page.tsx` |
| `/news/[slug]` | Article | SSG, `dynamicParams = true` | `app/(site)/news/[slug]/page.tsx` (+ `opengraph-image.tsx`) |
| `/news/rss.xml` | RSS 2.0 feed | route handler (cached) | `app/(site)/news/rss.xml/route.ts` |
| `/get-involved` | Ways to help hub | static | `app/(site)/get-involved/page.tsx` |
| `/get-involved/volunteer` | Volunteer page and form | static shell + Server Action | `…/get-involved/volunteer/page.tsx` |
| `/get-involved/partner` | Partnership page and form | static shell + Server Action | `…/get-involved/partner/page.tsx` |
| `/get-involved/sponsor` | Anonymous sponsorship profiles (§10) | SSG | `…/get-involved/sponsor/page.tsx` |
| `/donate` | Dedicated donate page (general cause) | static shell; widget is client-side | `app/(site)/donate/(give)/page.tsx` |
| `/donate/[cause]` | Cause-specific donate page (shareable) | SSG, `dynamicParams = true` | `app/(site)/donate/(give)/[cause]/page.tsx` (+ `opengraph-image.tsx`) |
| `/donate/thank-you` | After Stripe, a pledge or an in-kind offer | dynamic, `noindex` | `app/(site)/donate/thank-you/page.tsx` |
| `/contact` | Contact form, offices, safeguarding redirect | static shell + Server Action | `app/(site)/contact/page.tsx` |
| `/faq` | Grouped FAQs, with search | SSG | `app/(site)/faq/page.tsx` |
| `/policies` | Policy index | SSG | `app/(site)/policies/page.tsx` |
| `/policies/[slug]` | `safeguarding`, `privacy`, `terms` | SSG, `dynamicParams = false` | `app/(site)/policies/[slug]/page.tsx` |
| `/search` | Full results for `?q=` | dynamic, `noindex` | `app/(site)/search/page.tsx` |
| `/unsubscribe` | Newsletter opt-out (`?token=`) | dynamic, `noindex` | `app/(site)/unsubscribe/page.tsx` |
| `/admin` | Administrator Login (owned by the admin doc) | n/a | `app/admin/**` |

Route handlers this doc depends on (all Node runtime):
- `POST /api/donations`
- `POST /api/stripe/webhook`
- `GET /api/search`
- `GET /api/resources/[slug]/download`
- `POST /api/uploads/sign`

They are specified in §2.5 and §4.7.

### 1.2 Merges and rejected routes (with reasons)

- **`/team` → `/about#team`.** There are six people and no bios yet (§18). One carousel plus a bio drawer is enough. Add `/about/team` only if the team grows past about 12.
- **`/testimonials` → no route.** Testimonials appear on `/about`, `/impact` and `/get-involved`. Intake goes through `/stories/share`, which has a "You are a: beneficiary / donor / volunteer / partner / professional" field. That covers §4: "from beneficiaries, donors, volunteers, partners and professionals, published only with consent".
- **`/stories/[id]` → no route.** The founder chose quick picture-and-paragraph stories (HANDOFF). Detail pages would add little and would tempt more detail about children. Each story card has an anchor id (`/stories#s-<id>`) and a "Copy link" share. Long-form stories are written as news posts in the "Stories of Hope" category.
- **`/appeals` → no route.** An appeal's page *is* `/donate/<appeal-slug>`: story, progress, allocation and the widget together. The landing's "See all appeals" equivalent is `/donate#causes` (the cause list on `/donate`).
- **`/give-in-kind` → `/donate?mode=in-kind`.** It is the same widget with the cash/in-kind toggle preset. In-kind also works per cause, for example `/donate/eid-clothes-gifts?mode=in-kind`.
- **`/volunteer`, `/partner`, `/sponsor`, `/give` → redirects.** These are short links for flyers and social bios; see §1.3. The canonical routes nest under `/get-involved` for coherent breadcrumbs.
- **`/counselling/book` → no route.** Counselling is `/get-support/request?type=counselling`, which adds a scheduling-preferences step. Appointment scheduling and the Zoom link are admin-side, and the link is only ever sent by email (§5.4).
- **Public case-status tracker → Phase 2.** The beneficiary portal is out of Phase 1 scope (§16). A reference and email lookup also invites enumeration. Status changes reach people by email instead (§14).
- **`/policies/cookies` → no route.** The public site sets no non-essential cookies: analytics is cookieless (Vercel Analytics), and Stripe's cookies sit on Stripe's own domain. The privacy policy has a "Cookies" section. **No cookie banner is needed.** Revisit if a tracking pixel is ever added.

### 1.3 Short-link redirects (`next.config.ts` → `redirects()`)

All use `permanent: true` (308; docs: `05-config/01-next-config-js/redirects.md`).

| Source | Destination |
|---|---|
| `/volunteer` | `/get-involved/volunteer` |
| `/partner` | `/get-involved/partner` |
| `/sponsor` | `/get-involved/sponsor` |
| `/give` | `/donate` |
| `/donate/general` | `/donate` |
| `/report` | `/report-a-concern` |
| `/help` | `/get-support` |
| `/blog`, `/blog/:slug` | `/news`, `/news/:slug` |

### 1.4 Reserved slugs

Cause slugs must never be `thank-you`, `general`, `in-kind`, `api` or `manage`. Admin validation must reject them. A static segment (`/donate/thank-you`) already wins over `[cause]`, but reserving the names avoids confusion.

### 1.5 App structure and chrome

```
app/
  layout.tsx            # <html>, fonts, globals.css, Organization/NGO JSON-LD (§7.2). NO Header/Footer/Lenis.
  not-found.tsx         # unmatched URLs: renders <SiteChrome> around the 404 body (root not-found sits outside (site))
  opengraph-image.tsx   # unchanged; inherited by pages without their own
  robots.ts  sitemap.ts  icon.svg
  (site)/
    layout.tsx          # <SmoothScroll><SiteChrome>{children}</SiteChrome></SmoothScroll> + <RouteScrollReset/>
    error.tsx           # "use client"; warm error with retry
    page.tsx            # landing (moved)
    …routes from §1.1
  api/…                 # route handlers
  admin/…               # admin doc
components/layout/SiteChrome.tsx  # <Header/><main id="main">{children}</main><Footer/><ScrollTop/>
```

**Gotcha:** `app/not-found.tsx` renders inside the root layout, not `(site)/layout.tsx`. It must import `SiteChrome` itself, or unmatched URLs show a bare page.

Add a **skip link** ("Skip to content" → `#main`) as the first focusable element in `Header`. The landing doesn't have one yet, and every inner page needs it.

---

## 2. Shared building blocks

### 2.1 Page anatomy

Every inner page follows this shape:
1. `PageHero` (one of four variants, §2.2) with breadcrumbs.
2. Body sections alternating backgrounds, in the landing's rhythm: `paper` → `bg-white` → `bg-vu-cream` → a dark or tone band (`bg-deep`, `bg-forest` or `bg-clay`) → `bg-white`, using the same paddings (`py-24 md:py-32`). Never put two dark bands next to each other.
3. A closing band. On most pages this is `FinalCta` (§2.2); on support and safeguarding pages it is `CtaBand` (the DoorsOpen style). Its colour must contrast with the footer's night brush edge, which bites into it.

Below-fold sections get `cv-auto`, except any element whose decoration overflows its box, any pinned section, and the footer (per the `haven-qa-gotchas` notes).

### 2.2 New components (`components/page/*` unless noted)

| Component | What it is | Reuses |
|---|---|---|
| `PageHero` | Inner-page banner; see the variants below | `Brush`, `Eyebrow`, `DonatHeading`/`VuHeading`, `RiseWords`, `AutoVideo`, `Flag`, `ProgrammeIcon` |
| `Breadcrumbs` | `Home › Section › Page`. Light and dark tones. Emits BreadcrumbList JSON-LD | `JsonLd` |
| `Section` | `<section>` with `tone` (`paper`/`white`/`vu-cream`/`cream-2`/`deep`/`forest`/`clay`/`coral`), `pad` (`lg`/`md`/`sm`), `cv` flag, `id` | `wrap` |
| `SectionIntro` | Eyebrow + heading + lead. `style="donat"` uses `DonatHeading` with a Caveat eyebrow; `style="vu"` uses `VuHeading` with a coral accent | `Eyebrow`, headings, `Reveal` |
| `CtaBand` | DoorsOpen generalised: deep band, floating hands, blobs, title/text/two buttons, optional emergency line | `DoorsOpen` markup |
| `FinalCta` | Coral VU band. Anton heading "Your Support Will Positively Impact a Child's Welfare and Future." (§3), with three buttons: **Donate Now** (`/donate`), **Become a Volunteer** (`/get-involved/volunteer`), **Request Support** (`/get-support/request`) | `Brush name="splash"`, `Button` |
| `Notice` | Safeguarding and disclaimer card. `tone="emergency"` (coral-700 left border, `ShieldAlert`, not dismissible), `"disclaimer"` (forest border, `Info`), `"review"` (marigold border, `ClipboardCheck`) | |
| `StepCards` | Journey's reveal-on-hover cards, generalised: `steps`, `tone` (`clay`/`forest`/`cocoa`), optional images; numbered `01–05` | `Journey` markup |
| `ShareRow` | Copy link · WhatsApp · Facebook · X · LinkedIn · Email. Uses the native `navigator.share` on mobile when available. Adds `utm_source=share&utm_medium=<channel>` | `SocialIcon` |
| `EmptyState` | Doodle illustration, title, text, actions | `DoodleField`, `HandDoodle` |
| `QuickExit` | "Leave this page quickly" button: fixed bottom-right on mobile, in the hero on desktop. Shift ×3 also triggers it (the GOV.UK exit-this-page pattern). Action: clear form state, then `location.replace("https://www.google.com/")` | |
| `ImageCredit` | Small "Illustrative image" chip over any image whose `content/media-credits.ts` entry has `childPlaceholder: true` (HANDOFF: donors must not mistake AI children for real beneficiaries) | |
| `JsonLd` (`components/seo/JsonLd.tsx`) | `<script type="application/ld+json">` with `JSON.stringify(x).replace(/</g, "\\u003c")` (docs: `02-guides/json-ld.md`) | |
| `Prose` | Long-form typography: Nunito 17/1.8, `h2` 28/800, `h3` 22/700, marigold bullet discs, Caveat pull quotes, rounded images, forest links | |
| `Toc` | Sticky contents for policies and long articles. Active heading via IntersectionObserver; scrolls with Lenis | |
| `FilterBar` | Category pills (the Appeals filter style: active `bg-clay text-white`), search input, select. Writes to the URL with `router.replace(…, { scroll: false })`. Falls back to a GET `<form>` without JS | |
| `Pagination` | Prev/next pills plus page numbers; `rel=prev/next` links | |
| `BioDrawer` | Right-side sheet for team bios (the MobileMenu dialog pattern, with a focus trap) | `MobileMenu` pattern |
| `SiteChrome` (`components/layout`) | Header + main + footer + ScrollTop | |
| `RouteScrollReset` (`lib/motion`) | On pathname change: Lenis `scrollTo(hash ? el : 0, { immediate: true, force: true, offset: -headerH })`, then `lenis.resize()` and `ScrollTrigger.refresh()` | |
| `AnchorLink` (`components/ui`) | Plain `<a href="#id">` that smooth-scrolls with Lenis using the sticky-header offset; native jump without JS | |

**`PageHero` variants.** All of them take `breadcrumbs`. The H1 always uses `RiseWords`, extracted from `Hero.tsx` into `components/ui/RiseWords.tsx`.

| Variant | Look | Used by |
|---|---|---|
| `photo` | Donat inner banner. Full-bleed image or video (`AutoVideo` with poster), night gradient `rgba(6,21,18,.55→.38→.62)`, Caveat eyebrow with marigold rules, H1 in white Nunito 800 (36/54/64px), lead, actions, breadcrumb pill (`bg-white/15 backdrop-blur ring-white/25`). Bottom edge: `Brush name="torn"` painted in the next section's colour. `data-nav-theme="glass"`. Height `min-h-[420px] md:min-h-[520px]`. Optional `icon` renders the Programmes icon tab (white disc, marigold half-ring) riding the torn edge | about, programmes, programme detail, get-involved, volunteer, partner, contact, projects |
| `editorial` | Voices United. `bg-vu-cream`, giant Anton uppercase H1 with one coral accent word, Inter lead. Optional media capsule on the right (`rounded-[70px]`, the Stories capsule) | impact, stories, news index, resources, faq, sponsor |
| `calm` | `bg-deep`, short (`py-16 md:py-20`), `CoralBlob` and `GreenBlobHeart` corners. **No photos.** H1 in white Nunito 800, lead, `QuickExit` slot, emergency `Notice` slot | get-support, request, report-a-concern, request-a-report, stories/share |
| `document` | `paper`, left-aligned, H1 Nunito 800 at 40px, meta row (date · version · reviewed), faint `HandsLineArt` | policies, resource detail, news article header (custom media below) |

### 2.3 Landing components to extract (refactor, do not fork)

Each landing section becomes a thin wrapper around an extracted component, so the landing stays pixel-identical. Verify with `node scripts/qa/shoot.mjs` before and after.

| From | Extract | Consumers |
|---|---|---|
| `Programmes.tsx` | `ProgrammeCard` | `/programmes`, home |
| `Appeals.tsx` | `AppealCard` (renamed `CauseCard`, takes a `Cause`), `FilterPills` | `/donate` cause list, `/impact`, `/programmes` |
| `Impact.tsx` | `StatCard` (tones clay, marigold, cocoa, plus forest and umber) | `/impact`, `/about` |
| `Journey.tsx` | `StepCards` | every "how it works" section |
| `Duo.tsx` | `DuoCard` | `/get-involved`, programme CTAs |
| `News.tsx` | `NewsCard` (adds `href`) | `/news`, related posts, home |
| `Stories.tsx` | `StoryCapsules` (takes `stories`), `StoryCard` | `/stories`, `/impact`, programme pages |
| `Projects.tsx` | `ProjectTile` (becomes a `Link`) | `/projects`, `/impact`, home |
| `Faq.tsx` | `FaqAccordion` (takes `items`) | `/faq`, `/get-support`, programme pages, `/donate` |
| `Testimonials.tsx` | add an `items` prop | `/about`, `/impact`, `/get-involved` |
| `Donate.tsx` | `Segmented` → `components/forms/Segmented.tsx`; the card → `DonateWidget` (§4.4) | `/donate`, home |
| `Hero.tsx` | `RiseWords`, `PlaceChip` → `components/ui` | `PageHero`, donate hero |
| `DoorsOpen.tsx` | `CtaBand` | support pages |

### 2.4 Form kit and form contract (`components/forms/*`, `lib/forms/*`)

**Components:**
- `Field` (label, hint, error, `aria-describedby`)
- `TextInput`, `TextArea` (with a counter), `Select` (styled like the landing's select with the chevron data-URI)
- `CountrySelect` (the `content/world.ts` countries first, then "Other country")
- `PhoneInput` (free text, `inputMode="tel"`, `autocomplete="tel"`)
- `RadioCards` (icon cards; roving tabindex)
- `CheckboxPills` (the landing in-kind chip style)
- `Segmented`, `ConsentCheckbox`, `FileDrop`
- `Stepper` (a "Step 2 of 4" label plus a marigold progress line; step titles on desktop)
- `FormErrorSummary`, `FormSuccess` (the landing's heart pulse-ring, an Anton "Thank you" and the reference chip)
- `Honeypot`

**Rules:**
- Labels are visible on every form page. The landing's placeholder-only donate fields are acceptable only inside the compact widget.
- **Inputs use `text-[16px]`.** Anything smaller triggers iOS Safari zoom on focus, and the landing widget's 14px fields have this bug. Use `text-[16px] sm:text-[14px]` in `DonateWidget`.
- Functional text must meet WCAG AA: labels, errors, help text and buttons. On form pages, put marigold buttons in `text-night` and small white-on-colour text on `coral-700`. HANDOFF records that the landing's brand pairings fail contrast. The decorative Caveat eyebrows stay as they are.
- Errors:
  - Validate fields on blur.
  - On submit, validate the step and move focus to `FormErrorSummary`, which links to each field.
  - Inputs get `aria-invalid`.
  - Server errors keep every value.
- Multi-step:
  - On mobile, Back/Continue sit in a sticky bottom bar.
  - On step change, focus moves to the step heading.
  - Steps validate independently.
  - Submit happens only on the last step.
- **No local drafts** on `/get-support/request` and `/report-a-concern`, because shared devices are a safety risk. Use a `beforeunload` warning when the form is dirty. Other forms may keep drafts in `sessionStorage` (wrapped in try/catch).
- Spam protection:
  - A `website` honeypot.
  - A hidden `startedAt`; reject submissions faster than 3 seconds.
  - A server-side per-IP rate limit (the backend doc), at most 5 submissions per 10 minutes per form.
  - No CAPTCHA in Phase 1. Cloudflare Turnstile is behind an env flag if spam appears.

**Contract (TypeScript):**

```ts
// lib/forms/state.ts
export type FormState<T = unknown> =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | { status: "success"; data: T };

// Every public Server Action: (prev: FormState, formData: FormData) => Promise<FormState<{ ref: string }>>
// Zod schemas in lib/forms/schemas.ts are imported by the client (instant validation) and the action (authoritative).
export type Ref = `HVN-${string}`; // 6 chars Crockford base32 (no I L O U), random, never sequential, never type-coded
```

Actions live in `app/(site)/_actions/*.ts` (`"use server"`):
- `submitSupportRequest`, `submitConcern`, `submitContact`, `submitVolunteer`, `submitPartner`
- `submitReportRequest`, `submitStory`, `subscribe`, `unsubscribe`

Each one validates, rate-limits, writes through the data layer, enqueues the email (§3.24), and returns `{ ref }`. Pages use `useActionState` (docs: `02-guides/forms.md`).

**Uploads** (support request: legal, medical or education documents only):
- Allowed: PDF, JPG or PNG, at most 10 MB each and at most 3 files.
- **Never** sent through a Server Action or function body. Vercel functions cap request bodies at about 4.5 MB, and the default Server Action limit is 1 MB (docs: `05-config/01-next-config-js/serverActions.md`).
- Flow: `POST /api/uploads/sign` returns `{ uploadId, url, headers }` for a direct, private PUT to Firebase Storage. In local fallback mode the URL is `PUT /api/uploads/local/[uploadId]`, which writes `.data/uploads/`. The form submits only the `uploadId`s.
- When storage is unavailable, `FileDrop` is replaced by: "If documents are needed, our team will ask you for them securely." This follows §6: "ask for them only with secure storage and access control."

### 2.5 Data contract the public pages consume

Public pages read **only** through `lib/data/public.ts` and never import `content/*.ts` directly. The exceptions are static UI copy (`content/nav.ts`, `content/pages/*.ts`). In local fallback mode these functions read `.data/*.json`, seeded from `content/*.ts`. The backend doc owns storage and caching. These shapes are the **public view-models**, and the data layer must strip private fields (for example `file.url` on controlled resources).

```ts
// lib/data/public.ts (signatures; all async, all cache-tagged per collection)
getSettings(): SiteSettings
getProgrammes(): Programme[];                 getProgramme(slug: ProgrammeSlug): Programme | null
getCauses(opts?: { status?: "active" | "all" }): Cause[];  getCause(slug: string): Cause | null
getImpactStats(): ImpactStat[];               getAnnualAllocation(): AllocationSummary | null
getPosts(o: { category?: PostCategory; page?: number; pageSize?: number }): { items: PostSummary[]; total: number }
getPost(slug: string): Post | null;           getAdjacentPosts(slug: string): { prev?: PostSummary; next?: PostSummary }
getResources(o: { category?: ResourceCategory; q?: string; access?: "public" | "controlled"; page?: number }): { items: ResourceSummary[]; total: number }
getResource(slug: string): Resource | null
getStories(o?: { programme?: ProgrammeSlug; featured?: boolean }): Story[]
getTestimonials(o?: { audience?: "donor" | "beneficiary" | "volunteer" | "partner" | "professional" }): Testimonial[]
getProjects(o?: { programme?: ProgrammeSlug; status?: ProjectStatus }): Project[];  getProject(slug: string): Project | null
getSponsorProfiles(o?: { category?: SupportCategory; ageRange?: AgeRange }): SponsorProfile[]
getFaqs(o?: { group?: FaqGroup; programme?: ProgrammeSlug }): Faq[]
getPolicy(slug: PolicySlug): Policy | null;   getTeam(): TeamMember[]
searchSite(q: string, limit?: number): SearchHit[]
```

Core types:

```ts
type Currency = "GMD" | "USD" | "GBP" | "EUR";           // existing, content/home.ts
type ProgrammeSlug = "child-protection" | "education" | "medical" | "counselling" | "legal" | "family-community";
type SupportCategory = "child-protection" | "education" | "medical" | "counselling" | "legal" | "food-supplies" | "family-support" | "other";
type ResourceCategory = "safeguarding" | "child-rights" | "parenting" | "wellbeing" | "education" | "medical" | "legal" | "policies" | "reports" | "research";
type Tone = "forest" | "marigold" | "clay" | "cocoa" | "coral" | "umber" | "deep";

type Programme = {
  id: ProgrammeIconName; slug: ProgrammeSlug; title: string; fullTitle: string; headline: string; summary: string;
  overview: string[]; problem: string[]; services: { title: string; text?: string }[];
  eligibility: { who: string[]; whatWeAsk: string[]; note: string };
  process: { title: string; text: string }[];
  notices: { tone: "emergency" | "disclaimer" | "review"; text: string }[];
  supportCategory: SupportCategory; resourceCategories: ResourceCategory[];
  contact: { team: string; email: string; phone?: string; hours?: string };
  heroMedia: { type: "image"; src: string } | { type: "video"; src: string; poster: string }; image: string;
  causeSlug: ProgrammeSlug;
};

type ImpactStat = {
  key: "children-supported" | "families-reached" | "school-fee-interventions" | "counselling-sessions"
     | "medical-cases" | "volunteers-partners" | "donations-received" | "donations-distributed";
  label: string; value: number; suffix?: string; currency?: Currency; note?: string; asOf: string; verified: boolean; tone: Tone;
};

type SiteSettings = {
  contact: typeof site.contact; emails: { support: string; safeguarding: string; donations: string; partnerships: string; media: string; privacy: string };
  hours?: string; registrations: { label: string; number: string }[];          // CLIENT: charity/NGO numbers
  emergencyContacts: { country: string; label: string; number: string; verified: boolean }[];  // only verified ones render
  responseTimes: { support: string; contact: string; reportRequest: string; volunteer: string }; // e.g. "5 working days" (CLIENT)
  figures: { hideUnverified: boolean };                                         // launch switch (§3.12)
  payment: {
    routes: Record<Currency, "stripe" | "local">;                               // admin choice; default GMD:"local"
    instructions: Partial<Record<Currency, PaymentInstruction>>;               // bank / mobile money, CLIENT
    fx: Record<Currency, number>;                                               // per 1 USD, admin-set, display-only
    coverFeesPercent: number;                                                   // default 3.5
  };
};
type PaymentInstruction = { bank?: { bankName: string; accountName: string; accountNumber: string; swift?: string; branch?: string }; mobileMoney?: { provider: string; number: string; name: string }[]; note?: string };
```

`Cause`, `Post`, `Resource`, `Story`, `Project`, `SponsorProfile`, `Policy` and `Faq` are defined where they are used (§3, §4).

### 2.6 Imagery per page type

- **Programme and about heroes.** Reuse what exists:

  | Page | Media |
  |---|---|
  | child-protection | `video("focus-1")` (caseworker at eye level) |
  | education | `img("focus-2")` |
  | medical | `video("focus-3")` |
  | counselling | `img("appeal-counselling")` |
  | legal | `img("focus-4")`, with `img("journey-verify")` as fallback |
  | family-community | `img("hero-family-pk")` |
  | about | `video("hero-1")` |
  | get-involved | `img("duo-volunteer")` |
  | partner | `img("duo-partner")` |
  | contact | `img("journey-orphanage")` |

- **New generations** go through `scripts/media/manifest.mjs`, follow the people-mix rules, and are fingerprinted. Never hard-code `/media/...`.
  - A hero for each of the 6 programme pages and for `/projects`.
  - Six project galleries (four images each).
  - Three or more news heroes.
  - Re-run `audit-mix`.
- **Support, concern and request pages use no photos of people.** Use hands, brush, blobs and doodles only (the `calm` hero). A child's face beside "report abuse" copy is inappropriate.
- **Sponsorship profiles never show a photo**, not even an AI one, because it would be read as the actual child. Use a tone disc with the programme icon and the age range set in Anton.
- **Resource covers** are illustrated: a brush shape, the programme icon and the title, rendered by a small `scripts/art/resource-covers.mjs` (sharp) or admin-uploaded. No people.
- **`ImageCredit`** appears on every `childPlaceholder` image outside the landing hero.

### 2.7 Motion on inner pages

Keep the landing's vocabulary and keep it cheap:
- `RiseWords` on H1s.
- `Reveal` and stagger on grids.
- `BrushReveal` on feature images.
- `Counter` and `ProgressBar` on numbers.
- Hover lifts as on the landing.

**No new GSAP pins**, except reusing `Focus` once on `/programmes`.

Route transitions use React `<ViewTransition>`, which works in the App Router with no config (docs: `02-guides/view-transitions.md`). This lands in Phase F, after the pages are stable:
- A 250 ms crossfade on `<main>`.
- Shared-element morphs:
  - news card image → article hero (`name="post-<slug>"`)
  - programme card icon → programme hero icon (`name="prog-<slug>"`)
  - cause card image → donate hero image (`name="cause-<slug>"`)
- Everything is disabled under `prefers-reduced-motion`.

---

## 3. Page specifications

Copy marked **[spec]** is quoted from `docs/CLIENT-SPEC.md`; use it verbatim. Copy marked **[draft]** is ours and must be confirmed by the client. Put it in `content/pages/<page>.ts` with a `// CLIENT` comment.

### 3.1 Home `/` (changes only)

- Section order is unchanged. Link retargeting is listed in §6.
- `Donate.tsx` renders `DonateWidget variant="landing"`, so the card **actually submits** (§4.10).
- `JoinSphere` calls the `subscribe` action.
- `content/home.ts` → `donate.inKind` is missing **"Bedding"** (§8 lists it). Add it after "Clothing".
- `about.vision` on the landing is a paraphrase. Keep it there (it's short), but `/about` uses the [spec] vision verbatim.
- Section `id`s stay, so `/#impact`-style deep links keep working.

### 3.2 About `/about`

1. **PageHero `photo`.** Media `video("hero-1")` with its poster. Eyebrow "About Haven". H1 **"Who We Are"**. Lead [spec §4, condensed]: "A non-profit protecting vulnerable children and supporting families in very difficult circumstances." Breadcrumb: Home › About Us.
2. **Who we are** (`bg-white`, the `About` split layout reused with its brush-cut photo and green frame). Heading: **"Restoring Hope One Child at a Time"** [spec §3]. Body [spec §4, expanded]:
   > Haven works with communities, professionals, donors and partners, connecting families to education, healthcare, counselling, economic inclusion and legal assistance. Our approach strengthens the environment around the child through direct assistance, family support, referrals, advocacy, community education and partnerships.

   Add the landing's second paragraph about The Gambia and beyond.
3. **Vision and Mission** (`bg-vu-cream`). Two large cards side by side, stacked on mobile.
   - Left: `bg-forest`, Anton label "VISION", quote [spec]: "Societies that cultivate safe, dignified, and economically inclusive environments, empowering every child to thrive and reach their full potential."
   - Right: `bg-clay`, Anton "MISSION", quote [spec]: "To protect vulnerable children, enhance their economic prosperity, and strengthen families by connecting them with education, healthcare, psychosocial support, legal assistance and sustainable community-based opportunities."
   - A Caveat marigold opening quote mark on each card. Both reveal with a stagger.
4. **Our values** (`paper`). `SectionIntro` (eyebrow "What Guides Us", heading "Our Values"). Seven `StatCard`-shaped tiles without numbers. Each has the value name in Anton plus a one-line [draft] description, in tones that cycle forest → marigold → clay → cocoa → deep → coral → umber:

   | Value | Description |
   |---|---|
   | Child-centred | "Every decision starts with the child's safety, dignity and best interests." |
   | Compassion | "We meet every child and family with kindness and without judgement." |
   | Integrity | "We do what we say, and we say what we do." |
   | Inclusion | "We serve children of every background, faith and ability." |
   | Accountability | [spec meaning] "We are transparent about our work, our finances and our impact." |
   | Collaboration | "Lasting change is built with communities, professionals and partners." |
   | Confidentiality | "Personal stories and records are protected and shared only with consent." |

   Grid: 2 columns on mobile, 4 on desktop (4 + 3, with the last row centred).
5. **How we work** (`id="approach"`). `Journey` reused as is, with title "How We Reach Every Child" (`content/home.ts → journey`).
6. **Founder.** The `Founder` section reused. Remove its "Our Story" button on this page (it would link to itself) and render the founder bio paragraph from §18 when supplied.
7. **Team** (`id="team"`). The `Team` carousel. Clicking a card opens `BioDrawer` with name, role, a 2–4 sentence bio, languages and socials. **No personal phone numbers or emails.** Bios are [CLIENT §18].
8. **Testimonials** (`Testimonials`, all audiences). Under the controls: a small line "Shared with permission." [§4].
9. **Partners** (`id="partners"`). The `Partners` strip plus a **Partner With Us** button (`/get-involved/partner`).
10. **Where we work** (`id="where-we-work"`). `WorldFlags` (the map and flag ribbon), followed by two office cards from `settings.contact.offices` with a "Get directions" link to Google Maps. No map embed, to avoid third-party cookies.
11. **`FinalCta`.**

### 3.3 Programmes index `/programmes`

1. **PageHero `photo`.** Media `img("journey-needs")`. Eyebrow "Our Programmes". H1 **"Care That Reaches Every Need"** (landing). Lead [spec §1]: "Protecting, assisting and supporting vulnerable children, families and other verifiable charitable organisations, through education, healthcare, psychosocial assistance, legal support and community-based interventions."
2. **Programme grid** (`paper`, `HandsLineArt`). Six `ProgrammeCard`s, as on the landing. "Learn More" → `/programmes/<slug>`. Each card adds a quiet text link "Request support →" (`/get-support/request?type=<category>`). Notices render in italic, as now.
3. **`Focus`** (the pinned "Protection · Education · Healing · Justice" chapter) reused unchanged. It is the one cinematic beat on inner pages.
4. **How we decide who we help** (`bg-white`). `SectionIntro` heading "Fair, Careful and Confidential". `Notice tone="review"` with [spec §6]: "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support." A second line [spec §6]: "Because of fraud, all information is checked and verified." Then `StepCards` (forest) with the five `journey.steps`.
5. **Fund a programme** (`bg-cream-2`). Six `CauseCard`s for the programme causes: image, the allocation mini-bar (§4.5) and "Give to this programme" (`/donate/<slug>`).
6. **`FinalCta`.**

### 3.4 Programme detail `/programmes/[slug]` (one template, six pages)

`generateStaticParams` returns the six slugs and `dynamicParams = false`. Type the page with `PageProps<"/programmes/[slug]">`. `params` is a Promise, so `await` it (docs: `03-file-conventions/dynamic-routes.md`). Unknown slugs call `notFound()`.

The template follows §5's nine parts, in its order:

1. **PageHero `photo`.**
   - Programme `icon` tab on the torn edge.
   - Eyebrow: `fullTitle`. H1: `headline`. Lead: `summary`.
   - Actions:
     - **child-protection:** primary **Report a Concern** (`/report-a-concern`, coral `vu` style with `ShieldAlert`), secondary **Request Support**.
     - **All others:** primary **Request Support** (`/get-support/request?type=<supportCategory>`), secondary **Support This Programme** (`/donate/<slug>`, `outline-light`).
   - Breadcrumb: Home › Our Programmes › {title}.
2. **Notices band.** Directly under the hero, before anything else; never collapsed (table below).
3. **Sticky section chips.** Overview · The Problem · Support · Eligibility · How It Works · Resources · Contact. On desktop the chips stick at `top: 88px` under the pill. On mobile they form a horizontally scrolling chip bar under the 68px sticky bar. Each chip is an `AnchorLink`, and the active chip is tracked by IntersectionObserver.
4. **Overview** (`id="overview"`, `bg-white`). `About`-style split with a brush-masked `image` and the `overview` paragraphs.
5. **The problem** (`id="problem"`, `bg-vu-cream`). `VuHeading` `["The", "Problem"]` and the `problem` paragraphs. No statistics unless they are cited and verified.
6. **Support provided** (`id="support"`, `paper`). Grid of service tiles: white `rounded-[26px]`, a forest check disc, title and optional text. The full [spec §5] list is used, not the landing's shortened one.
7. **Eligibility** (`id="eligibility"`, `bg-white`). Two columns: "Who can ask" (`who`) and "What we'll ask for" (`whatWeAsk`), then `Notice tone="review"` with `eligibility.note`. Plus "Not sure if you qualify? Ask us" → `/contact?category=programme&programme=<slug>`.
8. **How the process works** (`id="process"`). `StepCards` on `bg-clay` with `process`.
9. **Request support / partner or donate** (`bg-white`). Two `DuoCard`s:
   - Forest card: "Need This Support?" with **Request Support**.
   - Charcoal card: "Partner or Donate" with **Give to {title}** (`/donate/<slug>`) and **Partner With Us** (`/get-involved/partner?programme=<slug>`).
10. **Where your gift goes** (`bg-cream-2`). Compact `AllocationPanel` (§4.5) for this cause, plus three `ImpactExample` chips ("USD 25 = …") linking to `/donate/<slug>?amount=25&currency=USD`.
11. **Related resources** (`id="resources"`, `paper`). Three `ResourceCard`s from `resourceCategories`, plus "See all" → `/resources?category=<first>`. Empty state: hide the section.
12. **Stories** (`bg-vu-cream`). Up to three `StoryCard`s filtered by programme; hide the section if there are none.
13. **FAQs.** `FaqAccordion` with `getFaqs({ programme })`; hide if empty.
14. **Programme contact** (`id="contact"`). A card with the team name, email (mailto), phone, hours, and **Message the Programme Team** (`/contact?category=programme&programme=<slug>`). Never a staff member's personal name unless the client approves.
15. **`FinalCta`.**

The six programmes:

| Slug (`id`) | fullTitle [spec] | headline [spec] | Notices [spec] | Support category |
|---|---|---|---|---|
| `child-protection` (`protection`) | Child Protection & Abuse Prevention | Protecting Children From Harm | emergency: `site.emergencyNotice`; disclaimer: "This platform is not an emergency-response service." | child-protection |
| `education` | Education & School-Fee Assistance | Keeping Children in School | review: "Applications are assessed against eligibility, and submitting one does not guarantee approval." | education |
| `medical` | Medical Assistance | Connecting Children With Essential Healthcare | disclaimer: "We do not provide medical diagnoses or replace professional medical advice." | medical |
| `counselling` (`psychological`) | Psychological & Counselling Support | A Safe Space to Be Heard | disclaimer: "Assessments are made only by qualified professionals. There are no automated diagnoses." | counselling |
| `legal` | Legal Support & Referral | Helping Families Understand Their Options | disclaimer: "General website information is not legal advice." | legal |
| `family-community` (`family`) | Family & Community Support | Strengthening the World Around the Child | none | family-support |

Services, verbatim from [spec §5]:

- **child-protection**
  - Multidisciplinary safeguarding and coordinated statutory response
  - Awareness
  - Confidential concern reporting
  - Initial screening
  - Referral to protection services
  - Safeguarding resources
  - Parent and community education
  - Policies for partner institutions
  - Legal and psychosocial referrals
- **education**
  - Tuition and fee assistance
  - Hygiene products
  - Nutrition
  - Bedding
  - Uniforms and materials
  - Learning resources
  - Educational referrals
  - School readiness
  - Partner sponsorship
- **medical**
  - Medical referrals
  - Treatment-cost requests
  - Health information
  - Healthcare partners
  - Medical-supply assistance
  - Follow-up
- **counselling**
  - Counselling request form
  - Appointment scheduling
  - Video sessions with a link sent by email (the public wording for "Zoom link management")
  - Referral to approved professionals
  - Follow-up
  - Mental-health resources
- **legal**
  - Legal-support request form
  - Referral to approved legal professionals
  - Child-rights information
  - Case follow-up (the public wording for "case-status tracking for admins")
  - Secure document submission
- **family-community**
  - Referrals
  - Family guidance
  - Community engagement
  - Material assistance (food, bedding, essentials)

Problem paragraphs [draft], one per programme, with no statistics:

- **child-protection:** "Many children face harm, neglect or exploitation without a safe adult to tell or a clear route to help. Families and communities often don't know where to report a concern or what happens next."
- **education:** "School fees, uniforms, books and the cost of getting to class keep many children out of school, or force them to leave early. Each missed term makes it harder to return."
- **medical:** "When a child falls ill, families can struggle to reach the right clinic, afford treatment or keep up with follow-up care."
- **counselling:** "Loss, violence, poverty and upheaval can leave children and caregivers carrying deep distress, with few safe places to talk to someone qualified."
- **legal:** "Families caring for vulnerable children often face questions about guardianship, documents, inheritance or abuse, without knowing their rights or where to turn."
- **family-community:** "A child's wellbeing depends on the home and community around them. Hunger, unstable income and isolation put whole families under strain."

Process steps [draft]. Child-protection mirrors the §7 workflow in public language:

| Programme | Steps |
|---|---|
| child-protection | Tell us securely → Safeguarding review (authorised staff only) → Urgent cases escalated → Referral to protection services or authorities → Follow-up recorded |
| education | Apply → Review & verification → Decision ("submitting does not guarantee approval") → Support delivered ("fees are paid directly to the school") [CLIENT confirm policy] → Follow-up each term |
| medical | Request → Review (we may ask for documents; we never diagnose) → Referral to a healthcare partner or treatment-cost decision → Support (paid to the provider, or supplies) → Follow-up |
| counselling | Request → Matched with a qualified counsellor → Appointment confirmed (in person or by video; link sent by email) → Sessions → Follow-up or referral |
| legal | Request → Review → Information and referral to an approved legal professional → Secure document support → Follow-up |
| family-community | Reach out → We assess the family's needs together → Plan → Guidance, referrals or material help → Follow-up |

Eligibility [draft, CLIENT].

- Shared clause: "Children and families facing hardship in the communities we serve, or referred through a verified partner organisation."
- **education:** children aged roughly 4–18 who are enrolled in school or ready to start. We will later ask for a fee letter or invoice and proof of enrolment.
- **medical:** a referral or diagnosis from a qualified professional where one exists, plus a cost estimate.
- **counselling:** no documents needed, and anyone can ask, including young people.
- **legal:** documents only if relevant, uploaded securely.
- **child-protection:** anyone may report a concern, with no eligibility test.

### 3.5 Get Support `/get-support`

1. **PageHero `calm`.**
   - H1 **"You Do Not Have to Face It Alone"** [spec §6].
   - Lead [spec §6, worded]: "Whether you are a child, parent, caregiver, teacher, community member or professional, you can ask for help or refer a vulnerable child through a confidential request."
   - Actions: **Request Support** (marigold, night text) and **Report a Concern** (`outline-light` + `ShieldAlert`).
   - The emergency `Notice` sits inside the hero with [spec §7] text (`site.emergencyNotice`).
2. **What kind of help do you need?** (`paper`). Eight `RadioCards`-styled links. The six programme-aligned categories use `ProgrammeIcon`; food uses lucide `ShoppingBasket` and other uses `MessageCircleQuestion`. Labels [spec §6]: child-protection concern · education or school fees · medical · psychological or counselling · legal · food or essential supplies · family support · other.
   - Each card links to `/get-support/request?type=<category>`.
   - **Exception:** the child-protection card splits in two. The primary link, "Report a concern about a child" (`/report-a-concern`), is the default. The secondary, "Ask for protection support for my family", goes to `/get-support/request?type=child-protection`.
3. **What happens after you ask** (`bg-clay`, `StepCards`), with five steps:
   1. Submit securely
   2. We confirm we've received it (we contact you your preferred way)
   3. We review and verify
   4. We may ask for more information
   5. We connect you with support or a referral

   Below it, `Notice tone="review"` [spec §6]: "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support." and "Because of fraud, all information is checked and verified."
4. **Who can ask** (`bg-white`). Chips: Children and young people · Parents · Caregivers · Teachers · Community members · Professionals. Plus a soft card, "A note for children and young people" [draft]: "You can ask for help yourself. If you can, ask a trusted adult to help you fill in the form. If you are in danger right now, tell a trusted adult or call the emergency number where you live."
5. **Your privacy** (`bg-vu-cream`). Three tiles from §15:
   - "Only authorised staff can see your request."
   - "We only ask for what we need."
   - "You can ask us to correct or delete your information."

   Then a link to `/policies/privacy`.
6. **Questions** (`FaqAccordion`, group `support`).
7. **`CtaBand`.** "Prefer to talk first?" with phone and email, plus **Request Support**.

### 3.6 Request Support `/get-support/request`

**Layout:**
- `PageHero calm`, short. Eyebrow "Confidential request". H1 **"Request Support"**. Lead [draft]: "It takes about five minutes. Fields marked * are required."
- `QuickExit` in the hero.
- The emergency `Notice` sits above the form card and is always visible.
- The form card is white, `rounded-[30px]`, `max-w-[760px]`, on `paper`.

**Prefill:** `?type=<SupportCategory>` preselects step 1. It is read client-side inside `<Suspense>`, and invalid values are ignored.

**Steps** (fields [spec §6] in bold):

1. **What do you need help with?**
   - **Type of support***: `RadioCards`, 8 options.
   - If **child-protection** is selected, an inline interstitial appears: "Is a child being harmed or at risk of harm right now? Please use our confidential concern form instead." Buttons: [Report a concern] (navigates) and [I need support or guidance – continue].
   - **Urgency***: `Segmented` with Not urgent / Within a few weeks / Urgent (within days).
   - **Is anyone in immediate danger?***: Yes / No.
   - Choosing **Yes** shows an emergency `Notice` with [spec §7] text, the verified local emergency contacts from settings, and a [Report a concern] button. The visitor *may* still continue; the danger flag is stored and raises an alert in the admin.
2. **Tell us what's happening**
   - **Brief explanation***: `TextArea`, 30–2000 characters, with a counter. Hint [draft]: "Please don't include children's full names or exact home addresses. We'll ask for details we need later."
   - Category extras, all optional:

     | Category | Extras |
     |---|---|
     | education | the child's school level (select); approximate amount needed + currency |
     | medical | type of need (referral / treatment cost / medical supplies / health information); medical disclaimer `Notice` |
     | counselling | who the support is for (a child / a caregiver / the family); preferred language; preferred days (chips Mon–Sun); preferred time (morning / afternoon / evening); "Are you comfortable with a video call?" (yes / no / not sure); counselling disclaimer `Notice` |
     | legal | topic (guardianship / documents / inheritance / abuse or violence / other); `FileDrop` (≤3 files); legal disclaimer `Notice` |
     | food-supplies | household size; children in household (number) |
     | family-support, other | nothing extra |

   - `FileDrop` also appears for education and medical, as "Supporting documents (optional)". It only appears when storage is configured (§2.4). Copy [draft]: "Only upload documents if they help explain your situation. Files are stored securely and only authorised staff can see them."
3. **About you**
   - **Applicant's full name***.
   - **Relationship to the child***: parent / guardian or caregiver / grandparent / other relative / teacher / social worker or professional / community member / I am the young person / I represent an orphanage, children's home or charity / other.
   - **Phone** and **Email**. At least one is required; the error reads "Please give a phone number or an email so we can reach you."
   - **Location or country***: `CountrySelect`, plus "Town or area (general area only)".
   - **Preferred contact method***: Phone call / WhatsApp / SMS / Email. The option must match a contact detail that was given.
   - "Is it safe for us to contact you on these details?": Yes / No, please be careful. If "No" or "careful", a "Best time or way to reach you safely" text field appears.
4. **Review and send**
   - A read-only summary with an "Edit" link per step.
   - **Consent to be contacted***: "I agree that Haven may contact me about this request using the details I've given."
   - **Privacy acknowledgement***: "I have read the [Privacy Policy] and understand how my information is used and protected."
   - The review `Notice` [spec §6].
   - Submit: **Send My Request** (forest).

**States:**
- **Submitting:** the button shows a spinner and reads "Sending securely…", and the whole form is disabled.
- **Success** (`FormSuccess`): "Thank you. We've received your request." The reference chip (`HVN-7KQ2MX`) has a copy button and the line "Please keep this reference." Next comes "What happens next" (the three steps again) and "We aim to reply within {settings.responseTimes.support}." Then the emergency notice once more, and two buttons: **Back to Home** and **Explore Support Resources** (`/resources`). If an email was given, add "A confirmation has been sent to {masked email}."
- **Server error:** "Something went wrong and your request was not sent. Your answers are still here, so please try again. If it keeps happening, call us on {phone}." Every value is kept.
- **Rate-limited:** "You've sent several requests in a short time. Please wait a few minutes and try again."
- **Offline** (`navigator.onLine === false` on submit): "You seem to be offline. Your answers are safe on this page; reconnect and press Send again."

**Safeguarding:**
- No local drafts. A `beforeunload` guard warns when the form is dirty.
- Server-side, the record is role-restricted (Programme Officer). If `immediateDanger` is set or `type === "child-protection"`, the Safeguarding Officer is also alerted (the backend doc).

### 3.7 Report a Child-Protection Concern `/report-a-concern`

This page is separate from contact [spec §7]. Its tone is deliberately calm: `calm` hero, no doodles, no playful motion, a single column.

1. **PageHero `calm`.**
   - Eyebrow "Confidential". H1 **"Report a Child-Protection Concern"**.
   - Lead [draft]: "If you are worried about a child's safety or wellbeing, tell us here. Your report goes only to authorised safeguarding staff."
   - `QuickExit`, with the hint: "Need to leave quickly? Press Shift three times."
2. **Emergency banner.** Not dismissible; `Notice tone="emergency"`. Verbatim [spec §7]: "If a child is in immediate danger, contact the appropriate emergency, law-enforcement or child-protection authority immediately. Do not wait for a response from this website." Below it, `settings.emergencyContacts` where `verified === true`, grouped by country. **Unverified numbers never render.** Until any are verified, show only the notice.
3. **The form** (three steps; fields [spec §7] in bold).
   1. **The child and the concern**
      - **Child's approximate age***: under 5 / 5–9 / 10–13 / 14–17 / not sure.
      - **Location***: country (`CountrySelect`) plus "Town, area or place (anything that helps us reach the right services)". Visible only to safeguarding staff.
      - **Nature of the concern***: `CheckboxPills`:
        - physical harm
        - sexual abuse or exploitation
        - neglect
        - emotional abuse
        - child labour
        - trafficking
        - harmful practices (e.g. early or forced marriage, FGM/C)
        - online abuse
        - bullying
        - other
      - Then "What has happened or what are you worried about?"*: 30–4000 characters.
      - **Is the child in danger now?***: Yes / No / Not sure. Yes or Not sure re-surfaces the emergency banner inline.
      - **Have the authorities been contacted?***: Yes / No / Not sure; if Yes, an optional "Who did you contact?".
   2. **About you**
      - `Segmented`: "Share my details" / "Stay anonymous" (**reporter's name, or anonymous** [spec]).
      - **Anonymous** hides every personal field and shows a note [draft]: "Anonymous reports are taken seriously. We won't be able to contact you with questions or updates."
      - **Otherwise:**
        - **Name***.
        - **Contact details**: phone and/or email, at least one.
        - **Relationship to the child***: parent or guardian / relative / teacher / health worker / social worker / neighbour or community member / the child themself / other.
        - **Safe method and time for follow-up***: method (Phone / WhatsApp / SMS / Email) plus "When is it safe to contact you?" (free text).
   3. **Consent and send**
      - Consent and privacy statement* [draft]: "I understand that Haven may share this information with child-protection services or the authorities where needed to keep a child safe, and I have read the [Privacy Policy]."
      - Submit **Send Report Securely**.
4. **What happens next.** Shown under the form and repeated on success, in [spec §7] workflow language:
   1. Your report is sent securely.
   2. Authorised safeguarding staff are alerted.
   3. It is reviewed and given a risk level.
   4. Urgent cases are escalated.
   5. Services or authorities are contacted.
   6. Every action is recorded.

   Plus the line "Only approved safeguarding personnel can see reports."

**States:**
- **Success:** "Thank you for speaking up." Then the reference (for non-anonymous reports, so they can cite it), the emergency banner again, and **Back to Home** (with no "see related" links).
- **Error and rate limit:** the same as §3.6, but with the phone number shown prominently.

**Privacy controls:**
- No drafts, and no analytics events beyond the pageview.
- The confirmation email (non-anonymous with an email only) has the subject **"Your message to Haven"**, with no case detail in the subject [spec §14].
- Records go to the restricted collection, visible only to the Safeguarding Officer and Super Administrator roles [spec §7.7].
- Add `export const metadata = { referrer: "no-referrer" }` to this page.

### 3.8 Contact `/contact`

1. **PageHero `photo`.** Media `img("journey-orphanage")`. Eyebrow "Contact Us". H1 **"We'd Love to Hear From You"** [draft]. Lead [spec §11]: "Have a question, partnership proposal or request for general information? Send us a message and a member of the team will respond as soon as possible."
2. **Safeguarding redirect card** above the form: `Notice tone="emergency"`, compact. "Worried about a child's safety? Please don't use this form. Our confidential concern form goes straight to our safeguarding team." [Report a Concern] [spec §11: "Child-protection reports are redirected to the dedicated reporting form."]
3. **Two columns** (stacked on mobile; the form comes first on mobile).
   - **Left: contact cards.**
     - Offices: The Gambia and California, with address and "Get directions".
     - Phone, email and office hours.
     - Socials (the vertical rail style from the footer).
     - A small card: "Need help for a child? Request Support →".
   - **Right: the form** (fields [spec §11]).
     - **Full name***, **Location or country***, **Phone**, **Email***.
     - **Enquiry category***, from [spec] general · donation · partnership · volunteering · media · programme information · resource request · technical support, plus two of our own:
       - "Privacy or data request", which serves §15's "process to correct or delete information".
       - "I want to report a concern about a child", a pseudo-option. Choosing it **replaces the form** with the redirect card and a button to `/report-a-concern`, so it cannot be submitted here.
     - If the category is programme information, a Programme select appears.
     - **Subject***, **Message*** (20–3000 characters).
     - **Consent***: "I agree to Haven storing my details to respond to this enquiry. [Privacy Policy]".
     - Prefill from `?category=`, `?programme=` and `?subject=`.
4. **States:**
   - Success: "Thank you, {first name}. Your message has been sent. We usually reply within {responseTimes.contact}." This triggers the contact-confirmation email [spec §14].
   - Errors: as in §3.6.
5. **`FaqAccordion`** (group `about`, 4 items), then `FinalCta`.

### 3.9 Resources `/resources`

1. **PageHero `editorial`.** H1 `VuHeading ["Resources &", "Reports"]`. Lead [draft]: "Guides, policies and reports on child safeguarding, rights, parenting, wellbeing, education, health and the law, and our annual and programme reports."
2. **FilterBar** (sticky under the header on desktop).
   - Search (`q`).
   - Category pills, ten [spec §9]: child safeguarding · child rights and human rights · parenting and caregiving · mental health and wellbeing · education · medical information · legal information · organisational policies · annual and programme reports · research and publications.
   - Access select: All / Free download / On request.
   - All filters are URL-synced. Filtering happens client-side over the full list, which stays under 300 items. The server renders the unfiltered list for SEO.
3. **Featured.** The latest item in the `reports` category, as a wide card: cover, title, date, executive-summary excerpt, CTA.
4. **Grid of `ResourceCard`s** (3, 2 or 1 columns). Card fields [spec §9]:
   - cover image (4:3, illustrated)
   - category pill
   - publication date
   - title
   - short description
   - access badge: **Free download** (forest) or **On request** (clay + `Lock`)
   - CTA: **Download** (public) or **Request Full Report** (controlled); the whole card links to the detail page
   - Medical and legal cards carry their disclaimer line in small italics.
5. **Empty state:** "No resources match '{q}' in {category} yet." [Clear filters] [Ask us for a resource] → `/contact?category=resource`.
6. **`CtaBand`** (light variant). "Looking for a report that isn't listed?" with **Request a Report**.
7. **`Pagination`** at 12 per page, used when JS filtering is unavailable (SSR pages via `?page=`).

```ts
type Resource = {
  slug: string; title: string; category: ResourceCategory; cover: string; publishedAt: string;
  description: string; summary: string /* markdown: executive summary or preview */; previewImages?: string[];
  access: "public" | "controlled"; file?: { sizeBytes: number; pages?: number; format: "pdf" | "docx" }; // url never public for controlled
  programme?: ProgrammeSlug; featured?: boolean;
};
```

### 3.10 Resource detail `/resources/[slug]`

1. **PageHero `document`.** Category eyebrow, H1 title, and a meta row: date · category · format, pages, size · access badge.
2. **Two columns.**
   - **Left:** the cover (sticky on desktop) and preview images (lightbox).
   - **Right:** "Executive summary" (`Prose`) and an action panel:
     - **Public:** **Download PDF (2.3 MB)** → `GET /api/resources/[slug]/download`. It logs a download count (the admin "record activity") and streams or redirects to the file. Spec §9 says "non-sensitive public reports can be downloaded immediately."
     - **Controlled:** "This report is shared on request." Then a 4-step mini timeline [spec §9]: Request → Review → Approval → Emailed to you. Then an **inline `ReportRequestForm`** with the report locked (fields as §3.11).
3. A medical or legal disclaimer `Notice` when relevant.
4. Related resources (3, same category). `FinalCta`, light version.

### 3.11 Request a Report `/request-a-report`

- `PageHero calm`, short. H1 **"Request a Report"**. Lead [draft]: "Some reports are shared on request. Tell us what you need and why, and our team will review your request."
- The form (fields [spec §9]):
  - **Report***: a combobox over all resources, with controlled ones first and grouped by category, plus "Other / not listed" (which reveals a "Describe the report" field). `?report=slug` preselects.
  - **Name***, **Organisation**, **Email***, **Country***.
  - **Reason for the request***: 20–1500 characters.
  - Consent*.
- If the chosen report is public, the form swaps to "Good news: this one is free to download" with a [Download] button.
- Success: "Request received. We'll email {email} once it has been reviewed (usually within {responseTimes.reportRequest}). Reference {ref}." This triggers the resource-request confirmation email [spec §14].
- The same `ReportRequestForm` component and the `submitReportRequest` action back §3.10.

### 3.12 Our Impact `/impact`

1. **PageHero `editorial`.** H1 `VuHeading ["Together We Can", "Create Lasting", "Change"]` (heading [spec §3]). Lead: `impact.text`.
2. **The numbers** (`bg-vu-cream`). `StatCard` grid for the [spec §3] statistics:
   - children supported
   - families reached
   - school-fee interventions
   - counselling sessions facilitated
   - medical cases supported
   - volunteers and partners engaged
   - donations received and distributed (one wide card with two counters: Received and Distributed, in the stat's currency)

   Layout: a bento of 3 large cards and 4 medium. Each card shows "as of {Month YYYY}".
   **Verification rule** [spec §3, "Only verified figures may be shown"]:
   - `verified === false` → the card shows an "Illustrative" chip, plus a footnote under the section: "Figures marked illustrative are placeholders pending verification by our finance team." This matches the landing's current treatment.
   - `settings.figures.hideUnverified === true`, which is the launch switch the admin turns on → unverified stats **do not render at all**.
   - If fewer than three stats remain, replace the grid with `EmptyState`: "We're verifying our latest figures. Check back soon."
3. **Where the money went** (`bg-white`). From `getAnnualAllocation()`, the last financial year's spending by programme plus administration:
   - a horizontal stacked bar (segments in tone colours, animated fill on reveal)
   - a table version (accessible; also the no-JS fallback)
   - a link to the annual report (`/resources/<annual-report>`)

   The same verification rule applies. If the data is null, the section is hidden.
4. **Where we work.** `WorldFlags`.
5. **Projects.** The `Projects` section reused (latest 3), with "View All Projects" → `/projects`.
6. **Stories.** `StoryCapsules` (featured), with "See All Stories" → `/stories`.
7. **Appeals.** The `Appeals` carousel. On this page "Donate Now" goes to `/donate/<appeal-slug>`, not `#donate`.
8. **Reports.** Three `ResourceCard`s from `reports`, plus "All reports" → `/resources?category=reports`.
9. **Testimonials** (donors first). `FinalCta`.

### 3.13 Projects `/projects` and `/projects/[slug]`

```ts
type ProjectStatus = "upcoming" | "ongoing" | "completed";
type Project = {
  slug: string; title: string; subtitle: string; programme: ProgrammeSlug; place: string /* ISO */;
  status: ProjectStatus; startedAt: string; endedAt?: string; summary: string; body: string /* markdown */;
  heroImage: string; gallery: { src: string; alt: string }[]; outcomes?: { label: string; value: string; verified: boolean }[];
  causeSlug?: string; // set when the project is raising funds → donate deep link
};
```

**Index `/projects`:**
- **Hero.** `PageHero photo` with `img("project-1")`. H1 **"Our Projects"**. Lead [draft]: "Practical work on the ground: school drives, reading circles, health days and more."
- **Filters.** `FilterPills` by programme, plus a status `Segmented` (All / Ongoing / Completed / Upcoming).
- **Grid of `ProjectTile`s** with the marigold brush label wipe on hover and focus. On touch devices the label is **always visible**, since there is no hover. Each tile adds a flag chip, a status pill and a funding progress bar when `causeSlug` is set.
- **Empty state:** "No {status} projects in {programme} yet."

**Detail `/projects/[slug]`:**
- **Hero.** `PageHero photo` with `heroImage` and a `PlaceChip`.
- **Facts bar.** Programme (link) · country flag · dates · status · verified outcomes only.
- **Story.** `body` in `Prose`.
- **Gallery.** Masonry plus a lightbox, with `ImageCredit` where applicable.
- **Funding block.** If `causeSlug` is set: progress plus **Support This Project** → `/donate/<causeSlug>`.
- **Related.** Related news (same programme). `FinalCta`.

### 3.14 Stories `/stories` and `/stories/share`

```ts
type Story = { id: string; label: string; meta: string; programme?: ProgrammeSlug; place: string; text: string;
               image?: string; consentRef: string; publishedAt: string; featured?: boolean };
```

`consentRef` is required by the admin before a story can be published. It is never rendered.

**`/stories`:**
1. **PageHero `editorial`.** H1 `VuHeading ["Stories of", "Hope"]`. Lead (the landing copy): "Real change from families and communities across Africa, Asia and the Arab world, shared with consent and with every child's privacy protected."
2. **Featured.** `StoryCapsules` (the desktop accordion and mobile swipe cards, unchanged).
3. **All stories.** Masonry of `StoryCard`s: image, country flag, label · meta, paragraph. Each card has `id="s-<id>"` and a "Copy link" icon. Filter pills by programme.
4. **Consent banner** (`Notice tone="disclaimer"`) [spec §15]: "Every story is shared with written permission. We never publish children's names or exact locations."
5. **`CtaBand`.** "Has Haven made a difference for you?" with **Tell Your Story** → `/stories/share`.
6. **Testimonials.**

**`/stories/share`** (`calm` hero; H1 **"Share Your Story"**):
- Fields:
  - Your name* or a "Publish without my name" toggle.
  - You are a*: beneficiary or family member / donor / volunteer / partner / professional.
  - Country*.
  - Programme (optional).
  - Your story*: 50–1500 characters.
  - Email or phone* (to confirm before publishing).
  - Optional photo upload: **adults only**, via `FileDrop` when storage is available. Copy: "Please don't send photos of children. If your story involves a child, our team will arrange written consent before any photo is used." [§15]
- Consents*:
  - "I give Haven permission to edit and publish my story, without children's names or exact locations."
  - Conditional, if the story is about the submitter's own child: "I am the child's parent or legal guardian." Written consent is still arranged by staff before publishing.
- Success: "Thank you for sharing. A member of our team will read your story and contact you before anything is published."

### 3.15 News `/news`, `/news/[slug]`, `/news/rss.xml`

```ts
type PostCategory = "education" | "safeguarding" | "health" | "partnerships" | "impact" | "stories" | "appeals" | "events" | "announcements";
type Post = {
  slug: string; title: string; dek: string; category: PostCategory; body: string /* markdown */;
  heroImage: string; heroAlt: string; publishedAt: string; updatedAt: string; readingMinutes: number;
  author: { name: string; role?: string }; reviewedBy?: string; aiAssisted: boolean;
  relatedCause?: string; relatedProgramme?: ProgrammeSlug; seo?: { title?: string; description?: string };
};
```

Body rendering: Markdown via `react-markdown` + `remark-gfm` with **no raw HTML** (skip `rehype-raw`), so AI-drafted content can't inject markup. The admin doc owns authoring.

**Index:**
- **PageHero `editorial`.** H1 `VuHeading ["News &", "Updates"]`. Lead [landing]: "Fresh impact updates and stories of hope, published every month."
- **Featured.** The newest post as a wide horizontal card.
- **Filters and grid.** Category `FilterPills` (`?category=`), then a `NewsCard` grid (whole card clickable, "Read More" → `/news/<slug>`), `Pagination` at 9 per page.
- **Newsletter.** `JoinSphere` (working subscribe).
- **Empty category:** "No {category} posts yet." with a link to all news.
- **RSS.** A link to `/news/rss.xml`, plus `alternates.types['application/rss+xml']` in metadata.

**Article:**
1. Header (`document` style). Category pill (links to the filtered index), date, reading time, H1 title (Nunito 800, 34/46px), dek.
2. Hero image, full `wrap` width, `rounded-[30px]`, with a bottom brush edge `Brush name="band"` in `paper`.
3. Body in `Prose`, max width 720px. On desktop a sticky `ShareRow` runs down the left rail; on mobile it sits under the header.
4. A contextual **donate card** after the body. It uses `relatedCause` (or the programme cause, or general): a mini `CauseCard` with "Give to {cause}".
5. Byline box. Author or team, plus, when `aiAssisted`, the line [draft]: "This article was prepared with the help of AI tools, then reviewed and approved by the Haven team." This is default-on transparency; see Open questions.
6. Related posts (3, same category), prev/next links, `FinalCta` (light).
7. The `opengraph-image.tsx` renders a branded card (§7.4).

**Editorial safeguarding check** (enforced by the admin review checklist, restated here because the page must not violate it): no child's name, no exact location, and consent for every child image.

### 3.16 Get Involved `/get-involved`

1. **PageHero `photo`.** Media `img("duo-volunteer")`. Eyebrow "Get Involved". H1 **"There Are Many Ways to Help"** [draft]. Lead [spec §3]: "Donate (one-time or recurring), Give in Kind, Volunteer, Partner With Us." Render this as a sentence: "Donate once or every month, give in kind, volunteer your skills or partner with us. Every kind of help strengthens the world around a child."
2. **Ways to help.** A 2×2 `DuoCard` grid in alternating tones (forest, charcoal, clay, cocoa):

   | Card | Link |
   |---|---|
   | Donate | `/donate` |
   | Give in Kind | `/donate?mode=in-kind` |
   | Become a Volunteer | `/get-involved/volunteer` |
   | Partner With Us | `/get-involved/partner` |

   Then a wide coral card, **Sponsorship**, linking to `/get-involved/sponsor`.
3. **Volunteer interests** (`paper`). The ten [spec §10] chips (community outreach · education support · counselling or psychosocial services · medical assistance · legal assistance · fundraising · communications · research · administration · technology support). Each chip links to `/get-involved/volunteer?interest=<id>`.
4. **Partnership types.** The eight [spec §10] chips, linking to `/get-involved/partner?type=<id>`.
5. **`Restoring`** (stats block and film) reused.
6. **Testimonials** (volunteers and partners). `FinalCta`.

### 3.17 Volunteer `/get-involved/volunteer`

**Page sections:**
- `PageHero photo` (`img("duo-volunteer")`). H1 **"Become a Volunteer"**. Lead [landing duo]: "Contribute professional skills, time or community support: outreach, education, counselling, medical, legal, fundraising and more."
- **What to expect.** `StepCards`, the [spec §13] volunteer workflow in public words: Apply → Screening → Interview → Approval → Onboarding → Active.
- **Safeguarding commitment** `Notice` [draft]: "Volunteers who work with children complete safeguarding training and background checks before they begin."

**Form** (three steps):
1. **About you**
   - Full name*, email*, phone*, country*, town or area.
   - "I am 18 or older"*. If unchecked: "Thank you! Volunteering is for adults, but you can still help. [Ways young people can help →]", which links to `/get-involved`.
   - Languages (chips: English, Wolof, Mandinka, Fula, French, Arabic, Hindi or Urdu, Tagalog, Other) [draft].
2. **How you'd like to help**
   - Interests* (`CheckboxPills`, the 10 [spec], preselected from `?interest=`).
   - Profession or skills.
   - Where: In person (The Gambia) / Remote / Either.
   - Availability: Weekdays / Weekends / Evenings, plus hours per month.
   - "Have you worked with children before?" (Yes / No; if Yes, a brief description).
   - Motivation*: 30–1000 characters.
3. **Consent**
   - Consent to be contacted*.
   - Privacy acknowledgement*.
   - Safeguarding acknowledgement*: "I understand that volunteers working with children must complete safeguarding checks."

**Success:** "Thank you for offering your time! We'll be in touch within {responseTimes.volunteer}." This triggers the volunteer acknowledgement email.

No CV upload in Phase 1, under the minimal-data principle [§15]. It is collected at screening.

### 3.18 Partner `/get-involved/partner`

**Page sections:**
- `PageHero photo` (`img("duo-partner")`). H1 **"Partner With Us"**. Lead [landing]: "Support programmes through institutional partnerships, corporate sponsorship, technical assistance or research collaboration."
- **Partnership types.** Eight cards [spec §10] with one-line [draft] descriptions:
  - programme partnership
  - corporate sponsorship
  - technical assistance
  - institutional referral
  - research collaboration
  - donation partnership
  - awareness campaign
  - other
- **Hint card:** "Run an orphanage, children's home or charity and need support? Choose 'Institutional referral'. We'll arrange a verification call or visit." This ties to the founder's "We verify" step and to §1's "other verifiable charitable organisations".
- **How partnership works.** `StepCards`: Enquiry → Introductory call → Due diligence ("Haven verifies every partner organisation before any agreement" [draft]) → Agreement → Work together and report.
- **Partners strip.**

**Form fields:**
- Organisation name*.
- Organisation type*: NGO or charity / orphanage or children's home / company / school or university / faith-based organisation / healthcare provider / legal practice / government / other.
- Website, country*.
- Contact person*, role, email*, phone.
- Partnership type* (`RadioCards`, from `?type=`).
- Programme of interest (from `?programme=`).
- Proposal summary*: 50–2000 characters.
- How did you hear about us?
- Consent*.

**Success:** "Thank you. Our partnerships team will reply within {responseTimes.contact}." This triggers the partnership acknowledgement email.

### 3.19 Sponsorship `/get-involved/sponsor`

The spec rule, quoted on the page [spec §10]:

> Public profiles show only an anonymous beneficiary reference, a general age range, a broad support category, the funding need and programme-level updates. There is no direct private contact between donors and children, and no names, precise locations or medical histories.

```ts
type AgeRange = "0-4" | "5-9" | "10-13" | "14-17";
type SponsorProfile = {
  ref: string /* "HVN-S-7KQ2" */; ageRange: AgeRange; category: SupportCategory; country?: string /* ISO, broad only */;
  need: string /* "School fees, uniform and materials for the school year" */;
  monthly: { amount: number; currency: Currency }; sponsorsNeeded: number; sponsorsCurrent: number;
  programme: ProgrammeSlug; lastUpdate?: string /* programme-level only */; status: "open" | "funded";
};
```

**Page sections:**
1. **`PageHero editorial`.** H1 `VuHeading ["Sponsor a", "Child's", "Future"]`. Lead [draft]: "Give monthly to cover a child's assessed needs through our programmes, with regular programme updates and every child's privacy protected."
2. **How sponsorship works.** `StepCards` (cocoa): Choose a profile → Give monthly → We deliver support through the programme → You receive programme-level updates.
3. **Our privacy promise** (`Notice tone="disclaimer"`, large). The spec quote above, plus "That's why our profiles have no photos."
4. **Profiles grid.**
   - Filters: category and age range.
   - Each card: a tone disc with the `ProgrammeIcon`, the age range in large Anton ("10–13"), the reference, the category pill, the country flag (optional), `need`, "USD 30 / month", sponsor slots ("1 of 2 sponsors"), and **Sponsor Monthly** → `/donate/sponsor-a-child?ref=<ref>&frequency=monthly&amount=<amount>&currency=<cur>`.
   - Funded profiles show a "Fully sponsored, thank you!" ribbon and sort last.
5. **Empty state:** "Every current profile is fully sponsored. Thank you!" [Give to the Sponsorship Fund] → `/donate/sponsor-a-child`.
6. **FAQ.** Includes "Can I write to or visit the child?": "No. To keep children safe there is no direct contact between sponsors and children. You'll receive programme-level updates instead." Then `FinalCta`.

### 3.20 FAQ `/faq`

```ts
type FaqGroup = "support" | "safeguarding" | "donations" | "involved" | "about";
type Faq = { id: string; group: FaqGroup; q: string; a: string; programme?: ProgrammeSlug; order: number };
```

- `PageHero editorial`, with H1 `VuHeading ["Have Any", "Questions", "For Us?"]`.
- Client-side search over questions and answers.
- Group pills: Getting support · Safeguarding & privacy · Donations · Volunteering & partnerships · About Haven.
- `FaqAccordion` per group, each with an `<h2>`.
- Seed the groups from the eight existing `content/people.ts → faq` items.
- **"Still have a question?"** `CtaBand` with **Contact Us**, plus FAQPage JSON-LD.
- **Empty search:** "No answers match '{q}'. [Ask us →]" (`/contact?subject=<q>`).

### 3.21 Policies `/policies`, `/policies/[slug]`

```ts
type PolicySlug = "safeguarding" | "privacy" | "terms";
type Policy = { slug: PolicySlug; title: string; summary: string[]; body: string /* markdown */; version: string;
                lastReviewed: string; reviewedBy?: string; status: "draft" | "approved"; pdfUrl?: string };
```

**Index `/policies`:** three cards (title, summary, last reviewed, Read / Download PDF), plus a link to `/resources?category=policies` for partner-institution policies.

**Detail layout:**
- `PageHero document`. H1 title, meta "Version 1.0 · Last reviewed 1 October 2026 · Reviewed by {reviewedBy}", and **Download PDF** when `pdfUrl` is set.
- **If `status === "draft"`:** a marigold banner reading "Draft, pending professional review." Spec §15 requires "Professional review of policies".
- **"In plain words"** box (`bg-cream`, the `summary` bullets).
- **Two columns:** `Toc` (sticky, desktop) and `Prose` body.
- **Footer card:** "Questions about this policy? Email {settings.emails.safeguarding | privacy}." For safeguarding, also **Report a Concern**.

Required headings for the client and legal drafter. Ship [draft] text under each heading, marked clearly.

| Policy | Required headings |
|---|---|
| **Safeguarding** | Our commitment · Who this policy applies to · Definitions · Safe recruitment and volunteer checks · Code of conduct · Consent for images and stories (§15: "Written parent or guardian consent before publishing children's images or stories"; no full names or precise locations) · Online safety · How to report a concern (link) · How we respond (the §7 workflow) · Designated Safeguarding Officer · Partner institutions · Review |
| **Privacy** | Who we are · What we collect (form by form) · Why and on what basis · Who can see it (role-restricted access, §12) · Children's information · Payments ("we never store card details"; Stripe) · Cookies (essential only; cookieless analytics) · Processors (Google Firebase, Stripe, Vercel, email provider, Zoom) and international transfers · **Retention periods** (a table per record type; §15 "Defined retention periods") · Security (HTTPS, MFA for staff, activity log, backups) · **Your rights: correct or delete** (§15), with a button to `/contact?category=privacy` · Contact · Changes |
| **Terms of Use** | Using this site · Not an emergency service (`site.emergencyNotice`) · No medical or legal advice (the programme disclaimers) · Donations, receipts, refunds and recurring cancellation · Submissions and accuracy (fraud checks) · Content and copyright · Illustrative imagery (AI) statement · Liability · Governing law [CLIENT] · Contact |

### 3.22 Search: the overlay and `/search`

- **`SearchOverlay`.** Typing debounces at 200 ms and calls `GET /api/search?q=` for the top 8 hits, grouped by type (Programme · Page · Resource · News · Story · FAQ). Each hit shows its type icon, title and a snippet. Enter goes to `/search?q=`.
- **Suggestion chips become links:**

  | Chip | Link |
  |---|---|
  | Request support | `/get-support/request` |
  | School-fee assistance | `/programmes/education` |
  | Counselling | `/programmes/counselling` |
  | Report a concern | `/report-a-concern` |
  | Volunteer | `/get-involved/volunteer` |
  | Annual report | `/resources?category=reports` |
- **`/search?q=`.** A server-rendered, `noindex` page using `searchSite(q, 50)`.
  - Empty query: popular links.
  - No results: "Nothing found for '{q}'." with the same chips and **Contact Us**.
- **Index.** Built in memory from the data layer: titles, summaries and headings, under 500 documents. **Never indexes** support requests, concerns or any private collection.

### 3.23 404, error, `/unsubscribe`

- **`not-found.tsx`** (both the root and `(site)` versions):
  - `paper`, with `Brush name="splash"` in marigold.
  - Caveat line "Let's get you somewhere safe", Anton H1 "PAGE NOT FOUND", and a search input.
  - Buttons: Home, Donate, Request Support, Report a Concern.
  - `metadata.robots = { index: false }`.
- **`error.tsx`:** "Something went wrong on our side." with [Try again] (`reset()`), Home, and the phone number.
- **`/unsubscribe?token=`:** confirms with "You've been unsubscribed. We're sorry to see you go." and an undo button. An invalid token gets: "This link has expired. Email {email} and we'll remove you."

### 3.24 Emails triggered by public pages (§14)

The email doc owns templates and sending. This table fixes the triggers and the **non-sensitive subjects**.

| Trigger | To submitter (subject) | To staff (subject; role) |
|---|---|---|
| Support request | "We've received your request" | "New support request {ref}" (Programme Officer; plus Safeguarding Officer if danger or child-protection) |
| Concern (with email, not anonymous) | "Your message to Haven" | "Action needed: new confidential report" (Safeguarding Officer and Super Admin only) |
| Cash pledge / Stripe paid / in-kind offer | "Thank you for your pledge to Haven" / "Thank you for your gift: receipt {ref}" / "Thank you for offering items to Haven" | "New donation {ref}" / "New in-kind offer {ref}" (Finance) |
| Report request | "We've received your report request" (and on approval: "Your requested report from Haven") | "New report request {ref}" (Report Manager) |
| Volunteer / Partner / Contact / Story | "Thank you for offering to volunteer" / "Thank you for your partnership enquiry" / "We've received your message" / "Thank you for sharing your story" | "New volunteer application", "New partnership enquiry", "New message: {category}", "New story submission" |
| Subscribe | "Welcome to Haven updates" | none |

---

## 4. The donate experience, in depth

### 4.1 URL grammar (the shareable link)

```
/donate                                   general ("Where it's needed most"), cause picker suggested
/donate/[cause]                           cause preselected; the canonical shareable URL
   ?amount=50                             major units, validated against min/max for the currency
   &currency=USD                          GMD | USD | GBP | EUR
   &frequency=monthly                     once | monthly | quarterly | annual
   &mode=in-kind                          cash (default) | in-kind
   &ref=HVN-S-7KQ2                        sponsorship profile (only with cause sponsor-a-child)
   &cancelled=1                           set by Stripe cancel_url
   &utm_source=…&utm_medium=…&utm_campaign=…   stored on the donation for campaign attribution
/donate/thank-you?session_id=cs_…         after Stripe
/donate/thank-you?ref=HVN-…&t=<hmac>      after a pledge or in-kind offer (token prevents ref guessing)
```

- **Invalid params are ignored silently, never with an error.** Examples: an unknown currency, an amount below the minimum, a `ref` with the wrong cause.
- **The URL is state.** Changing cause, currency, frequency or amount calls `router.replace(…, { scroll: false })`, so copying the address bar always shares exactly what the donor sees. The `ShareRow` shares the cause URL **without** amount params, plus `utm_source=share`.
- **The page stays static.** Params are read in the client widget via `useSearchParams` inside `<Suspense>`, with the widget skeleton as the fallback. `generateStaticParams` returns all active cause slugs, and `dynamicParams = true` lets admin-created appeals work without a rebuild. A closed cause renders with a "This appeal has closed, thank you!" banner, and the widget falls back to `general`. Unknown slugs call `notFound()`.

### 4.2 The `Cause` model

```ts
type CauseKind = "general" | "programme" | "appeal" | "project" | "sponsorship";
type Frequency = "once" | "monthly" | "quarterly" | "annual";
type AllocationLine = { label: string; percent: number; description?: string; tone: Tone };
type ImpactExample = { amount: number; currency: Currency; outcome: string };   // "school supplies for one child for a term"

type Cause = {
  slug: string; kind: CauseKind; title: string; eyebrow?: string /* "Seasonal appeal · Ramadan" */;
  summary: string; story?: string /* markdown, left column */; image: string; place?: string;
  goal?: { amount: number; currency: Currency; raised: number; verified: boolean; endsAt?: string };
  allocation: AllocationLine[]; allocationAsOf: string; allocationVerified: boolean;   // percents sum to 100
  examples: ImpactExample[];
  presets?: Partial<Record<Currency, number[]>>;     // default: content/home.ts donate.currencies[c].amounts
  defaultFrequency?: Frequency;                      // sponsorship → "monthly"
  allowedFrequencies?: Frequency[];                  // default all four
  inKindItems?: string[];                            // e.g. Eid appeal → ["Clothing", "School materials"]
  zakatEligible?: boolean;                           // Ramadan/Eid; shows a Zakat note (see Open questions)
  programme?: ProgrammeSlug; group?: "Ramadan & Eid" | "Christmas" | "Thanksgiving" | "Year-round";
  status: "active" | "closed"; order: number;
};
```

**Seed** (`content/causes.ts`, then `.data/causes.json`):
- `general`.
- The six programme slugs.
- The eight appeals, with slugs `ramadan-food-packs`, `eid-clothes-gifts`, `christmas-gift-boxes`, `thanksgiving-family-meals`, `keep-children-in-school`, `medical-fund`, `counselling-sessions`, `sponsor-a-child`. Their `title`, `place`, `goal` and `image` come from `content/home.ts → appeals`.
- Add `slug` to each appeal item so the landing can link it (§4.10).

**Placeholder allocations and examples.** These are [draft], and every one must be confirmed by the finance team. Until then `allocationVerified: false` and the figures carry an "Illustrative" chip (§4.5).

| Cause | Allocation (%) | Examples |
|---|---|---|
| `general` | Education 30 · Medical 15 · Child protection 15 · Family & community 15 · Counselling 10 · Legal 5 · Admin & payment fees 10 | USD 25 = school supplies for one child for a term · USD 50 = a month of food staples for a family · USD 100 = four counselling sessions |
| `education` | School fees & tuition 55 · Uniforms, books & materials 20 · Hygiene, nutrition & bedding 10 · Follow-up visits 7 · Admin & fees 8 | USD 25 = school supplies for one child for a term · USD 60 = a uniform, shoes and a school bag · USD 120 = a term's school fees for one child |
| `medical` | Treatment costs 60 · Medicines & supplies 20 · Transport to care 8 · Follow-up 4 · Admin & fees 8 | USD 20 = transport to a clinic and back · USD 50 = a course of prescribed medicine · USD 150 = towards a child's treatment |
| `counselling` | Counsellor sessions 70 · Training & supervision 12 · Video-call costs 5 · Follow-up 5 · Admin & fees 8 | USD 15 = one counselling session · USD 60 = four sessions with a qualified counsellor |
| `eid-clothes-gifts` (GMD) | Clothes & shoes 70 · Gifts 15 · Distribution 7 · Admin & fees 8 | GMD 1,500 = Eid clothes for one child · GMD 3,000 = clothes and a gift for two children |

### 4.3 Page layout and the persistent widget

```
app/(site)/donate/
  (give)/
    layout.tsx        # <DonateStateProvider> + two-column shell + sticky <DonateWidget/> (reads useParams().cause)
    page.tsx          # general cause: left column content
    [cause]/page.tsx  # cause: left column content
    [cause]/opengraph-image.tsx
  thank-you/page.tsx  # outside (give): no widget, no shared state
```

**Why a layout.** Layouts persist across sibling navigations. When the donor switches cause, `/donate/education` → `/donate/medical` swaps only the left column, and the widget keeps its amount, currency, step and typed details (docs: `01-getting-started/03-layouts-and-pages.md`; `04-linking-and-navigating.md`, "Keeping any shared layouts").

**Desktop (≥1024px).** A `paper` band runs at the top. The grid is `lg:grid-cols-[minmax(0,1fr)_460px] gap-12`. The right column is `position: sticky; top: 104px` (under the stuck pill). The left column scrolls through the sections in §4.5. Lenis drives native scroll, so `sticky` works.

**Mobile.**
- Order: the hero summary (eyebrow, H1, image, progress), then **the widget**, then the left-column sections.
- A **sticky bottom bar** appears once the widget scrolls out of view. It reads "Donate USD 50 monthly" with a heart icon, or "Choose an amount" before an amount is set, and scrolls back to the widget.
- The bar hides while any form field has focus, because the keyboard is open.

**Left column, top block (the "give hero"):**
- `Breadcrumbs` (Home › Donate › {cause}).
- Caveat eyebrow: the cause kind ("Programme", "Seasonal appeal · Ramadan", "Where it's needed most").
- H1 (Nunito 800, 34/48px): the cause title. For general it is **"Give Hope, Create Opportunity"** with the lead [spec §8]: "Your contribution will help a vulnerable child return to school, gain economic empowerment, live with dignity, access medical care, receive counselling and obtain essential protection and family support."
- The cause image inside `BrushReveal name="patch"` with `ViewTransition name="cause-<slug>"`.
- `PlaceChip`.
- `ProgressBar` with "Raised USD 2,900 of USD 5,500", only when `goal` is set; the "Illustrative" chip applies when unverified.
- `ShareRow` labelled "Share this appeal".
- `?cancelled=1` shows a sand banner above everything: "Your payment was cancelled and nothing was charged. Your choices are saved below."

### 4.4 `DonateWidget` (`components/donate/DonateWidget.tsx`, client)

Props: `variant: "page" | "landing"`. The state lives in `DonateStateProvider` on `/donate`, and in local state on the landing.

```ts
type DonateState = {
  cause: string; mode: "cash" | "in-kind";
  currency: Currency; frequency: Frequency; amount: number | null; other: string; coverFees: boolean;
  items: string[]; itemsDescription: string; itemCondition: "new" | "good-used" | "mixed"; estValue?: number;
  handover: "drop-off" | "collection" | "shipping"; handoverLocation: string;
  donor: { name: string; email: string; phone: string; country: string; type: "individual" | "organisation";
           organisation: string; anonymous: boolean; comments: string; updates: boolean };
  step: "choose" | "details" | "redirecting";
};
```

The visual language is the landing card unchanged: white `rounded-[30px]`, `Segmented` controls in Inter caps, coral selection rings and the coral CTA.

**Step 1: Choose.**
1. **"Giving to" row.** Cause thumbnail (32px circle), title, and a **Change** button.
   - The button opens `CausePicker`: a bottom sheet on mobile, a 560px popover dialog on desktop, with a focus trap.
   - Its tabs (`Segmented`) are Most needed · Programmes · Appeals · Projects.
   - Each item shows the image, title, a one-liner, a mini progress bar (if there is a goal) and a season chip.
   - Choosing an item calls `router.push('/donate/<slug>?<preserved>', { scroll: false })` (the layout persists, §4.3).
   - On the landing variant, the picker is a `<select>` like today's.
2. **Type.** `Segmented`: Cash gift | Give in kind.
3. **Cash:**
   - **Currency.** `Segmented` GMD | USD | GBP | EUR. The default resolves in this order:
     1. the URL
     2. the last choice, from `localStorage` (try/catch)
     3. a time-zone guess: `Africa/Banjul` → GMD; `Europe/London` → GBP; eurozone zones → EUR
     4. USD

     Changing currency clears the amount, as today.
   - **Frequency.** `Segmented` One-time | Monthly | Quarterly | Annual [spec §8]. The cause's `defaultFrequency` preselects it (sponsorship → Monthly).
   - **Amount.** Six presets (cause `presets` or the currency defaults) plus **Other**. Minimums follow `donate.currencies[c].min` (GMD 100, others 5). Online maximums are GMD 500,000 and USD, GBP or EUR 10,000. Above that the widget shows: "For gifts of this size we'll help you give by bank transfer. [Contact our team]" This also limits card-testing abuse.
   - **Impact hint**, a live sand pill under the amounts with a `Heart` icon. It shows the largest `examples` entry whose amount is at or below the chosen amount, in the selected currency: "USD 50 can provide: school supplies for one child for a term." If there is no example in this currency, use the base example converted with `settings.payment.fx`, rounded to a "nice" number and prefixed "about".
   - **Where it goes.** A compact 6px stacked bar of `allocation` with a 3-item legend ("55% school fees · 20% materials · 25% other"). Its "See full breakdown" link is an `AnchorLink` to `#where-it-goes`, which is `/donate/<cause>#where-it-goes` on the landing.
   - **Cover fees checkbox**, default off: "Add {pct}% ({money}) to cover payment fees, so all of my gift reaches the cause."
   - **Updates consent checkbox** (the existing one) [spec §8: "consent to updates"].
   - **CTA:** "Continue", which leads to the details step.
4. **In kind** [spec §8 list, including **Bedding**]:
   - `CheckboxPills`: school materials · clothing · bedding · food supplies · medical supplies · computers or learning devices · furniture · professional services · other approved items. A cause's `inKindItems` are pre-checked.
   - "Describe what you'd like to give"*: 20–1000 characters.
   - Condition: New / Good used / Mixed.
   - Estimated value (optional) with a currency [spec: "amount or estimated in-kind value"].
   - Handover: Drop off at an office / Request collection / Ship to us, plus "Town or city".
   - Medical-supplies note [draft]: "Medical supplies must be sealed and in date."
   - CTA: **Continue**.

**Step 2: Your details** (fields [spec §8]).
- Full name*, email*, phone (optional), country* (`CountrySelect`).
- Individual or organisation* (`Segmented`); choosing organisation adds "Organisation name"*.
- **Anonymous recognition:** "Keep my gift anonymous in any public recognition."
- **Comments:** collapsed under "+ Add a note (optional)", up to 500 characters.
- A summary line in coral: "USD 50 · Monthly · Education Assistance". For a sponsorship, also "Sponsorship HVN-S-7KQ2".
- The CTA depends on the route (§4.6, §4.8):
  - Stripe route → **"Continue to Secure Payment"** with `Lock`. Under it: "You'll pay on Stripe's secure page. We never store card details on this site." [spec §8]
  - Pledge route → **"Confirm My Pledge"**. Under it: "We'll email you how to pay ({methods})." A dev-only badge reads "Stripe not configured: pledge mode".
  - In-kind → **"Offer My Items"**.

**Step 3: Redirecting.** A heart pulse with "Taking you to secure payment…", entered after `POST /api/donations` returns `{ kind: "stripe", url }`. Then `window.location.assign(url)`.

**Errors (inline, above the CTA):**
- Validation: field messages as usual.
- `kind: "error"`: "We couldn't start the payment. Nothing has been charged. Please try again, or [pledge now and pay later]." The link switches this one submission to the pledge route.
- Network failure: the same wording, plus the retry button.

**Accessibility:**
- Every `Segmented` is a `radiogroup` (existing).
- Amount presets are `role="radio"` (existing).
- The impact hint and summary sit in an `aria-live="polite"` region.
- Inputs are 16px on mobile (§2.4).

### 4.5 "See exactly where the money goes" (left column, `id="where-it-goes"`)

1. **`AllocationPanel`.**
   - Heading `SectionIntro` "Where Your Money Goes".
   - A large horizontal stacked bar, 18px tall with rounded ends. The segments fill left to right on reveal.
   - A legend list: tone dot, label, **percent**, and a one-line `description`.
   - Under it, **live**: "Your USD 50 → USD 27.50 school fees · USD 10.00 uniforms & materials · USD 5.00 hygiene & bedding · USD 3.50 follow-up · USD 4.00 admin & fees." It updates as the widget changes (shared `DonateStateProvider`), using `money()` from `lib/money.ts`.
   - Footnote: "Based on our {year} programme budget. Updated {allocationAsOf}."
   - If `allocationVerified === false`: an "Illustrative" chip plus "Percentages are illustrative until confirmed by our finance team." If `settings.figures.hideUnverified` is on, the percentages and the live split are hidden and the lines render as a plain list of what money is spent on.
2. **`ImpactExamples`.** "What Your Gift Can Do": a row of cards with the amount in Anton and the outcome in Inter. **Clicking a card sets that amount and currency in the widget** (on mobile it also scrolls to the widget).
3. **The cause story** (`story` markdown in `Prose`), when present.
4. **How we make sure it reaches a child.** `StepCards` compact (cocoa) using `journey.steps`, the founder's verify-before-giving process.
5. **Trust and transparency.**
   - "We never store card details on this site" [spec §8].
   - "Payments processed by Stripe".
   - "Every gift is acknowledged and receipted" [spec §8 workflow 5–6].
   - Registered numbers from `settings.registrations` [CLIENT].
   - A link to the latest annual report and to `/impact`.
6. **Other ways to give** (`id="other-ways"`).
   - Bank transfer and mobile money per currency from `settings.payment.instructions`. The mobile-money providers are [CLIENT: e.g. Wave, Afrimoney, QMoney; confirm which accounts exist]. If nothing is configured: "Email {donations email} and we'll send account details."
   - **Give in kind** switches the widget to in-kind.
   - **Corporate and partner giving** → `/get-involved/partner?type=donation-partnership`.
   - **Zakat** note on `zakatEligible` causes [draft; see Open questions].
7. **Donation FAQ** (`FaqAccordion`, group `donations`):
   - Is my donation secure?
   - Will I get a receipt?
   - How do I change or cancel a monthly gift?
   - Can I give anonymously?
   - Which currencies can I use?
   - Can I give from outside The Gambia? (existing copy)
   - Is my gift tax-deductible? [CLIENT]

**`/donate` (general) only:** a **"Choose a Cause"** section (`id="causes"`) after the give hero. It shows the full `CauseCard` grid with `FilterPills` (Programmes · Ramadan & Eid · Christmas · Thanksgiving · Year-round · Projects). Each card links to `/donate/<slug>`. This is the shareable entry point for "pick a cause".

### 4.6 Currency, and GMD on Stripe

- **Stripe and GMD.** To my knowledge, **GMD is on Stripe's list of supported presentment currencies** as a two-decimal currency, the same as USD, GBP and EUR. I am **not certain**. Support also depends on the Stripe account's country, its settlement setup and the payment method. Stripe does not onboard businesses based in The Gambia, so the account would have to belong to the US (California) entity. **Verify at docs.stripe.com/currencies with the live account before enabling it.**
- **Decision:** routing is configuration, not code.
  - `STRIPE_CURRENCIES` (env, default `USD,GBP,EUR`) is what the Stripe account can technically take.
  - `settings.payment.routes` is the admin's choice and **defaults to `GMD: "local"`**.
  - The effective route is `"stripe"` only when the currency appears in both **and** `STRIPE_SECRET_KEY` is set. Otherwise it is `"local"`, a pledge with instructions.

  GMD defaults to local even if Stripe supports it, because Gambian donors mostly pay by mobile money and bank transfer, not international cards. The thank-you page for a GMD pledge offers a secondary "Prefer to pay by card? Give in USD instead", which pre-converts the amount using `fx` and rounds it.
- **Amounts** are sent to Stripe in minor units (×100 for all four currencies). Stripe's minimum charge is about USD 0.50 equivalent, and every configured minimum is well above that.
- **Display:** `money()` from `lib/money.ts` ("USD 3,400", code first), unchanged.

### 4.7 Stripe hand-off: the route handler contract

`POST /api/donations` (`app/api/donations/route.ts`, Node runtime). It handles **both** cash and in-kind, so the widget has one endpoint.

```ts
type DonationRequest =
  | { mode: "cash"; cause: string; ref?: string; currency: Currency; amount: number; frequency: Frequency; coverFees: boolean;
      donor: Donor; attribution?: Attribution; hp?: string; startedAt: number }
  | { mode: "in-kind"; cause: string; items: string[]; description: string; condition: "new" | "good-used" | "mixed";
      estValue?: { amount: number; currency: Currency }; handover: "drop-off" | "collection" | "shipping"; location: string;
      donor: Donor; attribution?: Attribution; hp?: string; startedAt: number };
type Donor = { name: string; email: string; phone?: string; country: string; type: "individual" | "organisation";
               organisation?: string; anonymous: boolean; comments?: string; updates: boolean };
type Attribution = { utm_source?: string; utm_medium?: string; utm_campaign?: string; referrer?: string };

type DonationResponse =
  | { kind: "stripe"; url: string }
  | { kind: "pledge"; next: string }      // "/donate/thank-you?ref=HVN-…&t=…"
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };
```

**Server steps:**
1. Run the Zod check (shared schema), the honeypot and timing check, the per-IP rate limit (at most 10 per 10 minutes), and validate the cause and `ref`.
2. Create the donation record via the data layer, with spec §13 statuses:
   - cash on the Stripe route → `"Pending"`
   - cash on the local route → `"Pledged"`
   - in-kind → `"Pledged"` (in-kind offer)

   Store `baseAmount`, `coverFees` and `amount` (after the fee top-up), and the attribution.
3. **Stripe route** (`stripe` npm package, server-only, `STRIPE_SECRET_KEY`):
   ```ts
   stripe.checkout.sessions.create({
     mode: frequency === "once" ? "payment" : "subscription",
     ...(frequency === "once" && { submit_type: "donate" }),             // button reads "Donate"
     line_items: [{ quantity: 1, price_data: {
       currency: currency.toLowerCase(), unit_amount: Math.round(amount * 100),
       product_data: { name: ref ? `Sponsorship ${ref}` : `Donation: ${cause.title}` },
       ...(frequency !== "once" && { recurring: frequency === "annual" ? { interval: "year" }
                                              : { interval: "month", interval_count: frequency === "quarterly" ? 3 : 1 } }),
     }}],
     customer_email: donor.email,
     metadata: { donationId, cause: cause.slug, ref: ref ?? "", anonymous: String(donor.anonymous) },
     ...(frequency !== "once" && { subscription_data: { metadata: { donationId, cause: cause.slug } } }),
     ...(frequency === "once" && { payment_intent_data: { metadata: { donationId }, description: `Haven donation ${donationRef}` } }),
     success_url: `${SITE_URL}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url:  `${SITE_URL}/donate/${cause.slug}?cancelled=1&amount=${baseAmount}&currency=${currency}&frequency=${frequency}`,
     locale: "auto",
   }, { idempotencyKey: donationId });
   ```
   Return `{ kind: "stripe", url: session.url }`.
4. **Local route or in-kind:** return `{ kind: "pledge", next }`, where `t = HMAC(ref, DONATION_LINK_SECRET)`, and enqueue the email (§3.24).

**Webhook `POST /api/stripe/webhook`.** Read the raw body with `await request.text()` and verify it with `STRIPE_WEBHOOK_SECRET`.
- `checkout.session.completed` / `checkout.session.async_payment_succeeded` → `"Received"`, store the session and payment IDs, and trigger the acknowledgement and receipt [spec §8 steps 4–6].
- `checkout.session.async_payment_failed` → `"Cancelled"`.
- `invoice.paid` with `billing_reason = "subscription_cycle"` → a new `"Received"` donation linked to the subscription.
- `customer.subscription.deleted` → mark the recurring series ended.
- `charge.refunded` → `"Cancelled"`, with a note.

Every handler is idempotent on the event ID. The payments or backend doc may own the persistence details, but the events and statuses above are what the public pages assume.

### 4.8 Graceful degradation (no keys yet)

| Missing | Behaviour |
|---|---|
| `STRIPE_SECRET_KEY` | Every currency routes to pledge. The CTA reads "Confirm My Pledge". A note in the card: "Online card payments are being set up. Pledge now and we'll email you secure payment details." Nothing errors. |
| `STRIPE_WEBHOOK_SECRET` (key present) | `/donate/thank-you` retrieves the session server-side, and if `status === "complete"` it marks the donation `"Received"` itself (idempotent). This keeps local development working without the Stripe CLI. |
| Firebase credentials | Records go to `.data/*.json` (the backend doc). The flow is identical. |
| Email provider | Emails are logged to `.data/outbox.json`. The UI still says a confirmation was sent; the admin shows the outbox. |
| Payment instructions not set | Thank-you: "Our team will email you payment details within 2 working days." |

The route decision is computed **on the server** and passed to the widget as a prop from the `(give)/layout.tsx` server component: `routes: Record<Currency, "stripe" | "local">`. The layout reads env and settings and **never uses `NEXT_PUBLIC_` for this**. It is not request-time data, so the layout stays static and is revalidated when settings change.

### 4.9 `/donate/thank-you`

- Dynamic: it reads `searchParams`. Type it with `PageProps<"/donate/thank-you">` and set `robots: { index: false }`.
- Variants, resolved on the server:

| Variant | Condition | Content |
|---|---|---|
| `paid` | Stripe session `complete` | Heart burst (the landing's pulse-ring heart plus marigold brush hearts drifting up for 1.2s; static under reduced motion). Anton H1 **"THANK YOU, {FIRST NAME}"**. A summary card: cause, amount, frequency, reference, "Receipt sent to a***@gmail.com". |
| `processing` | Session `open` or the payment is processing | "Your payment is being confirmed. We'll email your receipt shortly." |
| `pledge` | Valid `ref` and `t` with mode cash | Thank-you, plus **how to pay**: the bank and mobile-money instructions for that currency with the **reference to quote**, and [Copy] buttons. For GMD: "Prefer to pay by card? [Give in USD instead]". |
| `in-kind` | Valid `ref` and `t` with mode in-kind | "Our team will contact you within {n} working days to arrange {drop-off / collection / shipping} of your items." |
| `generic` | Anything else, or an invalid token | "Thank you for supporting Haven." No personal data. |

Every variant then shows:
1. **What happens next:** a timeline mirroring the §13 statuses in donor words: Received → Acknowledged → Allocated to {cause} → You'll receive impact updates (if opted in).
2. **For a recurring gift:** "To change or cancel your {monthly} gift, reply to your receipt email or contact {donations email}." A self-service donor portal is Phase 2 (§16).
3. **Share prompt:** "Ask a friend to stand with you", with `ShareRow` for the **cause URL** (never the thank-you URL).
4. A newsletter `JoinSphere` (compact) if they did not opt into updates. Links: Stories of Hope · Our Impact · Home.

The page shows **only** first name, amount, cause, reference and a masked email. Nothing else from the donor record.

### 4.10 Landing donate section (reuse, not a second implementation)

- `components/sections/Donate.tsx` keeps its section chrome (coral video and the VU heading) and renders `<DonateWidget variant="landing" />`.
- Differences in the landing variant:
  - local state instead of the provider
  - the cause as a `<select>`
  - no URL syncing
  - after an appeal preselect, a link "See exactly where it goes →" to `/donate/<appeal-slug>?amount=&currency=&frequency=` (it carries the current state)
- `requestDonation` (`lib/donate-intent.ts`) adds `slug` to the event detail. The existing `scripts/qa/donate-flow.mjs` must still pass. Extend it to assert the new "where it goes" link and a pledge-mode submission.

### 4.11 Abuse, privacy and analytics

- **Card-testing defence:** the rate limit on `/api/donations`, the online maximums, the honeypot, Stripe Radar (default), and no raw card fields on our domain.
- **Analytics** (Vercel Analytics custom events, no PII): `donate_view {cause}`, `donate_cause_change`, `donate_amount_set {currency, bucket}`, `donate_checkout_start {route}`, `donate_complete {route}` (fired on the thank-you page). **Never** amounts tied to identity, names or emails.

---

## 5. Navigation

### 5.1 `content/nav.ts`: the new shape

```ts
export type NavChild = { label: string; href: string; description?: string; icon?: ProgrammeIconName };
export type NavItem = {
  label: string; short?: string;          // short label used at 1280–1399px (pill fit)
  href: string;                            // real route; the label itself navigates
  homeAnchor?: string;                     // only used when pathname === "/"
  match?: (path: string) => boolean;       // active-state rule; default: path === href || path.startsWith(href + "/")
  children?: NavChild[]; mega?: boolean;
};

export const mainNav: NavItem[] = [
  { label: "Home", href: "/", homeAnchor: "#top", match: (p) => p === "/" },
  { label: "About Us", short: "About", href: "/about", children: [
    { label: "Who We Are", href: "/about" }, { label: "How We Work", href: "/about#approach" },
    { label: "Our Team", href: "/about#team" }, { label: "Our Partners", href: "/about#partners" } ] },
  { label: "Our Programmes", short: "Programmes", href: "/programmes", mega: true, children: [
    { label: "Child Protection", href: "/programmes/child-protection", icon: "protection", description: "Safe environments & confidential reporting" },
    { label: "Education Assistance", href: "/programmes/education", icon: "education", description: "School fees, uniforms & materials" },
    { label: "Medical Support", href: "/programmes/medical", icon: "medical", description: "Referrals & treatment support" },
    { label: "Psychological Support", href: "/programmes/counselling", icon: "psychological", description: "Counselling & psychosocial care" },
    { label: "Legal Support", href: "/programmes/legal", icon: "legal", description: "Information & legal referrals" },
    { label: "Family & Community", href: "/programmes/family-community", icon: "family", description: "Guidance, outreach & material help" } ] },
  { label: "Get Support", href: "/get-support", children: [
    { label: "Request Support", href: "/get-support/request" }, { label: "Report a Concern", href: "/report-a-concern" },
    { label: "How Support Works", href: "/get-support" }, { label: "Questions & Answers", href: "/faq" } ] },
  { label: "Resources", href: "/resources", children: [
    { label: "Resource Library", href: "/resources" }, { label: "Reports & Publications", href: "/resources?category=reports" },
    { label: "Request a Report", href: "/request-a-report" }, { label: "Our Policies", href: "/policies" } ] },
  { label: "Our Impact", short: "Impact", href: "/impact", match: (p) => ["/impact", "/projects", "/stories", "/news"].some((r) => p === r || p.startsWith(r + "/")), children: [
    { label: "Impact Overview", href: "/impact" }, { label: "Projects", href: "/projects" },
    { label: "Stories of Hope", href: "/stories" }, { label: "News & Updates", href: "/news" } ] },
  { label: "Get Involved", href: "/get-involved", children: [
    { label: "Become a Volunteer", href: "/get-involved/volunteer" }, { label: "Partner With Us", href: "/get-involved/partner" },
    { label: "Sponsorship", href: "/get-involved/sponsor" }, { label: "Give in Kind", href: "/donate?mode=in-kind" },
    { label: "Share Your Story", href: "/stories/share" } ] },
  { label: "Contact", href: "/contact" },
];
// "Donate" (spec §2 main nav) is the persistent marigold "Donate Now" pill → /donate on every page.
```

Also add `lib/routes.ts`, which builds every dynamic href (`routes.programme(slug)`, `routes.donate(cause, params)`, `routes.request(type)`, …), so no component hand-types a path. **Skip `typedRoutes`.** `Button` takes `href: string`, and hash links make typed routes noisy. Instead, add `scripts/qa/links.mjs`, which crawls every internal link from the sitemap and fails on any 404.

### 5.2 Desktop header (`Header.tsx`, `NavDropdown.tsx`)

- **The top-level label is a `Link`**, and the chevron is a **separate `<button aria-expanded aria-controls aria-label="Show {label} menu">`**. Hover still opens the menu for mouse users; keyboard users Tab to the chevron and press Enter or Space. Esc closes it and returns focus to the chevron. This replaces today's label-as-button, which can't navigate.
- **Pill fit.** About, Resources and Our Impact gain chevrons (about 57px). Below `min-[1400px]`, render `short` labels: About · Programmes · Impact, which saves about 90px. Gaps stay as they are (22 → 30 → 34px). Run `scripts/qa/nav-fit.mjs` at its full width set, which must hold `gap ≥ 16px` at 1280. If it still fails at 1280, drop the "Home" item below 1400px; the logo is the home link and the mobile menu keeps "Home".
- **Active state.** `usePathname()` plus `match`. The active item gets `aria-current="page"` and a **persistent** marigold underline (the existing `after:` bar at `scale-x-100`).
- **Mega menu** (Programmes). The 2×3 icon grid stays. Add a bottom row across the panel:
  - left: "All programmes →" (`/programmes`)
  - right: a forest pill "Need help now? Request Support" and an outline pill with `ShieldAlert`, "Report a Concern"
- **Logo:** `href="/"`. On `/` it is an `AnchorLink` to `#top`.
- **Search** (marigold disc) opens the working `SearchOverlay` (§3.22).
- **Shield** → `/report-a-concern`. The tooltip stays.
- **Donate Now** → `/donate` on every page.
- **Glass mode** (`data-nav-theme="glass"`) also triggers over `PageHero photo`.

### 5.3 Mobile (`MobileMenu.tsx` and the sticky bar)

- **Each row has two tap targets:** the label `Link` (navigates and closes the menu) and a 44px chevron button that toggles the children. Children render as today, and Programmes children also get a 24px `ProgrammeIcon`.
- **The current route** is highlighted (marigold text and a left bar).
- **Action block:**
  - **Donate Now** (`/donate`, marigold, night text)
  - **Request Support** (`/get-support/request`, white)
  - **Report a Concern** (`/report-a-concern`, `outline-light` + `ShieldAlert`)
- **Close on route change** with `useEffect` on `usePathname()`, not only on click. This fixes back and forward navigation.
- **Sticky mobile bar:** logo `/`, **Donate** → `/donate`, menu button. The bar must stay above `QuickExit` (z-order: QuickExit `z-[75]`, above the menu at `z-[70]`), so the exit is reachable even with the menu open.

### 5.4 The landing page's in-page anchors and Lenis

- **Policy:** the chrome always routes to pages. On `/` only, `homeAnchor` items (Home and logo → `#top`) and the Appeals "Donate Now" (→ `#donate`) stay in-page. They are the only links whose target is content of the same page that completes the action.
- **Smooth anchors:** use `AnchorLink`, which calls `lenis.scrollTo(target, { offset: -headerOffset })`. `headerOffset` is 88 at `xl+` (stuck pill) and 68 below (mobile bar). Do **not** enable Lenis's global `anchors` option, because Next `Link` hash navigation would double-handle it.
- **CSS fallback** for no-JS and cross-page hashes: `html { scroll-padding-top: 88px }` in `globals.css` (docs: `02-components/link.md`, "Scroll offset with sticky headers"), plus `@media (width < 80rem) { html { scroll-padding-top: 68px } }`.
- **Route changes:** `RouteScrollReset` (§2.2). Without it, Lenis's internal target is out of sync after Next's scroll restoration and the page jumps on the next wheel event. Cross-page hash links such as `/about#team` scroll to the element after the first paint, re-measured once `cv-auto` sections render (wait one rAF and then `lenis.resize()`).

### 5.5 Breadcrumbs

- Shown on every page except `/`, inside `PageHero`, as Home › … › current. The current item is plain text with `aria-current="page"`.
- Markup: `<nav aria-label="Breadcrumb"><ol>…</ol></nav>`. Separators are marigold `ChevronRight` icons at 12px, `aria-hidden`.
- On mobile, middle crumbs collapse to "…" when there are more than three.
- Always emits BreadcrumbList JSON-LD (§7.2).

| Route | Trail |
|---|---|
| `/programmes/[slug]` | Home › Our Programmes › {title} |
| `/get-support/request` | Home › Get Support › Request Support |
| `/report-a-concern` | Home › Get Support › Report a Concern |
| `/resources/[slug]` | Home › Resources › {category} (links to the filtered list) › {title} |
| `/news/[slug]` | Home › News › {title} |
| `/projects/[slug]` | Home › Our Impact › Projects › {title} |
| `/get-involved/*` | Home › Get Involved › {page} |
| `/donate/[cause]` | Home › Donate › {cause} |
| `/policies/[slug]` | Home › Policies › {title} |

### 5.6 Footer (`Footer.tsx`, `footerLinks` in `content/nav.ts`)

- **Safeguarding row:** **Request Support** → `/get-support/request`; **Report a Concern** → `/report-a-concern`.
- **Brand column:** **Donate Now** → `/donate`.
- **Quick Links:** About Us `/about` · Our Impact `/impact` · Stories of Hope `/stories` · News & Updates `/news` · Resources & Reports `/resources` · Get Involved `/get-involved` · Contact Us `/contact`.
- **Our Programmes:** all **six**. Add Family & Community; today there are five.
- **Legal row** [spec §2 additional links]:

  | Link | Target |
  |---|---|
  | Child Safeguarding Policy | `/policies/safeguarding` |
  | Privacy Policy | `/policies/privacy` |
  | Terms of Use | `/policies/terms` |
  | Report a Concern | `/report-a-concern` |
  | Request a Report | `/request-a-report` |
  | FAQs | `/faq` |
  | Administrator Login | `/admin`, `rel="nofollow"` |
- Remove `id="contact"` from `<footer>`, since `/contact` now exists. Nothing on the landing links `#contact` after §6.

---

## 6. Landing links to retarget

Each change ships in the phase that creates its target (§8), so the landing never links to a 404.

| Section (file) | Element | Today | New target |
|---|---|---|---|
| Header (`Header.tsx`) | Logo (bar and mobile sticky) | `#top` | `/` (on `/`: `AnchorLink #top`) |
| Header | Desktop Donate Now, mobile Donate pills | `#donate` | `/donate` |
| Header | Shield "Report a Concern" | `#support` | `/report-a-concern` |
| Header nav | every item (`content/nav.ts`) | `#…` | routes per §5.1 |
| MobileMenu | Donate Now / Report a Concern | `#donate` / `#support` | `/donate` / `/report-a-concern`; add Request Support → `/get-support/request` |
| Hero (`Hero.tsx`) | "Support a Child" | `#donate` | `/donate` |
| Hero | "Request Support" | `#support` | `/get-support/request` |
| Programmes (`Programmes.tsx`) | each "Learn More" | `#support` | `/programmes/<slug>` |
| About (`About.tsx`) | "About More" | `#impact` | `/about`; relabel **"More About Us"** |
| Duo (`Duo.tsx`) | Volunteer "Learn More" | `#contact` | `/get-involved/volunteer` |
| Duo | Partner "Learn More" | `#contact` | `/get-involved/partner` |
| Manifesto (`Manifesto.tsx`) | "Donate" | `#donate` | `/donate` |
| Manifesto | "Tell Your Story" | `#stories` | `/stories/share` |
| Impact (`Impact.tsx`) | (new) "See Our Full Impact" (`vu-outline`) under the footnote | none | `/impact` |
| Appeals (`Appeals.tsx`) | each "Donate Now" | `#donate` + preselect | **unchanged** (in-page preselect); the widget then shows "See exactly where it goes →" `/donate/<slug>` |
| Donate (`Donate.tsx`) | card | UI only | working `DonateWidget` (§4.10) |
| DoorsOpen (`DoorsOpen.tsx`) | "Request Support" | `#contact` | `/get-support/request` |
| DoorsOpen | "Report a Concern" | `#contact` | `/report-a-concern` |
| Stories (`Stories.tsx`) | "Tell Your Story" | `#contact` | `/stories/share` |
| Stories | "See All Stories" | `#news` | `/stories` |
| Founder (`Founder.tsx`) | "Our Story" | `#about` | `/about` |
| Team (`Team.tsx`) | (new) "Meet the Team" text link under the carousel | none | `/about#team` |
| Partners (`Partners.tsx`) | (new) "Become a Partner" text link | none | `/get-involved/partner` |
| Journey (`Journey.tsx`) | (new) "How We Work" button under the cards | none | `/about#approach` |
| Projects (`Projects.tsx`) | "View All Projects" | `#news` | `/projects` |
| Projects | each tile (not a link today) | none | `/projects/<slug>`; add `slug` to `content/home.ts → projects.items` |
| Faq (`Faq.tsx`) | (new) "See All Questions" under the accordion | none | `/faq` |
| JoinSphere (`JoinSphere.tsx`) | Subscribe form | UI only | the `subscribe` action |
| News (`News.tsx`) | each "Read More" (and the card image and title) | `#news` | `/news/<slug>`; add `slug` to `content/people.ts → news` and seed posts |
| News | (new) "View All News" | none | `/news` |
| Footer | all links | `#…` / `#` | §5.6 |
| SearchOverlay | suggestion chips | buttons (no-op) | links per §3.22 |

---

## 7. SEO

### 7.1 Metadata per page

The root keeps `title.template: "%s | Haven"` and `metadataBase`. Change `metadataBase` to `new URL(process.env.NEXT_PUBLIC_SITE_URL ?? site.url)` so preview deploys produce correct absolute URLs.

Every page sets `alternates.canonical`, plus `openGraph.title`, `openGraph.description` and `openGraph.url`. Twitter uses `card: "summary_large_image"`, set once in the root.

| Route | `title` | `description` | Notes |
|---|---|---|---|
| `/` | default "Haven \| Restoring Hope. Protecting Childhood. Building Futures." | `site.description` | WebSite JSON-LD |
| `/about` | About Us | "Haven protects vulnerable children and strengthens families with communities, professionals, donors and partners. Our vision, mission, values and team." | |
| `/programmes` | Our Programmes | "Child protection, education and school fees, medical care, counselling, legal and family support: six programmes built around every child." | |
| `/programmes/[slug]` | `{title}` | `{headline}. {summary}`, trimmed to 155 characters | `generateMetadata`; OG image §7.4 |
| `/get-support` | Get Support | "You do not have to face it alone. Ask for confidential help with school fees, healthcare, counselling, legal questions, food and family support." | |
| `/get-support/request` | Request Support | "Send a confidential request for help for a child or family. Every request is reviewed by our team." | |
| `/report-a-concern` | Report a Child-Protection Concern | "Worried about a child's safety? Report a concern confidentially to Haven's safeguarding team. In an emergency, contact the authorities first." | `referrer: "no-referrer"` |
| `/resources` | Resources & Reports | "Guides, policies and reports on child safeguarding, rights, parenting, wellbeing, education, health and the law." | canonical `/resources` for any filter |
| `/resources/[slug]` | `{title}` | `{description}` | Report JSON-LD |
| `/request-a-report` | Request a Report | "Request a copy of a Haven report. Our team reviews every request and emails approved reports." | |
| `/impact` | Our Impact | "Verified results, where the money goes, and stories of change from the communities Haven serves." | |
| `/projects` · `/projects/[slug]` | Our Projects · `{title}` | lead · `{summary}` | |
| `/stories` · `/stories/share` | Stories of Hope · Share Your Story | landing lead · "Has Haven made a difference for you? Share your story with us." | |
| `/news` · `/news/[slug]` | News & Updates · `{seo.title ?? title}` | "Monthly impact updates…" · `{seo.description ?? dek}` | Article JSON-LD; RSS alternate; canonical `/news` for filters and pages |
| `/get-involved` (+ `/volunteer`, `/partner`, `/sponsor`) | Get Involved · Become a Volunteer · Partner With Us · Sponsorship | page leads | |
| `/donate` | Donate | "Give hope, create opportunity. Choose a cause, see exactly where your gift goes, and give once or monthly in GMD, USD, GBP or EUR." | |
| `/donate/[cause]` | Donate to `{cause.title}` | `{cause.summary}` | OG image §7.4; canonical without query |
| `/donate/thank-you` | Thank You | none | `robots: { index: false, follow: false }` |
| `/contact` · `/faq` · `/policies` · `/policies/[slug]` | Contact Us · Frequently Asked Questions · Our Policies · `{title}` | the [spec §11] intro · "Answers about support, safeguarding, donations and volunteering." · … · `{summary[0]}` | FAQPage JSON-LD on `/faq` |
| `/search`, `/unsubscribe`, 404 | Search · Unsubscribe · Page Not Found | none | `noindex` |

On non-production deploys (`process.env.VERCEL_ENV !== "production"`), the root metadata sets `robots: { index: false, follow: false }`, and `robots.ts` disallows everything. This keeps previews and staging out of Google.

### 7.2 JSON-LD (`components/seo/JsonLd.tsx`, escaped per docs)

- **Root layout:** `NGO` (a schema.org Organization subtype).

  ```ts
  {
    "@context": "https://schema.org", "@type": "NGO", "@id": `${SITE_URL}/#org`,
    name: "Haven", alternateName: "The Orphanage Project", url: SITE_URL, logo: `${SITE_URL}/icon.svg`,
    slogan: site.tagline, description: site.description, foundingDate: String(site.foundedYear),
    address: site.contact.offices.map((o) => ({ "@type": "PostalAddress", addressLocality: o.address, addressCountry: o.label === "The Gambia" ? "GM" : "US" })),
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", telephone: site.contact.phone, email: site.contact.email, availableLanguage: ["en"] }],
    sameAs: site.socials.map((s) => s.href).filter((h) => h.startsWith("http")),          // placeholders "#" excluded
    areaServed: countries.map((c) => ({ "@type": "Country", name: c.name })),
    potentialAction: { "@type": "DonateAction", target: `${SITE_URL}/donate`, recipient: { "@id": `${SITE_URL}/#org` } },
    // nonprofitStatus: CLIENT (e.g. "Nonprofit501c3" if the US entity is a 501(c)(3)); omit until confirmed
  }
  ```
- **Home:** `WebSite` with `potentialAction: SearchAction` (`target: ${SITE_URL}/search?q={search_term_string}`, `query-input: "required name=search_term_string"`).
- **Every inner page:** `BreadcrumbList` from `Breadcrumbs`.
- **`/news/[slug]`:** `NewsArticle` with `headline`, `description`, `image` (absolute, the OG image), `datePublished`, `dateModified`, `author` (`Organization` → `#org`, or `Person` when a named author is approved), `publisher` (`#org`), `mainEntityOfPage`, `articleSection` (category).
- **`/resources/[slug]`:** `Report` with `name`, `datePublished`, `about` (category), `publisher` and `isAccessibleForFree` (`access === "public"`).
- **`/faq`:** `FAQPage` with `mainEntity: Question/acceptedAnswer`. Google shows FAQ rich results only for a few authoritative sites, so the markup is harmless but not a ranking lever.
- **`/donate/[cause]`:** `WebPage` with `potentialAction: DonateAction` (target is the page URL) and `about` (`Project` with name and description) for appeals and projects.
- **`/programmes/[slug]`:** `WebPage` + `about: { "@type": "Service", name, provider: #org, areaServed }`.
- **`/projects/[slug]`:** `Project` (schema.org) with `name`, `description`, `location` (country) and `funder` omitted.

### 7.3 `app/sitemap.ts` and `app/robots.ts`

```ts
// app/sitemap.ts: async, reads the data layer; regenerated on publish (sitemap is a cached route handler; docs: 01-metadata/sitemap.md)
const staticRoutes = ["", "/about", "/programmes", "/get-support", "/get-support/request", "/report-a-concern", "/resources",
  "/request-a-report", "/impact", "/projects", "/stories", "/stories/share", "/news", "/get-involved",
  "/get-involved/volunteer", "/get-involved/partner", "/get-involved/sponsor", "/donate", "/contact", "/faq",
  "/policies", "/policies/safeguarding", "/policies/privacy", "/policies/terms"];
// + /programmes/<6 slugs> (priority 0.9) + /donate/<active causes> (0.8) + /news/<published> (0.6, lastModified updatedAt)
// + /resources/<all, incl. controlled: the detail page is public> (0.5) + /projects/<all> (0.5)
// Priorities: "" 1.0; donate, programmes, get-support, report-a-concern 0.9; others 0.7. changeFrequency: news "weekly", rest "monthly".
// EXCLUDED: /donate/thank-you, /search, /unsubscribe, /admin/**, /api/**, query-string variants.
```

```ts
// app/robots.ts
const prod = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === "production"          // on Vercel: only the production deployment is indexable
  : process.env.NODE_ENV === "production";           // elsewhere (self-hosted / local next start)
return prod
  ? { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/donate/thank-you", "/search", "/unsubscribe"] },
      sitemap: `${SITE_URL}/sitemap.xml` }
  : { rules: { userAgent: "*", disallow: "/" } };
```

### 7.4 Social images (shareable donate links matter most)

- Add `opengraph-image.tsx` to `donate/(give)/[cause]/`, `programmes/[slug]/` and `news/[slug]/`. Reuse the root `app/opengraph-image.tsx` recipe: Anton and Nunito TTFs from `assets/fonts/`, the night gradient and the Haven mark.
- Composition:
  - The cause or post photo fills the right 55%, cut with a brush edge.
  - On the left, a Caveat-style eyebrow in Nunito (the cause kind), the title in Anton, and for appeals a marigold progress bar with "USD 2,900 raised of 5,500" (only if verified).
  - A footer strip with `haven.org.gm/donate/<slug>`.
- **WhatsApp is the main share channel** in the Gambian market, and it drops previews for large images. Keep each generated PNG small: limit the photo to one JPEG-encoded data URI and avoid large gradients. Test with WhatsApp. If an image exceeds about 300 KB, fall back to pre-baked JPEGs, using a `scripts/art/og-causes.mjs` (sharp) that writes `public/og/<slug>.jpg`, referenced via `generateMetadata → openGraph.images`.

---

## 8. Build order (phased)

Each phase ends green on these checks, run against `next build && next start -p 3100`:
- `npm run lint`
- `npx tsc --noEmit`
- `node scripts/qa/overflow.mjs 375 768 1280 1440`
- `node scripts/qa/a11y.mjs` on the new routes
- `node scripts/qa/nav-fit.mjs`
- `node scripts/qa/links.mjs` (new)
- landing screenshots unchanged (`shoot.mjs`)

**Phase A: foundations (no new public pages yet).**
1. Route group `app/(site)/`; move the landing; `SiteChrome`; root `not-found.tsx` with chrome; `(site)/error.tsx`; skip link.
2. `content/nav.ts` new shape + `lib/routes.ts`. Header split-button dropdowns, short labels, active state, Lenis `RouteScrollReset`, `AnchorLink`, `scroll-padding-top`. Mobile menu close on route change.
3. Extract the landing components (§2.3) and verify identical screenshots.
4. `PageHero` (4 variants), `Breadcrumbs`, `Section`, `SectionIntro`, `Notice`, `StepCards`, `CtaBand`, `FinalCta`, `ShareRow`, `EmptyState`, `QuickExit`, `ImageCredit`, `JsonLd`, `Prose`, `Toc`.
5. Form kit + `FormState` + Zod schemas + the honeypot and timing check. `lib/data/public.ts` stubs over the seed content (the real local and Firebase layer comes from the backend doc).
6. `robots.ts` (env-aware), root NGO JSON-LD, `metadataBase` from env.

**Phase B: donate (highest owner priority).**
1. `Cause` model + seed; `/donate`, `/donate/[cause]` with the `(give)` layout, `DonateStateProvider`, `DonateWidget` (cash and in-kind), `CausePicker`, `AllocationPanel`, `ImpactExamples`, other ways to give, donate FAQ, mobile sticky bar.
2. `POST /api/donations` in **pledge mode** + `/donate/thank-you` (pledge, in-kind, generic).
3. Stripe: Checkout session, webhook, the paid and processing thank-you variants. Verify with Stripe **test keys** on localhost (§4.8 path with no webhook secret).
4. Landing `Donate.tsx` → `DonateWidget variant="landing"`; extend `donate-flow.mjs`; retarget the Hero, Manifesto, Header and Footer donate links.
5. `opengraph-image.tsx` for causes and the WhatsApp preview check.

**Phase C: help and safeguarding forms.**
1. `/get-support`, `/get-support/request` (all category extras; uploads only if storage is ready), `/report-a-concern` (quick exit, anonymous mode).
2. `/contact` (with the concern redirect). Email triggers to the outbox.
3. Retarget Hero, DoorsOpen, header shield, footer safeguarding row and mobile menu.

**Phase D: core content pages.**
1. `/about` (values, team drawer, where we work), `/programmes`, `/programmes/[slug]` ×6 (with their OG images), `/faq`, `/policies` + 3 drafts (with the "Draft, pending professional review" banner).
2. `/get-involved`, `/get-involved/volunteer`, `/get-involved/partner`, `/get-involved/sponsor`, and the `/volunteer`, `/partner` and `/sponsor` redirects.
3. Retarget Programmes "Learn More", About, Duo, Founder, Journey, Faq and Team links.

**Phase E: content hubs.**
1. `/news` + `/news/[slug]` + RSS (seed 3 posts from `content/people.ts → news`); `/resources` + `/resources/[slug]` + `/request-a-report` + the download route.
2. `/stories` + `/stories/share`; `/projects` + `/projects/[slug]` (seed 3 from `content/home.ts → projects`); `/impact` (stats, allocation, verification switch).
3. Retarget News, Stories, Projects, Impact and Manifesto "Tell Your Story". New media generations (§2.6) + `audit-mix`.

**Phase F: search, SEO and polish.**
1. `/api/search`, the working `SearchOverlay`, `/search`.
2. The full `sitemap.ts`, all JSON-LD validated (Rich Results Test, Schema Markup Validator), per-page metadata audit.
3. `<ViewTransition>` crossfade and shared elements (§2.7); reduced-motion audit; `lcp.mjs` on `/donate/education`, `/programmes/education` and `/news/<slug>`; Lighthouse mobile.

---

## 9. Notes for the implementer (gotchas)

- **`params` and `searchParams` are Promises** in pages, layouts and `generateMetadata`. Use the global helpers `PageProps<"/route">` and `LayoutProps<"/route">` (already used in `app/layout.tsx`).
- **`useSearchParams` without `<Suspense>`** client-renders up to the nearest boundary and can fail the prerender. Wrap the widget and the filter bars (docs: `04-functions/use-search-params.md`).
- **Never call `cookies()` or `headers()`** in `(site)` pages or layouts. Doing so turns the whole public site dynamic. The thank-you, search and unsubscribe pages are dynamic through `searchParams` only.
- **Uploads never go through Server Actions** (1 MB default) or function bodies (about 4.5 MB on Vercel). Use signed direct uploads (§2.4).
- **`cv-auto`** must not go on sticky containers (the donate widget column), on pinned sections or on anything with overflowing brush edges. Paint containment clips the edges and breaks `sticky` inside.
- **Lenis plus a sticky widget:** sticky works because Lenis drives native scroll. Never wrap `(site)` content in a transformed container.
- **Image URLs:** always go through `img()`, `video()` and `poster()` (content-hashed). Never use raw `/media/…` (stale optimizer cache, README).
- **AVIF stays off** (`next.config.ts`).
- **The root `not-found.tsx` sits outside `(site)/layout.tsx`.** It must render `SiteChrome` itself.
- **Admin isolation:** `SmoothScroll` moves into `(site)/layout.tsx`, so `/admin` gets no Lenis. Tell the admin doc owner.
