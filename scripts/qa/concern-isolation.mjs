// A safeguarding concern's details never leave Safeguarding (PLAN §6.4 Q3, Q5; §7.5 concern isolation).
//
//   node scripts/qa/concern-isolation.mjs --base http://localhost:3100
//
// A safeguarding officer logs a concern whose narrative, area and reporter details each carry a
// unique marker. Then, for every role, every admin page (with its notifications), search (by marker
// and by reference), the email log and each email in it, and every CSV export are fetched: no marker
// may appear anywhere except the concern's own page, and there only for people with `concern.read`.
// The reference itself may appear only where its role may read concerns. Finally the practice store
// (.data/) must hold the narrative sealed: no marker in plain text on disk.
// Exit code 1 on any failed expectation.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const BASE = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3100").replace(/\/+$/, "");
const ROLES = ["super_admin", "content_manager", "programme_officer", "safeguarding_officer", "finance_officer", "counsellor", "report_manager", "viewer"];
const CONCERN_READERS = new Set(["super_admin", "safeguarding_officer"]);
const PAGES = ["", "activity", "counselling", "giving", "giving/causes", "giving/sponsorship", "giving/where-it-goes", "help", "inbox", "library", "library/requests", "me", "media", "people", "people/directory", "people/partners", "posts", "posts/plan", "requests", "safeguarding", "settings", "settings/connections", "settings/data", "settings/email-log", "settings/emails", "settings/giving", "settings/newsletter", "team", "website", "website/changes", "website/key-info", "website/launch"];
const DATASETS = ["donations", "volunteers", "partners", "newsletter"];

const tag = randomBytes(4).toString("hex");
const M = { narrative: `qanarr${tag}`, area: `qaarea${tag}`, name: `Qaname${tag}`, email: `qa${tag}@example.org`, phone: `+220 77${parseInt(tag.slice(0, 5), 16) % 100000}`.slice(0, 13) };
const markers = Object.values(M).map((s) => s.toLowerCase());

const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
};

async function signIn(role) {
  const r = await fetch(`${BASE}/api/dev/session?role=${role}`, { method: "POST", redirect: "manual" });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => /haven_session=/.test(c)).join("; ");
}
const get = async (url, cookie) => {
  const r = await fetch(`${BASE}${url}`, { headers: { cookie }, redirect: "manual" });
  return { status: r.status, body: r.status >= 300 && r.status < 400 ? "" : await r.text() };
};
const found = (body) => markers.filter((m) => body.toLowerCase().includes(m));

// 1. Log the concern as a safeguarding officer.
const manifest = JSON.parse(await readFile(".next/server/server-reference-manifest.json", "utf8"));
const actionId = Object.entries(manifest.node).find(([, a]) => a.exportedName === "logConcernAction")?.[0];
if (!actionId) throw new Error("logConcernAction is not in the build; run npm run build first.");
const so = await signIn("safeguarding_officer");
const input = {
  childAge: "5-9", country: "gm", area: M.area, concernTypes: ["neglect"], narrative: `A test concern ${M.narrative}, written by the isolation check.`,
  inDangerNow: "no", authoritiesContacted: "no", authorityDetails: null, reporterMode: "named", name: M.name, phone: M.phone, email: M.email,
  relationship: "community_member", followUpMethod: "phone", followUpTimes: "Weekday mornings",
};
const res = await fetch(`${BASE}/admin/safeguarding`, {
  method: "POST",
  headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie: so },
  body: JSON.stringify([input]),
});
const text = await res.text();
const reference = /"reference":"(HVN-[A-Z0-9]{4}-[A-Z0-9]{4})"/.exec(text)?.[1];
if (!reference) throw new Error(`The concern was not logged: ${res.status} ${text.slice(-300)}`);
console.log(`  logged ${reference} with markers …${tag}`);

// 2. Every role, everywhere.
for (const role of ROLES) {
  const cookie = role === "safeguarding_officer" ? so : await signIn(role);
  const reader = CONCERN_READERS.has(role);
  const seen = [];
  const check = (where, body) => {
    const hits = found(body);
    if (hits.length) fails.push(`${role}: ${where} shows ${hits.join(", ")}`);
    if (!reader && body.includes(reference)) fails.push(`${role}: ${where} shows the concern's reference`);
    seen.push(where);
  };
  for (const p of PAGES) {
    const r = await get(`/admin/${p}`, cookie);
    if (r.status === 200) check(`/admin/${p}`, r.body);
  }
  for (const q of [M.narrative, M.name, M.email, M.area, reference]) {
    const r = await get(`/api/admin/search?q=${encodeURIComponent(q)}`, cookie);
    if (r.status === 200) check(`search "${q === reference ? "reference" : q.slice(0, 6) + "…"}"`, r.body);
  }
  const log = await get("/admin/settings/email-log", cookie);
  if (log.status === 200) {
    const ids = [...new Set([...log.body.matchAll(/\/admin\/settings\/email-log\/([A-Za-z0-9_-]{6,})/g)].map((m) => m[1]))].slice(0, 30);
    for (const id of ids) {
      const r = await get(`/admin/settings/email-log/${id}`, cookie);
      if (r.status === 200) check(`email ${id}`, r.body);
    }
  }
  for (const d of DATASETS) {
    for (const q of ["", "?contact=1"]) {
      const r = await get(`/admin/export/${d}${q}`, cookie);
      if (r.status === 200) check(`export ${d}${q}`, r.body);
    }
  }
  // The concern's own page: details for readers, nothing for anyone else.
  const own = await get(`/admin/safeguarding/${reference}`, cookie);
  if (reader) {
    ok(own.status === 200 && own.body.includes(M.narrative), `${role}: cannot read the concern's narrative on its own page`);
    const title = /<title>([^<]*)<\/title>/.exec(own.body)?.[1] ?? "";
    ok(!found(title).length, `${role}: the concern's page title carries its details (${title})`);
  } else {
    ok(!found(own.body).length, `${role}: the concern's page shows its details`);
  }
  console.log(`  ${role}: ${seen.length} places checked`);
}

// 3. On disk, the narrative and the reporter are sealed.
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(json|ndjson|txt|eml|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
let plain = 0;
for (const f of await walk(".data")) {
  const body = await readFile(f, "utf8").catch(() => "");
  const hits = [M.narrative, M.name, M.email].filter((m) => body.toLowerCase().includes(m.toLowerCase()));
  if (hits.length) {
    plain++;
    fails.push(`.data: ${path.relative(".data", f)} holds ${hits.join(", ")} in plain text`);
  }
}
console.log(`  .data: ${plain} file(s) with a marker in plain text`);

for (const f of fails) console.log(`  ✗ ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s).` : "\nThe concern's details stay inside Safeguarding.");
process.exit(fails.length ? 1 : 0);
