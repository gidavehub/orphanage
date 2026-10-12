# Next.js 16 rules for the Haven platform

**Audience:** anyone writing code for the Haven platform (public site, admin, API).

**Sources:** every rule below was checked against the docs bundled with the installed version, `node_modules/next/dist/docs/` (Next **16.3.6**, React **19.2.8**). Section names in brackets point to those files. Where a rule comes from Vercel's or Stripe's platform behaviour rather than the Next docs, it is marked **[platform]**.

**Rule:** if your memory of Next.js disagrees with this file, this file wins. If this file disagrees with the bundled docs, the docs win; fix this file.

---

## 0. The short version (read this if nothing else)

1. **Turn on Cache Components.** The first platform PR sets `cacheComponents: true` and makes the four small fixes in §2.2. With it on:
   - nothing is cached unless you write `'use cache'`;
   - `export const dynamic`, `revalidate`, `fetchCache` and `dynamicParams` are build errors.
2. **Use `proxy.ts`, not `middleware.ts`.**
   - The file goes in the project root (`C:\Projects\orphanage\proxy.ts`) and exports `function proxy`.
   - It always runs on Node; you cannot set `runtime` in it.
   - It does one thing only: an optimistic cookie check on `/admin/:path*`.
3. **Every admin page, Server Action and Route Handler re-checks the session itself** with `requireStaff(...)` from `lib/auth/session.ts`. Proxy is not a security boundary. Neither is a layout.
4. **Choosing between Server Actions and Route Handlers:**
   - **Server Actions** for every form, public and admin.
   - **Route Handlers** for Stripe (checkout and webhook), cron, upload signing and fallback media serving.
   - Files never go through a Server Action.
5. **Public content reads** live in `'use cache'` functions with `cacheLife('max')` and a `cacheTag(...)` from `lib/cache/tags.ts`. **Writes depend on where they happen:**
   - Admin Server Actions call `updateTag(tag)` (the change is visible on the next request).
   - Webhooks and cron call `revalidateTag(tag, 'max')`.
6. **`params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are all async.** Await them inside a `<Suspense>` boundary or under a `loading.tsx`, never at the top of a layout.
7. **Never call `new Date()`, `Date.now()`, `Math.random()` or `crypto.randomUUID()` during render.** Use them only:
   - inside `'use cache'` (one value shared by every visitor);
   - after `await io()` or `await connection()` inside `<Suspense>`;
   - in effects, event handlers, actions and route handlers.
8. **The edge runtime is deprecated.** Never write `export const runtime = 'edge'`. `firebase-admin` and `stripe` run on Node, which is the default everywhere.
9. **Environment variables:**
   - Secrets have no prefix and are read only from `server-only` modules.
   - `NEXT_PUBLIC_*` values are inlined into the client bundle **at build time**, so changing them on Vercel needs a redeploy.
10. **Raw webhook body:** read it with `await request.text()`. Never call `request.json()` first.
11. **Cron:** `vercel.json` `crons` sends a GET to a Route Handler. The handler checks `Authorization: Bearer ${CRON_SECRET}` **as its first statement**.
12. **Images:**
    - Use the `preload` prop, not `priority` (deprecated).
    - Never put query strings on local `src` values.
    - Optimised images are cached for 4 hours and cannot be invalidated, so every replaced image needs a new URL.
13. **`error.tsx` receives `{ error, retry }`.** `retry` became stable in 16.3; use it instead of `reset`.
14. **Do not use** `forbidden()`/`unauthorized()` (experimental), `global-not-found` (experimental), `unstable_cache` (replaced), `unstable_noStore` (legacy) or the single-argument form `revalidateTag(tag)` (deprecated; it is a TypeScript error).
15. **Activity:** with Cache Components, pages you navigate away from are hidden (React `<Activity>`), not unmounted. Effects must clean up: pause videos, kill GSAP. Logout must do a full page reload.

---

## 1. What exists today

| Item | State | Notes |
|---|---|---|
| `next` | 16.3.6 | Turbopack is the default for `dev` and `build`. Do not add a `webpack` key, because `next build` fails if one exists ([upgrading/version-16]). |
| `react` / `react-dom` | 19.2.8 | `ViewTransition`, `Activity` and `useEffectEvent` are available from `react` with no flag. |
| Backend libraries already in `package.json` | `firebase@13`, `firebase-admin@14.5`, `stripe@23`, `zod@4.6`, `server-only` | `firebase-admin` is on Next's built-in `serverExternalPackages` list, so it needs no config. `jose` is only a transitive dependency; don't import it, use `node:crypto`. |
| `@google/genai`, `google-auth-library` | `devDependencies` | Move them to `dependencies` once **app runtime code** imports them, for example the monthly AI blog draft. |
| `next.config.ts` | `images.qualities: [70, 75, 85]`, `images.formats: ['image/webp']` | AVIF stays off; it hung on a generated portrait. Cache Components is **off** today. |
| `app/` | One route (`app/page.tsx`) plus `layout.tsx`, `icon.svg`, `opengraph-image.tsx`, `robots.ts`, `sitemap.ts` | Root layout already uses the global `LayoutProps<"/">` helper. |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_*` present | `FIREBASE_SERVICE_ACCOUNT_JSON`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are pending. |
| `.gitignore` | `.env*` ignored | That rule also hides the planned `.env.example`. Add `!.env.example`, and add `/.data/`. |
| Node | ≥ 20.9 required | TypeScript ≥ 5.1. `next lint` is removed; `npm run lint` already calls `eslint` directly. |

---

## 2. Decision: Cache Components ON

### 2.1 Why (and the one rejected alternative)

The previous caching model would also work on Vercel, using `revalidatePath` plus static rendering. But its only way to cache a non-`fetch` data source, such as Firestore or our `.data` JSON, is `unstable_cache`. The docs mark that API as *"replaced by `use cache` in Next.js 16"* ([functions/unstable_cache]).

Cache Components gives us four things the previous model cannot:

- **Static shells for every public page**, even when part of the page is per-request. Examples: `/donate/thank-you?session_id=` and a signed-in "Edit this page" pill.
- **Tag-precise invalidation with `updateTag`**, so an admin's edit shows on the next request.
- **Build errors instead of silent full-dynamic pages** when someone reads cookies in the wrong place.
- **The documented model** for every v16 guide we will follow, including `authentication-with-cache-components.md`.

