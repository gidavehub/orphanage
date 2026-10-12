# Haven design system: inventory and extension plan

**Status:** design only, nothing here is built yet. **For:** whoever builds the inner pages (about 20), the public forms and the admin ("Haven Desk").

**Source of truth:** the shipped landing page (`app/page.tsx`, `components/**`, `app/globals.css`). This document inventories what exists and specifies what to add so every new screen reads as the same product. Proposed changes to existing landing components are marked **(optional, owner call)** and must not block inner-page work.

Next.js here is 16.3 (App Router, React 19.2, Tailwind v4). The Next APIs cited below were checked against `node_modules/next/dist/docs/`:
- route groups
- `not-found` and `global-not-found`
- `next/image` `preload` (which replaces `priority`), `localPatterns` and `remotePatterns`
- `useLinkStatus`
- React `<ViewTransition>`
- `useActionState` and `useFormStatus` forms

---

## 0. Decisions at a glance

1. **One product, two voices.**
   - The **Donat voice** is Nunito, paper texture, forest and marigold, brush edges, and line-art hands. It is the default for information, help and forms.
   - The **Voices United (VU) voice** is Anton uppercase, Inter, coral and earth tones, and vu-cream. It is reserved for emotional and action chapters: donate, impact, stories and join.
   - Each inner page is Donat by default, with **at most one** VU chapter.
2. **Tokens.**
   - Every existing token and hex value stays.
   - Add a small set: accessible "ink" variants, status tints, a control-border grey, and shadows, radii and measures as theme variables (§1.8). There is no new hue family.
3. **Layouts.**
   - `app/(site)/layout.tsx` owns `SmoothScroll` (Lenis), `Header`, `<main id="main">`, `Footer` and `ScrollTop`.
   - The landing page moves to `app/(site)/page.tsx`.
   - The admin lives under `app/admin/**`, outside `(site)`, and has no Lenis.
4. **Navigation.**
   - One config (`content/nav.ts`) with real routes.
   - Mega panels for About, Programmes, Get Support, Resources and Get Involved.
   - The active route is set with `usePathname()` plus `aria-current`.
   - Hash links survive only for in-page jumps on the home page.
5. **Page frame.** Every inner page is `PageHero` (4 variants), then `Section`s, then `CtaBand`, then `Footer`. Each page has exactly one `h1`, inside `PageHero`.
6. **Forms.**
   - One field kit in `components/ui/form/*` with two skins: **donat** (bordered, for long forms) and **vu** (filled, for quick give and subscribe).
   - Inputs use 16px text (so iOS does not zoom on focus).
   - Labels are always visible.
   - Forms have an error summary and server-driven state through `useActionState`.
7. **Accessibility.**
   - Functional UI must pass WCAG 2.2 AA. That covers forms, statuses, the admin, legal pages and anything a person must read to get help.
   - It does this with the new ink variants.
   - The landing page's signature low-contrast pairings remain documented exceptions until the owner decides otherwise.
8. **Admin = "Haven Desk".**
   - Paper surfaces, with the same pill navigation as the public site at the top on desktop and a bottom tab bar on mobile.
   - Task cards written as sentences, records opened in sheets, and switches labelled with sentences.
   - No sidebar, no walls of toggles, no scroll reveals, no animated counters.
9. **Performance.**
   - IntersectionObserver and CSS for motion, with GSAP only for pins and scrubs (none planned on inner pages).
   - `cv-auto` with its rules.
   - WebP only.
   - Content-hashed media, including CMS uploads.

---

## 1. Tokens, exactly as they exist

All tokens are declared in `app/globals.css` under `@theme`, so Tailwind v4 generates `bg-*`, `text-*`, `ease-*` and `animate-*` utilities for each.

### 1.1 Colours

| Token | Hex | Intended use (as built) | Used in |
|---|---|---|---|
| `forest` | `#1f715a` | Donat primary. Nav pill, primary buttons, check discs, chevrons, the green block | Header pill, `Button forest`, About values, Faq chevrons, Restoring, Duo volunteer overlay (`forest/88`), carousel arrows, ScrollTop ring |
| `forest-700` | `#1a5f4c` | Darker forest | Defined but unused. Use for small text on mint (6.17:1) |
| `deep` | `#14332b` | Dark green band | DoorsOpen, MobileMenu panel, SearchOverlay (`deep/95`), programme-icon outlines, Team hover, Testimonials splash |
| `night` | `#061512` | Darkest surface and text-on-marigold | Footer, hero gradient, lightbox overlay (`night/90`), `vu` button hover, `::selection` text |
| `night-2` | `#0c211c` | Raised card on night | Footer contact card |
| `marigold` | `#f5af08` | Donat accent | Eyebrows and their rules, Donate pill, search disc, `:focus-visible` outline, `::selection` background, drips, hearts, progress fill, HQ map marker |
| `marigold-600` | `#e09f00` | Darker marigold | Defined but unused |
| `marigold-line` | `#ebdaa3` | Pale gold rule | Defined but unused |
| `flame` | `#f0462c` | Donat red-orange | Logo roof, CoralBlob, `Button flame`, appeal tone, HandHeartGlyph heart |
| `coral` | `#f25e44` | VU coral | Donate and Join sections, `VuHeading` accent, `Button vu`, donate-card selected chips (`coral/10`) |
| `coral-700` | `#e14f36` | Darker coral | Defined but unused |
| `paper` | `#f4f1ec` | Base of the `paper` utility (fibre texture) | Programmes, WorldFlags, Partners, Projects container, Hero corner brush |
| `cream` | `#fcf9ea` | Warm light card | Partners card, nav-dropdown hover rows, testimonial quote card, vision callout |
| `cream-2` | `#fffcf3` | Lightest warm section | Appeals |
| `card` | `#f9f6ed` | Card surface | Defined but unused |
| `mint` | `#dfebe7` | Forest tint | Team cards, forest progress track, ScrollTop track |
| `vu-cream` | `#f5efe4` | Sand-warm VU chapter background | Manifesto, Impact, Stories, lower half of Duo, spacer under Duo |
| `clay` | `#b8572a` | Earth accent | Journey background, Impact card, map markers, appeal tone, active filter pill, Focus caption (`clay/90`), `Button clay` |
| `clay-700` | `#9a4620` | Darker clay | Defined but unused. Use for small text on sand and clay tints |
| `cocoa` | `#7b4a2b` | Earth accent | Impact card |
| `umber` | `#4a2c1a` | Darkest earth | `Button clay` hover, Impact suffix on marigold, "Giving to" chip text |
| `sand` | `#f3e7d3` | Earth tint | Flag fallback, filter hover, "Giving to" chip, clay progress track, Impact suffix on clay |
| `ink` | `#1d1d1b` | Primary text | Everywhere |
| `body` | `#5c5b58` | Body copy | Paragraphs, meta |
| `line` | `#e7e3da` | Hairlines and dividers | Header info columns, Faq answer rule, Testimonials progress track |
| `track` | `#f9dfdc` | Flame tint | Flame progress track |

`body` has a hard-coded `background: #fff`. The base layer also sets:
- `::selection` = marigold on night
- `:focus-visible` = `3px solid marigold`, offset 3px
- `overflow-x: clip` on `body`

### 1.2 Hard-coded values in components

Codify these (§1.8) and never add new raw hex values.

| Raw value | Where | Becomes |
|---|---|---|
| `#f1f1ef` | Donate input fill and Segmented track | `field` |
| `#ececea` | Donate amount and chip borders | `mist` |
| `#ececec`, `#e6e6e4`, `#f1f1f0` | Grey decorative brushes (Founder, About strokes, HeartCluster) | `mist` |
| `#fcebc0` | Programme-card icon-tab ring, mega-menu icon halo (`shadow-[0_0_0_5px_#fcebc0]`) | `marigold-100` |
| `#f2b8ae`, `#f5d58a`, `#a9cfc2` | DoodleField pastel strokes | Stay local to `Decor.tsx` (art, not UI) |
| `#e9ecea` | Team portrait background | Stays local |
| `#2b2b2a` at 88% | Duo "charcoal" overlay | Stays local |
| `#5b5a55` | Partner logos grey | Stays local |
| `rgba(20,51,43,…)`, `rgba(6,21,18,…)`, `rgba(46,26,14,…)`, `rgba(74,44,26,…)` | Every shadow (deep, night, umber and cocoa tints) | `--shadow-*` (§1.5) |

### 1.3 Typography

Fonts are loaded in `app/layout.tsx` with `next/font/google` and exposed through `@theme inline`.

| Utility | Family and weights loaded | Role | Never use for |
|---|---|---|---|
| `font-sans` (default) | **Nunito** 400–900 | The Donat voice: body, Donat headings (800), nav (600), buttons (700), card titles (600–700), logo wordmark (900) | — |
| `font-display` | **Anton** 400 | VU voice: uppercase chapter headlines, big stats, numerals ("01"), giant footer line. The manifesto words are baked to SVG paths | Body text, labels, anything in mixed case |
| `font-script` | **Caveat** 500–700 | Eyebrows (700), short human asides ("What are you looking for?") | Information people must read accurately: amounts, dates, instructions, form labels, statuses |
| `font-grotesk` | **Inter** 400–600 | VU UI text: donate card, Segmented, `vu*` buttons (uppercase, 500, tracking 0.02em), impact labels, story captions, Join | Long Donat-section paragraphs |

The type scale in use is shown below (px, mobile → md → xl).

| Role | Spec |
|---|---|
| Landing hero h1 | Nunito 800, 36 → 54 (sm) → 70 (lg) → 78 (xl), leading 1.1, tracking −0.015em, `text-balance`, soft text-shadow |
| `DonatHeading` | Nunito 800, 32 → 42 → 50, leading 1.18, tracking −0.01em, `text-balance`, one `<span class="block">` per line |
| `VuHeading` | Anton uppercase, 44 → 64 → 76, leading 0.98, tracking 0.005em |
| Band heading (DoorsOpen) | Nunito 800, 34 → 46 → 52, leading 1.2 |
| Eyebrow | Caveat 700, 22 → 26, marigold, with 2px × 50/60px marigold rules |
| Card title | Nunito: 23/700 (programme), 22/600 (appeal, team), 19/600 (news) |
| Body (Donat) | Nunito 16, leading 1.75–1.8, `text-body` |
| Body (VU) | Inter 16, `leading-relaxed`, `text-ink/75` (on cream) or `text-white` (on colour) |
| Small and meta | 13–15. Captions 12–13 |
| Uppercase label | Inter 12/500, tracking 0.06em (impact); Nunito 13/800, tracking 0.08em (appeal season) |
| Big numbers | Anton 64 → 76 (impact); Nunito 700, 44 → 50 (Restoring); Nunito 800, 64 → 76 (Founder years) |

### 1.4 Radii

| Value | Used for |
|---|---|
| `rounded-full` | Buttons, nav pill, inputs and Segmented (donate card), chips, discs, badges, flags |
| 18px | Image inside an appeal card |
| 20px | Faq item |
| 22px | Focus caption chip |
| 24px (`rounded-3xl`) | News card, Journey card, founder quote, dropdown panels, lightbox |
| 26px | Appeal, Impact, Duo and Project cards |
| 30px | Programme card, donate card, footer contact card |
| 36px, 40px, 60px | Mobile story card; Team card, testimonial quote, Faq B&W inset; Projects container (md) |
| 44px | About frame |
| 70px | Story capsules (closed) |
| Special | Team arch `rounded-t-[140px] rounded-b-[16px]`, testimonial portrait `rounded-b-[280px]`, rating tab `rounded-b-[50px]` |

### 1.5 Shadows

All shadows are soft, long and negatively spread, tinted with deep, night or umber. None are grey.

| Value | Used for |
|---|---|
| `0 2px 8px rgba(0,0,0,.08)` | Segmented thumb |
| `0 8px 20px -16px rgba(74,44,26,.6)` | Appeal filter pills |
| `0 10px 24px -18px rgba(74,44,26,.55)` | Flag pills |
| `0 12px 40px -18px rgba(20,51,43,.22)` | Faq items |
| `0 18px 40px -28px rgba(20,51,43,.35)` | Programme card at rest |
| `0 30px 60px -30px rgba(20,51,43,.45)` | Programme card on hover |
| `0 20px 50px -36px` and `-30px rgba(20,51,43,.4/.35)` | Appeal and news cards |
| `0 24px 60px -20px rgba(6,21,18,.35)` | Dropdowns |
| `0 24px 60px -28px rgba(6,21,18,.35)` | Founder quote card |
| `0 40px 80px -40px rgba(6,21,18,.55)` | Donate card |
| `0 10px 30px -18px rgba(6,21,18,.35)` | Sticky nav and mobile bar |
| `0 10px 30px -10px rgba(6,21,18,.35)` | ScrollTop |
| `0 30px 60px -35px rgba(46,26,14,.55)` | Impact card on hover |
| `0 18px 40px -20px rgba(46,26,14,.8)` | Focus caption |

### 1.6 Motion

**Easing**
- `ease-out-expo` `cubic-bezier(.16,1,.3,1)` is the house curve, used for almost everything.
- `ease-out-back` `(.34,1.56,.64,1)` is for pops: logo roof and heart, world markers, team social fan-out.
- `ease-in-out-quint` is defined but unused.
- Line drawing and `BrushReveal` use `cubic-bezier(.65,0,.35,1)`.
- The Lenis easing is exponential (1.15s).

