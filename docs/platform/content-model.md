# Haven platform: content model

**Status:** design only. Nothing here is built yet.
**Scope:** how every piece of public content on the Haven site becomes editable by staff, without degrading the finished landing page.
**Read with:** the other `docs/platform/*` documents (architecture and routes, auth and roles, admin UX, payments, blog automation). Where this document needs something from one of them, it names the interface it expects (for example `requireStaff()` or `routeHref()`). The interface is the contract. The other document owns the implementation.

Source material:
- `docs/CLIENT-SPEC.md` (ToR plus the owner's direction)
- `HANDOFF.md`
- `README.md`
- every file in `content/`, `components/sections/` and `components/layout/`
- the Next 16 docs in `node_modules/next/dist/docs/`, in particular:
  - `01-getting-started/08-caching.md` and `09-revalidating.md`
  - `03-api-reference/01-directives/use-cache.md`
  - the `updateTag`, `revalidateTag` and `cacheTag` references
  - `02-guides/draft-mode.md`, `02-guides/server-actions.md` and `02-guides/data-security.md`

---

## 0. Decisions at a glance

1. **One typed schema in zod 4 is the single source of truth.** It lives in `lib/content/schema.ts`, and every type is `z.infer`'d from it.
   - The schema also encodes the landing page's layout limits: item counts and character caps. Staff therefore cannot save content that would break the design.
2. **Today's `content/*.ts` values become the seed (defaults).**
   - The files are rewritten in place into typed seed modules, keeping the same values, adding ids, and moving in the copy that is currently hard-coded inside components.
   - Defaults are always present, so the site renders fully with no database at all.
3. **Storage has two shapes.**
   - **Singleton documents** (`settings.*`, `home.*`, `pages.*`, `donate.config`).
   - **Collections** (programmes, causes, stats, stories, testimonials, team, faqs, partners, projects, posts, policies, media).
   - Every stored record shares one envelope: `{ published, draft, version, ... }`.
4. **Three backends are selected by environment:**
   - Firestore and Firebase Storage when credentials are set
   - JSON files under a git-ignored `.data/` directory on a writable local disk
   - read-only defaults otherwise, for example a Vercel deploy without Firebase
5. **Turn on Next 16 Cache Components (`cacheComponents: true`).**
   - Readers are `'use cache'` functions with `cacheLife('content')` and `cacheTag(...)`.
   - Admin saves call `updateTag()` from server actions, so the next request reads fresh data.
   - Scheduled jobs call `revalidateTag(tag, 'max')`.
   - `unstable_cache` is the superseded API, so we don't use it.
6. **Preview uses Next Draft Mode.** `getContent()` returns `draft ?? published` when `draftMode().isEnabled`. Draft Mode can be read inside `'use cache'`, and it bypasses the cache.
7. **Sections receive content as props from their server parent.** The parents are `app/(site)/page.tsx` and `app/(site)/layout.tsx`.
   - There is no React context.
   - Each section changes its import line into a prop with the same variable name, so the JSX bodies stay untouched.
8. **Writes go through server actions only.** Each one runs, in order:
   1. `requireStaff()`
   2. zod validation of the input
   3. an optimistic `version` check
   4. a per-field-group role check
   5. a safeguarding gate on publish
   6. an audit entry
   7. a version snapshot
   8. `updateTag()`
9. **Media is referenced by id** (`{ $media: "hero-family-in" }`), never by URL.
   - One media index merges the existing fingerprinted `/media` pipeline with staff uploads.
   - Uploads are re-encoded by sharp: EXIF and GPS are stripped, the output is WebP, and the file is content-hashed. They are stored in Firebase Storage or `.data/uploads`, and served through `/uploads/[...key]`.
   - Safeguarding fields live on the asset, which is the one place to withdraw consent site-wide.
10. **Blog bodies are structured JSON blocks** with a tiny inline markup subset, not Markdown or MDX.
    - This suits a non-technical editor working on a phone.
    - It lets AI drafting produce validated output through `z.toJSONSchema()`.
    - It keeps HTML and code out of the pipeline.
11. **Statistics live in one registry (`stats`), and sections reference them by id.**
    - "45+ partners" appears in two places today, and this keeps them consistent.
    - Every figure carries a `verification` state. The "placeholder figures" notes now show automatically whenever an unverified figure is displayed.
12. **Navigation, country geography, form option enums, the logo and the baked art stay in code.**
    - Programme menu entries and footer link columns are derived from the programmes and policies collections.

---

## 1. Guarantees for the landing page

- **G1. Defaults are always there.**
  - Every singleton has a default, and every collection falls back to its seed list until the first admin write seeds it.
  - With an empty `.data/`, or no Firebase, the page is byte-for-byte today's content.
- **G2. Design limits are schema limits.**
  - Examples: Impact needs exactly 3 cards, Restoring exactly 4 stats, Focus 3 to 5 slides, hero titles at most 30 characters a line. Section 3.6 has the full table.
  - The admin cannot save layout-breaking content, and it explains why in plain words.
- **G3. Bad data never breaks a page.**
  - Stored data is merged over defaults and parsed with zod on every read.
  - A doc that fails validation (for example after a schema change) falls back to its defaults, an item that fails is dropped, and both are logged and surfaced in the admin.
- **G4. The refactor changes no markup.** Sections keep their JSX and class names. The only edits are:
  - where the data comes from
  - `.src` and `.alt` on media
  - ids as React keys
  - a handful of hard-coded strings becoming fields

  A before-and-after screenshot gate (section 9) enforces this.
- **G5. Section order is fixed.**
  - Brush edges and backgrounds are designed against their neighbours: the Partners torn edge, the hero paint corner, and the Duo white-to-cream straddle. Staff therefore cannot reorder sections.
  - Only six sections whose neighbours tolerate removal can be hidden, and they also hide automatically when empty: `partners`, `stories`, `team`, `testimonials`, `projects`, `news`.
- **G6. Media URLs stay content-hashed.** Uploads use the same `<id>.<hash8>.<ext>` scheme as `scripts/media/fingerprint.mjs`, so the Next image optimizer, which caches by URL with no way to invalidate, can never serve a stale picture.

---

## 2. Inventory of every content item

**Legend:**
- **Consumer:** **S** is a server component and **C** is a client component (`"use client"`).
- **Roles:**
  - **SA** Super Administrator
  - **CM** Content Manager
  - **PO** Programme Officer
  - **SO** Safeguarding Officer
  - **FO** Finance or Donation Officer
  - **RM** Report Manager
  - **V** Viewer or Auditor, who has read-only access to every content screen and the audit log
  - Counsellors have no content access.
- **Target** is the document or collection the item moves to (section 3).

### 2.1 Site-wide (`content/site.ts`, `content/nav.ts`, `content/world.ts`, layout components)

| # | Item / field | Current source | Consumer | Admin-editable | Role(s) | Target |
|---|---|---|---|---|---|---|
| 1 | `site.name`, `site.orgName` | site.ts | S `app/layout.tsx` (metadata), S `opengraph-image.tsx`, S Footer | Yes (text only; the wordmark SVG `components/art/Logo.tsx` stays code) | SA | `settings.site` (brand group) |
| 2 | `site.tagline`, `site.altTagline` | site.ts | S layout, S OG image, C Manifesto | Yes | CM | `settings.site` |
| 3 | `site.description` | site.ts | S layout metadata, S Footer | Yes | CM | `settings.site` |
| 4 | `site.url` | site.ts | S layout `metadataBase`, robots, sitemap | **No**. Moves to env `NEXT_PUBLIC_SITE_URL` (fallback `https://haven.org.gm`) | n/a | env |
| 5 | `site.foundedYear` (drives "Years of Service") | site.ts | S Founder | Yes | SA | `settings.site` (brand group) |
| 6 | `contact.addressLabel`, `offices[]`, `phoneLabel`, `phone`, `emailLabel`, `email` | site.ts | C Header, C MobileMenu, S Footer | Yes. `phoneHref` and the one-line `address` are **derived**, not stored | CM | `settings.contact` |
| 7 | `socials[]` (`name`, `icon`, `href`) | site.ts | C Header, C MobileMenu, S Footer | Yes: `href` and show or hide. `icon` comes from the fixed set in `SocialIcons.tsx` | CM | `settings.contact` |
| 8 | `emergencyNotice` | site.ts | S DoorsOpen, S Footer | Yes | SO, SA | `settings.safety` |
| 9 | `tickerMessages[]` | site.ts | C Header → C Ticker | Yes | CM | `settings.announcements` |
| 10 | Footer heading "If a Child Is in Danger, Act Now" | hard-coded Footer.tsx | S Footer | Yes | SO, SA | `settings.safety.footerHeading` |
| 11 | Footer CTA labels ("Request Support", "Report a Concern", "Donate Now") | hard-coded Footer.tsx | S Footer | Yes (labels; destinations from a fixed list) | CM | `settings.chrome` |
| 12 | Footer giant line "Restoring Hope. Protecting Childhood." | hard-coded Footer.tsx → C FooterGiantText | S/C | Yes | CM | `settings.site.footerStatement` |
| 13 | Footer sign-off "Made with ♥ for every child." | hard-coded | S Footer | Yes (the text after the heart) | CM | `settings.site.signOff` |
| 14 | Footer column titles ("Quick Links", "Our Programmes", "Contact Us"), "All Rights Reserved." | hard-coded | S Footer | No (interface chrome) | n/a | code |
| 15 | `mainNav` (labels, hrefs, mega flag) | nav.ts | C Header, C NavDropdown, C MobileMenu | **No**. Becomes `lib/nav.ts` (code). Programme children are **derived** from `programmes` (`title`, `navBlurb`, `icon`) | n/a | code + derived |
| 16 | `footerLinks.quick` | nav.ts | S Footer | No | n/a | code (`lib/nav.ts`) |
| 17 | `footerLinks.programmes` | nav.ts | S Footer | Derived from `programmes` (live, ordered) | n/a | derived |
| 18 | `footerLinks.legal` | nav.ts | S Footer | Derived from `policies` plus fixed routes (Report a Concern, Request a Report, Administrator Login) | n/a | derived |
| 19 | Header CTAs ("Donate Now", "Donate", "Report a Concern" tooltip) | hard-coded Header.tsx | C Header | No (chrome) | n/a | code |
| 20 | Search title, placeholder and suggestion chips | hard-coded SearchOverlay.tsx | C SearchOverlay | No in v1. Later derived from a search index | n/a | code |
| 21 | Metadata title template; OG image headline "Every child deserves / a safe & hopeful future" | layout.tsx, opengraph-image.tsx | S | Yes | CM | `settings.seo` |
| 22 | Countries (`code`, `name`, `region`, `lat`, `lon`), `FLAG_SPRITE`, `countryByCode` | world.ts | S WorldFlags, S/C Flag, C Hero, C Appeals, C Stories | **No**. This is reference data baked into `public/flags/sprite.webp` and `components/art/world-map.ts` by scripts. Admin forms use it as a country picker | dev | code |
| 23 | Map legend "Head office · The Gambia", HQ code `gm` | hard-coded WorldFlags.tsx | S | No (derived from HQ constant) | n/a | code |
| 24 | Logo, brush shapes, hands, doodles, manifesto knockout glyphs ("EVERY CHILD"), world map | `components/art/*` | S/C | No (baked art) | dev | code |

### 2.2 Home sections (`content/home.ts`, `content/people.ts`, `content/programmes.ts`, plus copy hard-coded in components)

| # | Item / field | Current source | Consumer | Admin-editable | Role(s) | Target |
|---|---|---|---|---|---|---|
| 25 | `hero.slides[]`: `eyebrow`, `title[2]`, `place`, `media` | home.ts | C Hero | Yes (1 to 7 slides). Media must pass the consent gate | CM | `home.hero` |
| 26 | `hero.text` | home.ts | C Hero | Yes | CM | `home.hero` |
| 27 | Hero CTAs "Support a Child" / "Request Support" | hard-coded Hero.tsx | C Hero | Yes (label + destination) | CM | `home.hero.primaryCta/secondaryCta` |
| 28 | WorldFlags eyebrow, heading, intro | hard-coded WorldFlags.tsx | S WorldFlags | Yes | CM | `home.world` |
| 29 | `partners.title` ("Trusted by over", "45+", "partners & communities") | home.ts | S Partners | Yes. The number becomes stat `community-partners` | CM (stat value: PO) | `home.partners` + `stats` |
| 30 | Partners subline "Organisations and communities we work with across borders." | hard-coded Partners.tsx | S | Yes | CM | `home.partners.subline` |
| 31 | Partner logos (five placeholder SVG badges) | `components/art/PartnerLogos.tsx` | S Partners | Yes. Becomes the `partners` collection. The SVG badges become `builtin:` logo seeds marked placeholder. Publishing a real partner needs recorded permission | CM | `partners` |
| 32 | Programmes section eyebrow "Our Programmes", lines "We Do It For Every Child / Care That Reaches Every Need", card CTA "Learn More" | hard-coded Programmes.tsx | S | Yes | CM | `home.programmes` |
| 33 | `programmes[]`: `id`, `title`, `headline`, `summary`, `services[]`, `notice` | programmes.ts | S Programmes, C Donate (titles in select), nav (duplicated labels) | Yes. Copy: CM, PO. `notices`: SO, SA. `id`, `slug` and `icon` are fixed | CM, PO, SO | `programmes` |
| 34 | `about.eyebrow`, `body[]`, `values[]` (label, tone), `vision`, `image` | home.ts | S About | Yes (exactly 4 values, for the 2×2 grid) | CM | `home.about` |
| 35 | About heading lines "Restoring Hope / One Child at a Time" (hard-coded; `about.title` is unused) | About.tsx | S | Yes | CM | `home.about.titleLines` |
| 36 | About image alt "A joyful schoolboy running home…", "Our vision:" label, CTA "About More" | hard-coded About.tsx | S | Alt: yes, through the media asset. Label and CTA: yes | CM | media + `home.about` |
| 37 | `duo[]`: `title`, `text`, `cta`, `tone`, `image` | home.ts | S Duo | Yes (exactly 2) | CM | `home.duo` |
| 38 | `manifesto.media` (video + poster) | home.ts | C Manifesto | Yes, choosing from the video library only (section 6.7) | CM | `home.manifesto` |
| 39 | `manifesto.word`, `manifesto.line` | home.ts | unused | Remove | n/a | n/a |
| 40 | Manifesto CTAs "Donate" / "Tell Your Story" | hard-coded Manifesto.tsx | C | Yes | CM | `home.manifesto.ctas` |
| 41 | `impact.title[3]`, `impact.text` | home.ts | S Impact | Yes | CM | `home.impact` |
| 42 | `impact.stats[]`: `label`, `value`, `suffix`, `note`, `tone` | home.ts | S Impact | Yes. Values live in `stats` and the cards hold `{statId, tone}` | values and verification: PO, SA; label and note: CM | `stats` + `home.impact.cards` |
| 43 | Impact note "Figures shown are placeholders pending verified programme data." | hard-coded Impact.tsx | S | Text: yes. Visibility is automatic: shown if any displayed stat is unverified | CM | `home.impact.placeholderNote` |
| 44 | `focus.items[]`, `captions[]`, `media[]` | home.ts | C Focus | Yes. Restructured to `slides[{word, caption, media}]`, 3 to 5 slides | CM | `home.focus` |
| 45 | `appeals.eyebrow`, `title[2]`, `groups[]` | home.ts | C Appeals | Yes. Groups become `{id,label}`; "All" stays code | CM | `home.appeals` |
| 46 | Appeals intro "From Ramadan and Eid…", note "Appeal figures are illustrative…" | hard-coded Appeals.tsx | C | Yes (note shown automatically while any cause is unverified) | CM | `home.appeals` |
| 47 | `appeals.items[]`: `title`, `season`, `group`, `place`, `currency`, `raised`, `goal`, `image`, `tone` | home.ts | C Appeals, C Donate (select) | Yes. Becomes the `causes` collection. Copy, image and tone: CM. `currency`, `goal`, `offlineRaised`, `allocation`: FO. `raised` is **derived** | CM, FO | `causes` |
| 48 | `donate.title[3]`, `donate.text`, `donate.media` | home.ts | C Donate | Yes | CM | `home.donate` |
| 49 | `donate.currencies` (`name`, `min`, `amounts[6]`) | home.ts | C Donate | Yes | FO | `donate.config` |
| 50 | `donate.frequencies` | home.ts | C Donate | The list stays code (it maps to Stripe intervals). FO can switch individual frequencies off | FO | `donate.config.frequencies` |
| 51 | `donate.inKind[]` | home.ts | C Donate | Yes | FO, CM | `donate.config.inKind` |
| 52 | Donate copy: "Where it’s needed most", thank-you texts (cash and in kind), "We never store card details on this site." | hard-coded Donate.tsx | C | Yes | CM | `home.donate` |
| 53 | Donate consent labels: "Yes, send me approved impact updates…", "Keep my gift anonymous…" | hard-coded Donate.tsx | C | Yes (legal wording) | SA | `home.donate` (legal group) |
| 54 | Donate controls ("Choose Donate", "Cash gift", "Back", "Confirm", "OTHER", field placeholders) | hard-coded | C | No (interface microcopy) | n/a | code |
| 55 | `doorsOpen.title`, `text` | home.ts | S DoorsOpen | Yes | CM | `home.doors` |
| 56 | `doorsOpen.hands[2]` | home.ts | S DoorsOpen | No (decorative cut-outs; read through `lib/media/pipeline.ts`) | dev | code |
| 57 | DoorsOpen CTAs "Request Support" / "Report a Concern" | hard-coded | S | Yes | CM | `home.doors` |
| 58 | `stories[]`: `label`, `meta`, `place`, `text`, `image` | people.ts | C Stories | Yes. Anonymised by design (no name field; country only). Publishing needs consent recorded | CM (SO can withdraw) | `stories` |
| 59 | Stories title "Stories of Hope", intro, CTAs "Tell Your Story" / "See All Stories" | hard-coded Stories.tsx | C | Yes | CM | `home.stories` |
| 60 | `founder.eyebrow`, `text`, `quoteName`, `quoteRole`, `quote`, `image` | home.ts | S Founder | Yes | CM | `home.founder` |
| 61 | Founder heading lines "Lasting Change, / Built Around / Every Child" (hard-coded; `founder.title` is unused), CTA "Our Story", image alt | Founder.tsx | S | Yes | CM | `home.founder` |
| 62 | "Years of Service" label and number | Founder.tsx | S | Label: code. Number: derived from `foundedYear` | n/a | derived |
| 63 | `team[]`: `name`, `role`, `image`, `socials[]` | people.ts | C Team | Yes, plus a new `bio` (ToR §18) for the About page | CM | `team` |
| 64 | Team eyebrow "Our Team", heading "Meet the People Behind Haven" | hard-coded Team.tsx | C | Yes | CM | `home.team` |
| 65 | `restoring.text`, `stats[4]`, `image`, `film` | home.ts | C Restoring | Yes. Stats are references (exactly 4) | CM (values: PO) | `home.restoring` + `stats` |
| 66 | Restoring heading lines (hard-coded; `restoring.title` is unused), note "Placeholder figures — …", lightbox title "Haven: our story", image alt | Restoring.tsx | C | Yes (note automatic) | CM | `home.restoring` |
| 67 | `testimonials[]`: `name`, `role`, `quote`, `image` | people.ts | C Testimonials | Yes. Publishing needs consent recorded | CM | `testimonials` |
| 68 | Testimonials eyebrow and heading lines | hard-coded Testimonials.tsx | C | Yes | CM | `home.testimonials` |
| 69 | "5.0" star rating tab | hard-coded Testimonials.tsx | C | No. This is a decorative number with no source behind it. Recommend replacing it with a quote glyph (see open questions) | n/a | code |
| 70 | `journey.title`, `text`, `steps[]` (`title`, `text`, `image`) | home.ts | S Journey | Yes (3 to 6 steps) | CM | `home.journey` |
| 71 | `projects.eyebrow`, `title`, `items[3]` | home.ts | S Projects | Yes. Items become the `projects` collection, and the home section shows 3 featured | CM, PO | `home.projects` + `projects` |
| 72 | "View All Projects" | hard-coded | S | Yes | CM | `home.projects.cta` |
| 73 | `faq[]` (`q`, `a`) | people.ts | C Faq | Yes. Items with `locked: true` (emergency, guarantee) are SO-only | CM; locked items SO | `faqs` |
| 74 | FAQ eyebrow, heading, the three collage images and their alts | hard-coded Faq.tsx (`img("faq-main")` …) | C | Yes | CM | `home.faq` |
| 75 | `join.title[3]`, `text`, `media` | home.ts | C JoinSphere | Yes | CM | `home.join` |
| 76 | Join note "We only send approved updates. Unsubscribe any time." | hard-coded | C | Yes | CM | `home.join.note` |
| 77 | `news[]` (`date`, `category`, `title`, `image`) | people.ts | S News | Yes. Becomes the `posts` collection, and the section reads the 3 latest published | CM publishes; PO drafts | `posts` |
| 78 | News eyebrow, heading, intro, card CTA "Read More" | hard-coded News.tsx | S | Yes | CM | `home.news` |
| 79 | Every pipeline image and video (58 images, 7 videos, 7 posters) | `content/media-map.ts`, `content/media-credits.ts` | all sections | Replaceable through the media library. Safeguarding flags are seeded from `media-credits.ts` | CM (SO: consent) | `media` |
| 80 | Optional section visibility | n/a | S page | Yes, for the 6 optional sections only (G5) | CM | `home.layout` |

### 2.3 New public content (pages that do not exist yet)

| Item | Target | Role(s) |
|---|---|---|
| About page: who we are, vision, mission, 7 values with descriptions, approach, team intro (ToR §4) | `pages.about` | CM |
| Get Support, Report a Concern, Donate, Get Involved, Our Impact, Resources, Contact and News page intros | `pages.*` | CM. `pages.reportConcern`: SO, SA. `pages.resources`: CM, RM |
| Programme pages (ToR §5, nine parts each) | `programmes` | CM, PO; notices SO |
| Cause pages (`/donate/[slug]`): story, allocation breakdown, impact units | `causes` | CM copy, FO money |
| Policies: Child Safeguarding, Privacy, Terms | `policies` | SA; safeguarding policy SO |
| Blog and news posts | `posts` | CM, PO (draft) |
| Editorial plan for monthly AI drafts | `settings.editorial` | CM |

---

## 3. Schema

### 3.1 File layout

```
lib/content/
  schema.ts       zod schemas (isomorphic: the admin forms validate client-side with the same schemas)
  types.ts        z.infer types + Resolved<T> + view-model (props) types. Client components use `import type` only
  registry.ts     DOCS + COLLECTIONS: label, schema, edit roles, field groups, tags, preview path (isomorphic)
  defaults.ts     server-only: aggregates the seed modules into DEFAULT_DOCS / DEFAULT_ITEMS
  read.ts         server-only: getContent / getCollection / page assemblers ('use cache')
  resolve.ts      server-only: MediaRef → ResolvedMedia, stat ids → ResolvedStat, derived fields
  actions.ts      'use server': saveDoc, saveItem, reorder, setVisibility, restoreVersion, …
  access.ts       role and field-group checks (isomorphic: the admin uses them to grey out fields; the server enforces)
  gate.ts         safeguarding publish gate
  diff.ts         changed-path diff for audit and field-group checks
  inline.ts       inline-text parser (bold / italic / link), isomorphic
  store/
    types.ts      ContentStore interface
    index.ts      contentStore(): picks firestore | local | readonly
    local.ts      .data JSON files
    firestore.ts  firebase-admin
lib/media/
  pipeline.ts     img()/video()/poster() + pipeline asset records (moved from content/home.ts; relative imports only)
  index.ts        getMediaIndex() ('use cache', tag "media")
  process.ts      sharp re-encode (server-only)
  storage/{index,local,firebase}.ts
content/          seed modules (values from today's files): site.ts, home.ts, people.ts, programmes.ts,
                  causes.ts, stats.ts, posts.ts, partners.ts, pages.ts, policies.ts, media-meta.ts,
                  world.ts (unchanged), media-map.ts (unchanged, generated), media-credits.ts (unchanged, generated)
```

**Keep `content/world.ts` and `content/media-map.ts` dependency-free.** `scripts/art/flags-sprite.mjs`, `scripts/art/world-map.mjs` and `scripts/art/og-bg.mjs` import them directly through Node type stripping:
- Never add `@/` imports or `import "server-only"` to them. The npm `server-only` module throws outside the react-server condition, which would break those scripts.
- `lib/media/pipeline.ts` uses relative imports for the same reason.

### 3.2 Primitives

```ts
// lib/content/types.ts (shown as TS for readability; the source of truth is the zod in schema.ts)

export type Role =
  | "super_admin" | "content_manager" | "programme_officer" | "safeguarding_officer"
  | "finance_officer" | "counsellor" | "report_manager" | "viewer"; // must match the auth doc

export type Currency = "GMD" | "USD" | "GBP" | "EUR";         // moves here from content/home.ts
export type Frequency = "one_time" | "monthly" | "quarterly" | "annual";
export type ProgrammeId = "protection" | "education" | "medical" | "psychological" | "legal" | "family";
export type CountryCode = string;  // refine: countryByCode(code) !== undefined (content/world.ts spriteCountries)
export type SocialIconName = "facebook" | "instagram" | "tiktok" | "x" | "youtube" | "linkedin";

/** Destinations are chosen from a list, never typed in. lib/routes.ts (IA doc) exports
 *  routeHref(key: RouteKey, on?: "home"): string. On the home page, keys whose section is on the page
 *  (donate, support, stories, faq, news, appeals, impact, about, programmes) resolve to in-page anchors. */
export type RouteKey =
  | "top" | "about" | "programmes" | "involved" | "impact" | "appeals" | "donate" | "support"
  | "report" | "stories" | "tellStory" | "faq" | "news" | "contact" | "volunteer" | "partner"
  | "projects" | "resources";
export type Cta = { label: string; to: RouteKey };            // label ≤ 24 chars

export type MediaRef = { $media: string };                    // id in the media index
export type InlineText = string;                              // **bold**, _italic_, [label](https://… or /path) only
export type HeadingLines = string[];                          // DonatHeading `lines`
export type VuTitle = string[];                               // VuHeading `parts`: odd indexes are the accent word
export type SectionHeader = { eyebrow: string; lines: HeadingLines; intro?: string };

export type Verification = {
  status: "placeholder" | "verified";
  evidence?: string;          // required when verified: where the figure comes from
  verifiedBy?: string;        // uid
  verifiedAt?: string;        // ISO
};

export type Consent = {
  status: "not_required" | "pending" | "recorded" | "withdrawn";
  recordRef?: string;         // id in the restricted `consents` collection (owned by safeguarding; holds the signed form)
  scope?: ("web" | "social" | "print")[];
  recordedBy?: string; recordedAt?: string; expiresAt?: string;
};
```

```ts
// Resolved forms that sections receive. The discriminator is `type`, matching what Hero/Focus already test.
export type ResolvedImage = {
  type: "image"; id: string; src: string; alt: string;
  width?: number; height?: number; blurDataURL?: string;
  objectPosition?: string;    // from the asset's focal point, e.g. "50% 30%"
  illustrative: boolean;      // AI-generated and shows people
};
export type ResolvedVideo = { type: "video"; id: string; src: string; poster: string; alt: string; illustrative: boolean };
export type ResolvedMedia = ResolvedImage | ResolvedVideo;

export type Resolved<T> =
  T extends MediaRef ? ResolvedMedia :
  T extends readonly unknown[] ? { [K in keyof T]: Resolved<T[K]> } :   // keeps tuples
  T extends object ? { [K in keyof T]: Resolved<T[K]> } : T;

export type ResolvedStat = { id: string; label: string; value: number; suffix: string; note?: string; placeholder: boolean };
```

### 3.3 Stored record envelope (all backends)

```ts
export type StoredRecord<T> = {
  id: string;                         // doc id ("home.hero") or item id ("ramadan-food-packs")
  published: T | null;                // what the public sees
  draft: T | null;                    // staff work in progress; visible only in preview (Draft Mode)
  version: number;                    // +1 on every write; optimistic concurrency
  visibility: "live" | "hidden" | "archived";   // collections; singletons are always "live"
  placeholder?: boolean;              // seeded from a // CLIENT value; cleared when staff confirm it
  createdAt: string; createdBy: string;
  updatedAt: string; updatedBy: string;
  publishedAt?: string; publishedBy?: string;
};
```

The admin uses the same flow for every record: edit (auto-saves the draft), Preview, then Publish. Section 5.1 explains why posts add a review workflow on top of this.

### 3.4 Singleton documents

| Doc id | Admin label (warm wording for staff) | Edit roles (field groups) | Preview path | Tag |
|---|---|---|---|---|
| `settings.site` | Organisation details | SA, CM; brand group (`name`, `orgName`, `foundedYear`): SA | `/` | `content:settings.site` |
| `settings.contact` | Contact details & social links | SA, CM | `/#contact` | `content:settings.contact` |
| `settings.safety` | Safety notices | SA, SO | `/#support` | … |
| `settings.announcements` | Messages in the menu bar | SA, CM | `/` | … |
| `settings.chrome` | Header & footer buttons | SA, CM | `/#contact` | … |
| `settings.seo` | How Haven looks when shared | SA, CM | `/` | … |
| `settings.editorial` | Monthly story plan (AI drafts) | SA, CM | n/a | … |
| `home.layout` | Show or hide home sections | SA, CM | `/` | … |
| `home.hero` | Welcome slideshow | SA, CM | `/#top` | … |
| `home.world` | Countries we stand with | SA, CM | `/` | … |
| `home.partners` | Partners strip | SA, CM | `/` | … |
| `home.programmes` | Programmes heading | SA, CM | `/#programmes` | … |
| `home.about` | About Haven | SA, CM | `/#about` | … |
| `home.duo` | Volunteer & partner cards | SA, CM | `/#involved` | … |
| `home.manifesto` | "Every Child" film | SA, CM | `/` | … |
| `home.impact` | Impact numbers | SA, CM | `/#impact` | … |
| `home.focus` | What we stand for | SA, CM | `/` | … |
| `home.appeals` | Appeals heading & filters | SA, CM | `/#appeals` | … |
| `home.donate` | Donate box words | SA, CM; legal group (consent labels): SA | `/#donate` | … |
| `donate.config` | Currencies, amounts & in-kind items | SA, FO | `/#donate` | … |
| `home.doors` | "You do not have to face it alone" | SA, CM | `/#support` | … |
| `home.stories` | Stories heading | SA, CM | `/#stories` | … |
| `home.founder` | A word from our founder | SA, CM | `/` | … |
| `home.team` | Team heading | SA, CM | `/` | … |
| `home.restoring` | "We always stand with children" | SA, CM | `/` | … |
| `home.testimonials` | Testimonials heading | SA, CM | `/` | … |
| `home.journey` | How we reach every child | SA, CM | `/` | … |
| `home.projects` | Recent projects heading | SA, CM | `/` | … |
| `home.faq` | Questions heading & photos | SA, CM | `/#faq` | … |
| `home.join` | Join the Haven family | SA, CM | `/` | … |
| `home.news` | Latest news heading | SA, CM | `/#news` | … |
| `pages.about` | About page | SA, CM | `/about` | … |
| `pages.getSupport`, `pages.donate`, `pages.getInvolved`, `pages.impact`, `pages.contact`, `pages.news` | Page introductions | SA, CM | their route | … |
| `pages.reportConcern` | Report a Concern page | SA, SO | `/report-a-concern` | … |
| `pages.resources` | Resources page introduction | SA, CM, RM | `/resources` | … |

All tags follow the pattern `content:<docId>`. Route paths are owned by the IA doc and listed here only for preview.

```ts
// Settings
export type SiteSettings = {
  name: string; orgName: string; foundedYear: number;           // brand group (SA)
  tagline: string; altTagline: string; description: string;     // ≤ 70 / 70 / 200
  footerStatement: string;                                      // ≤ 44, giant footer line
  signOff: string;                                              // "for every child."
  illustrativeNotice: string;   // shown in the footer while any AI image with people is live (6.5)
  timeZone: string;             // "Africa/Banjul": used for dates on cards
};
export type ContactSettings = {
  addressLabel: string;
  offices: { label: string; address: string; mapUrl?: string }[];        // 1–3
  phoneLabel: string; phone: string;                                     // phoneHref derived: "tel:" + digits
  emailLabel: string; email: string;
  socials: { icon: SocialIconName; name: string; href: string; show: boolean }[]; // href: https URL or "#" (placeholder)
};
export type SafetySettings = { emergencyNotice: string; footerHeading: string };
export type Announcements = { ticker: string[] };                       // 2–8, each ≤ 70
export type ChromeSettings = { footerCtas: [Cta, Cta]; donateCta: Cta }; // footer buttons
export type SeoSettings = { ogLines: [string, string]; ogImage?: MediaRef };
export type EditorialSettings = {
  aiDrafting: { enabled: boolean; dayOfMonth: number /* 1–28 */; };
  topics: { id: string; topic: string; notes?: string; programmeId?: ProgrammeId; milestoneDate?: string; used?: boolean }[];
  voice: string;               // tone guidance fed to the drafter
  mustAvoid: string[];         // e.g. "children's names", "village names", "medical diagnoses"
};

// Home
export type HomeLayout = { hidden: ("partners" | "stories" | "team" | "testimonials" | "projects" | "news")[] };
export type HomeHero = {
  slides: { id: string; eyebrow: string; title: [string, string]; place: CountryCode; media: MediaRef }[]; // 1–7
  text: string; primaryCta: Cta; secondaryCta: Cta;
};
export type HomeWorld = SectionHeader;
export type HomePartners = { before: string; statId: string; after: string; subline: string };
export type HomeProgrammes = SectionHeader & { cardCta: string };
export type HomeAbout = {
  eyebrow: string; titleLines: HeadingLines; body: string[];             // body 1–3 paragraphs
  values: { label: string; tone: "forest" | "marigold" | "flame" | "night" }[]; // exactly 4
  visionLabel: string; vision: string; image: MediaRef; cta: Cta;
};
export type HomeDuo = { cards: [DuoCard, DuoCard] };
export type DuoCard = { title: string; text: string; cta: Cta; tone: "forest" | "charcoal"; image: MediaRef };
export type HomeManifesto = { media: MediaRef /* video */; ctas: [Cta, Cta] };
export type HomeImpact = {
  title: VuTitle; text: string; placeholderNote: string;
  cards: [ImpactCard, ImpactCard, ImpactCard];
};
export type ImpactCard = { statId: string; tone: "clay" | "marigold" | "cocoa" };
export type HomeFocus = { slides: { id: string; word: string; caption: string; media: MediaRef }[] }; // 3–5
export type HomeAppeals = {
  eyebrow: string; titleLines: HeadingLines; intro: string; placeholderNote: string;
  groups: { id: string; label: string }[];       // filter chips after "All" (which stays code)
};
export type HomeDonate = {
  title: VuTitle; text: string; media: MediaRef /* video */;
  anywhereLabel: string; securityNote: string; thankYouCash: string; thankYouKind: string;
  updatesConsentLabel: string; anonymousLabel: string;          // legal group (SA)
};
export type DonateConfig = {
  defaultCurrency: Currency;
  currencies: Record<Currency, { enabled: boolean; name: string; min: number; amounts: number[] }>; // amounts: exactly 6
  frequencies: Record<Frequency, boolean>;
  inKind: string[];                                             // 3–12, each ≤ 32
};
export type HomeDoors = { title: string; text: string; primaryCta: Cta; secondaryCta: Cta };
export type HomeStories = { title: VuTitle; intro: string; ctas: [Cta, Cta] };
export type HomeFounder = {
  eyebrow: string; titleLines: HeadingLines; text: string;
  quoteName: string; quoteRole: string; quote: string; image: MediaRef; cta: Cta;
};
export type HomeTeam = SectionHeader;
export type HomeRestoring = {
  titleLines: HeadingLines; text: string; statIds: [string, string, string, string];
  image: MediaRef; film: MediaRef /* video */; filmTitle: string; placeholderNote: string;
};
export type HomeTestimonials = SectionHeader;
export type HomeJourney = { title: string; text: string; steps: { id: string; title: string; text: string; image: MediaRef }[] }; // 3–6
export type HomeProjects = SectionHeader & { cta: Cta; featured?: [string, string, string] }; // else the 3 latest live projects
export type HomeFaq = SectionHeader & { media: { main: MediaRef; inset: MediaRef; heart: MediaRef } };
export type HomeJoin = { title: [string, string, string]; text: string; media: MediaRef /* video */; note: string };
export type HomeNews = SectionHeader & { cardCta: string };

// Pages (other routes; the IA doc owns layout, this owns the editable copy)
export type PageIntro = { eyebrow: string; lines: HeadingLines; intro: string; heroMedia?: MediaRef };
export type AboutPage = PageIntro & {
  whoWeAre: string[];                                           // ToR §4 "Who we are", 2–4 paragraphs
  vision: string; mission: string;                              // ToR §4 verbatim
  values: { label: string; text: string }[];                    // 7: Child-centred … Confidentiality
  approach: { title: string; text: string }[];                  // direct assistance, family support, referrals, advocacy, community education, partnerships
  teamIntro: string; testimonialsIntro: string;
};
export type GetSupportPage = PageIntro & { reviewPolicy: string; verificationNote: string };   // ToR §6
export type ReportConcernPage = PageIntro & { emergencyNotice: string; afterSubmit: string };  // ToR §7 (SO)
export type DonatePage = PageIntro & { pageCopy: string };                                     // ToR §8 "Give Hope Create Opportunity…"
export type GetInvolvedPage = PageIntro & { volunteerIntro: string; partnerIntro: string; sponsorshipRules: string }; // ToR §10
export type ContactPage = PageIntro & { concernRedirect: string };                             // ToR §11
export type ImpactPage = PageIntro & { statIds: string[]; storiesIntro: string };
export type ResourcesPage = PageIntro;
export type NewsPage = PageIntro;
```

### 3.5 Collections

| Collection | Item id | Edit roles (field groups) | Publish gate | Tags |
|---|---|---|---|---|
| `programmes` | fixed `ProgrammeId` (6; no create or delete, hide only) | CM, PO; `notices`: SO, SA | n/a | `col:programmes`, `programme:<id>` |
| `causes` | slug | copy: CM; money (`currency`, `goal`, `offlineRaised`, `allocation`, `impactUnits`, `presetAmounts`): FO; create: CM, FO | allocation sums to 100 | `col:causes`, `cause:<slug>` |
| `stats` | kebab id | `label`, `note`: CM; `value`, `verification`: PO (programme), FO (donation stats), SA | `verified` needs `evidence` | `col:stats` |
| `stories` | id | CM; SO can withdraw | `consent.status === "recorded"` | `col:stories` |
| `testimonials` | id | CM; SO can withdraw | `consent.status === "recorded"` | `col:testimonials` |
| `team` | id | CM | photo of an identifiable person needs consent | `col:team` |
| `faqs` | id | CM; `locked` items: SO, SA | n/a | `col:faqs` |
| `partners` | id | CM | `permission.status === "recorded"` unless `placeholder` | `col:partners` |
| `projects` | slug | CM, PO | n/a | `col:projects` |
| `posts` | id (slug unique) | draft: CM, PO; publish or schedule: CM, SA | review checklist (7.1) | `col:posts`, `post:<slug>` |
| `policies` | slug | SA; `child-safeguarding`: SO, SA | `lastReview.by` set | `col:policies` |
| `media` | asset id | upload and edit: CM, SA; consent fields: CM, SO; withdraw: SO, CM, SA | section 6.5 | `media` |

```ts
export type Programme = {
  id: ProgrammeId; slug: string;                     // slug fixed in code: "child-protection", "education-assistance", …
  order: number;
  title: string; headline: string; summary: string;  // card: title ≤ 28, summary ≤ 180
  navBlurb: string;                                  // mega-menu line ≤ 48 ("School fees, uniforms & materials")
  hero: { eyebrow: string; media: MediaRef };
  overview: Block[];                                 // §5.1 (paragraph/list/image/quote blocks only)
  problem: { heading: string; body: Block[]; facts: { statId?: string; value?: string; label: string; source: string }[] }; // §5.2
  support: { heading: string; intro?: string; items: { title: string; text?: string }[] };   // §5.3 (ToR service list)
  eligibility: { heading: string; intro: string; criteria: string[]; note: string };         // §5.4 ("does not guarantee…")
  process: { heading: string; steps: { title: string; text: string }[] };                    // §5.5, 3–6
  requestCta: { label: string; text: string; category: SupportCategory };                     // §5.6 → Get Support preselect
  donateCta: { label: string; text: string; causeSlug?: string };                             // §5.7
  partnerCta: { label: string; text: string };                                                // §5.7
  relatedResourceIds: string[];                      // §5.8 (resources collection, owned by the resources doc)
  relatedStoryIds: string[]; faqIds: string[];
  contact: { team: string; email: string; phone?: string; hours?: string };   // §5.9: a role mailbox, never a personal one
  notices: { kind: "emergency" | "medical" | "legal" | "assessment" | "eligibility"; text: string }[]; // SO
  seo: Seo;
};
export type SupportCategory =   // enum owned by the Get Support form doc; mirrored here for the CTA preselect
  | "child_protection" | "education" | "medical" | "psychological" | "legal" | "food_supplies" | "family" | "other";

export type Cause = {
  slug: string;                                      // frozen after first publish
  order: number; featured: boolean;
  title: string; season: string; groupId: string;    // groupId ∈ home.appeals.groups
  kind: "seasonal" | "year_round";
  programmeId?: ProgrammeId;
  place: CountryCode; tone: "flame" | "forest" | "clay"; image: MediaRef;
  summary: string; story: Block[];                   // /donate/[slug]
  // money group (FO)
  currency: Currency; goal: number;
  offlineRaised: number;                             // cash/bank/in-kind value recorded by finance
  allocation: { label: string; percent: number; note?: string }[];   // 2–6 rows, sum === 100
  impactUnits: { amount: number; label: string }[];  // "USD 25 feeds a family of five for a week"
  presetAmounts?: number[];                          // overrides donate.config amounts for this cause (6)
  verification: Verification;                        // finance confirms goal/allocation are real
  startsAt?: string; endsAt?: string;                // seasonal window; outside it the card hides automatically
  status: "active" | "paused" | "completed";
};
// raised = offlineRaised + getCauseTotals()[slug] (payments doc; tag "donation-totals"). Never stored.

export type Stat = {
  label: string; value: number; suffix: "" | "+" | "%" | "K+";
  note?: string;                                     // ≤ 110 (Impact card)
  kind: "programme" | "finance" | "organisation";    // decides who may set value/verify
  verification: Verification;
  source?: { metric: "donations.count" | "donations.amount" | "volunteers.active" }; // optional live figure (later)
};

export type Story = {                                // anonymised by design: there is no name field
  order: number;
  label: string;                                     // "A mother", ≤ 32
  meta: string;                                      // programme line, ≤ 32
  programmeId?: ProgrammeId;
  place: CountryCode;                                // country only (ToR §15)
  text: string;                                      // ≤ 140
  image: MediaRef;
  consent: Consent;                                  // consent for the story itself (separate from the photo's)
};

export type Testimonial = {
  order: number;
  name: string;                                      // display form "Denise W."; beneficiaries use a role word ("Parent")
  kind: "donor" | "beneficiary" | "volunteer" | "partner" | "professional";
  role: string; quote: string;                       // quote ≤ 280
  image?: MediaRef; consent: Consent;
};

export type TeamMember = {
  order: number; name: string; role: string; bio?: string;   // name ≤ 28, bio ≤ 600
  image: MediaRef; socials: { icon: SocialIconName; href: string }[]; // 0–4 (fan-out positions)
  showOn: ("home" | "about")[];
};

export type Faq = {
  order: number; q: string; a: string;               // q ≤ 120, a ≤ 600
  placements: ("home" | "support" | "donate" | "involved" | "resources" | "programme")[];
  locked: boolean;                                   // safety-critical wording: SO-only
};

export type Partner = {
  order: number; name: string; url?: string;
  logo: MediaRef | { builtin: "care-alliance" | "kids-first" | "schools-trust" | "global-health" | "carepoint" };
  permission: { status: "pending" | "recorded"; note?: string; recordedBy?: string; recordedAt?: string };
};

export type Project = {
  slug: string; order: number; title: string; subtitle: string;   // card: title ≤ 32, subtitle ≤ 32
  programmeId?: ProgrammeId; place?: CountryCode; date?: string;
  image: MediaRef; summary?: string; body?: Block[];
};

export type Policy = {
  slug: "child-safeguarding" | "privacy" | "terms" | string;
  title: string; summary: string; body: Block[];
  version: string; effectiveFrom: string;
  lastReview?: { by: string; reviewer: "internal" | "professional"; at: string }; // ToR §15 "professional review"
};

export type Seo = { title?: string; description?: string; ogImage?: MediaRef; noindex?: boolean };
```

Posts and `Block` are defined in section 7, and `MediaAsset` in section 6.

### 3.6 Layout constraints (enforced by zod, explained in the admin)

The admin shows a gentle character counter for each field: "fits nicely", "getting long", then "too long for this spot".

| Where | Rule | Why (component) |
|---|---|---|
| `home.hero.slides` | 1–7 slides; each title line ≤ 30; eyebrow ≤ 32 | slide controls width; `RiseWords` two-line h1 |
| `home.focus.slides` | 3–5; `word` ≤ 12 | the pin length is `n` viewports; giant Anton lines |
| `home.focus.slides[].caption` | ≤ 120 | caption pill |
| `home.impact.cards` | exactly 3 | `md:grid-cols-3` |
| `home.restoring.statIds` | exactly 4 | 2×2 `dl` with borders by index |
| `home.about.values` | exactly 4, label ≤ 18 | 2×2 checklist |
| `home.duo.cards` | exactly 2 | two-up straddle |
| `home.journey.steps` | 3–6; title ≤ 24; text ≤ 130 | 380px card height; 5 per row at xl |
| `home.projects` | 3 shown | `md:grid-cols-3` square tiles |
| `causes` | ≥ 1 active; title ≤ 60; season ≤ 24 | `min-h-[62px]` two-line title; the Embla loop needs ≥ 1 |
| `stories` | 3–12 live; label ≤ 32; text ≤ 140 | desktop capsule accordion |
| `team` | ≥ 2 live (4+ recommended); socials ≤ 4 | Embla loop; `fan` has 4 positions |
| `testimonials` | 1–10 live; quote ≤ 280 | quote card height |
| `faqs` (home) | 3–10 | accordion beside a 640px collage |
| `donate.config.currencies[*].amounts` | exactly 6 | `grid-cols-3` |
| `donate.config.currencies` | 1–4 enabled | `Segmented` grid |
| `settings.announcements.ticker` | 2–8, each ≤ 70 | truncates in the pill |
| `posts` card title | ≤ 70 | `min-h-[56px]` |
| Any `HeadingLines` | 1–3 lines, each ≤ 34 | DonatHeading `block` spans |
| Any `VuTitle` | 2–4 parts, total ≤ 28 | Anton 76px |

```ts
// schema.ts excerpt: the constraint style (zod 4)
import { z } from "zod";
const line = (max: number) => z.string().trim().min(1, { error: "Please add some words here." }).max(max, { error: `Please keep this under ${max} characters so it fits the design.` });
export const MediaRefSchema = z.strictObject({ $media: z.string().min(1) });
export const CtaSchema = z.strictObject({ label: line(24), to: z.enum(ROUTE_KEYS) });
export const HomeHeroSchema = z.strictObject({
  slides: z.array(z.strictObject({
    id: z.string(), eyebrow: line(32), title: z.tuple([line(30), line(30)]),
    place: CountryCodeSchema, media: MediaRefSchema,
  })).min(1).max(7),
  text: line(240), primaryCta: CtaSchema, secondaryCta: CtaSchema,
});
// Any field added after launch MUST carry .default(…) (or sit at the top level of a doc), so older stored docs still parse (4.4).
```

### 3.7 Seeds: today's content becomes the defaults

The `content/*.ts` files are rewritten in place as typed seed modules. Every existing value is copied **verbatim**, and the `// CLIENT` markers stay, now attached to `placeholder: true`. Each list gets stable ids, and media becomes `ref("id")`, where `ref = (id: string) => ({ $media: id })` lives in `lib/media/pipeline.ts`.

| Seed module (export) | Built from today's | Notes |
|---|---|---|
| `content/site.ts` → `siteSeed`, `contactSeed`, `safetySeed`, `announcementsSeed`, `chromeSeed`, `seoSeed` | `site` | `offices[]` keeps the two current addresses; the joined `address` line is derived. `footerHeading: "If a Child Is in Danger, Act Now"`, `footerStatement: "Restoring Hope. Protecting Childhood."`, `signOff: "for every child."`, `ogLines: ["Every child deserves", "a safe & hopeful future"]`. `illustrativeNotice: "Some photographs on this site are illustrative and do not show the children and families we support."` (new copy, client to confirm) |
| `content/home.ts` → `homeSeed: { [K in HomeDocId]: … }` | `hero`, `about`, `duo`, `impact`, `focus`, `appeals` (heading), `donate`, `doorsOpen`, `founder`, `restoring`, `journey`, `projects` (heading), `partners`, `join`, plus the hard-coded copy in rows 27–78 | Hard-coded strings move in verbatim: `home.programmes = { eyebrow: "Our Programmes", lines: ["We Do It For Every Child", "Care That Reaches Every Need"], cardCta: "Learn More" }`, `home.about.titleLines = ["Restoring Hope", "One Child at a Time"]`, `home.founder.titleLines = ["Lasting Change,", "Built Around", "Every Child"]`, `home.restoring.titleLines = ["We Always Stand With", "Children and Families"]`, `home.team = { eyebrow: "Our Team", lines: ["Meet the People Behind Haven"] }`, `home.testimonials = { eyebrow: "Testimonials", lines: ["What People Say About", "Our Work"] }`, `home.faq = { eyebrow: "Frequently Asked Questions", lines: ["Have Any Questions For Us?"], media: { main: ref("faq-main"), inset: ref("faq-bw"), heart: ref("faq-heart") } }`, `home.news = { eyebrow: "News & Resources", lines: ["Our Latest News & Articles"], intro: "Fresh impact updates and stories of hope, published every month.", cardCta: "Read More" }`, `home.stories.title = ["Stories of", "Hope"]`, `home.world = { eyebrow: "One Family, Every Nation", lines: ["Standing With Children and Families of Every Background"], intro: "From The Gambia across Africa, …" }`, and the notes and CTAs listed in section 2. `manifesto.word` and `manifesto.line` are dropped (unused). `focus` is zipped into `slides`. Appeal groups become `[{id:"ramadan-eid",label:"Ramadan & Eid"},{id:"christmas",…},{id:"thanksgiving",…},{id:"year-round",…}]` |
| `content/stats.ts` → `statSeeds` | `impact.stats`, `restoring.stats`, `partners.title[1]` | `children-supported` 1200+, `families-reached` 640+, `counselling-sessions` 3200+, `active-volunteers` 150+, `community-partners` 45+ (also drives "Trusted by over 45+"), `monthly-donors` 400+ (kind `finance`), `school-fee-interventions` 980+. All `verification.status: "placeholder"`. The ToR §3 extras (`medical-cases`, `donations-distributed`) are seeded `visibility: "hidden"` |
| `content/causes.ts` → `causeSeeds` | `appeals.items` | Slugs: `ramadan-food-packs`, `eid-clothes-gifts`, `christmas-gift-boxes`, `thanksgiving-family-meals`, `keep-children-in-school`, `medical-fund`, `counselling-sessions`, `sponsor-a-child-monthly`. Today's `raised` → `offlineRaised`. `allocation` and `impactUnits` are seeded as clearly illustrative rows, with `verification.status: "placeholder"`, and the cause page shows "Illustrative breakdown pending confirmation by our finance team" until FO verifies |
| `content/people.ts` → `storySeeds`, `teamSeeds`, `testimonialSeeds`, `faqSeeds` | `stories`, `team`, `testimonials`, `faq` | ids `story-1…9`, `team-1…6`, `testimonial-*`, `faq-*`. Seed consent is `not_required` with `placeholder: true`: they are illustrative, use AI images, and HANDOFF says the client must supply consent. FAQs 1–2 (emergency, guarantee) get `locked: true`; all get `placements: ["home"]` plus `support`/`donate` where relevant |
| `content/posts.ts` → `postSeeds` | `news` | Three posts (`back-to-school-50-children`, `keeping-every-childs-story-safe`, `community-health-days`). Status `published`, `publishedAt` from today's dates, a short neutral placeholder body, `placeholder: true` |
| `content/programmes.ts` → `programmeSeeds` | `programmes` + nav descriptions + ToR §5 lists | `navBlurb` from `nav.ts` children descriptions. `support.items` from the full ToR §5 service lists. `notices` from today's `notice`, plus the ToR §5 disclaimers. Overview, problem, eligibility and process are new copy marked `// CLIENT` (example in 8.2) |
| `content/partners.ts` → `partnerSeeds` | `PartnerLogos.tsx` | five `{ builtin: … }` logos, `placeholder: true` |
| `content/pages.ts` → `pageSeeds` | ToR §4, §6–§11 copy | verbatim client wording |
| `content/policies.ts` → `policySeeds` | n/a | three policies with a one-paragraph placeholder body, `placeholder: true` |
| `content/media-meta.ts` → `mediaMeta` | alts hard-coded in About, Founder, Restoring and Faq | `{ about: { alt: "A joyful schoolboy running home with a friend at golden hour" }, founder: { alt: "A boy reading outdoors with friends" }, "restoring-bw": { alt: "A brother and sister sitting close together" }, "faq-main": { alt: "Two boys smiling with a football" }, "faq-bw": { alt: "A calm young girl smiling gently" } }`. Every other pipeline id defaults to `decorative: true` (alt `""`), matching today. Team and testimonial portraits keep the computed alt `${name}, ${role}` in the component |
| `content/nav.ts` | moves to `lib/nav.ts` (code), typed against `RouteKey` | n/a |

`lib/content/defaults.ts` is only an aggregator:

```ts
import "server-only";
export const DEFAULT_DOCS: { [K in DocId]: DocData<K> } = { "settings.site": siteSeed, /* … */ "home.hero": homeSeed["home.hero"], /* … */ };
export const DEFAULT_ITEMS: { [C in CollectionName]: (ItemData<C> & { id: string; placeholder?: boolean })[] } = {
  programmes: programmeSeeds, causes: causeSeeds, stats: statSeeds, stories: storySeeds, testimonials: testimonialSeeds,
  team: teamSeeds, faqs: faqSeeds, partners: partnerSeeds, projects: projectSeeds, posts: postSeeds, policies: policySeeds,
  media: [],   // pipeline assets come from lib/media/pipeline.ts, not from seeds
};
// In dev, every default is parsed with its schema once at module load, and the server throws loudly on failure.
// `next build` prerenders the home page, so an invalid seed also fails the build.
```

---

## 4. Read path

### 4.1 Next 16 caching decision

**Recommendation: enable Cache Components.**

```ts
// next.config.ts (additions)
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // On-demand tags do the real work; the daily revalidate refreshes "Years of Service",
    // the © year and seasonal cause windows without a deploy.
    content: { stale: 300, revalidate: 86_400, expire: 31_536_000 },
  },
  images: { qualities: [70, 75, 85], formats: ["image/webp"] }, // unchanged
};
```

Why:
- `use cache` with `cacheTag` and `updateTag` is the documented Next 16 model. `unstable_cache` is marked "replaced by `use cache`".
- `updateTag` gives read-your-own-writes from server actions: staff see their change on the next page load.
- Draft Mode bypasses `use cache` automatically, which gives preview at no extra cost.
- The landing page stays a prerendered static shell.

Cost: three existing call sites do synchronous time reads during prerender, and they must move (section 4.9).

**Fallback:** if a blocker appears, `read.ts` can be reimplemented with `unstable_cache(fn, key, { tags })` and the flag left off. Every caller and tag stays the same, which is why all reads go through `read.ts`.

Runtime note:
- On Vercel, `use cache` entries are in memory per instance. Prerendered shells, which hold the home page and anything with `generateStaticParams`, are durable.
- Dynamic routes may therefore read Firestore on most requests. At Haven's traffic that is fine; `'use cache: remote'` is the later upgrade.

### 4.2 Store selection

```ts
// lib/content/store/types.ts
export interface ContentStore {
  readonly mode: "firestore" | "local" | "readonly";
  getDoc(id: DocId): Promise<StoredRecord<unknown> | null>;
  listItems(c: CollectionName): Promise<StoredRecord<unknown>[]>;
  isSeeded(c: CollectionName): Promise<boolean>;
  /** Atomic read-modify-write of one record (Firestore runTransaction; local: per-key mutex + temp file + rename). */
  transact<R>(key: RecordKey, fn: (current: StoredRecord<unknown> | null) => Promise<{ next: StoredRecord<unknown> | null; result: R }>): Promise<R>;
  seed(c: CollectionName, records: StoredRecord<unknown>[]): Promise<void>;
  saveVersion(key: RecordKey, snapshot: unknown, meta: { version: number; by: string; at: string; note?: string }): Promise<void>;
  listVersions(key: RecordKey, limit?: number): Promise<{ version: number; by: string; at: string; note?: string }[]>;
  getVersion(key: RecordKey, version: number): Promise<unknown | null>;
}
export type RecordKey = { kind: "doc"; id: DocId } | { kind: "item"; collection: CollectionName; id: string };
```

`contentStore()` decides the backend:
- `firestore` when the Firebase Admin env is complete. The env var names are the backend doc's; expected: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- else `local` when `process.env.VERCEL` is unset, so the disk is writable.
- else `readonly`: reads return defaults, and every write returns `{ ok: false, error: { kind: "unavailable", message: "Saving isn't switched on for this site yet. Your changes were not lost: copy them somewhere safe and try again once the database is connected." } }`.

If the backend doc defines a generic repository over Firestore and `.data`, implement `ContentStore` on top of it. The layouts below are the content-specific part.

**Local layout** (`.data/` is added to `.gitignore`):

```
.data/
  content/docs/<docId>.json                 StoredRecord          e.g. home.hero.json
  content/items/<collection>.json           Record<id, StoredRecord>   (whole-file read/write; collections are small)
  content/meta.json                         { seeded: { [collection]: ISO } }
  content/versions/<key>/<version>.json     snapshot of the previous published value
  uploads/<assetId>.<hash8>.webp            processed image bytes (6.4)
  uploads/_pending/<uploadId>.webp          uploaded but not yet attached; swept after 24 h
  audit/<YYYY-MM>.jsonl                     append-only (shared with the other domains' audit writer)
```

**Firestore layout.** Clients never read Firestore directly: rules are `allow read, write: if false` for all of these, and every access goes through the Admin SDK on the server.

```
content/{docId}                          StoredRecord          (doc ids may contain "." e.g. "home.hero")
content/{docId}/versions/{version}
programmes|causes|stats|stories|testimonials|team|faqs|partners|projects|posts|policies/{id}   StoredRecord
<collection>/{id}/versions/{version}
media/{assetId}                          MediaAsset (6.1)
mediaUploads/{uploadId}                  pending uploads
contentMeta/seed                         { seeded: { [collection]: Timestamp } }
audit/{autoId}                           AuditEntry (shared)
```

Keep the last 20 versions per record and prune on publish.

### 4.3 Readers

```ts
// lib/content/read.ts
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";

async function preview() {
  return (await draftMode()).isEnabled;   // allowed inside 'use cache'; when on, the cache is bypassed
}

export async function getContent<K extends DocId>(id: K): Promise<Resolved<DocData<K>>> {
  "use cache";
  cacheLife("content");
  cacheTag(`content:${id}`, "media");
  const rec = await contentStore().getDoc(id);
  const raw = (await preview()) ? (rec?.draft ?? rec?.published) : rec?.published;
  const data = mergeDoc(id, raw);                       // 4.4
  return resolveMedia(data, await getMediaIndex());     // 4.5 (getMediaIndex is itself 'use cache', tag "media")
}

export async function getCollection<C extends CollectionName>(c: C): Promise<Resolved<Item<C>>[]> {
  "use cache";
  cacheLife("content");
  cacheTag(`col:${c}`, "media");
  const store = contentStore();
  const isPreview = await preview();
  const records = (await store.isSeeded(c)) ? await store.listItems(c) : DEFAULT_ITEMS[c].map(seedRecord);
  const items = records
    .filter((r) => r.visibility === "live" || (isPreview && r.visibility === "hidden"))
    .map((r) => ({ id: r.id, placeholder: !!r.placeholder, ...((isPreview ? r.draft ?? r.published : r.published) ?? {}) }))
    .filter((d) => parseItem(c, d));                    // invalid → dropped + logged
  items.sort(byOrder);
  return resolveMedia(items, await getMediaIndex());
}

// Thin, cached-by-composition helpers (no own 'use cache' needed):
export const getStats = async () => indexBy(await getCollection("stats"), "id");
export async function getCauses() {                     // adds derived money fields
  const [causes, totals] = await Promise.all([getCollection("causes"), getCauseTotals()]); // payments doc; tag "donation-totals"
  return causes.filter(inSeasonWindow).map((c) => withRaised(c, totals[c.slug] ?? 0)); // raised, percent
}
export async function getLatestPosts(n = 3) {
  return (await getCollection("posts")).filter((p) => p.status === "published")
    .sort(byPublishedDesc).slice(0, n).map(toPostCard);
}
export async function getSiteSettings() {               // adds time-derived values inside the cache scope
  "use cache";
  cacheLife("content");
  cacheTag("content:settings.site");
  const s = await getContent("settings.site");
  const year = new Date().getFullYear();                // fine inside 'use cache': cached, refreshed daily
  return { ...s, year, yearsOfService: year - s.foundedYear };
}
```

There are two page-level assemblers. Neither is cached itself; both only `await Promise.all(...)` of cached readers, so they complete during prerender.

```ts
export async function getSiteChrome(): Promise<SiteChrome> { /* settings.site, contact, safety, announcements, chrome,
  programmes (for nav + footer column), policies (footer legal), anyIllustrativeInUse (6.5) */ }

export async function getHomeContent(): Promise<HomeView> {
  const [layout, hero, world, partnersDoc, progDoc, about, duo, manifesto, impact, focus, appealsDoc, donate, donateCfg,
         doors, safety, storiesDoc, founder, teamDoc, restoring, testiDoc, journey, projectsDoc, faqDoc, join, newsDoc,
         stats, programmes, causes, stories, team, testimonials, faqs, partners, projects, posts, site] = await Promise.all([
    getContent("home.layout"), getContent("home.hero"), /* … one getContent per home.* doc, donate.config, settings.safety … */
    getStats(), getCollection("programmes"), getCauses(), getCollection("stories"), getCollection("team"),
    getCollection("testimonials"), getCollection("faqs"), getCollection("partners"), getCollection("projects"),
    getLatestPosts(3), getSiteSettings(),
  ]);
  const stat = (id: string) => toResolvedStat(stats[id]);
  // View-models keep TODAY's prop shapes wherever possible, so section bodies don't change (4.7).
  const RESTORING_TONES = ["marigold", "white", "white", "marigold"] as const;   // was per-stat; now by position (code)
  return {
    hidden: new Set(layout.hidden),
    hero,                                                                  // { slides, text, primaryCta, secondaryCta }
    world,
    partners: { strip: { ...partnersDoc, stat: stat(partnersDoc.statId) }, logos: partners },
    programmes: { section: progDoc, items: programmes.map(toProgrammeCard) },
    about,
    duo: duo.cards,                                                        // array, as Duo.tsx maps today
    manifesto: { ...manifesto, tagline: site.tagline },
    impact: { ...impact, stats: impact.cards.map((c) => ({ ...stat(c.statId), tone: c.tone })),   // same shape as today's impact.stats
              showNote: impact.cards.some((c) => stat(c.statId).placeholder) },
    focus: { items: focus.slides.map((s) => s.word), captions: focus.slides.map((s) => s.caption), media: focus.slides.map((s) => s.media) },
    appeals: { section: appealsDoc, causes: causes.map(toCauseCard), showNote: causes.some((c) => c.placeholder || c.verification.status !== "verified") },
    donate: { copy: donate, config: donateCfg, causes: causes.map(({ slug, title, currency }) => ({ slug, title, currency })),
              programmes: programmes.map(({ id, title }) => ({ id, title })) },
    doors: { ...doors, emergencyNotice: safety.emergencyNotice },
    stories: { section: storiesDoc, items: stories },
    founder: { ...founder, yearsOfService: site.yearsOfService },
    team: { section: teamDoc, members: team.filter((m) => m.showOn.includes("home")) },
    restoring: { ...restoring, stats: restoring.statIds.map((id, i) => ({ ...stat(id), tone: RESTORING_TONES[i] })),
                 showNote: restoring.statIds.some((id) => stat(id).placeholder) },
    testimonials: { section: testiDoc, items: testimonials },
    journey,
    projects: { section: projectsDoc, items: pickFeatured(projects, projectsDoc.featured) },
    faq: { section: faqDoc, items: faqs.filter((f) => f.placements.includes("home")) },
    join,
    news: { section: newsDoc, posts },
  };
}
```

`HomeView` and all slice types live in `lib/content/types.ts` (for example `HeroProps = { hero: HomeView["hero"] }`), so client sections can `import type` them. The rule for the assembler: **reshape stored data back into the shape each component already consumes.** For example, Focus's `items`/`captions`/`media` arrays, Duo's array, and Impact and Restoring's `stats[]` with `tone`. Admin-friendly storage shapes therefore never leak into component bodies. The only intended body edits are `.src`/`.alt` on media (to use real alt text), ids as keys, and strings that used to be hard-coded.

### 4.4 Merge rules

```ts
function mergeDoc<K extends DocId>(id: K, raw: unknown): DocData<K> {
  const def = DEFAULT_DOCS[id];
  if (!raw || typeof raw !== "object") return def;
  const candidate = { ...def, ...raw };                  // top-level fill-in: new top-level fields get defaults
  const r = DOCS[id].schema.safeParse(candidate);        // nested additions rely on .default() in the schema
  if (r.success) return r.data;
  reportInvalid({ kind: "doc", id, issues: r.error.issues });  // console.error + admin "needs attention" list (store flag)
  return def;                                            // G3: never break the page
}
```

- **Arrays are replaced whole.** They are never merged by index, because staff edit lists as lists.
- **Collections are not merged with seeds once seeded.** The stored set is the truth, so a deleted seed item stays deleted.
- **The schema strips unknown keys on read** (`z.object`), but **rejects them on write** (`z.strictObject` in the action input).

### 4.5 Resolution (media, stats, derived values)

`resolveMedia(value, index)` walks any value and replaces each `{ $media: id }` with a `ResolvedMedia`:
- Pipeline id or upload → `src` is the hashed URL; videos also get `poster`.
- `alt` comes from the asset. Decorative assets get `""`.
- `objectPosition` comes from the focal point.
- An asset that is missing, `withdrawn` or `archived` → the neutral fallback asset `fallback-warm`, a new pipeline image (cream paper with a marigold brush and no people), plus `reportInvalid(...)`.
- `illustrative = aiGenerated && peopleVisible`.

Other derived values:
- `phoneHref = "tel:" + phone.replace(/[^\d+]/g, "")`
- `addressLine = offices.map((o) => o.address).join(" · ")`. This reproduces today's "Kanifing, The Gambia · California, USA".
- Cause `raised` and `percent`, and the stat `placeholder` flags.
- Post card dates are formatted server-side with `Intl.DateTimeFormat("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone: site.timeZone })`. This reproduces "September 12, 2026" and "August 03, 2026".

### 4.6 Preview (Draft Mode)

- `app/api/preview/route.ts` (GET):
  1. `requireStaff()`; any role with content access.
  2. Validate that `path` is an internal path (starts with `/`, no `//`).
  3. `(await draftMode()).enable()`.
  4. `redirect(path)`.

  Draft Mode can only be toggled in a route handler or server action, never inside `use cache`.
- Exit is the server action `exitPreview()`, which calls `(await draftMode()).disable()`.
- `components/content/PreviewBanner.tsx` is rendered in `app/(site)/layout.tsx` inside `<Suspense fallback={null}>`.
  - It reads `draftMode()` outside any cache scope.
  - It shows a slim marigold bar: "You're previewing unpublished changes · Publish · Exit preview".
- The admin opens previews in a new tab on phones, and in a side iframe on wide screens. The iframe is same-origin, so no frame headers are needed.
- Anyone holding the bypass cookie sees drafts. The cookie is only issued after `requireStaff()`, and drafts are public-bound copy, not personal data.

### 4.7 How sections receive content: props, not context

**Decision: props from the server parent, and no React context.**
- Each section gets only its slice. A context provider would serialize the whole `SiteContent` (every FAQ, story and post) into the RSC payload of every page.
- Props keep sections pure and reusable on other pages with different data. Examples: `Donate` on `/donate`, `Team` and `Testimonials` on `/about`, `Faq` on `/get-support`.
- Server sections stay synchronous and don't fetch for themselves, so every page has exactly one place where data is loaded.
- Client bundles get smaller. Today `content/home.ts`, `content/people.ts` and `media-map.ts` are bundled into client JS through the client sections' imports. Afterwards the content arrives in the HTML and RSC payload instead.

**Least-disruptive pattern.** Change the import into a prop with the **same identifier**, so the JSX body does not change:

```tsx
// before
import { hero } from "@/content/home";
export function Hero() { … hero.slides … }

// after
import type { HeroProps } from "@/lib/content/types";
export function Hero({ hero }: HeroProps) { … hero.slides … }   // body untouched
```

```tsx
// app/(site)/layout.tsx  (new route group; the IA doc owns the full route tree)
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const chrome = await getSiteChrome();
  return (
    <>
      <Suspense fallback={null}><PreviewBanner /></Suspense>
      <Header chrome={chrome.header} />
      {children}
      <Footer chrome={chrome.footer} />
      <ScrollTop />
    </>
  );
}

// app/(site)/page.tsx  (moved from app/page.tsx; same order, same spacer div)
export default async function Home() {
  const c = await getHomeContent();
  const show = (s: OptionalSection, nonEmpty = true) => nonEmpty && !c.hidden.has(s);
  return (
    <main>
      <Hero hero={c.hero} />
      <WorldFlags world={c.world} />
      {show("partners", c.partners.logos.length > 0) && <Partners strip={c.partners.strip} logos={c.partners.logos} />}
      <Programmes section={c.programmes.section} programmes={c.programmes.items} />
      <About about={c.about} />
      <Duo duo={c.duo} />
      <div aria-hidden className="h-12 bg-vu-cream" />
      <Manifesto manifesto={c.manifesto} />
      <Impact impact={c.impact} />
      <Focus focus={c.focus} />
      <Appeals section={c.appeals.section} causes={c.appeals.causes} showNote={c.appeals.showNote} />
      <Donate donate={c.donate} />
      <DoorsOpen doors={c.doors} />
      {show("stories", c.stories.items.length >= 3) && <Stories section={c.stories.section} stories={c.stories.items} />}
      <Founder founder={c.founder} />
      {show("team", c.team.members.length >= 2) && <Team section={c.team.section} team={c.team.members} />}
      <Restoring restoring={c.restoring} />
      {show("testimonials", c.testimonials.items.length > 0) && <Testimonials section={c.testimonials.section} testimonials={c.testimonials.items} />}
      <Journey journey={c.journey} />
      {show("projects", c.projects.items.length === 3) && <Projects section={c.projects.section} projects={c.projects.items} />}
      <Faq section={c.faq.section} faq={c.faq.items} />
      <JoinSphere join={c.join} />
      {show("news", c.news.posts.length > 0) && <News section={c.news.section} news={c.news.posts} />}
    </main>
  );
}
```

### 4.8 Every file that changes, and how

Sections: the JSX structure and class names are untouched unless stated otherwise.

| File | S/C | Change |
|---|---|---|
| `app/page.tsx` → `app/(site)/page.tsx` | S | becomes `async`; loads `getHomeContent()`; passes props; optional sections gated (above). Header, Footer and ScrollTop move to the layout |
| `app/(site)/layout.tsx` (new) | S | `getSiteChrome()`; Header, Footer, ScrollTop, PreviewBanner |
| `app/layout.tsx` | S | `metadata` → `generateMetadata()` reading `getSiteSettings()` and `settings.seo`; `metadataBase` from `NEXT_PUBLIC_SITE_URL`. Fonts, `SmoothScroll` and the noscript style are unchanged |
| `app/opengraph-image.tsx` | S | the two headline lines and the tagline come from `settings.seo` and `settings.site`. Move the two `readFile` calls for fonts and the backdrop to module scope (they never change) |
| `app/sitemap.ts` | S | add programme, cause, post and policy URLs; `lastModified` from record `updatedAt`. Drop `new Date()` |
| `app/robots.ts` | S | `site.url` → `NEXT_PUBLIC_SITE_URL` |
| `components/sections/Hero.tsx` | C | prop `{ hero }`. CTA labels and hrefs → `hero.primaryCta.label`, `routeHref(hero.primaryCta.to, "home")`. Media shape is unchanged (`type`, `src`, `poster`); add `style={{ objectPosition }}` on `Image` when set |
| `WorldFlags.tsx` | S | prop `{ world }` for the eyebrow, h2 lines and intro; countries still imported from `content/world.ts` |
| `Partners.tsx` | S | props `{ strip, logos }`. Heading = `strip.before`, `<span>{value}{suffix}</span>`, `strip.after`. Builtin logos render the existing `PartnerLogos` component by key (export a `builtinPartnerLogos` record); uploaded logos render `next/image` with the same grayscale/hover classes |
| `Programmes.tsx` | S | props `{ section, programmes }` (`programmes.map` body unchanged); button label `section.cardCta`. The href stays `#support` (today's value) until programme pages ship, then becomes `p.href` = `/programmes/[slug]` |
| `About.tsx` | S | prop `{ about }`; `lines={about.titleLines}`; `src={about.image.src} alt={about.image.alt}`; "Our vision:" → `about.visionLabel`; CTA from `about.cta` |
| `Duo.tsx` | S | prop `{ duo }` (array, as today); `c.image.src`; CTA label `c.cta.label` and href `routeHref(c.cta.to)` |
| `Manifesto.tsx` | C | prop `{ manifesto }` (includes `tagline`); `site.tagline` → `manifesto.tagline`; CTA labels |
| `Impact.tsx` | S | prop `{ impact }` (`impact.stats` keeps today's shape: `label`, `value`, `suffix`, `note`, `tone`); the note text comes from `impact.placeholderNote` and renders only if `impact.showNote` |
| `Focus.tsx` | C | prop `{ focus }` (the view keeps today's `items`/`captions`/`media` arrays); body unchanged |
| `Appeals.tsx` | C | props `{ section, causes, showNote }`. Groups: `["all", ...section.groups]` with the label "All" in code. Filter on `groupId`. `key={a.slug}`. `requestDonation({ causeSlug: a.slug, currency: a.currency })`. Intro and note from `section` |
| `Donate.tsx` | C | prop `{ donate }` holding `copy`, `config`, `causes` and `programmes`. `donate.currencies` → `config.currencies` (enabled only); frequencies filtered by `config.frequencies`. `<option>`s use `value={slug or id}` with titles as text. `ANYWHERE` → `copy.anywhereLabel`. Intent payload becomes `{ causeSlug, currency }`. The thank-you, consent and security strings come from `copy` |
| `DoorsOpen.tsx` | S | prop `{ doors }` (includes `emergencyNotice`); hands from `lib/media/pipeline.ts` `img("hand-left")` (still code) |
| `Stories.tsx` | C | props `{ section, stories }`; `key={s.id}`; `s.image.src`; heading and intro from `section` |
| `Founder.tsx` | S | prop `{ founder }` (includes `yearsOfService`); remove `new Date()`; `lines={founder.titleLines}`; image `.src`/`.alt` |
| `Team.tsx` | C | props `{ section, team }`; `key={m.id}`; `m.image.src` |
| `Restoring.tsx` | C | prop `{ restoring }` (`stats` keep today's shape with `tone`; plus `showNote`, `placeholderNote`, `filmTitle`, `titleLines`); image `.src`/`.alt`; film `src`/`poster` (same keys as today) |
| `Testimonials.tsx` | C | props `{ section, testimonials }`; `key={x.id}`; `x.image?.src` (portrait required in the home seed) |
| `Journey.tsx` | S | prop `{ journey }`; `key={s.id}`; `s.image.src` |
| `Projects.tsx` | S | props `{ section, projects }`; CTA from `section.cta` |
| `Faq.tsx` | C | props `{ section, faq }`; remove `img` import; the three images come from `section.media.*` (`src`/`alt`) |
| `JoinSphere.tsx` | C | prop `{ join }`; note from `join.note` |
| `News.tsx` | S | props `{ section, news }` (`PostCard[]`: `dateLabel`, `categoryLabel`, `title`, `cover`, `href`); `n.date` → `n.dateLabel`, `n.category` → `n.categoryLabel`, `n.image` → `n.cover.src`; "Read More" → `section.cardCta`. `href` is `routeHref("news")` (today's `#news`) until `/news/[slug]` ships |
| `components/layout/Header.tsx` | C | prop `{ chrome }`: contact (with derived `addressLine`, `phoneHref`), socials (shown only), ticker, nav. Passes `nav` and contact to `MobileMenu` |
| `MobileMenu.tsx` | C | props `nav`, `contact`, `socials` (replacing the `@/content/nav` and `@/content/site` imports) |
| `NavDropdown.tsx` | C | `import type { NavItem } from "@/lib/nav"` only |
| `Footer.tsx` | S | prop `{ chrome }`: description, contact, socials, safety (heading and notice), CTAs, link columns (derived), `footerStatement`, `signOff`, `year` (no `new Date()`), `illustrativeNotice` (shown when `anyIllustrativeInUse`) |
| `FooterGiantText.tsx`, `Ticker.tsx`, `SearchOverlay.tsx`, `ScrollTop.tsx` | C | unchanged |
| `components/art/ProgrammeIcons.tsx` | S | `import type { ProgrammeId as ProgrammeIconName } from "@/lib/content/types"` |
| `components/art/PartnerLogos.tsx` | S | also export `builtinPartnerLogos: Record<BuiltinPartner, Component>` |
| `lib/donate-intent.ts` | C | `DonateIntent = { causeSlug: string; currency: Currency }`; `Currency` from `lib/content/types` |
| `lib/money.ts` | n/a | `Currency` type import from `lib/content/types` |
| `scripts/qa/donate-flow.mjs` | n/a | assert on the cause title shown in "Giving to:" (the visible text is unchanged); selectors unchanged |
| `content/*.ts` | n/a | rewritten as seed modules (3.7). Add `import "server-only"` to `home.ts`, `people.ts`, `programmes.ts`, `site.ts`, `stats.ts`, `causes.ts`, `posts.ts`, `partners.ts`, `pages.ts`, `policies.ts`, `media-meta.ts`, **not** `world.ts` or `media-map.ts` |
| `eslint.config.mjs` | n/a | `no-restricted-imports` for `components/**` and `lib/**` (except `lib/content`): forbid `@/content/*` other than `@/content/world` and `@/content/media-map` |

### 4.9 Cache Components adoption fixes in existing code

With `cacheComponents: true`, synchronous time reads during prerender fail the build, and `instant = false` does not clear this. They are:
- `Founder.tsx` `new Date().getFullYear()`
- `Footer.tsx` `new Date().getFullYear()`
- `sitemap.ts` `new Date()`

All three move to `getSiteSettings()` (inside `use cache`) or to record timestamps, as listed above. Client components such as Hero, Ticker and Counter are unaffected.

Related checks:
- **Activity on navigation.** Cache Components keeps the previous route mounted but hidden (`<Activity>`), and its effects are cleaned up and re-run when the route is shown again. Test GSAP pins (Focus), the Manifesto parallax and Lenis after navigating Home → About → Back.
- **Duplicate SVG ids.** The SVG ids `heart-clip` (Faq), `join-sphere` (JoinSphere) and `manifesto-knockout` (Manifesto) must stay unique per document. A hidden Home route plus another page that reuses the same section would duplicate them, and a `display:none` `<clipPath>` that wins the id lookup can blank the visible one. Fix: derive these ids with `useId()` when a section is reused off the home page.

---

## 5. Write path

### 5.1 Actions

All actions live in `lib/content/actions.ts` (`"use server"`), use thin input schemas, and return the constrained `ActionResult`.

```ts
export type ActionResult<T = { version: number; at: string }> =
  | { ok: true; data: T }
  | { ok: false; error:
      | { kind: "validation"; fields: Record<string, string> }        // path → friendly message
      | { kind: "conflict"; message: string; current: { version: number; updatedBy: string; updatedAt: string } }
      | { kind: "forbidden"; message: string; paths: string[] }        // "Only the finance team can change goals."
      | { kind: "blocked"; message: string; reasons: string[] }        // safeguarding gate (6.5)
      | { kind: "unavailable"; message: string } };                   // readonly backend

saveDoc(input: { id: DocId; baseVersion: number; data: unknown; intent: "draft" | "publish" }): Promise<ActionResult>
discardDraft(input: { id: DocId; baseVersion: number }): Promise<ActionResult>
restoreDocVersion(input: { id: DocId; version: number; baseVersion: number }): Promise<ActionResult>   // restores into draft

saveItem(input: { collection: CollectionName; id?: string; baseVersion?: number; data: unknown; intent: "draft" | "publish" }): Promise<ActionResult<{ id: string; version: number; at: string }>>
setItemVisibility(input: { collection; id; baseVersion; visibility: "live" | "hidden" | "archived" }): Promise<ActionResult>
reorderItems(input: { collection; orderedIds: string[] }): Promise<ActionResult>
deleteItem(input: { collection; id; baseVersion }): Promise<ActionResult>      // never-published items only; else archive. Hard delete of a published item: SA only
confirmPlaceholder(input: { key: RecordKey; baseVersion }): Promise<ActionResult> // "This is real, approved content": clears placeholder
// posts workflow (7.1): submitPost, requestChanges, approvePost(publishAt?), unpublishPost
// media (6): createMediaAsset, replaceMediaFile, updateMediaMeta, withdrawConsent
exitPreview(): Promise<void>
```

`intent: "publish"` is offered as one button, "Save & update the website". Staff never have to understand the difference between a draft and a publish to make a quick fix. The draft exists so that Preview works.

### 5.2 One pipeline for every write

```ts
export async function saveDoc(input: unknown): Promise<ActionResult> {
  const user = await requireStaff();                                  // auth doc; throws → generic 401 UI. Never trust render-time gating.
  const { id, baseVersion, data, intent } = SaveDocInput.parse(input); // z.strictObject({ id: z.enum(DOC_IDS), baseVersion: z.int().min(0), data: z.unknown(), intent: z.enum(["draft","publish"]) })
  const spec = DOCS[id];
  if (!canEditDoc(user.role, spec)) return forbidden("You don't have access to this section.");
  const parsed = spec.schema.safeParse(data);                         // strict; layout limits (3.6)
  if (!parsed.success) return validation(parsed.error);               // zod issues → { "slides.2.title.0": "Please keep this under 30 characters…" }
  const store = contentStore();
  if (store.mode === "readonly") return unavailable();

  // R = { res: ActionResult; changes?: Change[]; previous?: unknown }; the transaction writes `next` only when it differs from `rec`.
  const out = await store.transact({ kind: "doc", id }, async (rec) => {
    if ((rec?.version ?? 0) !== baseVersion) return { next: rec, result: { res: conflict(rec) } };
    const before = rec?.draft ?? rec?.published ?? DEFAULT_DOCS[id];
    const changes = diffPaths(before, parsed.data);                   // [{ path: "slides.2.title.0", before, after }, …]
    const denied = deniedPaths(user.role, spec, changes);             // field groups (5.3)
    if (denied.length) return { next: rec, result: { res: forbidden(spec.deniedMessage(denied), denied) } };
    if (intent === "publish") {
      const blocked = await safeguardingGate(parsed.data, await readMediaIndexUncached()); // 6.5
      if (blocked.length) return { next: rec, result: { res: blockedResult(blocked) } };
    }
    const at = new Date().toISOString();
    const next: StoredRecord<unknown> = {
      ...(rec ?? newRecord(id, user, at)),
      draft: intent === "draft" ? parsed.data : null,
      published: intent === "publish" ? parsed.data : rec?.published ?? null,
      version: baseVersion + 1, updatedAt: at, updatedBy: user.uid,
      ...(intent === "publish" ? { publishedAt: at, publishedBy: user.uid } : {}),
    };
    return { next, result: { res: ok({ version: next.version, at }), changes, previous: rec?.published } };
  });

  if (out.res.ok) {
    if (intent === "publish" && out.previous) await store.saveVersion({ kind: "doc", id }, out.previous, { version: baseVersion, by: user.uid, at: out.res.data.at });
    await writeAudit({ actor: actorOf(user), action: intent === "publish" ? "content.publish" : "content.draft.save",
                       target: { kind: "doc", id, label: spec.label }, changes: summarize(out.changes), version: out.res.data.version });
    if (intent === "publish") updateTag(`content:${id}`);              // read-your-own-writes; drafts need no tag (preview bypasses cache)
  }
  return out.res;                                                     // only the constrained ActionResult goes to the client
}
```

`saveItem` follows the same pipeline:
- It calls `ensureSeeded(collection)` first. On the first write to a never-seeded collection, the seed items are written as published records with `placeholder` preserved, in a single transaction or batch, and `seeded` is set.
- Publishing updates both `col:<collection>` and `<collection>:<slug>`.
- Gate checks are per collection: consent for stories and testimonials, permission for partners, allocation sum and seasonal window for causes, and the review checklist for posts.

The admin forms call these actions with `useActionState` and keep `baseVersion` from the loaded record. On a `conflict`, the form shows: "Ama updated this 2 minutes ago. Load her version, then reapply your change". The draft is never silently overwritten.

### 5.3 Access matrix and field groups

`lib/content/access.ts` is the single table, used by the admin to grey fields out (with a friendly "Ask the finance team to change this") and by the actions to enforce. V (viewer) is read-only everywhere and can read the audit log.

| Record | SA | CM | PO | SO | FO | RM |
|---|---|---|---|---|---|---|
| `settings.site` (brand group: `name`, `orgName`, `foundedYear`) | ✔ | ✔ (not brand) | n/a | n/a | n/a | n/a |
| `settings.contact`, `.announcements`, `.chrome`, `.seo`, `.editorial` | ✔ | ✔ | n/a | n/a | n/a | n/a |
| `settings.safety`, `pages.reportConcern` | ✔ | n/a | n/a | ✔ | n/a | n/a |
| `home.*`, `pages.*` (others) | ✔ | ✔ | n/a | n/a | n/a | `pages.resources` |
| `home.donate` legal group (`updatesConsentLabel`, `anonymousLabel`) | ✔ | n/a | n/a | n/a | n/a | n/a |
| `donate.config` | ✔ | n/a | n/a | n/a | ✔ | n/a |
| `programmes` copy, eligibility, process, contact | ✔ | ✔ | ✔ | n/a | n/a | n/a |
| `programmes.notices` | ✔ | n/a | n/a | ✔ | n/a | n/a |
| `causes` copy (title, season, image, summary, story, tone, order) | ✔ | ✔ | n/a | n/a | ✔ | n/a |
| `causes` money (currency, goal, offlineRaised, allocation, impactUnits, presetAmounts, verification) | ✔ | n/a | n/a | n/a | ✔ | n/a |
| `stats` label and note | ✔ | ✔ | n/a | n/a | n/a | n/a |
| `stats` value and verification (`kind: programme`, `organisation`) | ✔ | n/a | ✔ | n/a | n/a | n/a |
| `stats` value and verification (`kind: finance`) | ✔ | n/a | n/a | n/a | ✔ | n/a |
| `stories`, `testimonials`, `team`, `partners` | ✔ | ✔ | n/a | withdraw only | n/a | n/a |
| `faqs` (unlocked) / locked | ✔ / ✔ | ✔ / n/a | n/a | n/a / ✔ | n/a | n/a |
| `projects` | ✔ | ✔ | ✔ | n/a | n/a | n/a |
| `posts` draft and submit / publish and schedule | ✔ / ✔ | ✔ / ✔ | ✔ / n/a | n/a | n/a | n/a |
| `policies` / `child-safeguarding` | ✔ / ✔ | n/a | n/a | n/a / ✔ | n/a | n/a |
| `media` upload and edit / consent fields / withdraw | ✔ | ✔ / ✔ / ✔ | n/a | n/a / ✔ / ✔ | n/a | n/a |

```ts
// registry.ts excerpt
causes: {
  label: "Appeals & causes", schema: CauseSchema, edit: ["super_admin", "content_manager", "finance_officer"],
  fieldGroups: [
    { name: "money", paths: ["currency", "goal", "offlineRaised", "allocation", "impactUnits", "presetAmounts", "verification"],
      edit: ["super_admin", "finance_officer"], message: "Only the finance team can change amounts and the spending breakdown." },
    { name: "copy", paths: ["*"], edit: ["super_admin", "content_manager", "finance_officer"] },
  ],
  tags: (item) => ["col:causes", `cause:${item.slug}`],
  previewPath: (item) => `/donate/${item.slug}`,
},
```

### 5.4 Audit and versions

Content writes use the shared audit writer (`lib/audit.ts`, from the backend or security doc).

```ts
export type AuditEntry = {
  id: string; at: string;
  actor: { kind: "user"; uid: string; name: string; role: Role } | { kind: "system"; name: string }; // e.g. "Monthly AI draft", "Scheduler"
  action:
    | "content.draft.save" | "content.publish" | "content.discard" | "content.restore"
    | "item.create" | "item.update" | "item.publish" | "item.visibility" | "item.reorder" | "item.delete" | "item.confirm"
    | "post.submit" | "post.changes_requested" | "post.approve" | "post.schedule" | "post.publish" | "post.unpublish"
    | "media.upload" | "media.replace" | "media.update" | "media.consent.withdraw";
  target: { kind: "doc" | CollectionName | "media"; id: string; label: string };
  changes?: { path: string; before?: string; after?: string }[];  // ≤ 30 entries; values stringified and cut to 200 chars; media as ids
  version?: number; note?: string;
};
```

- Content is public-bound, so the audit carries no personal data beyond the actor.
- Consent records stay in the restricted `consents` collection. Media audit entries name only the `recordRef`.
- **Versions:** every publish snapshots the previous `published` value. The admin's "Earlier versions" list restores a version into the draft, so a restore always goes through Preview and Publish.

### 5.5 Revalidation map

| Event | Where | Call |
|---|---|---|
| Publish a singleton | server action | `updateTag("content:<id>")` |
| Publish, hide, archive, reorder or delete an item | server action | `updateTag("col:<collection>")` + `updateTag("<collection>:<slug>")` when slugged |
| Media created, replaced, edited or withdrawn | server action | `updateTag("media")`. Every content reader carries the `media` tag, so all pages refresh |
| Stripe webhook records a donation | route handler (payments doc) | `revalidateTag("donation-totals", "max")` |
| Scheduled post goes live | cron route handler | `revalidateTag("col:posts", "max")` + `revalidateTag("post:<slug>", "max")` |
| Daily | none | `cacheLife("content").revalidate = 1 day` (years, seasonal windows) |

`updateTag` can only be called inside server actions. Route handlers must use the two-argument `revalidateTag(tag, profile)`, because the one-argument form is deprecated.

---

## 6. Media

### 6.1 Asset model

```ts
export type MediaAsset = {
  id: string;                         // pipeline id ("hero-family-in") or "up-<nanoid10>" for new uploads
  kind: "image" | "video";
  source: "pipeline" | "upload";      // an upload may reuse a pipeline id to replace it (6.2)
  src: string;                        // "/media/img/x.<hash>.webp" (pipeline) | "/uploads/<id>.<hash>.webp" (upload)
  poster?: string;                    // videos
  storageKey?: string;                // uploads: "<id>.<hash8>.webp"
  width?: number; height?: number; bytes?: number; hash?: string;
  blurDataURL?: string;               // 16px WebP, base64
  alt: string; decorative: boolean;   // alt required unless decorative
  focal?: { x: number; y: number };   // 0–100, → objectPosition
  caption?: string; credit?: string;
  safeguarding: {
    peopleVisible: boolean;
    childInImage: boolean;
    identifiable: boolean;            // faces recognisable
    aiGenerated: boolean;
    placeholder: boolean;             // illustrative, to be replaced before launch (HANDOFF)
    consent: Consent;                 // covers everyone identifiable in the frame
    metadataStripped: boolean;        // true for every upload (EXIF/GPS removed by sharp)
  };
  status: "active" | "archived" | "withdrawn";
  uploadedBy?: string; uploadedAt?: string; updatedBy?: string; updatedAt?: string;
};
```

### 6.2 Living with the fingerprinted `/media` pipeline

- **The pipeline stays exactly as it is.** The scripts, `public/media/**`, `content/media-map.ts` (generated) and `content/media-credits.ts` (generated) are all unchanged. It is still how developers add AI art, videos and posters.
- **`lib/media/pipeline.ts`** builds a `MediaAsset` record for every pipeline id:
  - `src` from `mediaMap`
  - `kind` from the map section
  - safeguarding from `mediaCredits`: `childInImage = childPlaceholder`, `aiGenerated: true`, `placeholder: childPlaceholder`, `peopleVisible: true` except brush and textures, `consent.status: "not_required"`
  - `alt` and `decorative` from `content/media-meta.ts`
- **`getMediaIndex()`** (`'use cache'`, tag `media`) is `{ ...pipelineAssets, ...storedAssets }`. A stored asset with the **same id** as a pipeline asset overrides it. That is how "Replace this photo" works on a placeholder:
  - The hero slide keeps `{ $media: "hero-family-in" }`.
  - The upload sets `source: "upload"` and `src: "/uploads/hero-family-in.<hash>.webp"`, with real consent and `placeholder: false`.
  - Every usage updates at once, and the git-tracked pipeline file is untouched.
- **New uploads get `up-…` ids.** The admin's library shows pipeline and upload assets together, with badges: "Illustrative (AI)", "Needs real photo", "Consent recorded".
- **Usage** ("Used in: Welcome slide 2, Story 'A mother'") is computed on demand by scanning the stored and default records for `$media` refs. Nothing is stored. An asset that is in use cannot be archived until it is replaced in those places; withdrawal is always allowed (6.6).

### 6.3 Upload flow

Uploads go through a route handler, not a server action. Server actions accept 1 MB by default, and Vercel functions accept about 4.5 MB.

1. **Pick.** The admin `MediaPicker` uses `<input type="file" accept="image/jpeg,image/png,image/webp" capture>`. Listing only these types makes iOS hand over a JPEG instead of HEIC, which sharp's prebuilt binaries cannot decode.
2. **Shrink in the browser.** `createImageBitmap` and a canvas downscale the image to a long edge of at most 2560px and encode it as WebP at quality 0.9, aiming for 3.5 MB or less. The phone keeps the original.
3. **Ask the safeguarding questions inline**, in plain words, one at a time:
   - "Are there people in this photo?"
   - "Can you recognise anyone's face?"
   - "Is any child in it?"
   - "Do we have written consent from a parent or guardian?" Answering this links a consent record by reference; the SO creates the record if it is missing.
   - "Describe the photo for someone who can't see it" (alt text), or "Decorative only".

   Non-blocking reminders from the founder's imagery rules are shown here: child shown with dignity and as the one being helped, no school crests, badges or signage, no weapons in frame.
4. **`POST /api/admin/media/upload`** (`app/api/admin/media/upload/route.ts`, multipart):
   1. `requireStaff()` with media permission.
   2. Reject anything over 4 MB, and any type other than JPEG, PNG or WebP.
   3. `lib/media/process.ts` runs sharp: `sharp(buf, { failOn: "error" }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 })`. sharp drops EXIF, GPS and XMP by default; **never** call `withMetadata()` or `keepMetadata()`. It also produces a 16px blur preview.
   4. Compute `hash = sha1(output).slice(0, 8)` (same scheme as `fingerprint.mjs`).
   5. Write to `_pending/<uploadId>.webp` through the storage driver.
   6. Return `{ uploadId, width, height, blurDataURL }`.

   Only WebP is produced; AVIF stays off (README: AVIF hung the encoder).
5. **`createMediaAsset({ uploadId, meta })`** or **`replaceMediaFile({ assetId, uploadId })`** (server actions):
   1. Validate the meta with zod, including the safeguarding rules in 6.5.
   2. Move `_pending/<uploadId>` to `<assetId>.<hash>.webp`.
   3. Write the `media` record and an audit entry.
   4. Call `updateTag("media")`.
   5. On replace, delete the previous upload object after the record commits. Pipeline files are never deleted.
   6. A sweep, run by the admin dashboard load and the cron, removes pending files older than 24 hours.

Storage drivers:

```ts
// lib/media/storage/index.ts
export interface MediaStorage {
  mode: "firebase" | "local" | "none";
  put(key: string, body: Buffer, contentType: "image/webp"): Promise<void>;
  get(key: string): Promise<{ body: Buffer | ReadableStream; size: number } | null>;
  move(from: string, to: string): Promise<void>;
  delete(key: string): Promise<void>;
}
// firebase: getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET).file(`media/${key}`). The bucket stays PRIVATE (rules deny all client access).
// local:    .data/uploads/<key>
// none:     upload buttons explain "Photo uploads switch on once storage is connected."
```

`sharp` moves from `devDependencies` to `dependencies`. It is already Next's optional dependency for the image optimizer, but the upload route imports it directly.

### 6.4 Serving `/uploads/[...key]`

The route is `app/uploads/[...key]/route.ts` (GET), and it is the same in dev and production:
- It validates the key against `^[a-z0-9-]+\.[0-9a-f]{8}\.webp$`.
- It looks the asset up in the media index. An asset that is not `active` returns **410**.
- It streams the bytes from the driver with `Content-Type: image/webp` and `Cache-Control: public, max-age=86400, s-maxage=86400`.

Why a route and not `public/uploads`:
- Files added to `public/` after build are not reliably served by `next start`, and the QA scripts run `next build` + `next start`.
- It keeps the Storage bucket private: there is no public ACL and no `remotePatterns` entry.
- It lets a consent withdrawal stop serving the file. The 1-day `s-maxage`, rather than `immutable`, bounds how long any CDN copy survives.

`next/image` treats `/uploads/...` as a local image (`localPatterns` is not set), so the optimizer and the existing `qualities` and `formats` apply unchanged.

### 6.5 Safeguarding rules (enforced in `lib/content/gate.ts` and the media schema)

| Rule | When | Effect |
|---|---|---|
| An upload with `peopleVisible && identifiable && !aiGenerated` needs `consent.status === "recorded"` and a non-expired `expiresAt` | attaching the asset to any record **on publish** | blocked, with the reason "This photo shows someone we can recognise. Please record their consent first." |
| `childInImage && !aiGenerated` additionally needs a consent `scope` that includes `web` | publish | blocked |
| `consent.status === "withdrawn"` or `status === "withdrawn"` | read | resolver swaps in `fallback-warm` everywhere at once; the admin lists the affected places |
| A story or testimonial needs `consent.status === "recorded"` for the **content itself**, unless it is `placeholder` | publish | blocked |
| A partner needs `permission.status === "recorded"`, unless it is `placeholder` | publish | blocked |
| Stories have no name field; `place` is a country code | schema | impossible to enter |
| `aiGenerated && peopleVisible` in use anywhere live | read (`getSiteChrome`) | footer shows `settings.site.illustrativeNotice` |
| Seeds with `placeholder: true` (37 AI child images, placeholder stats, posts and partners) | admin | "Before launch" checklist (section 9, step 13). Informative only; it does not block publishing |
| Post review checklist (7.1) | publish or schedule a post | blocked until ticked |

### 6.6 Consent withdrawal

`withdrawConsent({ assetId | storyId | testimonialId, note })` can be used by SO, CM and SA. It:
1. sets `consent.status = "withdrawn"` (and `status = "withdrawn"` for assets)
2. writes an audit entry
3. calls `updateTag("media")` and the relevant `col:` tag

The result:
- Every page drops the image or item on its next render.
- `/uploads/<key>` returns 410.
- The storage object is deleted after 24 hours. This gives a short undo window for mistakes; the SO can choose "delete now".
- Any copy of the file already cached elsewhere expires within 24 hours: the Next optimizer cache follows the upstream `max-age`, and so does the CDN. For an urgent takedown the runbook adds "Purge cache" in the Vercel dashboard.

### 6.7 Video

In phase 1, videos stay pipeline-only. Serverless functions cannot transcode them or extract posters.
- **Video-only slots** offer a picker over the 7 pipeline videos: `home.manifesto.media`, `home.donate.media`, `home.join.media`, `home.restoring.film`. The schema refines these slots with `asset.kind === "video"`.
- **Mixed slots** (hero slides, focus slides) accept an image or a video.
- Phase 2 adds direct MP4 upload (H.264, ≤ 25 MB, a poster required as a separate image) through a signed Storage upload URL.

---

## 7. Blog and news

### 7.1 Post model and workflow

```ts
export type PostCategory = "impact-update" | "story" | "news" | "safeguarding" | "partnerships" | "appeal-update" | "programme-update" | "event";
// Labels in code: "Impact update", "Story of hope", "News", "Safeguarding", "Partnerships", "Appeal update", "Programme update", "Event".
// Today's seed categories map: Education → programme-update (programmeIds ["education"]), Safeguarding → safeguarding, Partnerships → partnerships.

export type Post = {
  slug: string;                       // from the title; editable until first publish, then frozen
  title: string;                      // ≤ 90 (card shows ≤ 70; the card clamps)
  excerpt: string;                    // ≤ 220, used on cards, meta description fallback, and social
  cover: MediaRef;                    // gate 6.5 applies
  category: PostCategory;
  programmeIds: ProgrammeId[]; causeSlugs: string[]; countries: CountryCode[]; tags: string[];
  body: Block[];                      // 7.2
  author: { uid?: string; displayName: string; role?: string; avatar?: MediaRef }; // byline is a staff choice; AI is never the byline
  status: "draft" | "in_review" | "scheduled" | "published" | "archived";
  publishAt?: string;                 // scheduled
  publishedAt?: string;
  featured: boolean;
  review: {
    submittedBy?: string; submittedAt?: string;
    reviewer?: string; reviewedAt?: string; notes?: string;
    checklist: { factsChecked: boolean; figuresMatchVerifiedStats: boolean; noChildIdentified: boolean;
                 noPreciseLocations: boolean; consentForPeopleShown: boolean; noAdviceOrDiagnosis: boolean };
  };
  origin: { kind: "human" } | { kind: "ai"; model: string; briefTopicId?: string; generatedAt: string; sources: string[] };
  seo: Seo;
  readingMinutes: number;             // computed on save
};
```

Status transitions (`POST_TRANSITIONS` in `registry.ts`, enforced by the post actions):

| From → To | Who | Notes |
|---|---|---|
| (new) → `draft` | CM, PO, SA, system (AI) | AI drafts arrive as `in_review`, with `origin.kind = "ai"` |
| `draft` → `in_review` | author or any editor | `submitPost` |
| `in_review` → `draft` | CM, SA | `requestChanges(notes)` |
| `in_review` → `scheduled` | CM, SA | `approvePost({ publishAt })`; all checklist items true; `publishAt` in the future |
| `in_review` → `published` | CM, SA | `approvePost()` with no date; checklist true. For `origin.kind === "ai"`, the reviewer must be a human user, never system |
| `scheduled` → `published` | system (cron) | at `publishAt` |
| `published` → `archived` / `draft` | CM, SA | `unpublishPost` |

The workflow is the review gate, so posts don't use the draft or published split of the envelope for a second review step. Edits to a published post do go to `draft` (preview), and publishing them re-runs the checklist only if the body or cover changed.

### 7.2 Body format: structured blocks

**Decision: structured blocks (JSON).** Markdown and MDX were considered and rejected.

| | Blocks (chosen) | Markdown | MDX |
|---|---|---|---|
| Non-technical editor on a phone | "+ Paragraph / Photo / Quote / Number / Donate button" cards with up and down controls; no syntax | syntax to learn; images and buttons need conventions | code: not for staff |
| AI drafting | `z.toJSONSchema(PostBodySchema)` gives structured output that is validated before saving, so a draft can never fail to render | free text; layout drift | arbitrary code, a security risk |
| Safeguarding lint and figure checks | per-block inspection (stat blocks reference `statId`) | regex over prose | n/a |
| Brand rendering | each block maps to a Haven component (brush-edged photo, marigold pull-quote, stat card, donate CTA) | generic HTML | possible, but needs code review |
| Security | no HTML at all | needs sanitising | executes code |

```ts
export type Block = { id: string } & (
  | { type: "paragraph"; text: InlineText }                                  // ≤ 1200
  | { type: "heading"; level: 2 | 3; text: string }                         // ≤ 80
  | { type: "list"; style: "bullet" | "number"; items: InlineText[] }       // 1–12
  | { type: "quote"; text: string; attribution?: string }                   // attribution: role words, no child names
  | { type: "image"; media: MediaRef; caption?: string; size: "inline" | "wide" }
  | { type: "gallery"; items: { media: MediaRef; caption?: string }[] }     // 2–6
  | { type: "callout"; tone: "info" | "safeguarding" | "warm"; title?: string; text: InlineText }
  | { type: "stat"; statId: string } | { type: "stat"; value: string; label: string; source: string }  // prefer statId (verified)
  | { type: "cta"; kind: "donate" | "cause" | "support" | "volunteer" | "partner"; causeSlug?: string; label?: string }
  | { type: "video"; provider: "youtube"; videoId: string; title: string }  // privacy-enhanced nocookie embed, click-to-load
  | { type: "divider" }
);
// InlineText: **bold**, _italic_, [label](https://… | /path). Parsed by lib/content/inline.ts (~40 lines) into React nodes.
// No raw HTML is ever rendered. External links get rel="noopener noreferrer" and an external-link glyph.
```

- The same `Block[]` powers programme pages (overview, problem), cause stories and policies, all rendered by `components/content/Blocks.tsx` (server).
- `lintBlocks(blocks)` runs on save and shows its findings in the review panel. The heuristics are:
  - numbers in prose that do not match a verified stat
  - capitalised-name patterns near child words
  - "diagnos*" and "guarantee*"
  - email addresses or phone numbers

  These are hints; the human checklist is the gate.

### 7.3 AI drafting hooks

The automation doc owns the scheduler and prompts. The content model provides:
- `settings.editorial`: topics, voice and must-avoid list.
- `createAiDraft(post: PostDraftInput)`, a server-only function (not an action) called by the cron route with a system actor. It:
  - validates with `PostDraftSchema` (the same blocks)
  - forces `status: "in_review"`, `origin.kind: "ai"` and an empty checklist
  - writes an audit entry
  - notifies the CM by email (the notifications doc)

### 7.4 Scheduling

- `app/api/cron/publish-posts/route.ts` (GET) checks `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron).
- It flips every `scheduled` post with `publishAt <= now` to `published` (`publishedAt = publishAt`), writes an audit entry as actor `system: "Scheduler"`, and calls `revalidateTag("col:posts", "max")` and `revalidateTag("post:<slug>", "max")`.
- Run it hourly. On a Vercel Hobby plan cron runs at most daily, so tell staff "goes live within the day".
- For local dev, where there is no cron, opening the admin dashboard runs the same `publishDuePosts()` through a server action.

### 7.5 Landing "Latest News" and the news routes

- `getLatestPosts(3)` → `PostCard[]` with `{ id, slug, href: "/news/" + slug, title, categoryLabel, dateLabel, cover }`. Featured posts sort first, then `publishedAt` descending.
- `News.tsx` renders them with today's markup. The three seed posts keep the section identical until real posts replace them.
- The section hides when there are no published posts (G5).
- `app/(site)/news/page.tsx` lists posts, filtered by `?category=` inside `<Suspense>` (searchParams is runtime data).
- `app/(site)/news/[slug]/page.tsx` uses `generateStaticParams` from published slugs. It must return at least one slug under Cache Components; the seeds guarantee that. It reads `getPost(slug)` (tag `post:<slug>`). Draft Mode shows unpublished posts on their own URL for review.

---

## 8. Programme pages

### 8.1 Model and routes

- `Programme` (3.5) maps one-to-one onto ToR §5's nine parts: overview, problem, support provided, eligibility, process, request button, partner and donate buttons, related resources, and programme contact. It adds `notices` for the mandatory disclaimers:
  - Protection: "not an emergency-response service" (`emergency`)
  - Education: "does not guarantee approval" (`eligibility`)
  - Medical: "no diagnoses…" (`medical`)
  - Psychological: "assessments only by qualified professionals; no automated diagnoses" (`assessment`)
  - Legal: "not legal advice" (`legal`)

  Notices are SO-owned. A schema rule requires the matching notice kind per programme, so it cannot be deleted.
- Ids and slugs are fixed in code: `child-protection`, `education-assistance`, `medical-support`, `psychological-support`, `legal-support`, `family-community`. Icons are fixed to `ProgrammeIcon`. Staff can hide a programme but cannot add or remove one; a seventh programme is a developer task that needs an icon.
- `app/(site)/programmes/[slug]/page.tsx` uses `generateStaticParams` from the six slugs. It reads `getCollection("programmes")` plus the related causes, stories, FAQs (`placements` includes `"programme"` and the id is in `faqIds`) and resources (`getResources(ids)` from the resources doc). Everything is tagged, so any edit refreshes the page.
- The request CTA links to Get Support with the category preselected, `routeHref("support") + "?category=" + requestCta.category`. The donate CTA links to `/donate/<causeSlug>`, or to `/donate?programme=<id>` when no cause is linked.
- The mega-menu and the footer "Our Programmes" column are derived from live programmes (`title`, `navBlurb`, `icon`, `slug`). Today's duplicated labels in `nav.ts` go away.

### 8.2 Seed example (Education), verbatim style for the implementer

```ts
// content/programmes.ts (excerpt). CLIENT: programme copy to be confirmed by Haven (ToR §18)
{
  id: "education", slug: "education-assistance", order: 2,
  title: "Education Assistance", headline: "Keeping Children in School",
  summary: "We help vulnerable children access educational opportunities through school-fee assistance, learning materials and related support.",
  navBlurb: "School fees, uniforms & materials",
  hero: { eyebrow: "Keeping Children in School", media: ref("appeal-education") },
  overview: [{ id: "o1", type: "paragraph", text: "When fees, uniforms or books are out of reach, children fall behind or leave school altogether. Haven works with families, schools and partners so that cost is never the reason a child stops learning." }],
  problem: { heading: "Why children leave school", body: [/* CLIENT */], facts: [] },
  support: { heading: "Support we can provide", items: [
    { title: "Tuition and fee assistance" }, { title: "Hygiene products" }, { title: "Nutrition" }, { title: "Bedding" },
    { title: "Uniforms and materials" }, { title: "Learning resources" }, { title: "Educational referrals" },
    { title: "School readiness" }, { title: "Partner sponsorship" } ] },        // ToR §5.2 list, verbatim
  eligibility: { heading: "Who can apply", intro: "Support is for children whose education is at risk because of their family's circumstances.",
    criteria: [/* CLIENT */], note: "Applications are assessed against eligibility, and submitting one does not guarantee approval." },
  process: { heading: "How it works", steps: [
    { title: "Request support", text: "A parent, caregiver, teacher or community member submits a confidential request." },
    { title: "We review", text: "Our team checks the request against policy, resources and safeguarding procedures." },
    { title: "We verify", text: "We confirm details with the family and the school before any support is given." },
    { title: "Support and follow-up", text: "Fees are paid directly where possible, and we follow up during the term." } ] },
  requestCta: { label: "Request Education Support", text: "Tell us about the child and what they need.", category: "education" },
  donateCta: { label: "Keep a Child in School", text: "Fund fees, uniforms and books for a term.", causeSlug: "keep-children-in-school" },
  partnerCta: { label: "Sponsor a Programme", text: "Schools, businesses and foundations can sponsor places." },
  relatedResourceIds: [], relatedStoryIds: ["story-1", "story-3"], faqIds: ["faq-guarantee"],
  contact: { team: "Education team", email: "education@haven.org.gm" /* CLIENT */ },
  notices: [{ kind: "eligibility", text: "Applications are assessed against eligibility, and submitting one does not guarantee approval." }],
  seo: {},
}
```

Write the other five programmes the same way from ToR §5, marking every invented sentence `// CLIENT`. They stay `placeholder: true` until the client approves them.

---

## 9. Migration plan, in order

Each step leaves the site working. Gates are listed in italics.

1. **Baseline.**
   - Run `node scripts/qa/shoot.mjs --full` at 375×812 and 1440×900, plus `hero-frames.mjs`, `donate-flow.mjs` and `a11y.mjs`, against `next build && next start -p 3100`.
   - Copy the outputs to `media-src/qa/baseline/`.
2. **Dependencies and ignores.**
   - Add `zod@^4` as a direct dependency (only 4.6.5 is installed today, transitively through `eslint-plugin-react-hooks`).
   - Move `sharp` to `dependencies`.
   - Add `.data/` to `.gitignore`.
   - The backend doc adds `firebase-admin`.
3. **Schema layer.**
   - Write `lib/content/schema.ts`, `types.ts`, `registry.ts`, `access.ts` and `inline.ts`.
   - Create `lib/media/pipeline.ts`, with `img`/`video`/`poster` moved from `content/home.ts`, `ref()`, and the pipeline asset builder.
   - Create `content/media-meta.ts`.
   - Add the `fallback-warm` image through the existing media pipeline.
4. **Seeds.** Rewrite `content/*.ts` into seed modules with values verbatim (3.7), and create `lib/content/defaults.ts`.
   - *Gate: the dev-time default parse passes; `tsc --noEmit` is clean.*
5. **Read path.** Build `store/{readonly,local}` first, then `read.ts`, `resolve.ts`, `lib/media/index.ts`, `getHomeContent` and `getSiteChrome`. Firestore follows in step 14.
6. **Cache Components.**
   - Add `cacheComponents: true` and the `content` profile to `next.config.ts`.
   - Make the 4.9 fixes.
   - Switch `app/layout.tsx` to `generateMetadata`.
   - Update `opengraph-image.tsx`, `sitemap.ts` and `robots.ts`.
7. **Props refactor (4.8), one commit per group:**
   1. layout and chrome
   2. server sections
   3. client sections
   4. `app/(site)/` move

   Leave `lib/routes.ts` mapping every `RouteKey` to today's anchors (`donate → #donate`, `support → #support`, `contact → #contact`, …). Seed each CTA with the key that reproduces today's href. DoorsOpen and Duo point at `#contact` today, so they use `contact`, and switch to `support`/`report`/`volunteer`/`partner` when those pages ship.
   - *Gate: screenshots match the baseline at both widths, section by section; hero frames match; `donate-flow.mjs` passes; axe shows no new violations; Lighthouse mobile LCP is within 5% of baseline.*
8. **Guardrails.**
   - Add `import "server-only"` to the seed modules.
   - Add the eslint `no-restricted-imports` rule.
   - *Gate: `next build` clean.*
9. **Write path.**
   - Integrate `requireStaff()` (auth doc).
   - Write `actions.ts`, `gate.ts`, `diff.ts`, the audit writer and versions.
   - Add the preview route, `PreviewBanner` and `exitPreview`.
   - *Gate: editing `home.impact` in `.data` through the action updates `/` on the next request (`updateTag`); a stale `baseVersion` returns `conflict`; a CM editing a cause goal returns `forbidden`.*
10. **Media.**
    - Build the storage drivers, the upload route, `process.ts`, `/uploads/[...key]`, and the media actions (`createMediaAsset`, `replaceMediaFile`, `updateMediaMeta`, `withdrawConsent`).
    - *Gate: replacing `hero-family-in` with an upload changes the hero on the next load with a new hashed URL; withdrawal returns 410 and shows the fallback.*
11. **Collections and new pages**, in this order:
    1. stats (Impact, Restoring and Partners now reference ids)
    2. causes (Appeals and Donate on slugs) and the `/donate/[slug]` content
    3. posts, with the News section reading from posts, `/news`, `/news/[slug]` and the cron
    4. programmes pages
    5. the about page and the other `pages.*`
    6. policies

    The route structure for each comes from the IA doc.
12. **Admin editors.** Build them from the admin UX doc, driven by `registry.ts` (labels, field groups, constraints, preview paths).
13. **"Before launch" checklist.** `getLaunchReadiness()` lists every remaining placeholder, each with a deep link:
    - records with `placeholder: true`
    - stats still `placeholder`
    - AI child images in use
    - contact values still equal to the seeds (`+220 000 0000`, `hello@haven.org.gm`, social `#`)
    - partners without permission
    - policies with no professional review
14. **Go live on Firebase.** Once the credentials arrive:
    1. Set the env vars.
    2. Run `node scripts/content/push-local.mjs`, a new plain-JS script using `firebase-admin` that copies `.data/content`, `.data/uploads` and the media records to Firestore and Storage, unless staff will start fresh from the seeds.
    3. Deploy.
    4. Verify that the readonly mode is gone (admin saves succeed) and that the Firestore rules deny client access.

---

## 10. Risks and open points (for the lead)

**Risks:**
- `cacheComponents` is a global switch.
  - It turns `new Date()` during prerender into a build error.
  - It keeps hidden routes mounted through `<Activity>`. Re-test the GSAP pin, the parallax and Lenis after back navigation, and watch for duplicate SVG ids (`heart-clip`, `join-sphere`, `manifesto-knockout`) when sections are reused on other pages.
  - The `unstable_cache` fallback is kept possible by design.
- Serverless `use cache` is in memory per instance. Static shells are durable, but dynamic routes will read Firestore often.
- Request size limits: server actions accept 1 MB by default and Vercel functions about 4.5 MB. Uploads must use the route handler and be compressed in the browser.
- Withdrawn images can survive for up to 24 hours in the CDN and optimizer caches for anyone who already has the URL; the pages themselves drop the image immediately.
- Scripts import `content/world.ts` and `content/media-map.ts` through Node type stripping. Never add `server-only` or `@/` imports to them.
- A doc that fails validation after a schema change silently falls back to its defaults, so staff could see their edits "disappear". Every new field needs `.default()`, and invalid docs must show in the admin.
- A Vercel deploy without Firebase is read-only. Saves must fail kindly and must not attempt disk writes.
- Cause totals that mix Stripe donations in other currencies need a conversion policy from the payments doc.

**Open questions for the owner:**
- Should staff be able to hide home sections beyond the six safe ones, or reorder them? This design says no, to protect the brush-edge design.
- Should the "5.0" rating badge on Testimonials be removed? It is a number with no source.
- Should content managers publish site copy directly ("Save & update the website"), with formal review reserved for blog posts as designed? Or does every change need a second person?
- Should beneficiary stories and testimonials also need safeguarding-officer sign-off before publishing?
- Which Vercel plan is in use? It decides whether scheduled posts publish hourly or once a day.
