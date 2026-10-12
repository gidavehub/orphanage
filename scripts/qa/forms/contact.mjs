// Acceptance check for the Contact form (P4; public-pages §3.8, data-model §4.4; PLAN D81, D94,
// D104, D107). Drives /contact in Chrome, then reads the practice store under .data/.
//
//   node scripts/qa/forms/contact.mjs --base http://localhost:3001
//
// 1. A general message: HVN-CM reference and "Thank you, {first name}" on screen, the record stored,
//    contact_confirmation held with the template subject, a mailbox file.
// 2. Prefill from ?category=programme_info&programme=education&subject=…
// 3. "Report a concern" replaces the form with the safeguarding redirect (nothing can be sent);
//    "Privacy or data request" points to /privacy/request.
// 4. Honeypot filled: a success-looking answer, nothing stored (D94).
// Exit code 1 on any failed expectation. Never prints secrets.

import { createRequire } from "node:module";
import { access, readFile } from "node:fs/promises";
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
  contact_confirmation: /^We've received your message \(HVN-CM-\d{4}-\d{4,}\)$/,
  staff_alert: /^Haven team: something new for you$/,
};
const CM_RE = /HVN-CM-\d{4}-\d{4,}/;

async function store(collection) {
  try {
    return JSON.parse(await readFile(path.join(DATA, "db", collection, "_docs.json"), "utf8"));
  } catch {
    return {};
  }
}
async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
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

const html = await fetch(`${BASE}/contact`).then((r) => r.text()).catch(() => "");
if (!/<title>[^<]*Haven/.test(html)) {
  console.log(`  ✗ ${BASE}/contact is not Haven (check --base)`);
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
async function open(query = "") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/contact${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!document.querySelector("#category"), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  return { context, page, errors };
}
async function fill(page, { subject = "A question about volunteering", tag = randomUUID().slice(0, 6) } = {}) {
  await page.locator("#fullName").fill("Aminata QA Sender");
  await page.locator("#email").fill("qa.contact@example.org");
  await page.locator("#phone").fill("+220 700 9999");
  await page.locator("#country").selectOption("gm");
  await page.locator("#subject").fill(subject);
  await page.locator("#message").fill(`Hello, I would like to know more about how I can help this year. Reference ${tag}.`);
  await page.locator('input[name="consent"]').check({ force: true });
  await page.waitForTimeout(2600);
}

/* ── 1. A general message ─────────────────────────────────────────────────────────────────────── */
console.log("\n1. General message");
{
  const before = Object.keys(await store("contactMessages")).length;
  const { context, page, errors } = await open();
  await page.getByRole("button", { name: "Send Message" }).click();
  expect(await page.getByText("There's a problem").first().isVisible(), "sending an empty form shows the error summary");
  await page.locator("#category").selectOption("general");
  await fill(page);
  await page.getByRole("button", { name: "Send Message" }).click();
  await page.getByRole("status").filter({ hasText: /Thank You, Aminata/ }).first().waitFor({ timeout: 60000 });
  const ref = ((await page.locator("main").innerText()).match(CM_RE) ?? [""])[0];
  expect(CM_RE.test(ref), `HVN-CM reference on screen (${ref})`);
  expect(await page.getByText(/We usually reply within/).first().isVisible(), "the reply time is shown");
  expect(errors.length === 0, "no page errors", errors);
  const docs = await store("contactMessages");
  const doc = docs[ref];
  expect(Object.keys(docs).length === before + 1 && !!doc, "one contactMessages doc written");
  if (doc) expect(doc.category === "general" && doc.email === "qa.contact@example.org" && doc.consent?.noticeVersion, "category, email and consent stamp stored");
  const conf = await waitForOutbox(`contact_confirmation~${ref}`);
  expect(conf?.status === "held", `contact_confirmation held (${conf?.status})`);
  expect(SUBJECT.contact_confirmation.test(conf?.subject ?? ""), `subject matches the template (${conf?.subject})`);
  expect(await exists(path.join(DATA, "mailbox", `contact_confirmation~${ref}.html`)), "mailbox file written");
  const staff = await waitForOutbox(`staff_alert~${ref}`, 4000);
  if (staff) expect(SUBJECT.staff_alert.test(staff.subject ?? ""), `staff_alert subject is fixed (${staff.subject})`);
  await context.close();
}

/* ── 2. Prefill ───────────────────────────────────────────────────────────────────────────────── */
console.log("\n2. Prefill from the URL");
{
  const { context, page } = await open("?category=programme_info&programme=education&subject=School%20fees%20question");
  await page.waitForFunction(() => (document.querySelector("#category"))?.value === "programme_info", null, { timeout: 15000 }).catch(() => {});
  expect((await page.locator("#category").inputValue()) === "programme_info", "category prefilled");
  expect((await page.locator("#programme").inputValue()) === "education", "programme select shown and prefilled");
  expect((await page.locator("#subject").inputValue()) === "School fees question", "subject prefilled");
  await page.locator("#programme").selectOption("");
  await context.close();
}

/* ── 3. Redirect choices ──────────────────────────────────────────────────────────────────────── */
console.log("\n3. Concern and privacy choices");
{
  const { context, page } = await open();
  await page.locator("#category").selectOption("concern");
  await page.waitForTimeout(400);
  expect(await page.getByText("Please use our confidential concern form").isVisible(), "the concern choice shows the safeguarding redirect");
  expect((await page.getByRole("button", { name: "Send Message" }).count()) === 0 && (await page.locator("#message").count()) === 0, "the form cannot be sent from here");
  const href = await page.locator("form").getByRole("link", { name: "Report a Concern" }).getAttribute("href");
  expect(href === "/report-a-concern", `it links to /report-a-concern (${href})`);
  await page.locator("#category").selectOption("privacy");
  await page.waitForTimeout(400);
  const p = await page.getByRole("link", { name: "Make a Privacy Request" }).getAttribute("href");
  expect(p === "/privacy/request", `the privacy choice links to /privacy/request (${p})`);
  await context.close();
  const { context: c2, page: p2 } = await open("?category=concern");
  await p2.waitForTimeout(800);
  expect(await p2.getByText("Please use our confidential concern form").isVisible(), "?category=concern opens straight on the redirect");
  await c2.close();
}

/* ── 4. Honeypot ──────────────────────────────────────────────────────────────────────────────── */
console.log("\n4. Honeypot filled → nothing stored");
{
  const before = Object.keys(await store("contactMessages")).length;
  const { context, page } = await open();
  await page.locator("#category").selectOption("media");
  await fill(page, { subject: "Bot message" });
  await page.evaluate(() => {
    const el = document.querySelector('input[name="company_website"]');
    if (el) el.value = "https://spam.example";
  });
  await page.getByRole("button", { name: "Send Message" }).click();
  await page.getByRole("status").filter({ hasText: /Thank You/ }).first().waitFor({ timeout: 60000 });
  expect(!CM_RE.test(await page.locator("main").innerText()), "a success-looking answer with no reference");
  await sleep(1500);
  expect(Object.keys(await store("contactMessages")).length === before, "no contactMessages doc written");
  await context.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} check(s) failed.` : "\nAll contact checks passed.");
process.exit(fails.length ? 1 : 0);
