# Haven go-live runbook

The order to switch Haven from practice mode to the live site. Each step can be checked before the next. What the organisation must provide first is listed in `HANDOFF.md`.

Run the checks against the deployed site where a step says so. Keep every secret out of chat and email: paste values only into Vercel's Environment Variables.

## 0. Before you start

- The domain is decided and you can edit its DNS.
- The Vercel project is created and connected to the repository. Decide **Pro** (jobs every 15 minutes) or **Hobby** (daily jobs plus the GitHub pinger, step 6).
- Two people agree to keep an offline copy of `HAVEN_DATA_KEY`.

## 1. Firebase (data, files and sign-in)

Follow `docs/platform/FIREBASE-GO-LIVE.md`. In short:

1. Switch billing on (Blaze) for the project `orphanage-project-511119`. The database (US, `nam5`), its rules and indexes are already in place.
2. Deploy the TTL policies and the storage rules: `firebase deploy --only firestore:indexes,storage --project orphanage-project-511119`.
3. Storage bucket settings and CORS; Authentication: Email/Password, TOTP sign-in codes, sign-up off, 12-character passwords, the site's domain authorised.
4. In Vercel Production: `FIREBASE_SERVICE_ACCOUNT_JSON` (one line), the `NEXT_PUBLIC_FIREBASE_*` values (including `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`).

Check: `node scripts/qa/firebase-preflight.mjs` shows everything ready.

## 2. Secrets

