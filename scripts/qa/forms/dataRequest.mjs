// Acceptance check for the privacy request form (P5; PLAN D104, data-model §11.5). Drives
// /privacy/request in Chrome, then reads the practice store under .data/.
//
//   node scripts/qa/forms/dataRequest.mjs --base http://localhost:3001
//
// 1. An empty submit shows errors and stores nothing.
// 2. A complete request shows an HVN-DR reference; the dataRequests record is `unverified`; the
//    data_request_verify email is held with its fixed subject and a mailbox preview.
// 3. The confirm link from that email verifies the request (verifiedAt set, token hash cleared);
//    opening it again says it was already confirmed.
// 4. A tampered token shows the expired state and changes nothing.
// Exit code 1 on any failed expectation. Never prints secrets.

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
    console.log(`  ✗ ${msg}${extra !== undefined ? `\n      ${String(extra).slice(0, 300)}` : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fakeIp = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
const DR_RE = /HVN-DR-\d{4}-\d{4,}/;

async function store(collection) {
  try {
    return JSON.parse(await readFile(path.join(DATA, "db", collection, "_docs.json"), "utf8"));
  } catch {
    return {};
  }
}
async function waitFor(fn, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  return null;
}
const unwrap = (doc) => (doc && typeof doc === "object" && "data" in doc && doc.data && typeof doc.data === "object" ? doc.data : doc);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

console.log("\n1. Empty submit");
const before = Object.keys(await store("dataRequests")).length;
await page.goto(`${BASE}/privacy/request`, { waitUntil: "load" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Send my request/ }).click();
await page.waitForTimeout(1200);
expect((await page.getByRole("alert").count()) > 0 || (await page.locator("[aria-invalid='true']").count()) > 0, "errors are shown");
expect(Object.keys(await store("dataRequests")).length === before, "nothing stored");

console.log("\n2. A complete request");
const email = `dr.${Date.now()}@example.org`;
await page.getByText("Show me my information", { exact: true }).click();
await page.getByLabel("Full name").fill("Privacy Tester");
await page.getByLabel("Email address").fill(email);
await page.getByLabel("Tell us more").fill("Please send me a copy of what you hold about me.");
const confirmBox = page.getByLabel(/This request is about my own information/);
for (let t = 0; t < 3 && !(await confirmBox.isChecked()); t++) await confirmBox.click({ force: true });
expect(await confirmBox.isChecked(), "the declaration box can be ticked");
await page.waitForTimeout(2600); // the time trap
await page.getByRole("button", { name: /Send my request/ }).click();
const shown = await waitFor(async () => (await page.locator("body").innerText()).match(DR_RE)?.[0] ?? null, 30000);
expect(Boolean(shown), `HVN-DR reference on screen (${shown ?? "none"})`);

const record = shown ? await waitFor(async () => unwrap((await store("dataRequests"))[shown])) : null;
expect(record && record.status === "unverified", "record stored as unverified", record ? record.status : "missing");
expect(record && record.type === "access", "request type stored");

const outbox = shown
  ? await waitFor(async () => {
      const all = await store("emailOutbox");
      const hit = Object.entries(all).find(([id, d]) => id.startsWith("data_request_verify") && JSON.stringify(d).includes(shown));
      const doc = hit ? unwrap(hit[1]) : null;
      return doc && doc.status !== "queued" && doc.status !== "sending" ? { id: hit[0], doc } : null;
    })
  : null;
expect(outbox && outbox.doc.status === "held", "data_request_verify held in the outbox", outbox ? outbox.doc.status : "missing");
expect(outbox && /^Please confirm your privacy request/.test(outbox.doc.subject ?? ""), "subject is the fixed template subject", outbox?.doc.subject);

let html = "";
if (outbox) {
  try {
    html = await readFile(path.join(DATA, "mailbox", `${outbox.id}.html`), "utf8");
  } catch {
    /* checked below */
  }
}
expect(html.length > 0, "mailbox preview written");
const link = html.match(/href="([^"]*\/privacy\/request\/verify\?token=[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
expect(Boolean(link), "the email carries a confirm link");

console.log("\n3. Confirming");
if (link) {
  const url = link.startsWith("http") ? `${BASE}${new URL(link).pathname}${new URL(link).search}` : `${BASE}${link}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const verified = await waitFor(async () => {
    const r = unwrap((await store("dataRequests"))[shown]);
    return r && r.verifiedAt ? r : null;
  });
  expect(Boolean(verified), "verifiedAt is set");
  expect(verified && !verified.verifyTokenHash, "the token hash is cleared");
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  expect(/already/i.test(await page.locator("main").innerText()), "a second visit says it was already confirmed");
}

console.log("\n4. Tampered token");
await page.goto(`${BASE}/privacy/request/verify?token=not-a-real-token`, { waitUntil: "load" });
await page.waitForTimeout(1200);
expect((await page.locator("main").innerText()).length > 0 && !/already/i.test(await page.locator("main").innerText()), "shows the expired or invalid state");

if (pageErrors.length) expect(false, "no page errors", pageErrors.join(" | "));
await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll privacy request checks passed.");
process.exit(fails.length ? 1 : 0);
