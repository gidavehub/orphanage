# Haven: what we still need from you

The whole platform is built: the public website, the donate pages, the team space (admin), card payments, emails, the monthly story writer, counselling scheduling and the scheduled jobs. It runs today in **practice mode** on one computer, with practice records and every email held in the email log.

This page lists everything the organisation still has to **provide, decide or approve** before Haven goes public. Most text items can be changed later by the team in the admin (Website, Settings › Key information), without a developer.

For the technical go-live order, see `docs/platform/RUNBOOK.md`. For Firebase, see `docs/platform/FIREBASE-GO-LIVE.md`.

---

## 1. Decisions only you can make

- [ ] **Name.** Is "Haven" final? Should the legal name "The Orphanage Project" appear (footer, receipts)?
- [ ] **People in photos.** The current rule: about a third Black people; the rest South Asian, Southeast Asian and Arab; no white people; families are a mother and a father with their children. In the 2026-09-28 meeting the founder also asked to see Hispanic and white families. Which rule stands? (One setting changes it.)
- [ ] **Home page closing band.** Switch on the closing call to action ("Your Support Will Positively Impact a Child's Welfare and Future.") below News? It is built and hidden.
- [ ] **Google Analytics.** Wanted? It sets cookies and needs a consent banner. Today the site uses cookieless Vercel Analytics only.
- [ ] **Updates from the field.** May programme officers put short Updates live directly, or always through a reviewer (built: always reviewed)?
- [ ] **Closing serious safeguarding concerns.** A second person signs off closing high or immediate concerns (built on). Keep it?
- [ ] **Cross-currency causes.** May a GBP gift count towards a USD cause at a rate finance sets?
- [ ] **Small items.** Remove the "5.0" rating badge on Testimonials (it has no source)? Seasonal greetings on Today? Zakat wording? Tax-deductibility statement per country? The AI byline wording ("Drafted with help from an AI writing tool and reviewed by the Haven team")?

## 2. Accounts and services (with who pays)