**Recommendation:** enable it in the first platform PR, before any new route is written.

### 2.2 Day-0 migration (exact fixes, all small)

Enabling the flag makes these existing files fail or misbehave. Fix them in the same PR.

1. **`next.config.ts`:** add `cacheComponents: true`. The full target config is in §15.
2. **`components/layout/Footer.tsx:39`** has `const year = new Date().getFullYear()` in a Server Component. That is a prerender error ("blocking-prerender-current-time"). Replace it with a cached leaf:
   ```tsx
   // components/layout/CurrentYear.tsx (Server Component)
   import { cacheLife } from 'next/cache'

   export async function CurrentYear() {
     'use cache'
     cacheLife('days')
     return <>{new Date().getFullYear()}</>
   }
   ```
3. **`components/sections/Founder.tsx:13`** has the same problem in `new Date().getFullYear() - site.foundedYear`. Make `Founder` an `async` Server Component and use the helper below. `Counter` still receives a plain number.
   ```ts
   async function yearsOfService() {
     'use cache'
     cacheLife('days')
     return new Date().getFullYear() - site.foundedYear
   }
   ```
4. **`app/opengraph-image.tsx`** awaits `readFile` during render. Move the three reads to module scope (top-level `await`), as [getting-started/08-caching "Predictable values"] recommends for fonts and config files, so the image stays prerendered.
5. **`app/sitemap.ts`** has `lastModified: new Date()`. The platform sitemap gets rewritten anyway: list every route from cached content getters, and use each document's `updatedAt` (ISO string). Never use `new Date()`.
6. **`components/ui/AutoVideo.tsx`:** the effect cleanup disconnects the observer but never pauses the video. A route hidden by Activity keeps playing, because `display: none` does not stop media ([guides/preserving-ui-state]). Add `v.pause()` to the cleanup.
7. **Check after the change:**
   - Run `next build`; it must report zero blocking-prerender errors.
   - Run `node scripts/qa/shoot.mjs`, `hero-frames.mjs` and `donate-flow.mjs` against `next start -p 3100`.
   - Navigate home → another page → back, and confirm the GSAP pins (Focus, Manifesto) rebuild correctly. `useGSAP` cleanup runs on hide and rebuilds on show.

**Escape hatch only, not a pattern:** `export const instant = false` on a segment lets it block on runtime data while you fix it ([route-segment-config/instant]). It does **not** clear synchronous-time or random-value errors.

---

## 3. Route tree, file conventions, layouts

The information-architecture doc owns the page list. These are the Next-level constraints that shape it.

- **One root layout.** `app/layout.tsx` keeps `<html>`, `<body>`, the four `next/font` families, `globals.css` and the base `metadata`/`viewport`.
  - Don't create multiple root layouts. Navigating between them is a **full page reload**, and a site-wide 404 would then need the experimental `global-not-found` ([file-conventions/route-groups], [not-found]).
- **Route groups under the one root:**
  ```
  app/
    layout.tsx              root: html/body/fonts/globals. Move <SmoothScroll> OUT of here.
    global-error.tsx        'use client'; renders its own <html><body>; props { error, retry }
    not-found.tsx           unmatched URLs. Renders inside the ROOT layout only (no Header/Footer),
                            so it brings its own small branded header
    robots.ts  sitemap.ts  opengraph-image.tsx  icon.svg
    (site)/
      layout.tsx            <SmoothScroll><Header/>{children}<Footer/><ScrollTop/></SmoothScroll>
      error.tsx
      page.tsx              the landing page (moved from app/page.tsx, minus Header/Footer)
      programmes/[slug]/page.tsx  loading.tsx  opengraph-image.tsx
      donate/page.tsx  donate/[cause]/page.tsx  donate/thank-you/page.tsx
      news/[slug]/...
    admin/
      layout.tsx            metadata: noindex. No Lenis. No session read.
      login/page.tsx        static shell + client sign-in form
      (desk)/
        layout.tsx          warm admin frame. Session-dependent bits are inside <Suspense>
        loading.tsx         REQUIRED: the Suspense boundary every desk page's session read sits under
        error.tsx
        page.tsx            /admin "Today" home
        ...
    api/
      stripe/checkout/route.ts   stripe/webhook/route.ts
      cron/monthly-blog-draft/route.ts
      uploads/route.ts           media/[...key]/route.ts   (local fallback only)
  proxy.ts
  vercel.json
  ```
- **Lenis stays out of the admin.** `SmoothScroll` (Lenis plus the GSAP ticker) moves to `app/(site)/layout.tsx`. The admin needs native scrolling, especially on phones.
- **No `route.ts` next to a `page.tsx`** in the same segment; that is a conflict ([getting-started/15-route-handlers]).
- **Every dynamic segment** (`[slug]`, `[cause]`, `[id]`) gets a `loading.tsx`, **or** its page passes the `params` promise into a `<Suspense>`-wrapped child. **Never `await params` in a layout of a dynamic segment.** The layout sits outside that segment's `loading.tsx`, so with unknown params it blocks the shell ([guides/incremental-static-regeneration-cache-components]).
- **Parallel routes** (`@slot`) require a `default.tsx`, or the build fails ([upgrading/version-16]). Don't use them unless needed.
- **Error UI:**
  - `error.tsx` and `global-error.tsx` must be `'use client'`.
  - Props are `{ error: Error & { digest?: string }; retry: () => void }`. `retry` re-fetches; `reset` only clears state ([file-conventions/error]).
  - For component-level boundaries use `catchError` from `next/error` (stable since 16.3).
- **Directives go first.** `'use client'`, `'use server'` and file-level `'use cache'` must be the **first statement** in the file, before imports such as `import 'server-only'`.
- **`'use server'` files may export only async functions.** Put zod schemas, types and constants in `lib/forms/schemas.ts` and import them.

---

## 4. Proxy (formerly middleware)

