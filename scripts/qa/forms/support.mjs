// Acceptance check for the Request Support form (P4; public-pages §3.6, data-model §4.2, §10.6;
// PLAN D79, D94–D96, D107). Drives /get-support/request in Chrome like a person would, then reads the
// practice store under .data/ to check what was written.
//
//   node scripts/qa/forms/support.mjs --base http://localhost:3001
//
// 1. An education request with a PNG carrying GPS EXIF: HVN-SR reference on screen, explanation sealed
//    (its text appears nowhere in .data/db), attachment stored without EXIF, support_confirmation held
//    with the template subject, a mailbox file, staff alerts with fixed subjects.
// 2. Immediate danger = yes: no supportRequests doc, one safeguardingConcerns doc (source
//    moved_from_support) under a random reference, the same success screen, concern_alert queued, and
//    no concern detail in any notification title or email subject.
// 3. /api/uploads: a 5 MB file and an .exe renamed .pdf are rejected.
// Every browser context uses a fresh fake client IP so repeated runs never hit the rate limits.
// Exit code 1 on any failed expectation. Never prints secrets.

import { createRequire } from "node:module";
import { access, readFile, readdir } from "node:fs/promises";
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

const SUBJECT = {
  support_confirmation: /^We've received your request \(HVN-SR-\d{4}-\d{4,}\)$/,
  staff_alert: /^Haven team: something new for you$/,
  concern_alert: /^(?:Haven: a new item needs your attention|Reminder: an item still needs your attention)$/,
};
const SR_RE = /HVN-SR-\d{4}-\d{4,}/;
const CONCERN_RE = /HVN-(?!SR-)[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}/;

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
/** Every file under a directory whose content contains `needle`. */
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

const home = await fetch(`${BASE}/get-support/request`).then((r) => r.text()).catch(() => "");
if (!/<title>[^<]*Haven/.test(home)) {
  console.log(`  ✗ ${BASE}/get-support/request is not Haven (check --base)`);
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function openForm(query = "") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.goto(`${BASE}/get-support/request${query}`, { waitUntil: "load" });
  // Hydration: the step-1 cards only respond once React is attached.
  await page.waitForFunction(() => !!document.querySelector('input[name="category"]'), null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}
const pick = (page, name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).first().click();
const cont = async (page) => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);
};
async function successRef(page, re) {
  await page.getByRole("status").filter({ hasText: /Thank You/i }).first().waitFor({ timeout: 60000 });
  const text = await page.locator("main").innerText();
  return (text.match(re) ?? [""])[0];
}

