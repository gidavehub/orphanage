// Acceptance check for A6 (PLAN §6.2 A6): People boards and the referral directory.
//
//   node scripts/qa/admin/a6.mjs --base http://localhost:3001
//
//  1. Dragging a volunteer from Submitted to Screening moves it (an allowed edge).
//  2. Dropping a Submitted volunteer on Approved is refused with a sentence; the stage doesn't change.
//  3. Keyboard: focus a Screening card, press m, choose Interview, confirm → Interview.
//  4. The partnership lanes read New · Under review · Talking · Agreement · Active.
//  5. A new directory entry appears in a support request's referral step.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
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
const statusOf = async (c, id) => unwrap((await store(c))[id])?.status;
const waitFor = async (fn, ms = 20000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};
const toastText = async (page) => (await page.locator("ol[aria-live]").allInnerTexts().catch(() => [])).join(" | ");
async function hydrated(page, selector) {
  await page.locator(selector).first().waitFor({ state: "attached" });
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
  }, selector);
}

// Enough submitted volunteers to move (each run uses two).
const submitted = async () =>
  Object.entries(await store("volunteerApplications"))
    .map(([k, v]) => [k, unwrap(v)])
    .filter(([, v]) => v.status === "submitted" && !v.archived)
    .map(([k]) => k);
for (let i = 0; i < 2 && (await submitted()).length < 2; i++) {
  execFileSync(process.execPath, ["scripts/qa/forms/volunteer.mjs", "--base", BASE], { stdio: "ignore", timeout: 300000 });
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.request.post(`${BASE}/api/dev/session?role=programme_officer`);
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(150000);
page.setDefaultTimeout(30000);

async function drag(cardRef, laneLabel) {
  const card = page.locator(`article[data-ref="${cardRef}"]`);
  const lane = page.locator(`section[aria-label^="${laneLabel} ("]`).first();
  const a = await card.boundingBox();
  const b = await lane.boundingBox();
  await page.mouse.move(a.x + 30, a.y + 14);
  await page.mouse.down();
  await page.mouse.move(a.x + 60, a.y + 40, { steps: 6 });
  await page.mouse.move(b.x + b.width / 2, b.y + 80, { steps: 14 });
  await page.mouse.up();
}

console.log("\n1. Drag Submitted → Screening");
const [a, b] = await submitted();
await page.goto(`${BASE}/admin/people`, { waitUntil: "load" });
await hydrated(page, "article[aria-roledescription=card]");
await drag(a, "Screening");
expect(Boolean(await waitFor(async () => (await statusOf("volunteerApplications", a)) === "screening")), `${a} moved to Screening`);

console.log("\n2. A disallowed drop is refused");
await page.goto(`${BASE}/admin/people`, { waitUntil: "load" });
await hydrated(page, "article[aria-roledescription=card]");
await drag(b, "Approved");
const refused = await waitFor(async () => {
  const t = await toastText(page);
  return /can.t go straight/i.test(t) ? t : null;
}, 8000);
expect(Boolean(refused), "the drop is refused with a sentence", await toastText(page));
await page.waitForTimeout(1000);
expect((await statusOf("volunteerApplications", b)) === "submitted", `${b} is still Submitted`);

console.log("\n3. Keyboard: m → Move to…");
await page.goto(`${BASE}/admin/people`, { waitUntil: "load" });
await hydrated(page, "article[aria-roledescription=card]");
const card = page.locator(`article[data-ref="${a}"]`);
await card.focus();
await page.keyboard.press("m");
const item = page.getByRole("menuitem", { name: /^Interview/ }).first();
await item.waitFor();
await item.press("Enter");
await page.getByRole("button", { name: "Invite to interview" }).click();
expect(Boolean(await waitFor(async () => (await statusOf("volunteerApplications", a)) === "interview")), `${a} moved to Interview from the keyboard`);

console.log("\n4. Partnership lanes");
await page.goto(`${BASE}/admin/people/partners`, { waitUntil: "load" });
await page.locator("section[aria-label]").first().waitFor();
const lanes = (await page.locator("section[aria-label$=')']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).map((l) => l.replace(/ \(\d+\)$/, ""));
expect(["New", "Under review", "Talking", "Agreement", "Active"].every((l, i) => lanes[i] === l), `lanes read ${lanes.slice(0, 5).join(" · ")}`);

console.log("\n5. Directory → referral step");
const name = `QA Health Clinic ${Date.now().toString(36)}`;
await page.goto(`${BASE}/admin/people/directory`, { waitUntil: "load" });
await hydrated(page, "button");
await page.getByRole("button", { name: "Add a service" }).click();
await page.locator("#name").fill(name);
await page.locator("#services").fill("Child health check-ups and referrals for families.");
await page.getByRole("button", { name: "Add it" }).click();
const saved = await waitFor(async () => Object.values(await store("referralPartners")).map(unwrap).find((r) => r.name === name));
expect(Boolean(saved), "the directory entry is saved");
const sr = Object.entries(await store("supportRequests"))
  .map(([k, v]) => [k, unwrap(v)])
  .find(([, v]) => ["under_review", "assigned"].includes(v.status) && !v.archived)?.[0];
if (sr) {
  await page.goto(`${BASE}/admin/requests/${sr}`, { waitUntil: "load" });
  await hydrated(page, "button");
  await page.getByRole("button", { name: "Record a referral" }).first().click();
  await page.locator("#partnerId").waitFor();
  const options = await page.locator("#partnerId option").allInnerTexts();
  expect(options.some((o) => o.includes(name)), "the new entry is offered when recording a referral");
} else expect(false, "a support request that can be referred");

await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A6 checks passed.");
process.exit(fails.length ? 1 : 0);