| Fact | Source |
|---|---|
| `middleware.ts` and the `middleware` export are **deprecated**. Use `proxy.ts` with `export function proxy` (or a default export). | [file-conventions/proxy], [upgrading/version-16] |
| Location: the project root, next to `app/`. Only **one** proxy file per project. | [getting-started/16-proxy] |
| Runtime is **always Node.js**. Exporting `runtime` from proxy **throws**. `node:crypto` works. | [file-conventions/proxy "Runtime"] |
| Config flags renamed, for example `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`, `middlewareClientMaxBodySize` → `experimental.proxyClientMaxBodySize`. | [version-16], `config-shared.d.ts` |
| Proxy **buffers the request body up to 10 MB** for any route it matches. Beyond that the body is **silently truncated**. | [next-config-js/proxyClientMaxBodySize] |
| A matcher that excludes a path also skips the **Server Actions posted to that path**. | [file-conventions/proxy "Execution order"] |
| `fetch` caching options do nothing inside proxy. `revalidatePath`/`revalidateTag` cannot be called there. | [16-proxy], [revalidateTag] |
| Don't share module state or globals between proxy and the app. | [file-conventions/proxy] |

**Haven's proxy is deliberately tiny.** It runs only on `/admin/:path*`, so:

- the Stripe webhook and uploads under `/api` are never body-buffered;
- public pages pay nothing.

Security headers go in `next.config.ts` `headers()` (see §15), not in proxy.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/constants' // plain constant module, no imports

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname === '/admin/login') return NextResponse.next()

  // Optimistic check only: does a session cookie exist? Verification happens in the DAL.
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/admin/login', request.url)
    login.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'], // `*` = zero or more, so '/admin' itself is matched
}
```

- The login page must only follow a `next` value that starts with `/admin/`. Anything else is an open redirect.
- Never place upload or large-body Route Handlers under `/admin/...`. Put them under `/api/...` and authorize inside the handler.

---

## 5. Protecting `/admin`: the three layers

1. **Proxy:** cookie present or redirect to login (§4). This is UX, not security.
2. **The Data Access Layer (`lib/auth/session.ts`, `server-only`)** verifies the session and role. It is called by:
   - every admin page (at the top, which is fine because `(desk)/loading.tsx` wraps it in Suspense);
   - every admin Server Action (first line);
   - every authenticated Route Handler (first line).

   A page-level check does **not** cover the Server Actions defined in it, and layouts do not re-render on navigation ([guides/data-security], [guides/authentication "Layouts and auth checks"]).
3. **Role-scoped data functions.** For example, `getConcerns()` calls `requireStaff('safeguarding_officer')` itself, so a forgotten page check cannot leak child-protection cases.

```ts
// lib/auth/constants.ts
export const SESSION_COOKIE = 'haven_session'

// lib/auth/session.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE } from './constants'
import { verifySessionToken } from './verify'        // Firebase: adminAuth.verifySessionCookie(token, true)
                                                     // fallback: HMAC (node:crypto) over .data staff
import { getStaffProfile } from '@/lib/data/staff'

export type Role =
  | 'super_admin' | 'content_manager' | 'programme_officer' | 'safeguarding_officer'
  | 'finance_officer' | 'counsellor' | 'report_manager' | 'viewer'

export type Staff = { uid: string; name: string; email: string; roles: Role[] } // a DTO, never a raw doc

