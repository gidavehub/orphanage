// Acceptance check for the "Share your story" form (P6; public-pages §3.14; PLAN D58, D94, D96,
// D107). Drives /stories/share in Chrome, then reads the practice store under .data/.
//
//   node scripts/qa/forms/story.mjs --base http://localhost:3001
//
// 1. An empty submit shows the error summary; a story with every optional box left unticked and an
//    adult photo (a JPEG carrying GPS EXIF) gets an HVN-SS reference on screen; the record is stored
//    with the contact sealed (the email and phone appear in no record but the outbox entry), consent
//    stamps, the credit name "First I.", one photo attachment saved without EXIF, and
//    story_acknowledgement held with the template subject plus a mailbox file.
// 2. "My story is about my own child" without the guardian tick → a guardian error; ticking it
//    sends, parentOrGuardian is stored, and with a phone only (no email) no email is queued.
// 3. "Publish without my name" stores no display name.
// 4. Honeypot filled: a success-looking answer with no reference, nothing stored (D94).
// Exit code 1 on any failed expectation. Never prints secrets.

import { createRequire } from "node:module";
import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const sharp = require("sharp");

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

const SUBJECT = /^Thank you for sharing your story \(HVN-SS-\d{4}-\d{4,}\)$/;
const SS_RE = /HVN-SS-\d{4}-\d{4,}/;

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
/** Every file under a directory (recursive). */
async function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
/** True when any record under .data/db contains the text (the email outbox, which must hold its recipient, aside). */
async function dbContains(text) {
  for (const f of await walk(path.join(DATA, "db"))) {
    if (!f.endsWith(".json") || f.includes(`${path.sep}emailOutbox${path.sep}`)) continue;
    if ((await readFile(f, "utf8")).includes(text)) return true;
  }
  return false;
}

const html = await fetch(`${BASE}/stories/share`).then((r) => r.text()).catch(() => "");
if (!/<title>[^<]*Haven/.test(html)) {
  console.log(`  ✗ ${BASE}/stories/share is not Haven (check --base)`);
  process.exit(1);
}

