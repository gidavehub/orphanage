// Admin Server Actions refuse people who may not use them (PLAN §6.4 Q3).
//
//   node scripts/qa/actions-unauth.mjs --base http://localhost:3100
//
// Reads the build's action manifest (.next/server/server-reference-manifest.json). An "admin action"
// is one whose every caller page is under app/admin. Each is POSTed to its own page's URL, with no
// arguments:
//   1. signed out: it must be redirected to sign-in before it runs (the sign-in, forgot, reset and
//      invite pages are public by design and are skipped);
//   2. signed in as a Viewer (the most limited role): it must never succeed ("ok":true) and its answer
//      must carry no data (no email address, no HVN reference).
// Actions shared with public pages (loaded by shared components) are called signed out from a public
// page: none may succeed or answer with data.

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const BASE = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3100").replace(/\/+$/, "");
const manifest = JSON.parse(await readFile(".next/server/server-reference-manifest.json", "utf8"));
const actions = Object.entries(manifest.node ?? {});
const PUBLIC_ADMIN = /^\/admin\/(login|forgot|reset|invite)(\/|$)/;

const urlOf = (worker) =>
  "/" +
  worker
    .replace(/^app\//, "")
    .replace(/\/page$/, "")
    .split("/")
    .filter((s) => !/^\(.*\)$/.test(s))
    .map((s) => (/^\[.*\]$/.test(s) ? "HVN-SR-2026-0001" : s))
    .join("/");

const admin = [];
const shared = [];
for (const [id, a] of actions) {
  const workers = Object.keys(a.workers ?? {});
  if (!workers.length) continue;
  if (workers.every((w) => w.startsWith("app/admin"))) admin.push({ id, url: urlOf(workers[0]) });
  else if (workers.some((w) => w.startsWith("app/admin"))) shared.push({ id, workers });
}

async function call(id, url, cookie) {
  const r = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", ...(cookie ? { cookie } : {}) },
    body: "[]",
    redirect: "manual",
  });
  return { status: r.status, location: r.headers.get("location") ?? r.headers.get("x-action-redirect") ?? "", body: await r.text() };
}

const signIn = async (role) => {
  const r = await fetch(`${BASE}/api/dev/session?role=${role}`, { method: "POST", redirect: "manual" });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => /haven_session=/.test(c)).join("; ");
};

const fails = [];
const LEAK = /[^\s"@<>()\\]+@[^\s"@<>()\\]+\.[a-z]{2,}|HVN-[A-Z]{2}-\d{4}-\d{4}/i;
const viewer = await signIn("viewer");
let n = 0;
for (const a of admin) {
  n++;
  if (!PUBLIC_ADMIN.test(a.url)) {
    const out = await call(a.id, a.url, null);
    if (!(out.status >= 300 && out.status < 400 && /\/admin\/login/.test(out.location))) fails.push(`signed out ${a.url} ${a.id.slice(0, 10)}: ${out.status} ${out.body.slice(0, 100)}`);
  }
  const v = await call(a.id, a.url, viewer);
  // The answer re-renders the page for the Viewer (their own shell); only the action's return value
  // matters: row 0 names it as "a":"$@<row>".
  const rows = new Map(v.body.split(/\r?\n/).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1)]));
  const ref = /"a":"\$@([0-9a-f]+)"/.exec(rows.get("0") ?? "")?.[1];
  const result = ref ? (rows.get(ref) ?? "") : v.body;
  const succeeded = /"ok":true/.test(result);
  const leaked = LEAK.test(result.replace(/HVN-SR-2026-0001/g, ""));
  if (succeeded || leaked) fails.push(`viewer ${a.url} ${a.id.slice(0, 10)}: ${v.status}${succeeded ? " succeeded" : ""}${leaked ? " (data in the answer)" : ""} ${result.slice(0, 200).replace(/\s+/g, " ")}`);
  if (n % 20 === 0) process.stdout.write(`\r  ${n}/${admin.length}`);
}
console.log(`\r  checked ${admin.length} admin actions signed out and as a Viewer`);
// Actions also loaded by public pages (shared components) can be called from any public page, so
// each must check sign-in itself: signed out, none may succeed or answer with data.
for (const s of shared) {
  const pub = s.workers.find((w) => !w.startsWith("app/admin"));
  const url = urlOf(pub);
  const out = await call(s.id, url, null);
  const rows = new Map(out.body.split(/\r?\n/).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1)]));
  const ref = /"a":"\$@([0-9a-f]+)"/.exec(rows.get("0") ?? "")?.[1];
  const result = ref ? (rows.get(ref) ?? "") : out.body;
  const redirected = out.status >= 300 && out.status < 400;
  if (!redirected && (/"ok":true|"status":"success"/.test(result) || LEAK.test(result.replace(/HVN-SR-2026-0001/g, "")))) {
    fails.push(`signed out ${url} ${s.id.slice(0, 10)} (shared): ${out.status} ${result.slice(0, 200).replace(/\s+/g, " ")}`);
  }
}
console.log(`  checked ${shared.length} action(s) shared with public pages, signed out`);

// 'use cache' readers are server references too: anyone can call them with any argument. Called with
// every content id and collection name, none may answer with staff fields, a staff-only document, or
// a post that is not published.
const ids = await readFile("lib/content/ids.ts", "utf8");
const listIn = (re) => [...(re.exec(ids)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const docIds = listIn(/DOC_IDS = \[([\s\S]*?)\]/);
const collections = listIn(/COLLECTION_NAMES = \[([\s\S]*?)\]/);
if (docIds.length < 20 || collections.length < 10) throw new Error("Could not read the content ids from lib/content/ids.ts.");
const STAFF = /"(verifiedBy|recordedBy|submittedBy|reviewer|reviewerUids|uploadedBy|updatedBy|recordRef|mustAvoid|promptVersion|sources)":/;
const cached = actions.filter(([, a]) => /^\$\$RSC_SERVER_CACHE/.test(a.exportedName ?? ""));
let calls = 0;
for (const [id, a] of cached) {
  const url = urlOf(Object.keys(a.workers).find((w) => !w.startsWith("app/admin")) ?? Object.keys(a.workers)[0]);
  for (const arg of [undefined, ...docIds, ...collections, { liveOnly: false }]) {
    calls++;
    const r = await fetch(`${BASE}${url}`, {
      method: "POST",
      headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
      body: JSON.stringify(arg === undefined ? [] : [arg]),
      redirect: "manual",
    });
    const body = await r.text();
    const where = `${a.filename} ${a.exportedName}(${arg === undefined ? "" : JSON.stringify(arg)})`;
    if (STAFF.test(body)) fails.push(`cached reader ${where}: staff field ${STAFF.exec(body)[1]}`);
    if (/"status":"(draft|in_review|changes_requested|scheduled|approved)"/.test(body) && /"slug":/.test(body) && /"body":\[/.test(body)) fails.push(`cached reader ${where}: a post that is not published`);
    if (/"voice":"/.test(body)) fails.push(`cached reader ${where}: the monthly story plan`);
  }
}
console.log(`  called ${cached.length} cached readers ${calls} times, signed out`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s).` : "\nEvery admin action refuses visitors and Viewers.");
process.exit(fails.length ? 1 : 0);