/** Request-memoised (React.cache). Never call inside 'use cache'. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const claims = await verifySessionToken(token) // null if invalid, expired or revoked
  return claims ? getStaffProfile(claims.uid) : null // null if the staff account is disabled
})

/** Pages and Server Actions. Throws a redirect, so call it OUTSIDE try/catch. */
export async function requireStaff(...anyOf: Role[]): Promise<Staff> {
  const staff = await getStaff()
  if (!staff) redirect('/admin/login')
  const allowed =
    anyOf.length === 0 || staff.roles.includes('super_admin') || anyOf.some((r) => staff.roles.includes(r))
  if (!allowed) redirect('/admin?notice=not-allowed')
  return staff
}
```

**In Route Handlers**, use `const staff = await getStaff()` and return `401` or `403` yourself. Don't `redirect()` an API call.

**Session cookie:**

- It is set **only** in a Server Action or Route Handler ([functions/cookies]).
- The session-start action (for example, exchanging a Firebase ID token for a session cookie) sets these options:
  ```ts
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Safari drops Secure cookies on http://localhost
    sameSite: 'lax',                               // 'strict' would break links from alert emails
    path: '/',
    maxAge: 60 * 60 * 8,                           // one working day
  })
  ```
- **Logout:** a Server Action deletes the cookie. The client then calls `window.location.replace('/admin/login')`. A **full reload** is required because Activity would otherwise keep the previous staff member's admin screens and form drafts alive in hidden routes. Offices share devices, so this is a safeguarding issue ([guides/preserving-ui-state "State and authentication"]).

**Auth-aware UI under Cache Components:**

- `(desk)/layout.tsx` must not `await` the session at its top level: a layout's runtime read does not fall back to the same segment's `loading.tsx` and holds up `{children}`.
- Put the greeting ("Hi Amina") and role-filtered nav in a small async component inside `<Suspense>`.
- Pass staff data to client components as plain props, or as a promise through context unwrapped with `use()` ([guides/authentication-with-cache-components]).

---

## 6. Server Actions vs Route Handlers

| Job | Use | Where | Why |
|---|---|---|---|
| Public forms: support request, report a concern, contact, volunteer, partner, in-kind offer, report request, newsletter | **Server Action** + `useActionState` | `app/(site)/**/actions.ts`, logic in `lib/forms/*` | Built-in Origin/Host CSRF check, progressive enhancement, typed result, 1 MB limit is plenty for text |
| Admin mutations: content, statuses, notes, assignments, blog publish | **Server Action** | `app/admin/(desk)/**/actions.ts` | Same, plus `updateTag` (Server-Action-only) for read-your-own-writes |
| Session start and logout | **Server Action** | `app/admin/login/actions.ts` | Can set and delete cookies |
| Stripe Checkout session | **Route Handler** `POST /api/stripe/checkout` | owner direction | JSON in, `{ url }` or `{ pledge }` out (§12) |
| Stripe webhook | **Route Handler** `POST /api/stripe/webhook` | | Needs the raw body and a non-HTML response |
| Cron | **Route Handler** `GET /api/cron/*` | | Vercel Cron calls a URL with GET |
| File uploads (sensitive documents, admin media) | **Route Handler** `POST /api/uploads` returns a signed upload URL; the **browser uploads straight to Storage** | | Server Actions cap at 1 MB; Vercel functions cap request bodies at **4.5 MB [platform]**; the docs say *"upload them from the browser and store the returned URI"* ([guides/backend-for-frontend "Verify payloads"]) |
| Fallback media serving (no Firebase) | **Route Handler** `GET /api/media/[...key]` | dev only | `.data/` is outside `public/` |
| CSV exports | **Route Handler** `GET /admin/export/[kind]` | inside `/admin`, so proxy-covered | Returns `text/csv` with `Content-Disposition`; still calls `getStaff()` |
| Reading data for a page | **Neither:** a Server Component calls the DAL directly | | Route Handlers fail at build if called during prerender, and Server Actions are queued (sequential) |

### 6.1 Server Action rules

- **Authenticate and authorize inside every action.** They are reachable by a direct POST ([getting-started/07-mutating-data] warning).
- **Validate with zod 4.** Use `schema.safeParse(Object.fromEntries(formData))`, then return `z.flattenError(err).fieldErrors`. The docs' `invalid_type_error` and `.flatten()` examples are zod 3; in zod 4, `.flatten()` is deprecated.
- **Model expected errors as return values,** not throws ([getting-started/10-error-handling]). Shared result type:
  ```ts
  // lib/forms/action-state.ts
  export type ActionState =
    | { status: 'idle' }
    | { status: 'ok'; message: string; reference?: string }
    | { status: 'error'; message: string; fieldErrors?: Partial<Record<string, string[]>> }
  ```
- **Return DTOs only.** Return values are serialized to the browser.
- **`redirect()`/`notFound()` throw.** Keep them outside `try/catch`, or call `unstable_rethrow(err)` first in the `catch`. Call `updateTag`/`revalidatePath` **before** `redirect`.
- **IDs passed with `.bind(null, id)` or a hidden input are client-controlled.** Re-check that the role may act on that record.
- **Slow work** (emails, staff alerts, AI calls) goes in `after(() => …)` from `next/server`. It runs after the response, and Vercel keeps the function alive via `waitUntil` ([functions/after]).
- **Spam defence for public forms:**
  - a hidden honeypot input (return a fake `ok`);
  - a rate limit keyed on `(await headers()).get('x-forwarded-for')`, stored in the data store (memory does not persist between serverless instances).
- **Activity keeps form values and `useActionState` results** when a visitor navigates away and back. Reset on success (for example, `key={state.reference}` on the form) so a "Thank you, reference HVN-1234" message does not reappear on someone else's visit on a shared device.
- **Stale browser tabs.** A deploy changes action IDs, so an admin tab open across a deploy gets "Failed to find Server Action". Catch it in the client wrapper and show a warm "Please refresh, we've updated the site" toast ([guides/server-actions "Deployment considerations"]).
- **Body size limit.** The default is **1 MB**, including multipart overhead. Keep it. Raise it only if a real text payload needs more:
  ```ts
  experimental: { serverActions: { bodySizeLimit: '2mb' } } // still under `experimental` in 16.3
  ```
  Never raise it to push files through actions.
- **Long-running actions.** For example, "Regenerate draft with AI" on `/admin/blog/[id]`: `export const maxDuration = 60` **on that page** sets the timeout for every action used on the page ([route-segment-config/maxDuration]).

### 6.2 Route Handler rules

- **No automatic CSRF check.** Only Server Actions have one. Any handler that browsers POST to must:
  - require `content-type: application/json`, which forces a CORS preflight for cross-site requests;
  - compare `new URL(origin).host` with `x-forwarded-host ?? host`.
- **The body can be read once.** Use `request.clone()` if it is genuinely needed twice ([guides/backend-for-frontend]).
- **Under Cache Components, a `GET` handler that reads no request data and no uncached I/O is prerendered at build.** A `GET /api/status` returning `{ stripe: !!process.env.STRIPE_SECRET_KEY }` would report the *build's* value forever. Read the request (headers or URL) or `await connection()` before anything else.
- **Don't wrap request reads in `try/catch` in GET handlers.** Prerender bail-out works by throwing, and a `catch` swallows it ([guides/migrating-to-cache-components "Route Handlers"]).
- **Type the context** with the global `RouteContext<'/api/media/[...key]'>`; `params` is a Promise.

---

## 7. Caching model (Cache Components)

### 7.1 Defaults to internalise

- **Nothing is cached unless you say so.** `fetch` is not cached, database calls are not cached, pages are dynamic by default.
- **Prerendering builds a static shell from:**
  - static JSX;
  - `'use cache'` results with a long enough lifetime;
  - `<Suspense>` fallbacks;
  - module-scope values.
- **Uncached or runtime reads outside `<Suspense>` fail the build:** "blocking-prerender-runtime" and "blocking-prerender-dynamic" ([guides/building]).
- **`'use cache'` stores results in an in-memory LRU.** On Vercel's serverless instances it typically does **not** persist between requests, but **build-time prerenders and ISR'd pages are durable** ([directives/use-cache "Runtime caching considerations"]). Public pages get their speed from the prerendered page, not from the function cache. Fine for Haven; don't add `'use cache: remote'`.
- **All caches are per deployment.** A new deploy starts fresh.
- **Client router:** a `use cache` result stays fresh in the browser for its `stale` time (5 minutes for `max`), with a minimum of 30 seconds. An admin checking their edit should open the public page in a **new tab** (a full load); the "View on site" buttons use `target="_blank"`.

### 7.2 Reading public content

Every admin-editable public datum is read through a cached getter:

```ts
// lib/cache/tags.ts. One registry; tags are ≤256 chars, plain text, and NEVER contain personal data.
export const TAG = {
  site: 'content:site',              // contact details, socials, nav, footer, founder
  home: 'content:home',
  programmes: 'content:programmes',
  programme: (slug: string) => `content:programme:${slug}`,
  causes: 'content:causes',          // donation causes and appeals: copy plus "where the money goes"
  donationTotals: 'donations:totals',// raised-so-far bars (webhook-updated)
  impact: 'content:impact',
  posts: 'content:posts',
  post: (slug: string) => `content:post:${slug}`,
  resources: 'content:resources',
  testimonials: 'content:testimonials',
  team: 'content:team',
  faqs: 'content:faqs',
} as const
```

```ts
// lib/content/home.ts
import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { TAG } from '@/lib/cache/tags'
import { store } from '@/lib/data/store'      // Firestore or .data JSON, chosen by env
import { seedHome } from '@/content/seed/home' // today's content/home.ts becomes seed data
import type { HomeContent } from '@/lib/content/types'

export async function getHome(): Promise<HomeContent> {
  'use cache'
  cacheLife('max')   // stale 5m / revalidate 30d / expire 1y; edits arrive via tags, not time
  cacheTag(TAG.home)
  return (await store.get<HomeContent>('content', 'home')) ?? seedHome
}
```

**Rules for cached getters:**

- **Pair every `'use cache'` with an explicit `cacheLife` and at least one `cacheTag`.**
- **Arguments and return values must be serializable** (primitives, plain objects, arrays, `Date`, `Map`, `Set`). Class instances fail.
  - **Firestore `Timestamp`, `DocumentReference`, `DocumentSnapshot` and `GeoPoint` are class instances.** Map them to ISO strings or plain objects in the store adapter, before anything leaves it.
  - The same rule applies to props passed to Client Components.
- **No `cookies()`, `headers()`, `searchParams` or `connection()` inside a cached scope**, not even via a helper it calls. It may pass `next build` and then fail under `next start` ([directives/use-cache "Constraints"]). Read runtime values outside and pass them in as arguments.
- **Never cache personal data.** Support requests, concerns, donors and volunteers never go through `'use cache'`, because cache keys and tags are stored in plain text ([guides/authentication-with-cache-components]). Admin reads are always uncached.
- **Fallback rule.** If Firebase **is configured** and a read fails during `next build`, **throw**. Don't silently bake seed content into production. Fall back to seed only when Firebase is **not configured**.
- **Local JSON store in dev.** `.data/*.json` is read inside `use cache`. Edits made through the admin call `updateTag`, so they show immediately. Hand-edited JSON needs a dev-server restart. For debugging, use `NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev`.

### 7.3 Writing: which invalidation call

| Caller | Call | Effect |
|---|---|---|
| Admin Server Action (content edit, publish post, update stats) | `updateTag(TAG.x)` (and `updateTag(TAG.post(slug))`) | Expires immediately. The next request waits for fresh data, and the action's own response re-renders the current route ([functions/updateTag]). **Server Actions only**; it throws elsewhere. |
| Route Handler: Stripe webhook updates raised totals | `revalidateTag(TAG.donationTotals, 'max')` | Stale-while-revalidate: the next visitor triggers a background refresh ([functions/revalidateTag]). |
| Route Handler that must purge now (rare, for example cron publishing a scheduled post) | `revalidateTag(TAG.posts, { expire: 0 })` | Blocking refresh on the next request. |
| "Republish whole site" emergency button (super admin) | `revalidatePath('/', 'layout')` | Purges everything, including the client router cache. |
| Admin action whose UI depends on non-cached state | `refresh()` from `next/cache` | Re-renders the current route only; invalidates nothing ([functions/refresh]). |

- **`revalidateTag` with one argument is deprecated** and a TypeScript error. Always pass `'max'` or `{ expire: 0 }`.
- **Prefer tags to `revalidatePath`.** A path pattern with a dynamic segment needs the `type` argument, for example `revalidatePath('/news/[slug]', 'page')`.

### 7.4 Time, randomness, per-request values

| Need | Do |
|---|---|
| A value that is the same for everyone (current year, build stamp) | `'use cache'` + `cacheLife('days')` (§2.2) |
| A value per request on a page | `<Suspense>` around a component that does `await io()` (`next/cache`, new in 16.3, preferred) or `await connection()` (`next/server`) first |
| Random or ordered-by-time UI in a Client Component | Compute in `useEffect` or an event handler, not during render (render runs during prerender too) |
| IDs or timestamps for new records | Inside the Server Action or Route Handler. Requests are never prerendered. |

---

## 8. `params`, `searchParams`, `cookies()`, `headers()`

- **All are Promises.** Synchronous access is **removed** in v16 ([upgrading/version-16 "Async Request APIs"]). This includes `params` in `layout`, `page`, `route`, `default`, and `opengraph-image`/`icon` image functions; the `id` passed to `sitemap`; and `searchParams` in `page`.
- **Type with the generated global helpers** (no import needed; generated by `next dev`, `next build` or `npx next typegen`):
  ```tsx
  export default async function Page(props: PageProps<'/news/[slug]'>) {
    const { slug } = await props.params
  }
  export async function GET(_req: Request, ctx: RouteContext<'/api/media/[...key]'>) {
    const { key } = await ctx.params // string[]
  }
  ```
  Route literals are URL paths, with group names like `(site)` dropped.
- **Client Component pages** unwrap with `use(params)`.
- **`searchParams` is runtime data.** Read it inside `<Suspense>`, and pass the promise down rather than awaiting it at the top of the page ([getting-started/08-caching "Maximizing the static shell"]).
  - Prefer **path params for shareable, cacheable URLs**: `/donate/education` is prerendered, while `/donate?cause=education` cannot be.
  - Use query strings only for genuinely per-visit state (`?amount=25&freq=monthly`, `?session_id=`).
- **Client hooks:**
  - `useSearchParams()` **always** needs a `<Suspense>` boundary.
  - `usePathname`, `useParams` and `useSelectedLayoutSegment(s)` suspend when a route below has unknown dynamic params. Under Cache Components the build fails if they are not inside `<Suspense>` ([guides/migrating-to-cache-components]).
  - For an active-nav indicator in the shared Header, read the hook in a tiny leaf (`<ActiveNavMarker/>`) wrapped in `<Suspense fallback={null}>`. Never wrap the whole Header.
- **`generateStaticParams` must return at least one param** under Cache Components (an empty array is a build error).
  - Programmes and causes come from content and always have entries.
  - For news, `getPublishedPostSlugs()` falls back to the seeded posts, so it is never empty.
  - Unlisted params still work: an App Shell is served instantly and upgraded after the first visit.
- **`dynamicParams` is gone** (a build error under Cache Components). Unknown slugs call `notFound()`.
- **Don't wrap `cookies()`, `headers()`, `params` or `searchParams` access in `try/catch`.** PPR bail-outs are thrown. If you must, call `unstable_rethrow(err)` first ([functions/unstable_rethrow]).
- **`cookies().set`/`.delete`** work only in Server Actions and Route Handlers. Setting a cookie in an action re-renders the current page.

---

## 9. Metadata API

- **Static `export const metadata: Metadata`** is for any page or layout whose metadata does not depend on data.
  - The root layout already has `metadataBase` and `title.template: '%s | Haven'`, so a page sets `title: 'Donate'`.
  - `metadata`/`generateMetadata` are **Server Component only**. Keep `page.tsx` a Server Component and put client UI in children.
- **`generateMetadata({ params, searchParams }, parent)`:** `params` and `searchParams` are Promises.
  - Under Cache Components it follows component rules. Reading uncached data in it while the page is otherwise static is an error.
  - Fix: call the same cached getter the page uses (for example `getPost(slug)`, which is `'use cache'`). That also dedupes with the page.
  - Don't read cookies in metadata.
- **Admin:** `app/admin/layout.tsx` exports `metadata = { title: { default: 'Haven Desk', template: '%s · Haven Desk' }, robots: { index: false, follow: false } }`. Also send `X-Robots-Tag: noindex` via `headers()` (§15).
- **Pages that must not be indexed:** `/donate/thank-you`, `/report-a-concern/sent` and any `?session_id=` page get `robots: { index: false }`.
- **Viewport** is separate: `export const viewport: Viewport` (theme colour lives there already). Don't put `themeColor` in `metadata`.
- **OG images:** `opengraph-image.tsx` per dynamic route (programmes, causes, posts).
  - The image function's `params` (and `id`) are **Promises** in v16.
  - Load fonts and backgrounds at module scope, as in today's root OG image. Data comes from the cached getter.
- **`robots.ts`:** `disallow: ['/admin', '/api']`.
- **`sitemap.ts`:** build it from cached getters and use content `updatedAt`, never `new Date()`.
- **Streaming metadata:** for dynamic pages, metadata may be appended to `<body>`. HTML-limited bots (Facebook, Slack) still get it in `<head>`. Leave `htmlLimitedBots` at its default.

---

## 10. Route segment config: what is still valid

| Export | Status in 16.3 with Cache Components | Haven use |
|---|---|---|
| `runtime` | `'nodejs'` (default); `'edge'` **deprecated**; **cannot** be set in proxy | Never export it |
| `maxDuration` | Valid (pages, layouts, route handlers; a page value sets its Server Actions' timeout) | `60` on cron, webhook and AI-draft pages |
| `dynamic`, `revalidate`, `fetchCache` | **Removed**: build error under Cache Components | Use `'use cache'`/`cacheLife`/`<Suspense>` |
| `dynamicParams` | **Removed**: build error | Use `notFound()` |
| `preferredRegion` | **Deprecated** | Don't use |
| `experimental_ppr` | **Removed** | — |
| `instant` | New; Cache Components only; validates instant navigation (dev warnings) | Escape hatch `false` only |
| `prefetch` | New; Cache Components only; `'partial'` or `'force-disabled'` | Not needed in phase 1 |

**Platform limits [platform]:** Vercel applies plan maximums to `maxDuration`. Set it explicitly where work can exceed about 10 seconds.

---

## 11. Environment variables

**Rules** ([guides/environment-variables]):

- **Only `NEXT_PUBLIC_*` reaches the browser,** and it is **inlined at `next build`.** Dynamic lookups such as `process.env[name]` or a destructured `env` are **not** inlined. Always write the full literal `process.env.NEXT_PUBLIC_X`.
- **Other variables are server-only.** In client bundles they become empty strings.
- **Server values read during prerender are baked into the static shell.** On Vercel, any env change needs a **redeploy** anyway [platform].
  - Specifically: if the site was built before Firebase credentials existed, its shells hold seed content until redeploy or `updateTag`.
  - Redeploy after adding Firebase or Stripe keys.
- **Load order:** `process.env` → `.env.$(NODE_ENV).local` → `.env.local` → `.env.$(NODE_ENV)` → `.env`.
  - Multiline values are allowed in `.env` files.
  - `$VAR` expansion happens; escape a literal `$` as `\$`.
- **Only `server-only` modules read `process.env`.** That means `lib/env.ts`, the store adapters and payments. Components never do.
- `serverRuntimeConfig`/`publicRuntimeConfig` are **removed**.

**Variable names, matching `.env.local`:**

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_MESSAGING_SENDER_ID`, `…_APP_ID`, `…_MEASUREMENT_ID` | public | Firebase web config; public by design. `STORAGE_BUCKET` also feeds `images.remotePatterns`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | server | Whole service-account JSON on **one line**. `JSON.parse` turns the `\n` in `private_key` into newlines. Absent means local `.data` mode. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | server | Absent means pledge mode (§12). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | **Not needed** for hosted Checkout redirect. Only add it if Embedded Checkout or the Payment Element is chosen later. |
| `CRON_SECRET` | server | Vercel sends it as a Bearer token to cron routes [platform]. |
| `SESSION_SECRET` | server | 32+ random bytes (`openssl rand -base64 32`). HMAC for local-fallback sessions and signed report-download links. |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL for metadata and emails. **Checkout URLs use `request.nextUrl.origin` instead,** so previews work. |
| AI and email provider keys | server | Names chosen in the backend doc. Never `NEXT_PUBLIC_`. |

```ts
// lib/env.ts
import 'server-only'

export const env = {
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? null,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? null,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
  cronSecret: process.env.CRON_SECRET ?? null,
  sessionSecret: process.env.SESSION_SECRET ?? null,
  onVercel: Boolean(process.env.VERCEL),
} as const

export const features = {
  firebase: env.firebaseServiceAccount !== null,
  stripe: env.stripeSecretKey !== null,
  // .data writes are allowed only off Vercel: the function filesystem is read-only except /tmp [platform]
  localWrites: env.firebaseServiceAccount === null && !env.onVercel,
} as const
```

- **Client components never decide the mode from env.** A Server Component passes `mode: 'firebase' | 'local'` down as a prop, for example to the login form.
- **On Vercel without Firebase,** reads come from seed content. Writes return `{ status: 'error', message: 'This part of the site is not switched on yet' }`; they never touch `/tmp` pretending to persist.

---

## 12. Runtimes, `firebase-admin`, `stripe`

- **Everything runs on Node.js:** pages, layouts, route handlers, Server Actions and proxy. Edge is deprecated, and Cache Components *requires* Node.
- **`firebase-admin`:**
  - Import modular entry points: `firebase-admin/app`, `/auth`, `/firestore`, `/storage`.
  - Initialise once (`getApps().length ? getApp() : initializeApp({ credential: cert(JSON.parse(json)) })`) inside a `server-only` module.
  - It is auto-externalised, so no `serverExternalPackages` entry is needed.
  - **Never import it into proxy.** Proxy stays dependency-free.
- **`firebase` (client SDK)** is imported only from `'use client'` modules (staff sign-in). Never from server code.
- **Guard server-only modules with `import 'server-only'`.** Next handles it internally, and a client import becomes a build error.
- **`stripe@23`:**
  - `import Stripe from 'stripe'`.
  - Construct lazily, only when the key exists.
  - The SDK pins its own API version; don't pass `apiVersion` unless upgrading deliberately.
  ```ts
  // lib/payments/stripe.ts
  import 'server-only'
  import Stripe from 'stripe'
  import { env } from '@/lib/env'

  let client: Stripe | null | undefined
  export function getStripe(): Stripe | null {
    if (client === undefined) client = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null
    return client
  }
  ```
- **Never call Stripe or Firestore writes inside `'use cache'`,** and never during render. Use actions and route handlers.

### 12.1 Checkout route (works with or without keys)

```ts
// app/api/stripe/checkout/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { CheckoutInput } from '@/lib/payments/schemas'   // zod: cause, amountMinor, currency, frequency, donor
import { getStripe } from '@/lib/payments/stripe'
import { recordPledge, buildCheckoutParams } from '@/lib/payments/checkout'

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || new URL(origin).host !== host) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'unsupported' }, { status: 415 })
  }

  const parsed = CheckoutInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const stripe = getStripe()
  if (!stripe) {
    // Graceful degradation: record a pledge (status 'pledged'); the UI shows bank or mobile-money details.
    const pledge = await recordPledge(parsed.data)
    return NextResponse.json({ mode: 'pledge', reference: pledge.reference })
  }

  const base = request.nextUrl.origin // correct on preview deployments too
  const session = await stripe.checkout.sessions.create(
    buildCheckoutParams(parsed.data, {
      successUrl: `${base}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/donate/${parsed.data.cause}`,
    }),
  )
  return NextResponse.json({ mode: 'stripe', url: session.url })
}
```

- The client does `window.location.assign(url)`.
- The thank-you page reads `session_id` inside `<Suspense>` and retrieves the session for display only. **The webhook is the source of truth** for "paid".

### 12.2 Webhook: raw body and signature

```ts
// app/api/stripe/webhook/route.ts
import type Stripe from 'stripe'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { getStripe } from '@/lib/payments/stripe'
import { env } from '@/lib/env'
import { TAG } from '@/lib/cache/tags'
import { claimEvent, applyStripeEvent, sendReceipt } from '@/lib/payments/events'

export const maxDuration = 30

export async function POST(request: Request) {
  const stripe = getStripe()
  if (!stripe || !env.stripeWebhookSecret) return new Response('Payments not configured', { status: 503 })

  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  const payload = await request.text() // RAW body. Never call request.json() before this.
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (await claimEvent(event.id)) {          // idempotent: Stripe retries deliveries
    const donation = await applyStripeEvent(event)
    revalidateTag(TAG.donationTotals, 'max') // Route Handler, so revalidateTag, not updateTag
    if (donation) after(() => sendReceipt(donation))
  }
  return Response.json({ received: true })
}
```

- No `bodyParser` config exists or is needed in the App Router ([file-conventions/route "Webhooks"]).
- `/api` is outside the proxy matcher, so the body is never buffered or truncated.
- Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, if the Stripe CLI is installed.

---

## 13. Vercel Cron + Route Handler

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/monthly-blog-draft", "schedule": "0 7 1 * *" }
  ]
}
```

```ts
// app/api/cron/monthly-blog-draft/route.ts
import type { NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { draftMonthlyPost } from '@/lib/blog/drafting'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  // FIRST statement: reading request headers also keeps this GET from being prerendered at build.
  if (!env.cronSecret || request.headers.get('authorization') !== `Bearer ${env.cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const result = await draftMonthlyPost() // idempotent per month key; creates a DRAFT for human review
  return Response.json(result)
}
```

- **[platform]** Vercel Cron:
  - sends a GET to the production deployment only;
  - sends `Authorization: Bearer <CRON_SECRET>` when that env var is set;
  - reads schedules in **UTC**;
  - does not retry failures, and duplicate delivery is possible, so jobs must be idempotent;
  - on the Hobby plan, runs at most daily with loose timing. A monthly job is fine on every plan.
- A draft does not change public pages, so cron calls no invalidation. Publishing happens by a human in a Server Action, which calls `updateTag(TAG.posts)`. If scheduled publishing is added, the job calls `revalidateTag(TAG.posts, { expire: 0 })`.
- **Locally, cron never fires.**
  - Give admins a "Draft this month's story now" button: a Server Action that calls the same `draftMonthlyPost()`.
  - Test the route itself with `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/monthly-blog-draft`.

---

## 14. Images (`next/image`)

- **Keep `qualities: [70, 75, 85]` and `formats: ['image/webp']`.**
  - The default `qualities` in v16 is `[75]`; other values are coerced to the nearest allowed one.
  - Don't re-enable AVIF.
- **Use `preload` for the single LCP image.** `priority` is deprecated in v16. The Hero already uses `preload`. Elsewhere prefer `loading="eager"` or `fetchPriority="high"`.
- **Local `src` with a query string needs `images.localPatterns[].search`** (breaking in v16). **Don't use query strings.** Cache-bust with content-hashed filenames, as `content/media-map.ts` already does.
- **Optimised images are cached for ≥ 4 hours** (`minimumCacheTTL` default 14400) with **no invalidation mechanism.** Every admin upload gets a **new, content-addressed object name** (`media/<sha256-12>.<ext>`). Replacing a picture means a new URL, never an overwrite.
- **Firebase Storage images** are allowed via `remotePatterns`, scoped to our bucket. `search` is omitted because download URLs carry `?alt=media&token=…`.
- **`images.domains`** is deprecated; `next/legacy/image` is deprecated.
- **Defaults to know:**
  - redirects followed by the optimiser are capped at 3;
  - local-IP sources are blocked;
  - `16` was dropped from `imageSizes`.
- **Fallback-mode uploads** are served by `GET /api/media/[...key]`. Render those with `unoptimized` (dev only), so the optimiser and its 4-hour cache stay out of the local loop.
- **SVGs** are served `unoptimized` automatically. Keep brush masks as CSS masks, as today.

---

## 15. Target `next.config.ts`

```ts
import type { NextConfig } from 'next'

const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
const isDev = process.env.NODE_ENV === 'development'

// Report-Only in phase 1; switch the header name to enforce after QA. No nonces: nonce CSP forces
// every page dynamic and is incompatible with PPR shells ([guides/content-security-policy]).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://firebasestorage.googleapis.com",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.googleapis.com",          // Firebase Auth client
  "frame-src 'self' https://*.firebaseapp.com",           // Firebase Auth helper iframe
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    qualities: [70, 75, 85],
    formats: ['image/webp'],
    remotePatterns: bucket
      ? [{ protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: `/v0/b/${bucket}/o/**` }]
      : [],
  },
  // Keep local data and raw media out of serverless traces.
  outputFileTracingExcludes: { '/*': ['./.data/**/*', './media-src/**/*'] },
  // Testing on a real phone over Wi-Fi: add the laptop's LAN IP, e.g. allowedDevOrigins: ['192.168.1.20'].
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

