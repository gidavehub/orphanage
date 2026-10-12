// Acceptance check for the quick-action sheets that log something from a call or visit
// (admin-ux §3.4): Log a request, Log a concern, Add a follow-up note.
//
//   node scripts/qa/admin/sheets.mjs --base http://localhost:3001
//
//  1. A programme officer logs a request from a phone (375 px): it opens as a new request, marked as
//     logged by staff, with their name on the timeline.
//  2. Saying someone is in danger logs it as a safeguarding concern only (D79), never a request.
//  3. A safeguarding officer logs an anonymous concern from a call: the team is alerted.
//  4. A counsellor adds a follow-up note to one of their recent sessions.

import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const BASE = (process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:3001").replace(/\/+$/, "");
const DATA = path.resolve(".data");
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
const waitFor = async (fn, ms = 30000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};
async function hydrated(page, selector) {
  await page.locator(selector).first().waitFor({ state: "attached", timeout: 60000 });
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
  }, selector, { timeout: 60000 });
}
const toast = (page) => page.locator("ol[aria-live]").innerText().catch(() => "");
const click = (page, sel) => page.locator(sel).evaluate((el) => el.click());

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role, viewport = { width: 1360, height: 900 }) {
  const ctx = await browser.newContext({ viewport, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.request.post(`${BASE}/api/dev/session?role=${role}`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(45000);
  return { ctx, page };
}
const stamp = Date.now().toString(36);

/* 1 ─────────────────────────────────────────────────────────────────── */
console.log("\n1. Log a request from a call (phone)");
const po = await as("programme_officer", { width: 375, height: 812 });
async function logRequest(name, danger) {
  await po.page.goto(`${BASE}/admin?do=log-request`, { waitUntil: "load" });
  await hydrated(po.page, "#lr-fullName");
  await po.page.locator("#lr-category").selectOption("food_supplies");
  if (danger) await po.page.getByRole("radiogroup", { name: "Is anyone in danger right now?" }).getByRole("radio", { name: "Yes" }).click();
  await po.page.locator("#lr-explanation").fill("The family ran out of food after the floods and the children are skipping meals. They asked for help by phone.");
  await po.page.locator("#lr-fullName").fill(name);
  await po.page.locator("#lr-phone").fill("+2207712345");
  await click(po.page, "input[name='lr-agreed']");
  await po.page.getByRole("button", { name: danger ? "Log it as a safeguarding concern" : "Log the request" }).click();
}
const reqName = `Fatou Qa${stamp.slice(-4)}`;
await logRequest(reqName, false);
await po.page.waitForURL(/\/admin\/requests\/HVN-SR-\d{4}-\d{4,}/, { timeout: 60000 }).catch(() => undefined);
const ref = po.page.url().match(/HVN-SR-\d{4}-\d{4,}/)?.[0];
expect(Boolean(ref), `it opens the new request (${ref})`, po.page.url());
const rec = ref ? unwrap((await store("supportRequests"))[ref]) : null;
expect(rec?.source === "staff_entry" && rec?.category === "food_supplies" && rec?.applicant?.fullName === reqName, "the record is marked as logged by staff", JSON.stringify({ s: rec?.source, c: rec?.category }));
const events = ref ? Object.values(await store(`supportRequests/${ref}/events`)).map(unwrap) : [];
expect(events.some((e) => e.type === "created" && e.actor?.kind === "staff" && /Logged by/.test(e.summary)), "the timeline names who logged it", JSON.stringify(events.map((e) => e.summary)));

/* 2 ─────────────────────────────────────────────────────────────────── */
console.log("\n2. Danger → a safeguarding concern only");
const beforeReq = Object.keys(await store("supportRequests")).length;
const beforeCon = Object.keys(await store("safeguardingConcerns")).length;
await logRequest(`Musa Qa${stamp.slice(-4)}`, true);
const t2 = await waitFor(async () => {
  const t = await toast(po.page);
  return /safeguarding concern/.test(t) ? t : null;
}, 40000);
expect(Boolean(t2), "the sheet says it was logged as a safeguarding concern", await toast(po.page));
const afterReq = Object.keys(await store("supportRequests")).length;
const afterCon = Object.keys(await store("safeguardingConcerns")).length;
expect(afterReq === beforeReq && afterCon === beforeCon + 1, `no request, one new concern (${beforeReq}→${afterReq}, ${beforeCon}→${afterCon})`);
const moved = Object.values(await store("safeguardingConcerns")).map(unwrap).sort((a, b) => b.createdAt - a.createdAt)[0];
expect(moved?.source === "staff_entry", "the concern is marked as logged by staff", moved?.source);

/* 3 ─────────────────────────────────────────────────────────────────── */
console.log("\n3. Log an anonymous concern from a call");
const so = await as("safeguarding_officer");
await so.page.goto(`${BASE}/admin?do=log-concern`, { waitUntil: "load" });
await hydrated(so.page, "#lc-narrative");
await so.page.locator("#lc-narrative").fill(`A neighbour called (${stamp}): a boy of about 8 has been left alone for days and looks hungry and scared.`);
await click(so.page, "input[name='lc-type-neglect']");
await so.page.getByRole("radiogroup", { name: "Did they give their details?" }).getByRole("radio", { name: "They stayed anonymous" }).click();
await so.page.getByRole("button", { name: "Log the concern and alert the team" }).click();
await so.page.waitForURL(/\/admin\/safeguarding\/HVN-/, { timeout: 60000 }).catch(() => undefined);
const cref = so.page.url().match(/\/admin\/safeguarding\/(HVN-[A-Z0-9-]+)/)?.[1];
expect(Boolean(cref), `it opens the new concern (${cref})`, so.page.url());
const con = cref ? unwrap((await store("safeguardingConcerns"))[cref]) : null;
expect(con?.source === "staff_entry" && con?.reporter?.anonymous === true && con?.concernTypes?.includes("neglect"), "anonymous, staff-logged, with the chosen kind", JSON.stringify({ s: con?.source, a: con?.reporter?.anonymous }));
const alert = cref ? await waitFor(async () => Object.entries(await store("emailOutbox")).find(([id]) => id === `concern_alert~${cref}`), 30000) : null;
expect(Boolean(alert), "the safeguarding team is alerted (concern_alert)");

/* 4 ─────────────────────────────────────────────────────────────────── */
console.log("\n4. A counsellor adds a follow-up note");
const co = await as("counsellor");
await co.page.goto(`${BASE}/admin?do=add-note`, { waitUntil: "load" });
await hydrated(co.page, "#note-text");
await waitFor(async () => (await co.page.locator("#note-session option").count()) > 0 || (await co.page.getByText("no sessions in the last two weeks").count()) > 0, 30000);
const sessionOpts = await co.page.locator("#note-session option").count().catch(() => 0);
if (sessionOpts === 0) {
  expect((await co.page.getByText("no sessions in the last two weeks").count()) === 1, "no recent sessions: the sheet says so");
} else {
  const target = await co.page.locator("#note-session").inputValue();
  const dir = path.join(DATA, "db", "appointments", target, "notes");
  const count = async () => Object.keys(JSON.parse(await readFile(path.join(dir, "_docs.json"), "utf8").catch(() => "{}"))).length;
  const before = await count();
  await co.page.locator("#note-text").fill(`Follow-up (${stamp}): agreed to meet again next week; mum will join.`);
  await co.page.getByRole("button", { name: "Add the note" }).click();
  const added = await waitFor(async () => ((await count()) === before + 1 ? true : null), 30000);
  expect(Boolean(added), `the note is saved on ${target}`, `${before} → ${await count()} (${(await readdir(path.dirname(dir)).catch(() => [])).length})`);
}

await browser.close();
console.log(fails.length ? `\n${fails.length} failed:\n - ${fails.join("\n - ")}` : "\nAll sheet checks passed.");
process.exit(fails.length ? 1 : 0);