**Durations in use**
| Duration | Used for |
|---|---|
| 300ms | Colour and hover |
| 500ms | Dropdown, accordion `grid-rows`, Segmented thumb, ScrollTop |
| 700ms | Menu panel, cards, story capsule |
| 0.8–1s | `Reveal` default and `hero-rise` |
| 1.2s | Image zoom on hover |
| 1.4s | Brush wipe |
| 1.8s | Progress fill |
| 2.2s | Counter and line drawing |
| 6s | Hero slide |
| 9s | Ken Burns |

**Animation tokens**
| Token | Definition | Used |
|---|---|---|
| `animate-levitate` | 6s infinite | Yes |
| `animate-levitate-slow` | 8s infinite | Yes |
| `animate-pulse-ring` | 2.4s infinite | Yes |
| `animate-heartbeat` | 1.6s infinite | Yes |
| `animate-wobble` | 5s infinite | Yes |
| `animate-twinkle` | 3.2s infinite | Yes |
| `animate-marquee` | 38s linear infinite | Yes |
| `animate-spin-slow` | 18s | Unused |

**Raw keyframes** (used through arbitrary `animate-[…]`): `hero-rise`, `kenburns`, `progress`, `nav-drop`, `haven-roof`, `haven-stem`, `haven-heart`, and `pi-*` (the programme-icon hover set).

**Attribute systems** in `globals.css`:
- `[data-reveal]` and `[data-reveal-stagger]` + `[data-shown]` hold the reveal state. Variables are `--rx --ry --rs --rdur --rdel --rstag --i`.
- `.draw-path` with `pathLength="1"` + `[data-drawn]` draws SVG lines. Variables are `--draw-dur --draw-delay`.
- `[data-rise]` drives the footer statement words.
- `.manifesto-plate` and `.manifesto-line` drive the knockout words.
- `.world-marker__*` drives the map markers.
- `.haven-mark--animated` runs the logo entrance. Its heart beats on `a:hover` or `.group:hover`.
- `[data-nav-theme="glass"]` on a section makes the sticky nav turn to frosted glass over it.
- `@property --wipe` drives `BrushReveal`.

**Reduced motion**
- A global `@media (prefers-reduced-motion: reduce)` rule kills CSS animations and transitions, and `[data-reveal]` hidden states only apply under `no-preference`.
- `useReducedMotion()` (live) and `prefersReducedMotion()` (one-shot) gate the JS.
- Lenis is not created under reduced motion.
- The layout's `<noscript>` style un-hides reveals.

### 1.7 Layout utilities

| Utility | Definition |
|---|---|
| `wrap` | max 1330px, 16px gutters (24px from md) |
| `wrap-wide` | max 1790px, 16px gutters (32px from md) |
| `paper` | `paper` colour + `/textures/paper-v5.svg` at 600px |
| `text-outline` | 1.5px stroke, transparent fill |
| `cv-auto` | `content-visibility:auto; contain-intrinsic-size:auto 900px` |

Breakpoints are the Tailwind defaults: sm 640, md 768, lg 1024, xl 1280, 2xl 1536. The header switches to the pill at **xl**.

### 1.8 Token additions

Add these inside the existing `@theme` block. No hex value above changes.

```css
@theme {
  /* Accessible "ink" variants: text and icons on light surfaces; small white text on warm fills */
  --color-marigold-ink: #946200;  /* as text: white 5.24, paper 4.65, vu-cream 4.58, cream-2 5.11 */
  --color-coral-800: #c03a24;     /* white text on it 5.42; as text on white 5.42, vu-cream 4.74 */

  /* Tints (status pills, notices, selected states) */
  --color-marigold-100: #fcebc0;  /* already used raw as the icon halo */
  --color-coral-100: #fdebe6;     /* coral-800 text on it 4.70 */
  --color-clay-100: #f8e1d3;      /* clay-700 text on it 5.11 */
  --color-pebble: #efede8;        /* closed/archived; body text on it 5.80 */

  /* Controls */
  --color-field: #f1f1ef;         /* filled input (vu skin), Segmented track */
  --color-mist: #ececea;          /* chip borders, decorative greys */
  --color-edge: #8f897e;          /* control borders that must hit 3:1: white 3.47, paper 3.08, field 3.07 */

  /* Elevation (names → shadow-* utilities) */
  --shadow-thumb: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-chip: 0 8px 20px -16px rgba(74, 44, 26, 0.6);
  --shadow-soft: 0 12px 40px -18px rgba(20, 51, 43, 0.22);
  --shadow-card: 0 18px 40px -28px rgba(20, 51, 43, 0.35);
  --shadow-card-hover: 0 30px 60px -30px rgba(20, 51, 43, 0.45);
  --shadow-float: 0 24px 60px -20px rgba(6, 21, 18, 0.35);
  --shadow-modal: 0 40px 80px -40px rgba(6, 21, 18, 0.55);
  --shadow-bar: 0 10px 30px -18px rgba(6, 21, 18, 0.35);
  --shadow-earth: 0 30px 60px -35px rgba(46, 26, 14, 0.55);

  /* Radii (names → rounded-* utilities) */
  --radius-tile: 18px;
  --radius-control: 22px;  /* textarea, file drop, admin cards */
  --radius-card: 26px;
  --radius-card-lg: 30px;
  --radius-panel: 40px;

  /* Measures (names → max-w-* utilities) */
  --container-reading: 45rem;  /* 720px: prose, policies, articles */
  --container-form: 47.5rem;   /* 760px: single-column forms */
}

@layer base {
  /* Anchor jumps (TOC, error summary) clear the sticky bars: 68px mobile bar, 88px pill. */
  html { scroll-padding-top: 84px; }
  @media (width >= 80rem) { html { scroll-padding-top: 104px; } }
  /* Focus colour becomes contextual; unset = today's marigold, so the landing page is unchanged. */
  :focus-visible { outline-color: var(--focus, var(--color-marigold)); }
}
```

Rules:
- Name the colour `pebble`, not `stone`, so it does not collide with Tailwind's default `stone-*` scale.
- New code uses `shadow-card`, `rounded-card` and the other new names, never arbitrary values.
- Landing sections may migrate when someone next touches them **(optional)**.

---

## 2. Existing primitives: catalogue

Every component is listed with its file, its exact props, when to use it and the gotchas already hit.

### 2.1 `Button`

**File:** `components/ui/Button.tsx` (server-safe; renders `next/link` when `href` is given).

```ts
type Variant = "forest" | "marigold" | "flame" | "clay" | "outline" | "outline-light" | "white" | "vu" | "vu-outline" | "vu-white";
type Size = "sm" | "md" | "lg";          // h-11 px-7 14px | h-[52px] px-9 15px | h-[58px] px-10 15px
type Icon = "arrow" | "arrow-right" | "heart" | "play" | "send" | "none"; // default "arrow"
props: { variant?; size?; icon?; iconFirst?; className?; children } & (LinkProps & { href } | ButtonHTMLAttributes)
```

Base: pill, Nunito 700, `active:scale-[.97]`, `disabled:opacity-40`.

**Variants**

| Variant | At rest | On hover | Use |
|---|---|---|---|
| `forest` | forest, white text | marigold, night text | Default primary on light surfaces |
| `marigold` | marigold, white text (fails contrast, §6) | forest | Landing only, as an approved exception |
| `flame` | flame, white text | forest | — |
| `clay` | clay, white text | umber | Earth-toned primary (appeals, VU-earth chapters) |
| `outline` | ink/80 border | forest fill, white text | Secondary on light surfaces |
| `outline-light` | white/70 border | white fill, night text | Secondary on dark or photo |
| `white` | white, ink text | marigold, white text (fails on hover) | On forest blocks |
| `vu` | coral, white text | night | VU chapters only |
| `vu-outline` | ink border | ink fill, white text | VU chapters only |
| `vu-white` | white | night | VU chapters only |

The `vu*` variants are Inter uppercase, 500 weight, tracking 0.02em.

**Icon glyphs**
- `arrow` is the double ArrowUpRight that slides diagonally on hover.
- `heart` beats on hover.

**Gotchas**
- `type` defaults to `"button"`, so pass `type="submit"` in forms.
- There is no loading state, no danger variant and no icon-only form. These are added in §3.

**Add (does not change existing variants)**
| Addition | Spec | Use |
|---|---|---|
| `variant="marigold-ink"` | marigold background, **night** text, hover forest and white | All new functional CTAs that want marigold: forms, header Donate pill on inner pages if the owner approves, the admin "+ New" button |
| `variant="coral-ink"` | coral-800 background, white text, hover night | VU-chapter submit buttons that must pass AA |
| `variant="danger"` | white background, coral-800 border and text, hover coral-800 fill with white text | Admin destructive actions, only inside a confirm |
| `loading?: boolean` | Swaps the glyph for `<Spinner/>`, sets `aria-busy` and disables | — |
| `block?: boolean` | `w-full` | — |

### 2.2 `Eyebrow`

**File:** `components/ui/Eyebrow.tsx`

```ts
{ children; lines?: "both" | "right" | "none" /* default both = centred */; className? }
```

Caveat 700, 22 → 26px, marigold, with 2px × 50/60px marigold rules. Use it above every Donat heading:
- `lines="both"` centred
- `lines="right"` left-aligned

**Add `tone?: "brand" | "ink"`**
- `ink` keeps the marigold rules but sets the text in `marigold-ink`.
- Inner pages on light surfaces use `tone="ink"`.
- On dark or photo surfaces, plain marigold is fine (9.8:1 on night).

### 2.3 `DonatHeading` and `VuHeading`

**File:** `components/ui/SectionHeading.tsx`

```ts
DonatHeading: { lines: string[]; as?: "h1"|"h2"|"h3"; className?; light?: boolean; id? }
VuHeading:    { parts: string[] /* plain, ACCENT, plain… */; as?; className?; accentClass?: string /* default text-coral */; id? }
```

- Pass `id` and point the section's `aria-labelledby` at it. Every landing section does this.
- On `vu-cream`, `VuHeading`'s default coral accent is 2.84:1 and fails even the large-text threshold. Inner pages pass `accentClass="text-coral-800"` on cream. On a coral background use `accentClass="text-night"`, as Donate does.

### 2.4 `Reveal`

**File:** `components/ui/Reveal.tsx` (client)

```ts
{ children; className?; stagger?: number /* s between direct children */; y?=40; x?=0; delay?=0; duration?=1; scale?; offset?=0.14; as?: "div"|"section"|"ul"|"ol"|"header"|"footer"|"article"; id? }
```

- One IntersectionObserver per instance drives CSS transitions.
- The attributes are removed once the reveal finishes, so hover utilities work again.
- `stagger` animates **direct children** only.

**Rules**
- Never wrap above-the-fold content (it starts at opacity 0, which hurts LCP). `PageHero` uses CSS keyframes instead.
- Never wrap form fields or error messages.
- Never use it in the admin.

### 2.5 `Counter`

**File:** `components/ui/Counter.tsx` (client)

```ts
{ value: number; prefix?; suffix?; duration?=2.2; className?; suffixClassName?; compact?: boolean /* 15K */ }
```

- The server renders the final value. The client resets it to 0 and counts up when in view, with an ease-out cubic curve.
- Formatting is `en-US`.

Public pages only. Only verified figures may be shown (ToR §3), so wire it to admin-managed impact stats.

### 2.6 `ProgressBar`

**File:** `components/ui/ProgressBar.tsx` (client)

```ts
{ percent: number; tone?: "flame"|"forest"|"marigold"|"clay"; className?; label: string /* required */ }
```

- A 5px pill. The track is `track`, `mint`, `cream` or `sand` to match the tone.
- It shows at least 1.5%, fills by `scaleX` over 1.8s when in view, and uses `role=progressbar`.
- Use it for campaign and cause funding, and for FileDrop upload progress. For upload progress, add `animate={false}` so it shows the live width without a transition.

### 2.7 `AutoVideo` and `VideoLightbox`

**`AutoVideo`** (`components/ui/AutoVideo.tsx`, client)

```ts
Omit<VideoHTMLAttributes, "autoPlay"|"muted"|"loop"|"preload"> & { src; poster?; paused?: boolean }
```

- Muted, looping and inline, with `preload="none"`.
- It attaches `src` and `poster` only within 200px of the viewport, and pauses off-screen or under reduced motion.
- **Every** background video uses it.

**`VideoLightbox`** (`components/ui/VideoLightbox.tsx`, client)

```ts
{ open; onClose; src; poster?; title }
```

- Full-screen at z-90, on `night/90` with blur.
- Marigold close disc that rotates 90° on hover.
- Stops Lenis, closes on Esc, and attaches media only when open.
- **Gaps:** no focus trap and no focus return. Rebuild it on `Modal` (§3.5).

### 2.8 Brush art

**Files:** `components/art/Brush.tsx`, `BrushReveal.tsx`, `brush-index.ts`, and `public/brush/*.svg`

```ts
maskStyle(name: BrushName, size?: string): CSSProperties
Brush:      { name; color?="currentColor"; className?; style?; flipX?; flipY?; rotate? }   // solid mark, aspect from brush-index
BrushMask:  { name; className?; children; size?; style? }                               // clip children (photo) to a brush
BrushReveal:{ name; color?; className?; children?; direction?="right"|"left"|"up"|"down"; duration?=1.4; delay?=0; flipX?; style? }
```

**Shapes** (box size in px, file size, and where each is used):

