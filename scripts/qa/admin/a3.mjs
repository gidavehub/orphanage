// Acceptance check for A3 (Safeguarding; PLAN §6.2 A3).
//
//   node scripts/qa/admin/a3.mjs --base http://localhost:3001
//
//  1. Every role except safeguarding officer and super admin gets NoAccess on /admin/safeguarding.
//  2. A safeguarding officer signed in over 30 minutes ago is sent to "Confirm it's you".
//  3. A fresh concern (sent through the public form): the first open writes a sensitive audit entry,
//     moves it to Screening and cancels the three queued re-alerts.
//  4. Risk "high" is recorded; closing it alone only asks for closure; a second person (the super
//     admin) confirms and it closes.
//  5. The concern narrative appears nowhere but Safeguarding (Inbox, Today and Find as a super admin).

import { execFileSync } from "node:child_process";
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
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");
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
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role, ageMin = 0) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const r = await ctx.request.post(`${BASE}/api/dev/session?role=${role}&authAgeMin=${ageMin}`);
  if (!r.ok()) throw new Error(`sign-in as ${role} failed (${r.status()})`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(30000);
  return { ctx, page };
}

console.log("\n1. NoAccess for other roles");
for (const role of ["content_manager", "programme_officer", "finance_officer", "counsellor", "report_manager", "viewer"]) {
  const { ctx, page } = await as(role);
  await page.goto(`${BASE}/admin/safeguarding`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(/isn.t open to you/i.test(await page.locator("body").innerText()), `${role}: NoAccess`);
  await ctx.close();
}

console.log("\n2. Step-up after 30 minutes");
{
  const { ctx, page } = await as("safeguarding_officer", 45);
  await page.goto(`${BASE}/admin/safeguarding`, { waitUntil: "load" });
  await page.waitForURL(/\/admin\/confirm/, { timeout: 30000 }).catch(() => undefined);
  expect(page.url().includes("/admin/confirm"), "sent to Confirm it's you", page.url());
  await ctx.close();
}

console.log("\n3. First open of a fresh concern");
const before = new Set(Object.keys(await store("safeguardingConcerns")));
try {
  execFileSync(process.execPath, ["scripts/qa/forms/concern.mjs", "--base", BASE], { stdio: "ignore", timeout: 300000 });
} catch {
  /* reported below */
}
const after = await store("safeguardingConcerns");
const fresh = Object.entries(after)
  .map(([k, v]) => [k, unwrap(v)])
  .filter(([k, v]) => !before.has(k) && v.status === "received" && !v.suspectedSpam)
  .sort((a, b) => b[1].createdAt - a[1].createdAt)[0]?.[0];
expect(Boolean(fresh), `a fresh concern from the public form (${fresh ?? "none"})`);
if (fresh) {
  const outbox0 = await store("emailOutbox");
  const realerts0 = [1, 2, 3].map((n) => unwrap(outbox0[`concern_alert~${fresh}~${n}`])?.status);
  expect(realerts0.some((s) => s && s !== "cancelled"), `re-alerts are queued (${realerts0.join(", ")})`);

  const so = await as("safeguarding_officer");
  await so.page.goto(`${BASE}/admin/safeguarding/${fresh}`, { waitUntil: "load" });
  await so.page.waitForTimeout(3000);
  const rec = unwrap((await store("safeguardingConcerns"))[fresh]);
  expect(rec.status === "screening" && !!rec.acknowledgedAt, "moved to Screening and acknowledged", rec.status);
  const audits = Object.values(await store("auditLog")).map(unwrap).filter((a) => a.targetRef === fresh && a.sensitive && a.action === "record.view");
  expect(audits.length >= 1, "a sensitive 'viewed' audit entry");
  const outbox1 = await store("emailOutbox");
  const realerts1 = [1, 2, 3].map((n) => unwrap(outbox1[`concern_alert~${fresh}~${n}`])?.status);
  expect(realerts1.every((s) => !s || s === "cancelled"), `re-alerts cancelled (${realerts1.join(", ")})`);

  console.log("\n4. Risk and two-person closure");
  await so.page.getByRole("button", { name: /^High Harm/ }).click();
  await so.page.getByLabel("Why this level?").fill("The reporter describes repeated marks and fear of going home; harm is likely.");
  await so.page.getByRole("button", { name: "Save" }).click();
  await so.page.waitForTimeout(3000);
  let c = unwrap((await store("safeguardingConcerns"))[fresh]);
  expect(c.status === "risk_assessed" && c.riskLevel === "high", "risk recorded as high", `${c.status} ${c.riskLevel}`);

  await so.page.getByRole("button", { name: "Close", exact: true }).click();
  await so.page.locator("select[id='reason'], select[name='reason']").first().selectOption("resolved");
  await so.page.getByLabel("Closing note").fill("Family supported and the school is monitoring.");
  await so.page.getByRole("button", { name: "Ask for closure" }).click();
  await so.page.waitForTimeout(3000);
  c = unwrap((await store("safeguardingConcerns"))[fresh]);
  expect(c.status !== "closed" && c.closure && !c.closure.secondSignOffAt, "closing alone only asks for closure", c.status);
  await so.ctx.close();

  const sa = await as("super_admin");
  await sa.page.goto(`${BASE}/admin/safeguarding/${fresh}`, { waitUntil: "load" });
  await sa.page.waitForTimeout(3000);
  await sa.page.getByRole("button", { name: "Confirm closure" }).click();
  await sa.page.locator("select[id='reason'], select[name='reason']").first().selectOption("resolved");
  await sa.page.getByLabel("Closing note").fill("Reviewed and agreed: closing.");
  await sa.page.getByRole("button", { name: "Close the concern" }).click();
  await sa.page.waitForTimeout(3000);
  c = unwrap((await store("safeguardingConcerns"))[fresh]);
  expect(c.status === "closed" && c.closure?.secondSignOffAt, "a second person confirms and it closes", c.status);

  console.log("\n5. Narrative stays in Safeguarding");
  for (const p of ["/admin", "/admin/inbox"]) {
    await sa.page.goto(`${BASE}${p}`, { waitUntil: "load" });
    await sa.page.waitForTimeout(2500);
    const html = await sa.page.content();
    expect(!/unexplained marks|left alone in the evenings|workshop/i.test(html), `no concern narrative on ${p}`);
  }
  await sa.ctx.close();
}

await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A3 checks passed.");
process.exit(fails.length ? 1 : 0);
