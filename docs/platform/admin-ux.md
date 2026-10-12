# Haven admin: experience design

**Scope:** everything Haven staff see behind `/admin`: navigation, every screen, interaction patterns, components, copy, motion, mobile behaviour, role visibility and the sign-in page.

**Reads with:**
- `docs/CLIENT-SPEC.md`: §6–§15 and the owner's direction at the bottom, which overrides the spec.
- The sibling platform docs (architecture, data, auth, payments, content), which own storage, sign-in internals, Stripe and the public site. This doc owns what staff see and touch, plus the UI-facing contracts in §4.5 and §7. If a sibling doc names a type or field differently, keep the sibling's name and adapt the contract here. The behaviour described here stands either way.

**Next.js:** this is 16.3.6. Every Next-specific rule below was checked against `node_modules/next/dist/docs/` (paths are cited inline).

---

## 0. Decisions at a glance

1. **Concept: "Front Desk".** Staff land on **Today**, triage everything new in one **Inbox**, and do deeper work in **Places**: Requests, Giving, Counselling and so on.
   - On desktop, places sit in a forest-green pill bar like the public site's. On phones they sit in a bottom dock.
   - There is no sidebar anywhere.
   - **Find** (Ctrl/Cmd+K) is a shortcut for confident users. It is never the only way to reach something.
2. **Separate root layout.** The admin has its own root layout, `app/(admin)/layout.tsx`: same fonts and tokens, but no Lenis and no GSAP. Every admin URL starts with `/admin`.
3. **"Next step" rows.** Every list row shows the record's single most likely next action as a button, for example "Say thank you", "Take it" or "Approve and send".
4. **No toggle switches.** A choice is one of three things:
   - a two-option segmented control with plain labels,
   - choice cards, each explaining its consequence in one sentence,
   - a sentence-style checkbox.
5. **Editing happens in sheets.** A sheet is a right-hand panel on desktop and a bottom sheet on phones. Website content sheets are **generated from schemas**, so six engineers ship identical editors.
6. **Website editing in context.** The studio shows the real public page in an iframe in Draft Mode.
   - Click a section and its sheet opens.
   - Drafts save automatically.
   - "Put changes live" publishes everything waiting, with a readable list of changes.
7. **One stepper for all statuses.** A single `StatusStepper` is driven by workflow maps in `lib/admin/workflows.ts`. They encode §13 exactly, plus the Haven-defined flows for concerns, sessions, partners and messages.
8. **Safeguarding is its own locked place.**
   - It looks different and asks you to confirm it's you before entering.
   - A concern's details never appear anywhere else: not in Inbox previews, search, notifications, emails, AI input or activity sentences.
9. **One permission matrix.** `lib/admin/access.ts` drives the nav, Today, Find and the quick actions. More importantly, it drives the server-side checks in every data function and server action.
10. **Undo over confirm.** Reversible actions happen at once and show a toast with Undo. Staff are asked to confirm only when an action sends an email, puts something live, exports personal data, changes someone's access, or can't be undone.
11. **Practice mode.** On the local `.data/` fallback, the admin runs end to end with:
    - seeded demo records;
    - one-tap sign-in as each role (dev only);
    - an Outbox that holds emails instead of sending them;
    - a sand ribbon saying all of this.
12. **Phones are first class.**
    - Every screen works at 360px wide.
    - The Inbox supports swiping.
    - The main action sits in a sticky bar within thumb reach.
    - Tap targets are at least 44px and body text is 16px.
13. **Same brand, calmer.**
    - Cream canvas, white cards and forest as the primary colour.
    - Marigold signals attention. Coral is used **only** for urgent items.
    - Caveat appears only in greetings.
    - Admin meets **WCAG AA** throughout, so marigold buttons carry night text.
14. **Freshness by polling.** A "pulse" poll runs every 30 seconds while the tab is visible. There are no live database listeners, so it behaves the same on Firebase and on local JSON.
15. **Guarded AI writing helper.**
    - It only ever sees public-safe input: published updates, verified figures and planning notes.
    - What it writes is always a draft, with a "Things to check" list.
    - A named person signs it off before it goes live.

---

## 1. Who this is for, and the rules that follow

**The people.** A small team split between The Gambia office and the California office:
- programme officers;
- one finance person;
- counsellors, some of them external professionals;
- one person looking after content;
- the founder.

They live in WhatsApp and email, not in dashboards. Many work from mid-range Android phones on patchy data in the field. Some are older, and for some English is a second language.

**What they handle.** Children, abuse concerns, and medical and legal matters. The interface has to make the safe choice the easy one.

**Design rules** (each one is a test in review):

1. **Start with people, not tables.** Today says what needs you, in sentences. Tables appear only where comparing rows is the job (the Giving ledger, Activity).
2. **One obvious next step.** Each screen has one primary button and each row has one next-step button. Everything else sits under "More" (⋯).
3. **Calm by default, loud only for danger.** Coral means urgent and nothing else. Errors are explained in words, never shown as red walls.
4. **Never lose work.**
   - Drafts save themselves.
   - Text in the composer survives going offline and reloading (stored per record in `localStorage`).
   - Reversible actions offer Undo.
5. **Say what will happen.** Every choice describes its effect: "People must ask first, and we approve each request."
6. **Safe by design.**
   - Contact details are masked unless you look after the record.
   - Restricted areas look different.
   - Email subject lines stay general.
   - A photo of a child cannot go live until consent is recorded.
7. **Same everywhere.** One stepper, one timeline, one sheet, one list row and one empty state, used by every area.

**The no-toggle rule in practice**

| Instead of… | Haven uses |
|---|---|
| Toggle "Public" on a report | Two choice cards: **Anyone can download it** / **People must ask first** (we approve each request) |
| Toggle "Anonymous" on a gift | Segmented control: **Show their name** / **Keep them anonymous** |
| Toggle "Active" on a slide | Segmented control: **Showing** / **Hidden** |
| A grid of notification switches | Sentence rows: "Email me about new requests: **Straight away · Morning summary · Don't email**" |
| Toggle "Auto receipt" | Two choice cards: **Send thank-you emails automatically** / **I'll send each one myself** |

---

## 2. Three navigation concepts

### 2.1 Concept A: "Front Desk" (Today + Inbox + Places)

**Mental model:** a charity's front desk. Someone greets you and hands you the pile of new things, and you walk to the right room for deeper work.

```
 Today ──► Inbox (everything new, one queue) ──► the record opens beside the list
   │
   └─► Places: Requests · Safeguarding · Giving · Counselling · Reports · People · Website · Posts · Photos · Team
        Desktop: forest pill bar      Phone: bottom dock + Places sheet      Anywhere: Find (Ctrl K)
```

**Pros for Haven's staff**
- There is one place to look ("What's new?"), which is how small charities already work out of a shared inbox.
- Splitting triage (Inbox) from casework (Places) matches the spec's workflows: a request is reviewed, then managed.
- Records open next to the list on desktop and as a pushed page on phones. Both patterns are familiar from email apps.
- The design degrades gracefully: a counsellor's Today and dock show only their sessions.

**Cons**
- It needs a unified "inbox item" shape across nine record types (§4.5).
- An inbox can become a guilt pile. This is mitigated by the "Later" snooze, routing by role, and age hints instead of red counters.
- The command palette means little to non-technical staff. It is a bonus, never a requirement.

### 2.2 Concept B: "Rooms of the house"

**Mental model:** Haven is a house (the logo is a roof), and each area is a room:
- the Front door (new arrivals),
- the Kitchen table (requests),
- the Money jar (giving),
- the Quiet room (counselling),
- the Locked room (safeguarding),
- the Noticeboard (website and posts),
- the Garden (volunteers and partners).

Home is an illustrated floor plan, the phone dock shows your rooms, and a role is a set of keys.

**Pros**
- It is memorable and warm, and ties directly to the brand mark.
- Roles become easy to explain ("Finance has keys to the Money jar").
- The Locked room makes safeguarding restriction feel natural rather than bureaucratic.

**Cons**
- Metaphor names add a translation step ("Where are donations? Oh, the Money jar"), which hurts most the people it is meant to help, especially second-language readers.
- Cross-room work (a request that becomes a counselling session that leads to a gift) means hopping between rooms.
- It feels twee in finance and audit contexts and ages badly.
- The illustrated floor-plan home costs design time we would rather spend on screens.

### 2.3 Concept C: "Conversational Today feed"

**Mental model:** a WhatsApp-like feed.
- Everything that happens arrives as a message card with buttons: "Fatou asked for help with school fees. [Review] [Take it]".
- An "Ask Haven" bar handles the rest: "record 500 dalasi from Omar for Eid".

**Pros**
- Almost nothing to learn, and it feels native on phones.
- It feels human, which is exactly the owner's "warm and sweet".

**Cons**
- It is poor at ledger work (exports, allocation), editing the website, or anything that needs comparing rows.
- Order by time buries old but important items.
- Filtering and audit are awkward.
- Safeguarding risk: a casual feed tempts us to preview sensitive text.
- Natural-language commands need an AI dependency on day one, and they fail unpredictably for exactly the staff least able to recover.

### 2.4 Comparison and pick

| Criterion (weight) | A Front Desk | B Rooms | C Feed |
|---|---|---|---|
| Learnable in one afternoon (3) | ●●● | ●● | ●●● |
| Phone-first (3) | ●●● | ●●● | ●●● |
| Triage speed (2) | ●●● | ●● | ●●● |
| Deep work: ledger, studio, kanban (2) | ●●● | ●●● | ● |
| Safeguarding containment (3) | ●●● | ●●● | ● |
| Role tailoring (2) | ●●● | ●●● | ●● |
| Fits the 8-week build (2) | ●●● | ●● | ● |
| Warmth (2) | ●● | ●●● | ●●● |

**Recommendation: A, Front Desk, with the best of B and C mixed in.**
- **From B, the warmth of the house.** The metaphor appears in illustrations, empty states and Team-screen language ("What can they open?"), never in labels. Labels stay plain: "Giving", not "Money jar".
- **From C, the sentence cards on Today.** "Needs you" items read as sentences with inline buttons.
- **Deferred:** C's natural-language command bar moves to Phase 2. Find already matches actions by plain words ("record gift", "phone number").

---

## 3. The shell

### 3.1 Desktop (≥ 1024px): the pill bar

```
canvas: cream (#fbf8f1) with paper texture at 35%
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ (H)aven·team   ╭───────────────────────────────────────────────╮ (⌕)  ╭─────────╮  (◔) (AJ) │
│                │ Today  Inbox ⑫  Requests  Giving  Sessions  More▾ │      │ ＋ New  │          │
│                ╰───────────────────────────────────────────────╯      ╰─────────╯          │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Page title (Nunito 800, 32px)                                         [page primary button] │
│  One line saying what this page is for.                                                       │
│  (Tab A) (Tab B) (Tab C)        ← sub-areas as Segmented pills, never a side list             │
│                                                                                              │
│  content (max-width 1240px, 24px gutters)                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Left: the mark.** `HavenMark` plus the "Haven" wordmark, followed by "team" in Caveat (marigold-600 on canvas, 22px, decorative and `aria-hidden`). It links to `/admin`.

**The forest pill** (`bg-forest`, h-14, rounded-full, white text 15px/700) holds up to six places, ordered by role (§5.3).
- The active place has `aria-current="page"` and the public site's marigold underline, drawn permanently rather than only on hover.
- Hovering draws the underline in, as on the public nav.
- Inbox shows a count badge (marigold background, night text) when there is something new.
- For staff who can see it, Safeguarding shows a small deep-green lock badge with the number of new concerns. It uses no colour alarm, so nobody nearby learns anything at a glance.
- **More ▾** opens a mega card in the style of the public `NavDropdown`. It holds the remaining places as icon tiles with one-line descriptions, plus Activity, Settings and Help.

**Right side:**
- **Find** (⌕): a marigold circle (night icon), echoing the public search button. Its tooltip reads "Find or do anything · Ctrl K".
- **＋ New**: a marigold pill (night text, 700) echoing the public "Donate Now". It opens Quick actions (§3.4).
- **Updates**: a white circle with a bell; a marigold dot means unread.
- **Avatar** (initials on an earth-tone disc): opens a menu with Me, Text size (Normal / Larger), Take the tour, Help, and Sign out.

**Page header** (`PageHeader`): title, one-line description, primary action on the right, and sub-area tabs as pill Segmented controls underneath.

On scroll, the bar stays sticky with a white glass effect, matching the public mobile bar.

### 3.2 Tablet (768–1023px)

Uses the phone shell (dock), with two-column content where it fits. Split views (§3.8) show list and detail side by side from 900px in landscape.

### 3.3 Phone (< 768px): top line and bottom dock

```
┌──────────────────────────────┐
│ Inbox                (◔) (AJ)│  ← 56px; the title shrinks into this line on scroll
│ (All 12)(Requests 5)(Gifts…) │  ← page tabs/filters scroll sideways
│                              │
│   content, 16px gutters      │
│                              │
│                              │
├──────────────────────────────┤
│  ⌂      ✉⑫     (＋)    ⌕   ⊞  │  ← dock: 64px + safe-area, white, rounded top 24px
│ Today  Inbox   New   Find Places│
└──────────────────────────────┘
```

**Five dock slots:**
1. **Today:** the `HavenMark` in miniature, as the house icon.
2. **The role's main place** (§5.3).
3. **＋ New:** a 56px marigold circle, raised 12px, with a night plus. Opens Quick actions.
4. **Find.**
5. **Places:** opens a sheet with every place the user may open, plus Me, Help and Sign out.

**Dock behaviour**
- Labels are always visible (12px, 700).
- The active slot shows a forest icon and label with a 4px marigold dot.
- The dock hides while the on-screen keyboard is open (detected with `visualViewport` resize).
- In full-screen editors (post editor, website preview, a record's composer) the dock is replaced by that screen's sticky action bar.

**Back navigation:** detail pages show a ‹ back chevron left of the title. The Android back gesture works naturally because every pushed view is a real route.

### 3.4 Places sheet and Quick actions (＋ New)

```
Places (bottom sheet, phone)         Quick actions (＋ New), role-filtered
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ ─── (drag handle)            │     │ What would you like to do?   │
│ [Requests 5] [Safeguard. 1]  │     │ ┌────────────┐┌────────────┐ │
│ [Giving    ] [Sessions  2]   │     │ │ ✎ Post an   ││ ♥ Record a  │ │
│ [Reports  3] [People    4]   │     │ │   update    ││   gift      │ │
│ [Website   ] [Posts     1]   │     │ └────────────┘└────────────┘ │
│ [Photos    ] [Team       ]   │     │ ┌────────────┐┌────────────┐ │
│ ─────────                    │     │ │ ☎ Log a     ││ ◷ Book a    │ │
│ Activity · Settings · Help   │     │ │   request   ││   session   │ │
│ Me · Sign out                │     │ └────────────┘└────────────┘ │
└──────────────────────────────┘     │ ⤒ Upload photos · ✉ Invite   │
                                     └──────────────────────────────┘
```

**Place tiles**
- Each tile is a 2-column card: a lucide icon over a small `Brush name="splash"` blob in the place's tint, then the label, and a count when the place has new items.
- On desktop, the same tiles appear in the **More ▾** mega card.

**Quick actions registry** (`lib/admin/commands.ts`, `quick: true`). Each action is listed with who sees it:
- **Post an update:** content, programme, super.
- **Record a gift:** finance, super.
- **Log a request from a call or visit:** programme, safeguarding, super.
- **Log a concern from a call:** safeguarding, super.
- **Book a session:** programme, super.
- **Add a follow-up note:** counsellor.
- **Write an article:** content, super.
- **Add a report:** report, content, super.
- **Upload photos:** content, programme, super.
- **Invite someone:** super.

Each action opens a **global sheet** (§3.9).

### 3.5 Find (Ctrl/Cmd+K, the dock's Find, `/` on Today)

```
┌─────────────────────────────────────────────────────────┐
│ ⌕  Find a person, a reference, a page… or type an action │
├─────────────────────────────────────────────────────────┤
│ Records                                                  │
│   S26-0142  School fees · Fatou C. · Under review      ↵ │
│   D26-0311  USD 200 · Omar H. · Received                 │
│ Do                                                       │
│   ♥ Record a gift                                    G R │
│   ✎ Post an update                                       │
│ Website                                                  │
│   Edit the phone number (Key information)                │
│   Edit hero slides (Home)                                │
│ Go to                                                    │
│   Giving · Counselling · Settings › Connections          │
│ Help                                                     │
│   How to record a gift that arrived in cash              │
└─────────────────────────────────────────────────────────┘
```

**How it works**
- Built with `cmdk`. On desktop it is a centred dialog 640px wide. On phones it is a full-screen sheet with the keyboard opened.
- Results come from `GET /api/admin/search?q=` (debounced 150ms, at most 8 records). The server filters them by permission (§5.5), so the client never filters for safety.
- Typing a reference (`/^[SCDKARVPM]\d{2}-\d{4,}$/i`) puts the exact match first. Enter opens it.
- Concerns appear only as "C26-0007 · Safeguarding concern [lock]", and only for roles that may see concerns. Opening one goes through the step-up check (§6.5).
- With an empty query, Find shows the last 5 records you opened (refs only, kept in `localStorage`) and your quick actions.
- **Website** results come from the studio registry (§6.10): each slot's label plus keywords. "phone", for example, finds Key information › Phone.

### 3.6 Updates drawer and the pulse

- **Updates** is the bell. It opens a sheet listing:
  - "Awa handed you S26-0142";
  - "Maria mentioned you in a note";
  - "New gift: USD 50 to Medical Fund";
  - "The October draft is ready to review";
  - "Session with Aminata in 1 hour".

  Each update links to its record. A "Mark all as read" link sits at the top. Only items you may open are listed.
- **Pulse:** `GET /api/admin/pulse` runs every 30 seconds while `document.visibilityState === "visible"`, and once on window focus.
  - It returns `{ inboxNew, mine, updatesUnread, concernsNew?, latestAt }`.
  - The shell updates the badges.
  - On the Inbox, new arrivals trigger a gentle toast: "2 new items arrived · Show".

  Polling is deliberate. It works the same on local JSON and on Firestore, needs no client database SDK, and is cheap.

### 3.7 Ribbons (top of the canvas, under the bar)

- **Practice mode** (sand background, umber text, 36px): "Practice mode · Everything is saved on this computer only, and emails wait in the Outbox instead of being sent. [Open Outbox]". It shows whenever the data layer reports `practiceMode` (the local `.data/` backend).
- **Offline** (night background, marigold text): "You're offline. We'll keep trying, and nothing you've typed is lost."
  - Uses `useOffline()` from `next/offline` when the architecture enables `experimental.useOffline` (`docs/01-app/03-api-reference/04-functions/use-offline.md`).
  - Otherwise falls back to `navigator.onLine` plus failed-fetch detection in `lib/admin/net.ts`.
- **Connection notices** sit inside the relevant area, not in a global ribbon. Example in Giving: "Card payments are off until Stripe is connected. People can still pledge, and you can record gifts here." See §14.

### 3.8 The split-view pattern (Inbox, Requests, Safeguarding, Counselling, report Requests)

**Layout**
- **Desktop (≥ 1024px):** list pane on the left (380px, scrolls independently) and detail pane on the right.
- **Phone:** the list is the page. Opening a row pushes `/[area]/[ref]` full screen with a back chevron.

**Next.js constraint (checked):** layouts do **not** receive `searchParams` (`docs/01-app/03-api-reference/03-file-conventions/layout.md`). The list lives in the layout so that it persists while the detail changes, so the list has to be a client component. The approach:

```tsx
// app/(admin)/admin/(shell)/inbox/layout.tsx  (Server Component)
export default async function InboxLayout({ children }: LayoutProps<"/admin/inbox">) {
  const staff = await requireStaff("inbox", "read");// DAL check (see §5.5)
  const items = await listInbox(staff, { limit: 500 }); // open items only, safe fields only
  return <SplitView list={<InboxList initial={items} />}>{children}</SplitView>;
}
// inbox/page.tsx renders <EmptyDetail/> ("Pick something from the list") on desktop; phones see only the list.
// inbox/[ref]/page.tsx: const { ref } = await params; return <RecordPanel ref={ref} context="inbox" />;
```

**List behaviour**
- `InboxList` filters and sorts on the client. Filter state is mirrored into the URL with `router.replace` and `useSearchParams`, so links can be shared.
- Mutations are server actions that call `refresh()` from `next/cache`. That is allowed only inside server actions (`.../04-functions/refresh.md`), and it re-renders the layout's list in the same round trip.
- Older or closed records come through a `loadMore({ before })` server action.
- `SplitView` uses `useSelectedLayoutSegment()` to know whether a detail is open, and on phones hides whichever pane is not in use.

### 3.9 Global sheets (`?do=`)

Quick actions, palette actions and buttons on Today open app-wide sheets through a search parameter, for example `/admin/giving?do=record-gift`.
- `SheetHost` lives in the shell, reads `useSearchParams()` and renders the matching sheet.
- Opening uses `router.push`, so the phone's back button closes the sheet.
- Closing uses `router.back()` if the sheet was opened in the app, otherwise `router.replace` without the parameter.

```ts
type GlobalSheet =
  | "record-gift" | "log-request" | "log-concern" | "post-update" | "write-article"
  | "book-session" | "add-note" | "add-report" | "upload-media" | "invite";
