// Firebase go-live preflight (PLAN §6.3 I8; data-model §7–§9, §14 step 7).
//
//   node scripts/qa/firebase-preflight.mjs
//
// Checks what can be checked without touching the live project, prints NAMES (never values) of what
// is missing, validates the rules, indexes, CORS and firebase.json files, and lists the console steps
// that need a person. Exit 1 only when a file is invalid (missing credentials are expected before
// launch and are reported, not failed).

import { readFile } from "node:fs/promises";

const fails = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  · ${m}`);
const bad = (m) => {
  fails.push(m);
  console.log(`  ✗ ${m}`);
};

const text = await readFile(".env.local", "utf8").catch(() => "");
const local = Object.fromEntries(text.split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "")]));
const env = { ...local, ...process.env };

console.log("\nCredentials");
let sa = null;
if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (sa.project_id && sa.client_email && sa.private_key) ok(`service account present for project ${sa.project_id}`);
    else bad("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key");
  } catch {
    bad("FIREBASE_SERVICE_ACCOUNT_JSON is not valid one-line JSON");
  }
} else warn("credentials absent: FIREBASE_SERVICE_ACCOUNT_JSON is not set (the site runs in practice mode until it is)");
for (const name of ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"]) {
  if (env[name]) ok(`${name} set`);
  else warn(`${name} not set`);
}
if (sa && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== sa.project_id) bad("NEXT_PUBLIC_FIREBASE_PROJECT_ID does not match the service account's project");
const key = env.HAVEN_DATA_KEY ? Buffer.from(env.HAVEN_DATA_KEY, "base64") : null;
if (!key) warn("HAVEN_DATA_KEY not set (practice mode uses .data/keys/data.key; production MUST set it, and keep it safe forever)");
else if (key.length !== 32) bad("HAVEN_DATA_KEY must be 32 bytes, base64-encoded");
else ok("HAVEN_DATA_KEY is 32 bytes");
for (const name of ["HAVEN_HMAC_SECRET", "HAVEN_LOOKUP_SECRET", "CRON_SECRET"]) {
  if (env[name]) ok(`${name} set`);
  else warn(`${name} not set`);
}

console.log("\nRules");
for (const [file, service] of [
  ["firestore.rules", "cloud.firestore"],
  ["storage.rules", "firebase.storage"],
]) {
  const r = await readFile(file, "utf8").catch(() => null);
  if (!r) {
    bad(`${file} is missing`);
    continue;
  }
  const denyAll = /match\s+\/\{(document|allPaths)=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/.test(r);
  const code = r.replace(/\/\/.*$/gm, "");
  const opens = (code.match(/allow\s+[^;]*if\s+(?!false)/g) ?? []).length;
  if (!r.includes("rules_version = '2'") || !r.includes(`service ${service}`)) bad(`${file}: expected rules_version 2 and service ${service}`);
  else if (!denyAll) bad(`${file}: the deny-all match is missing`);
  else ok(`${file}: deny-all for browsers${opens ? ` (+${opens} narrow allow rule${opens === 1 ? "" : "s"})` : ""}`);
}

console.log("\nIndexes");
try {
  const ix = JSON.parse(await readFile("firestore.indexes.json", "utf8"));
  const seen = new Set();
  let problems = 0;
  for (const i of ix.indexes ?? []) {
    const fields = i.fields ?? [];
    const okShape = i.collectionGroup && (i.queryScope === "COLLECTION" || i.queryScope === "COLLECTION_GROUP" || !i.queryScope) && fields.length >= 2 && fields.every((f) => f.fieldPath && (f.order === "ASCENDING" || f.order === "DESCENDING" || f.arrayConfig === "CONTAINS"));
    const sig = `${i.collectionGroup}:${fields.map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig}`).join(",")}`;
    if (!okShape) {
      problems++;
      console.log(`    bad index: ${sig}`);
    }
    if (seen.has(sig)) {
      problems++;
      console.log(`    duplicate index: ${sig}`);
    }
    seen.add(sig);
  }
  const ttl = (ix.fieldOverrides ?? []).filter((o) => o.ttl).map((o) => `${o.collectionGroup}.${o.fieldPath}`);
  if (problems) bad(`firestore.indexes.json: ${problems} problem(s)`);
  else ok(`firestore.indexes.json: ${ix.indexes.length} composite indexes, ${ttl.length} TTL fields (${ttl.join(", ")})`);
} catch {
  bad("firestore.indexes.json is not valid JSON");
}

console.log("\nConfig files");
try {
  const fb = JSON.parse(await readFile("firebase.json", "utf8"));
  const refs = [fb.firestore?.rules, fb.firestore?.indexes, fb.storage?.rules].filter(Boolean);
  const missing = [];
  for (const r of refs) if (!(await readFile(r, "utf8").catch(() => null))) missing.push(r);
  if (missing.length) bad(`firebase.json points at missing files: ${missing.join(", ")}`);
  else ok(`firebase.json: ${refs.join(", ")}`);
} catch {
  bad("firebase.json is missing or invalid");
}
try {
  const cors = JSON.parse(await readFile("storage.cors.json", "utf8"));
  const valid = Array.isArray(cors) && cors.every((c) => Array.isArray(c.origin) && Array.isArray(c.method));
  if (valid) ok(`storage.cors.json: ${cors.length} rule(s), origins ${cors.flatMap((c) => c.origin).join(", ")}`);
  else bad("storage.cors.json: each rule needs origin[] and method[]");
} catch {
  bad("storage.cors.json is missing or invalid");
}

console.log(`
Console steps (a person does these once; see docs/platform/FIREBASE-GO-LIVE.md):
  1. Firestore: create the (default) database in Native mode. Location is permanent: eur3 (EU) is
     recommended. Then: firebase deploy --only firestore:rules,firestore:indexes --project <id>
  2. TTL: enable a TTL policy on each field listed above (Firestore → TTL).
  3. Storage: create the default bucket in the same region; uniform bucket-level access on, public
     access prevention enforced, soft delete 30 days, lifecycle: delete quarantine/ after 1 day.
     Then: firebase deploy --only storage --project <id>; gsutil cors set storage.cors.json gs://<bucket>
  4. Authentication (Identity Platform): enable Email/Password, enable TOTP multi-factor, turn OFF
     user sign-up (staff are invited), set the password policy (12+ characters), add the site's
     domain to Authorised domains.
  5. Service account: Project settings → Service accounts → Generate new private key; paste it on ONE
     line as FIREBASE_SERVICE_ACCOUNT_JSON in Vercel Production. Set HAVEN_DATA_KEY (and keep a copy
     offline), HAVEN_HMAC_SECRET, HAVEN_LOOKUP_SECRET, CRON_SECRET.
  6. Data: node scripts/data/push-local.mjs --content-only (dry run), then add --commit --project <id>.
  7. First admin: node scripts/data/create-super-admin.mjs --project <id> --email … --name "…".
  8. Check: node scripts/qa/data-selftest.mjs --base https://<site> (with a super admin session).`);

console.log(fails.length ? `\n${fails.length} problem(s) to fix.` : "\nFiles are ready. Credentials are reported above.");
process.exit(fails.length ? 1 : 0);
