// HAVEN'S SERVER, ON FIREBASE FUNCTIONS.
//
// The owner's rule (2026-11-03, again 2026-11-17: "Make sure all my functions are in cloud function
// not Vercel"): every page render, Server Action and /api route runs here, in one Cloud Function for
// Firebase (2nd gen, us-central1, beside Firestore's nam5). Vercel holds only the static files (the
// browser's JavaScript, CSS, fonts and public/) and passes every other request here unchanged
// (scripts/build.mjs writes its routing). Stripe, Resend and Cloud Scheduler call this
// function's own address directly and never touch Vercel.
//
// It runs as the Firebase Admin SDK service account, so Firestore, Storage, Auth and signed links
// need no key file. Secrets come from Secret Manager; plain settings from functions/.env, which
// scripts/build.mjs writes from Vercel's production values. The daily jobs that Vercel Cron used
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
  CRON_SECRET,
];

process.env.NODE_ENV = "production";
process.env.HAVEN_DEPLOY_ENV ||= "production";

// Loaded (and Next started) when the api function's container starts. The scheduled jobs share this
// file but never load it: K_SERVICE names the function each container runs.
const server = () => require("./server");
if (process.env.FUNCTION_TARGET === "api" || process.env.K_SERVICE === "api") server();

exports.api = onRequest(
  {
    region: REGION,
    serviceAccount: SERVICE_ACCOUNT,
    secrets: SECRETS,
    memory: "2GiB",
    // Two CPUs are refused while the project's CPU quota is the default (Cloud Run checks CPU × its
    // service-level maximum); one is plenty for one instance at Haven's traffic.
    cpu: 1,
    concurrency: 80,
    timeoutSeconds: 300,
    // Exactly one instance, kept warm. Next keeps its page cache in memory: an admin's edit expires a
    // tag on the instance that saved it, and a second instance would go on showing the old page. One
    // instance serving 80 requests at a time is plenty for Haven; to scale out, give Next a shared
    // cache first (cacheHandlers backed by Firestore), then raise maxInstances.
    minInstances: 1,
    maxInstances: 1,
    invoker: "public",
  },
  (req, res) => server().serve(req, res),
);

/** A scheduled job: calls its /api/cron route on this back end, and fails loudly when it fails. */
function scheduled(schedule, route) {
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

// The tick runs every 15 minutes, as Haven was designed to (lib/server/tick.ts: emails left in the
// outbox, Zoom reminders 24 h and 1 h before; its daily block still runs once, at or after 06:00
// UTC). Vercel's Hobby plan allowed only once a day. The other two keep Vercel Cron's times.
exports.cronTick = scheduled("*/15 * * * *", "/api/cron/tick");
exports.cronRetention = scheduled("30 2 * * *", "/api/cron/retention");
exports.cronEditorial = scheduled("0 8 * * *", "/api/cron/editorial");
