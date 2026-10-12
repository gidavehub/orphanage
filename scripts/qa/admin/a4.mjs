// Acceptance check for A4 (Giving; PLAN §6.2 A4).
//
//   node scripts/qa/admin/a4.mjs --base http://localhost:3001
//
//  1. A finance officer records a USD 100 cash gift through "Record a gift" (arrived, thank-you now):
//     a DN reference, status Acknowledged, a receipt number, donation_acknowledgement held.
//  2. A second gift gets the next receipt number (gap-free).
//  3. Putting the first gift all towards Education adds 10,000 minor USD to causeTotals/education and
//     the gift becomes Allocated.
//  4. The admin receipt page and the public receipt link (from the email) both show the receipt.
//  5. A content manager lands on Causes (never the ledger) and gets NoAccess on a gift.

import { createRequire } from "node:module";
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
const waitFor = async (fn, ms = 20000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.request.post(`${BASE}/api/dev/session?role=${role}`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(30000);
  return { ctx, page };
}

async function recordGift(page, name, amount) {
  await page.goto(`${BASE}/admin/giving?do=record-gift`, { waitUntil: "load" });
  await page.locator("#gift-name").waitFor();
  await page.locator("#gift-name").fill(name);
  await page.locator("#gift-email").fill(`${name.toLowerCase().replace(/\s+/g, ".")}@example.org`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "USD" }).check({ force: true }).catch(async () => page.getByText("USD", { exact: true }).click());
  await page.locator("#gift-amount").fill(String(amount));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record this gift" }).click();
  const ref = await waitFor(async () => {
    const t = await page.locator("body").innerText();
    return t.match(/Gift recorded · (DN-\d{4}-\d{4,})/)?.[1] ?? null;
  }, 30000);
  return ref ? `HVN-${ref}` : null;
}

console.log("\n1–2. Record two gifts with thank-yous");
const { ctx, page } = await as("finance_officer");
const ref1 = await recordGift(page, "Qa Donor One", 100);
expect(Boolean(ref1), `first gift recorded (${ref1})`);
const ref2 = await recordGift(page, "Qa Donor Two", 25);
expect(Boolean(ref2), `second gift recorded (${ref2})`);
const d1 = ref1 ? await waitFor(async () => unwrap((await store("donations"))[ref1])?.receipt && unwrap((await store("donations"))[ref1])) : null;
const d2 = ref2 ? await waitFor(async () => unwrap((await store("donations"))[ref2])?.receipt && unwrap((await store("donations"))[ref2])) : null;
expect(d1?.status === "acknowledged" && /^HVN-RC-\d{4}-\d{4,}$/.test(d1?.receipt?.number ?? ""), `first gift thanked with ${d1?.receipt?.number}`, d1?.status);
const n1 = Number(d1?.receipt?.number?.split("-").pop());
const n2 = Number(d2?.receipt?.number?.split("-").pop());
expect(n2 === n1 + 1, `receipt numbers are gap-free (${n1} → ${n2})`);
const mail = d1 ? await waitFor(async () => Object.entries(await store("emailOutbox")).find(([id]) => id === `donation_acknowledgement~${d1.receipt.number}`)) : null;
expect(Boolean(mail) && unwrap(mail[1]).status === "held", "donation_acknowledgement held", mail ? unwrap(mail[1]).status : "missing");

console.log("\n3. Put it towards Education");
const before = unwrap((await store("causeTotals")).education)?.USD?.raisedMinor ?? 0;
if (ref1) {
  await page.goto(`${BASE}/admin/giving/${ref1}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Allocate to programmes" }).click();
  await page.locator("select[id='target-0']").selectOption("programme:education");
  await page.getByRole("button", { name: "Save where it goes" }).click();
  const after = await waitFor(async () => {
    const v = unwrap((await store("causeTotals")).education)?.USD?.raisedMinor ?? 0;
    return v !== before ? v : null;
  });
  expect(after === before + 10000, `causeTotals/education USD +10,000 (${before} → ${after})`);
  const d = unwrap((await store("donations"))[ref1]);
  expect(d.status === "allocated", "the gift is Allocated", d.status);

  console.log("\n4. Receipts");
  await page.goto(`${BASE}/admin/giving/${ref1}/receipt`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  expect((await page.locator("body").innerText()).includes(d1?.receipt?.number ?? "∅"), "the admin receipt shows the number");
  const html = mail ? await readFile(path.join(DATA, "mailbox", `${mail[0]}.html`), "utf8").catch(() => "") : "";
  const link = html.match(/href="([^"]*\/donate\/receipt\/[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  expect(Boolean(link), "the email carries the receipt link");
  if (link) {
    const pub = await browser.newPage();
    const u = new URL(link, BASE);
    await pub.goto(`${BASE}${u.pathname}${u.search}`, { waitUntil: "load", timeout: 150000 });
    await pub.waitForTimeout(2000);
    expect((await pub.locator("body").innerText()).includes(d1?.receipt?.number ?? "∅"), "the public receipt link works");
    await pub.close();
  }
}
await ctx.close();

console.log("\n5. Content managers never see the gift ledger");
{
  const c = await as("content_manager");
  await c.page.goto(`${BASE}/admin/giving`, { waitUntil: "load" });
  await c.page.waitForURL(/\/admin\/giving\/causes$/, { timeout: 20000 }).catch(() => {});
  const text = await c.page.locator("main").innerText();
  expect(/\/admin\/giving\/causes$/.test(new URL(c.page.url()).pathname) && !/DN-\d{4}-\d{4}/.test(text) && !/Record a gift/.test(text), "content manager: Giving opens on Causes, no gifts shown", c.page.url());
  if (ref1) {
    await c.page.goto(`${BASE}/admin/giving/${ref1}`, { waitUntil: "load" });
    await c.page.waitForTimeout(2000);
    expect(/isn.t open to you/i.test(await c.page.locator("body").innerText()), "content manager: NoAccess on a gift");
  }
  await c.ctx.close();
}

await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A4 checks passed.");
process.exit(fails.length ? 1 : 0);
