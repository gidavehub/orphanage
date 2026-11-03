// HAVEN'S BACK END, ON FIREBASE FUNCTIONS.
//
// The owner's split (2026-11-03: "No function must live on Vercel… only the front end"): the pages
// stay on Vercel; every /api route runs here, in one Cloud Function for Firebase (2nd gen,
// us-central1, beside Firestore's nam5). Vercel passes /api/* through to it unchanged (vercel.json),
// so browsers keep calling the site's own /api. Stripe, Resend and Cloud Scheduler call this
// function's own address directly and never touch Vercel.
//
// It runs as the Firebase Admin SDK service account, so Firestore, Storage, Auth and signed links
// need no key file. Secrets come from Secret Manager; plain settings from functions/.env, which
// scripts/build-api.mjs writes from Vercel's production values. The daily jobs that Vercel Cron used
// to run are scheduled functions below; each calls its /api/cron route with the cron secret.

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");

const REGION = "us-central1";
const SERVICE_ACCOUNT = "firebase-adminsdk-fbsvc@orphanage-project-511119.iam.gserviceaccount.com";

const CRON_SECRET = defineSecret("CRON_SECRET");
const SECRETS = [
  defineSecret("HAVEN_DATA_KEY"),
  defineSecret("HAVEN_HMAC_SECRET"),
  defineSecret("HAVEN_LOOKUP_SECRET"),
  defineSecret("RESEND_API_KEY"),
  defineSecret("RESEND_WEBHOOK_SECRET"),
  // "unset" until the owner makes a Vercel token (lib/server/cache.ts says what it is for).
  defineSecret("VERCEL_TOKEN"),
  CRON_SECRET,
];

process.env.NODE_ENV = "production";
process.env.HAVEN_DEPLOY_ENV ||= "production";

exports.api = onRequest(
  {
    region: REGION,
    serviceAccount: SERVICE_ACCOUNT,
    secrets: SECRETS,
    memory: "1GiB",
    cpu: 1,
    concurrency: 80,
    timeoutSeconds: 300,
    // One kept warm, so a sign-in or a donation never waits for a cold start.
    minInstances: 1,
    maxInstances: 20,
    invoker: "public",
  },
  (req, res) => require("./server").serve(req, res),
);

/** One of the daily jobs: calls its /api/cron route on this back end, and fails loudly when it fails. */
function daily(schedule, route) {
  return onSchedule(
    { schedule, timeZone: "UTC", region: REGION, serviceAccount: SERVICE_ACCOUNT, secrets: [CRON_SECRET], timeoutSeconds: 300, retryCount: 1, memory: "256MiB" },
    async () => {
      const origin = process.env.HAVEN_API_ORIGIN;
      if (!origin) throw new Error("HAVEN_API_ORIGIN is not set (functions/.env).");
      const res = await fetch(`${origin}${route}`, { headers: { authorization: `Bearer ${CRON_SECRET.value()}` }, signal: AbortSignal.timeout(280_000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`${route} answered ${res.status}: ${text.slice(0, 300)}`);
      console.log(`${route} ${res.status} ${text.slice(0, 300)}`);
    },
  );
}

// The same times Vercel Cron used (vercel.json until 2026-11-03).
exports.cronTick = daily("0 6 * * *", "/api/cron/tick");
exports.cronRetention = daily("30 2 * * *", "/api/cron/retention");
exports.cronEditorial = daily("0 8 * * *", "/api/cron/editorial");