export default nextConfig
```

- **Don't add:**
  - `experimental.serverActions` (keep the 1 MB default);
  - `typedRoutes` (existing `Button` and `Link` hrefs include `#anchors`; not worth the churn now);
  - `reactCompiler` (Babel cost; not needed);
  - `partialPrefetching` (optional; phase 2).
- **If a video or Zoom embed is added,** extend `frame-src`.
- **If Firebase Analytics is turned on** (a measurement ID is already in `.env.local`), add `https://www.googletagmanager.com` to `script-src` and `https://*.google-analytics.com` to `connect-src`.
- Watch the browser console for Report-Only violations before enforcing.

---

## 16. Activity: UI preserved across navigations

With Cache Components, routes you leave are hidden (`display: none`), not unmounted ([guides/preserving-ui-state]):

- **Effects clean up when a route is hidden and re-run when it is shown.** `useGSAP` and Lenis cleanups already handle this. Every new effect must clean up its listeners, timers, ScrollTriggers and media. Videos need an explicit `pause()` in cleanup (§2.2 item 6).
- **Component state, inputs, `<details>`, scroll position and `useActionState` results persist.** Reset deliberately after successful submissions (§6.1). Close menus and popovers in a `useLayoutEffect` cleanup.
- **Page-level `<style>` or `:root` overrides leak into the visible page while hidden.** Use the `media="not all"` callback-ref pattern from the guide, or keep page accents scoped to a wrapper class.
- **Logout and switching staff:** full reload (§5).
- **QA selectors:** hidden routes stay in the DOM. Use visibility-aware selectors (`:visible`, role queries) in Playwright scripts.