```

---

## 4. Information architecture

### 4.1 Places

| Place | Nav label | URL | What it holds |
|---|---|---|---|
| Today | Today | `/admin` | Greeting, what needs you, quick actions, snapshot, what's coming up |
| Inbox | Inbox | `/admin/inbox` | Everything new that needs a first response, across all types you may see |
| Requests | Requests | `/admin/requests` | Support requests (§6) through their whole life |
| Safeguarding | Safeguarding | `/admin/safeguarding` | Child-protection concerns (§7), restricted |
| Giving | Giving | `/admin/giving` | Gifts ledger, in-kind offers, causes and appeals, where the money goes, receipts, exports |
| Counselling | Sessions (Counsellors see "My sessions") | `/admin/counselling` | Requests for counselling, schedule, Zoom, attendance, follow-up notes |
| Reports & resources | Reports | `/admin/library` | Resources, reports and requests for controlled reports |
| People | People | `/admin/people` | Volunteers and partners pipelines, plus the referral-partner directory |
| Website | Website | `/admin/website` | In-context content studio and the Key information editor |
| Posts | Posts | `/admin/posts` | Updates and articles (the blog), AI drafts to review, topic plan |
| Photos & files | Photos | `/admin/media` | Media library with consent records |
| Team | Team | `/admin/team` | Staff accounts and what each person can open |
| Activity | Activity | `/admin/activity` | Who did what and when, including views of sensitive records and exports |
| Settings | Settings | `/admin/settings` | Connections, emails Haven sends, giving setup, data and privacy, email log |
| Me | (avatar) | `/admin/me` | Profile, password, sign-in code, notification preferences, text size |
| Help | Help | `/admin/help` | Short guides and the first-day tour (ToR §16 "admin orientation") |

### 4.2 URL map: every screen

| URL | Screen | Notes |
|---|---|---|
| `/admin/login` | Sign in | §6.1. Outside the shell |
| `/admin/login/code` | Sign-in code (MFA) | Second step for accounts with codes switched on |
| `/admin/forgot` | Reset password, step 1 | Sends a link; the reply never reveals whether the email exists |
| `/admin/reset/[token]` | Reset password, step 2 | |
| `/admin/invite/[token]` | Accept invitation | Name, password, then sign-in code setup if the role requires it |
| `/admin/locked` | Locked screen after 30 minutes idle | Re-enter password; the work underneath is kept |
| `/admin` | Today | §6.2 |
| `/admin/inbox` | Inbox list (+ empty detail on desktop) | `?tab=new\|later\|mine&type=&urgency=&who=&q=` |
| `/admin/inbox/[ref]` | Record panel inside the Inbox | Dispatches by the ref prefix to the record view |
| `/admin/requests` | Requests list | `?stage=&who=mine\|all&programme=&q=&closed=1` |
| `/admin/requests/[ref]` | Request (case) view | §6.4 |
| `/admin/safeguarding` | Concerns list | Step-up required (§6.5) |
| `/admin/safeguarding/[ref]` | Concern view | Every open is logged |
| `/admin/giving` | Gifts ledger | `?kind=cash\|kind&stage=&programme=&month=&q=` |
| `/admin/giving/[ref]` | Gift or in-kind view | |
| `/admin/giving/[ref]/receipt` | Printable receipt | Print CSS, A4 and Letter |
| `/admin/giving/causes` | Causes and appeals | Progress, links to share |
| `/admin/giving/causes/[id]` | Cause editor | Goal, "where the money goes" breakdown, link |
| `/admin/giving/where-it-goes` | Allocation by programme and cause | Per currency |
| `/admin/counselling` | Sessions: week strip and agenda, plus "Waiting for a time" | Counsellors see only their own |
| `/admin/counselling/[ref]` | Session view | |
| `/admin/library` | Resources grid | |
| `/admin/library/new` | Add a resource | Full page on phones, large sheet on desktop |
| `/admin/library/[id]` | Edit a resource | |
| `/admin/library/requests` | Report requests (split view) | |
| `/admin/library/requests/[ref]` | Report request view | |
| `/admin/people` | Redirects to `/admin/people/volunteers` | |
| `/admin/people/volunteers` | Volunteer pipeline (kanban on desktop, stage lists on phones) | |
| `/admin/people/partners` | Partner pipeline | |
| `/admin/people/directory` | Referral partners directory (clinics, lawyers, counsellors outside Haven) | Used by the referral sheet |
| `/admin/people/[ref]` | Volunteer or partner view | |
| `/admin/website` | Redirects to `/admin/website/home` | |
| `/admin/website/[page]` | Studio for one public page | `[page]` comes from the registry: `home`, `about`, `programmes`, `programme-protection`, …, `donate`, `get-support`, `report-concern`, `get-involved`, `resources`, `impact`, `contact`, `safeguarding-policy`, `privacy`, `terms`, `footer` |
| `/admin/website/key-info` | Key information quick editor | §6.11 |
| `/admin/website/changes` | Everything not live yet, plus history | Also opens as the publish sheet |
| `/admin/posts` | Posts list | `?tab=drafts\|review\|scheduled\|live` |
| `/admin/posts/new` | New post | `?kind=update\|article`; phones use the Update composer |
| `/admin/posts/[id]` | Post editor | |
| `/admin/posts/review` | Drafts waiting for review (AI and staff) | |
| `/admin/posts/review/[id]` | Review screen: side-by-side sources and "Things to check" | |
| `/admin/posts/plan` | Topics and milestones, monthly draft settings | |
| `/admin/media` | Media grid | `?item=<id>` opens the item sheet; `?filter=child\|needs-consent\|illustrative\|video` |
| `/admin/team` | Team list | |
| `/admin/team/[uid]` | Person view (access, sign-in code, pause) | |
| `/admin/activity` | Activity log | `?who=&area=&sensitive=1&from=&to=` |
| `/admin/settings` | Settings overview cards | |
| `/admin/settings/connections` | Firebase, Stripe, email, AI and Zoom status | |
| `/admin/settings/emails` | The emails Haven sends (§14 of the spec) | |
| `/admin/settings/emails/[template]` | Edit one email's wording, with preview | |
| `/admin/settings/giving` | Currencies, preset amounts, receipts, automatic thank-yous, bank details | |
| `/admin/settings/data` | Retention periods, correction and deletion requests, backups | |
| `/admin/settings/email-log` | Email log (called "Outbox" in practice mode) | |
| `/admin/me` | My account | |
| `/admin/help` | Help home | |
| `/admin/help/[guide]` | One guide | |
| `/admin/r/[ref]` | Short link: redirects to the record's home URL | Used in every staff email; checks permission |

**Route handlers** (owned by this UI; the internals sit with the sibling docs):

| Route | Purpose |
|---|---|
| `app/api/admin/pulse/route.ts` | Badge counts (§3.6) |
| `app/api/admin/search/route.ts` | Find (§3.5) |
| `app/api/admin/export/[kind]/route.ts` | CSV downloads: `gifts`, `inkind`, `allocations`, `volunteers`, `partners`, `activity` |
| `app/api/admin/studio/preview/route.ts` | Checks the staff session, enables Draft Mode, redirects to `?studio=1` (§6.10) |
| `app/api/admin/studio/exit/route.ts` | POST; disables Draft Mode |
| `app/api/admin/files/[...path]/route.ts` | Authenticated streaming of private files in practice mode (case documents, consent forms) |

### 4.3 File tree

```
app/
  (site)/…                          public site (moves here; owned by the architecture doc)
  (admin)/
    layout.tsx                      ROOT layout: <html>, fonts (shared lib/fonts.ts), globals.css,
                                    <Toaster/>, metadata { robots: noindex, title template "%s · Haven team" }.
                                    NO SmoothScroll, NO GSAP.
    admin/
      login/page.tsx  login/code/page.tsx  forgot/page.tsx  reset/[token]/page.tsx
      invite/[token]/page.tsx  locked/page.tsx
      (shell)/
        layout.tsx                  getStaff() → <AdminShell staff nav>{children}</AdminShell>
        loading.tsx  error.tsx  not-found.tsx
        page.tsx                    Today
        inbox/{layout,page}.tsx  inbox/[ref]/page.tsx
        requests/{layout,page}.tsx  requests/[ref]/page.tsx
        safeguarding/{layout,page}.tsx  safeguarding/[ref]/page.tsx
        giving/{layout,page}.tsx  giving/[ref]/page.tsx  giving/[ref]/receipt/page.tsx
        giving/causes/page.tsx  giving/causes/[id]/page.tsx  giving/where-it-goes/page.tsx
        counselling/{layout,page}.tsx  counselling/[ref]/page.tsx
        library/page.tsx  library/new/page.tsx  library/[id]/page.tsx
        library/requests/{layout,page}.tsx  library/requests/[ref]/page.tsx
        people/page.tsx  people/volunteers/page.tsx  people/partners/page.tsx
        people/directory/page.tsx  people/[ref]/page.tsx
        website/page.tsx  website/[page]/page.tsx  website/key-info/page.tsx  website/changes/page.tsx
        posts/page.tsx  posts/new/page.tsx  posts/[id]/page.tsx
        posts/review/page.tsx  posts/review/[id]/page.tsx  posts/plan/page.tsx
        media/page.tsx
        team/page.tsx  team/[uid]/page.tsx
        activity/page.tsx
        settings/page.tsx  settings/{connections,emails,giving,data,email-log}/page.tsx
        settings/emails/[template]/page.tsx
        me/page.tsx  help/page.tsx  help/[guide]/page.tsx
        r/[ref]/page.tsx
  api/admin/…                       (table above)

components/admin/
  shell/    AdminShell TopBar BottomDock PlacesSheet QuickActionsSheet CommandPalette UpdatesDrawer
            PracticeRibbon OfflineBanner PageHeader SplitView SheetHost NoAccess Tour
  ui/       AdminButton Card Sheet ConfirmDialog Toaster ChoiceCards Segmented FilterChips
            TextField TextArea CharCount ListSelect DateTimeField MoneyField CountryPicker
            PersonPicker Avatar StatusPill StatusStepper Timeline Composer EmptyState Skeleton
            KpiTile Masked RestrictedBanner SwipeRow Kanban DataList Badge KeyHint Celebrate
  records/  RecordPanel InboxRow SupportView ConcernView GiftView InKindView SessionView
            ReportRequestView VolunteerView PartnerView MessageView ReferralSheet DeclineSheet
  giving/   Ledger RecordGiftSheet AllocationEditor CauseEditor BreakdownBar ExportSheet ReceiptDoc
  studio/   StudioFrame StudioOutline SlotSheet SchemaForm fields/* PublishSheet DeviceSwitch
            (+ StudioBridge, rendered by the PUBLIC layout in Draft Mode only)
  posts/    PostList PostEditor UpdateComposer blocks/* AiAssist SafetyCheck ReviewScreen PlanBoard
  media/    MediaGrid MediaSheet MediaPicker ConsentQuestions
  art/      EmptyArt (hands + heart, sprig, house, paper plane), GreetingDoodle

lib/admin/
  access.ts      roles, areas, matrix, can()        workflows.ts  flows, labels, verbs (§7)
  refs.ts        ref format and parsing             urgency.ts    urgency and age rules
  nav.ts         places registry                    commands.ts   Find and quick actions registry
  copy.ts        all UI strings (one place, ready for Phase 2 translation)
  hotkeys.ts     useHotkeys()                        net.ts        offline detection fallback
  format.ts      dates (staff timezone), money (reuses lib/money.ts), "2h ago"
  actions/       server actions per area: inbox.ts requests.ts safeguarding.ts giving.ts …
lib/studio/      registry.ts (pages → slots → fields)  schema.ts (FieldSpec)  bridge.ts (message types)
```

### 4.4 Record references

Each record gets a reference that is easy to read aloud on a phone call ("S twenty-six, oh-one-four-two"):

```ts
// lib/admin/refs.ts
export type RecordKind =
  | "support" | "concern" | "gift" | "inkind" | "session"
  | "reportRequest" | "volunteer" | "partner" | "message";
export const REF_PREFIX: Record<RecordKind, string> = {
  support: "S", concern: "C", gift: "D", inkind: "K", session: "A",
  reportRequest: "R", volunteer: "V", partner: "P", message: "M",
};
// Prefix + 2-digit year + "-" + sequence per kind per year, zero-padded to 4: S26-0142
export const REF_RE = /^([SCDKARVPM])(\d{2})-(\d{4,})$/i;
export const HOME_OF: Record<RecordKind, string> = {
  support: "/admin/requests", concern: "/admin/safeguarding", gift: "/admin/giving",
  inkind: "/admin/giving", session: "/admin/counselling", reportRequest: "/admin/library/requests",
  volunteer: "/admin/people", partner: "/admin/people", message: "/admin/inbox",
};
```

This satisfies "assign a case reference" (§12): the reference is assigned when the record is created, never typed by hand.

### 4.5 The data contract the UI needs

The data doc owns storage. These are the shapes the screens render. Keep the field meanings, and rename fields to match the sibling doc if needed.

```ts
// lib/admin/types.ts
export type Urgency = "immediate" | "urgent" | "soon" | "normal";

export interface StaffRef { uid: string; name: string; initials: string; tone: "clay" | "cocoa" | "forest" | "umber" | "marigold" }

export interface Staff extends StaffRef {
  email: string;
  roles: Role[];                 // §5.1; a person may hold more than one role
  extraAreas?: Area[];           // granted by a super admin ("Also let them open: People")
  viewerAreas?: Area[];          // for the Viewer/Auditor role: which areas they may read
  tz: string;                    // "Africa/Banjul" | "America/Los_Angeles" | …
  mfa: boolean;
  status: "invited" | "active" | "paused";
  textSize: "normal" | "large";
  tourDoneAt?: string;
  lastActiveAt?: string;
}

/** One row in the Inbox. Built server-side; NEVER contains concern narrative. */
export interface InboxItem {
  ref: string;
  kind: RecordKind;
  title: string;                 // "School fees", "Pledge to confirm", "Volunteer: Education support"
  who: string;                   // first name + last initial, or "Anonymous", or org name
  country?: string;              // ISO code → <Flag/>
  preview: string;               // ≤ 90 chars; for concerns: "Details are restricted"
  urgency: Urgency;
  status: string;                // workflow key (§7)
  createdAt: string;             // ISO
  lastActivityAt: string;
  assignee?: StaffRef;
  snoozedUntil?: string;
  unreadFor: string[];           // uids who haven't opened it since the last change
  restricted: boolean;           // true for concerns
  nextStep?: { label: string; action: string };   // the row's button, e.g. { "Take it", "assignToMe" }
}

export type TimelineKind =
  | "submitted" | "status" | "assigned" | "note" | "email" | "call" | "referral"
  | "document" | "session" | "allocation" | "receipt" | "risk" | "authority" | "system";

export interface TimelineEntry {
  id: string;
  ref: string;
  at: string;
  actor: StaffRef | { system: true } | { public: true };
  kind: TimelineKind;
  text?: string;                 // notes: plain text with @mentions; ≤ 4,000 chars (counsellor notes ≤ 1,000)
  from?: string; to?: string;    // status changes
  email?: { template: string; subject: string; to: string; state: "sent" | "outbox" | "failed" };
  referral?: Referral;
  restricted?: boolean;          // counsellor notes, safeguarding entries
  editedAt?: string;             // notes can be edited for 10 minutes, after which they are locked (audit)
}

export interface Referral {
  partnerId?: string;            // People › Directory
  partnerName: string;
  service: "medical" | "legal" | "psychological" | "education" | "protection" | "family" | "other";
  date: string;
  contactPerson?: string;
  consentToShare: true;          // the sheet cannot save without it
  outcome: "waiting" | "accepted" | "declined" | "completed";
  note?: string;
}
```

---

## 5. Roles and what each one sees

### 5.1 Access matrix

The roles come from §12. Key to the cells:
- **W** = read and change.
- **P** = can also put live (publish).
- **R** = read only.
- **O** = only records assigned to them.
- **D** = can create drafts or uploads, which another role puts live.
- **—** = cannot see the area at all; it is hidden from the nav, Find, Today and the API.
- **R\*** = read, if granted in `viewerAreas`.

| Area | Super Admin | Content Mgr | Programme Officer | Safeguarding Officer | Finance Officer | Counsellor | Report Mgr | Viewer/Auditor |
|---|---|---|---|---|---|---|---|---|
| Today | W | W | W | W | W | W | W | R |
| Inbox | W (all kinds) | W (routed messages) | W (routed) | W (routed) | W (routed) | — | W (routed) | — |
| Requests | W | — | W | R + notes | — | — | — | R\* (masked) |
| Safeguarding | W | — | — | W | — | — | — | — |
| Giving | W | W (cause wording and images only) | — | — | W | — | — | R\* |
| Counselling | W | — | W (no follow-up notes) | R (incl. notes) | — | O | — | R\* (no notes) |
| Reports & resources | W | W (resources) | — | — | — | — | W | R\* |
| People | W | — | W | — | — | — | — | R\* |
| Website | P | P | — | — | — | — | — | R\* |
| Posts | P | P | D (updates go to review) | — | — | — | — | — |
| Photos | W | W | D (upload) | — | — | — | D (upload) | — |
| Team | W | — | — | — | — | — | — | — |
| Activity | W (all) | own areas | own areas | + safeguarding entries | own areas | — | own areas | R\* |
| Settings | W | R (connections) | R | R | W (Settings › Giving) | — | R | — |

**"Sensitive" grants**
- *Unmasked contact details:* the assigned officer, safeguarding officers and super admins see them directly. Other writers see a masked value with a logged **Show** button (§9.2 Masked). Viewers get no Show button.
- *Counsellor follow-up notes:* readable only by the assigned counsellor, safeguarding officers and super admins.

```ts
// lib/admin/access.ts
export const ROLES = ["super_admin","content_manager","programme_officer","safeguarding_officer",
  "finance_officer","counsellor","report_manager","viewer"] as const;