Set in Vercel Production (generate each with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`):

| Variable | Note |
|---|---|
| `HAVEN_DATA_KEY`, `HAVEN_DATA_KEY_ID` | Seals case narratives. Keep the offline copies now. |
| `HAVEN_HMAC_SECRET` | Signs links (receipts, magic links, downloads). |
| `HAVEN_LOOKUP_SECRET` | Donor and email lookups. **Never change it** once donors exist. |
| `CRON_SECRET` | Scheduled jobs. |
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>`, no trailing slash. |

Deploy. The server log's first lines show `data=firestore` and list any production variable still missing (names only).

## 3. Content and the first super admin

1. Copy what the team wrote in practice mode (dry run first):

   ```bash
   node scripts/data/push-local.mjs --content-only
   ```

   ```bash
   node scripts/data/push-local.mjs --content-only --commit --project orphanage-project-511119
   ```

2. Create the first super admin:

   ```bash
   node scripts/data/create-super-admin.mjs --project orphanage-project-511119 --email <address> --name "<name>"
   ```

3. They sign in at `/admin/login`, set up a sign-in code, and invite the team from **Team**.

## 4. Email (Resend)

1. Create the Resend account and add the sending domain (for example `mail.<domain>`). Add Resend's DKIM and SPF records, and DMARC `v=DMARC1; p=none; rua=mailto:dmarc@<domain>` (tighten to `quarantine` after 30 days).
2. In Vercel: `RESEND_API_KEY`, `EMAIL_FROM` (`Haven <hello@mail.<domain>>`), `EMAIL_REPLY_TO`. Leave `EMAIL_REDIRECT_TO` unset in Production.
3. Optional delivery events: a Resend webhook to `https://<domain>/api/email/webhook` (delivered, delayed, bounced, complained); its secret goes in `RESEND_WEBHOOK_SECRET`.
4. Settings › Key information: the team mailboxes (support, safeguarding, donations, partnerships, media, privacy). Replies to Haven's emails go to them.

Check: Settings › Connections → "Send me a test email" arrives; the email log shows it as sent.

## 5. Card payments (Stripe)

1. Open the account under a registered entity (Stripe doesn't onboard businesses in The Gambia); request nonprofit pricing if eligible. Branding: forest `#1f715a`, marigold `#f5af08`, statement descriptor `HAVEN GIFT`.
2. Customer emails: turn **off** successful-payment, refund and failed-payment emails (Haven sends its own).
3. Customer portal: allow updating the card, invoice history and cancelling at period end; disallow switching plans and quantities; business links to `/policies/privacy` and `/policies/terms`.
4. Webhook endpoint `https://<domain>/api/stripe/webhook`, API version **2026-09-30.endive**, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`. Copy its secret into `STRIPE_WEBHOOK_SECRET`.
5. A restricted key (`rk_live_…`) with: Checkout Sessions, Products, Refunds, Customer portal **write**; Customers, Subscriptions, Invoices, Invoice Payments, PaymentIntents, Charges, Balance transactions **read**. Put it in `STRIPE_SECRET_KEY`. `STRIPE_CURRENCIES=USD,GBP,EUR` (add `GMD` only after a live GMD test).
6. Radar: keep the defaults and add "Block if CVC check fails".
7. Settings › Giving: choose card or local payment per currency, and enter the mobile-money and bank details.

Check, with a test key first (`sk_test_…` or `rk_test_…`): a gift with card `4242 4242 4242 4242` reaches the thank-you page, appears in Giving as received, thanked and placed, and its receipt email is sent. A monthly gift creates a regular gift. Then switch to the live key. Donors who pledged "card: email me a link" while cards were off appear on Giving with **Send them a payment link**.

## 6. Scheduled jobs

`vercel.json` runs the tick daily at 06:00 UTC, retention at 02:30 and the editorial job at 08:00.

- **Pro plan:** change the tick's schedule in `vercel.json` to `*/15 * * * *` and delete `.github/workflows/cron-tick.yml`.
- **Hobby plan:** keep the workflow; in GitHub add the repository secret `CRON_SECRET` and the variable `SITE_URL`. It calls the tick every 15 minutes.

Check: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/tick` answers a JSON summary with every step `ok`.

## 7. Optional services

- **Writing helper:** `AI_PROVIDER` (`anthropic` or `gemini`) and its key or Google service account (`ANTHROPIC_API_KEY`, or `GOOGLE_CLOUD_PROJECT` with `GOOGLE_SERVICE_ACCOUNT_JSON`). Posts › Plan sets the drafting day.
- **Zoom:** `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_DEFAULT_HOST` (a licensed host). Sessions then show "Make a Zoom meeting".
- **Bot protection:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (rebuild after setting the public key).
- **Analytics:** enable Web Analytics in the Vercel project. Custom events need `NEXT_PUBLIC_ANALYTICS_EVENTS=on` and a Pro plan.

## 8. Launch checklist

1. Website › **Before launch**: work through every placeholder. Turn on **Hide figures that aren't verified** if any figure is still unverified.
2. Replace or label every AI-generated picture of a child (see `HANDOFF.md` §5).
3. Policies approved and live (Safeguarding, Privacy with the list of processors, Terms).
4. Safeguarding alert recipients set (Settings) and a test concern reaches them by email and in the admin.
5. Settings › Data: retention periods confirmed.
6. Run the checks against the live site: `data-selftest.mjs` (with a super admin session), `leaks.mjs`, `routes-probe.mjs`, and a manual pass through each public form. Repeat the full security review (`docs/platform/SECURITY-REVIEW.md`) on the last build before launch.
7. Remove the practice sign-in: practice mode switches off by itself once Firebase is connected; confirm the login page shows no practice role buttons.
8. Measure speed on the live site: PageSpeed Insights (mobile) for `/`, `/donate/education`, `/programmes/education` and one news post. The target is a performance score of 85+ and LCP under 2.5 s. See "Speed" below.
9. Announce. Watch Settings › Connections and the email log for the first few days.

## Speed

Measured 2026-10-12 on a local production build (`next start`: HTTP/1.1, gzip, no CDN):

| | Desktop (Lighthouse) | Mobile (Lighthouse, simulated) | Mobile, real Chrome (4× CPU, 1.6 Mbps) |
|---|---|---|---|
| `/` | 98 | 45–49 | LCP 3.6 s |
| `/donate/education` | 98 | 65 | LCP 3.8 s |
| `/programmes/education` | 98 | 62–67 | LCP 3.8 s |
| news post | 99 | 49–67 | LCP 3.0 s |

Locally, mobile is limited by bandwidth: over HTTP/1.1 the page's async scripts download alongside its stylesheet, so the first paint waits about 3 s on a slow connection. Lighthouse's simulation also counts the hydration scripts against the hero image, because on localhost they finish before the first frame. Vercel serves HTTP/2 with priorities, Brotli and a CDN, so measure there before deciding on more work.

Already done: links inside closed menus no longer prefetch whole routes, background videos wait until the page has loaded (and skip Save-Data and 2G), smooth scrolling and GSAP load when the page is idle, and the donate and programme heroes reveal with CSS from the first paint.

If the live mobile score is still under 85, the next levers, in order:
1. Lazy-load the landing's scroll-scrubbed sections (Focus, Manifesto, Join) and their GSAP code.
2. Turn more of the public site's client components into server components.
3. Make the landing hero film poster-only on phones.
