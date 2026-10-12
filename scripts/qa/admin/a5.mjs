// Acceptance check for A5 (PLAN §6.2 A5): counselling sessions and the reports library.
//
//   node scripts/qa/admin/a5.mjs --base http://localhost:3001 [--only counselling|library]
//
// Counselling
//  1. A programme officer books a session for a counselling request (HVN-AP-…) with a Zoom link.
//  2. "Send the invitation" holds three emails: the confirmation (with an .ics) and the 24 h and 1 h
//     reminders, each with scheduledFor before the start.
//  3. Rescheduling cancels the old reminders and queues a new set (sequence 1).
//  4. Counsellor B gets NoAccess on counsellor A's session; counsellor A opens it and sees only own
//     sessions (no counsellor filter).
//  5. Cancelling the session sends the cancellation (.ics CANCEL) and cancels the reminders.
// Library
//  6. A content manager uploads a 2 MB PDF through sign → local PUT → complete, saves a public
//     resource, and it appears on /resources with a working download.
//  7. A report manager approves a report request: report_delivery is held and its /r/ link 302s to a
//     signed dev file URL. Declining another holds report_declined.

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const BASE = arg("--base", "http://localhost:3001").replace(/\/+$/, "");
const ONLY = arg("--only", "all");
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
const doc = async (c, id) => unwrap((await store(c))[id]);
const waitFor = async (fn, ms = 20000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};
async function ready(page, selector) {
  await page.locator(selector).first().waitFor({ state: "attached" });
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
  }, selector);
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role, n = 1) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.request.post(`${BASE}/api/dev/session?role=${role}${n === 2 ? "&n=2" : ""}`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(30000);
  return { ctx, page };
}
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;