export type Role = (typeof ROLES)[number];
export const AREAS = ["today","inbox","requests","safeguarding","giving","counselling","library",
  "people","website","posts","media","team","activity","settings"] as const;
export type Area = (typeof AREAS)[number];
export type Verb = "read" | "write" | "publish" | "sensitive";
export type Grant = { read: true | "own"; write?: true | "own" | "draft"; publish?: true; sensitive?: true };
export const MATRIX: Record<Role, Partial<Record<Area, Grant>>> = { /* the table above, cell for cell */ };
export function can(staff: Staff, area: Area, verb: Verb, rec?: { assigneeUid?: string; counsellorUid?: string }): boolean;
export function inboxKindsFor(staff: Staff): RecordKind[];   // §5.2
export function placesFor(staff: Staff): Place[];           // §5.3, ordered
```

### 5.2 Inbox routing (who triages what)

| Arrives as | Lands in the Inbox of |
|---|---|
| Support request (`S`) | Programme officers, super admins. If "immediate danger = yes", also safeguarding officers, flagged |
| Concern (`C`) | Safeguarding officers and super admins only, as a locked row |
| Pledge or donation enquiry (`D`, not paid online) | Finance, super |
| Online card gift (`D`, paid via Stripe) | Not the Inbox. It goes to the Giving ledger and Today's "Recently" list, with automatic thank-you when that's switched on (§6.6) |
| In-kind offer (`K`) | Finance, super |
| Counselling request (`A`, status Requested) | Programme officers, super |
| Report request (`R`) | Report managers, super |
| Volunteer application (`V`) | Programme officers, super |
| Partnership enquiry (`P`) | Programme officers, super |
| Contact message (`M`), routed by category (§11) | general → programme + super; donation → finance; partnership → programme; volunteering → programme; media → content; programme information → programme; resource request → report; technical support → super |

### 5.3 Navigation per role

| Role | Desktop pill (in order) | Under More | Phone dock, slot 2 |
|---|---|---|---|
| Super Admin | Today · Inbox · Requests · Giving · Website · Posts | Safeguarding, Sessions, Reports, People, Photos, Team, Activity, Settings | Inbox |
| Content Manager | Today · Website · Posts · Photos · Reports | Inbox, Giving (causes), Activity, Settings | Posts |
| Programme Officer | Today · Inbox · Requests · Sessions · People | Posts, Photos, Activity | Inbox |
| Safeguarding Officer | Today · Safeguarding · Inbox · Requests · Sessions | Activity | Safeguarding |
| Finance Officer | Today · Inbox · Giving | Activity, Settings | Giving |
| Counsellor | Today · My sessions · Help | None | My sessions |
| Report Manager | Today · Inbox · Reports | Photos, Activity | Inbox |
| Viewer/Auditor | Today + granted areas | Activity (if granted) | none: the dock is Today · Find · Places, with no ＋ |

### 5.4 Today per role

| Role | Top of Today | Then |
|---|---|---|
| Super Admin | Needs you (all routed kinds, top 5) | All ten "At a glance" counts from §12 · This month · Coming up · On the website · Recently · Connection notices (e.g. "Stripe isn't connected yet") |
| Programme Officer | Needs you: new requests, requests where more information was asked over 7 days ago, your requests with no activity in 7 days | At a glance (requests, counselling requests, volunteers, partners, messages) · Today's sessions · Your requests by stage (mini bar) |
| Safeguarding Officer | Deep-green **Concerns** card: new, immediate risk (count only), follow-ups due today | Support requests flagged "immediate danger" · Recently (safeguarding entries) |
| Finance Officer | Gifts this month per currency (Anton figures on earth-tone cards) | Needs you: pledges to confirm, in-kind pickups to arrange, thank-yous to send, gifts not yet put towards anything · Causes progress bars |
| Counsellor | **Next session** card: time in your timezone, client first name, a big "Join Zoom" button | Today and this week · Notes to write (sessions marked attended with no follow-up note) |
| Content Manager | On the website: changes not live, monthly draft ready to review, scheduled posts | Photos needing consent · "Impact numbers were last checked 94 days ago" (marigold after 90 days) · Recently live |
| Report Manager | Requests waiting (count + oldest age) | Resources live · Recent downloads |
| Viewer/Auditor | "You can look around, but changes are switched off for your role." | This month (read-only) · Recently (granted areas) |

### 5.5 Enforcement rules (non-negotiable)

1. **Checks happen in the data layer.** Every data read and server action starts with `requireStaff(area, verb, record?)`, which lives in the data access layer.
   - The shell layout only renders navigation. As the Next docs warn, layouts don't re-render on navigation (`docs/01-app/02-guides/authentication.md` → "Layouts and auth checks").
   - Hiding a nav item is never a security measure.
2. **The proxy only redirects early.** `proxy.ts` (Next 16 renamed middleware to proxy; see `docs/01-app/01-getting-started/16-proxy.md`) does an optimistic redirect to `/admin/login?next=…` when there is no session cookie on `/admin/:path*`, excluding the login, forgot, reset and invite pages. It also sets `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`. It is never the authorisation itself.
3. **Concern data stays in the concern store.** Concern fields are read only by functions in `lib/admin/actions/safeguarding.ts`. Inbox, search, pulse, notifications, Activity sentences and AI inputs get only `{ ref, risk, status, createdAt, assignee }`.
4. **Logged access.** Every open of a concern, every **Show** on a masked field, every file download and every export writes an Activity entry with `sensitive: true`.
5. **Step-up.** Entering Safeguarding, exporting personal data and changing roles all require a sign-in within the last 30 minutes. Otherwise the **Confirm it's you** sheet appears, asking for a password, or for the sign-in code when codes are switched on.
6. **Not allowed looks friendly.** Opening a place without permission renders `NoAccess` inside the shell: "This part of Haven isn't open to your role. If you need it, ask Emanuel." It names the first super admin.

   We do not use the experimental `forbidden()`/`unauthorized()` interrupts. They need `experimental.authInterrupts` (`docs/01-app/03-api-reference/03-file-conventions/forbidden.md`).

---

## 6. Screens

All wireframes are at the stated width. Brackets are buttons, parentheses are chips or pills, and `▾` is a picker.

### 6.1 Sign in

**Purpose:** the warm front door. Staff should feel welcomed and safe, and immediately sure they're in the right place.

**Desktop**

```
┌──────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ cream paper                                  │ white                                         │
│    ╭──────────────────────────────╮          │      (H)aven  ← HavenMark animated once        │
│   ╱  photo masked by Brush "patch" ╲         │                                               │
│  │   journey-outreach (team member  │        │      ── Welcome back ──   (Caveat 30, forest)  │
│  │   kneeling with a mother, father │        │      Sign in to Haven     (Nunito 800, 40)     │
│   ╲  and their child)              ╱         │      The team space for Haven staff.           │
│    ╰──────────────────────────────╯          │                                               │
│         ↖ CurlyArrow (marigold, draws in)    │      Email                                    │
│   "Thank you for the care you bring          │      [ you@haven.org.gm                    ]   │
│    to every child."   (Caveat 28, umber)     │      Password                                 │
│                                              │      [ ••••••••••                      Show ]  │
│                                              │      (Keep me signed in on this device · 14 d) │
│                                              │      [        Sign in  →        ]  forest, full│
│                                              │      Forgot your password?                    │
│                                              │      ─────────────────────────────────────    │
│                                              │      [lock] A private area. Sign-ins and changes   │
│                                              │         are recorded to keep children safe.    │
│                                              │      ← Back to the website                     │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

**Phone**

```
┌──────────────────────────────┐
│ photo band (38vh),           │
│ HavenMark white on photo     │
│▓▓▓▓▓ Brush "torn" white edge ▓│
│ ╭──────────────────────────╮ │  ← white card, rounded-t-[28px], overlaps photo by 24px
│ │ ── Welcome back ──        │ │
│ │ Sign in to Haven          │ │
│ │ [ email               ]   │ │  inputMode="email" autoComplete="username"
│ │ [ password      Show  ]   │ │  autoComplete="current-password"
│ │ (Keep me signed in)       │ │
│ │ [      Sign in  →     ]   │ │
│ │ Forgot your password?     │ │
│ │ [lock] Private area…          │ │
│ ╰──────────────────────────╯ │
└──────────────────────────────┘
```

**Details**

- **Photo.** It rotates daily through `journey-outreach`, `journey-orphanage`, `journey-verify`, `journey-needs` and `journey-give`, resolved via `img()`. These show the team at work, all within the people-mix and family rules. The quote line rotates too, from 5 lines in `lib/admin/copy.ts`.
- **Fields.** Rounded-full and 52px tall, in the donate card's field style but on white with a 1px `line` border. The focus ring is marigold (global `:focus-visible`).
- **"Keep me signed in on this device"** is a sentence checkbox. Checked, the session lasts 14 days; unchecked, it ends when the browser closes. It is never offered on the step-up sheet.
- **Errors** appear inline under the button, in a soft-coral box with urgent text:
  - "That email and password don't match. Try again, or reset your password."
  - After 5 failures: "For safety, sign-in is paused for 15 minutes. You can reset your password now."
- **Sign-in code** (`/admin/login/code`): "One more step". Six large digit boxes with auto-advance; pasting a whole code works; `inputMode="numeric" autoComplete="one-time-code"`. There is also a "Use a backup code" link.
  - Codes are **required** for Super Admin and Safeguarding Officer, and optional for everyone else (§15 "MFA where possible").
  - The mechanism (TOTP) belongs to the auth doc.
- **Forgot.** The reply is always: "If that email belongs to a Haven account, a reset link is on its way. It works for 30 minutes."
- **Invite** (`/admin/invite/[token]`), three short steps with a progress dot row:
  1. "Hello Awa, Emanuel invited you to Haven as a Programme Officer." Then your name and photo (optional).
  2. Choose a password, with a strength meter in plain words: "Good · Strong".
  3. Set up your sign-in code: a QR code, then confirm a code. This step is skipped for roles where codes are optional ("You can switch this on later in Me").
- **Locked** (`/admin/locked`, after 30 minutes idle): "Still there, Awa? We locked Haven to keep things private." Password field and [Unlock]. Unsaved drafts are kept.
- **Practice-mode sign-in chips.** Shown only when the data layer reports `practiceMode` **and** `process.env.NODE_ENV !== "production"`. Under the form, a sand box reads: "Practice mode · Try Haven as:" followed by one chip per role:
  - (Emanuel · Super admin)
  - (Awa · Programme)
  - (Maria · Safeguarding)
  - (Nur · Finance)
  - (Ayesha · Counsellor)
  - (Siti · Content)
  - (Kwame · Reports)
  - (Farah · Viewer)

  One tap signs in as that seeded account. This is how engineers and QA verify role visibility. The names follow the people mix, and avatars are initials only.

### 6.2 Today

**Purpose:** "What needs me, and how are we doing?" Readable in 10 seconds.

**Desktop (1280px)**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [shell bar]                                                                                  │
│                                                                                              │
│  Good morning, Awa                     (Caveat 44, forest)        ╭ GreetingDoodle ╮         │
│  Thursday 9 October · Three things need you today.  (Nunito 600, 18, body)  hands + heart, │
│                                                                    draws in once a day      │
│  [☎ Log a request]  [◷ Book a session]  [✎ Post an update]  [⌕ Find… Ctrl K]   (quick row)   │
│                                                                                              │
│  ┌ Needs you ──────────────────────────────────────────┐  ┌ Coming up today ──────────────┐   │
│  │ ● Urgent · S26-0142 · School fees                    │  │ 10:00  Session with Aminata   │   │
│  │   Fatou C. · [GM] The Gambia · 2 h ago                 │  │        Ayesha · Zoom ready    │   │
│  │   "My daughter was sent home because the fees…"      │  │        (03:00 California)     │   │
│  │                              [Open]  [Take it]       │  │ 14:30  Session with Rahul     │   │
│  │ ─────────────────────────────────────────────────── │  │        No Zoom link yet  [Add]│   │
│  │ ○ V26-0051 · Volunteer: Education support            │  │ Tomorrow 09:00                │   │
│  │   Aminata S. · [SN] Senegal · Waiting 3 days            │  │        "Back to school" goes  │   │
│  │                              [Open]  [Start screening]│  │        live (scheduled post)  │   │
│  │ ○ M26-0230 · Message · Programme information         │  └───────────────────────────────┘   │
│  │   Imran K. · [PK] Pakistan · 5 h ago   [Open] [Reply]   │                                    │
│  │                     See all 12 in your Inbox →       │                                    │
│  └──────────────────────────────────────────────────────┘                                    │
│                                                                                              │
│  At a glance                                                                                 │
│  (5 new requests)(1 concern [lock])(2 gift enquiries)(1 in-kind offer)(2 sessions today)           │
│  (3 report requests)(4 volunteer applications)(1 partnership enquiry)(18 resources live)       │
│                                                                                              │
│  This month at Haven                                                                         │
│  ┌ clay ─────────┐ ┌ marigold ─────┐ ┌ cocoa ────────┐ ┌ forest ───────┐                      │
│  │ GIFTS         │ │ REQUESTS      │ │ SESSIONS      │ │ VOLUNTEERS    │                      │
│  │ GMD 48,500    │ │ 23            │ │ 41            │ │ 6             │  (Anton 44)          │
│  │ USD 3,120     │ │ handled       │ │ held          │ │ newly active  │                      │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘                      │
│                                                                                              │
│  ┌ On the website ──────────────────┐  ┌ Recently ─────────────────────────────────────────┐ │
│  │ ✦ The October draft is ready      │  │ (MS) Maria moved C26-0007 on · 10:42               │ │
│  │   to review          [Review]     │  │ ♥ Online gift USD 50 to Medical Fund · 10:15       │ │
│  │ 3 changes not live yet [Review]   │  │ (AJ) You added a note to S26-0139 · 09:58          │ │
│  │ Impact numbers checked 94 days    │  │ (NR) Nur sent 4 thank-yous · 09:30                 │ │
│  │ ago               [Check them]    │  │                           See all activity →      │ │
│  └───────────────────────────────────┘  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Phone (stacked, in this order)**
1. Greeting: Caveat 34, with the date line.
2. Quick actions as a 2×2 grid of tiles (role-filtered, at most 4).
3. Needs you: 3 items, then "See all 12".
4. Coming up.
5. At a glance: chips in one sideways-scrolling row.
6. This month: a 2×2 grid of earth cards, Anton 36.
7. On the website.
8. Recently: collapsed to 3 lines.

**Behaviour**

- **Greeting by time of day** in the staff member's timezone: "Good morning" before 12:00, "Good afternoon" before 17:00, "Good evening" after. The subline is a sentence built from counts:
  - 0 items: "Nothing needs you right now. Thank you for everything you do."
  - 1 item: "One thing needs you today."
  - 2–9: "Three things need you today." (spelled out up to nine)
  - 10 or more: "12 things need you. Let's start with the urgent ones."
- **Needs you order:** urgency (immediate > urgent > soon > normal), then age.
  - Each item is an `InboxRow` in card form, carrying its next-step button.
  - Concerns appear as "C26-0007 · New concern · risk not set yet [lock]" with **[Open]** only. They never show a preview.
- **At a glance chips** cover §12's tiles one for one. Each links to a pre-filtered Inbox, place or Library. Only permitted chips render. Zero counts are shown muted ("0 report requests"), not hidden, so the layout stays stable.
- **This month cards** reuse the public Impact card tones (clay, marigold, cocoa, forest) at a smaller size (min-h 150px, radius 22px).
  - Figures count up once per browser session (`sessionStorage` flag), using the existing `Counter` component.
  - Gifts list each currency on its own line and **never add currencies together**.
- **Recently** lists the 5 latest Activity sentences you may see. Avatar chips use the person's tone.
- **GreetingDoodle** is `HandsLineArt` (forest and marigold) at 140px. It draws in on the first visit of the day (`localStorage` date), then stays static.
- **Loading:** `loading.tsx` shows skeletons for each card. Each card streams in its own `<Suspense>` so a slow count never blocks the greeting (`docs/01-app/02-guides/authentication.md` → "Auth and streaming").

### 6.3 Inbox (triage)

**Purpose:** give every new submission its first human response quickly, from desk or phone.

**Desktop (split view)**

```
┌ Inbox ──────────────────────────────────────────────────────────────────────────────────────┐
│ (New 12) (Later 3) (Mine 7)                                     [⌕ Search the inbox  /]     │
│ Type:    (All) (Requests 5) (Concerns 1 [lock]) (Gifts 2) (In-kind 1) (Sessions 2) (Reports 3)   │
│          (Volunteers 4) (Partners 1) (Messages 3)                                            │
│ Urgency: (Any) (Urgent) (Soon)      Who: (Anyone) (Not taken yet) (Me)          Sort: Newest ▾│
├────────────────────────────────────────┬────────────────────────────────────────────────────┤
│▌● S26-0142 · School fees      Urgent    │  [RecordPanel: the record's own view, §6.4–6.19]   │
│▌  Fatou C. · [GM] · 2 h ago     (AJ)      │                                                    │
│▌  "My daughter was sent home because…"  │                                                    │
│ ─────────────────────────────────────── │                                                    │
│▌○ C26-0007 · Safeguarding concern [lock]     │                                                    │
│▌  Risk not set · [GM] · 40 min ago        │                                                    │
│▌  Details are restricted                │                                                    │
│ ─────────────────────────────────────── │                                                    │
│▌○ D26-0309 · Pledge to confirm          │                                                    │
│▌  Omar H. · [GB] · USD 200 monthly · 1 d   │                                                    │
│ …                                       │                                                    │
│ ? Keyboard shortcuts                    │                                                    │
└────────────────────────────────────────┴────────────────────────────────────────────────────┘
```

**Row anatomy (`InboxRow`)**
- A 4px left bar in the kind's tint (§10.3).
- An unread dot ● (forest).
- Title line: ref, kind label and subject.
- Meta line: who · flag · age.
- A preview, in italic quotes.
- On the right: the urgency pill, plus the assignee avatar or a muted "Not taken".
- **Age hint:** after 48 hours with no first response, the age becomes a marigold "Waiting 3 days". After 5 days it becomes the urgent style, for support requests only.
- On hover (desktop) or on a phone, the row's next-step button appears.

**Tabs**
- **New:** items in the kind's first status, not snoozed. This is the default tab.
- **Later:** snoozed items, which come back automatically when the snooze ends.
- **Mine:** every open item assigned to me, across all kinds and stages.

**Phone**

```
┌──────────────────────────────┐
│ Inbox                (◔)(AJ) │
│ (New 12)(Later 3)(Mine 7)    │
│ (All)(Requests)(Concerns)(Gi…│ ← one scrolling chip row; "Filters" chip opens a sheet with Urgency/Who/Sort
├──────────────────────────────┤
│ ● S26-0142 · School fees     │
│   Fatou C. · [GM] · 2 h  Urgent │
│   "My daughter was sent…"    │
├──────────────────────────────┤
│◀ swipe right ───────────────▶│
│ ██ TAKE IT ██  (forest)  ○ D26… │  ← dragging right reveals forest "Take it"
├──────────────────────────────┤
│ ○ V26-0051 … ◀── LATER ██████│  ← dragging left reveals marigold "Later"
└──────────────────────────────┘
```

**Swipe (`SwipeRow`)**