| Shape | Box | File | Used in |
|---|---|---|---|
| `band` | 1400×594 | 121 KB | Hero corner splatter, Partners torn bottom edge (flipY, aspect forced to 1400/120), Footer top edge (aspect forced to 1400/150) |
| `drip` | 612×820 | 39 KB | Hero, About, Footer |
| `edge` | 458×820 | 48 KB | Faq and Restoring white paint edges |
| `splash` | 820×820 | 80 KB | Testimonials, Founder |
| `strokes` | 820×820 | 129 KB | About, Duo hover, Founder |
| `patch` | 820×820 | 67 KB | About photo mask |
| `label` | 820×458 | 37 KB | Projects hover label |
| `corner` | 820×458 | 52 KB | **Unused** |
| `strip` | 458×820 | 64 KB | **Unused** |
| `torn` | 1400×594 | 129 KB | **Unused** |

**Rule:** at most **3 distinct shapes per inner page**. Prefer `band`, `drip` and `edge`, which the header and footer path already warms.

### 2.9 Decor and hands

**`components/art/Decor.tsx`**
| Export | Props | Notes |
|---|---|---|
| `CurlyArrow` | `{ className?; flip?; color? }` | Self-drawing |
| `CoralBlob` | `{ className? }` | SMIL-animated |
| `GreenBlobHeart` | `{ className? }` | SMIL plus heartbeat and twinkle |
| `HeartCluster` | `{ className? }` | Grey hearts, uses `currentColor` |
| `HeartClipDef` | `{ id }` | Heart `clipPath` |
| `DoodleField` | `{ className? }` | Pastel hands, hearts and sprigs |

**`components/art/Hands.tsx`**
| Export | Notes |
|---|---|
| `HAND_PATH`, `HEART_PATH` | Path constants |
| `HandsLineArt` | Self-drawing |
| `ColorHands` | Rotating; the FAQ badge |
| `HandDoodle` | `{ className?; dots? }`, wobbles |

**Gap:** the SMIL `<animate>` blobs ignore `prefers-reduced-motion`. When reused, gate them behind `useReducedMotion()` and render the static `d`.

**Use on inner pages**
| Art | Where |
|---|---|
| `HeartCluster`, `HandDoodle` | `PageHero` plain variant, empty states |
| `HandsLineArt` | Programme intro |
| `DoodleField` | Listing backgrounds |
| `CoralBlob`, `GreenBlobHeart` | `CtaBand` |

**Never** put art behind form fields or data.

### 2.10 Brand and icons

| Component | File | Props | Notes |
|---|---|---|---|
| `Logo` and `HavenMark` | `components/art/Logo.tsx` | Logo: `{ tone?: "dark"\|"light"; mark?: "color"\|"mono"; className?; markClassName?; animated? }`, sized by font-size | Header 34/40px, mobile bar 28px, menu 30px, footer 42px |
| `ProgrammeIcon` | `components/art/ProgrammeIcons.tsx` | `{ name: ProgrammeIconName; className? }` | Duotone with a deep outline; hover animations need an ancestor `group`. The six names are protection, education, medical, psychological, legal and family |
| `SocialIcon` | `components/art/SocialIcons.tsx` | `{ name; className? }` | 24-unit grid: facebook, x, youtube, linkedin, instagram, tiktok, whatsapp |
| `Flag` | `components/art/Flag.tsx` | `{ code; label?; className? }` | Cut from one sprite (`/flags/sprite.webp`, 12 columns). Decorative unless `label` is set. Only countries in `spriteCountries` (80 presence countries plus `us`) exist; anything else shows the `sand` disc |
| `partnerLogos` | `components/art/PartnerLogos.tsx` | — | Placeholders |
| `HandHeartGlyph` | `components/layout/Ticker.tsx` | — | Inline brand glyph |

### 2.11 Patterns still inside sections (to extract, §3)

| Pattern | Lives in | Extract to |
|---|---|---|
| `Segmented<T>` (radiogroup pill with sliding white thumb, Inter 11–12 uppercase) | `Donate.tsx` | `components/ui/form/Segmented.tsx` |
| Donate `field` string (`h-12 rounded-full bg-[#f1f1ef] px-5 font-grotesk text-[14px] … focus:ring-2 focus:ring-coral/40`), the select chevron data-URI, `accent-coral` checkboxes, amount grid and "Other" field, in-kind toggle chips with Check | `Donate.tsx` | Form kit, `AmountPicker`, `Chips` |
| Join input (`h-[60px] bg-white/15 … ring-white/60`) and pill submit | `JoinSphere.tsx` | `Input surface="dark"` |
| Step switch with `animate-[hero-rise_0.6s_var(--ease-out-expo)_both]` and success disc (pulse ring + heartbeat heart + Anton "Thank you, {first}") | `Donate.tsx` | `Stepper`, `FormSuccess` |
| Accordion (`grid-rows-[0fr→1fr]`, `aria-expanded`, `role=region`, white `rounded-[20px]` cards) | `Faq.tsx` | `Accordion` |
| Filter pills (`aria-pressed`, active `bg-clay`) | `Appeals.tsx` | `Chips` |
| `RiseWords` | `Hero.tsx` | `components/ui/RiseWords.tsx` |
| `PlaceChip` (glass flag chip) | `Hero.tsx` | `Badge variant="glass"` |
| Icon-tab card, appeal card, news card, team arch card, impact stat card, Duo photo card, journey reveal card | Sections | `components/ui/cards/*` |
| Round icon buttons (search disc, close disc, carousel arrows, social discs) | Header, overlays, Team, Testimonials | `IconButton` |
| Arrow list links (ArrowUpRight that rotates 45° on hover) | `Footer.tsx` `LinkColumn` | `ArrowLink` |

### 2.12 Layout components

| Component | Notes |
|---|---|
| `Header` | Client. Info bar is 84px (92px at xl), then a 30px spacer, and the forest pill (60px) hangs over the boundary. The pill becomes `fixed` with a `nav-drop` animation after `scrollY > 162`, and turns to glass over `[data-nav-theme=glass]`. The mobile sticky bar is 68px. Links are hash links today |
| `NavDropdown` | Hover and focus, Esc and outside-click close. The mega variant is a 640px 2-column grid with `ProgrammeIcon` discs |
| `MobileMenu` | Right panel on `deep`, accordion children, focus trap, Lenis stop |
| `SearchOverlay` | `deep/95`, UI only |
| `Ticker` | — |
| `Footer` | Server. Brush `band` torn top edge in `night` overlapping the section above, emergency row, link columns, contact card with social rail, `FooterGiantText`, legal row, forest copyright bar. The inner content uses `cv-auto`; the brush edge stays outside it |
| `ScrollTop` | Progress ring, bottom-right, 58px |

### 2.13 Motion and utility libraries

| Export | File | Notes |
|---|---|---|
| `useInView<T>({ rootMargin?, once? })` | `lib/motion/useInView.ts` | Returns `[ref, inView]` |
| `useReducedMotion()` | `lib/motion/useReducedMotion.ts` | — |
| `SmoothScroll` and `useLenis()` | `lib/motion/SmoothScroll.tsx` | Lenis is null under reduced motion. Re-measures ScrollTrigger on font load and on `contentvisibilityautostatechange` |
| `gsap`, `ScrollTrigger`, `useGSAP`, `prefersReducedMotion` | `lib/motion/gsap.ts` | — |
| `cn` | `lib/cn.ts` | — |
| `money` and `plainNumber` | `lib/money.ts` | `money` formats as "GMD 186,000", ISO code first |
| `requestDonation` and `DONATE_EVENT` | `lib/donate-intent.ts` | Window event, home page only |
| `img()`, `video()`, `poster()` | `content/home.ts` | Resolve through `content/media-map.ts`. **Move to `lib/media.ts`** and re-export from `content/home.ts` so inner pages don't import landing copy |

---

## 3. Gaps: new shared primitives

**Conventions**
- Server components unless marked *client*.
- Every component takes `className` and composes with `cn`.
- Default focus colour is contextual (`--focus`, §1.8).
- Paths are under `components/ui` unless they are page chrome (`components/layout`) or art (`components/art`).

### 3.1 Page structure

**`components/layout/PageHero.tsx`.** The inner-page banner, in the style of Donat's page-title banner.

```ts
type Crumb = { label: string; href?: string };        // last crumb = current page, no href
type PageHeroProps = {
  variant?: "photo" | "programme" | "plain" | "article";   // default "photo"
  eyebrow?: string;
  title: string | string[];                // string[] = forced line breaks (like DonatHeading)
  intro?: string;
  crumbs: Crumb[];                         // "Home" is prepended automatically
  media?: { image: string; alt?: string } | { video: string; poster: string };  // photo/programme only
  programme?: ProgrammeIconName;           // programme variant icon tab
  actions?: React.ReactNode;               // ≤2 Buttons
  notice?: React.ReactNode;                // e.g. <Notice tone="emergency" />, rendered above the fold
  meta?: React.ReactNode;                  // article: date · category · read time; policy: "Last reviewed …"
  next?: SectionTone;                      // colour of the following section → brush edge colour (default "paper")
};
```

**Variants**
- **photo** (About, Programmes index, Get Involved, Impact, Contact)
  - Full-bleed image or `AutoVideo`, about `h-[46svh] min-h-[380px] max-h-[600px]` (`min-h-[340px]` on phones).
  - The same night gradient as the landing hero, and a Ken Burns run once over 9s (none under reduced motion).
  - Centred text: `Eyebrow` (brand marigold, which is fine on the dark photo), `h1` in Nunito 800 at 34 → 48 → 60 (leading 1.12, `text-balance`) with words rising through `RiseWords`, and intro in white/85 at 16–18px.
  - A **breadcrumb glass pill** below, styled like `PlaceChip`: `bg-white/15 ring-1 ring-white/25 backdrop-blur-md`, white/90, 14px bold, with the current page in marigold.
  - The bottom edge is Partners' torn brush (`band`, `flipY`, aspect 1400/120) painted in the `next` section colour, plus a marigold `drip` bleeding off the top-right (hidden below md).
  - Sets `data-nav-theme="glass"`.
- **programme.** Photo variant, left-aligned:
  - The Donat icon tab (a white 96px disc half-ringed in `marigold-100`, holding the `ProgrammeIcon`) sits above the title.
  - `actions` hold "Request support" (`marigold-ink`) and "Support this programme" (`outline-light`).
  - The programme disclaimer goes in `notice`.
- **plain.** For forms, policies, Report a Concern, Request Support and Contact. These are calm, private and fast, with no photo.
  - `paper` background, left-aligned within `wrap`, with the breadcrumb above the title in body text, forest links and the current page in ink bold.
  - Title 32 → 44 → 52. `HeartCluster` or `HandDoodle` on the right from lg.
  - `notice` sits directly under the intro and above the fold on a 375×667 phone.
  - No bottom brush. The next section starts with a straight edge, so the contrast with the form stays calm.
- **article.** For news, stories and resource detail.
  - White background, centred `max-w-reading` column: eyebrow (category), title 32 → 44, and `meta` in Inter 14 body.
  - Then a cover image, `rounded-card-lg`, aspect 16/9, with the white `Brush name="edge"` biting the right side, the same device as Faq.

The hero always renders `<h1>`. Text animation is CSS (`hero-rise`), never `Reveal`. The image uses `loading="eager" fetchPriority="high" sizes="100vw" quality={75}` (`preload` is reserved for the landing hero).

**`components/ui/Breadcrumbs.tsx`**

```ts
{ items: Crumb[]; tone: "light" | "dark" }
```

- `<nav aria-label="Breadcrumb"><ol>`, with the last item `aria-current="page"`.
- Separators are 8px marigold `HEART_PATH` glyphs (`aria-hidden`).
- On narrow screens, crumbs collapse to "… / Parent / Current".
- Also emits `BreadcrumbList` JSON-LD (see `02-guides/json-ld.md`).

**`components/ui/Section.tsx`.** The SectionShell. Every inner-page band uses it.

```ts
type SectionTone = "white"|"paper"|"cream"|"cream-2"|"vu-cream"|"sand"|"mint"|"forest"|"deep"|"night"|"clay"|"coral";
type BrushEdge = { shape?: "band" | "torn"; color: SectionTone; height?: number /* forced aspect h, default 120 */ };
type SectionProps = {
  id?: string; tone?: SectionTone /* "white" */; width?: "wrap"|"wrap-wide"|"reading"|"form"|"none";
  pad?: "none"|"sm"|"md"|"lg" /* md */; edgeTop?: BrushEdge; edgeBottom?: BrushEdge;
  cv?: boolean /* default true; pass false for the first section after the hero, form sections, TOC/anchor pages */;
  navTheme?: "glass"; labelledBy?: string; label?: string;
  last?: boolean; className?: string; children: React.ReactNode;
};
```

- **Padding:** `sm` = `py-14 md:py-16`, `md` = `py-20 md:py-28`, `lg` = `py-24 md:py-32`.
- **Text colour:** dark tones (`forest`, `deep`, `night`, `clay`, `coral`) set `text-white` and `--focus: var(--color-marigold)`. Light tones set `--focus: var(--color-forest)`.
- **`paper` tone** applies the `paper` utility.
- **Brush edges** render through `BrushEdge`, absolutely positioned outside the content box. When edges are present, `cv-auto` goes on an **inner** wrapper (the Footer pattern), because paint containment would clip the edge.
- **`last`** adds `pb-[max(9rem,12vw)]`, so the Footer's torn top edge (forced to aspect 1400/150) never eats content.
- Renders `<section aria-labelledby>`.