if (ONLY === "all" || ONLY === "counselling") {
  console.log("\nCounselling");
  const po = await as("programme_officer");
  const { page } = po;

  // Pick a counselling request waiting for a time.
  const srs = await store("supportRequests");
  const appts = Object.values(await store("appointments")).map(unwrap);
  const booked = new Set(appts.filter((a) => a.status === "scheduled").map((a) => a.supportRef));
  const sr = Object.entries(srs)
    .map(([id, d]) => [id, unwrap(d)])
    .find(([id, d]) => d.category === "counselling" && ["approved", "support_in_progress"].includes(d.status) && !booked.has(id))?.[0];
  expect(Boolean(sr), `a counselling request is waiting for a time (${sr})`);

  let ref = null;
  if (sr) {
    console.log("\n1. Book a session");
    await page.goto(`${BASE}/admin/counselling?do=book-session&ref=${sr}`, { waitUntil: "load" });
    await ready(page, "#date");
    await page.locator("#date").fill(ymd(Date.now() + 3 * DAY));
    await page.locator("#time").fill("10:00");
    await page.locator("#zoomUrl").fill("https://zoom.us/j/9876543210");
    await page.getByRole("button", { name: "Book the session" }).click();
    await page.waitForURL(/\/admin\/counselling\/HVN-AP-\d{4}-\d{4,}$/, { timeout: 30000 }).catch(() => {});
    ref = page.url().match(/HVN-AP-\d{4}-\d{4,}/)?.[0] ?? null;
    const a = ref ? await waitFor(() => doc("appointments", ref)) : null;
    expect(Boolean(a) && a.status === "scheduled" && a.supportRef === sr && a.zoom?.joinUrl?.includes("zoom.us/j/"), `session ${ref} booked with the Zoom link`, JSON.stringify(a?.zoom));
  }

  if (ref) {
    console.log("\n2. Send the invitation");
    await ready(page, "#zoomUrl");
    await page.getByRole("button", { name: "Send the invitation" }).click();
    const ids = ["counselling_confirmation", "zoom_reminder_24h", "zoom_reminder_1h"].map((t) => `${t}~${ref}~s0`);
    const got = await waitFor(async () => {
      const o = await store("emailOutbox");
      const all = ids.map((id) => unwrap(o[id]));
      return all.every((x) => x && x.status === "held") ? all : null;
    }, 30000);
    expect(Boolean(got), "confirmation and both reminders are held");
    const a = await doc("appointments", ref);
    if (got) {
      expect(got[1].scheduledFor === a.startsAt - DAY && got[2].scheduledFor === a.startsAt - 3_600_000, "reminders are scheduled 24 h and 1 h before");
    }
    const ics = await readFile(path.join(DATA, "mailbox", `${ids[0]}~haven-appointment.ics`), "utf8").catch(() => "");
    expect(ics.includes("BEGIN:VCALENDAR") && ics.includes(`UID:${ref}@haven`) && ics.includes("METHOD:REQUEST"), "the confirmation carries an .ics invite");

    console.log("\n3. Reschedule");
    await page.goto(`${BASE}/admin/counselling/${ref}`, { waitUntil: "load" });
    await ready(page, "#date");
    await page.locator("#reschedule summary").click();
    await page.locator("#date").fill(ymd(Date.now() + 4 * DAY));
    await page.getByRole("button", { name: "Save the new time" }).click();
    const moved = await waitFor(async () => {
      const x = await doc("appointments", ref);
      return x?.icsSequence === 1 ? x : null;
    });
    expect(Boolean(moved), "the session moved (sequence 1)");
    const after = await waitFor(async () => {
      const o = await store("emailOutbox");
      const old24 = unwrap(o[`zoom_reminder_24h~${ref}~s0`]);
      const old1 = unwrap(o[`zoom_reminder_1h~${ref}~s0`]);
      const n = ["counselling_confirmation", "zoom_reminder_24h", "zoom_reminder_1h"].map((t) => unwrap(o[`${t}~${ref}~s1`]));
      return old24?.status === "cancelled" && old1?.status === "cancelled" && n.every((x) => x && ["held", "queued"].includes(x.status)) ? n : null;
    }, 30000);
    expect(Boolean(after), "old reminders cancelled, a new invitation and reminders queued");

    console.log("\n4. Counsellors see only their own");
    const c2 = await as("counsellor", 2);
    await c2.page.goto(`${BASE}/admin/counselling/${ref}`, { waitUntil: "load" });
    await c2.page.waitForTimeout(2000);
    expect(/isn.t open to you/i.test(await c2.page.locator("body").innerText()), "counsellor B gets NoAccess on A's session");
    await c2.ctx.close();
    const c1 = await as("counsellor");
    await c1.page.goto(`${BASE}/admin/counselling/${ref}`, { waitUntil: "load" });
    await c1.page.waitForTimeout(2000);
    const t1 = await c1.page.locator("main").innerText();
    expect(t1.includes(ref) && !/isn.t open to you/i.test(t1), "counsellor A opens their session");
    expect(!/@example\.org/.test(t1), "the counsellor never sees the client's email");
    await c1.page.goto(`${BASE}/admin/counselling`, { waitUntil: "load" });
    await c1.page.waitForTimeout(1500);
    expect((await c1.page.locator("#counsellor-filter").count()) === 0 && /My sessions/.test(await c1.page.locator("main").innerText()), "counsellor A sees “My sessions” with no counsellor filter");
    await c1.ctx.close();

    console.log("\n5. Cancel");
    await page.goto(`${BASE}/admin/counselling/${ref}`, { waitUntil: "load" });
    await ready(page, "#reason");
    await page.locator("#reason").fill("The family found a time closer to home.");
    await page.getByRole("button", { name: "Cancel the session" }).click();
    const cancelled = await waitFor(async () => {
      const o = await store("emailOutbox");
      const x = await doc("appointments", ref);
      const c = unwrap(o[`counselling_cancelled~${ref}~s1`]);
      const r24 = unwrap(o[`zoom_reminder_24h~${ref}~s1`]);
      return x?.status === "cancelled" && c && r24?.status === "cancelled" ? c : null;
    }, 30000);
    expect(Boolean(cancelled), "cancelled: the cancellation email is queued and the reminders are cancelled");
    const cics = await waitFor(async () => {
      const t = await readFile(path.join(DATA, "mailbox", `counselling_cancelled~${ref}~s1~haven-appointment.ics`), "utf8").catch(() => "");
      return t.includes("METHOD:CANCEL") ? t : null;
    }, 20000);
    expect(Boolean(cics), "the cancellation carries an .ics CANCEL");
  }
  await po.ctx.close();
}