---

## 17. Deprecations and removals that will bite

| Old / remembered | v16.3 reality |
|---|---|
| `middleware.ts`, `export function middleware` | `proxy.ts`, `export function proxy`; Node only |
| `export const runtime = 'edge'` | Deprecated; incompatible with Cache Components |
| `export const dynamic`/`revalidate`/`fetchCache`/`dynamicParams` | Build errors under Cache Components |
| `unstable_cache` | Replaced by `'use cache'` + `cacheLife` + `cacheTag` |
| `unstable_noStore()` | Legacy. Use `connection()`, or `io()` (16.3) |
| `unstable_cacheLife`/`unstable_cacheTag` | Now `cacheLife`/`cacheTag` |
| `revalidateTag('x')` | `revalidateTag('x', 'max')` or `updateTag('x')` in actions |
| Sync `params`/`searchParams`/`cookies()`/`headers()` | Removed. Always `await` (or `use()` in client) |
| `error.tsx` `reset` | `retry` (stable 16.3); `reset` only for "clear without refetch" |
| `unstable_catchError` | `catchError` from `next/error` |
| `<Image priority>` | `<Image preload>` |
| `images.domains` | `images.remotePatterns` |
| `experimental.ppr`, `experimental_ppr`, `experimental.dynamicIO`, `experimental.useCache` | Removed; use `cacheComponents` |
| `next lint`, `eslint` key in next config | Removed; run `eslint` directly |
| `serverRuntimeConfig`/`publicRuntimeConfig` | Removed; env vars |
| Parallel route without `default.tsx` | Build error |
| `forbidden()`/`unauthorized()`/`authInterrupts` | Still experimental. Don't use; redirect plus a friendly notice instead |
| `global-not-found.tsx` | Experimental; unnecessary with a single root layout |
| `scroll-behavior: smooth` override on navigation | Next no longer overrides it. Add `data-scroll-behavior="smooth"` on `<html>` only if CSS sets smooth scrolling (Haven uses Lenis, so don't) |
| `next dev` and `next build` sharing `.next` | Dev writes `.next/dev`, so build can run while dev runs. A lockfile blocks two `next dev` or two `next build` processes. Still never rebuild under a running `next start`. |

---

## 18. Verification checklist (Next-specific, every PR)

1. `npm run build` passes with **no** blocking-prerender errors.
2. The route list shows public pages as prerendered or partially prerendered, and `/admin/*`, `/api/*` as dynamic.
3. `npm run lint` is clean.
4. **No-keys mode:** with no `FIREBASE_SERVICE_ACCOUNT_JSON` and no `STRIPE_*`:
   - the site renders from seed data;
   - forms save to `.data/`;
   - Donate returns `mode: 'pledge'`;
   - the admin local login works.
5. **Edit → see:** an admin edit followed by a public page in a new tab shows the change on the first load (`updateTag` path), under both `next dev` and `next start -p 3100`.
6. `curl -i -X POST http://localhost:3100/api/stripe/webhook` → `503` without keys, `400` with keys and a bad signature.
7. `curl -i http://localhost:3100/api/cron/monthly-blog-draft` → `401`.
8. Signed out, `/admin` redirects to `/admin/login?next=%2Fadmin`. A Server Action replayed without a cookie is rejected by `requireStaff`.
9. `node scripts/qa/shoot.mjs --w 375 --h 812`, plus a home → page → back navigation: no stuck GSAP pins, and no background video audio or CPU from hidden routes.
