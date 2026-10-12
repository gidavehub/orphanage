// Copy practice data (.data/) to Firestore and Cloud Storage (content-model §9 step 14; PLAN §6.3 I8).
//
//   node scripts/data/push-local.mjs                 dry run (default): lists what would be copied
//   node scripts/data/push-local.mjs --commit --project orphanage-project-511119 [--bucket <name>]
//        [--include-samples] [--only posts,media] [--content-only] [--skip-storage]
//   --content-only copies just what the team wrote (pages, causes, posts, media, settings, the
//   library and the referral directory), leaving practice cases and gifts behind. Recommended.
//
// Credentials: FIREBASE_SERVICE_ACCOUNT_JSON (one-line JSON, from the environment or .env.local) or
// Application Default Credentials (gcloud auth application-default login). Nothing is printed from
// the credentials. Practice-only collections (selftest runs, cron locks, sessions, rate limits) and
// sample records (isSample: true) are skipped unless asked. Values under keys ending in `At` become
// Timestamps, exactly as lib/server/db/firestore.ts writes them (TTL needs expireAt as a Timestamp).
//
// IMPORTANT: sealed fields (case narratives, notes, some email variables) are encrypted with the local
// data key (.data/keys/data.key). Production must use the SAME key as HAVEN_DATA_KEY, or start fresh
// with the seeds. The script compares fingerprints and stops if they differ (unless --start-fresh-ok).
// Local sign-in accounts are NOT copied: create the first super admin with
// scripts/data/create-super-admin.mjs and invite everyone else from Team.

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const flag = (f, d = null) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const COMMIT = has("--commit");
const PROJECT = flag("--project");
const CONTENT = ["siteContent", "causes", "posts", "media", "settings", "allocationSummaries", "resources", "referralPartners", "sponsorProfiles"];
const ONLY = flag("--only")?.split(",") ?? (has("--content-only") ? CONTENT : null);
const INCLUDE_SAMPLES = has("--include-samples");
const DATA = path.resolve(".data");
const SKIP = new Set(["selftestRuns", "cronLocks", "rateLimits", "locks", "staffSessions", "mediaUploads", "donationIntents"]);
const AT_KEY = /At$/;

async function envLocal() {
  const text = await readFile(".env.local", "utf8").catch(() => "");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

/** Every collection under .data/db as [firestorePath, docsFile]. */
async function collections(dir = path.join(DATA, "db"), prefix = "") {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (!e.isDirectory()) continue;
    const coll = path.join(dir, e.name);
    const p = prefix ? `${prefix}/${e.name}` : e.name;
    const docs = path.join(coll, "_docs.json");
    if (await stat(docs).catch(() => null)) out.push([p, docs]);
    // Subcollections live under <collection>/<docId>/<sub>/_docs.json.
    for (const d of await readdir(coll, { withFileTypes: true }).catch(() => [])) {
      if (d.isDirectory()) out.push(...(await collections(path.join(coll, d.name), `${p}/${d.name}`)));
    }
  }
  return out;
}

const unwrap = (d) => (d && typeof d === "object" && "data" in d && d.data && typeof d.data === "object" && Object.keys(d).length <= 3 ? d.data : d);

function convert(value, key, Timestamp) {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return key && AT_KEY.test(key) && Number.isFinite(value) && Timestamp ? Timestamp.fromMillis(value) : value;
  if (Array.isArray(value)) return value.map((v) => convert(v, key, Timestamp));
  if (typeof value === "object") {
    const o = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) o[k] = convert(v, k, Timestamp);
    return o;
  }
  return value;
}

async function storageFiles(dir = path.join(DATA, "storage")) {
  const out = [];
  for (const top of ["public", "private"]) {
    const walk = async (d) => {
      for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else out.push(p);
      }
    };
    await walk(path.join(dir, top));
  }
  return out;
}

