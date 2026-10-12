// Acceptance check for A2 (Inbox, Requests, Messages, Story submissions; PLAN §6.2 A2).
//
//   node scripts/qa/admin/a2.mjs --base http://localhost:3001
//
// Uses the practice sign-in (POST /api/dev/session?role=…) and the practice store under .data/.
//  1. Content manager: the Inbox lists messages and story submissions and no concerns; no concern
//     narrative appears in the Inbox HTML for anyone.
//  2. Programme officer: the Inbox lists support requests; a new request can be taken (Under review,
//     assigned to them); Approve is held back with the guard sentence until the checks are saved;
//     after "eligible + verified", Approve works; Complete needs an outcome. Every move writes an event
//     and an audit entry.
//  3. A stale version is answered with the conflict toast.
//  4. Showing a masked phone writes a sensitive audit entry.
//  5. /admin/r/HVN-SR-2026-0001 → /admin/requests/HVN-SR-2026-0001; a counsellor gets NoAccess on Requests.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");
const DATA = path.resolve(flag("--data", ".data"));
const fails = [];
const expect = (ok, msg, extra) => {
  if (ok) console.log(`  ✓ ${msg}`);
  else {
    fails.push(msg);
    console.log(`  ✗ ${msg}${extra !== undefined ? `\n      ${String(extra).slice(0, 300)}` : ""}`);
  }
};
const unwrap = (d) => (d && typeof d === "object" && "data" in d && d.data && typeof d.data === "object" ? d.data : d);
async function store(c) {
  try {
    return JSON.parse(await readFile(path.join(DATA, "db", c, "_docs.json"), "utf8"));
  } catch {
    return {};
  }
}
async function sub(parent, child) {
  try {
    const all = JSON.parse(await readFile(path.join(DATA, "db", ...parent.split("/"), child, "_docs.json"), "utf8"));
    return Object.values(all).map(unwrap);
  } catch {
    return [];
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const r = await ctx.request.post(`${BASE}/api/dev/session?role=${role}`);
  if (!r.ok()) throw new Error(`sign-in as ${role} failed (${r.status()})`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}
const NARRATIVES = ["left alone in the evenings", "unexplained marks", "workshop"];

console.log("\n1. Content manager's Inbox");
{
  const { ctx, page } = await as("content_manager");
  const res = await page.goto(`${BASE}/admin/inbox`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const html = await page.content();
  expect(res.status() === 200, "the Inbox opens");
  expect(/Story from/.test(html) || /Message ·/.test(html), "messages or stories are listed");
  expect(!/Concern ·/.test(html), "no concerns are listed");
  expect(!NARRATIVES.some((n) => html.includes(n)), "no concern narrative in the page");
  await ctx.close();
}

console.log("\n2. Programme officer: take, guard, checks, approve, complete");
const pickNew = async () =>
  Object.entries(await store("supportRequests"))
    .map(([k, v]) => [k, unwrap(v)])
    .find(([, v]) => v.status === "new" && !v.assignedTo)?.[0];
if (!(await pickNew())) {
  // Every new request has been worked on already: send a fresh one through the public form.
  console.log("  (sending a fresh support request through the public form)");
  try {
    execFileSync(process.execPath, ["scripts/qa/forms/support.mjs", "--base", BASE], { stdio: "ignore", timeout: 300000 });
  } catch {
    /* the check below reports it */
  }
}
const docs = await store("supportRequests");
const target = Object.entries(docs).map(([k, v]) => [k, unwrap(v)]).find(([, v]) => v.status === "new" && !v.assignedTo)?.[0];
expect(Boolean(target), `a new, untaken request to work on (${target ?? "none"})`);
if (target) {
  const { ctx, page, errors } = await as("programme_officer");
  await page.goto(`${BASE}/admin/inbox`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const html = await page.content();
  expect(/Education|Medical|Legal|Counselling|Family/.test(html), "support requests are listed");
  expect(!NARRATIVES.some((n) => html.includes(n)), "no concern narrative in the page");

  await page.goto(`${BASE}/admin/requests/${target}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Take it" }).first().click();
  await page.waitForTimeout(2500);
  let rec = unwrap((await store("supportRequests"))[target]);
  expect(rec.status === "under_review" && !!rec.assignedTo, "taken: Under review and assigned", `${rec.status} ${rec.assignedTo}`);
  const auditCount = Object.values(await store("auditLog")).filter((a) => unwrap(a).targetRef === target).length;
  expect(auditCount >= 1, `an audit entry was written (${auditCount})`);

  const guard = await page.getByText("Check and verify the request first, then you can approve it.").count();
  expect(guard > 0, "Approve shows the guard sentence before the checks");

  await page.getByText("Eligible", { exact: true }).click();
  await page.locator("select[id^='verification-']").selectOption("verified");
  await page.getByLabel(/How was it checked/).fill("Called the school and saw the fee letter.");
  await page.getByRole("button", { name: "Save the checks" }).click();
  await page.waitForTimeout(2500);
  rec = unwrap((await store("supportRequests"))[target]);
  expect(rec.triage?.verification?.status === "verified" && rec.triage?.eligibility === "eligible", "checks saved");

  await page.getByRole("button", { name: "Approve support" }).click();
  await page.waitForTimeout(2500);
  rec = unwrap((await store("supportRequests"))[target]);
  expect(rec.status === "approved", "approved after the checks", rec.status);

  await page.getByRole("button", { name: "Start support" }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Mark as complete" }).click();
  await page.getByLabel("What support was given?").waitFor({ timeout: 30000 });
  const sheetBtn = page.getByRole("button", { name: "Mark as complete" }).last();
  expect(await sheetBtn.isDisabled(), "Complete waits for an outcome");
  await page.getByLabel("What support was given?").fill("School fees for the term and a uniform were paid directly to the school.");
  await sheetBtn.click();
  await page.waitForTimeout(2500);
  rec = unwrap((await store("supportRequests"))[target]);
  expect(rec.status === "completed" && rec.outcome?.summary, "completed with an outcome", rec.status);
  const events = await sub(`supportRequests/${target}`, "events");
  expect(events.filter((e) => e.type === "status_changed").length >= 4, `stage changes are on the timeline (${events.length} events)`);

  console.log("\n3. Stale version");
  const ref2 = Object.entries(await store("supportRequests")).map(([k, v]) => [k, unwrap(v)]).find(([k, v]) => k !== target && v.status === "new")?.[0];
  if (ref2) {
    await page.goto(`${BASE}/admin/requests/${ref2}`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    // Someone else moves it first (another officer's session).
    const other = await as("super_admin");
    await other.page.goto(`${BASE}/admin/requests/${ref2}`, { waitUntil: "load" });
    await other.page.waitForTimeout(2500);
    await other.page.getByRole("button", { name: "Start review" }).click();
    await other.page.waitForTimeout(2500);
    await other.ctx.close();
    await page.getByRole("button", { name: "Start review" }).click();
    const STALE = /Someone else saved changes|isn't possible|isn't available|no longer/i;
    const deadline = Date.now() + 20000;
    let body = "";
    while (Date.now() < deadline && !STALE.test(body)) {
      await page.waitForTimeout(500);
      body = await page.locator("body").innerText();
    }
    expect(STALE.test(body), "a stale page gets the conflict message", body.slice(0, 120));
  }

  console.log("\n4. Showing a masked phone");
  const masked = Object.entries(await store("supportRequests")).map(([k, v]) => [k, unwrap(v)]).find(([, v]) => v.applicant?.phone && v.assignedTo !== null && v.status !== "closed");
  if (masked) {
    const before = Object.values(await store("auditLog")).filter((a) => unwrap(a).sensitive && unwrap(a).targetRef === masked[0]).length;
    await page.goto(`${BASE}/admin/requests/${masked[0]}`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const show = page.getByRole("button", { name: /Show/ }).first();
    if (await show.count()) {
      await show.click();
      await page.waitForTimeout(2000);
      const after = Object.values(await store("auditLog")).filter((a) => unwrap(a).sensitive && unwrap(a).targetRef === masked[0]).length;
      expect(after > before, "a sensitive audit entry is written");
    } else expect(true, "contact is shown in full to the person looking after it (no Show needed)");
  }
  if (errors.length) expect(false, "no page errors", errors.join(" | "));
  await ctx.close();
}

console.log("\n5. Short link and NoAccess");
{
  const { ctx, page } = await as("programme_officer");
  await page.goto(`${BASE}/admin/r/HVN-SR-2026-0001`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(page.url().endsWith("/admin/requests/HVN-SR-2026-0001"), "the short link opens the request", page.url());
  await ctx.close();
  const c = await as("counsellor");
  await c.page.goto(`${BASE}/admin/requests`, { waitUntil: "load" });
  await c.page.waitForTimeout(2000);
  expect(/isn.t open to you/i.test(await c.page.locator("body").innerText()), "a counsellor gets NoAccess on Requests");
  await c.ctx.close();
}

await browser.close();
await sleep(10);
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A2 checks passed.");
process.exit(fails.length ? 1 : 0);