**`components/art/BrushEdge.tsx`**

```ts
{ position: "top" | "bottom"; color: SectionTone | string; shape?: "band" | "torn"; height?: number }
```

This captures the squash-and-flip recipe used by Partners and the Footer:
- `w-full`, aspect `1400/height`
- `flipY` for bottom edges
- `-translate-y-[58%]` overlap, `aria-hidden`

**`components/ui/SectionIntro.tsx`.** Every landing section repeats the block `Reveal`, `Eyebrow`, heading and paragraph; this standardises it.

```ts
{ voice: "donat"|"vu"; eyebrow?: string; title: string[]; intro?: string; align?: "center"|"left"; light?: boolean; id: string; actions?: React.ReactNode }
```

- **donat voice:** `Eyebrow` (`lines` both or right by `align`) + `DonatHeading` + body 16/1.75 at `max-w-[600px]`.
- **vu voice:** `VuHeading` (`title` used as `parts`) + Inter body.
- The intro gap is `mt-4`. The caller adds the content gap: `mt-10` for forms, `mt-14` for grids.

**`components/layout/CtaBand.tsx`.** The final call to action (ToR §3: "Your Support Will Positively Impact a Child's Welfare and Future").

```ts
{ variant?: "default" | "safeguarding" | "volunteer"; title?: string; text?: string }
```

- Built from DoorsOpen: `deep` background, `CoralBlob` top-left, `GreenBlobHeart` top-right, levitating hand plates (md and up), centred Nunito 800 heading.
- Buttons: Donate Now (`marigold-ink`), Become a Volunteer (`outline-light`), Request Support (`outline-light`).
- The emergency note (`site.emergencyNotice`) sits in a `white/[.06]` capsule.
- It is always the last section before the Footer, with `last` padding. Deep into night looks right under the torn edge.

**`components/layout/FormShell.tsx`.** The two-column frame for every public form.

```ts
{ form: React.ReactNode; aside?: React.ReactNode }
```

- `grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16`. The form is `max-w-form`.
- The aside is `lg:sticky lg:top-28 self-start grid gap-5` and holds a help card (cream), the "what happens next" `Timeline` and the contact card.
- On mobile the aside goes below the form. The emergency notice lives in `PageHero.notice`, so it stays above the fold.

**`components/layout/PolicyShell.tsx`**

```ts
{ toc: TocItem[]; children; meta: { reviewed: string; version?: string; pdf?: string } }
```

- `grid lg:grid-cols-[240px_minmax(0,1fr)] gap-16`.
- `Toc` is sticky on desktop. On mobile it becomes an `Accordion` labelled "On this page".
- Content goes in `Prose`.
- A footer card reads "Questions about this policy? Contact our safeguarding lead".
- **No `cv-auto`** anywhere in a page with a TOC (§7).

**`components/layout/SkipLink.tsx`.** Missing today. Renders `<a href="#main">` as `sr-only focus:not-sr-only`: a forest pill top-left at z-100, white Nunito 700. It goes first in the `(site)` and admin layouts. `<main id="main" tabIndex={-1}>`.

### 3.2 Typography and content

**`components/ui/Prose.tsx` and `@utility prose-haven`** (in `globals.css`). Long copy: policies, articles, programme overviews and the admin editor surface. `@tailwindcss/typography` is not installed and is not needed.

```ts
{ children; size?: "md" | "lg"; className? }   // renders <div class="prose-haven max-w-reading">
```

Visual (selectors wrapped in `:where()` so utilities can still override):

| Element | Spec |
|---|---|
| Body | Nunito 17px, leading 1.8, `text-body`. Paragraph spacing 1.1em |
| `h2` | Nunito 800, 28px ink, `mt-14`, followed by a `2px × 48px` marigold rule (the Footer `LinkColumn` title device) |
| `h3` | 20px, 700, forest |
| `a` | forest, `underline decoration-marigold decoration-2 underline-offset-4`; hover ink |
| `ul` | 8px marigold heart bullets |
| `ol` | Anton numerals in forest |
| `blockquote` | The About vision callout: `rounded-2xl border-l-4 border-marigold bg-cream px-5 py-4` |
| `strong` | ink |
| `table` | `line` hairlines, Inter 14px, header row in `sand` |
| `hr` | A small centred grey `Brush name="strokes"` mark (CSS mask on a pseudo-element) |
| `figure` | `rounded-card` with a caption in Inter 13 body |

The same class goes on the admin rich-text editor's content area, so what staff see is what gets published.

**`components/ui/Toc.tsx`** (client)

```ts
{ items: { id: string; label: string }[] }
```

- An IntersectionObserver scroll-spy.
- The active item gets a 2px marigold bar on its left, ink bold text and `aria-current="location"`. The rest are body 15px.

**`components/ui/RiseWords.tsx`.** Extracted verbatim from `Hero.tsx`.

```ts
{ text: string; delay?: number }
```

Per-word `hero-rise` with a 70ms stagger.

**`components/ui/ArrowLink.tsx`**

```ts
{ href; children; tone?: "light"|"dark" }
```

The Footer `LinkColumn` row: an ArrowUpRight in marigold (or `marigold-ink` on light) that rotates 45° on hover, with the label going marigold or forest. Use it for related-links lists.

**`components/ui/IconDisc.tsx`**

```ts
{ icon: ProgrammeIconName | LucideIcon; size?: 44|52|64|96; halo?: "marigold"|"mint"|"none" }
```

The white disc with `shadow-[0_0_0_5px_var(--color-marigold-100)]` from the mega menu. It adds `group` hover animations for programme icons. Used in service cards, RadioCards, mega panels and admin task cards.

### 3.3 Forms (`components/ui/form/*`)

**Shared types** (`lib/forms/types.ts`)

```ts
export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;
export type FormState<K extends string = string> =
  | { status: "idle" }
  | { status: "error"; errors: FieldErrors<K>; message?: string; values?: Partial<Record<K, string>> }
  | { status: "success"; reference?: string; title?: string; message?: string };
```

Forms are client components using `useActionState(action, { status: "idle" })`, per `02-guides/forms.md`. Field components read `state.errors[name]` and `state.values[name]`, so values survive a server round trip.

**Skins.** Every control takes `skin?: "donat" | "vu"`, default `donat`.

| | donat (long forms on inner pages) | vu (donate card, quick give, subscribe) |
|---|---|---|
| Font | Nunito 16px ink | Inter 16px ink. The landing Donate uses 14px, which zooms on iOS |
| Single-line | `h-[52px] rounded-full px-5 bg-white border-[1.5px] border-edge` | `h-12 rounded-full px-5 bg-field`, no border |
| Textarea | `rounded-control px-5 py-4 min-h-[140px]`, same border | `rounded-control bg-field` |
| Hover | `border-ink/60` | `bg-[#ebebe8]` |
| Focus | `border-forest ring-4 ring-forest/15` (plus outline via `--focus`) | `ring-2 ring-coral-800/50` |
| Error | `border-coral-800 bg-coral-100/40`, with a message below | `ring-2 ring-coral-800`, with a message below |
| Disabled | `bg-pebble text-body/70 border-mist` | `opacity-50` |
| Label | Above the control: Nunito 15/700 ink, `mb-2` | Visible label, Inter 13/500 `ink/75` (not just `aria-label`) |

On `paper` or `cream` sections, donat fields stay white so they lift off the texture.

**`Field.tsx`.** The wrapper and the single source of `id`, `aria-describedby` and `aria-invalid`.

```ts
{ name: string; label: React.ReactNode; hint?: React.ReactNode; error?: string; optional?: boolean;
  labelHidden?: boolean; counter?: { max: number }; children: React.ReactElement /* the control */ }
```

- **Label line:** label, then "(optional)" in body 400 when optional. Optional fields are marked, rather than required ones, because most fields are required.
- **Hint:** body 14px, above the control (GOV.UK order, so screen readers hear it before typing).
- **Error:** below the control. coral-800, 14/600, with an `AlertCircle` 16px icon and `id={name}-error`.
- **Counter:** right-aligned, Inter 12 body. It turns coral-800 past `max`.

**`Fieldset.tsx`**

```ts
{ legend: string; hint?: string; children }
```

The legend is Nunito 800 22px ink with the `2px × 48px` marigold rule under it. Groups are separated by `mt-12`. Use it for each step or group, and for radio and checkbox groups (smaller legend: 16/700).

**Controls**