// An adult's photo with GPS data in its EXIF (it must be stored without it).
const tmp = await mkdtemp(path.join(os.tmpdir(), "haven-story-qa-"));
const photoPath = path.join(tmp, "my-photo.jpg");
await writeFile(
  photoPath,
  await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 196, g: 120, b: 72 } } })
    .jpeg({ quality: 80 })
    .withExif({ IFD0: { Copyright: "QA" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "13/1 27/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "16/1 34/1 0/1" } })
    .toBuffer(),
);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/stories/share`, { waitUntil: "load" });
  await page.waitForFunction(() => !!document.querySelector("#story"), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  return { context, page, errors };
}
const submit = (page) => page.getByRole("button", { name: "Share My Story" }).click();
async function fill(page, { email = "qa.story@example.org", phone = "+220 700 1234", role = "volunteer", tag = randomUUID().slice(0, 6) } = {}) {
  await page.locator("#name").fill("Aminata Quist Sowe");
  await page.locator(`input[name="role"][value="${role}"]`).check({ force: true });
  await page.locator("#country").selectOption("gm");
  await page.locator("#programme").selectOption("education");
  await page
    .locator("#story")
    .fill(`I joined the reading circles last spring and watched the children grow in confidence every single week. Thank you, Haven. (${tag})`);
  if (email) await page.locator("#email").fill(email);
  if (phone) await page.locator("#phone").fill(phone);
  await page.locator("#publishConsent").check({ force: true });
  await page.locator("#privacy").check({ force: true });
  await page.waitForTimeout(2600);
}
async function sentRef(page) {
  await page.getByRole("status").filter({ hasText: /Thank You for Sharing/i }).first().waitFor({ timeout: 60000 });
  return ((await page.locator("main").innerText()).match(SS_RE) ?? [""])[0];
}

try {
  /* ── 1. A story with a photo ─────────────────────────────────────────────────────────────────── */
  console.log("\n1. A story with an adult photo");
  {
    const before = Object.keys(await store("storySubmissions")).length;
    const { context, page, errors } = await open();
    await submit(page);
    expect(await page.getByText("There's a problem").first().isVisible(), "an empty submit shows the error summary");
    const email = `qa.story.${randomUUID().slice(0, 8)}@example.org`;
    const phone = `+220 7${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
    await fill(page, { email, phone });
    await page.locator("#photo").setInputFiles(photoPath);
    await page.getByText(/my-photo|Uploaded|Ready/i).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('button[type="submit"][disabled]'), null, { timeout: 30000 }).catch(() => {});
    const tokens = await page.locator('input[name="photo"][type="hidden"]').count();
    expect(tokens === 1, `the photo uploaded and its token is in the form (${tokens})`);
    await submit(page);
    const ref = await sentRef(page);
    expect(SS_RE.test(ref), `HVN-SS reference on screen (${ref})`);
    expect(errors.length === 0, "no page errors", errors);

    const docs = await store("storySubmissions");
    const doc = docs[ref];
    expect(Object.keys(docs).length === before + 1 && !!doc, "one storySubmissions doc written");
    if (doc) {
      expect(doc.status === "new" && doc.source === "web_form", `status new, source web_form (${doc.status})`);
      expect(doc.submitterRole === "volunteer" && String(doc.country).toUpperCase() === "GM", `role and country stored (${doc.submitterRole}, ${doc.country})`);
      expect(doc.programmeId === "education", `programme stored (${doc.programmeId})`);
      expect(doc.publishWithoutName === false && doc.displayName === "Aminata S.", `credited as first name and initial (${doc.displayName})`);
      expect(doc.parentOrGuardian === false, "unticked boxes validate: parentOrGuardian false");
      expect(!!doc.publishConsent?.at && !!doc.privacyAcknowledged?.noticeVersion, "consent stamps stored");
      expect(typeof doc.contact === "object" && !JSON.stringify(doc.contact).includes("Aminata"), "the contact block is sealed");
      expect(doc.attachmentCount === 1, `attachmentCount 1 (${doc.attachmentCount})`);
    }
    expect(!(await dbContains(email)), "the email address never appears in plain text in any record (outbox aside)");
    expect(!(await dbContains(phone)), "the phone number never appears in plain text under .data/db");

    const attDocs = await store(`storySubmissions/${ref}/attachments`);
    const att = Object.values(attDocs)[0];
    expect(!!att && att.label === "photo" && att.uploadedBy?.kind === "public", "one photo attachment record");
    const files = (await walk(path.join(DATA, "storage", "private", "cases", "storySubmissions", ref))).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    expect(files.length === 1, `the photo left quarantine for private/cases/storySubmissions/${ref}/ (${files.length})`);
    if (files[0]) {
      const meta = await sharp(await readFile(files[0])).metadata();
      expect(!meta.exif, "the stored photo carries no EXIF (GPS removed)");
    }

    const ack = await waitForOutbox(`story_acknowledgement~${ref}`);
    expect(ack?.status === "held", `story_acknowledgement held (${ack?.status})`);
    expect(SUBJECT.test(ack?.subject ?? ""), `subject matches the template (${ack?.subject})`);
    expect(await exists(path.join(DATA, "mailbox", `story_acknowledgement~${ref}.html`)), "mailbox file written");
    await context.close();
  }

  /* ── 2. About my own child, phone only ───────────────────────────────────────────────────────── */
  console.log("\n2. About my own child, phone only");
  {
    const { context, page } = await open();
    await fill(page, { email: "", phone: "+220 700 5678", role: "beneficiary" });
    await page.locator("#aboutMyChild").check({ force: true });
    await page.waitForTimeout(300);
    await submit(page);
    expect(await page.getByText(/confirm that you are the child's parent or legal guardian/).first().isVisible(), "the guardian tick is required");
    await page.locator("#guardian").check({ force: true });
    await submit(page);
    const ref = await sentRef(page);
    expect(SS_RE.test(ref), `HVN-SS reference on screen (${ref})`);
    const doc = (await store("storySubmissions"))[ref];
    expect(doc?.parentOrGuardian === true && doc?.submitterRole === "beneficiary", "parentOrGuardian stored");
    expect(doc?.contactLookupHash === null, "no email lookup hash without an email");
    await sleep(2500);
    expect(!(await store("emailOutbox"))[`story_acknowledgement~${ref}`], "no email queued when only a phone was given");
    await context.close();
  }

  /* ── 3. Publish without my name ──────────────────────────────────────────────────────────────── */
  console.log("\n3. Publish without my name");
  {
    const { context, page } = await open();
    await fill(page, { role: "donor" });
    await page.locator("#anonymous").check({ force: true });
    await submit(page);
    const ref = await sentRef(page);
    const doc = (await store("storySubmissions"))[ref];
    expect(doc?.publishWithoutName === true && doc?.displayName === null, `no display name stored (${doc?.displayName})`);
    await context.close();
  }

  /* ── 4. Honeypot ─────────────────────────────────────────────────────────────────────────────── */
  console.log("\n4. Honeypot filled → nothing stored");
  {
    const before = Object.keys(await store("storySubmissions")).length;
    const { context, page } = await open();
    await fill(page);
    await page.evaluate(() => {
      const el = document.querySelector('input[name="company_website"]');
      if (el) el.value = "https://spam.example";
    });
    await submit(page);
    await page.getByRole("status").filter({ hasText: /Thank You/i }).first().waitFor({ timeout: 60000 });
    expect(!SS_RE.test(await page.locator("main").innerText()), "a success-looking answer with no reference");
    await sleep(1500);
    expect(Object.keys(await store("storySubmissions")).length === before, "no storySubmissions doc written");
    await context.close();
  }
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}

console.log(fails.length ? `\n${fails.length} check(s) failed.` : "\nAll story checks passed.");
process.exit(fails.length ? 1 : 0);