/* ── 1. Education request with an EXIF photo ─────────────────────────────────────────────────── */
console.log("\n1. Education request (prefilled by ?type=education) with a GPS-tagged photo");
const marker = `qa-sealed-${randomUUID().slice(0, 8)}`;
const explanation = `My daughter needs help with school fees and books for next term. ${marker} We can explain more later.`;
const gpsPng = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 120, b: 40 } } })
  .png()
  .withExif({ IFD0: { Make: "QA", Model: "Camera" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "13/1 27/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "16/1 34/1 0/1" } })
  .toBuffer();
expect(!!(await sharp(gpsPng).metadata()).exif, "the test photo carries EXIF (GPS) before upload");

const srBefore = Object.keys(await store("supportRequests")).length;
{
  const { context, page, errors } = await openForm("?type=education");
  const preselected = await page
    .waitForFunction(() => (document.querySelector('input[name="category"][value="education"]'))?.checked === true, null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  expect(preselected, "?type=education preselects Education");
  await pick(page, "urgency", "medium");
  await pick(page, "immediateDanger", "no");
  await cont(page);
  await page.locator("#explanation").fill(explanation);
  const fileInput = page.locator('input[type="file"]').first();
  const uploadsOn = (await fileInput.count()) > 0;
  if (uploadsOn) {
    await fileInput.setInputFiles({ name: "school-letter.png", mimeType: "image/png", buffer: gpsPng });
    await page.waitForFunction(() => !!document.querySelector('input[type="hidden"][name="upload"]'), null, { timeout: 30000 }).catch(() => {});
    expect((await page.locator('input[type="hidden"][name="upload"]').count()) === 1, "the photo uploads and becomes an upload token");
  } else console.log("  · uploads are not offered (storage off): skipping the attachment checks");
  await cont(page);
  await page.locator("#fullName").fill("Awa QA Tester");
  await page.locator("#relationship").selectOption("parent");
  await page.locator("#email").fill("qa.support@example.org");
  await page.locator("#country").selectOption("gm");
  await page.locator("#locality").fill("Serekunda");
  await pick(page, "preferredContact", "email");
  await pick(page, "safeToContact", "yes");
  await cont(page);
  expect(await page.getByText(marker).first().isVisible(), "the review step shows the explanation back");
  await page.locator('input[name="consentToContact"]').check({ force: true });
  await page.locator('input[name="privacyAcknowledged"]').check({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Send My Request" }).click();
  const ref = await successRef(page, SR_RE);
  expect(SR_RE.test(ref), `HVN-SR reference on screen (${ref})`);
  expect(await page.getByText(/A confirmation has been sent to q\*\*\*@example\.org/).isVisible(), "masked email confirmation line shown");
  expect(errors.length === 0, "no page errors", errors);

  const docs = await store("supportRequests");
  const doc = docs[ref];
  expect(Object.keys(docs).length === srBefore + 1 && !!doc, "one supportRequests doc written");
  if (doc) {
    expect(doc.category === "education" && doc.urgency === "medium" && doc.immediateDanger === false, "category, urgency and danger stored");
    expect(typeof doc.explanation === "object" && doc.explanation?.$sealed === 1, "explanation stored sealed");
    expect(doc.applicant?.safeToContact === true && doc.applicant?.preferredContact === "email", "contact preferences stored");
  }
  await sleep(1500);
  const hits = await grepDir(path.join(DATA, "db"), marker);
  expect(hits.length === 0, "the explanation text appears nowhere in .data/db (grep → 0)", hits);

  if (uploadsOn && doc) {
    const atts = await store(`supportRequests/${ref}/attachments`);
    const att = Object.values(atts)[0];
    expect(Object.keys(atts).length === 1 && /^image\/(png|jpeg|webp)$/.test(att?.mime ?? "") && att?.imageSanitised === true, `one attachment recorded (${att?.mime}, sanitised)`);
    if (att) {
      const file = path.join(DATA, "storage", ...att.storagePath.split("/"));
      let stored = null;
      for (let t = 0; t < 20 && !stored; t++) {
        stored = await readFile(file).catch(() => null);
        if (!stored) await sleep(500);
      }
      expect(!!stored, `the file moved out of quarantine (${att.storagePath})`);
      if (stored) {
        const meta = await sharp(stored).metadata();
        expect(!meta.exif && !stored.includes(Buffer.from("eXIf")) && !stored.includes(Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00])), `stored ${meta.format} has no EXIF/GPS`);
      }
    }
  }

  const conf = await waitForOutbox(`support_confirmation~${ref}`);
  expect(conf?.status === "held", "support_confirmation queued and held (mailbox mode)", conf?.status);
  expect(SUBJECT.support_confirmation.test(conf?.subject ?? ""), `support_confirmation subject matches the template (${conf?.subject})`);
  expect(await exists(path.join(DATA, "mailbox", `support_confirmation~${ref}.html`)), "mailbox file written");
  const staff = await waitForOutbox(`staff_alert~${ref}`, 4000);
  if (staff) expect(SUBJECT.staff_alert.test(staff.subject ?? ""), `staff_alert subject is fixed (${staff.subject})`);
  else console.log("  · no staff_alert (no instant-email staff on the support route)");
  await context.close();
}

/* ── 2. Immediate danger → a concern only (D79) ───────────────────────────────────────────────── */
console.log("\n2. Immediate danger = yes → written only as a safeguarding concern");
{
  const dangerMarker = `qa-danger-${randomUUID().slice(0, 8)}`;
  const before = await store("supportRequests");
  const concernsBefore = Object.keys(await store("safeguardingConcerns"));
  const { context, page, errors } = await openForm();
  await pick(page, "category", "family_support");
  await pick(page, "urgency", "high");
  await pick(page, "immediateDanger", "yes");
  expect(await page.getByText("You can still send this request.").isVisible(), "the emergency notice appears with Report a concern, and the visitor may continue");
  await cont(page);
  await page.locator("#explanation").fill(`Someone at home is threatening the children tonight and we are scared. ${dangerMarker}`);
  await cont(page);
  await page.locator("#fullName").fill("Fatou QA Tester");
  await page.locator("#relationship").selectOption("parent");
  await page.locator("#phone").fill("+220 700 1234");
  await page.locator("#country").selectOption("gm");
  await pick(page, "preferredContact", "whatsapp");
  await pick(page, "safeToContact", "careful");
  await page.locator("#bestTimes").fill("Only weekday mornings");
  await cont(page);
  await page.locator('input[name="consentToContact"]').check({ force: true });
  await page.locator('input[name="privacyAcknowledged"]').check({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Send My Request" }).click();
  const ref = await successRef(page, CONCERN_RE);
  const heading = await page.getByRole("status").filter({ hasText: /Thank You/i }).first().innerText();
  expect(CONCERN_RE.test(ref), `a random concern reference on screen (${ref})`);
  expect(/We've Received Your Request/i.test(heading), "identical success screen (same title as a normal request)");
  expect(errors.length === 0, "no page errors", errors);

  const after = await store("supportRequests");
  expect(Object.keys(after).length === Object.keys(before).length, "no supportRequests doc written");
  const concerns = await store("safeguardingConcerns");
  const added = Object.keys(concerns).filter((k) => !concernsBefore.includes(k));
  const c = concerns[ref];
  expect(added.length === 1 && !!c, "exactly one safeguardingConcerns doc written");
  if (c) {
    expect(c.source === "moved_from_support", `source is moved_from_support (${c.source})`);
    expect(c.narrative?.$sealed === 1 && c.reporter?.identity?.$sealed === 1, "narrative and reporter identity sealed");
    expect(c.inDangerNow === "yes", "in danger now = yes");
  }
  const alert = await waitForOutbox(`concern_alert~${ref}`);
  expect(!!alert && (alert.status === "held" || alert.status === "queued"), `concern_alert queued (${alert?.status})`);
  expect(SUBJECT.concern_alert.test(alert?.subject ?? ""), `concern_alert subject carries no detail (${alert?.subject})`);
  const outbox = await store("emailOutbox");
  const realerts = [1, 2, 3].map((n) => outbox[`concern_alert~${ref}~${n}`]);
  expect(realerts.every((r) => r && typeof r.scheduledFor === "number"), "three re-alerts queued with scheduledFor");
  expect(!outbox[`support_confirmation~${ref}`], "no support_confirmation for a moved request");
  await sleep(1000);
  const notes = await store("notifications");
  const leaked = Object.values(notes).filter((n) => JSON.stringify(n).includes(dangerMarker) || /threatening|scared/i.test(String(n.title ?? "")));
  expect(leaked.length === 0, "no concern detail in any notification");
  const subjects = Object.values(await store("emailOutbox")).filter((o) => String(o.subject ?? "").includes(dangerMarker));
  expect(subjects.length === 0, "no concern detail in any email subject");
  expect((await grepDir(path.join(DATA, "db"), dangerMarker)).length === 0, "the narrative text appears nowhere in .data/db");
  await context.close();
}

/* ── 3. Upload rules (D96) ────────────────────────────────────────────────────────────────────── */
console.log("\n3. /api/uploads rules");
{
  const post = async (buf, name, type) => {
    const fd = new FormData();
    fd.set("file", new Blob([buf], { type }), name);
    const res = await fetch(`${BASE}/api/uploads`, { method: "POST", body: fd, headers: { origin: BASE, "x-forwarded-for": fakeIp() } });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  };
  const big = Buffer.alloc(5 * 1024 * 1024, 0);
  Buffer.from("%PDF-1.4\n").copy(big);
  const r1 = await post(big, "big.pdf", "application/pdf");
  expect(r1.status === 413 && !r1.json?.uploadToken, `a 5 MB upload is rejected (${r1.status})`, r1.json);
  const exe = Buffer.concat([Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"), Buffer.alloc(2048, 7)]);
  const r2 = await post(exe, "invoice.pdf", "application/pdf");
  expect(r2.status === 415 && !r2.json?.uploadToken, `an .exe renamed .pdf is rejected (${r2.status})`, r2.json);
  const r3 = await post(gpsPng, "photo.png", "image/png");
  if (r3.status === 503) console.log("  · uploads are not switched on here (503)");
  else {
    expect(r3.status === 200 && typeof r3.json?.uploadToken === "string" && r3.json?.mime === "image/png", "a GPS-tagged PNG is accepted with an upload token");
    // The token's payload names the quarantined file: the stored bytes must carry no EXIF at all.
    let sub = "";
    try {
      sub = JSON.parse(Buffer.from(String(r3.json.uploadToken).split(".")[0], "base64url").toString("utf8")).sub ?? "";
    } catch {
      sub = "";
    }
    const raw = sub ? await readFile(path.join(DATA, "storage", "quarantine", sub)).catch(() => null) : null;
    expect(!!raw, "the upload is held in quarantine");
    if (raw) {
      const meta = await sharp(raw).metadata();
      expect(meta.format === "png" && !meta.exif && !raw.includes(Buffer.from("eXIf")), "the server re-encoded the PNG without EXIF/GPS");
    }
  }
  const res = await fetch(`${BASE}/api/uploads`, { method: "POST", body: new FormData(), headers: { origin: "https://evil.example", "x-forwarded-for": fakeIp() } });
  expect(res.status === 403 || res.status === 400, `a cross-origin upload is refused (${res.status})`);
}

await browser.close();
console.log(fails.length ? `\n${fails.length} check(s) failed.` : "\nAll support checks passed.");
process.exit(fails.length ? 1 : 0);
