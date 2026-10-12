// Acceptance check for Report a Concern (P4; public-pages §3.7, data-model §4.2.2, §10.2; PLAN D94,
// D95, D107–D109). Drives /report-a-concern in Chrome, then reads the practice store under .data/.
//
//   node scripts/qa/forms/concern.mjs --base http://localhost:3001
//
// 1. Anonymous report: random HVN-XXXX-XXXX reference on screen, no reporter identity stored, no
//    reporter email, narrative sealed, concern_alert + three scheduled re-alerts with fixed subjects.
// 2. Named report, follow up by email + "send me a confirmation": concern_reporter_confirmation held
//    (subject carries no reference); a named report followed up by phone gets no email.
// 3. Honeypot filled: still kept, flagged suspectedSpam, and no alert is sent (D94).
// 4. QuickExit: Shift ×3 leaves for the neutral page with no leave prompt and no sessionStorage keys.
// Exit code 1 on any failed expectation. Never prints secrets.

import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const BASE = String(flag("--base", flag("--url", "http://localhost:3001"))).replace(/\/+$/, "");
const DATA = path.resolve(flag("--data", ".data"));
const CHROME = flag("--chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe");

const fails = [];
const expect = (ok, msg, extra) => {
  if (ok) console.log(`  ✓ ${msg}`);
  else {
    fails.push(msg);
    console.log(`  ✗ ${msg}${extra !== undefined ? `\n      ${typeof extra === "string" ? extra : JSON.stringify(extra).slice(0, 400)}` : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fakeIp = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;

const SUBJECT = {
  concern_alert: /^(?:Haven: a new item needs your attention|Reminder: an item still needs your attention)$/,
  concern_reporter_confirmation: /^Thank you for getting in touch$/,
};
const REF_RE = /HVN-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}/;

async function store(collection) {
  try {
    return JSON.parse(await readFile(path.join(DATA, "db", collection, "_docs.json"), "utf8"));
  } catch {
    return {};
  }
}
async function grepDir(dir, needle) {
  const hits = [];
  async function walk(d) {
    let entries = [];
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if ((await readFile(p)).includes(Buffer.from(needle))) hits.push(path.relative(DATA, p));
    }
  }
  await walk(dir);
  return hits;
}
async function waitForOutbox(id, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const doc = (await store("emailOutbox"))[id];
    if (doc && doc.status !== "queued" && doc.status !== "sending") return doc;
    await sleep(500);
  }
  return (await store("emailOutbox"))[id] ?? null;
}

const html = await fetch(`${BASE}/report-a-concern`).then((r) => r.text()).catch(() => "");
if (!/<title>[^<]*Haven/.test(html)) {
  console.log(`  ✗ ${BASE}/report-a-concern is not Haven (check --base)`);
  process.exit(1);
}
expect(/<meta name="referrer" content="no-referrer"/.test(html), "the page sends no referrer");

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  await context.route("https://www.google.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>weather</title>ok" }));
  const page = await context.newPage();
  const errors = [];
  const dialogs = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => {
    dialogs.push(d.type());
    d.dismiss().catch(() => {});
  });
  await page.goto(`${BASE}/report-a-concern`, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.hasAttribute("data-quick-exit"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  return { context, page, errors, dialogs };
}
const pick = (page, name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).first().click();
const cont = async (page) => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);
};

/** Step 1, filled the same way each time. */
async function stepOne(page, narrative, { danger = "no" } = {}) {
  await pick(page, "childAge", "10-14");
  await page.locator("#country").selectOption("gm");
  await page.locator("#area").fill("Near the market");
  await page.getByRole("button", { name: "Neglect", exact: true }).click();
  await page.getByRole("button", { name: "Child labour", exact: true }).click();
  await page.locator("#narrative").fill(narrative);
  await pick(page, "inDangerNow", danger);
  await pick(page, "authoritiesContacted", "no");
  await cont(page);
}
async function send(page) {
  await page.locator('input[name="consent"]').check({ force: true });
  await page.waitForTimeout(2600);
  await page.getByRole("button", { name: "Send Report Securely" }).click();
  await page.getByRole("status").filter({ hasText: /Speaking Up/i }).first().waitFor({ timeout: 60000 });
  return ((await page.locator("main").innerText()).match(REF_RE) ?? [""])[0];
}

/* ── 1. Anonymous ─────────────────────────────────────────────────────────────────────────────── */
console.log("\n1. Anonymous report");
{
  const marker = `qa-concern-${randomUUID().slice(0, 8)}`;
  const { context, page, errors } = await open();
  // Step 1 validation: Continue with nothing filled shows the error summary.
  await page.getByRole("button", { name: "Continue" }).click();
  expect(await page.getByText("There's a problem").first().isVisible(), "an empty step shows the error summary");
  await pick(page, "inDangerNow", "unsure");
  expect(await page.getByText(/Please also finish this report/).isVisible(), "'Not sure' re-surfaces the emergency banner inline");
  await stepOne(page, `The child is left alone for days and is sent to work instead of school. ${marker}`, { danger: "unsure" });
  await page.getByRole("radio", { name: "Stay anonymous" }).click();
  expect(await page.getByText("You are reporting anonymously", { exact: true }).isVisible(), "anonymous mode shows its note");
  expect((await page.locator("#name").count()) === 0 && (await page.locator("#email").count()) === 0, "anonymous mode hides every personal field");
  await cont(page);
  const ref = await send(page);
  expect(REF_RE.test(ref), `random reference shown to the anonymous reporter (${ref})`);
  expect(await page.getByRole("link", { name: "Back to Home" }).isVisible(), "Back to Home offered");
  expect(errors.length === 0, "no page errors", errors);

  const c = (await store("safeguardingConcerns"))[ref];
  expect(!!c, "one safeguardingConcerns doc under that reference");
  if (c) {
    expect(c.source === "web_form" && c.reporter?.anonymous === true && c.reporter?.identity === null && c.reporter?.safeFollowUp === null, "anonymous: no identity or follow-up stored");
    expect(c.narrative?.$sealed === 1 && c.child?.location?.$sealed === 1, "narrative and location sealed");
    expect(JSON.stringify(c.concernTypes) === JSON.stringify(["neglect", "child_labour"]), `concern types stored (${c.concernTypes})`);
    expect(c.suspectedSpam === false && c.status === "received", "status received, not flagged");
    expect(JSON.stringify(c.searchTokens) === JSON.stringify([ref.toLowerCase()]), "only the reference is searchable");
  }
  const alert = await waitForOutbox(`concern_alert~${ref}`);
  expect(!!alert && (alert.status === "held" || alert.status === "queued"), `concern_alert queued (${alert?.status})`);
  expect(SUBJECT.concern_alert.test(alert?.subject ?? ""), `alert subject is template-fixed (${alert?.subject})`);
  const outbox = await store("emailOutbox");
  expect([1, 2, 3].every((n) => typeof outbox[`concern_alert~${ref}~${n}`]?.scheduledFor === "number"), "three re-alerts queued with scheduledFor");
  expect(!outbox[`concern_reporter_confirmation~${ref}`], "no reporter email for an anonymous report");
  await sleep(1000);
  expect((await grepDir(path.join(DATA, "db"), marker)).length === 0, "the narrative appears nowhere in .data/db");
  expect((await grepDir(path.join(DATA, "mailbox"), marker)).length === 0, "the narrative appears in no email");
  const notes = Object.values(await store("notifications")).filter((n) => n.href === "/admin/safeguarding");
  expect(notes.every((n) => n.title === "New safeguarding item needs review"), "in-app alerts carry the fixed title only");
  await context.close();
}

/* ── 2. Named reports ─────────────────────────────────────────────────────────────────────────── */
console.log("\n2. Named report, follow-up by email with a confirmation");
{
  const { context, page, errors } = await open();
  await stepOne(page, "A neighbour's child has bruises and says she is not allowed to eat with the family.");
  await page.locator("#name").fill("Mariama QA Reporter");
  await page.locator("#email").fill("qa.reporter@example.org");
  await page.locator("#relationship").selectOption("community_member");
  await pick(page, "followUpMethod", "email");
  await page.locator("#followUpTimes").fill("Any weekday evening");
  await page.locator('input[name="emailConfirmationAllowed"]').check({ force: true });
  await cont(page);
  const ref = await send(page);
  expect(REF_RE.test(ref), `reference shown (${ref})`);
  expect(await page.getByText(/We've sent a short confirmation to q\*\*\*@example\.org/).isVisible(), "the success screen says a confirmation was sent (masked)");
  expect(errors.length === 0, "no page errors", errors);
  const c = (await store("safeguardingConcerns"))[ref];
  expect(c?.reporter?.anonymous === false && c?.reporter?.identity?.$sealed === 1 && c?.reporter?.emailConfirmationAllowed === true, "identity sealed, confirmation allowed");
  const conf = await waitForOutbox(`concern_reporter_confirmation~${ref}`);
  expect(conf?.status === "held", `concern_reporter_confirmation held (${conf?.status})`);
  expect(SUBJECT.concern_reporter_confirmation.test(conf?.subject ?? "") && !String(conf?.subject).includes("HVN-"), `reporter subject carries no reference (${conf?.subject})`);
  await context.close();
}
console.log("\n   Named report, follow-up by phone");
{
  const { context, page } = await open();
  await stepOne(page, "A child at the bus stop is begging every night and looks unwell and frightened.");
  await page.locator("#name").fill("Ousman QA Reporter");
  await page.locator("#phone").fill("+220 700 5555");
  await page.locator("#email").fill("qa.reporter2@example.org");
  await page.locator("#relationship").selectOption("teacher");
  await pick(page, "followUpMethod", "phone");
  await page.locator("#followUpTimes").fill("After 4pm");
  expect((await page.locator('input[name="emailConfirmationAllowed"]').count()) === 0, "no confirmation option unless email is the follow-up method");
  await cont(page);
  const ref = await send(page);
  await sleep(2000);
  expect(!(await store("emailOutbox"))[`concern_reporter_confirmation~${ref}`], "no reporter email when follow-up is by phone");
  await context.close();
}

/* ── 3. Honeypot ──────────────────────────────────────────────────────────────────────────────── */
console.log("\n3. Honeypot filled → kept and flagged");
{
  const { context, page } = await open();
  await stepOne(page, "Automated text pretending to be a concern about a child in the area for testing.");
  await page.getByRole("radio", { name: "Stay anonymous" }).click();
  await cont(page);
  await page.evaluate(() => {
    const el = document.querySelector('input[name="company_website"]');
    if (el) el.value = "https://spam.example";
  });
  const ref = await send(page);
  expect(REF_RE.test(ref), `the same success screen with a reference (${ref})`);
  const c = (await store("safeguardingConcerns"))[ref];
  expect(c?.suspectedSpam === true, "kept with suspectedSpam: true");
  await sleep(1500);
  expect(!(await store("emailOutbox"))[`concern_alert~${ref}`], "no alert for a suspected-spam item");
  await context.close();
}

/* ── 4. QuickExit ─────────────────────────────────────────────────────────────────────────────── */
console.log("\n4. QuickExit (Shift ×3)");
{
  const { context, page, dialogs } = await open();
  await page.locator("#narrative").fill("Typing something sensitive before leaving quickly.");
  await page.evaluate(() => sessionStorage.setItem("qa-probe", "1"));
  const keysBefore = await page.evaluate(() => Object.keys(sessionStorage));
  expect(keysBefore.includes("hv.leave-guard"), "a dirty form arms the leave guard");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Shift");
    await page.waitForTimeout(120);
  }
  await page.waitForURL(/google\.com\/search\?q=weather/, { timeout: 10000 }).catch(() => {});
  expect(/google\.com\/search\?q=weather/.test(page.url()), `navigated away to the neutral page (${page.url()})`);
  expect(!dialogs.includes("beforeunload"), "no leave prompt held the visitor back");
  await page.goto(`${BASE}/robots.txt`, { waitUntil: "load" });
  const keysAfter = await page.evaluate(() => Object.keys(sessionStorage));
  expect(keysAfter.length === 0, "no sessionStorage keys left", keysAfter);
  await context.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} check(s) failed.` : "\nAll concern checks passed.");
process.exit(fails.length ? 1 : 0);