if (ONLY === "all" || ONLY === "library") {
  console.log("\nLibrary");
  console.log("\n6. Upload a 2 MB PDF and publish it");
  const cm = await as("content_manager");
  const { page } = cm;
  // A small valid PDF padded to about 2 MB (a comment block before the trailer).
  const pad = "%" + "x".repeat(2 * 1024 * 1024) + "\n";
  const pdf = Buffer.from(
    `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj\n${pad}trailer << /Root 1 0 R >>\n%%EOF\n`,
    "latin1",
  );
  const stamp = Date.now().toString(36);
  const title = `QA practice guide ${stamp}`;
  await page.goto(`${BASE}/admin/library/new`, { waitUntil: "load" });
  await ready(page, "#title");
  await page.locator("#file").setInputFiles({ name: "qa-guide.pdf", mimeType: "application/pdf", buffer: pdf });
  const uploaded = await waitFor(async () => /· ready/.test(await page.locator("main").innerText()), 60000);
  expect(Boolean(uploaded), "the PDF uploads (sign → local PUT → complete)");
  await page.locator("#title").fill(title);
  await page.locator("#shortDescription").fill("A short practice guide uploaded by the acceptance check.");
  await page.getByText("Anyone can download it", { exact: true }).click();
  await page.getByRole("radiogroup", { name: "On the website" }).getByRole("radio", { name: "Showing" }).click({ force: true });
  await page.getByRole("button", { name: "Add it to the library" }).click();
  await page.waitForURL(/\/admin\/library\/(?!new)[a-z0-9-]+$/, { timeout: 30000 }).catch(() => {});
  const id = page.url().split("/").pop();
  const res = id && id !== "new" ? await waitFor(async () => {
    const r = await doc("resources", id);
    return r?.status === "published" && r.file?.storagePath ? r : null;
  }) : null;
  expect(Boolean(res) && res.file.storagePath.startsWith(`public/resources/${id}/`) && res.file.sizeBytes > 2_000_000, `saved as ${id} with its file under public/resources`, JSON.stringify(res?.file));
  if (res) {
    const pub = await browser.newPage();
    await pub.goto(`${BASE}/resources`, { waitUntil: "load", timeout: 150000 });
    await pub.waitForTimeout(1500);
    expect((await pub.locator("main").innerText()).includes(title), "it appears on /resources");
    const dl = await pub.request.get(`${BASE}/api/resources/${res.slug}/download`, { maxRedirects: 0 });
    const loc = dl.headers()["location"] ?? "";
    expect(dl.status() === 302 && loc.includes("/m/public/resources/"), "the download route redirects to the file", `${dl.status()} ${loc}`);
    if (loc) {
      const file = await pub.request.get(new URL(loc, BASE).toString());
      expect(file.status() === 200 && (await file.body()).subarray(0, 5).toString() === "%PDF-", "the file downloads");
    }
    await pub.close();
    // Tidy up: hide the practice item again.
    await page.goto(`${BASE}/admin/library/${id}`, { waitUntil: "load" });
    await ready(page, "#title");
    await page.getByRole("radiogroup", { name: "On the website" }).getByRole("radio", { name: "Hidden" }).click({ force: true });
    await page.getByRole("button", { name: "Save changes" }).click();
    await waitFor(async () => (await doc("resources", id))?.status === "draft");
  }
  await cm.ctx.close();

  console.log("\n7. Approve and decline report requests");
  const pickNew = async (listed) =>
    Object.entries(await store("reportRequests"))
      .map(([k, v]) => [k, unwrap(v)])
      .filter(([, v]) => ["new", "under_review"].includes(v.status) && (listed ? v.resourceId === "sample-safeguarding-practice-review" : true))
      .map(([k]) => k);
  if ((await pickNew(true)).length < 2) {
    const { execFileSync } = await import("node:child_process");
    execFileSync(process.execPath, ["scripts/qa/forms/reportRequest.mjs", "--base", BASE], { stdio: "ignore", timeout: 300000 });
  }
  const [approveRef, declineRef] = await pickNew(true);
  const rm = await as("report_manager");
  if (approveRef) {
    await rm.page.goto(`${BASE}/admin/library/requests/${approveRef}`, { waitUntil: "load" });
    await rm.page.getByRole("button", { name: "Approve and send" }).waitFor();
    await rm.page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Approve and send") && Object.keys(b).some((k) => k.startsWith("__reactProps"))));
    await rm.page.getByRole("button", { name: "Approve and send" }).click();
    const rr = await waitFor(async () => {
      const r = await doc("reportRequests", approveRef);
      return r?.status === "approved" && r.delivery?.tokenId ? r : null;
    });
    expect(Boolean(rr), `${approveRef} approved with a delivery`);
    const mailId = rr ? `report_delivery~${approveRef}~${rr.delivery.tokenId}` : null;
    const mail = mailId ? await waitFor(async () => unwrap((await store("emailOutbox"))[mailId])?.status === "held", 45000) : null;
    expect(Boolean(mail), "report_delivery is held");
    const html = mailId ? await waitFor(() => readFile(path.join(DATA, "mailbox", `${mailId}.html`), "utf8").catch(() => null), 45000) : "";
    const link = (html ?? "").match(/href="([^"]*\/r\/[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
    expect(Boolean(link), "the email carries a /r/ link");
    if (link) {
      const u = new URL(link, BASE);
      const r = await rm.page.request.get(`${BASE}${u.pathname}`, { maxRedirects: 0 });
      const loc = r.headers()["location"] ?? "";
      expect(r.status() === 302 && /\/api\/dev\/files\/private\/resources\/.+\?t=/.test(loc), "/r/ 302s to a signed dev file URL", `${r.status()} ${loc}`);
      const f = await rm.page.request.get(new URL(loc, BASE).toString());
      expect(f.status() === 200, "the signed file URL serves the report");
    }
    await rm.page.goto(`${BASE}/admin/library/requests/${approveRef}`, { waitUntil: "load" });
    const copy = await waitFor(async () => /Copy the download link/.test(await rm.page.locator("main").innerText().catch(() => "")), 15000);
    expect(Boolean(copy), "while the email is held, staff can copy the link");
  } else expect(false, "a listed report request to approve");
  if (declineRef) {
    await rm.page.goto(`${BASE}/admin/library/requests/${declineRef}`, { waitUntil: "load" });
    await rm.page.getByRole("button", { name: "Decline", exact: true }).waitFor();
    await rm.page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Decline" && Object.keys(b).some((k) => k.startsWith("__reactProps"))));
    await rm.page.getByRole("button", { name: "Decline", exact: true }).click();
    await rm.page.getByRole("button", { name: "Decline the request" }).click();
    const declined = await waitFor(async () => {
      const r = await doc("reportRequests", declineRef);
      const m = unwrap((await store("emailOutbox"))[`report_declined~${declineRef}`]);
      return r?.status === "declined" && m ? m : null;
    });
    expect(Boolean(declined), `${declineRef} declined and report_declined queued`);
  }
  await rm.ctx.close();
}

await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A5 checks passed.");
process.exit(fails.length ? 1 : 0);