- [ ] **Domain and hosting.** The domain name, DNS access, and the Vercel plan: **Pro** (jobs every 15 minutes) or **Hobby** plus the free GitHub "pinger" (already written).
- [ ] **Firebase billing.** The Firestore database exists (US, `nam5`) and its rules and indexes are deployed. **Billing must be switched on (Blaze plan)** for automatic clean-up (TTL) and for file storage. Usage is small; set a budget alert.
- [ ] **Who keeps the data key.** `HAVEN_DATA_KEY` protects case narratives. Losing it loses those records for ever. Name two people who keep an offline copy.
- [ ] **Email sending.** For now Haven sends from `haven@swipe.gm` (verified in Resend, a stand-in until Haven's own domain). When the domain arrives, add a sending domain for Resend (for example `mail.haven.org.gm`), then change `EMAIL_FROM` and `EMAIL_REPLY_TO` in Vercel. Also set the real team mailboxes in Settings › Key information: support, safeguarding, donations, partnerships, media, privacy. Until then those are `@haven.org.gm` placeholders, so replies to them bounce.
- [ ] **Stripe (card payments).** The legal entity and country that owns the account, the settlement bank, nonprofit pricing, and the receipt wording (registered name, registration numbers, "no goods or services" line). Test a GMD card payment before allowing GMD by card.
- [ ] **Mobile money and bank details.** Wave, Afrimoney and QMoney merchant names and numbers, and bank details per currency. (Settings › Giving.)
- [ ] **AI writer.** Which provider (Anthropic or Google), whose billing. Without one, the monthly story is a fill-in template.
- [ ] **Zoom.** A licensed Zoom host for counselling (free accounts stop at 40 minutes), and whether to make meeting links automatically.
- [ ] **Bot protection (optional).** A Cloudflare Turnstile site key and secret.

## 3. People and safeguarding

- [ ] **Named staff and their roles** (super admin, content manager, programme officer, safeguarding officer, finance officer, counsellor, report manager, viewer). The first super admin is created from the command line; everyone else is invited from Team.
- [ ] **Safeguarding alert recipients**, and a fallback address if nobody is on duty.
- [ ] **Risk levels.** Confirm the definitions used when a concern is assessed.
- [ ] **Retention periods.** Have a safeguarding or legal professional confirm how long each kind of record is kept (Settings › Data shows them). Confirm the **financial year** start.
- [ ] **Verified emergency numbers** per country for the safety notice (Settings › Key information).

## 4. Content to provide or approve (search the code for `// CLIENT`)

Everything below is a placeholder until replaced or approved. Most of it is editable in the admin.

- [ ] **Organisation facts** (`content/seed/site.ts`): founding year (drives "Years of Service"), mission line, charity and NGO **registration numbers**, full addresses and phones for The Gambia and the US office, main phone and email, social links (Facebook, Instagram, TikTok, X, YouTube, LinkedIn), office hours, reply times the team can keep, team mailboxes, verified emergency contacts, and the voice the monthly stories should keep.
- [ ] **Founder** (`content/seed/home.ts`): name spelling ("Emanuel" or "Emmanuel"), title, quote, bio and portrait.
- [ ] **Team** (`content/seed/team.ts`): real names, roles, consented portraits, biographies, languages and links. The current six are placeholders.
- [ ] **Programmes** (`content/seed/programmes.ts`): approve each programme's copy and the team contact addresses (safeguarding, education, medical, counselling, legal, family).
- [ ] **Statistics** (`content/seed/stats.ts`): only verified figures may be published. Every value is a placeholder, including the financial-year dates.
- [ ] **Causes and appeals** (`content/seed/causes.ts`): titles, countries, currencies, goals and amounts raised. All figures are illustrative until finance verifies them in the admin.
- [ ] **Where the money goes** (`content/seed/allocation.ts`): the verified amounts received and spent per programme.
- [ ] **Donate page** (`content/seed/pages/donate.ts`): confirm the tax status per country.
- [ ] **About and Get Support pages** (`content/seed/pages/about.ts`, `content/seed/pages/getSupport.ts`): value descriptions and support copy are drafts.
- [ ] **Projects** (`content/seed/projects.ts`): places, dates, galleries and story text are placeholders.
- [ ] **Stories and testimonials** (`content/seed/stories.ts`): written consent for each real story; until then they are illustrative.
- [ ] **Partners** (`content/seed/partners.ts`): real partner logos, each with written permission.
- [ ] **News** (`content/seed/posts.ts`): placeholder articles to replace or archive.
- [ ] **Library** (`content/seed/resources.ts`): the published annual report.
- [ ] **Policies:** approve the Safeguarding, Privacy and Terms pages, and add the AI providers (Anthropic or Google) and Stripe, Resend and Firebase to the privacy policy's list of processors.

The admin's **Website › Before launch** page lists every item still marked as a placeholder and has the "Hide figures that aren't verified" switch.

## 5. Photos and videos (safeguarding)

- Every photo and video is AI-generated and illustrative. `content/media-credits.ts` lists each asset.
- **37 assets show children** and are marked as placeholders. Replace them with real photographs that have documented consent, or keep them only with the "Illustrative image" label (shown automatically). Donors must never mistake AI-generated children for real beneficiaries.
- No school crests, badges or signage anywhere: Haven does not run a school.

## 6. Accessibility

The site passes an automated accessibility audit except for the brand colour pairings kept on purpose to match the design references: white text on marigold buttons (about 1.9:1), the marigold script eyebrows, the coral accent words in headings and the flame-red labels on the landing appeal cards (about 2.8–3.7:1), and white text on coral. If WCAG AA is required everywhere, the smallest change is dark green text on marigold buttons, the darker coral (`coral-800`) for accent words and behind small white text. The team space (admin) meets WCAG AA throughout.
