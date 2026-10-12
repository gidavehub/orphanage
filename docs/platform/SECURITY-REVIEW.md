# Haven security review (Phase Q3)

Reviewed 2026-10-11 against a production build in practice mode. Every check below is a script, so the review can be repeated before launch and after any large change.

## How to repeat it

Run against a production build (`npm run build`, then `npx next start -p 3100`):

| Command | What it proves |
|---|---|
| `node scripts/qa/dal-guards.mjs` | Every exported data-access function checks who is asking (static scan) |
| `node scripts/qa/actions-unauth.mjs --base http://localhost:3100` | Every admin Server Action refuses visitors and Viewers; actions shared with public pages and every cached reader answer nothing private when called directly |
| `node scripts/qa/concern-isolation.mjs --base http://localhost:3100` | A concern's narrative, place and reporter never appear outside its own page, for any of the eight roles, and are sealed on disk |
| `node scripts/qa/routes-probe.mjs --base http://localhost:3100` | Hostile requests to every API route, token link and file path get a calm refusal; security headers are in place |
| `node scripts/qa/rbac.mjs --base http://localhost:3100 --phase a` | Each role sees only its areas |
| `node scripts/qa/leaks.mjs --base http://localhost:3100` | No secret reaches the browser |

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Medium | **Cached readers could be called directly.** In Next.js every `'use cache'` function is also a server reference: anyone can POST its id as a Server Action, with any argument. Through `getContent` and `getCollection` that returned the monthly story plan (`settings.editorial`: reviewer staff ids, topics, voice), each published post's review trail and AI sources, and staff ids on figure verifications and consent records. Unknown ids were accepted. | **Fixed.** The cached readers refuse unknown and staff-only ids, drop staff fields, and outside draft preview return published posts only (`lib/content/read.ts`, "Public projection"). The AI writer reads the plan through the uncached `getEditorialSettings()`. `actions-unauth.mjs` now calls all 16 cached readers with every content id and collection name. |
| 2 | Medium | **Practice sign-in on a self-hosted server.** Off Vercel and without Firebase keys, the practice role buttons and `/api/dev/*` were on even with a real site address. | **Fixed.** Practice helpers also require `NEXT_PUBLIC_SITE_URL` to be unset or local (`lib/server/dev/guard.ts`). On Vercel they were already impossible. |
| 3 | Low | Three data-access helpers relied on their callers' checks (`targetOptions`, `listBoard`, `staffRefs`). All callers did check. | **Fixed** (made explicit): `targetOptions` checks itself, `listBoard` takes the caller's Viewer, `staffRefs` (team display names only) is the one allowed exception. Enforced by `dal-guards.mjs`. |
| 4 | Low | Seven sign-in-free actions (sign in, first admin, confirm, forgot, invite, reset, undo unsubscribe) answered 500 when called with something other than a form. No data, but noisy logs. | **Fixed:** `formDataOf()` treats anything else as an empty form. |
| 5 | Low | Seventeen staff actions throw (500) on malformed arguments, *after* their permission check, so only a signed-in staff member with that permission can trigger it, and nothing is changed or returned. | Accepted. Tidy up when those actions are next touched. |
| 6 | Low | A malformed `%`-sequence in a dynamic URL (`/r/%E0%A4%A`) gets Next.js's bare "Internal Server Error" before any Haven code runs. No detail is shown. | Accepted (framework behaviour). |
| 7 | Info | `getLiveMediaUsage` (used for "Used in" and the illustrative-image notice) lists item ids of the published layer, which can include a scheduled post's id a few hours early. | Accepted. |
| 8 | Info | The Content-Security-Policy is **Report-Only**. | By design until the reports are clean on the live site; then switch the header name in `next.config.ts`. |

## Verified and unchanged

- **Admin actions:** 100 admin-only actions, signed out, are redirected to sign-in before they run. As a Viewer, none succeeds and none answers with an email address or reference. 26 actions shared with public pages, called signed out, succeed in nothing and return no data.
- **Data access:** 112 exported functions; each calls `requireStaff`, receives the Viewer it returned, or calls a function that does. Records are read through `readRecordFor()`, so ids from a URL are never trusted.
- **Concern isolation:** checked for all 8 roles in about 320 places: every admin page (with notifications), search by marker and by reference, the email log and each email, every CSV (with and without contact details), and the concern's own page and title. Details appear only on the concern's page, and only for roles with `concern.read`. Other roles never even see the reference. On disk the narrative and reporter are sealed (no plain text in `.data/`). Notification titles, email subjects and Activity sentences are fixed wording.
- **Exports:** no concern dataset exists. Contact columns need the contact permission and a sign-in within 30 minutes. Every export is logged.
- **Token links:** receipts, payment links, the Stripe portal, report downloads, unsubscribe, newsletter confirmation, donation management, invitations, password resets and privacy requests. Each one, given garbage, lands on a friendly page with no data.
- **Files:** `/m/*` serves only `public/media` (checked against consent on every request; 410 once withdrawn) and `public/resources`. Traversal and private prefixes get a plain 404.
- **Webhooks and jobs:** Stripe and Resend webhooks refuse unsigned bodies (503 while not configured). Cron routes refuse a missing or wrong secret.
- **Cross-site requests:** the donation, upload, session and practice sign-in routes refuse a foreign `Origin`.
- **Headers:** CSP (Report-Only), `X-Frame-Options: SAMEORIGIN`, `nosniff`, HSTS (2 years, preload), Referrer-Policy and Permissions-Policy on every page. Admin pages are `noindex` and `no-store`; token routes `no-referrer` and `no-store`. `robots.txt` disallows `/admin`.
- **Practice helpers:** all five `/api/dev/*` routes call `devOnly()` first.