| Direction | Action | Colour |
|---|---|---|
| Right | **Take it**: assign to me, and the status moves to "Under review" (or the kind's equivalent) | Forest |
| Left | **Later**: a small sheet offers *Later today (4 pm)* · *Tomorrow morning* · *Next Monday* · *Pick a date* | Marigold |

- **Commit point:** 35% of the row width or 96px, whichever is smaller. The row follows the finger, and `touch-action: pan-y` keeps vertical scrolling. The direction locks after 10px of movement. `navigator.vibrate(8)` fires on commit where supported.
- **Undo:** every swipe shows a toast, "You took S26-0142 · Undo", for 6 seconds.
- **Where swipe is off:** concern rows and any row you can't write to. A tooltip on long-press explains why.
- **Same actions without swiping:** long-press (phone) or ⋯ (desktop) opens the row's action menu. Swipe is never the only way.
- **Multi-select:** on a phone, long-press then "Select". On desktop, `x`. A bottom bar offers Take · Hand to… · Later · Done (messages only).

**Keyboard** (`lib/admin/hotkeys.ts`; ignored while typing in a field; listed in a `?` sheet)

| Key | Action | Key | Action |
|---|---|---|---|
| `j` / `↓` | Next row | `k` / `↑` | Previous row |
| `Enter` / `o` | Open | `Esc` | Close detail / clear selection |
| `t` | Take it | `l` | Later… |
| `a` | Hand to… (person picker) | `s` | Change stage… |
| `n` | Add a note (focus composer) | `d` | Done (messages only) |
| `x` | Select row; `Shift+x` range | `/` | Search the inbox |
| `g` then `t i r g c w p` | Go to Today, Inbox, Requests, Giving, Counselling, Website, Posts | `Ctrl/⌘ K` | Find |

**Empty states**
- **New, nothing left:** EmptyArt "paper plane". "All caught up. Lovely. New requests will appear here the moment they arrive."
- **Later:** "Nothing put aside for later."
- **Mine:** "Nothing assigned to you. Take something from New when you're ready."

### 6.4 Request (case) view: support requests

**Purpose:** see the whole story of one request and move it forward. Covers §12 "Support requests" and the §13 status flow.

**Desktop (detail pane or full page, ≥ 1280px: two columns)**

```
┌ ‹ Requests ────────────────────────────────────────────────────────────────────────────────┐
│ S26-0142 · School fees                                                         [⋯ More]    │
│ (Education) (Urgent) (Immediate danger: No)   via website · Thu 9 Oct, 10:12               │
│                                                                                            │
│ Stage                                                                                       │
│  ●━━━━━━●━━━━━━◉─ ─ ─○─ ─ ─ ─○─ ─ ─ ─ ─ ─○─ ─ ─ ─ ─ ─○─ ─ ─ ─○                              │
│  New  Under   Assigned Referred Approved Support in   Completed Closed                     │
│       review                             progress                                          │
│  Next: [Record a referral →]   or  [Approve support]  [Ask for more information]  ⋯        │
│                                                                                            │
│ Looking after this: (AJ) Awa Jallow  [Change]          Programme: Education ▾              │
├──────────────────────────────────────────────────────┬─────────────────────────────────────┤
│ Timeline                         (All)(Notes)(Emails) │ About the person asking              │
│                                                      │ Fatou C. · Mother                     │
│  ┌ Note · Awa · 10:40 ─────────────────────────────┐ │ [GM] The Gambia · Prefers WhatsApp      │
│  │ (sticky-note card, sand bg)                      │ │ Phone  +220 ••• ••42   [Show]         │
│  │ Spoke to the school. Fees are GMD 4,500 for the  │ │ Email  f•••@gmail.com  [Show]         │
│  │ term. @Nur can we cover from the Education fund? │ │ Consent to contact ✓ 9 Oct 10:12      │
│  └──────────────────────────────────────────────────┘ │ Privacy acknowledged ✓                │
│  ○ Awa moved this to Assigned · 10:38                 │                                     │
│  ✉ Email sent: "We've received your request" · 10:12  │ About the child                       │
│  ○ Submitted on the website · 10:12                   │ Age range 10–12 · Needs: school fees, │
│    "My daughter was sent home because the fees…"      │ uniform                               │
│    [Show the full request]                            │                                     │
│                                                      │ Files (secure)                        │
│ ┌ Composer ─────────────────────────────────────────┐│ fee-letter.pdf · 120 KB  [View]       │
│ │ (Note)(Email Fatou)(Log a call)(Referral)          ││ (views are recorded)                  │
│ │ [Write a note only the team can see… @ to mention] ││                                     │
│ │                                   [Add note]       ││ Linked                                │
│ └────────────────────────────────────────────────────┘│ ◷ A26-0101 Counselling · Scheduled   │
│                                                      │ ♥ D26-0310 GMD 4,500 · Allocated here │
└──────────────────────────────────────────────────────┴─────────────────────────────────────┘
```

**Phone**

```
┌──────────────────────────────┐
│ ‹  S26-0142           ⋯      │
│ School fees · (Urgent)       │
│ ●━●━◉ ─ ○ ─ ○ ─ ○ ─ ○ ─ ○     │ ← compact stepper, scrolls sideways, current step centred
│ Assigned · Awa Jallow        │
│ (Timeline)(Details)(Files)   │ ← tabs
│ …timeline…                   │
├──────────────────────────────┤
│ [ + Note ]  [ Record a referral → ] │ ← sticky action bar (replaces the dock)
└──────────────────────────────┘
```

On a phone, **+ Note** opens the composer as a bottom sheet with the four composer modes as a Segmented control.

**Header**
- The category chip uses the programme icon and colour.
- The urgency pill follows §10.3.
- "Immediate danger: Yes" renders as a deep-green restricted chip, "Safeguarding team alerted", and links to the alert entry.

**StatusStepper (§7, §9.2)**
- The main path shows as dots joined by lines: done, current (◉) and future (○). A skipped step shows dotted, for example Referred when a request goes straight to Approved.
- **More information required** is not a separate dot. When it is the status, the current dot gets a marigold "Waiting for Fatou since 3 Oct" flag.
- **Declined** shows as a neutral off-ramp at the end of the line. It is deliberately not red, because declining is a normal outcome and not an error.
- **Next:** up to two verb buttons for the most likely transitions, plus a ⋯ menu listing every allowed transition (from `next[]`). Transitions that need input open a sheet:
  - **Referred** → `ReferralSheet`: who, from People › Directory or new; service; date; contact; "Fatou agreed we can share her details" (a required sentence checkbox).
  - **More information required** → email composer preloaded with the template "We need a little more information".
  - **Declined** → `DeclineSheet`: an internal reason (list plus text), then "Email Fatou?" as choice cards: **Send a kind note with other places to try** / **Don't email** (for example, when she was told by phone). This **confirms**, because it may send an email.
  - **Closed** → reason: Support delivered · Declined · Duplicate · No response · Withdrawn · Other.
  - **Reopen** (from Closed) → requires a reason; programme officers and super admins only.
- Moving a stage animates the line fill (§11) and shows a toast with Undo, except when an email is sent.

**Assignment.** "Looking after this" is a `PersonPicker` limited to staff who may write Requests.
- Choosing someone while the status is "Under review" moves it to **Assigned** automatically and says so: "Assigned to Awa, and moved to Assigned."
- The person picker shows each colleague's open load ("Awa · 7 open").

**Timeline**
- Newest first, with filters for All · Notes · Emails · Stage changes.
- Notes are sticky-note cards (sand background, umber text, with a slight -0.4° tilt on desktop as a Donat touch; flat when reduced motion is on).
- Emails show the subject and an expandable body.
- Stage changes are single muted lines.
- The original submission is pinned at the bottom with "Show the full request". This opens a sheet listing every form field from §6 with its label.

**Composer modes**
- **Note:** internal; `@` mentions notify the person.
- **Email Fatou:** a template picker (*We've received your request* · *We need a little more information* · *Good news* · *We've referred you* · *We're sorry we can't help this time* · *Write my own*). It shows a preview of exactly what is sent, and the subject is locked to a general wording (§8). Sending asks for confirmation.
- **Log a call:** outcome (Reached · No answer · Left a message), then a note.
- **Referral:** opens `ReferralSheet`.
- Composer text is saved per ref in `localStorage` until it is sent.

**⋯ More**
- Change category or programme.
- Book a counselling session (creates a linked `A` record).
- Put a gift towards this request (finance only).
- **Raise a safeguarding concern** (creates a linked `C` record; the request gets a restricted chip).
- Merge with another request (duplicates).
- Print summary (no contact details).
- Close and put away.

**Details panel**
- Contact fields are masked unless you are the assignee, a safeguarding officer or a super admin. **Show** reveals the value for 60 seconds and logs the view.
- The child section never shows a name: only the age range and needs (§15).

**Requests list** (`/admin/requests`, split view)
- Stage chips with counts: All open · New · Under review · More info · Assigned · Referred · Approved · In progress · Completed. A "Show closed" link sits at the end.
- Segmented control: **Mine / Everyone**.
- Rows use `InboxRow` with a stage pill instead of the preview.
- Desktop adds a compact column layout above 1280px: ref · person · category icon · flag · stage · officer · last activity.
- Phones use card rows.

### 6.5 Safeguarding (restricted)

**Purpose:** §7 workflow, visible only to authorised staff. It should feel serious, quiet and safe, not playful.

**Visual difference**
- The page canvas is `restricted-soft` (#e7eeeb).
- The header band is deep (#14332b) with white text and a lock.
- There is no Caveat, no doodles and no celebration hearts.
- The `RestrictedBanner` stays fixed under the bar: "Safeguarding team only. Every view is recorded."

**Step-up on entry.** If the last sign-in was more than 30 minutes ago, the **Confirm it's you** sheet appears: password, or the sign-in code. It does not reappear within the same 30 minutes.

**List**

```
┌█ [lock] Safeguarding · Safeguarding team only. Every view is recorded. ██████████████████████████┐
│ (Open 4) (Immediate 1) (Follow-ups due 2) (Closed)                                          │
├──────────────────────────────────────────┬──────────────────────────────────────────────────┤
│ C26-0007 · ◆ Risk not set   · 40 min     │                                                  │
│   Age 6–8 · [GM] · Not taken               │                                                  │
│ C26-0006 · ◆ Immediate      · Escalated  │                                                  │
│   Age 12–14 · [SN] · (MS) Maria            │                                                  │
└──────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

List rows show **only** the ref, risk, stage, age range, country, assignee and age of the concern. There is no narrative and no reporter name.

**Concern view**

```
┌█ C26-0007 · Safeguarding concern ███████████████████████████████████████████ [⋯] ┐
│ Received Thu 9 Oct, 09:31 · via website · Reporter: Anonymous                    │
│                                                                                  │
│ How serious is this?      (required before anything else)                        │
│ ┌ Low ───────────┐┌ Medium ────────┐┌ High ──────────┐┌ Immediate ────────────┐  │
│ │ No current harm ││ Needs action   ││ Harm likely    ││ Child in danger now   │  │
│ │ follow up       ││ this week      ││ act today      ││ escalate now          │  │
│ └─────────────────┘└────────────────┘└────────────────┘└───────────────────────┘  │
│                                                                                  │
│ What we've done (§7)                                                             │
│  ✓ Received and alert sent to the safeguarding team · 09:31                      │
│  ○ Reviewed and risk level set                         [Set risk above]          │
│  ○ Escalated (High or Immediate only)                  [Escalate now]            │
│  ○ Services or authorities contacted                   [Record contact]          │
│  ○ Actions and follow-ups                              [Add follow-up]           │
│  ○ Closed (two-person sign-off for High and Immediate)                            │
│                                                                                  │
│ The concern                         │ Safe follow-up                              │
│ Nature: (full text)                 │ Method: Phone · Time: after 6 pm             │
│ Child's approximate age: 6–8        │ Danger now: Yes / No / Unsure                │
│ Location (as given): …              │ Authorities already contacted: No            │
│ Relationship: Neighbour             │ Reporter contact: (masked) [Show]            │
│                                                                                  │
│ Timeline (restricted)  · Composer: (Note)(Record contact)(Follow-up)              │
│ Who has opened this: (MS) Maria 09:40 · (EJ) Emanuel 10:02                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Behaviour**

- **Risk cards** are `ChoiceCards` with one-sentence definitions taken from Haven's policy. The definitions above are placeholders until the policy review (§17).
  - Choosing **Immediate** opens a confirm sheet: "Escalate now?" It alerts every safeguarding officer and super admin by email, with the general subject "Urgent item for the safeguarding team", and in-app.
  - The sheet also shows the emergency notice from Key information, and a contact list of authorities from People › Directory filtered to *protection*.
- **Record contact** sheet:
  - agency;
  - person;
  - phone;
  - date and time;
  - their reference number;
  - what was agreed;
  - next follow-up date, which becomes "Follow-ups due".
- **Closing** a High or Immediate concern needs a second safeguarding officer, or a super admin if only one safeguarding officer exists, to press **Confirm closure**. Until then it shows "Waiting for a second sign-off".
- **No email to the reporter** goes out from here except the optional general receipt, sent only when contact details were given with consent. The reporter's identity is never shown in the Inbox, Find or Activity.
- **"Who has opened this"** is visible to safeguarding officers, for transparency.
- **Phones:** the same content in one column. The risk cards form a 2×2 grid, and the sticky action bar shows the next §7 step ("Set risk level", "Record contact", and so on).

### 6.6 Giving (donations)

**Purpose:** §8 and §12 "Donations": record, acknowledge, put towards programmes, report. Also the owner's direction: donors see exactly where money goes, and finance edits that here.

**Sub-tabs:** **Gifts** (ledger) · **Causes** · **Where it goes**. Page actions: **[♥ Record a gift]** (primary) and **[Download a spreadsheet]**.

**Ledger, desktop**

```
┌ Giving ─────────────────────────────────────────────────────────────────────────────────────┐
│ (Gifts)(Causes)(Where it goes)                     [♥ Record a gift]  [Download a spreadsheet]│
│ ┌ This month ───────────────────────────────────────────────────────────────────────────┐   │
│ │ GMD 48,500 · USD 3,120 · GBP 240        4 thank-yous to send   6 not yet put towards  │   │
│ └────────────────────────────────────────────────────────────────────────────────────────┘   │
│ (All)(Money)(In kind)  (Online)(Recorded by us)  Stage ▾  Programme ▾  October 2026 ▾  ⌕     │
│                                                                                             │
│ ── Thursday 9 October ──────────────────────────────────────────────────────────────────── │
│ ♥ D26-0311  Omar H. [GB]        USD 200   Monthly   Medical Fund      (Received)  [Say thank you] │
│ ♥ D26-0310  Anonymous [GM]      GMD 5,000 One-time  Where needed most (Acknowledged) [Put towards…]│
│ ▣ K26-0021  Fatima B. [GM]      In kind ≈ GMD 12,000 School materials (Pending) [Arrange pickup] │
│ ── Wednesday 8 October ─────────────────────────────────────────────────────────────────── │
│ …                                                                         Load September →  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Phones:** each gift is a card. The amount is Inter 600 at 20px top-left, the stage pill top-right, then the donor · flag · frequency, then the programme, then a full-width next-step button.
- **Totals:** per currency only. `lib/money.ts` `money()` formats every amount with the ISO code first, as on the public site.
- **Next-step button per row:**

  | Stage | Button |
  |---|---|
  | Pledged | Confirm it arrived |
  | Pending | Mark received |
  | Received, thank-you not sent | Say thank you |
  | Thank-you sent, not fully put towards anything | Put towards… |
  | Allocated | Mark complete |

**Gift view** (`/admin/giving/[ref]`)

```
┌ ‹ Giving ───────────────────────────────────────────────────────────────────────────────┐
│ D26-0311                                                                      [⋯]       │
│ USD 200   (Anton 56)   Monthly · Card (Visa ••4242) · via Stripe                         │
│ Omar H. · [GB] United Kingdom · Individual · Happy to get updates ✓ · Show name on site ✓ │
│ Stage: ●━━●━━◉─ ─○─ ─○─ ─○      Pledged · Pending · Received · Acknowledged · Allocated · Completed │
│                                                                                         │
│ ┌ Say thank you ──────────────────────┐ ┌ Put it towards ────────────────────────────────┐ │
│ │ Receipt RC-2026-0311 not sent yet    │ │ Donor chose: Medical Fund for Children in Need │ │
│ │ [Send thank-you and receipt]         │ │ Medical Fund ……………………… USD 200   [Change]     │ │
│ │ [Print receipt]                      │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ All of it is placed ✓      │ │
│ └──────────────────────────────────────┘ └────────────────────────────────────────────────┘ │
│ Timeline · Omar's other gifts (3) · Payment details (Stripe ref, last 4 only)               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Status is derived from the facts.** The stepper shows spec order: Pledged → Pending → Received → Acknowledged → Allocated → Completed, with Cancelled as an exit. The two checklist cards drive it:
  - sending the thank-you sets **Acknowledged**;
  - when allocations add up to the full amount, the gift becomes **Allocated**, once it is also acknowledged;
  - if it is allocated first, it stays Received with an "Allocated ✓ · thank-you still to send" note until the thank-you goes;
  - **Completed** is a manual "Mark complete" once the funds or goods are committed or given out.
- **AllocationEditor:**
  - rows of *programme or cause → amount*, with "＋ Split across another";
  - a remaining-amount bar: "GMD 1,000 left to place";
  - when the gift's currency differs from a cause's currency, a second field asks: "How much does this add to the USD 5,000 goal?" It is prefilled from the helper rate in Settings › Giving and always editable.
- **Card data:** the page shows only the brand, last 4 digits and the Stripe reference. §8 "never store full card details" is a data-layer guarantee, and the UI never asks for card numbers.
- **In-kind view:** same layout, different content:
  - item chips (from `content/home.ts` `donate.inKind`), description, quantity and estimated value with currency;
  - a **Pickup or drop-off** card: date, place and person, then "Arranging pickup" (Pending) → "Received";
  - **Put towards** a programme with a quantity description;
  - the in-kind follow-up email (§14) is offered when you move the offer to Pending.

**Record a gift** (global sheet `?do=record-gift`; three steps with a dot progress row; desktop sheet 560px, phone full-height bottom sheet)

```
Step 1 · Who gave?                 Step 2 · What did they give?         Step 3 · Where should it go?
⌕ Find someone who gave before     ┌ Money ┐ ┌ In kind ┐ (choice cards)  ( Where it's needed most )
— or someone new —                 Currency (GMD)(USD)(GBP)(EUR)       Programmes: 6 icon tiles
Name [               ]             Amount [ GMD  5,000 ]               Causes: list with progress
(Individual)(Organisation)         How: (Cash)(Bank transfer)          Has it arrived?
Email / phone (optional)                (Mobile money)(Cheque)(Other)  ┌ Yes, we have it ┐┌ It's a promise ┐
Country ▾                          Date received [ 9 Oct ]               (Received)          (Pledged)
(Show their name)(Keep anonymous)  How often: (Once)(Monthly)          Send a thank-you now?
                                     (Quarterly)(Yearly)               ┌ Send thank-you and receipt ┐┌ Not now ┐
                                   Reference no. (optional)
                                                                       [Record this gift]
```

- On success: `Celebrate` (a marigold heart pops) and the toast "Gift recorded · D26-0312 · Open".
- Recurring offline gifts create a gentle reminder on Today for the next expected date, for example "Omar's monthly gift is due". Phase 1 does not chase anyone automatically.
- **Receipt** (`/admin/giving/[ref]/receipt`): a print-styled page (A4 and Letter).
  - Organisation details come from Key information and the registration number from Settings › Giving.
  - It shows the receipt number `RC-YYYY-NNNN`, the donor (or "Anonymous donor"), amount, date, frequency, and the footer text from Settings.
  - The same content is sent as the HTML donation-acknowledgement email. PDF files are Phase 2; "Print or save as PDF" is the Phase 1 answer.

**Causes** (`/admin/giving/causes`): cards with `ProgressBar` showing raised/goal, money in the cause's currency, a status chip (**Live · Upcoming · Ended · Hidden**) and **[Copy link]** to that cause's shareable donate page.

**Cause editor** fields:
- Title, season or group, programme, country (`CountryPicker` with flags), currency, goal.
- Image, through the `MediaPicker` with the consent gate.
- Short description.
- Start and end dates.
- Where it appears: **Home page appeals** and/or **Donate page**, as sentence checkboxes.
- **Where the money goes:** rows of label and % (e.g. *School fees 60% · Uniforms and books 25% · Transport 10% · Running costs 5%*). They must total 100%. A live `BreakdownBar` (a stacked bar in earth tones, the same component the public donate page uses) shows the result, and "Adds up to 100% ✓" turns forest when it does.
- Goal, currency and breakdown are editable by finance and super admins. Wording and image are also editable by content managers.
- **Raised** is computed from allocations and is never typed. Finance can add a "Raised before Haven's records began" opening balance, with a note.

**Where it goes** (`/admin/giving/where-it-goes`): a year selector. For each currency, one horizontal stacked bar per programme (received vs. put towards vs. not yet placed). Below that, a list of programmes and causes with totals. Spending and distribution tracking beyond allocation is Phase 2 ("advanced financial reports").

**Download a spreadsheet** (sheet)
- **What:** Gifts · In-kind offers · Allocations.
- **When:** This month · Last month · This year · Choose dates.
- **Currency:** All, or one.
- **Programme.**
- **"Include names, emails and phone numbers"** (finance and super only). Leaving it unchecked replaces names with refs. Checking it requires step-up and is logged.

The file is CSV in UTF-8 with a BOM so Excel opens it cleanly. **Every cell starting with `= + - @` is prefixed with `'`** to block spreadsheet formula injection.

### 6.7 Counselling

**Purpose:** §5.4 and §12 "Counselling": review requests, assign a counsellor, schedule, attach or generate a Zoom link, notify, record attendance, keep limited notes.

**Desktop**

```
┌ Sessions ────────────────────────────────────────────────────────────────────────────────────┐
│ ‹  Mon 6  Tue 7  Wed 8  (Thu 9)  Fri 10  Sat 11  Sun 12  ›      Counsellor: (All) ▾  [Book a session] │
│     ••      •     •••    ◉••       •                       ← dots = sessions per day          │
├────────────────────────────────────────────────────────┬─────────────────────────────────────┤
│ Thursday 9 October                                     │ Waiting for a time (4)               │
│ ┌──────────────────────────────────────────────────┐   │ ┌──────────────────────────────────┐ │
│ │ 10:00–10:45  A26-0098 · Aminata (client)          │   │ │ A26-0104 · Rahul · from S26-0140 │ │
│ │ (AM) Ayesha · (Zoom ready) (Confirmed)            │   │ │ Prefers mornings · 2 days        │ │
│ │ 03:00 in California                [Join Zoom]    │   │ │            [Find a time]         │ │
│ └──────────────────────────────────────────────────┘   │ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐   │ …                                    │
│ │ 14:30–15:15  A26-0099 · Rahul                      │   │                                      │
│ │ (AM) Ayesha · (No Zoom link yet) (Scheduled)       │   │                                      │
│ │                         [Add Zoom link]            │   │                                      │
│ └──────────────────────────────────────────────────┘   │                                      │
│ Yesterday, how did it go?                               │                                      │
│ ┌ A26-0097 · Grace · 16:00 ─────────────────────────┐   │                                      │
│ │ [They came]  [They didn't make it]  [Rescheduled] │   │                                      │
│ └───────────────────────────────────────────────────┘   │                                      │
└────────────────────────────────────────────────────────┴─────────────────────────────────────┘
```

- **Phones:** the week strip scrolls sideways at the top. "Waiting for a time (4) →" becomes a marigold banner above the agenda that opens the waiting list. Session cards stack. On the day of a session, the card's button is a full-width **Join Zoom**.
- **Client naming:** first name plus ref only. No surnames appear in lists.

**Session view** (`/admin/counselling/[ref]`)
- **Client:** first name and ref, plus the linked request (from Requests) if any.
- **Counsellor:** a `PersonPicker` limited to counsellors, showing their load ("Ayesha · 3 this week").
- **When:** date, start time and length (30 · 45 · 60 minutes). It shows both offices' times ("10:00 in The Gambia · 03:00 in California"). Each staff member's own timezone comes first.
- **Zoom:**
  - "Paste the Zoom link", validated against `https://*.zoom.us/j/…`, with an "Open to test" link.
  - **[Create a Zoom meeting]** appears only when the Zoom integration is connected (§14). Otherwise a quiet line reads: "Creating links automatically isn't connected yet. Paste a link from Zoom for now."
- **[Send the invitation]** sends the counselling confirmation email (§14) to the client, with the date in their timezone and an `.ics` file. Status becomes **Confirmed**. Reminders (the Zoom reminder in §14) go automatically 24 hours and 1 hour before, through the scheduled job the architecture doc owns. A line confirms it: "Reminders will go 24 h and 1 h before ✓".
- **Attendance:** after the end time, the three big buttons appear (as in the agenda).
  - **Missed** offers "Offer a new time", which creates a linked session.
  - **Attended** opens the follow-up note.
- **Follow-up note:**
  - capped at 1,000 characters, with the hint "Short notes to plan the next step. No diagnoses here." (§5.4, §15);
  - visible only to the counsellor, safeguarding officers and super admins;
  - includes "Something worrying? [Raise a safeguarding concern]".

**The counsellor's own view:** Today leads with the **Next session** card. The dock shows "My sessions", and that view shows only their own sessions, with no "Counsellor" filter.

### 6.8 Reports & resources (`/admin/library`)

**Purpose:** §9 and §12 "Resources": upload, previews, public or controlled access, review requests, approve delivery by email, record activity.

**Tabs:** **Resources** · **Requests (3)**.

```
Resources (grid, 3 columns desktop, 1 phone)
┌──────────────────┐ ┌──────────────────┐
│ [cover]          │ │ [cover]          │
│ Annual Report    │ │ Safeguarding     │
│ 2025             │ │ Policy           │
│ (Annual reports) │ │ (Organisational) │
│ (On request [lock])  │ │ (Free download)  │
│ 12 requests · 3 waiting│ │ 248 downloads    │
└──────────────────┘ └──────────────────┘
[＋ Add a report or resource]
```

**Add or edit a resource**
- **File:** drop or choose a PDF, up to 25 MB.
- **Title.**
- **Category:** one of the 10 from §9, as a chip list.
- **Publication date.**
- **Short description** (max 200 characters).
- **Summary or preview:** rich text, shown publicly.
- **Cover image:** `MediaPicker`, or "Use a plain Haven cover", which generates a forest cover with the title.
- **Who can get it?** Choice cards:
  - **Anyone can download it** ("It appears on the website with a Download button.")
  - **People must ask first** ("They fill in a short form; you approve each one.") This is for sensitive reports, per §9 "Access".
- **Show it on the website:** Segmented **Showing / Hidden**.

**Requests** (split view)

```
R26-0033 · Annual Report 2025
Requested by Dr. Sana A. · Partner clinic · [PK] · sana@…(masked) [Show]
Reason: "Preparing a joint proposal on child health referrals."
Stage: New → Under review → Approved → Sent    (Declined / Closed)
[Approve and send]   [Decline]   [Ask a question]
```

- **[Approve and send]** confirms, then sends the "approved report delivery" email with a 7-day download link (signed Storage URL, or a tokenised route in practice mode). The status moves Approved → Sent in one step.
  - If email isn't connected, it stays **Approved** and shows [Copy the download link] so staff can send it themselves.
- **[Decline]**: an optional kind note from a template, then a confirm.
- The request confirmation email (§14) goes automatically when a request arrives.

### 6.9 People: volunteers and partners

**Purpose:** §10 and §12 "Volunteers and partners": review, categorise skills, update status, assign follow-up, export contacts.

**Desktop: a gentle kanban**

```
┌ People ── (Volunteers 31)(Partners 9)(Directory) ──────── [⌕] [Interests ▾] [Download contacts] ┐
│ ╭ Submitted 4 ╮ ╭ Screening 3 ╮ ╭ Interview 2 ╮ ╭ Approved 1 ╮ ╭ Onboarding 2 ╮ ╭ Active 15 ╮ │
│ │ ~~~~~ brush  │ │             │ │             │ │            │ │              │ │           │ │
│ │┌───────────┐│ │┌───────────┐│ │             │ │            │ │              │ │           │ │
│ ││Aminata S. ││ ││Rahul P.   ││ │             │ │            │ │              │ │           │ │
│ ││[SN] Senegal ││ ││[IN] India    ││ │             │ │            │ │              │ │           │ │
│ ││(Education)││ ││(Medical)  ││ │             │ │            │ │              │ │           │ │
│ ││(Outreach) ││ ││(Research) ││ │             │ │            │ │              │ │           │ │
│ ││3 days (AJ)││ ││Waiting 16d││ │             │ │            │ │              │ │           │ │
│ │└───────────┘│ │└───────────┘│ │             │ │            │ │              │ │           │ │
│ ╰─────────────╯ ╰─────────────╯ ╰─────────────╯ ╰────────────╯ ╰──────────────╯ ╰───────────╯ │
│  Resting: Inactive 3 · Not this time 5   (collapsed tray, click to open)                        │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Lanes and cards**
- Lanes are cream (`cream-2`), radius 22px. Each header has the stage name, a count and a short `Brush name="strokes"` underline in the stage tint.
- Cards are white with `shadow-card` and show:
  - name and flag;
  - up to two interest chips, plus "+3";
  - time in stage, which becomes a marigold "Waiting 16 days" after 14 days;
  - the follow-up person's avatar.

**Moving cards**
- Drag on desktop with `@dnd-kit`. The dragged card tilts 2° and the target lane glows mint.
- Dropping shows a toast with **Undo**. Some moves also offer a follow-up email:
  - → Interview: "Email them an interview invitation?"
  - → Approved: "Send the welcome email?"
  - → Not this time: "Send a kind note?"

  These are toast actions, never forced dialogs.
- Keyboard: focus a card, `m` opens "Move to…", and arrow keys pick the stage.

**Phone**

```
┌──────────────────────────────┐
│ People                       │
│ (Volunteers)(Partners)(Dir.) │
│ (Submitted 4)(Screening 3)(I…│ ← stage chips, scroll sideways
│ ┌──────────────────────────┐ │
│ │ Aminata S. · [SN] · 3 days  │ │
│ │ (Education)(Outreach)    │ │
│ │ [Move to Screening →] [⋯]│ │ ← one tap moves the card to the next stage
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

There is no drag on touch.

**Volunteer view**
- Interests (§10 list) and skills.
- Availability and languages.
- Country and how they heard about Haven.
- Consent to be contacted.
- Attachments.
- **Getting ready checklist** (configurable in Settings later; defaults): Read the safeguarding policy · References checked · Interview done · Code of conduct signed · Safeguarding training done. Checklist progress shows on the card as "3 of 5 ready".
- The follow-up person and next follow-up date (which appears on that person's Today).
- Timeline and composer, as on a request.
- The volunteer acknowledgement email goes automatically on arrival.

**Partners**
- Same pattern with stages **New → Talking → Agreement → Active → Paused**, and **Not this time** as the exit.
- Each card shows the organisation, its type (from the §10 types) and the contact person.

**Directory:** the referral partners used by the referral sheet and the safeguarding contacts. Each entry has a name, a service type (medical, legal, psychological, education, protection, family) and contact details, plus an "Approved by Haven" checkbox with date, because §5 asks for *approved* professionals.

**[Download contacts]** follows the same rules as the Giving export: it includes only people who consented to be contacted, and it is logged.

### 6.10 Website: the in-context content studio

**Purpose:** owner's direction ("editing landing-page content and key information") and §12 "Content". Staff edit what they can *see*.

**Desktop (≥ 1280px)**

```
┌ Website ─────────────────────────────────────────────────────────────────────────────────────┐
│ Page: [Home ▾]     View: (Phone)(Tablet)(Desktop)       ● 3 changes not live yet [Review & put live] │
├───────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ Sections              │ ┌──────────────────── live preview (iframe, Draft Mode) ─────────────┐ │
│  Hero slides (7)    ✎ │ │                                                                    │ │
│  Partners strip     ✎ │ │   ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │ │
│  Programmes (6)     ✎ │ │   ╎  (hovered section: marigold dashed outline)                 ╎ │ │
│  About              ✎ │ │   ╎                                     ╭───────────────────╮   ╎ │ │
│  Volunteer & partner✎ │ │   ╎                                     │ ✎ Edit Hero slides│   ╎ │ │
│  Manifesto line     ✎ │ │   ╎                                     ╰───────────────────╯   ╎ │ │
│  Impact numbers  (!) ✎ │ │   └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │ │
│  Focus slides       ✎ │ │                                                                    │ │
│  Appeals → Giving   ↗ │ │                                                                    │ │
│  …                    │ │                                                                    │ │
│ ───────────────────── │ └────────────────────────────────────────────────────────────────────┘ │
│ * Key information     │                                                                      │
└───────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

The **Sections** outline is a floating card, collapsible with `[` . It is part of this screen, not the site navigation. Below 1280px it collapses into a **Sections** button that opens a sheet.

**How it works**
1. `StudioFrame` renders `<iframe src="/api/admin/studio/preview?path=/">`.
   - The route handler checks the staff session (website: read), enables Draft Mode (`draftMode().enable()`; `docs/01-app/02-guides/draft-mode.md`) and redirects to `/?studio=1`.
   - In Draft Mode the public content loader returns the **draft** version of each content document. The loader belongs to the content doc; its contract is in §6.10.3 below.
2. Every editable public section is wrapped in `<StudioSlot id="home.hero">`.
   - The wrapper renders `<div data-studio-slot="home.hero" style="display:contents">` around the section, and only in studio mode. Otherwise it renders the children untouched.
   - The public layout renders `<StudioBridge/>` (client) only in studio mode. The bridge:
     - draws an overlay box over the hovered slot, using `firstElementChild.getBoundingClientRect()`, so the outline never changes the page's layout;
     - shows the "✎ Edit …" badge;
     - on click, sends `postMessage({ t: "haven:edit", id })` to the parent.

     In studio mode the bridge also sets `data-studio` on `<html>`, which (with one CSS rule in `globals.css`) forces `[data-reveal]` content visible, pauses autoplay carousels (hero, appeals, stories) through a `useStudioMode()` context, and disables Lenis.
3. The parent opens that slot's **SlotSheet**: a sheet generated by `SchemaForm` from the slot's fields in `lib/studio/registry.ts`.
   - Edits **autosave as draft** 800ms after typing stops ("Saved as a draft ✓ · not live yet").
   - After each save, the parent posts `{ t: "haven:refresh" }` and the bridge calls `router.refresh()` inside the iframe, so the preview shows the draft about a second later.
4. **[Review & put live]** opens the `PublishSheet`:
   - a readable list of changes ("Hero slide 2 · headline", "FAQ · new question 'Can I visit?'", "Impact · Families reached 640 → 655 (checked by Awa)");
   - a per-change **Undo this change** link;
   - **[Put these changes live]** (confirm).

   Publishing is a server action that copies draft to published and calls `updateTag("content:<page>")` for read-your-own-writes (`.../04-functions/updateTag.md`).
5. **History:** `/admin/website/changes` lists past publishes (who, when, what) with **Bring this version back**, which creates a draft from it.
6. **Device switch** sets the iframe width (390 · 820 · 1280, scaled to fit). Phone width is the default on phones.

**Bridge messages**

```ts
// lib/studio/bridge.ts
export type ToStudio =   // iframe → admin
  | { t: "haven:ready"; slots: { id: string; top: number; height: number }[] }
  | { t: "haven:edit"; id: string };
export type ToPreview =  // admin → iframe
  | { t: "haven:refresh" }
  | { t: "haven:scrollTo"; id: string }
  | { t: "haven:highlight"; id: string | null };
// Both sides check event.origin === window.location.origin and ignore anything else.
```

**Schema-driven editors** (one renderer, every sheet consistent)

```ts
// lib/studio/schema.ts
export type FieldSpec =
  | { kind: "text"; key: string; label: string; max: number; hint?: string; required?: boolean }
  | { kind: "longText"; key: string; label: string; max: number; hint?: string }
  | { kind: "rich"; key: string; label: string; marks?: ("bold" | "italic" | "link")[] }
  | { kind: "image"; key: string; label: string; aspect?: string; publicUse: true }  // consent-gated
  | { kind: "media"; key: string; label: string; accept: ("image" | "video")[]; publicUse: true }
  | { kind: "country"; key: string; label: string }                                  // content/world.ts
  | { kind: "stat"; key: string; label: string }                                     // number + suffix + verified
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: "tone"; key: string; label: string; options: ("forest" | "marigold" | "clay" | "cocoa" | "flame")[] }
  | { kind: "link"; key: string; label: string }
  | { kind: "list"; key: string; label: string; item: FieldSpec[]; min?: number; max?: number;
      itemLabel: string /* template, e.g. "{eyebrow}" */; sortable?: boolean; showHide?: boolean };

export interface StudioSlot {
  id: string;            // "home.hero" (matches data-studio-slot)
  page: string;          // registry page key
  label: string;         // "Hero slides"
  help: string;          // one sentence shown at the top of the sheet
  fields: FieldSpec[];
  keywords?: string[];   // for Find
  managedIn?: string;    // e.g. "/admin/giving/causes": sheet shows a summary + link instead of fields
  roles?: Role[];        // narrower than the website grant, e.g. emergency notice
}
```

**SchemaForm rules**
- **Character counters** (`CharCount`) show "22 / 26" and turn marigold within 10% of the limit. The limit is hard, because it protects the design.
- **List editors** show items as compact cards with a thumbnail and `itemLabel`, drag handles on desktop, ↑/↓ buttons on phones, a Showing/Hidden segmented control per item, and **＋ Add**.
- **Image fields** open the `MediaPicker` (§6.13). A photo that shows a child without recorded consent cannot be chosen; the picker explains why.

**Home page slots** (limits come from the current design and `content/home.ts`)

| Slot id | Label | Fields (limits) |
|---|---|---|
| `home.hero` | Hero slides | slides 3–8 × { eyebrow (32), headline line 1 (26), headline line 2 (30), country, picture or film }, intro text (260) |
| `home.partners` | Partners strip | title parts; logos × { name, logo image, link, "We have written permission to show this logo" (required) } |
| `home.programmes` | Programmes | 6 × { title (28), headline (48), summary (220), services ×4 (60), notice (120) }. Also feeds the programme pages |
| `home.about` | About | eyebrow, title (60), two paragraphs (420 each), 4 values { label (18), tone }, vision (160), picture |
| `home.duo` | Volunteer and partner cards | 2 × { title (28), text (180), button label (18), picture } |
| `home.manifesto` | Manifesto line | line (70). The word "HAVEN" is the brand and is not editable |
| `home.impact` | Impact numbers | title parts, text (160), 3 × stat { label (28), number, suffix, note (120), verified } |
| `home.focus` | Focus slides | 4 × { word (12), caption (110), picture or film } |
| `home.appeals` | Appeals | eyebrow, title, intro (200). Items **managed in Giving › Causes** (↗) |
| `home.donate` | Donate card | title parts, text (200). Currencies and presets **managed in Settings › Giving** |
| `home.doorsOpen` | "You do not have to face it alone" | title (50), text (220) |
| `home.stories` | Stories of hope | items × { label (30), meta (30), country, text (140), picture }. Hint: "No names. Country only." |
| `home.founder` | Founder | eyebrow, title (80), text (240), quote (160), name, role, portrait |
| `home.team` | Team | members × { name, role, portrait, social links } |
| `home.restoring` | Stats band | title, text, 4 × stat (verified) |
| `home.testimonials` | Testimonials | items × { name, role (50), quote (260), portrait, "Written permission on file" (required) } |
| `home.journey` | How we reach every child | title, text, 5 × { title (24), text (130), picture } |
| `home.projects` | Recent projects | 3 × { title, subtitle, picture, link } |
| `home.faq` | Questions | items × { question (100), answer (600) }, sortable |
| `home.join` | Join the Haven family | title parts, text (140) |
| `home.news` | News | Segmented: **Show the latest 3 posts / Choose 3 posts**. Posts **managed in Posts** |
| `global.ticker` | Ticker messages | messages × (80) |
| `global.footer` | Footer | statement text, link labels |

The other pages (About, each programme page with the §5 structure, Get Support, Report a Concern, Donate, Get Involved, Resources intro, Our Impact, Contact, the three policies) get registry entries the same way. Policies use a single `rich` field with section headings.

**Verified numbers (`stat` field)**
- When the number changes, a required sentence checkbox appears: "I've checked this figure against our records". Saving stores `verifiedBy` and `verifiedAt`. ToR §3 says only verified figures may be shown.
- Beside the field, a reference line reads "Haven's records show 1,214 children supported (completed requests, all programmes)", with [Use this number]. The data layer supplies the counts.
- An unverified stat never reaches the public page. The publish sheet blocks it: "Families reached hasn't been checked yet."

**Content contract (for the content doc)**
- `getContent(page)` returns the draft when `(await draftMode()).isEnabled` **and** a staff session cookie is valid.
- Published content is tagged `content:<page>` (`cacheTag` under Cache Components, otherwise `unstable_cache` tags), so publishing can expire exactly that page.
- The public layout renders `<StudioBridge/>` only when `searchParams.studio === "1"` and Draft Mode is on.
- `frame-ancestors 'self'` must allow the admin to frame the site.

**Draft Mode banner.** If staff browse the public site in the same browser while Draft Mode is on, a small sand ribbon reads: "You're seeing unpublished changes. [Exit preview]". It posts to `/api/admin/studio/exit`.

**Phone version of the studio**

```
┌──────────────────────────────┐
│ Website            [Home ▾]  │
│ ● 3 changes not live  [Review]│
│ ┌──────────────────────────┐ │
│ │[thumb] Hero slides · 7  ✎│ │ ← outline is the default view on phones
│ │[thumb] Programmes · 6   ✎│ │
│ │[thumb] Impact numbers (!) ✎│ │
│ └──────────────────────────┘ │
│ [ Preview the page ]          │ ← full-screen iframe; each slot shows a persistent
│ * Key information →          │   "✎" chip in its top-right corner (no hover on touch)
└──────────────────────────────┘
```

### 6.11 Key information (quick editor, `/admin/website/key-info`)

**Purpose:** the facts people change most often, editable in seconds, on a phone, with no hunting.

```
┌ Key information ─────────────────────────────────────────────────────────┐
│ The details that appear across the whole website.                        │
│ ┌ How people reach you ───────────────────────────────────────────────┐  │
│ │ Phone [ +220 000 0000 ]   Email [ hello@haven.org.gm ]                │  │
│ │ Offices: The Gambia [ Kanifing, … ]   United States [ California, … ] │  │
│ │                                         [Save and put live]          │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│ ┌ Social links ┐ ┌ Emergency notice (super admin) ┐ ┌ Tagline & founding year ┐ │
│ ┌ Ticker messages ┐ ┌ Bank details for transfers (finance) ┐               │
└──────────────────────────────────────────────────────────────────────────┘
```

- Each card saves on its own and goes **live straight away**, with a 10-second **Undo** toast ("Phone number is live · Undo"). This is the one deliberate exception to draft-then-publish, because these are small factual edits.
- Values come from `content/site.ts` (seeded) and become the `site` content document.
- **Emergency notice:** only super admins can edit it, with a caution line ("This wording protects children. Change it only after the safeguarding lead agrees."). Everyone else sees it read-only.
- **Founding year** shows the effect: "Shows as 16 Years of Service".
- Find finds every field ("phone", "address", "instagram", "tagline").

### 6.12 Posts: blog studio, updates, AI drafts

**Purpose:** the owner's direction: blog posting, posting updates, and a monthly AI-drafted article with human review. The founder prefers quick picture-and-paragraph stories (HANDOFF), so **Updates** are first class.

**Two kinds of post**
- **Update:** one photo plus one paragraph (max 600 characters), postable from a phone in a minute.
- **Article:** cover, title, summary and body blocks (the blog).

**Status:** Draft → Waiting for review → Scheduled → Live, plus Taken down. Each post records its origin: `human` · `ai_notes` · `ai_monthly`.

**List**

```
┌ Posts ─ (Drafts 2)(Waiting for review 1)(Scheduled 1)(Live 24) ── [✎ Post an update] [Write an article] ┐
│ ┌ ✦ The October draft is ready to review · drafted by the writing helper on 1 Oct  [Review] ┐ │
│ └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ [cover] Back to school: 50 children return     Article · Education · (Scheduled Fri 09:00) (SR) │
│ [photo] Health day in Banjul                   Update · Medical · (Live) · 2 days ago     (AJ) │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Update composer** (phone-first; also the global sheet `?do=post-update`)

```
┌──────────────────────────────┐
│ ✕  Post an update     Draft ✓│
│ ┌──────────────────────────┐ │
│ │   [ Take or choose a     │ │  ← opens camera on phones (accept="image/*" capture)
│ │     photo ]              │ │
│ └──────────────────────────┘ │
│ Does it show a child's face? │
│ (No) (Yes, consent on file)  │
│ (Yes, no consent yet)        │ ← this choice blocks "Put live", with an explanation
│ What happened?               │
│ [                          ] │
│ [                    212/600]│
│ Programme (Education ▾)      │
│ Country (The Gambia ▾)       │ ← country only, never towns (§15)
│ [✦ Help me write it]         │
├──────────────────────────────┤
│ [ Send for review ]  or  [ Put it live ] │ ← by role
└──────────────────────────────┘
```

Programme officers see **Send for review**. Content managers and super admins see **Put it live**, plus a "Schedule" option in a ▾ menu.

**Article editor**

```
┌ ‹ Posts      Draft · saved 10:42         [Preview] [Things to check 2] [Put live ▾] ┐
│ ┌───────────────────────────────────────────────────┐ ┌ Post settings ───────────┐ │
│ │ [ Cover picture: choose ]                          │ │ Programme  Education ▾   │ │
│ │ Title (Nunito 800, 40)                             │ │ Country    The Gambia ▾  │ │
│ │ Short summary (for cards and sharing, 200)         │ │ Author     Haven team ▾  │ │
│ │ ─────────────────────────────────────────────────  │ │ Web address /news/back-… │ │
│ │ Body: paragraphs, headings, lists, quotes …        │ │ When  (Now)(Schedule)    │ │
│ │                    [＋ Add]                         │ │ Sharing preview [card]   │ │
│ └───────────────────────────────────────────────────┘ └──────────────────────────┘ │
│ (✦ Help me write)  ← floating, bottom-left                                         │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Editor engine:** TipTap (`@tiptap/react` with StarterKit, Link, Image, Placeholder, plus custom nodes). Pin exact versions at install. The body is stored as ProseMirror JSON. The public renderer maps JSON nodes to React components; it never uses `dangerouslySetInnerHTML`. If the content doc picks another body format, only the editor adapter changes.
- **Formatting toolbar:** Bold · Italic · Link · Heading · List · Quote. It floats above the selection on desktop and sticks above the keyboard on phones. There are no hidden "/" commands.
- **[＋ Add]** between blocks opens friendly choices:
  - Paragraph · Heading · Picture (`MediaPicker`, consent gate) · Two pictures side by side · Quote · Highlighted note (callout, sand) · **Donate button** (pick a cause) · **Programme card** (pick a programme) · Divider.
- **Sharing preview:** a social card and a search snippet, built from the title, summary and cover.

**"Help me write" (AI assist)**, offered only when the AI connection is on (§14):
- **Draft from my notes:** a sheet where you paste notes or bullet points and optionally attach photos, then choose a length (Short update / Article of about 600 words), then **Write a draft**. The result fills the editor.
- **Make it shorter** · **Make it warmer** · **Fix spelling and grammar** · **Suggest 3 titles** · **Write the summary** · **Describe this photo** (alt text).
- Every result appears as a **suggestion card**: [Use this] · [Try again] · [Keep mine]. Nothing replaces your text silently.
- AI-written paragraphs carry a faint marigold left rule until a person edits them or ticks them.

**Things to check (`SafetyCheck`)** runs on every post before it can go live, and is required for AI-origin posts. Flagged sentences are highlighted in the body, and each has a checkbox, "I've checked this":
1. **Numbers** that don't match a verified figure or a figure in the source notes.
2. **Possible names** of children: a capitalised word near *girl, boy, child, daughter, son, aged N, orphan*.
3. **Places smaller than a country:** a capitalised word after *in/from/at* that isn't a country in `content/world.ts`.
4. **Health or diagnosis words:** *diagnosed, disorder, depression, HIV, trauma …*. Automated tools never diagnose (§15).
5. **Photos without consent**, or illustrative AI images. These need a caption line, "Illustrative image".

AI-origin posts also need a final sentence checkbox before **Put live** is enabled: "I've read every line and checked the facts." The name of whoever ticks it is stored.

**Monthly draft and review** (`/admin/posts/review/[id]`)
- On the configured day (default the 1st, 08:00 Africa/Banjul), the scheduled job (architecture doc) builds a draft article from **public-safe sources only**:
  - updates published that month;
  - verified impact figures and their changes;
  - progress on causes;
  - this month's items from **Topics & milestones**;
  - upcoming appeals.

  It **never** reads requests, concerns, sessions, donors or notes.
- The job notifies content managers through Updates and email: "The October draft is ready to review".

```
┌ Review: October at Haven ─────────────────────────────────────────────────────────────────┐
│ ┌ The draft (exactly as it will look) ──────────────┐ ┌ What the helper used ─────────────┐ │
│ │ …                                                  │ │ ✓ 4 updates published in October  │ │
│ │ ▌"In October, 50 children returned to school…"     │ │ ✓ Children supported 1,200 → 1,214│ │
│ │   (flag: number) [I've checked this]               │ │   (verified by Awa, 3 Oct)        │ │
│ │ …                                                  │ │ ✓ Plan: "Back-to-school results"  │ │
│ └────────────────────────────────────────────────────┘ │ Things to check (2)               │ │
│ [Approve and put live now] [Schedule…] [Edit first] [Not this month] │                    │ │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

**Not this month** asks for an optional reason ("Too similar to last month", "Wrong focus") and saves it to the plan to steer next month.

**Topics & milestones** (`/admin/posts/plan`)
- A gentle month-by-month list with ＋ Add. Each topic has a month, a short line, a programme and an optional date ("Ramadan appeal launches 18 Feb").
- **Monthly draft settings:**
  - day of the month;
  - who reviews (people picker);
  - length;
  - **Write a draft each month / Pause the monthly draft** (choice cards).

  This answers HANDOFF's "admin dashboard to steer topics and milestones".

**When AI is off:** the monthly job still creates a **template draft**. It is an outline with the month's verified figures, the list of published updates and the plan items as headings, so the reviewer writes the prose. "Help me write" shows: "The writing helper isn't switched on yet. An administrator can connect it in Settings."

### 6.13 Photos & files (media library)

**Purpose:** §12 "Images and media" and §15 consent. Case documents and consent forms are **private attachments** on their records. They never appear in this library.

```
┌ Photos & files ── (All)(Photos)(Films)(Shows a child)(Needs consent 3)(Illustrative 37) [⤒ Upload] ┐
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                                           │
│ │ img  │ │ img  │ │ img  │ │ img  │ │ img  │ │ img  │   chips on each tile:                     │
│ │(✓)   │ │(!)   │ │(AI)  │ │      │ │      │ │      │   (✓ Consent on file) forest              │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   (! Needs consent) urgent-soft           │
│                                                          (Illustrative) sand                      │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Upload flow**

Uploading opens the `MediaSheet`, which asks three plain questions before the item can be used publicly:
1. **Does this show a child's face or body?** (No) (Yes)
2. If yes: **Do we have written consent from a parent or guardian?**
   - (Yes, I'll record it): who gave it (relationship), date, optional expiry, and the consent form attached privately.
   - (Not yet): the item is saved but **can't be used on the website or in posts** until consent is recorded.
3. **Could someone recognise exactly where this is?** (No) (Yes) (Not sure). Yes or Not sure shows a caution whenever the item is used.

**Item fields**
- **Alt text:** required, with "✦ Suggest" when AI is on.
- Caption and credit.
- **Where it's used:** computed links to the slots and posts using it.
- [Replace file]: keeps every usage.
- [Remove]: only if unused; otherwise "Replace it, or take it off those pages first."

**Seeding.** The library starts from `content/media-credits.ts` and `content/media-map.ts`. Every asset is marked **Illustrative (AI)**, and the 37 with `childPlaceholder: true` also get a "Replace before launch" flag. Today shows content managers: "37 illustrative photos still to replace before launch".

**MediaPicker** (used by the Website and Posts editors)
- The same grid inside a sheet.
- Items that need consent appear dimmed, and tapping one explains why it can't be used.
- Illustrative items can be picked, with a marigold note: "This is an illustrative AI image. The website will label it."

**Phones:** a 2-column grid; Upload opens the camera or photo library; the sheet is full height.

### 6.14 Team & roles (`/admin/team`, super admin)

```
┌ Team ──────────────────────────────────────────────────── [✉ Invite someone] ┐
│ ┌──────────────────────────┐ ┌──────────────────────────┐                     │
│ │ (AJ) Awa Jallow           │ │ (MS) Maria Santos         │                     │
│ │ (Programme officer)       │ │ (Safeguarding officer)    │                     │
│ │ Active · 2 h ago · Code ✓ │ │ Active · today · Code ✓   │                     │
│ └──────────────────────────┘ └──────────────────────────┘                     │
│ Invited, waiting: Kwame Mensah · [Resend] [Cancel invitation]                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Invite someone** (sheet)
- Name and email.
- **"What will they do here?"** Role choice cards. More than one can be picked. Each card has one plain line:
  - *Programme officer:* "Handles requests, sessions, volunteers and partners."
  - *Safeguarding officer:* "Sees child-protection concerns. Only for trained, vetted staff."
  - *Finance:* "Sees gifts and money records. Can't see support requests."
  - *Counsellor:* "Sees only their own counselling sessions."
  - *Content:* "Edits the website, posts and photos."
  - *Reports:* "Handles report requests and the resource library."
  - *Viewer:* "Can look, can't change. Choose which areas below."
  - *Super admin:* "Everything, including the team and settings."
- **Viewer:** area checkboxes ("They can look at: Requests · Giving · …").
- **Counsellor:** timezone and an optional personal Zoom link.
- Choosing **Safeguarding officer** or **Super admin** shows a confirm dialog that explains the access, and requires step-up.

**Person view** (`/admin/team/[uid]`)
- **What they can open:** a role summary in plain words. The house-keys idea lives here: "Awa has keys to: Inbox, Requests, Sessions, People."
- Also let them open (`extraAreas`).
- Sign-in code status, with [Reset their sign-in code].
- Last sign-in and active devices.
- **[Pause their access]**: keeps their history and is reversible. There is no delete. History must stay intact for audit.
- Every change confirms, requires step-up, and is logged.

### 6.15 Activity (`/admin/activity`)

```
┌ Activity ── Who: (Everyone ▾)  Area: (All ▾)  (Only sensitive)  Dates ▾  [Download] ┐
│ ── Today ─────────────────────────────────────────────────────────────────────────── │
│ 10:42 (MS) Maria opened C26-0007                                    [lock] Safeguarding  │
│ 10:40 (AJ) Awa added a note to S26-0142                             Requests        │
│ 10:15 ♥ An online gift of USD 50 arrived (D26-0313)                 Giving          │
│ 09:58 (NR) Nur downloaded "Gifts, September" with contact details   (!) Export        │
│ 09:02 (EJ) Emanuel signed in from a new device (Chrome, Android)    Security        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- Entries are human sentences, built from `{ actor, action, ref, area, sensitive }`.
- **Sensitive entries** (views of restricted records, Show on masked fields, exports, sign-ins and failed sign-ins, role changes, code resets) carry a quiet marker. **Only sensitive** filters to them.
- Safeguarding entries are visible only to safeguarding officers and super admins. They read "Maria opened C26-0007" and never include any content.
- **[Download]** is for super admins and auditors with Activity granted. It follows the CSV rules in §6.6 and is itself logged.
- **Phones:** one entry per line, wrapping, with filters in a sheet.

### 6.16 Settings

The overview is a grid of five cards: **How Haven is connected** · **Emails Haven sends** · **Giving** · **Data & privacy** · **Email log** (or **Outbox** in practice mode). A link to Key information sits at the top: "Looking for the phone number or address? → Key information".

**How Haven is connected** (`/admin/settings/connections`)

```
┌ Records & sign-in (Firebase) ──────────┐ ┌ Card payments (Stripe) ──────────────────┐
│ ● Practice mode: saved on this computer │ │ ○ Not connected                           │
│ Records are kept in the .data folder on │ │ People can still pledge, and you can      │
│ this machine. Good for trying things;   │ │ record gifts here. Card payments are off. │
│ not for real children's information.    │ │ ▸ For your developer                      │
│ ▸ For your developer                    │ │   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET │
└─────────────────────────────────────────┘ └───────────────────────────────────────────┘
┌ Email ───────────────┐ ┌ Writing helper (AI) ─┐ ┌ Zoom ─────────────────────────────┐
│ ○ Emails wait in the  │ │ ○ Off                │ │ ○ Paste links by hand              │
│   Outbox [Open]       │ │                      │ │                                    │
│ [Send me a test email]│ │                      │ │                                    │
└───────────────────────┘ └──────────────────────┘ └────────────────────────────────────┘
```

- **States:**

  | State | Marker |
  |---|---|
  | **Connected** | forest ● |
  | **Test mode** | marigold ●, e.g. Stripe test keys |
  | **Practice mode / Off** | sand ○ |
  | **Problem** | urgent ●, with the last error in plain words plus [Check again] |

- **"For your developer"** is a disclosure listing the environment variable **names** the sibling docs define. Values are never shown. It also has a [Check again] button that runs a harmless check: a Firebase read, a Stripe account fetch, or a test email to yourself.
- Super admins see everything. Other roles see only the plain status lines.

```ts
export interface IntegrationStatus {
  id: "firebase" | "stripe" | "email" | "ai" | "zoom";
  state: "connected" | "test" | "off" | "problem";
  headline: string;       // "Card payments are off"
  meaning: string;        // one plain sentence about what this means for staff
  envNames: string[];     // names only
  lastError?: string;     // plain words
}
```

**Emails Haven sends** (`/admin/settings/emails`)
- All 11 emails from §14, plus the staff alerts. Each has **When it's sent**, **Who gets it** and a rendered **Preview** (iframe `srcDoc`).
- **Editable:** the greeting line, main paragraph and sign-off.
- **Locked:** the subject of every email about a sensitive matter (support, concern alert, counselling, reminders). It shows a lock and the line "Kept general so nothing private shows in an inbox" (§14).
- Placeholders such as `{firstName}` and `{ref}` are offered as tap-to-insert chips.

**Giving** (`/admin/settings/giving`, finance and super)
- Accepted currencies: chips for GMD/USD/GBP/EUR, at least one required.
- Minimums and preset amounts for each currency (seeded from `content/home.ts` `donate.currencies`).
- Thank-you emails: choice cards **Send automatically for online gifts / I'll send each one myself**.
- Receipt details: organisation legal name, registration number, footer text and number prefix.
- Bank transfer details shown to donors.
- Helper exchange rates used only to prefill cause contributions (§6.6), each with "last updated" and a note that they are a guide.

**Data & privacy** (`/admin/settings/data`, super)
- **Keep records for:** retention periods per kind, picked from 1 / 3 / 5 / 7 years after closing. Defaults are placeholders pending the policy review (§17).
- **Correction and deletion requests:** a small log of who asked, what, when, the action taken and who did it, per §15 "a process to correct or delete information".
- **Backups:**
  - Firebase: "Managed by Firebase", with the last export date if the architecture adds one.
  - Practice mode: [Download a backup now], a zip of `.data`, available to super admins in dev only.

**Email log / Outbox** (`/admin/settings/email-log`)
- Columns: to, template, subject, time, and state (**Sent · Waiting in Outbox · Didn't send**). Clicking a row opens a preview.
- Bodies of sensitive templates are visible only to roles allowed to see the underlying record.
- In practice mode this is how engineers verify every email flow end to end.

### 6.17 Me (`/admin/me`)

- **Profile:** name, photo (optional; initials otherwise), timezone.
- **Password:** change it.
- **Sign-in code:** set up, regenerate backup codes, or turn off (where the role allows).
- **Devices:** active sessions, with [Sign out everywhere else].
- **Emails from Haven** as sentence rows, each with a 3-way segmented control **Straight away · Morning summary · Don't email**:
  - "New things in my Inbox"
  - "When someone hands me something or mentions me"
  - "Reminders before my sessions"
  - "When a monthly draft is ready" (content)

  Safeguarding alerts can't be switched off for safeguarding officers. The row is shown locked, with the reason.
- **Text size:** **Normal / Larger**. Larger sets `data-text="lg"` on `<html>`, which scales the root font size to 112.5%.
- [Take the tour again] · [Sign out].

### 6.18 Help & first-day tour

- **`/admin/help`**: guide cards with small `EmptyArt` illustrations. The content lives in `content/admin-help.ts`, as typed objects of short steps with screenshots added later. The cards are filtered by role and listed first-day first:
  - Your first day
  - Taking a new request
  - Writing a good note
  - When a safeguarding concern arrives
  - Recording a gift that came in cash
  - Booking a session and adding Zoom
  - Posting an update from your phone
  - Reviewing the monthly draft
  - Editing the website
  - Changing the phone number
- **Tour:** on first sign-in, after the invite flow, four coach marks walk through Today, Inbox, **＋ New** and Find. A marigold ring pulses with `animate-pulse-ring` around each target. Every step can be skipped. `tourDoneAt` is stored when the tour ends.

### 6.19 Messages (contact form) and "turn into…"

**MessageView**
- Shows the message, category, sender (masked contact) and preferred contact method.
- **[Reply by email]** (composer with the contact templates) and **[Done]**.
- **⋯ More:**
  - **Turn into a support request:** creates `S…` with the fields prefilled and links both records.
  - **This is a child-protection concern:** creates `C…`, moves the message's content into the concern store, and leaves the message as a stub "Moved to Safeguarding". This is the §11 redirect for reports that arrive through the wrong form.
  - **Hand to…**: route to a colleague.

Message stages are New → Replied → Done.

---

## 7. Status workflows (the single source for the stepper)

```ts
// lib/admin/workflows.ts
export interface Flow<S extends string> {
  kind: RecordKind;
  path: S[];                        // the dots on the stepper, in order
  pauses?: S[];                     // shown as a flag on the current dot (not a dot)
  exits?: S[];                      // shown as an off-ramp at the end (neutral, not red)
  labels: Record<S, string>;        // official labels (§13 wording where §13 defines them)
  next: Record<S, S[]>;             // allowed transitions
  verbs: Partial<Record<S, string>>;// button text to move INTO that status
  asks?: Partial<Record<S, "referral" | "reason" | "reasonAndEmail" | "emailTemplate" | "risk" | "secondSignOff" | "schedule">>;
  initial: S;                       // what "New" means for the Inbox
}

export const supportFlow: Flow<
  "new" | "under_review" | "more_info_required" | "assigned" | "referred" | "approved"
  | "support_in_progress" | "completed" | "declined" | "closed"
> = {
  kind: "support",
  path: ["new", "under_review", "assigned", "referred", "approved", "support_in_progress", "completed", "closed"],
  pauses: ["more_info_required"],
  exits: ["declined"],
  labels: {
    new: "New", under_review: "Under review", more_info_required: "More information required",
    assigned: "Assigned", referred: "Referred", approved: "Approved",
    support_in_progress: "Support in progress", completed: "Completed", declined: "Declined", closed: "Closed",
  },
  next: {
    new: ["under_review", "declined", "closed"],
    under_review: ["assigned", "more_info_required", "declined"],
    more_info_required: ["under_review", "declined", "closed"],
    assigned: ["referred", "approved", "more_info_required", "declined"],
    referred: ["approved", "support_in_progress", "completed", "declined"],
    approved: ["support_in_progress", "completed"],
    support_in_progress: ["completed"],
    completed: ["closed"],
    declined: ["closed"],
    closed: ["under_review"],                      // reopen: programme officer / super, needs reason
  },
  verbs: {
    under_review: "Start reviewing", more_info_required: "Ask for more information",
    assigned: "Hand to an officer", referred: "Record a referral", approved: "Approve support",
    support_in_progress: "Support has started", completed: "Mark support complete",
    declined: "Decline kindly", closed: "Close and put away",
  },
  asks: { more_info_required: "emailTemplate", referred: "referral", declined: "reasonAndEmail", closed: "reason" },
  initial: "new",
};

// Gifts and in-kind: §13 Donation. Status is DERIVED from facts on a received gift (§6.6).
export const giftFlow = {
  path: ["pledged", "pending", "received", "acknowledged", "allocated", "completed"],
  exits: ["cancelled"],
  labels: { pledged: "Pledged", pending: "Pending", received: "Received", acknowledged: "Acknowledged",
            allocated: "Allocated", completed: "Completed", cancelled: "Cancelled" },
  next: { pledged: ["pending", "received", "cancelled"], pending: ["received", "cancelled"],
          received: ["acknowledged", "allocated"], acknowledged: ["allocated"],
          allocated: ["completed"], completed: [], cancelled: [] },
  verbs: { pending: "Arranging it", received: "Mark received", acknowledged: "Say thank you",
           allocated: "Put towards…", completed: "Mark complete", cancelled: "Cancel the pledge" },
  initial: "pledged",
} as const;
// In-kind shows the same labels with helper subtitles: Pledged "Offered", Pending "Arranging pickup or drop-off",
// Allocated "Given to a programme".

// §13 Resource request
export const reportRequestFlow = {
  path: ["new", "under_review", "approved", "sent", "closed"], exits: ["declined"],
  next: { new: ["under_review", "approved", "declined"], under_review: ["approved", "declined"],
          approved: ["sent"], sent: ["closed"], declined: ["closed"], closed: [] },
  verbs: { under_review: "Start reviewing", approved: "Approve and send", declined: "Decline", closed: "Close" },
  initial: "new",
} as const;   // "Approve and send" = approved + sent in one action when email is connected

// §13 Volunteer
export const volunteerFlow = {
  path: ["submitted", "screening", "interview", "approved", "onboarding", "active"],
  pauses: ["inactive"], exits: ["declined"],
  next: { submitted: ["screening", "declined"], screening: ["interview", "approved", "declined"],
          interview: ["approved", "declined"], approved: ["onboarding"], onboarding: ["active", "inactive"],
          active: ["inactive"], inactive: ["active"], declined: ["screening"] },
  verbs: { screening: "Start screening", interview: "Invite to interview", approved: "Approve",
           onboarding: "Start onboarding", active: "Mark active", inactive: "Mark inactive", declined: "Not this time" },
  initial: "submitted",
} as const;

// Haven-defined (not in §13), built from §7 / §5.4 / §10
export const concernFlow = {
  path: ["new", "reviewed", "escalated", "referred", "monitoring", "closed"],
  next: { new: ["reviewed"], reviewed: ["escalated", "referred", "monitoring", "closed"],
          escalated: ["referred"], referred: ["monitoring", "closed"], monitoring: ["referred", "closed"],
          closed: ["monitoring"] },
  asks: { reviewed: "risk", closed: "secondSignOff" },   // second sign-off when risk is high | immediate
  labels: { new: "New", reviewed: "Reviewed", escalated: "Escalated", referred: "Services or authorities contacted",
            monitoring: "Following up", closed: "Closed" },
  initial: "new",
} as const;   // "escalated" is skipped (dotted) for low/medium risk

export const sessionFlow = {
  path: ["requested", "scheduled", "confirmed", "attended", "follow_up", "closed"],
  exits: ["missed", "cancelled"],
  next: { requested: ["scheduled", "cancelled"], scheduled: ["confirmed", "cancelled"],
          confirmed: ["attended", "missed", "cancelled"], attended: ["follow_up", "closed"],
          missed: ["closed"], follow_up: ["closed"], cancelled: [], closed: [] },
  asks: { scheduled: "schedule" },
  initial: "requested",
} as const;   // "Offer a new time" from missed creates a NEW linked session

export const partnerFlow = {
  path: ["new", "talking", "agreement", "active"], pauses: ["paused"], exits: ["declined"],
  next: { new: ["talking", "declined"], talking: ["agreement", "declined"], agreement: ["active", "declined"],
          active: ["paused"], paused: ["active"], declined: ["talking"] },
  initial: "new",
} as const;

export const messageFlow = {
  path: ["new", "replied", "done"],
  next: { new: ["replied", "done"], replied: ["done"], done: ["new"] },
  initial: "new",
} as const;
```

**Server rule:** the transition server action validates `to ∈ next[from]` and checks the role (§5). It then writes the status, a `status` timeline entry and an Activity entry, and calls `refresh()`. Any automatic email runs inside the same action, and the toast reports the result: "Moved to Approved · email sent to Fatou".

---

## 8. Notifications

**Staff email subjects are always general:** "New item for the safeguarding team", "Something new in your Haven inbox", "A session reminder from Haven". The body holds only the ref and a link to `/admin/r/[ref]`. This applies §14's subject-line rule to staff emails too.

| Event | Email to the public (§14) | Staff email (respects Me preferences) | In-app (Updates + badges) |
|---|---|---|---|
| Support request submitted | Support-request confirmation | Programme officers: straight away if urgent or immediate, otherwise morning summary | Inbox badge |
| Concern submitted | General receipt, only if contact details were given with consent | **Child-protection alert** to safeguarding officers and super admins, always immediate, can't be switched off | Safeguarding badge (count only) |
| Online gift (Stripe) | Donation acknowledgement + receipt (if automatic thank-yous are on) | Finance: morning summary | "New gift" update |
| Offline gift recorded | Thank-you + receipt when staff choose it | none | none |
| In-kind offer | In-kind follow-up (sent when moved to Pending) | Finance | Inbox badge |
| Counselling request | (support confirmation) | Programme officers | Inbox badge |
| Session invitation sent | Counselling confirmation + `.ics` | The assigned counsellor | Update to the counsellor |
| 24 h and 1 h before a session | Zoom reminder | The counsellor (reminder) | Today card |
| Report requested | Resource-request confirmation | Report managers | Inbox badge |
| Report approved | Approved report delivery | none | none |
| Volunteer applied | Volunteer acknowledgement | Programme officers | Inbox badge |
| Partnership enquiry | Partnership acknowledgement | Programme officers | Inbox badge |
| Contact message | Contact confirmation | Routed role (§5.2) | Inbox badge |
| Assigned to you or @mentioned | none | Per Me preference | Update |
| Monthly draft ready | none | Content managers and the chosen reviewer | Update + Today card |
| Update sent for review | none | Content managers | Posts badge |

---

## 9. Components

All admin components live in `components/admin/`, and primitives in `components/admin/ui/`. They reuse `cn`, `money`, `Flag`, `HavenMark`/`Logo`, `Brush`, `Counter`, `ProgressBar`, `ProgrammeIcon` and the hands and doodle art from the public codebase. Icons come from `lucide-react` (already installed).

**Packages to add** (pin exact versions at install; all are mature):

| Package | Used for |
|---|---|
| `cmdk` | Find |
| `sonner` | Toasts with Undo |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Kanban and sortable lists on desktop |
| `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`, `-image`, `-placeholder` | Article editor |

Dates use `Intl.DateTimeFormat` with the staff timezone. No date library is needed for Phase 1.

### 9.1 Shell

| Component | Contract |
|---|---|
| `AdminShell` | `{ staff: Staff; places: Place[]; practiceMode: boolean; children }`. Renders TopBar (≥1024) or the mobile top line + BottomDock, the ribbons, SheetHost, Toaster and CommandPalette. Polls the pulse. |
| `TopBar` | Forest pill nav with up to 6 places, `useLinkStatus` shimmer on the clicked pill (`.../04-functions/use-link-status.md`), More mega card, Find, ＋ New, Updates, avatar menu |
| `BottomDock` | `{ primary: Place }`. Five slots (§3.3). Hides while the keyboard is open or inside full-screen editors (`useDockHidden()` context) |
| `PageHeader` | `{ title; description?; actions?; tabs?: { label; href; count? }[]; back?: { label; href } }` |
| `SplitView` | `{ list: ReactNode; children }` (§3.8) |
| `SheetHost` | Reads `?do=` and renders the matching global sheet |
| `NoAccess` | Friendly refusal, naming a super admin to ask |
| `Tour` | Coach marks: `{ steps: { target: string; title; body }[] }` |

### 9.2 Primitives

| Component | Contract and behaviour |
|---|---|
| `AdminButton` | `variant: "primary" (forest/white) \| "attention" (marigold/night) \| "danger" (urgent/white) \| "quiet" (white, line border) \| "ghost"`, `size: "md" (h-11) \| "lg" (h-12)`, rounded-full, Nunito 700. `loading` shows an inline spinner and keeps the width. Reuses the press feedback of the public `Button` (`active:scale-[0.97]`) |
| `Card` | White, `rounded-card` (22px), `shadow-card`, padding 20/24. `tone="restricted"` gives a deep header band |
| `Sheet` | Built on native `<dialog>` with `showModal()`, which gives a focus trap, Esc, an inert background and a top layer for free. `{ open; onClose; title; description?; size: "sm" 420 \| "md" 560 \| "lg" 720 \| "full"; dirty?: boolean; footer?: ReactNode }`. Desktop: slides in from the right. Below 768px: bottom sheet with a drag handle and snap points (60% / 95%); drag down to dismiss. If `dirty`, closing asks "Keep editing / Discard changes". The footer is sticky with safe-area padding |
| `ConfirmDialog` | `{ title; body; confirmLabel; tone: "primary" \| "danger"; requireText?: string }` for when an action needs typing to confirm (never used for everyday actions) |
| `Toaster` | `sonner`, positioned bottom-centre above the dock on phones and bottom-left on desktop. `toast.success(msg, { action: { label: "Undo", onClick } })` with a 6s default |
| `ChoiceCards` | `{ name; value; onChange; options: { value; label; description; icon?; tone? }[]; columns?: 1 \| 2 \| 4 }`. Radio-group semantics. The selected card gets a 2px forest ring, a mint background and a ✓ |
| `Segmented` | Same look as the donate card's Segmented (sliding white thumb on `#f1f1ef`), with admin text at 13px/700 and title case (not uppercase) |
| `FilterChips` | `{ options: { value; label; count? }[]; value; onChange; multi?: boolean }`. Scrolls sideways on phones; active = forest/white |
| `TextField` / `TextArea` / `CharCount` | Labels always visible above the field (never placeholder-only). 48px fields, `rounded-2xl` for text areas and `rounded-full` for single lines. Errors sit under the field in urgent text with an icon |
| `ListSelect` | Replaces `<select>`. Popover list on desktop, bottom-sheet list with search on phones |
| `DateTimeField` | Native date and time inputs, styled, plus "in California: 03:00" helper text |
| `MoneyField` | Currency segmented control + numeric input. Formats with `plainNumber` and stores integer minor units |
| `CountryPicker` | Searchable list from `content/world.ts` with `<Flag>`, with The Gambia first |
| `PersonPicker` | Staff filtered by area permission, showing avatar, name, role and open load |
| `Avatar` | Initials on an earth tone (clay, cocoa, forest, umber, marigold), chosen from a hash of the uid |
| `StatusPill` | `{ flow; status }`. Colour by stage family (§10.3) |
| `StatusStepper` | `{ flow; status; history: { status; at; by }[]; onMove(to); can: boolean; compact?: boolean }`. Desktop is a full line; `compact` is a sideways-scrolling strip with the current step centred. Includes the "Next:" buttons and the ⋯ menu of all `next[]` |
| `Timeline` | `{ entries: TimelineEntry[]; filters?: boolean; restricted?: boolean }`. Notes as sticky cards, emails expandable, status lines muted, grouped by day |
| `Composer` | `{ ref; modes: ("note" \| "email" \| "call" \| "referral" \| "followup" \| "contact")[]; templates? }`. Drafts persist in `localStorage` under `composer:<ref>:<mode>`. @mention autocomplete. `Ctrl+Enter` sends |
| `EmptyState` | `{ art: "plane" \| "hands" \| "sprig" \| "house" \| "heart"; title; body; action? }`. Art in pastel doodle colours (the `DoodleField` palette) |
| `Skeleton` | Cream shimmer blocks matching each card's shape. No spinners for page loads |
| `KpiTile` | Earth-tone card with an uppercase Inter 12 label, an Anton number (`Counter`) and a note |
| `Masked` | `{ value; kind: "phone" \| "email" \| "text"; canReveal; onReveal }`. "Show" calls a server action that logs, then reveals for 60s |
| `RestrictedBanner` | Deep band with a lock and "Every view is recorded" |
| `SwipeRow` | `{ left?: SwipeAction; right?: SwipeAction; disabled?; children }` with `SwipeAction = { label; icon; tone: "forest" \| "marigold"; onCommit }` (§6.3) |
| `Kanban` | `{ lanes: { id; label; tint; items }[]; onMove(id, to); renderCard }`. Desktop uses dnd-kit; below 768px it renders stage chips + list with "Move to next →" |
| `DataList` | Responsive list. Column layout above 1280px when `columns` is given, cards otherwise. Group headers by day or month |
| `Badge` | Count badge (marigold/night) and lock badge (deep/white) |
| `KeyHint` | `<kbd>` styling for shortcut hints, desktop only |
| `Celebrate` | A marigold heart (`HEART_PATH`) that pops with `heartbeat` once. Only for gift recorded, thank-you sent, post live and volunteer active |

---

## 10. Visual language: same brand, calmer

### 10.1 Tokens to add to `app/globals.css` `@theme`

These are shared with the public site, so they go in the existing `@theme` block:

```css
--color-canvas: #fbf8f1;            /* admin page background */
--color-coral-800: #b83a24;         /* "urgent" text/bg: 4.8:1 on urgent-soft, 5.7:1 on white (AA) */
--color-urgent-soft: #fde7e2;
--color-attention-soft: #fdf0cc;    /* marigold tint; pair with umber text */
--color-restricted-soft: #e7eeeb;
--shadow-card: 0 12px 40px -18px rgba(20, 51, 43, 0.22);   /* the FAQ card shadow */
--shadow-lift: 0 30px 60px -35px rgba(46, 26, 14, 0.45);
--shadow-dock: 0 -12px 40px -24px rgba(6, 21, 18, 0.35);
--radius-card: 22px;
```

Add these utilities and rules:
- `@utility admin-canvas`: `background-color: var(--color-canvas)`, plus `paper-v5.svg` at 35% opacity through a `::before` layer.
- `[data-text="lg"] { font-size: 112.5% }`.
- `[data-studio] [data-reveal] { opacity: 1 !important; translate: none !important }` for the studio preview.

### 10.2 Type

| Use | Font | Size and weight |
|---|---|---|
| Page title | Nunito | 800, 32/38 desktop, 24/30 phone |
| Card and section title | Nunito | 800, 18–20 |
| Body | Nunito | 500, 16/1.6 (never below 15) |
| Meta, timestamps, table data, refs | Inter | 400–500, 13–14, `tabular-nums`, ink at 65% or darker |
| Big numbers (Today snapshot, gift header) | Anton | 36–56 |
| Greeting, login welcome, empty-state captions | Caveat | 700, 28–44, forest or umber. **Nowhere else** |
| Labels on status pills | Inter | 600, 12, title case |

### 10.3 Colour use

| Meaning | Colour |
|---|---|
| Primary actions, active nav, done stages | Forest `#1f715a` (white text) |
| Attention: new, waiting, counts | Marigold surfaces with **night** text; soft marigold `attention-soft` with **umber** text |
| Urgent (only) | `coral-800` text on `urgent-soft`; urgent buttons `coral-800` with white text |
| Restricted | Deep `#14332b` band, `restricted-soft` canvas |
| In progress | Mint `#dfebe7` with forest text |
| Waiting on others (pledged, referred, more info) | Sand `#f3e7d3` with cocoa text |
| Declined, cancelled, closed | `#f1f1ef` with body text (neutral, never red) |

**Kind tints** (4px row bars and place-tile blobs):

| Kind | Tint |
|---|---|
| support | forest |
| concern | deep |
| gift | marigold |
| in-kind | clay |
| session | cocoa |
| report request | umber |
| volunteer | `forest-700` |
| partner | `clay-700` |
| message | `#a9a59c` |

**Accessibility differs from the public site on purpose.** The public site keeps white-on-marigold for brand reasons (README a11y note). The admin does **not**: all text meets AA, and the `axe` run for admin pages (§15) has no exceptions.

**Surfaces:** white cards on the cream canvas. Use `shadow-card`, with `shadow-lift` on hover for clickable cards. There are no borders on cards. Hairlines inside cards use `line`.

**Spacing:** a 4px grid. Cards 20px padding on phones and 24px on desktop. Gaps between page sections 32px. Phone gutters 16px, matching the public `wrap` utility.

**Brand art, used sparingly**

| Where | Art |
|---|---|
| Login | Brush-masked photo + `CurlyArrow` |
| Today | `GreetingDoodle` once a day |
| Empty states | Pastel doodles |
| Place tiles | `Brush "splash"` blobs |
| Kanban lane headers | `Brush "strokes"` underlines |
| Celebrations | Heart |

None of it appears in Safeguarding, Giving exports, receipts or Activity.

---

## 11. Motion (warm, never busy)

There is no Lenis and no GSAP in the admin. Everything is CSS transitions using the existing easing tokens. `prefers-reduced-motion` turns all of it into instant changes; the existing global rule in `globals.css` already enforces that.

| Moment | Motion |
|---|---|
| Page content enters | Fade + rise 12px, 400ms `--ease-out-expo`. Lists stagger 30ms for the first 10 rows, **first load only** (not after `refresh()`) |
| Sheet opens | Desktop: slide from the right 480ms ease-out-expo, backdrop fade 300ms. Phone: slide up 420ms. Dragging follows the finger, and release springs back with `--ease-out-back` |
| Stage change | The connector line fills (scaleX 0→1, 600ms ease-out-expo), then the new dot pops (scale 0.6→1, 400ms ease-out-back) |
| Toast | Rises 16px + fades, 350ms. The Undo countdown is a 2px marigold bar draining across the toast |
| Swipe | The row tracks the finger. Commit slides it out in 250ms and the list closes the gap in 300ms. Cancel springs back in 300ms ease-out-back |
| Kanban drag | Card lifts (`shadow-lift`, rotate 2°). The target lane goes mint. Drop settles in 300ms ease-out-back |
| Count-ups (Today, gift header) | `Counter`, 1.2s, once per session |
| Hover on clickable cards | translateY -2px + `shadow-lift`, 300ms |
| Celebrations | One heart pop (`heartbeat` once), only on the four moments in §9.2 |
| Nav pending | `useLinkStatus` shimmer under the clicked pill or dock icon |
| Greeting doodle | Stroke draw-in (`draw-path`), 1.6s, once per day |

**Never:** parallax, auto-playing video, looping decorations on working screens, motion in Safeguarding (it fades only).

---

## 12. Microcopy

**Voice**
- "We" means Haven and "you" means the staff member.
- Short sentences and everyday words. Verbs on buttons. No blame. No jargon or acronyms.
- Warm, never cutesy. In Safeguarding, Finance, confirmations and errors: no exclamation marks and no jokes.

**Glossary** (what we call things on screen)

| System term | On screen |
|---|---|
| Case / support request | Request |
| Child-protection concern | Concern (in the Safeguarding place) |
| Assign / assignee | Hand to… / Looking after this |
| Status | Stage |
| Acknowledge | Say thank you |
| Allocate | Put towards… |
| Archive | Close and put away |
| Snooze | Later |
| Publish / unpublish | Put live / Take down |
| Draft | Not live yet |
| Export CSV | Download a spreadsheet |
| Role / permissions | What they can open |
| MFA / 2FA / TOTP | Sign-in code |
| Media library | Photos & files |
| Integrations | How Haven is connected |
| Audit log | Activity |
| Practice / local mode | Practice mode |

**Patterns**

| Situation | Copy |
|---|---|
| Primary button | Verb plus object: "Record this gift", "Send the invitation", "Put these changes live" |
| Undo toast | Past tense plus ref: "You took S26-0142 · Undo" |
| Confirm (sends email) | Title: "Send this to Fatou?" Body: "She'll get the email below at f•••@gmail.com." Buttons: [Send it] [Not yet] |
| Confirm (put live) | "Put 3 changes live? Everyone visiting the website will see them straight away." |
| Confirm (role) | "Give Maria access to safeguarding concerns? Only do this for trained, vetted staff. We'll record this change." |
| Saving | "Saving…" → "Saved as a draft ✓" (no toast for autosave) |
| Error (network) | "We couldn't save that just now. We'll try again when you're back online. Your text is safe." |
| Error (server) | "Something went wrong on our side. Your work is saved. [Try again]" |
| Not allowed | "This part of Haven isn't open to your role. If you need it, ask Emanuel." |
| Empty Inbox | "All caught up. Lovely." |
| Empty Requests | "No open requests. When someone asks for help, it will appear in your Inbox first." |
| Empty Giving (month) | "No gifts recorded in October yet." |
| Empty Sessions | "No sessions this day. Enjoy the quiet." |
| Empty Posts | "Nothing here yet. An update can be one photo and a few lines." |
| Consent block | "We can't put this photo live until a parent or guardian's written consent is recorded. [Record consent]" |
| Integration off | "Card payments are off until Stripe is connected. People can still pledge, and you can record gifts here." |

All strings live in `lib/admin/copy.ts` and are referenced by key. That keeps the voice in one place and makes Phase 2 translation possible.

---

## 13. Mobile behaviour per screen

| Screen | Below 768px |
|---|---|
| Sign in | Photo band with torn brush edge; form card overlaps; numeric keypad for codes |
| Today | Single column; quick actions 2×2; at-a-glance chips scroll sideways; snapshot 2×2 |
| Inbox | List only; chips + "Filters" sheet; swipe right Take it / left Later; long-press menu; opening pushes the detail |
| Request | Compact stepper; tabs Timeline/Details/Files; sticky bar [+ Note] [next step]; composer as a bottom sheet |
| Safeguarding | Step-up sheet; one column; risk cards 2×2; sticky next §7 step |
| Giving ledger | Gift cards with a full-width next-step button; month header sticky; Record a gift as a full-height sheet |
| Gift view | Amount header; two checklist cards stacked; allocation rows full width |
| Counselling | Week strip scrolls sideways; "Waiting for a time" banner; full-width Join Zoom on session day |
| Reports & resources | 1-column grid; Add as a full page; requests as split → push |
| People | Stage chips + list; "Move to next →" per card; no drag |
| Website | Outline first; Preview opens a full-screen iframe with persistent ✎ chips; sheets full height |
| Key information | Cards stacked, each with its own Save |
| Posts | Update composer is the default for ＋; article editor gets a sticky toolbar above the keyboard; settings in a sheet |
| Photos | 2-column grid; camera upload; item sheet full height |
| Team | Person cards stacked; invite as a full-height sheet |
| Activity | One entry per line; filters in a sheet |
| Settings | Cards stacked; developer details collapsed |
| Me | Sections stacked; segmented controls wrap to full width |

**Global rules on phones**
- 44px minimum tap targets.
- No hover-only affordances.
- Every horizontal scroller shows a visible edge fade.
- No horizontal page scroll at 360px (QA in §15).
- Inputs use the right `inputMode` and `autoComplete`.
- Sticky bars respect `env(safe-area-inset-bottom)`.

---

## 14. When things aren't connected (graceful degrading)

The admin must be fully usable today with nothing connected.

| Missing | What staff see | What still works |
|---|---|---|
| Firebase | Practice ribbon; Connections card "Practice mode" | Everything, on `.data/` JSON with seeded demo records; files in `.data/uploads` served via `/api/admin/files/*` with auth |
| Stripe | Giving notice; Connections card "Not connected" | Pledges, recording offline gifts, receipts, causes, allocation, exports. The public donate flow degrades per the payments doc |
| Email | Outbox ribbon link; "Waiting in Outbox" states | Every email is rendered and stored in the Outbox. Report approval offers [Copy the download link] |
| AI | "Help me write" explains it's off | The monthly job creates a template draft; SafetyCheck heuristics still run (they are not AI) |
| Zoom | "Paste links by hand" | Sessions, invitations and reminders work with pasted links |

**Demo data for practice mode.** The data doc owns the seeding. The admin needs this spread so every screen looks real:

| Kind | Demo set |
|---|---|
| Users | 8, one per role (names in §6.1) |
| Requests | 14 across every stage |
| Concerns | 3 (one immediate, one waiting for second sign-off) |
| Gifts | 40 over 3 months in 4 currencies (online, offline, recurring) |
| In-kind offers | 6 |
| Sessions | 12 this week (2 without Zoom links, 2 awaiting attendance) |
| Resources and report requests | 8 resources (3 on request) and 5 requests |
| Volunteers and partners | 12 volunteers across stages, 5 partners, 6 directory entries |
| Messages | 9 across categories |
| Posts | 6, including 1 monthly AI draft in review |
| Media | From `content/media-credits.ts` |
| Website content | From `content/*.ts` |

Demo applicants use first names plus initials that follow the people mix. No real personal data.

---

## 15. Build plan for 4–6 engineers

**Day 1 contract.** Before anything else, Engineer 1 lands **stubs with final signatures** for:
- `lib/admin/{access,workflows,refs,types,copy,nav,commands}.ts`
- `components/admin/ui/*` (props as in §9; visuals can be rough)
- `AdminShell`, `PageHeader`, `SplitView` and `Sheet`

Everyone builds against these. Visual polish of the primitives continues in parallel without changing the APIs.

| Engineer | Owns | Depends on |
|---|---|---|
| **E1: Shell and foundations** | `(admin)` root layout, sign in, code, forgot, reset, invite, locked, practice chips; shell (TopBar, BottomDock, Places, Quick actions, Find, Updates, pulse, ribbons, SheetHost, Tour); all §9.2 primitives; tokens; Today frame + per-role composition; Me; Help | Auth doc (session), data doc (staff) |
| **E2: Records core** | Inbox (+ swipe, keys, multi-select); RecordPanel dispatcher; Requests list + request view (StatusStepper, Timeline, Composer, ReferralSheet, DeclineSheet, Masked); Messages + "turn into…"; `/admin/r/[ref]`; Safeguarding place (step-up, risk, two-person close) | E1 primitives, data doc |
| **E3: Giving** | Ledger, Record a gift, gift and in-kind views, AllocationEditor, causes + editor + BreakdownBar, where it goes, receipt page, exports (CSV rules); Settings › Giving, Connections, Email log/Outbox | Payments doc, E1 |
| **E4: Counselling, Library, People, Team, Activity** | Sessions agenda + session view (timezones, Zoom, attendance, notes); Library + requests; People kanban + phone stage lists + directory; Team + invite; Activity | E1, E2 (Timeline/Composer) |
| **E5: Website studio and media** | `lib/studio/*` registry + schema; SchemaForm + field editors; StudioFrame + StudioBridge (public side, with the content doc); publish/changes/history; Key information; Photos & files + MediaPicker + consent gate | Content doc, E1 |
| **E6: Posts** (merge into E5 with 5 engineers) | Post list, Update composer, TipTap article editor + blocks, AI assist UI, SafetyCheck heuristics, review screen, plan + monthly settings | AI and scheduling in the architecture doc, E5 MediaPicker |

**Order of delivery:**
1. Week 1: shell, sign in, Today, Inbox, request view. Staff can triage.
2. Week 2: Giving, Counselling, Safeguarding.
3. Week 3: Website studio, Key information, Photos.
4. Week 4: Posts + AI, Library, People, Team, Activity, Settings, Help, polish.

**Acceptance checks for every screen (definition of done):**
1. Works at 360, 390, 768, 1024, 1280 and 1440px wide. `node scripts/qa/overflow.mjs` against `/admin/...` URLs finds no horizontal scroll. Signed-in shooting needs a practice-mode cookie: extend `scripts/qa/shoot.mjs` with `--cookie`.
2. `node scripts/qa/a11y.mjs <width> <admin url>` reports **zero** violations, contrast included.
3. Keyboard only: every action is reachable; focus is visible (marigold ring); sheets trap and restore focus.
4. Signed in as each of the 8 practice roles: nav, Today, Find and quick actions match §5, and URLs outside the role render `NoAccess`, with the API returning 403.
5. A concern's narrative never appears in the network responses of `/api/admin/search`, `/api/admin/pulse`, the Inbox layout payload or Activity (check with `read_network_requests` or a script).
6. Reduced motion: no transitions longer than 1ms, no count-ups.
7. Offline: switch the network off, type a note, reload. The note is still in the composer.
8. Every email-sending action produces an Outbox entry in practice mode with the correct general subject.

**Next.js 16 rules recap for implementers:**
- Params are Promises (`const { ref } = await params`); type pages with `PageProps<"/admin/inbox/[ref]">` and layouts with `LayoutProps<…>`.
- `refresh()` and `updateTag()` work **only inside server actions**. Route handlers such as the Stripe webhook use `revalidateTag`.
- Layouts don't get `searchParams` (§3.8).
- Middleware is now `proxy.ts`.
- Multiple root layouts mean a full page load between the public site and the admin, which is expected and fine.
- Use `loading.tsx` per place for instant skeletons.
- `useLinkStatus` gives pending feedback on nav.
- Avoid experimental `authInterrupts` and `useOffline` unless the architecture doc enables them.

---

## 16. Risks

1. **Studio coupling.** The in-context studio needs small changes to public components (`StudioSlot` wrappers, `useStudioMode` to pause carousels, a reveal override) and a content loader that understands Draft Mode. If the content doc changes, E5 is blocked.
   - *Mitigation:* agree the §6.10 contract in week 1.
   - *Fallback:* the phone "outline + sheets" view works without the iframe.
2. **Safeguarding leakage through side channels.** The danger is not the concern page itself but everything around it: search, pulse, notifications, emails, Activity text, AI inputs, CSVs, browser history titles.
   - *Mitigation:* §5.5 rule 3 and acceptance check 5. Page `<title>` for concerns is "Concern · Haven team", with no content.
3. **Firestore search.** Firestore has no full-text search. Find needs ref-prefix lookups and a `searchTokens` array on each record (lowercased name and email tokens) for `array-contains`. The data doc must add this, or Find degrades to refs only.
4. **Masked-field friction.** Programme officers call applicants daily. If they aren't the assignee, "Show" every time will annoy them. This is a deliberate trade-off. Revisit after two weeks of use: it may be better to unmask for every programme officer while still logging.
5. **Mixed currencies.** Cause totals need manual cross-currency contributions (§6.6). Finance must understand that the helper rates are a guide. Getting this wrong publishes wrong "raised" figures, so the publish of cause totals shows the per-currency breakdown to finance.
6. **TipTap bundle size and mobile editing quirks.** Load the editor with `next/dynamic` only on `/admin/posts/[id]`. The Update composer stays a plain textarea on purpose.
7. **Native `<dialog>` bottom sheets on older iOS Safari.** Drag gestures and the visual viewport behave differently there. Test on a real iPhone, and fall back to non-draggable sheets if needed.
8. **The polling pulse** costs reads on Firestore (one aggregated doc read per poll if the data doc keeps a `counters/{uid}` doc; otherwise several queries). Keep it to a single counters read.
9. **Practice-mode sign-in chips must never ship enabled.** They are guarded by `practiceMode && NODE_ENV !== "production"` and covered by a unit test.
10. **AI hallucinating numbers or names in public posts.** This is mitigated by SafetyCheck, the "I've read every line" sign-off and the public-safe inputs only. It can still pass if a reviewer ticks boxes without reading, which is a training point covered in Help.
11. **CSV formula injection** through donor-entered text. The escaping rule in §6.6 is mandatory for every export.

---

## 17. Open questions for the owner

1. **Staff and roles.** Who are the real staff, and which roles does each hold? Are counsellors external professionals who need their own accounts?
2. **Safeguarding policy.** What are the risk-level definitions, does closing need a second person's sign-off, and which authorities should appear in the contacts list?
3. **Retention.** How long do we keep each kind of record (requests, concerns, gifts, sessions)? This needs the professional policy review in §15.
4. **Updates from the field.** May programme officers put Updates live directly, or must a content manager always review them first? This design currently sends them for review.
5. **AI provider and budget** for the writing helper. Does the monthly draft go live only after review? It does in this design, and auto-publishing is not offered.
6. **Zoom.** Does Haven have a Zoom account that allows automatic link creation (Server-to-Server OAuth), or will staff paste links?
7. **Appeals in other currencies.** Can a GBP gift count towards a USD appeal at a finance-set rate, or should appeals accept only their own currency?
8. **Seasonal greetings on Today.** Should Today include Ramadan Mubarak, Eid Mubarak or Merry Christmas greetings? This design leaves them out.
