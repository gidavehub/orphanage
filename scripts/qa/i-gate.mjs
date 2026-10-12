// Phase I acceptance items not covered by the selftests and the other scripts (PLAN §6.3).
//
//   node scripts/qa/i-gate.mjs --base http://localhost:3100
//
//  I3  Settings › Emails: editing the greeting updates the preview; private emails refuse words about
//      the need; saving stores the wording and "Haven's standard words" removes it again.
//  I2  /donate/manage explains card management is being set up (no Stripe); a receipt link from a
//      thank-you email opens the receipt and a tampered one doesn't; bad portal and pay links are
//      sent somewhere sensible.
//  I4  /api/cron/editorial: 401 without the bearer; with it, a JSON answer (skipped or a draft).
//  I7  Without keys, no Turnstile widget and no analytics script on public pages; the admin never
//      loads analytics.

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const BASE = (process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:3100").replace(/\/+$/, "");
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
    await new Promise((r) => setTimeout(r, 400));
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

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
await ctx.request.post(`${BASE}/api/dev/session?role=super_admin`);
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(150000);

/* I3 ───────────────────────────────────────────────────────────────── */
console.log("\nI3. Emails Haven sends");
await page.goto(`${BASE}/admin/settings/emails/support_confirmation`, { waitUntil: "load" });
await hydrated(page, "#copy-greeting");
const frame = () => page.locator("main iframe").first().getAttribute("srcdoc");
await page.locator("#copy-greeting").fill("Dear {firstName},");
const updated = await waitFor(async () => ((await frame())?.includes("Dear Amina,") ? true : null));
expect(Boolean(updated), "the preview shows the new greeting with the sample name");
await page.locator("#copy-main").fill("We have your request about school fees for your daughter.");
const refused = await waitFor(async () => ((await page.locator("#copy-main-error").count()) ? page.locator("#copy-main-error").innerText() : null));
expect(Boolean(refused) && (await page.getByRole("button", { name: "Save the wording" }).isDisabled()), "a private email refuses words about the need", refused);
await page.locator("#copy-main").fill("");
await waitFor(async () => ((await page.locator("#copy-main-error").count()) === 0 ? true : null));
await page.getByRole("button", { name: "Save the wording" }).click();
const saved = await waitFor(async () => unwrap((await store("settings")).emailCopy)?.support_confirmation?.greeting === "Dear {firstName}," || null);
expect(Boolean(saved), "saving stores the wording in settings/emailCopy");
await page.goto(`${BASE}/admin/settings/emails`, { waitUntil: "load" });
expect((await page.locator('a[data-template="support_confirmation"]').innerText()).includes("Your wording"), "the list marks it “Your wording”");
await page.goto(`${BASE}/admin/settings/emails/support_confirmation`, { waitUntil: "load" });
await hydrated(page, "#copy-greeting");
await page.getByRole("button", { name: "Use Haven’s standard words" }).click();
await page.getByRole("button", { name: "Save the wording" }).click();
const cleared = await waitFor(async () => (!unwrap((await store("settings")).emailCopy)?.support_confirmation ? true : null));
expect(Boolean(cleared), "“Use Haven’s standard words” removes it again");

/* I2 ───────────────────────────────────────────────────────────────── */
console.log("\nI2. Donor self-service");
const anon = await browser.newContext();
const ap = await anon.newPage();
await ap.goto(`${BASE}/donate/manage`, { waitUntil: "load" });
expect(/being set up/.test(await ap.locator("main").innerText()), "without card payments, /donate/manage says how to change a gift");
// The thank-you email's variables are sealed, so mint the same receipt link with the local secret.
const envLocal = await readFile(".env.local", "utf8").catch(() => "");
const hmacSecret = envLocal.match(/^\s*HAVEN_HMAC_SECRET\s*=\s*"?([^"\r\n]+)"?\s*$/m)?.[1] ?? null;
const thanked = Object.entries(await store("donations")).map(([id, d]) => [id, unwrap(d)]).find(([, d]) => d.receipt?.number && !d.isSample);
if (hmacSecret && thanked) {
  const { createHmac } = await import("node:crypto");
  const encoded = Buffer.from(JSON.stringify({ p: "receipt", sub: thanked[0], exp: Date.now() + 3_600_000 }), "utf8").toString("base64url");
  const token = `${encoded}.${createHmac("sha256", hmacSecret).update(`haven.token.v1.${encoded}`).digest().toString("base64url")}`;
  const u = new URL(`${BASE}/donate/receipt/${encodeURIComponent(thanked[0])}?t=${encodeURIComponent(token)}`);
  const good = await ap.goto(`${BASE}${u.pathname}${u.search}`, { waitUntil: "load" });
  // The receipt streams in (Suspense); it can land just after the load event.
  await ap.waitForFunction(() => /HVN-RC-\d{4}-\d{4}/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 10000 }).catch(() => undefined);
  const goodText = await ap.locator("main").innerText();
  expect(good?.status() === 200 && /HVN-RC-\d{4}-\d{4}/.test(goodText), "a receipt link from a thank-you email opens the receipt");
  const t = u.searchParams.get("t");
  const tampered = `${t.slice(0, -2)}${t.endsWith("A") ? "B" : "A"}${t.slice(-1)}`;
  await ap.goto(`${BASE}${u.pathname}?t=${encodeURIComponent(tampered)}`, { waitUntil: "load" });
  expect(!/HVN-RC-\d{4}-\d{4}/.test(await ap.locator("main").innerText()), "a tampered receipt link shows no receipt");
} else console.log("  · no thanked gift or no HAVEN_HMAC_SECRET in .env.local: skipped");
const portal = await anon.request.get(`${BASE}/api/stripe/portal?t=bad`, { maxRedirects: 0 });
expect(portal.status() === 303 && /\/donate\/manage\?expired=1/.test(portal.headers().location ?? ""), "a bad portal link goes back to /donate/manage");
const pay = await anon.request.get(`${BASE}/api/donations/pay?t=bad`, { maxRedirects: 0 });
expect(pay.status() === 303 && /\/link-expired/.test(pay.headers().location ?? ""), "a bad payment link goes to /link-expired");

