// A full practice run: every public form, then the team triages each new record (PLAN §6.4 Q5).
//
//   node scripts/qa/practice-run.mjs --base http://localhost:3100 [--skip-forms]
//
// 1. forms.mjs submits every public form and checks its emails (subjects, held mailbox).
// 2. Each record those forms created is opened in the admin by the role that would handle it (its
//    page must load and show the reference) and taken with "Take it" (the record becomes theirs).
// 3. The outbox: every email queued during the run left the queue (held in practice mode), and the
//    team alerts for the new records are there.
// Practice mode only (it signs in with the practice role buttons). Exit 1 on any failure.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = String(flag("--base", "http://localhost:3100")).replace(/\/+$/, "");
const DATA = path.resolve(flag("--data", ".data"));
const started = Date.now();
const fails = [];

// Who handles what (the access matrix in lib/model/permissions.ts).
const TRIAGE = {
  supportRequests: { role: "programme_officer", home: "/admin/requests" },
  safeguardingConcerns: { role: "safeguarding_officer", home: "/admin/safeguarding" },
  contactMessages: { role: "content_manager", home: "/admin/inbox" },
  storySubmissions: { role: "content_manager", home: "/admin/inbox" },
  volunteerApplications: { role: "programme_officer", home: "/admin/people" },
  partnershipEnquiries: { role: "programme_officer", home: "/admin/people" },
  reportRequests: { role: "report_manager", home: "/admin/library/requests" },
  dataRequests: { role: "super_admin", home: "/admin/settings/data?ref=" },
  donations: { role: "finance_officer", home: "/admin/giving" },
};

const unwrap = (doc) => (doc && typeof doc === "object" && "data" in doc && doc.data && typeof doc.data === "object" ? doc.data : doc);
async function store(collection) {
  try {
    return Object.entries(JSON.parse(await readFile(path.join(DATA, "db", collection, "_docs.json"), "utf8"))).map(([id, d]) => ({ id, ...unwrap(d) }));
  } catch {
    return [];
  }
}

// 1. Forms.
if (!args.includes("--skip-forms")) {
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join("scripts", "qa", "forms.mjs"), "--base", BASE], { stdio: "inherit" });
    child.on("close", resolve);
  });
  if (code !== 0) fails.push("forms.mjs reported failures (see above)");
}

// 2. Triage.
const manifest = JSON.parse(await readFile(".next/server/server-reference-manifest.json", "utf8"));
const takeId = Object.entries(manifest.node).find(([, a]) => a.exportedName === "take" && a.filename === "app/admin/(desk)/inbox/actions.ts")?.[0];
if (!takeId) throw new Error("The take action is not in the build; run npm run build first.");

const cookies = {};
async function as(role) {
  if (cookies[role]) return cookies[role];
  const r = await fetch(`${BASE}/api/dev/session?role=${role}`, { method: "POST", redirect: "manual" });
  cookies[role] = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => /haven_session=/.test(c)).join("; ");
  if (!cookies[role]) throw new Error(`Practice sign-in as ${role} failed (${r.status}).`);
  return cookies[role];
}

let triaged = 0;
const since = args.includes("--skip-forms") ? started - 24 * 3600_000 : started;
for (const [collection, { role, home }] of Object.entries(TRIAGE)) {
  const fresh = (await store(collection)).filter((d) => (d.createdAt ?? 0) >= since && !d.archived);
  if (!fresh.length) {
    if (!args.includes("--skip-forms") && collection !== "donations") fails.push(`${collection}: the forms created no record`);
    continue;
  }
  const rec = fresh.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
  const ref = rec.reference ?? rec.id;
  const cookie = await as(role);
  const url = home.endsWith("=") ? `${home}${encodeURIComponent(ref)}` : `${home}/${encodeURIComponent(ref)}`;
  const page = await fetch(`${BASE}${url}`, { headers: { cookie }, redirect: "manual" });
  const html = page.status === 200 ? await page.text() : "";
  if (page.status !== 200 || !html.includes(ref)) {
    fails.push(`${collection} ${ref}: ${role} cannot open ${url} (${page.status})`);
    continue;
  }
  // "Take it" is registered on the Inbox pages; the action itself works for any record kind.
  const res = await fetch(`${BASE}/admin/inbox`, {
    method: "POST",
    headers: { "Next-Action": takeId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie },
    body: JSON.stringify([ref]),
  });
  const body = await res.text();
  const rows = new Map(body.split(/\r?\n/).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1)]));
  const at = /"a":"\$@([0-9a-f]+)"/.exec(rows.get("0") ?? "")?.[1];
  const result = at ? (rows.get(at) ?? "") : body;
  if (!/"ok":true/.test(result)) {
    fails.push(`${collection} ${ref}: ${role} could not take it: ${result.slice(0, 160)}`);
    continue;
  }
  const after = (await store(collection)).find((d) => d.id === rec.id);
  if (!after?.assignedTo) fails.push(`${collection} ${ref}: taken, but no owner was recorded`);
  else {
    triaged++;
    console.log(`  ✓ ${collection} ${ref}: opened and taken by ${role.replace(/_/g, " ")}`);
  }
}

// 3. Outbox.
const outbox = (await store("emailOutbox")).filter((e) => (e.createdAt ?? 0) >= since);
const stuck = outbox.filter((e) => e.status === "queued" || e.status === "sending" || e.status === "failed");
for (const e of stuck) fails.push(`email ${e.template}: still ${e.status}`);
const templates = new Set(outbox.map((e) => e.template));
for (const t of ["concern_alert", "support_confirmation", "volunteer_acknowledgement", "partnership_acknowledgement", "report_request_confirmation", "contact_confirmation", "story_acknowledgement", "newsletter_confirm", "data_request_verify"].filter(() => !args.includes("--skip-forms"))) {
  if (![...templates].some((x) => x.startsWith(t))) fails.push(`no ${t} email was queued during the run`);
}
console.log(`  outbox: ${outbox.length} emails during the run (${[...templates].sort().join(", ")})`);

for (const f of fails) console.log(`  ✗ ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s).` : `\nPractice run: every form went through and ${triaged} records were triaged.`);
process.exit(fails.length ? 1 : 0);
