// Acceptance check for A7 (PLAN §6.2 A7): the website studio, key information, before launch and
// the photo library.
//
//   node scripts/qa/admin/a7.mjs --base http://localhost:3001
//
//  1. As a content manager, /admin/website/home shows the page in an iframe with the preview banner.
//  2. Editing a hero line saves a draft that a signed-out browser doesn't see.
//  3. "Put these changes live" shows it to everyone on the next request (then it's put back).
//  4. A second tab with a stale version gets the conflict panel instead of overwriting.
//  5. A JPEG with GPS uploads as public/media/<id>/<sha12>.webp without EXIF and is served by /m (200).
//  6. Withdrawing its consent makes that URL answer 410.
//  7. The before-launch checklist lists placeholders, and "Hide them" hides unchecked figures on /impact
//     (then it's switched back).

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const sharp = require("sharp");
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

/** Opens "Welcome slideshow" and its first slide; returns the eyebrow field. */
async function openHeroEyebrow(p) {
  await hydrated(p, "nav[aria-label='Sections'] button");
  await p.locator("nav[aria-label='Sections'] button", { hasText: "Welcome slideshow" }).first().click();
  const field = p.locator("dialog[open] #f-slides-0-eyebrow");
  const toggle = p.locator("dialog[open] fieldset button[aria-expanded]").first();
  await toggle.waitFor({ timeout: 60000 });
  if (!(await field.count())) await toggle.click();
  await field.waitFor();
  await p.waitForFunction(() => {
    const el = document.querySelector("dialog[open] #f-slides-0-eyebrow");
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
  });
  return field;
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.request.post(`${BASE}/api/dev/session?role=content_manager`);
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(150000);
page.setDefaultTimeout(45000);
const anon = await browser.newContext();
const publicText = async (p) => {
  const pg = await anon.newPage();
  await pg.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 150000 });
  const t = await pg.locator("main").innerText();
  await pg.close();
  return t;
};
/** The server-rendered HTML (includes text that hasn't scrolled into view yet). */
const publicHtml = async (p) => (await anon.request.get(`${BASE}${p}`)).text();

/* 1 */
console.log("\n1. The studio shows the page in Draft Mode");
await page.goto(`${BASE}/admin/website/home`, { waitUntil: "load" });
const frameEl = page.locator("iframe[title^='Preview']");
await frameEl.waitFor();
const frame = await waitFor(async () => page.frames().find((f) => f.url().includes("studio=1")), 60000);
const banner = frame ? await waitFor(async () => (await frame.locator('[aria-label="Preview"]').count()) > 0, 60000) : null;
expect(Boolean(frame) && Boolean(banner), "the preview iframe shows the page with the preview banner");

// A leftover hero draft from an earlier run would read as "the original": undo it first.
if (unwrap((await store("siteContent"))["home.hero"])?.draft) {
  await hydrated(page, "nav[aria-label='Sections'] button");
  await page.getByRole("button", { name: "Review & put live" }).click();
  const row = page.locator("dialog[open] li", { hasText: "Welcome slideshow" }).first();
  await row.getByRole("button", { name: "Undo this change" }).click();
  await waitFor(async () => !unwrap((await store("siteContent"))["home.hero"])?.draft);
  await page.goto(`${BASE}/admin/website/home`, { waitUntil: "load" });
}

/* 2 */
console.log("\n2. A hero edit saves a draft only staff see");
const stamp = Date.now().toString(36).slice(-5);
const NEW = `Studio check ${stamp}`;
const eyebrow = await openHeroEyebrow(page);
const ORIGINAL = await eyebrow.inputValue();
await eyebrow.fill(NEW.slice(0, 32));
const drafted = await waitFor(async () => {
  const d = unwrap((await store("siteContent"))["home.hero"]);
  return d?.draft?.slides?.[0]?.eyebrow === NEW.slice(0, 32) ? d : null;
});
expect(Boolean(drafted), "the change is saved as a draft");
expect(Boolean(await waitFor(async () => /Saved as a draft/.test(await page.locator("dialog[open]").innerText().catch(() => "")), 10000)), "the sheet says “Saved as a draft · not live yet”");
expect(!(await publicText("/")).includes(NEW.slice(0, 32)), "a signed-out visitor doesn't see the draft");

/* 4 (before publishing): a stale second tab */
console.log("\n4. A stale second tab gets the conflict panel");
const page2 = await ctx.newPage();
page2.setDefaultTimeout(45000);
await page2.goto(`${BASE}/admin/website/home`, { waitUntil: "load" });
const eyebrow2 = await openHeroEyebrow(page2);
// Tab 1 saves again (tab 2 is now stale), then tab 2 edits.
await eyebrow.fill(`${NEW.slice(0, 28)} v2`);
await waitFor(async () => unwrap((await store("siteContent"))["home.hero"])?.draft?.slides?.[0]?.eyebrow === `${NEW.slice(0, 28)} v2`);
await eyebrow2.fill(`Other tab ${stamp}`);
const conflict = await waitFor(async () => /Someone else changed this section/.test(await page2.locator("dialog[open]").innerText().catch(() => "")), 20000);
expect(Boolean(conflict), "the stale tab shows “Someone else changed this section”");
expect(unwrap((await store("siteContent"))["home.hero"])?.draft?.slides?.[0]?.eyebrow === `${NEW.slice(0, 28)} v2`, "and didn't overwrite the newer draft");
await page2.close();