/* I4 ───────────────────────────────────────────────────────────────── */
console.log("\nI4. Editorial cron");
expect((await anon.request.get(`${BASE}/api/cron/editorial`)).status() === 401, "/api/cron/editorial without the bearer → 401");
const envText = await readFile(".env.local", "utf8").catch(() => "");
const cron = envText.match(/^\s*CRON_SECRET\s*=\s*"?([^"\r\n]+)"?\s*$/m)?.[1];
if (cron) {
  const r = await anon.request.get(`${BASE}/api/cron/editorial`, { headers: { authorization: `Bearer ${cron}` } });
  const j = await r.json();
  expect(r.status() === 200 && j.ok === true && ("skipped" in j || "created" in j || j.locked), `with the bearer it answers (${j.skipped ?? (j.created ? "draft made" : j.reason ?? "ran")})`);
}

/* I7 ───────────────────────────────────────────────────────────────── */
console.log("\nI7. Analytics and Turnstile without keys");
const scripts = [];
ap.on("request", (r) => (/_vercel\/insights|va\.vercel-scripts|challenges\.cloudflare/.test(r.url()) ? scripts.push(r.url()) : null));
await ap.goto(`${BASE}/contact`, { waitUntil: "load" });
await ap.waitForTimeout(1500);
expect((await ap.locator('input[name="cf-turnstile-response"]').count()) === 0, "no Turnstile widget without keys (the form still works)");
await page.goto(`${BASE}/admin`, { waitUntil: "load" });
page.on("request", (r) => (/_vercel\/insights|va\.vercel-scripts/.test(r.url()) ? scripts.push(`admin:${r.url()}`) : null));
await page.waitForTimeout(1500);
expect(scripts.length === 0, "no analytics or challenge scripts load (public without Vercel, and never in the admin)", scripts.join(", "));

await browser.close();
console.log(fails.length ? `\n${fails.length} failed:\n - ${fails.join("\n - ")}` : "\nAll I-gate checks passed.");
process.exit(fails.length ? 1 : 0);
