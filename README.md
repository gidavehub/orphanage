# Haven

The platform for **Haven** (The Orphanage Project): protecting vulnerable children and strengthening families. It has three parts:

- **The public website**: programmes, stories, news, resources, get support, report a concern, get involved, and a donate page per cause.
- **The team space** at `/admin`: a warm, phone-friendly place for the team to answer requests, handle safeguarding concerns, record and thank gifts, book counselling, run the library, look after volunteers and partners, edit the website, write posts, and manage the team.
- **The plumbing**: card payments (Stripe), emails (Resend), the monthly story writer (Anthropic or Google), Zoom links, scheduled jobs and the Firebase database.

Without any keys, Haven runs in **practice mode**: everything is saved on this computer in `.data/`, emails wait in the admin's email log, gifts become pledges, the monthly story is a fill-in template, and Zoom links are pasted by hand.

## Run it

```bash
npm install
```

```bash
npm run dev -- -p 3001
```

Open http://localhost:3001 for the website and http://localhost:3001/admin for the team space. Port 3000 is used by another local project, so Haven uses **3001** in development and **3100** for a local production build.

Add the practice records (people, requests, gifts, sessions…) once the server is running:

```bash
npm run seed
```

Sign in on the admin login page with one of the practice role buttons (super admin, content manager, programme officer, safeguarding officer, finance officer, counsellor, report manager, viewer). They only appear in practice mode.

A production build:

```bash
npm run build
```

```bash
npx next start -p 3100
```

Copy `.env.example` to `.env.local` to set anything. Every variable is documented there; `node scripts/qa/env-check.mjs` checks that the list and the code agree.

Stack: Next.js 16 (App Router, Cache Components, Turbopack), React 19, Tailwind CSS v4, Zod 4, GSAP and Lenis on the public site, Firebase (Firestore, Storage, Identity Platform), Stripe Checkout, Resend.

## Where things live

| Path | What |
|---|---|
| `app/(site)/**` | Public pages |
| `app/admin/**` | The team space (`(desk)` holds the signed-in pages) |
| `app/api/**` | Routes: donations, Stripe webhook and return, email webhook, cron jobs, uploads, dev helpers |
| `components/**` | UI. `components/ui` is the plain design-system kit; `components/admin` the team space |
| `lib/content/**` | Website content: schemas, the store, reading and publishing |
| `lib/server/**` | Server only: data access (`dal`), workflows, payments, email, AI, auth, cron, retention |
| `lib/model/**` | Shared types, permissions, statuses and labels |
| `content/seed/**` | Starting content. Placeholders are marked `// CLIENT` |
| `docs/platform/**` | The plan and design documents, the go-live runbook and the Firebase guide |
| `scripts/**` | QA checks, media generation, data and go-live scripts |
| `.data/` | Practice-mode data (not committed) |

## Checks

All browser checks use the installed Chrome (playwright-core). Run them against a production build on port 3100 unless noted.

| Command | What it checks |
|---|---|
| `node scripts/qa/data-selftest.mjs --base http://localhost:3100` | The data engine, permissions, workflows, payments, email, AI, Zoom and retention (185 cases) |
| `node scripts/qa/rbac.mjs --base http://localhost:3100 --phase a` | Every role sees only what it should |
| `node scripts/qa/admin/audit.mjs --base http://localhost:3100` | Team space: no sideways scrolling at 375/768/1280 and an accessibility audit |
| `node scripts/qa/admin/a2.mjs` … `a9.mjs`, `sheets.mjs` | The team space, area by area |
| `node scripts/qa/admin/q2.mjs --base http://localhost:3100` | Every role on a phone (360 and 390 wide), and focus in the ＋ New sheets |
| `node scripts/qa/forms.mjs --base http://localhost:3100` | Every public form end to end (support, concern, contact, volunteer, partnership, report request, newsletter, privacy request, story, donation); one form with `forms/<form>.mjs` |
| `node scripts/qa/practice-run.mjs --base http://localhost:3100` | The forms, then the team opens and takes each new record, then the emails |
| `node scripts/qa/i-gate.mjs` | Email wording, receipts, donor links, scheduled jobs, analytics and bot protection |
| `node scripts/qa/cron.mjs`, `stripe-webhook.mjs` | Scheduled jobs and the payment webhook |
| `node scripts/qa/leaks.mjs --base http://localhost:3100` | No secret reaches the browser |
| `node scripts/qa/actions-unauth.mjs`, `concern-isolation.mjs`, `routes-probe.mjs` (each `--base http://localhost:3100`), `dal-guards.mjs` | The security review: actions, cached readers, concern isolation, routes and headers (see `docs/platform/SECURITY-REVIEW.md`) |
| `node scripts/qa/firebase-preflight.mjs` | Firebase files and settings before go-live |
| `node scripts/qa/overflow.mjs 375 768 1280 1440 --all`, `a11y.mjs --all`, `reduced-motion.mjs`, `lcp.mjs`, `lighthouse.mjs` | Public site layout, accessibility, reduced motion and speed. `--role <role>` or `--cookie` checks signed-in pages |
| `node scripts/qa/env-check.mjs`, `handoff-check.mjs` | `.env.example` and `HANDOFF.md` are complete |

Keep the app's browser pane off admin pages while these run (its reload loop slows the dev server).

## Media (Optiq / Vertex)

All photography, video and brush art are original, generated with Optiq Studio (Vertex AI). Credentials come from Optiq's service account at `C:\Projects\optiq\secrets\davelabs-tools-sa.json` (never copied into this repo).

```bash
node scripts/media/gen-images.mjs --dry-run
```

Prompts live in `scripts/media/manifest.mjs`; `node scripts/media/audit-mix.mjs` checks the people mix. Media URLs are content-hashed (`content/media-map.ts`), so a replaced picture always gets a new URL.

The imagery rules: about a third Black people, the rest South Asian, Southeast Asian and Arab, no white people; families are a mother and a father with their children; the child is the one being helped; no school crests, badges or signage. Every prompt names the nationality.

## Before launch

- `HANDOFF.md`: everything the organisation still has to provide or decide.
- `docs/platform/RUNBOOK.md`: the go-live order.
- `docs/platform/FIREBASE-GO-LIVE.md`: switching from practice mode to Firebase.
- `docs/platform/SECURITY-REVIEW.md`: the security review, its findings and how to repeat it.
