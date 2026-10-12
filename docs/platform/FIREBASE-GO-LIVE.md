# Haven: going live on Firebase

Until Firebase is connected, Haven runs in **practice mode**: everything is saved on the computer it runs on (`.data/`), emails wait in the email log, and sign-in uses local practice accounts. This guide switches Haven to the real Firebase project. Do it once, in order.

Project: `orphanage-project-511119`. Always pass `--project orphanage-project-511119` to `firebase` and `gcloud` commands (the machine's default gcloud project is a different one).

Check where you are at any time:

```bash
node scripts/qa/firebase-preflight.mjs
```

It reports which settings are missing (names only, never values), checks the rules, indexes and CORS files, and lists the console steps below.

## Status (11 October 2026)

- The Firestore `(default)` database already exists in **`nam5`** (United States), Native mode.
- The deny-all **rules** and all **78 composite indexes** are deployed.
- **Billing is off** on the project. Firestore **TTL** policies and the Cloud Storage default bucket need the **Blaze** (pay-as-you-go) plan. Once the owner turns billing on, run `firebase deploy --only firestore:indexes,storage --project orphanage-project-511119` to add the TTL policies and the storage rules. Haven's usage is small, but set a budget alert in Google Cloud Billing.
- Still to do by a person: steps 3–8 below.

## 1. Decide the location (permanent)

Firestore and Storage locations **cannot be changed later**. Recommended: `eur3` (Europe, multi-region) for Firestore and `EU` for Storage. The alternative is `nam5`/`US`. This is the owner's decision.

## 2. Firestore

1. Firebase console → Firestore Database → **Create database** → Native mode → the location from step 1.
2. Deploy the rules and indexes from this repository:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project orphanage-project-511119
   ```

   The rules deny every browser request: all reads and writes go through Haven's server, which checks each person's role.
3. Firestore → **TTL**: add a policy on each field the preflight lists (`expireAt` on `rateLimits`, `donationIntents`, `stripeEvents`, `notifications`, `invitations`, `emailOutbox`, `mediaUploads`). Deletion is lazy (up to about a day).

## 3. Storage

1. Firebase console → Storage → **Get started**, in the same region.
2. In Google Cloud console → Cloud Storage → the bucket:
   - uniform bucket-level access **on**;
   - public access prevention **enforced**;
   - soft delete **30 days**;
   - lifecycle rule: delete objects with prefix `quarantine/` older than **1 day**.
3. Deploy the rules and set CORS (for signed uploads from the admin):

   ```bash
   firebase deploy --only storage --project orphanage-project-511119
   ```

   ```bash
   gsutil cors set storage.cors.json gs://orphanage-project-511119.firebasestorage.app
   ```

   Edit `storage.cors.json` first if the site's domain isn't `haven.org.gm`.

## 4. Sign-in (Authentication / Identity Platform)

1. Sign-in method: enable **Email/Password**. Google sign-in only if the owner wants it (and on which domain).
2. Upgrade to Identity Platform if asked, then enable **multi-factor: TOTP** (authenticator apps). Super admins, safeguarding officers and finance officers must use a sign-in code.
3. Settings → **User actions**: turn **off** "Enable create (sign-up)". Staff join by invitation only.
4. Password policy: at least **12 characters**.
5. Settings → Authorised domains: add the site's domain (and the Vercel preview domain if used).

## 5. Server settings (Vercel → Project → Settings → Environment Variables, Production)

| Variable | What |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Project settings → Service accounts → Generate new private key. Paste the whole file **on one line**. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project settings → Your apps → Web app config. Public by design. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | The bucket name from step 3. |
| `HAVEN_DATA_KEY`, `HAVEN_DATA_KEY_ID` | The key that seals case narratives. **Losing it destroys sealed records for ever.** Keep an offline copy. To keep practice records, use the same key as practice mode (base64 of `.data/keys/data.key`). |
| `HAVEN_HMAC_SECRET`, `HAVEN_LOOKUP_SECRET` | Signing and lookup secrets. `HAVEN_LOOKUP_SECRET` must **never** change once donors exist. |
| `CRON_SECRET` | For the scheduled jobs. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Redeploy after changing variables. Haven then logs `data=firestore` on start, and Settings › Connections shows "Connected to Firebase".

## 6. Copy what the team wrote

Practice cases, gifts and emails are test data. Copy only the website content, posts, photos, settings, the library and the referral directory:

```bash
node scripts/data/push-local.mjs --content-only
```

That is a dry run: it lists what would be copied and checks the data key. Then copy for real:

```bash
node scripts/data/push-local.mjs --content-only --commit --project orphanage-project-511119
```

It uses `FIREBASE_SERVICE_ACCOUNT_JSON` from `.env.local`, or your gcloud application-default login.

## 7. The first super admin

```bash
node scripts/data/create-super-admin.mjs --project orphanage-project-511119 --email you@haven.org --name "Your Name"
```

It creates the sign-in user and the staff record, and prints a one-time link to choose a password. At the first sign-in they set up a sign-in code. Everyone else is invited from **Team** in the admin.

## 8. Check

1. Sign in at `/admin/login` as the super admin.
2. Settings › Connections: Firebase connected; send yourself a test email.
3. Run the self-checks against the live site with a super admin session:

   ```bash
   node scripts/qa/data-selftest.mjs --base https://<site>
   ```

4. In a private window, confirm the public site loads and a test form submission appears in the Inbox.

## If something goes wrong

- **"Data storage isn't connected"** on Connections: `FIREBASE_SERVICE_ACCOUNT_JSON` is missing or not on one line.
- **"Data key missing"**: set `HAVEN_DATA_KEY`.
- **Sealed fields show "can't be opened"**: the production `HAVEN_DATA_KEY` differs from the key the records were sealed with.
- **Uploads fail with a CORS error**: `storage.cors.json` doesn't list the site's domain; edit it and run the `gsutil cors set` command again.