/* 3 */
console.log("\n3. Put the change live");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Review & put live" }).click();
await page.getByRole("button", { name: "Put these changes live" }).click();
await page.getByRole("button", { name: "Yes, put them live" }).click();
const live = await waitFor(async () => {
  const d = unwrap((await store("siteContent"))["home.hero"]);
  return d?.published?.slides?.[0]?.eyebrow === `${NEW.slice(0, 28)} v2` && !d.draft ? d : null;
});
expect(Boolean(live), "the draft is published");
expect((await publicText("/")).includes(`${NEW.slice(0, 28)} v2`), "a signed-out visitor sees it on the next request");
// Put the original words back (live).
await page.goto(`${BASE}/admin/website/home`, { waitUntil: "load" });
await (await openHeroEyebrow(page)).fill(ORIGINAL);
await waitFor(async () => unwrap((await store("siteContent"))["home.hero"])?.draft?.slides?.[0]?.eyebrow === ORIGINAL);
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Review & put live" }).click();
await page.getByRole("button", { name: "Put these changes live" }).click();
await page.getByRole("button", { name: "Yes, put them live" }).click();
await waitFor(async () => unwrap((await store("siteContent"))["home.hero"])?.published?.slides?.[0]?.eyebrow === ORIGINAL);

/* 5 */
console.log("\n5. Upload a JPEG with GPS");
const jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 140, b: 60 } } })
  .jpeg()
  .withExif({ IFD0: { Copyright: "Haven QA" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "13/1 27/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "16/1 34/1 0/1" } })
  .toBuffer();
const hadExif = Boolean((await sharp(jpeg).metadata()).exif);
await page.goto(`${BASE}/admin/media?do=upload-media`, { waitUntil: "load" });
await hydrated(page, "#photo-file");
await page.locator("#photo-file").setInputFiles({ name: "qa-gps.jpg", mimeType: "image/jpeg", buffer: jpeg });
await page.locator("#alt").waitFor({ timeout: 60000 });
await page.locator("#alt").fill("An orange test card used by the acceptance check.");
await page.getByRole("button", { name: "Add it to the library" }).click();
const known = new Set(Object.keys(await store("media")));
const asset = await waitFor(async () => Object.entries(await store("media")).map(([id, m]) => ({ id, ...unwrap(m) })).find((m) => !known.has(m.id) && m.alt === "An orange test card used by the acceptance check." && m.status === "active"), 45000);
expect(Boolean(asset) && /^public\/media\/[A-Za-z0-9_~.-]+\/[a-f0-9]{12}\.webp$/.test(asset.storageKey ?? ""), `stored as ${asset?.storageKey}`);
let url = null;
if (asset) {
  url = `${BASE}${asset.src}`;
  const res = await anon.request.get(url);
  const body = await res.body();
  const meta = await sharp(body).metadata();
  expect(hadExif && res.status() === 200 && meta.format === "webp" && !meta.exif, "served by /m as WebP with no EXIF (the original had GPS)", `${res.status()} ${meta.format} exif=${Boolean(meta.exif)}`);
}

/* 6 */
console.log("\n6. Withdraw consent");
if (asset) {
  await page.goto(`${BASE}/admin/media`, { waitUntil: "load" });
  await hydrated(page, "ul button");
  await page.getByRole("button", { name: /Added by the team/ }).click();
  await page.locator(`ul button:has(img[src="${asset.src}"])`).first().click();
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  await page.getByRole("button", { name: "Yes, withdraw consent" }).click();
  const withdrawn = await waitFor(async () => unwrap((await store("media"))[asset.id])?.status === "withdrawn");
  expect(Boolean(withdrawn), "the photo is marked withdrawn");
  const res = await anon.request.get(url);
  expect(res.status() === 410, `its URL answers 410 (${res.status()})`);
}

/* 7 */
console.log("\n7. Before launch");
const sa = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await sa.request.post(`${BASE}/api/dev/session?role=super_admin`);
const sp = await sa.newPage();
sp.setDefaultNavigationTimeout(150000);
await sp.goto(`${BASE}/admin/website/launch`, { waitUntil: "load" });
await hydrated(sp, "[role=radiogroup] button, [role=radiogroup] [role=radio]");
const listText = await sp.locator("main").innerText();
expect(/still to do|Everything is ready/.test(listText) && /Before launch/.test(listText), "the checklist lists what's still to do");
const hidden = async () => unwrap((await store("siteContent"))["settings.site"])?.published?.figures?.hideUnverified === true;
const pick = async (label, want) => {
  for (let i = 0; i < 3 && (await hidden()) !== want; i++) {
    await sp.goto(`${BASE}/admin/website/launch`, { waitUntil: "load" });
    await hydrated(sp, "[role=radiogroup] [role=radio]");
    await sp.getByRole("radiogroup", { name: /checked/ }).getByRole("radio", { name: label }).click({ force: true });
    await waitFor(async () => (await hidden()) === want, 15000);
  }
  return (await hidden()) === want;
};
// Cycle through the switch first so the stored value and the page caches agree.
await pick("Hide them", true);
await pick("Show as examples", false);
const before = (await publicHtml("/impact")).includes("Families reached");
await pick("Hide them", true);
const after = (await publicHtml("/impact")).includes("Families reached");
expect(before && !after, `unchecked figures leave /impact (${before} → ${after})`);
expect(await pick("Show as examples", false), "switched back to showing examples");
await sa.close();

await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A7 checks passed.");
process.exit(fails.length ? 1 : 0);
