// Acceptance check for the rest of A4 (PLAN §6.2 A4): causes, sponsorship, Settings › Giving,
// yearly summaries, receipt printing and who sees single gifts.
//
//   node scripts/qa/admin/a4b.mjs --base http://localhost:3001
//
//  1. Finance sets the Education goal to USD 5,000 and ticks it as checked: the cause is stamped
//     verified, and /donate/education shows "of USD 5,000".
//  2. A content manager forcing a goal change gets the forbidden message and nothing changes.
//  3. A programme officer drafts a sponsorship profile that names a child; a content manager can't put
//     it live; after rewording it goes live and shows on /get-involved/sponsor, and the server refuses
//     a name on the live profile. The practice profile is archived at the end.
//  4. Programme-level updates refuse a name and accept programme news.
//  5. Switching GMD to card in Settings › Giving persists to settings/payment (then back to bank).
//  6. The admin receipt prints on one A4 page.
//  7. A programme officer (totals only) cannot open the ledger or a gift; Giving sends them to causes.
//  8. Finance checks the 2025 yearly summary and puts it live.

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
const toastText = async (page) => (await page.locator("ol[aria-live]").allInnerTexts().catch(() => [])).join(" | ");
/** Waits until React has hydrated the element (typing earlier is lost or merged). */
/** Waits for the visible copy of `selector` to hydrate (React may keep the previous route hidden in the DOM). */
async function ready(page, selector) {
  await page.locator(`${selector}:visible`).first().waitFor();
  await page.waitForFunction((sel) => {
    const el = [...document.querySelectorAll(sel)].find((x) => x.offsetParent !== null);
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
  }, selector);
}
/** Ticks a checkbox once React has hydrated (a tick before hydration is reset). */
async function tick(page, selector) {
  for (let i = 0; i < 20; i++) {
    const box = page.locator(selector);
    if (await box.isChecked()) {
      await page.waitForTimeout(400);
      if (await box.isChecked()) return true;
    }
    await box.click({ force: true });
    await page.waitForTimeout(300);
  }
  return false;
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.request.post(`${BASE}/api/dev/session?role=${role}`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(30000);
  return { ctx, page };
}

/* 1 ─ Finance sets and checks the goal */
console.log("\n1. Finance edits and checks the Education goal");
const fo = await as("finance_officer");
{
  const { page } = fo;
  await page.goto(`${BASE}/admin/giving/causes/education`, { waitUntil: "load" });
  await ready(page, "#goal");
  await page.locator("#goal").fill("5000");
  await tick(page, "#verified");
  await page.getByRole("button", { name: "Put it live" }).click();
  const rec = await waitFor(async () => {
    const r = unwrap((await store("causes")).education);
    return r?.published?.goal === 5000 && r.published.verification?.status === "verified" ? r : null;
  });
  expect(Boolean(rec), "education goal 5,000 is live and verified");
  expect(Boolean(rec?.published?.verification?.verifiedBy && rec?.published?.verification?.verifiedAt), "the check is stamped with who and when");
  const pub = await browser.newPage();
  await pub.goto(`${BASE}/donate/education`, { waitUntil: "load", timeout: 150000 });
  await pub.waitForTimeout(1500);
  expect(/of USD\s?5,000/.test(await pub.locator("main").innerText()), "/donate/education shows “of USD 5,000”");
  await pub.close();
}

/* 2 ─ Content manager cannot change money */
console.log("\n2. A content manager can't change the goal");
const cm = await as("content_manager");
{
  const { page } = cm;
  await page.goto(`${BASE}/admin/giving/causes/education`, { waitUntil: "load" });
  await ready(page, "#goal");
  expect(await page.locator("#goal").isDisabled(), "the goal field is locked for content managers");
  // Simulate a tampered client: unlock the fieldset and change the goal.
  await page.evaluate(() => document.querySelectorAll("fieldset[disabled]").forEach((f) => f.removeAttribute("disabled")));
  await page.locator("#goal").fill("9999");
  await page.getByRole("button", { name: "Put it live" }).click();
  const t = await waitFor(async () => {
    const x = await toastText(page);
    return /finance team/i.test(x) ? x : null;
  }, 15000);
  expect(Boolean(t), "the forbidden message names the finance team", await toastText(page));
  expect(unwrap((await store("causes")).education)?.published?.goal === 5000, "the goal is unchanged");
}

/* 3 ─ Sponsorship profile with a name */
console.log("\n3. Sponsorship: the safety check");
const po = await as("programme_officer");
let code = null;
{
  const { page } = po;
  await page.goto(`${BASE}/admin/giving/sponsorship/new`, { waitUntil: "load" });
  await ready(page, "#description");
  await page.locator("#description").fill("Awa needs school fees and a uniform for the coming term so she can stay in school.");
  await page.locator("#amount").fill("120");
  expect(/thing.? to change/i.test(await page.locator("main").innerText()), "the editor flags the name as you type");
  await page.getByRole("button", { name: "Save as a draft" }).click();
  await page.waitForURL(/\/sponsorship\/HVN-SP-\d{4}$/, { timeout: 30000 }).catch(() => {});
  code = page.url().match(/HVN-SP-\d{4,}/)?.[0] ?? null;
  expect(Boolean(code), `draft saved as ${code}`);
}
if (code) {
  const { page } = cm;
  await page.goto(`${BASE}/admin/giving/sponsorship/${code}`, { waitUntil: "load" });
  await ready(page, "#reviewed");
  await tick(page, "#reviewed");
  const btn = page.getByRole("button", { name: "Put it live" });
  expect(await btn.isDisabled(), "Put it live is disabled while there is something to check");
  expect(unwrap((await store("sponsorProfiles"))[code])?.status === "draft", "the profile stays a draft");

  await page.goto(`${BASE}/admin/giving/sponsorship/${code}`, { waitUntil: "load" });
  await ready(page, "#description");
  await page.locator("#description").fill("School fees and a uniform for a girl aged 12, so she can finish primary school.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await waitFor(async () => (unwrap((await store("sponsorProfiles"))[code])?.need?.description ?? "").startsWith("School fees"));
  await page.goto(`${BASE}/admin/giving/sponsorship/${code}`, { waitUntil: "load" });
  await ready(page, "#reviewed");
  await tick(page, "#reviewed");
  await page.getByRole("button", { name: "Put it live" }).click();
  const live = await waitFor(async () => {
    const p = unwrap((await store("sponsorProfiles"))[code]);
    return p?.status === "published" && p.review ? p : null;
  });
  expect(Boolean(live), "after rewording, it goes live with the reviewer recorded");
  const pub = await browser.newPage();
  await pub.goto(`${BASE}/get-involved/sponsor`, { waitUntil: "load", timeout: 150000 });
  await pub.waitForTimeout(1500);
  expect((await pub.locator("main").innerText()).includes(code), "the profile shows on /get-involved/sponsor");
  await pub.close();

  // The server runs the same check: a live profile refuses words with a name in them.
  await page.goto(`${BASE}/admin/giving/sponsorship/${code}`, { waitUntil: "load" });
  await ready(page, "#description");
  await page.locator("#description").fill("Mariama needs school fees and a uniform so she can finish primary school.");
  await page.getByRole("button", { name: "Save changes" }).click();
  const refused = await waitFor(async () => {
    const x = await toastText(page);
    return /must pass the safety check/i.test(x) ? x : null;
  }, 15000);
  expect(Boolean(refused), "the server refuses a name on a live profile", await toastText(page));
  expect((unwrap((await store("sponsorProfiles"))[code])?.need?.description ?? "").startsWith("School fees"), "the live words are unchanged");
}

/* 4 ─ Updates */
console.log("\n4. Programme-level updates");
if (code) {
  const { page } = po;
  await page.goto(`${BASE}/admin/giving/sponsorship/${code}`, { waitUntil: "load" });
  await ready(page, "#update");
  await page.locator("#update:visible").fill("Fatou passed her exams in Brikama this term.");
  expect(await page.getByRole("button", { name: "Post the update" }).isDisabled(), "an update naming a child or town can't be posted");
  await page.locator("#update:visible").fill("This term, 40 children in the education programme sat their end-of-year exams.");
  await page.getByRole("button", { name: "Post the update" }).click();
  const ok = await waitFor(async () => {
    const raw = await readFile(path.join(DATA, "db", "sponsorProfiles", code, "updates", "_docs.json"), "utf8").catch(() => "");
    return raw.includes("40 children");
  });
  expect(Boolean(ok), "a programme update is posted");
}

/* 5 ─ Settings › Giving */
console.log("\n5. Settings › Giving");
{
  const { page } = fo;
  const pick = async (label) => {
    await page.goto(`${BASE}/admin/settings/giving`, { waitUntil: "load" });
    await page.getByRole("radiogroup", { name: "How GMD gifts are paid" }).getByRole("radio", { name: label }).click({ force: true });
    await page.getByRole("button", { name: "Save how people pay" }).click();
  };
  await pick("Card");
  const card = await waitFor(async () => unwrap((await store("settings")).payment)?.routes?.GMD === "stripe");
  expect(Boolean(card), "GMD → card is saved to settings/payment");
  await pick("Mobile money or bank");
  const back = await waitFor(async () => unwrap((await store("settings")).payment)?.routes?.GMD === "local");
  expect(Boolean(back), "and back to mobile money or bank");
}

/* 6 ─ Receipt prints on one page */
console.log("\n6. Receipt printing");
{
  const donations = await store("donations");
  const ref = Object.entries(donations)
    .map(([id, d]) => [id, unwrap(d)])
    .filter(([, d]) => d?.receipt?.number)
    .sort((a, b) => (b[1].createdAt ?? 0) - (a[1].createdAt ?? 0))[0]?.[0];
  if (ref) {
    const { page } = fo;
    await page.goto(`${BASE}/admin/giving/${ref}/receipt`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages === 1, `the receipt prints on one A4 page (${pages})`);
    await page.emulateMedia({ media: "screen" });
  } else expect(false, "a receipted gift exists to print");
}

/* 7 ─ Totals-only roles */
console.log("\n7. Programme officers see totals, not gifts");
{
  const { page } = po;
  await page.goto(`${BASE}/admin/giving`, { waitUntil: "load" });
  await page.waitForURL(/\/admin\/giving\/causes$/, { timeout: 20000 }).catch(() => {});
  expect(/\/admin\/giving\/causes$/.test(new URL(page.url()).pathname), "Giving sends them to Causes", page.url());
  const anyRef = Object.keys(await store("donations"))[0];
  await page.goto(`${BASE}/admin/giving/${anyRef}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(/isn.t open to you/i.test(await page.locator("body").innerText()), "a single gift is NoAccess");
}

/* 8 ─ Yearly summary */
console.log("\n8. Yearly summary");
{
  const { page } = fo;
  await page.goto(`${BASE}/admin/giving/where-it-goes/fy-2025`, { waitUntil: "load" });
  await ready(page, "#verified");
  await tick(page, "#verified");
  await page.getByRole("button", { name: "Put it live" }).click();
  const s = await waitFor(async () => {
    const r = unwrap((await store("allocationSummaries"))["fy-2025"]);
    return r?.published?.verification?.status === "verified" ? r : null;
  });
  expect(Boolean(s), "the 2025 summary is checked and live");
}

/* Clean up: archive the practice profile so the public page stays tidy. */
if (code) {
  const { page } = cm;
  await page.goto(`${BASE}/admin/giving/sponsorship/${code}`, { waitUntil: "load" });
  await ready(page, "#description");
  await page.getByRole("button", { name: "Archive" }).click();
  await waitFor(async () => unwrap((await store("sponsorProfiles"))[code])?.status === "archived");
}

await Promise.all([fo.ctx.close(), cm.ctx.close(), po.ctx.close()]);
await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A4b checks passed.");
process.exit(fails.length ? 1 : 0);