| Component | Props | Visual and behaviour |
|---|---|---|
| `Input.tsx` | `InputHTMLAttributes & { skin?; surface?: "light"\|"dark"; leading?: ReactNode; trailing?: ReactNode; invalid? }` | `surface="dark"` is the Join style: `bg-white/15 text-white placeholder:text-white/85 ring-white/60`. `leading` holds an icon or currency code (`AmountPicker` "Other": `GMD ▸ ____ Dalasi`). Correct `type`, `inputMode` and `autoComplete` are mandatory |
| `Textarea.tsx` | Same, plus `rows?` | Grows to its content up to 12 rows (`field-sizing: content` with a fallback `rows`) |
| `Select.tsx` | Native `<select>` + options | The Donate chevron data-URI, moved into CSS as `bg-[url(...)]`. Always native, for mobile pickers and accessibility |
| `Checkbox.tsx` | `{ name; label: ReactNode; hint?; checked?; defaultChecked?; invalid? }` | 22px `rounded-[7px]`, 1.5px `edge` border. Checked: forest fill with a white Check (stroke 3.5, the About value disc). Focus: `--focus` ring. The label is 15px body, with links in forest underline. Consent and privacy checkboxes use this with `hint` |
| `Radio.tsx` | Same as `Checkbox` | 22px circle; checked is a forest ring with a 10px forest dot |
| `Switch.tsx` | `{ name; label: string /* a full sentence */; hint?; checked; onChange }` | **Admin first.** A 46×28 track, off = white with an `edge` border and an `edge` thumb, on = forest with a white thumb (`shadow-thumb`), 300ms `ease-out-expo`. `role="switch"`. The label is a sentence on the left ("Show this story on the website"), the hint below. **Never a bare toggle** |
| `Segmented.tsx` | Extracted `{ options; value; onChange; label; size?: "sm"\|"md"; skin? }` | Same visual. **Add** roving tabindex and arrow-key support (missing today), and `h-11` for the 44px target in new uses |
| `Chips.tsx` | `{ options: {value,label,icon?}[]; value: string \| string[]; onChange; multiple?; tone?: "coral"\|"clay"\|"forest"; label: string }` | Merges Donate in-kind chips (`aria-pressed`, Check when on, `coral/10` selected) and Appeals filters (`bg-clay` active, `shadow-chip`). For filters on listing pages, single-select chips are links (`aria-current`) so the filter lives in the URL |
| `RadioCards.tsx` (and `CheckCards` in the same file) | `{ name; legend; options: { value; label; description?; icon?: ProgrammeIconName \| LucideIcon; tone?: "default"\|"urgent"; disabled? }[]; value?; defaultValue?; onChange?; columns?: 1\|2\|3; error? }` | Large selectable cards for type of support, cause, donation type and in-kind items. A visually hidden native `<input type=radio>` (peer) gives free keyboard support. Card: white `rounded-control p-5 shadow-card` with a transparent 2px border, `IconDisc` 52px on the left, and title (Nunito 17/700) plus description (14 body). Hover lifts 2px. **Checked:** `border-forest bg-mint/40` plus a forest check badge top-right (24px disc). `tone="urgent"` (child-protection concern) uses a coral-800 border and `ShieldAlert` icon, and its description explains "This opens the confidential concern form". Mobile is always 1 column |
| `FileDrop.tsx` (client) | `{ name; accept: string; maxSizeMb: number; maxFiles?: number; hint?; onFiles?; files?: UploadItem[]; sensitive?: boolean }` | Dashed zone: `rounded-card border-2 border-dashed border-edge bg-cream-2 p-8 text-center`, an `IconDisc` with Upload icon (marigold halo), "Drop files here or **choose from your phone**", then accepted types and max size in Inter 13 body. Drag-over: `border-forest bg-mint/40`, with the disc doing `pi-pop`. `sensitive` adds a `Lock` line: "Only the officer handling your request can open these files." Below are file rows: white `rounded-tile` row with file icon, name (truncate), Inter size, a `ProgressBar tone="forest"` while uploading, and a remove `IconButton`; per-file errors are inline in coral-800. The whole zone is a `<label>` for the hidden input, so it is one big tap target on phones |
| `Stepper.tsx` (client) | `{ steps: { id; label }[]; current: number; onStepClick?: (i) => void /* only completed steps */ }` | **Desktop:** numbered discs (40px) joined by a 2px `line` connector that fills marigold up to the current step. Done = forest disc with a white Check. Current = forest disc with an Anton numeral and a `pulse-ring` halo. Upcoming = white disc, `edge` border, body numeral. Labels below in Nunito 14/700. **Mobile:** "Step 2 of 4 · Your details" in Nunito 15/700 plus a `ProgressBar tone="forest"`. Step bodies swap with `animate-[hero-rise_0.6s_var(--ease-out-expo)_both]` (Donate's pattern), focus moves to the step heading, and `aria-live` announces "Step 2 of 4". Pair it with `lib/forms/useStepper.ts` (`{ step, next, back, goTo, isLast }`), which validates the current step before `next` |
| `SubmitButton.tsx` (client) | `ButtonProps & { pendingLabel?: string }` | Uses `useFormStatus()`: shows `loading` and `pendingLabel` ("Sending securely…") and disables while pending |
| `ErrorSummary.tsx` (client) | `{ errors: FieldErrors; title?: string }` | Shown on a failed submit, at the top of the form. `rounded-control border-2 border-coral-800 bg-coral-100 p-5`; title in Nunito 800 18 coral-800 ("There's a problem"), then a list of anchor links to `#${name}`. It receives focus (`tabIndex={-1}`); `role="alert"` only on first render |
| `FormSuccess.tsx` | `{ title: string; reference?: string; message: ReactNode; next?: TimelineItem[]; actions?: ReactNode; tone?: "coral"\|"forest" }` | Generalised from Donate's done state. A 64px disc (forest for support and contact, coral for donations) with a `pulse-ring` and a heartbeat `Heart` (or `ShieldCheck` for concerns). Title in Anton 34 uppercase. Reference chip: Inter tabular, `bg-sand text-umber` ("Your reference: HV-26-0142"). A "What happens next" `Timeline`. `role="status"`. Focus moves to the title |
| `AmountPicker.tsx` (client) | `{ currency; amounts: number[]; min: number; value; onChange }` | Extracted from Donate: a 3-column amount grid (`h-12 rounded-full border-mist`, selected `border-coral bg-coral/10 text-coral-800`) plus the "Other" input. Used by `/donate` and the cause pages |
| `CountrySelect.tsx` | `{ name; defaultValue?; priority?: string[] /* e.g. ["gm","us","gb"] */ }` | A native select of **all** ISO countries (static list in `lib/countries.ts`), with priority codes first. The flag shows beside the closed select through `Flag`, **only** when the code is in `spriteCountries`; otherwise a neutral `sand` disc. Do not grow the sprite for this |
| `DateSlots.tsx` (client) | `{ days: { date: string; slots: string[] }[]; value?; onChange }` | Counselling booking. Day chips scroll horizontally; time slots use `Chips` styling; timezone in Inter 13 body. Native `type=date` only for admin entry |

### 3.4 Feedback, status and safeguarding

**`Notice.tsx`**

```ts
{ tone: "emergency"|"info"|"success"|"warning"|"danger"|"disclaimer"; title?: string; children?: ReactNode; icon?: LucideIcon; action?: ReactNode }
```

| Tone | Visual | Use |
|---|---|---|
| `emergency` | `bg-deep text-white rounded-card p-5`, `ShieldAlert` in marigold, title "If a child is in immediate danger", body `site.emergencyNotice` (default children), white/85. Never dismissible | Report a Concern, Get Support, Child Protection programme, `FormShell` aside, Contact (§7, §11) |
| `info` | `bg-cream border-l-4 border-marigold rounded-2xl` (the vision callout), ink/85 | Process notes ("Submitting does not guarantee support") |
| `success` | `bg-mint`, forest-700 text and icon | — |
| `warning` | `bg-clay-100`, clay-700 icon, ink text | — |
| `danger` | `bg-coral-100`, coral-800 icon and title | — |
| `disclaimer` | `bg-paper rounded-2xl`, italic Nunito 600 forest (the programme `notice` line), `Info` icon | Medical, legal and psychological disclaimers |

`role="note"`. The status tones use `role="status"` only when they appear dynamically.

**`QuickExit.tsx`** (client). The standard safeguarding pattern.

- A fixed pill, bottom-left (ScrollTop owns bottom-right): `bg-night text-white h-12 px-5`, labelled "Leave this site" with `LogOut` icon and a marigold underline.
- Click, or pressing Esc twice, runs `window.location.replace("https://www.google.com/search?q=weather")` and clears form `sessionStorage`.
- Rendered on `/report-a-concern`, `/get-support/**` and the counselling request pages.
- Mobile: a full-width 48px bar pinned to the bottom with safe-area padding.

**`Badge.tsx`**

```ts
{ tone?: "neutral"|"forest"|"marigold"|"clay"|"coral"|"glass"; icon?; children; size?: "sm"|"md" }
```

- `h-7 rounded-full px-3`, Inter 12.5/600.
- `glass` is the Hero `PlaceChip` (white/15, ring, blur; flag optional).
- Used for categories, "Public · PDF 2.4 MB", "AI draft" and similar.

**`StatusPill.tsx` and `lib/status.ts`**

```ts
export type Workflow = "support" | "concern" | "donation" | "inkind" | "resource" | "volunteer" | "partnership" | "counselling" | "post";
export type StatusTone = "new"|"review"|"waiting"|"active"|"referred"|"approved"|"done"|"declined"|"closed"|"urgent"|"restricted";
export const STATUS: Record<Workflow, readonly { id: string; label: string; tone: StatusTone }[]>;  // ordered = journey order
<StatusPill workflow="support" status="more-info" />  // label + tone resolved from STATUS
```

Tone visuals: `h-7 rounded-full px-3 gap-1.5`, Inter 12.5/600. **Colour is never the only signal**: every pill shows its words, plus a dot or icon.

| Tone | Background / text | Marker | Text contrast |
|---|---|---|---|
| `new` | `marigold-100` / `umber` | Marigold dot, pulses (`pulse-ring`) | 10.7 |
| `review` | `sand` / `cocoa` | Cocoa dot | 6.0 |
| `waiting` | `clay-100` / `clay-700` | `Clock` 12px | 5.1 |
| `active` | `mint` / `forest-700` | Forest dot | 6.2 |
| `referred` | white + `ring-1 ring-forest/40` / `forest-700` | `ArrowUpRight` | 7.5 |
| `approved` | white + `ring-1 ring-forest/40` / `forest-700` | `Check` | 7.5 |
| `done` | `forest` / white | `Check` | 5.9 |
| `declined` | `coral-100` / `coral-800` | `X` | 4.7 |
| `closed` | `pebble` / `body` | None | 5.8 |
| `urgent` | `coral-800` / white | White pulsing dot | 5.4 |
| `restricted` | `night` / `marigold` | `Lock` | 9.8 |

The full workflow-to-tone mapping is in the appendix.

**`Toast.tsx`** (client): `ToastProvider` in the `(site)` and admin layouts, plus `useToast()`.

```ts
toast({ title: string; description?: string; tone?: "default"|"success"|"danger"; action?: { label: string; onClick: () => void } })
```

- `bg-night text-white rounded-[20px] px-5 py-4 shadow-float`, with the icon in marigold (success: a check in a mint disc).
- The action ("Undo") is a marigold text button.
- Enters with `hero-rise` 0.5s, exits as a 200ms fade. Auto-dismisses after 5s, or 10s with an action. Pauses on hover and focus.
- Position: bottom-centre on mobile, above the tab bar (admin) or QuickExit (site); bottom-left on desktop, clear of ScrollTop.
- `aria-live="polite"` region. At most 3 stacked.

**`Skeleton.tsx`**

```ts
{ className; shape?: "text"|"block"|"circle" }
```

- `bg-[#ece7dd]` (a warm stone, deliberately not grey) with a 1.6s cream highlight sweep (linear-gradient + `background-position` keyframe); static under reduced motion.
- Radius matches the card it stands in for.
- Ready-made shapes: `SkeletonCard`, `SkeletonRow` and `SkeletonHero` for `loading.tsx` files.

**`EmptyState.tsx`**

```ts
{ title: string; note?: string /* Caveat line */; art?: "hands"|"hearts"|"doodle"; action?: ReactNode }
```

Centred, `py-16`:
- Art: `HandDoodle`, `HeartCluster` in `text-mist`, or a cropped `DoodleField`, at 120px.
- Title: Nunito 800 22 ink.
- Note: Caveat 24 in `marigold-ink`, for example "Nothing waiting for you right now."
- One Button.

**`Spinner.tsx`.** A 16–20px `Heart` (filled `currentColor`) with `animate-heartbeat`, plus `sr-only` "Loading". Under reduced motion it becomes the static heart with an ellipsis label.

### 3.5 Overlays

**`Modal.tsx`** (client): `Modal`, plus `ConfirmDialog` in the same file.

```ts
Modal: { open; onClose; title: string; description?: string; children; footer?: ReactNode; size?: "sm"|"md"|"lg" }
ConfirmDialog: { open; onCancel; onConfirm; title; body; confirmLabel; tone?: "danger"|"default" }
```

- Built on the native `<dialog>` with `showModal()`, which gives a focus trap, Esc handling and an inert background for free. Calls `lenis?.stop()` and `start()`. Returns focus to the trigger.
- Backdrop `::backdrop` = `bg-night/60 backdrop-blur-sm`.
- Panel: white, `rounded-card-lg p-7 md:p-8`, `shadow-modal`, max-w 440 / 560 / 760.
- Enters with `scale .96 → 1` and opacity over 400ms `ease-out-expo`.
- Close: the marigold disc pattern, but **night icon on marigold** (9.8:1), rotating 90° on hover.
- `VideoLightbox` should be rebuilt on it.

**`Sheet.tsx`** (client)

```ts
{ open; onClose; title; side?: "right"|"bottom"|"auto" /* auto = bottom <768, right ≥768 */; width?: 480|640; children; footer? }
```

The admin's main surface for opening records.
- **Right:** full height, `bg-cream-2` with a white header strip, slides in over 500ms `ease-out-expo` (the MobileMenu motion).
- **Bottom:** `rounded-t-[30px]`, a 40×4 `mist` drag handle, `max-h-[90svh]`, scrollable body.
- The footer is a sticky action bar (white, top hairline `line`) holding the primary next step.

### 3.6 Navigation and data

**`Tabs.tsx`** (client)

```ts
{ tabs: { id; label; count?: number }[]; value; onChange; variant?: "pill"|"underline"; label: string }
```

- **pill:** the `Segmented` visual. Scrolls horizontally on mobile.
- **underline:** Nunito 16/700. The active tab gets the nav's 2px marigold underline, which slides between tabs by translating a single indicator (500ms `ease-out-expo`). Counts go in a `Badge` (sm, neutral).
- Follows the WAI-ARIA tabs pattern (arrow keys, `role=tablist/tab/tabpanel`).
- For URL-driven sections (resource categories, admin queues) use links with `aria-current="page"` instead of tab roles.

**`Accordion.tsx`** (client). Extracted from Faq.

```ts
{ items: { id: string; title: ReactNode; content: ReactNode }[]; defaultOpen?: string[]; multiple?: boolean; variant?: "card"|"flush"; headingLevel?: 2|3|4 }
```

- **card:** the Faq look (white `rounded-[20px] shadow-soft px-7`, forest chevron).
- **flush:** `border-b border-line` rows and 17/600 titles, for policies, programme eligibility, the mobile TOC and admin.
- Animation stays the `grid-rows` trick at 500ms `ease-out-expo`.

**`Pagination.tsx`**

```ts
Pagination: { page: number; pageCount: number; hrefFor: (p: number) => string }
LoadMore:   { href: string; label?: string; remaining?: number }
```

- **Public lists** (news, stories, resources) use `LoadMore`: an `outline` Button "Show more stories (12)" that links to `?page=n+1`. It works without JS; with JS it is a client `router.push` with `scroll:false`.
- **Admin lists** use `Pagination`: 40px round buttons, current = forest filled, others white with a `line` border, plus prev/next `IconButton`s and Inter 14 "21–40 of 133".

**`DataList.tsx`** (client). The DataTable-lite.

```ts
type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode; priority: 1 | 2 | 3; align?: "start"|"end"; sortable?: boolean; width?: string };
type DataListProps<T> = { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void;
  selectable?: boolean; selected?: string[]; onSelect?: (ids: string[]) => void; empty: React.ReactNode; loading?: boolean; caption: string };
```

- **≥ md:** a real `<table>` in a white `rounded-card` with `shadow-soft`.
  - Header row: Inter 12/600 uppercase, tracking 0.06em, body colour, on `bg-[#faf8f3]`.
  - Rows: 56px, `border-b border-line`; hover `bg-cream`; selected `bg-mint/40`.
  - Shows columns of priority 1–3. Sort buttons sit in the headers with `aria-sort`.
- **< md:** each row becomes a stacked card row (no horizontal scroll) showing only priority 1 and 2 cells: line 1 = name (Nunito 16/700) + `StatusPill` right; line 2 = meta in Inter 13 body.
- Bulk selection reveals a sticky bottom action bar.
- `loading` renders `SkeletonRow` × 6. `empty` renders the `EmptyState` passed in.

**`SearchField.tsx`**

```ts
{ name; placeholder; defaultValue?; onSearch?: (q) => void; size?: "md"|"lg" }
```

A pill input with a leading `Search` icon and a clear `X` IconButton, debounced at 250ms. Used on listings, in the admin queues and in `SearchOverlay`.

**`IconButton.tsx`**

```ts
{ icon: LucideIcon; label: string /* aria-label, required */; variant?: "forest"|"marigold"|"outline"|"ghost"|"white"; size?: 40|44|48|56; href? }
```

Consolidates the round discs used across the site:
- `forest` = the carousel arrows (hover marigold with night icon)
- `marigold` = the search and close discs, but with a **night** icon
- `outline` = the Testimonials arrows

The minimum size is 44px except in dense admin rows (40px).

**`Avatar.tsx`**

```ts
{ name: string; size?: 28|36|44 }
```

Staff only, **never beneficiaries**. A disc with initials (Nunito 800). The background rotates through `forest`, `clay`, `cocoa` and `deep` with white text, or `marigold` with night text, chosen by a name hash. Avatar stacks overlap by −8px with a 2px white ring.

**`Timeline.tsx`**

```ts
type TimelineItem = { title: string; body?: ReactNode; time?: string; tone?: StatusTone; icon?: LucideIcon };
{ items: TimelineItem[]; variant?: "process" | "activity" }
```

- **process** (public "How the process works", form asides, "What happens next"): a vertical 2px `line` rail with 36px forest discs carrying Anton numerals "01", "02" (the Journey device), titles in Nunito 17/700 and body text in 15 body. In-view, each disc pops (`pi-pop`).
- **activity** (admin case log): 10px tone dots on a hairline rail, actor and action in Nunito 15 ("**Fatou** moved this to *Assigned*"), time in Inter 13 body, relative with an absolute `title`.

**`ShareRow.tsx`** (client)

```ts
{ url: string; title: string; text?: string }
```

- The Header social discs (46px, `border-line`, hover forest), for WhatsApp, Facebook, X and LinkedIn.
- Plus a "Copy link" pill that toasts "Link copied".
- Uses `navigator.share` when available (mobile) as the first button "Share…".
- Used on `/donate/[cause]`, articles and stories.

**`AllocationBar.tsx`.** Answers "where your money goes" on donate and programme pages, and appears in admin allocation.

```ts
{ parts: { label: string; percent: number; tone: "forest"|"marigold"|"clay"|"cocoa"|"coral-800"|"deep"; note?: string }[]; amount?: { value: number; currency: Currency } }
```

- A 14px pill bar of segments with 2px white gaps. It fills from the left in-view, 1.4s `ease-out-expo` with a stagger.
- Legend below: tone dot, label in Nunito 15/700, the percentage in Inter tabular. With `amount`, each row shows the money ("GMD 1,500 · school fees").
- Labels sit directly beside their data, with no hover-only tooltips. It also renders as a visually hidden `<table>`.

### 3.7 Cards (`components/ui/cards/*`)

Extracted from the landing sections with explicit props. The base is `Card.tsx`:

```ts
{ as?: "article"|"div"|"li"; tone?: "white"|"cream"|"paper"|"mint"|"sand"; pad?: "sm"|"md"|"lg"; radius?: "tile"|"card"|"card-lg"; interactive?: boolean; href?: string }
```

- `interactive` adds `hover:-translate-y-1.5 hover:shadow-card-hover` over 500ms `ease-out-expo`, and `group`.
- When `href` is set, the whole card is one link: the title link is stretched with `after:absolute after:inset-0`, so there are no nested links.

| Card | From | Props | Use |
|---|---|---|---|
| `ProgrammeCard` | Programmes | `{ programme: Programme; href; cta? }` | Icon-tab card |
| `ServiceCard` | New, compact | `{ icon; title; text }` | `IconDisc` 52, left-aligned, paper-friendly. Programme "Support provided" |
| `CauseCard` | Appeals | `{ title; season?; place?; image; raised; goal; currency; tone; href }` | Progress, flag chip, `%` badge. The `%` badge text uses night on marigold or white on `coral-800`/`clay` |
| `ArticleCard` | News | `{ title; date; category; image; href; excerpt? }` | — |
| `ResourceCard` | New | `{ title; cover; date; category; summary; access: "public"\|"request"; file?: { size; type } }` | Cover at 3:4 `rounded-tile`, with the category painted on a marigold `label` brush (night text) at bottom-left of the cover. Meta row (CalendarDays + Tag, marigold-ink icons). Title 19/600, 3-line summary. **Public:** "Download PDF · 2.4 MB" (`forest` button, `Download` icon). **On request:** a `Lock` badge "Available on request" + "Request full report" (`outline`) |
| `StoryCard` | Stories mobile card | `{ image; label; meta; place; text; href? }` | — |
| `PersonCard` | Team | `{ name; role; image; socials }` | Arch card |
| `StatCard` | Impact | `{ label; value; suffix?; note; tone: "clay"\|"marigold"\|"cocoa"\|"forest"; size?: "lg"\|"sm" }` | `sm` is the admin and Today size: `min-h-[140px]`, Anton 40 |
| `ActionCard` | Duo | `{ title; text; cta; href; image; tone: "forest"\|"charcoal"\|"clay" }` | Photo card, grayscale with tinted overlay, strokes on hover. Used for the programme "Request support / Support this programme" pair and for Get Involved |

### 3.8 Implementation order

1. Tokens (§1.8), then `SkipLink`, then the `(site)` layout move.
2. `Section`, `BrushEdge`, `SectionIntro`, `PageHero` and `Breadcrumbs`.
3. `CtaBand`, `Notice` and `QuickExit`.
4. The form kit: `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `RadioCards`, `ErrorSummary`, `SubmitButton`, `FormSuccess`, `Stepper` and `FileDrop`.
5. `Prose`, `Toc`, `PolicyShell` and `Accordion`.
6. The cards, `LoadMore`, `Chips` and `ShareRow`.
7. `Modal`, `Sheet`, `Toast`, `Skeleton` and `EmptyState`.
8. Admin: `StatusPill`, `DataList`, `Tabs`, `Timeline`, `Avatar`, `Switch` and `Pagination`.

---

## 4. Inner-page layout rules

### 4.1 App structure

Route groups are only organisational. A single root layout is kept, so navigating between groups never forces a full reload.

```
app/layout.tsx            fonts, globals.css, <noscript> reveal fix, ToastProvider (no Lenis here any more)
app/(site)/layout.tsx     <SkipLink/> <SmoothScroll> <Header/> <main id="main" tabIndex={-1}>{children}</main> <Footer/> <ScrollTop/> </SmoothScroll>
app/(site)/page.tsx       the current landing page minus Header/Footer/ScrollTop
app/(site)/<routes>/…     inner pages (route list owned by the IA doc)
app/admin/…               Haven Desk; its own layout, native scroll, no Footer
app/not-found.tsx         unmatched URLs render inside the ROOT layout only, so this file renders
                          <SiteChrome><NotFoundBody/></SiteChrome> itself (Header + Footer)
app/(site)/**/not-found.tsx  notFound() inside site segments → <NotFoundBody/> only (chrome comes from the layout)
```

**`NotFoundBody`** (`components/layout/NotFoundBody.tsx`):
- `paper` background, `HandDoodle`.
- Caveat in `marigold-ink`: "This page wandered off".
- `DonatHeading` "We Couldn't Find That Page".
- Buttons: Home (`forest`), Get Support (`outline`). A small `Notice tone="emergency"`.

`error.tsx` uses the same layout ("Something went wrong on our side", plus a Try again Button).

**Lenis and route changes.** In `SmoothScroll`, add an effect on `usePathname()`:
- If there is no hash, call `lenis.scrollTo(0, { immediate: true })`.
- Then `ScrollTrigger.refresh()`.

Without this, Lenis's internal scroll target can lag behind Next's scroll reset.

### 4.2 Header site-wide

- **One `Header`.** The info bar, hanging pill, sticky drop and glass behaviour stay identical on every public page. Donat keeps the same chrome on inner pages, and the brand recognition comes from it.
- **Real routes.**
  - Logo `href="/"`. On `/`, the click scrolls to the top through Lenis.
  - The shield disc goes to the Report a Concern route. Donate goes to `/donate`.
  - In-page CTAs on the landing page keep their hashes (`#donate` stays on home, because the landing donate card is still the fastest gift). Elsewhere, "Donate" means `/donate`.
- **Active state.**
  - `usePathname()` matches against `item.match` prefixes.
  - The active top-level item gets `aria-current="page"` (a child route gets `aria-current="true"`) and a **persistent** marigold underline (the existing `after:` bar at `scale-x-100`).
  - Its text stays white. Never mark the active item by marigold text on forest (3.09:1).
- **Close on navigate.** NavDropdown and MobileMenu close on pathname change (an effect), not only on click.
- **Link pending feedback.** For dynamic destinations without `loading.tsx`, show `useLinkStatus()` as a fixed-size marigold 2px bar under the pill. Prefer a `loading.tsx` per dynamic segment.
- **Nav config** (`content/nav.ts`, replaces the current types):

```ts
export type NavLink = { label: string; href: string; description?: string; icon?: ProgrammeIconName | "shield" | "book" | "heart" | "users" | "file"; urgent?: boolean };
export type NavFeature = { eyebrow: string; title: string; text: string; cta: { label: string; href: string }; tone: "forest" | "deep" | "clay"; image?: string };
export type NavItem = {
  label: string; href: string; match?: string[];       // prefixes that make this item active
  children?: NavLink[];                                // simple dropdown (250px list)
  mega?: { columns: { title?: string; links: NavLink[] }[]; feature?: NavFeature };
};
```

- **Mega panels.** Extend the existing programme mega, keeping its 300ms open timing, the 60ms + i×35ms row stagger and the white `rounded-3xl` `shadow-float` panel.
  - Width 880px: link columns on the left (`IconDisc` 52 with halo, title 15/800 ink, description 13 body) and a 260px **feature card** on the right (`rounded-card`, tone background, `Brush drip` corner, Caveat eyebrow, Nunito 800 title, one Button).

| Top item | Columns | Feature card |
|---|---|---|
| About Us | Who we are · Our team · Partners · Stories of hope · Safeguarding commitment | Founder quote (cream-on-forest) → Our story |
| Our Programmes | The six programmes (existing grid) + "All programmes" | "Not sure which programme fits? Request support" (forest) |
| Get Support | Request support · **Report a concern** (`urgent`: coral-800 `ShieldAlert` disc, label coral-800) · Book counselling · FAQs | Emergency notice (deep, `Notice` copy). This feature is mandatory |
| Resources | The ToR §9 categories in 2 columns · Request a report · Annual reports | The latest report cover → Read |
| Get Involved | Volunteer · Partner with us · Sponsor a programme · Give in kind | Volunteer photo card (clay) |
| Our Impact, Contact | Plain links | — |

- **Fit at 1280px.** Two more chevrons (About, Resources) add about 38px. Run `node scripts/qa/nav-fit.mjs`. If it fails, show "Home" only from 1400px (`min-[1400px]:block`); the logo stays the home link.
- **Mobile menu.** Same config.
  - Mega columns flatten into the existing accordion, with the column titles as small Inter 12 uppercase white/60 group labels.
  - The `urgent` link gets a coral-800 disc icon.
  - New: a **"Need help now?"** pair at the very top of the panel (Request Support `marigold-ink`, Report a Concern `outline-light`) for vulnerable visitors on phones.
  - The current page row gets a marigold left bar and `aria-current`.
- **Search.** `SearchOverlay` suggestions become links to routes. Results render as `ArrowLink` rows on deep, from a static index the content doc defines.

### 4.3 Footer

- Reused on every public page from the `(site)` layout. Not used in the admin.
- Change its hard-coded `#support` and `#donate` hrefs to routes. Point `footerLinks.legal` at real routes; "Administrator Login" goes to the admin login, kept low-key.
- Drop `id="contact"` from the `<footer>` once `/contact` exists.
- **Rule:** the section before the Footer always has `last` clearance (§3.1). The best pairing is `CtaBand` (deep), since deep into night under the torn edge reads as one dark mass.

### 4.4 Page templates

Each row lists the order of components on the page.

| Template | Pages | Structure |
|---|---|---|
| **Index** | About, Programmes, Get Involved, Impact, Resources | `PageHero photo` → paper `Section` with `SectionIntro` + card grid (`ProgrammeCard`, `ActionCard`…) → one VU chapter (e.g. `StatCard` row on vu-cream, or Stories capsules) → white `Section` (FAQ `Accordion card` or testimonials) → `CtaBand` |
| **Programme** (ToR §5, 9 parts) | `/programmes/[slug]` | 1. Overview: `PageHero programme` + white `Section` split (BrushReveal `patch` photo + copy, like About). 2. Problem: vu-cream `Section` with `VuHeading` and up to 3 verified `StatCard sm` (omit if unverified). 3. Support provided: paper `Section` with `ServiceCard` grid (3 columns at xl). 4. Eligibility: white two-column check list (About value discs) + `Notice info` "Submitting a request does not guarantee support". 5. How the process works: `Timeline process` (horizontal Journey-numeral cards from lg, vertical below). 6–7. Request support / support this programme: `ActionCard` pair (forest + clay). 8. Related resources: 3 `ResourceCard` + `ArrowLink` "All resources". 9. Programme contact: cream contact card (role, email, phone; no staff photo required). Disclaimers via `Notice disclaimer` in the hero and again above part 6. Child Protection uses `Notice emergency` instead |
| **Form** | Request Support, Report a Concern, Volunteer, Partner, Contact, Request a Report, Counselling, In-kind | `PageHero plain` (with `notice` where safeguarding applies) → white `Section` (`cv={false}`) → `FormShell` (`Stepper` if the form has more than 6 required fields, otherwise a single page with `Fieldset` groups) → success replaces the form in place (`FormSuccess`) and scrolls to it. **No `CtaBand`** after sensitive forms; a quiet paper `Section` with three `ArrowLink`s instead. `QuickExit` on safeguarding forms |
| **Policy** | Safeguarding, Privacy, Terms, Accessibility | `PageHero plain` (meta: last reviewed, version; action: Download PDF `outline`) → white `Section` `PolicyShell` → `CtaBand variant="safeguarding"` |
| **Listing** | News, Stories, Resources, Projects | `PageHero photo` (short, `min-h-[320px]`) → paper `Section`: `Chips` category filter (URL links) + `SearchField` → card grid (`md:2 xl:3`, gap-7, `gap-y-10`) → `LoadMore`. Empty filter: `EmptyState` |
| **Article** | `/news/[slug]`, `/stories/[slug]`, `/resources/[slug]` | `PageHero article` → white `Section width="reading"` `Prose` → `ShareRow` → paper `Section` "Keep reading" with 3 `ArticleCard` → `CtaBand` |
| **Donate** | `/donate`, `/donate/[cause]` | Owned by the donations doc. Visually: a VU-led page (coral or vu-cream). `RadioCards` for the cause (with `IconDisc`), then `AmountPicker` + `Segmented` frequency, then `AllocationBar` ("where it goes"), then the Stripe step. The card look is the landing donate card at `max-w-[560px]`, with a side column of `AllocationBar` + impact equations on desktop |

### 4.5 Section rhythm and spacing

- **Alternate tones.** Two adjacent sections never share a background unless they are deliberately joined (like the Duo half-split).
- **Default inner-page sequence:** hero → paper → white → (vu-cream VU chapter) → white or paper → `CtaBand` deep → Footer.
- **Brush edges.** At most 2 brush edges per page, besides the hero's and the footer's. The edge colour is always the neighbouring section's tone.
- **Measures.**
  - Grids: `wrap` (1330).
  - Full-bleed media bands: `wrap-wide`.
  - Prose: `max-w-reading` (720).
  - Forms: `max-w-form` (760).
  - Intro paragraphs: `max-w-[600px]`, centred.
- **Vertical rhythm.** Inside sections: eyebrow → heading `mt-4`, heading → intro `mt-4` or `mt-5`, intro → content `mt-10` (forms, prose) or `mt-14` (grids). Cards with an icon tab need `mt-24` (the tab overhangs).
- **Grids.**
  - Cards: `md:grid-cols-2 xl:grid-cols-3 gap-7`.
  - Services: `sm:2 xl:3 gap-5`.
  - Admin task cards: `sm:2 lg:3 gap-4`.
- **Motion budget per inner page.**
  - `Reveal` only on section intros and card grids (stagger 0.08–0.12).
  - One signature moment at most: a `BrushReveal` photo or a self-drawing art piece.
  - No GSAP pins.
- **Images.** Inner pages reuse the existing media through `img()`, and new imagery follows the people mix and family rules in `HANDOFF.md`:
  - about 1/3 Black, otherwise South and Southeast Asian and Arab, never white
  - families are a mother and a father with their children
  - children are always dignified
  - no school crests
  - no faces on the sensitive form pages: use hands, environments or illustration

### 4.6 View transitions

Use React `<ViewTransition>` (no config needed in 16.3; `02-guides/view-transitions.md`).
- In `app/(site)/layout.tsx`, wrap `{children}` in `<ViewTransition enter="page-in" exit="page-out" default="none">`. The fade out takes 150ms; the fade plus 12px rise in takes 300ms `ease-out-expo`. Header and Footer sit outside it, so they persist.
- Add at most two shared-element morphs, both with `share="morph" default="none"`:
  - `ArticleCard` image → article hero cover
  - `ProgrammeCard` icon → `PageHero` programme icon tab
- Add the docs' reduced-motion rule to `globals.css`: zero the duration and delay of `::view-transition-*`.

---

## 5. Admin visual language: "Haven Desk"

Flows and information architecture belong to the admin UX doc. This section fixes how the admin **looks and feels** so it is unmistakably Haven, and calmer.

### 5.1 Principles

1. **Same brand, quieter voice.**
   - Same tokens and fonts, same pill buttons, same forest and marigold.
   - None of the theatre: no brush splashes behind data, no scroll reveals, no counters, no auto-playing media, no Lenis, no GSAP.
2. **Sentences, not settings.**
   - Every card says what needs doing ("3 new support requests are waiting for a first look") and offers one verb button ("Start reviewing").
   - Switches carry full-sentence labels.
   - No screen shows more than 5 controls in a group.
3. **A desk, not a dashboard.**
   - **No left sidebar.** No grid of charts on the home screen, no grey-and-blue scheme, no dense icon-only toolbars.
   - The home screen is **Today**: a greeting and a short list of tasks.
   - Reports (charts) live on their own page.
4. **Thumb-first.** Everything works one-handed at 375px: bottom tab bar, bottom sheets and a sticky action bar for the next step.

### 5.2 Surfaces and chrome

- **Page background:** the `paper` utility, the same texture as the public programme section. Content max width is 1180px, centred. There are no full-bleed tables.
- **Surfaces:** white cards, `rounded-control` (22px), `shadow-soft`, padding 20–24px (the public site uses 28–40).
- **Lists:** white `rounded-card` (`DataList`).
- **Desktop top bar (≥1024px)**
  - White, 64px, `shadow-bar` once scrolled.
  - Left: the `HavenMark` (32px) and the word "Desk" in Caveat 26 `marigold-ink`.
  - Centre: a **forest pill nav**, the same object as the public header pill but 48px tall, with 4–6 role-filtered destinations. Recommended set: Today · Inbox · Giving · Website · People. Labels are Nunito 15/600 white; the active one has the marigold underline.
  - A **Safeguarding** destination is shown only to that role, as a separate `deep` pill with a `ShieldAlert` icon.
  - Right: search `IconButton` (marigold, night icon), a "+ New" Button (`marigold-ink`, sm: new post, update, donation record or upload), and the `Avatar` menu.
- **Mobile**
  - Slim 56px top bar: mark and page title, plus the avatar.
  - **Bottom tab bar:** 64px plus the safe area, white, top hairline. Five slots: Today · Inbox · **+** (56px marigold disc with a night `Plus`, raised by 12px) · Website · More.
  - Each tab is a lucide icon 22px with an Inter 11/600 label. Active is forest with a 4px marigold dot.
  - "More" opens a bottom `Sheet` listing the remaining destinations as big `ArrowLink` rows.
- **Environment ribbon.**
  - When data comes from the local `.data/` fallback, a 28px `sand` strip sits above the top bar: "Practice mode: local test data, nothing here is real" (Inter 12/600 umber).
  - Stripe test mode adds "Payments in test mode".
  - Staff must never confuse practice with production.
- **Login.**
  - Split screen. The left half (lg) is a photo with the night gradient and a white `Brush edge`; use adults' hands or caregivers, never an identifiable child. The left half holds the Caveat line "Thank you for showing up for every child."
  - The right half is a white card (`rounded-card-lg`, `shadow-modal`, max 420px) with the `Logo` and a donat-skin form.
  - On mobile the photo becomes a 200px top band with the torn `band` edge.

### 5.3 Density and type in the admin

| Element | Admin | Public (for comparison) |
|---|---|---|
| Page title | Nunito 800, 26 → 32 | 32 → 50 |
| Card title | Nunito 700, 17 | 19–23 |
| UI text | Nunito 15 | 16 |
| Data, meta, case refs, money, dates | **Inter** 14, `tabular-nums` | — |
| Big numbers | Anton 40, only on Today task cards and `StatCard sm` | 64–76 |
| Caveat | Only the Today greeting ("Good morning, Fatou") and empty-state notes, in `marigold-ink` | Eyebrows |
| Controls | `donat` skin, but `h-11` (44px) single-line inputs with `rounded-2xl` (16px). Multi-field admin forms read calmer with a smaller radius. **Buttons stay pills** (the brand signature) | Pill inputs, `h-[52px]` |
| Row height | 56px (44px tap target inside) | — |
| Motion | 150–300ms `ease-out-expo` for sheets, toasts and tab indicators. Hover colour 200ms. No `Reveal`, `Counter`, `BrushReveal`, `levitate` or `marquee` | 0.3–1.8s |

### 5.4 Colour roles in the admin

| Colour | Role |
|---|---|
| Neutral-warm base: `paper`, white, `line`, `ink`, `body`, `pebble` | Most of the screen |
| **forest** | Primary actions, selection, "done" |
| **marigold** | Attention: new items and the "+" button. Focus is forest on light surfaces (`--focus` set by the shell) |
| **coral-800** | Urgent and destructive only |
| **clay, cocoa, sand** | Categorisation and secondary charts |
| **deep and night** | The restricted safeguarding zone |
| Large coral or marigold fills | Nowhere, except the "+" disc and `StatCard`s |

**Restricted safeguarding zone**
- Every page under it starts with a `deep` band (56px) reading "Restricted · Safeguarding officers only" with `ShieldAlert` in marigold.
- Sensitive fields (child's age and location, reporter contact) render **blurred by default** (`blur-sm select-none`) with a "Tap to reveal" `outline` button. Each reveal is written to the activity log, and a toast confirms "Viewed: logged in activity".

### 5.5 Admin-specific components (`components/admin/*`)

These are visual specs; behaviour is in the admin UX doc.

| Component | Visual |
|---|---|
| `AdminShell` | Top bar, tab bar, environment ribbon, `ToastProvider`, `SkipLink`. Sets `--focus: forest` |
| `TaskCard` | White `rounded-control p-5`. Left `IconDisc` 52 (programme icon or lucide in `marigold-100` halo). Anton 40 count + sentence (Nunito 16/700 ink) + one Button sm. The urgent variant (concerns waiting) is a `deep` card with white text and a marigold count, shown only to safeguarding staff |
| `Greeting` | Caveat 32 `marigold-ink` "Good morning, {first}" + Nunito 15 body date + one-line summary ("Two things need you today.") |
| `QueueView` | `Tabs underline` (New · Mine · Waiting · All, with counts) + `Chips` filters + `SearchField` + `DataList`. Desktop ≥1280 can split into a list (420px) and a detail pane; otherwise the detail opens in a `Sheet` |
| `RecordHeader` | `cream-2` header block: case reference (Inter 13/600 umber on sand chip), title (Nunito 800 24), `StatusPill`, assigned `Avatar` stack, and a relative "Updated 2h ago" |
| `StatusJourney` | The workflow as a horizontal `Stepper` (labels in plain words, scrolling on mobile), then a **"Next step"** card with one or two sentence buttons ("Assign an officer", "Ask for more information"). Off-path statuses (Declined, Closed) sit behind a `More` menu with `ConfirmDialog` |
| `NoteThread` | Internal notes in a chat-like style. Staff note = white bubble `rounded-control` with Avatar + name + time; system events in Inter 13 body between them. The composer is sticky at the bottom: `Textarea` + "Add note" Button |
| `SectionPreviewCard` | For "Edit the website". Each landing or page section is a card with a thumbnail (a static screenshot generated by `scripts/qa/shoot.mjs --only <id>`), a plain-language name ("Big welcome slideshow", "Our numbers") and "Edit" → a `Sheet` with fields on the left and a live preview iframe on the right (desktop), or a Preview toggle (mobile) |
| `Composer` (blog and updates) | Title field (Nunito 800, 28, borderless), cover `FileDrop`, editor area with `prose-haven`, and a right rail (desktop) or bottom sheet (mobile) for category, publish date and visibility `Switch`es. An AI draft shows a `Badge tone="marigold" icon={Sparkles}` "AI draft: needs a human read" and cannot be published until a reviewer ticks "I have read and checked this draft" |
| `Charts` (Reports page only) | Earth palette in this order: forest, marigold, clay, cocoa, coral-800, deep. Direct labels, no 3D, no pies with more than 4 slices, light paper background. Numbers in Inter tabular. Every chart has a table fallback |

---

## 6. Accessibility rules

### 6.1 Contrast: known failures and safe alternatives

Ratios were computed with the WCAG 2.x formula against the exact token hex values. AA requires 4.5:1 for normal text, and 3:1 for large text (at least 24px, or at least 18.66px bold) and for UI and graphics.

| Pairing (where it appears today) | Ratio | Verdict | Safe alternative |
|---|---|---|---|
| White text on `marigold` (Button `marigold`, header Donate pills, programme "Learn More", search and close discs with white icons) | 1.91 | Fails everything | **Night text and icons on marigold** (9.80) or umber (6.61) → `variant="marigold-ink"` |
| `marigold` text on white, paper or cream (Eyebrow script, Partners "90K+", Founder "Years of") | 1.91 / 1.69 / 1.80 | Fails, even large | Keep the marigold rules, set the text in **`marigold-ink` #946200** (5.24 white, 4.65 paper, 4.58 vu-cream) → `Eyebrow tone="ink"`. On dark surfaces marigold is fine (9.80 on night, 7.16 on deep) |
| White text on `coral` (`Button vu`, donate submit, Join copy at white/90 = 2.91) | 3.25 | Large text only | **`coral-800` #c03a24** background (5.42) → `variant="coral-ink"`. Or night text on coral (5.75). Note: `coral-700` (3.91) is **not** enough for small text despite HANDOFF's note; it passes large text only |
| `coral` accent text on `vu-cream` (`VuHeading` in Impact and Stories) | 2.84 | Fails, even large | `accentClass="text-coral-800"` (4.74). On white, coral passes large only (3.25) |
| White text on `flame` (`Button flame`, appeal `%` badge) | 3.74 | Large only | White on `coral-800`, or keep flame for large display only |
| `marigold` text on `forest` (nav hover) | 3.09 | Large only | Acceptable as a transient hover. Never use it as the only active-state signal: use the underline bar plus `aria-current` |
| `clay` text on `sand` | 3.87 | Large only | `clay-700` on sand (5.25) |
| `white/75` on `forest` | 4.10 | Fails small | white/90 or more on forest (5.13) |
| `ink/55` placeholder on `field` | 3.70 | Placeholders are not labels | Visible labels always. Placeholders give examples only |
| Disabled Donate button: white on `coral/15` | ~1.2 | Disabled is exempt but illegible | Disabled = `bg-pebble text-body/70` |
| Marigold focus outline on white | 1.91 | Fails the 3:1 focus-indicator contrast | `--focus: forest` on light surfaces (5.89 white, 5.22 paper); marigold on dark (9.80) |
| Form field fill `field` on white (no border) | ~1.1 | Field edge invisible to low-vision users | donat skin: 1.5px `edge` border (3.47 white, 3.08 paper) |

**Pairs that pass and are safe to rely on**

| Pair | Ratio |
|---|---|
| white on forest | 5.89 |
| white on forest-700 | 7.54 |
| white on clay | 4.74 |
| white on clay-700 | 6.42 |
| white on cocoa | 7.35 |
| white on deep, night, umber | 12.6–18.7 |
| ink on marigold | 8.86 |
| night on marigold | 9.80 |
| body on white | 6.79 |
| body on paper | 6.03 |
| body on vu-cream | 5.93 |
| forest on white | 5.89 |
| forest on paper | 5.22 |
| ink/75 on vu-cream | 6.84 |
| white/55 on night (footer legal) | 6.19 |

**Policy**
- Functional UI must pass AA with the alternatives above, with no exceptions. That covers all forms, `Notice`, `StatusPill`, buttons that submit or navigate to help, legal pages and the whole admin.
- The landing page's decorative brand pairings (marigold eyebrows, white-on-marigold marketing buttons, coral VU buttons) are the documented exception from `HANDOFF.md` **until the owner decides**. Applying `marigold-ink` and `coral-ink` to the landing page is a one-line change per usage.

### 6.2 Structure, keyboard and forms

- `SkipLink` first. One `h1` per page. Sections are labelled by their heading `id`. Landmarks: `header`, `nav` (labelled Primary, Mobile, Breadcrumb), `main`, `footer`.
- Every interactive target is at least 44×44px. The donate card's Segmented `h-10` is a known 40px case; new uses `h-11`.
- Custom radio-like controls (`Segmented`, `Chips` single, `Tabs`) implement arrow keys and roving tabindex, or use visually hidden native inputs (preferred: `RadioCards`, `Checkbox`).
- **Forms**
  - Visible labels. Hints before the control. Errors after it, linked by `aria-describedby`, with `aria-invalid`.
  - `ErrorSummary` takes focus on a failed submit. Success takes focus and uses `role="status"`.
  - Validation runs on blur after the first edit, and again on submit; never on every keystroke while typing.
  - Required data is minimal (ToR §15). Sensitive steps say why each item is needed.
- **Dialogs** use native `<dialog>`: focus trapped, Esc closes, focus returns. `MobileMenu` already traps focus.
- **Auto-moving content** (WCAG 2.2.2)
  - Inner pages have **no** auto-advancing carousels.
  - The landing page's Hero, Stories, Testimonials and Appeals auto-advance and pause only on hover. Add a visible pause/play `IconButton` to each **(optional, owner call; recommended)**. The marquees pause on hover (WorldFlags) and stop under reduced motion.
- **Images**
  - Decorative art is `aria-hidden` with `alt=""`.
  - Content photos get descriptive alt text that **never** includes a child's name or precise location (ToR §15).
  - `Flag` is decorative unless labelled.
- **Status and meaning** are never conveyed by colour alone: pills have words, the active nav item has an underline plus `aria-current`, and errors have an icon plus text.
- **Safeguarding UX**
  - `QuickExit` on sensitive pages.
  - The emergency notice is above the fold on Report a Concern, Request Support and the Child Protection programme.
  - Sensitive form drafts persist only in `sessionStorage` (cleared on submit and on quick exit), never `localStorage`.
  - No analytics events carry form contents.

### 6.3 Motion and reduced motion

- **Respect the OS setting everywhere.** The global CSS kill switch already covers CSS animations and transitions. JS-driven motion must check `useReducedMotion()` or `prefersReducedMotion()`: `Ticker`, carousels, GSAP, `AutoVideo`, `Counter` and Lenis already do.
- **SMIL** (`CoralBlob`, `GreenBlobHeart`) is not covered by CSS. Gate it in JS (§2.9).
- **Content is never hidden behind motion.** Reveal states apply only under `no-preference`, and `noscript` un-hides them. Keep it that way for every new attribute-driven effect.
- **Reduced motion means opacity only.**
  - View transitions lose their slide and keep at most an instant swap.
  - `Stepper` step swaps become instant.
  - `Skeleton` stops shimmering.
  - `StatusPill` dots stop pulsing (the global rule does this).
- **No parallax or scroll-scrubbed motion** on inner pages or in the admin. The landing page keeps Focus and Manifesto.
- **Duration ceilings.** Public UI feedback is 500ms or less. Decorative entrances (reveal, brush) take 1.8s or less. Admin is 300ms or less.

---

## 7. Performance rules already learned

1. **`cv-auto` on below-the-fold sections**, which is how the first phone layout stays small. Exceptions:
   - Not on the first section of a page.
   - Not on pinned sections (Focus).
   - Not on elements whose decorations overflow, because paint containment clips them. Put it on an inner wrapper, as the Footer does; `Section` handles this when edges are set.
   - Not on pages with a TOC or in-page anchors (policies, FAQ deep links), because estimated heights (`contain-intrinsic-size: auto 900px`) make anchor jumps land wrong.
   - Set a realistic intrinsic size for short sections, for example `[contain-intrinsic-size:auto_480px]`.
   - `SmoothScroll` already re-measures ScrollTrigger on `contentvisibilityautostatechange`.
2. **Motion runs on IntersectionObserver and CSS, not GSAP.** About 60 ScrollTriggers at startup were too costly on phones.
   - `Reveal`, `Counter`, `ProgressBar`, `BrushReveal`, `.draw-path`, `useInView` and `Timeline` pops all run on IntersectionObserver.
   - GSAP is only for pins and scrubs. At most one per page; **none** on inner pages and none in the admin.
   - Never call `gsap.from()` on elements that also have CSS transitions; they can end at opacity 0.
3. **`AutoVideo` for every background video.** Posters and `src` attach only within 200px of the viewport, because browsers download posters eagerly. `preload="none"`. Lightboxes attach media only when open. No autoplay with sound, ever.
4. **WebP only.**
   - AVIF is disabled in `next.config.ts` because the encoder hung on `story-7`; don't re-enable it without testing every image.
   - `images.qualities` is `[70,75,85]`: 85 for the landing hero, 75 everywhere else.
   - Always pass `sizes`.
   - LCP: the landing hero uses `preload` (the Next 16 replacement for `priority`); `PageHero` uses `loading="eager" fetchPriority="high"`. Every other image is lazy (the default).
5. **Media fingerprinting.**
   - Static media resolve through `img()`, `video()` and `poster()` → `content/media-map.ts` (content-hashed by `scripts/media/fingerprint.mjs`). Never hard-code `/media/...` paths, because the image optimizer caches by URL for at least 4 hours and cannot be invalidated.
   - **CMS uploads follow the same rule:** store them as `<sha256-12>.<ext>` and keep the hashed URL in the record.
   - Configure `images.remotePatterns` for the Firebase Storage bucket host when credentials arrive.
   - For the local fallback, serve uploads from a route and allow them with `images.localPatterns` (`{ pathname: "/uploads/**", search: "" }`).
   - Re-encode uploads to WebP on ingest with `sharp`, which is already a devDependency; move it to dependencies if the ingest runs at runtime.
6. **One sprite for flags** (`Flag`), static SVGs as `<img>` (the world dots), and brush shapes as cached CSS masks (budget 3 per page, §2.8).
7. **Lenis on public pages only.** The admin uses native scroll, and modals, sheets and menus call `lenis?.stop()` and `start()`.
8. **Fonts are fixed:** four families and the weights already loaded through `next/font` (self-hosted). Add no families or weights. Anton is 400 only.
9. **Client boundaries are small.** Sections and pages are server components. Interactivity lives in leaf client components (`Accordion`, `Stepper`, `FileDrop`, `Toast`, `Header`). Heavy admin modules (rich-text editor, charts) load with `next/dynamic` on their own routes.
10. **Third-party scripts.** Stripe loads only on the payment step of `/donate`. No tag managers. Analytics are first-party and privacy-preserving (spec "basic analytics").
11. **QA on every new route** (all support `--url`):
    - `node scripts/qa/overflow.mjs 375 390 768 1280`
    - `node scripts/qa/a11y.mjs 375 <url>`
    - `node scripts/qa/lcp.mjs <url>`
    - `node scripts/qa/shoot.mjs --url <url> [--reduced]`
    - `scripts/qa/nav-fit.mjs` after any nav change
    - Shoot production builds with `next start -p 3100`. The dev server usually runs on 3001 because Optiq holds 3000.

---

## Appendix A. Workflow status → tone mapping (`lib/status.ts`)

| Workflow | Statuses in journey order → tone |
|---|---|
| Support request (ToR §13) | New `new` → Under review `review` → More information required `waiting` → Assigned `active` → Referred `referred` → Approved `approved` → Support in progress `active` → Completed `done` · Declined `declined` · Closed `closed` |
| Concern: status | Same as support request, but every pill sits inside the restricted zone |
| Concern: **risk level** (§7), a separate pill | Immediate risk `urgent` · High: `coral-100`/`coral-800` with an `AlertTriangle` · Medium `waiting` · Low `review` · Not yet assessed `closed`. The text always says "Risk: High" |
| Donation (§13) | Pledged `new` → Pending `waiting` → Received `approved` → Acknowledged `active` → Allocated `referred` → Completed `done` · Cancelled `closed` |
| In-kind offer | Offered `new` → Arranging `waiting` → Received `approved` → Distributed `done` · Declined `declined` · Closed `closed` |
| Resource request (§13) | New `new` → Under review `review` → Approved `approved` → Sent `done` · Declined `declined` · Closed `closed` |
| Volunteer (§13) | Submitted `new` → Screening `review` → Interview `waiting` → Approved `approved` → Onboarding `active` → Active `done` · Inactive `closed` · Declined `declined` |
| Partnership | New `new` → In conversation `review` → Agreed `approved` → Active `done` · Declined `declined` · Closed `closed` |
| Counselling appointment | Requested `new` → Scheduled `active` → Link sent `referred` → Attended `done` · Missed `waiting` · Cancelled `closed` |
| Blog post or update | AI draft `new` (Sparkles icon) → In review `review` → Changes requested `waiting` → Scheduled `active` → Published `done` · Archived `closed` |

## Appendix B. New file checklist

> Phase Q4 (2026-10-11) removed the kit pieces the built site never used: `IconButton`, `Radio`,
> `CheckCards`/`ChoiceCards`, `ServiceCard`, `LoadMore`, `AvatarStack`, `SkeletonCard` and `SkeletonHero`.
> Where this document still names them, the shipped pages use the alternatives noted in code
> (Pagination, RadioCards, plain round buttons). Rebuild one from its spec here if a page needs it.

```
app/globals.css                         + tokens (§1.8), prose-haven, view-transition CSS, skeleton keyframe
app/(site)/layout.tsx                   new; app/(site)/page.tsx (moved landing)
app/not-found.tsx, app/error.tsx        NotFoundBody inside SiteChrome
lib/media.ts                            img/video/poster (re-exported by content/home.ts)
lib/status.ts, lib/forms/types.ts, lib/forms/useStepper.ts, lib/countries.ts
components/layout/  PageHero, CtaBand, FormShell, PolicyShell, SkipLink, NotFoundBody, SiteChrome, MegaPanel
components/art/     BrushEdge
components/ui/      Section, SectionIntro, Breadcrumbs, RiseWords, Prose, Toc, ArrowLink, IconDisc, IconButton,
                    Notice, QuickExit, Badge, StatusPill, Toast, Skeleton, EmptyState, Spinner, Modal, Sheet,
                    Tabs, Accordion, Pagination, DataList, SearchField, Avatar, Timeline, ShareRow, AllocationBar
components/ui/form/ Field, Fieldset, Input, Textarea, Select, Checkbox, Radio, Switch, Segmented, Chips,
                    RadioCards, FileDrop, Stepper, SubmitButton, ErrorSummary, FormSuccess, AmountPicker,
                    CountrySelect, DateSlots
components/ui/cards/ Card, ProgrammeCard, ServiceCard, CauseCard, ArticleCard, ResourceCard, StoryCard,
                    PersonCard, StatCard, ActionCard
components/admin/   AdminShell, TaskCard, Greeting, QueueView, RecordHeader, StatusJourney, NoteThread,
                    SectionPreviewCard, Composer, EnvRibbon, RevealSensitive
Edits (existing):   Button (+3 variants, loading, block), Eyebrow (+tone), Header/NavDropdown/MobileMenu
                    (routes, mega, active state), Footer (routes), SmoothScroll (pathname reset),
                    VideoLightbox (on Modal), content/nav.ts (new types)
```