const env = { ...(await envLocal()), ...process.env };
const plan = [];
let totalDocs = 0;
let skippedSamples = 0;
for (const [p, file] of await collections()) {
  const top = p.split("/")[0];
  if (SKIP.has(top) || (ONLY && !ONLY.includes(top))) continue;
  const docs = JSON.parse(await readFile(file, "utf8"));
  const entries = Object.entries(docs)
    .filter(([id]) => !id.startsWith("_"))
    .map(([id, d]) => [id, unwrap(d)]);
  const kept = entries.filter(([, d]) => INCLUDE_SAMPLES || !d?.isSample);
  skippedSamples += entries.length - kept.length;
  if (kept.length) {
    plan.push({ path: p, docs: kept });
    totalDocs += kept.length;
  }
}
const files = has("--skip-storage") ? [] : await storageFiles();

console.log(`${COMMIT ? "COPYING" : "DRY RUN"}: ${totalDocs} documents in ${plan.length} collections${skippedSamples ? ` (${skippedSamples} practice samples skipped)` : ""}, ${files.length} stored files.`);
for (const c of plan.filter((x) => !x.path.includes("/")).sort((a, b) => b.docs.length - a.docs.length)) console.log(`  ${c.path.padEnd(28)} ${c.docs.length}`);
const subs = plan.filter((x) => x.path.includes("/"));
if (subs.length) console.log(`  + ${subs.reduce((n, c) => n + c.docs.length, 0)} documents in ${subs.length} subcollections (events, notes, versions)`);

// The data key must match, or sealed fields can't be read in production.
// The file holds the key base64-encoded, as lib/server/security/seal.ts reads it: compare the bytes.
const localKey = await readFile(path.join(DATA, "keys", "data.key"), "utf8").then((s) => Buffer.from(s.trim(), "base64")).catch(() => null);
const fp = (b) => createHash("sha256").update(b).digest("hex").slice(0, 12);
if (localKey) {
  const prodKey = env.HAVEN_DATA_KEY ? Buffer.from(env.HAVEN_DATA_KEY, "base64") : null;
  if (!prodKey) console.log("\n  ! HAVEN_DATA_KEY is not set here: set it to the local key (base64 of .data/keys/data.key) in production, or sealed fields won't open.");
  else if (fp(prodKey) !== fp(localKey)) console.log(`\n  ! HAVEN_DATA_KEY (fingerprint ${fp(prodKey)}) differs from the local key (${fp(localKey)}). Sealed fields copied now won't open in production.`);
  else console.log(`\n  ✓ HAVEN_DATA_KEY matches the local data key (fingerprint ${fp(localKey)}).`);
}

if (!COMMIT) {
  console.log("\nNothing was written. Add --commit --project <id> to copy.");
  process.exit(0);
}
if (!PROJECT) {
  console.error("Pass --project <firebase project id> with --commit.");
  process.exit(1);
}
if (localKey && env.HAVEN_DATA_KEY && fp(Buffer.from(env.HAVEN_DATA_KEY, "base64")) !== fp(localKey) && !has("--start-fresh-ok")) {
  console.error("Stopping: the data keys differ (see above). Fix HAVEN_DATA_KEY, or pass --start-fresh-ok to copy anyway.");
  process.exit(1);
}

const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
const { getStorage } = await import("firebase-admin/storage");
const sa = env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) : null;
const bucketName = flag("--bucket") ?? env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${PROJECT}.firebasestorage.app`;
const app = initializeApp({ credential: sa ? cert(sa) : applicationDefault(), projectId: PROJECT, storageBucket: bucketName });
const db = getFirestore(app);

let written = 0;
for (const c of plan) {
  for (let i = 0; i < c.docs.length; i += 400) {
    const batch = db.batch();
    for (const [id, d] of c.docs.slice(i, i + 400)) batch.set(db.doc(`${c.path}/${id}`), convert(d, undefined, Timestamp));
    await batch.commit();
    written += Math.min(400, c.docs.length - i);
  }
  process.stdout.write(`\r  ${written}/${totalDocs} documents`);
}
console.log("");
if (files.length) {
  const bucket = getStorage(app).bucket(bucketName);
  let n = 0;
  for (const f of files) {
    const dest = path.relative(path.join(DATA, "storage"), f).split(path.sep).join("/");
    await bucket.upload(f, { destination: dest, resumable: false });
    n++;
    process.stdout.write(`\r  ${n}/${files.length} files`);
  }
  console.log("");
}
console.log("Done. Next: node scripts/data/create-super-admin.mjs, then run the selftests against Firestore.");
