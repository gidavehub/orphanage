// Acceptance check for A8 (PLAN §6.2 A8): posts, review, scheduling, AI drafts and supporter updates.
//
//   node scripts/qa/admin/a8.mjs --base http://localhost:3001
//
//  1. A programme officer posts an Update from a phone (375 px): it's sent for review.
//  2. A content manager approves it with the checklist: it's live and shows on /news and the home News.
//  3. A post scheduled a minute ahead publishes once its time has passed and Today loads.
//  4. An AI draft (POST /api/dev/content {action:"aiDraft"}) waits in review with origin "ai", the
//     helper's badge and the extra "I've read every line" check.
//  5. "Send to supporters" holds one email per confirmed subscriber or consenting donor, none for
//     unconfirmed subscribers. The practice posts are archived at the end.

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
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
const post = async (id) => {
  const r = unwrap((await store("posts"))[id]);
  return r ? (r.draft ?? r.published) : null;
};
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

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.request.post(`${BASE}/api/dev/session?role=${role}`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(45000);
  return { ctx, page };
}
const anon = await browser.newContext();
const html = async (p) => (await anon.request.get(`${BASE}${p}`)).text();
const created = [];

async function approve(page, id, opts = {}) {
  await page.goto(`${BASE}/admin/posts/${id}`, { waitUntil: "load" });
  await hydrated(page, "input[name^='rv-']");
  for (const box of await page.locator("aside input[name^='check-']").all()) await box.check({ force: true });
  for (const box of await page.locator("aside input[name^='rv-']").all()) await box.check({ force: true });
  if (opts.scheduleAt) {
    await page.locator("#scheduleAt").fill(opts.scheduleAt);
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
  } else await page.getByRole("button", { name: "Approve and put live now" }).click();
}

/* 1 */
console.log("\n1. An update from a phone");
const stamp = Date.now().toString(36).slice(-5);
const TEXT = `Children in the education programme sat their end-of-term exams this week (check ${stamp}). Teachers say reading has improved across the group.`;
const po = await as("programme_officer", { width: 375, height: 812 });
await po.page.goto(`${BASE}/admin/posts?do=post-update`, { waitUntil: "load" });
await hydrated(po.page, "dialog[open] #text");
const photoTile = po.page.locator("dialog[open] label:has(input[type=radio]:not([name='child']):not([disabled]):not([value='']))").first();
await photoTile.waitFor({ timeout: 60000 });
await photoTile.click();
await po.page.locator("dialog[open] #text").fill(TEXT);
await po.page.getByRole("button", { name: "Send for review" }).click();
await po.page.waitForURL(/\/admin\/posts\/(?!\?)[^/?]+$/, { timeout: 45000 }).catch(() => {});
const updateId = decodeURIComponent(po.page.url().split("/").pop() ?? "");
const u = await waitFor(async () => {
  const p = await post(updateId);
  return p?.status === "in_review" ? p : null;
});
expect(Boolean(u) && u.format === "update", `the update ${updateId} is waiting for review`, u?.status);
if (u) created.push(updateId);
await po.ctx.close();

/* 2 */
console.log("\n2. Review and put live");
const cm = await as("content_manager");
if (u) {
  await approve(cm.page, updateId);
  const live = await waitFor(async () => {
    const r = unwrap((await store("posts"))[updateId]);
    return r?.published?.status === "published" ? r.published : null;
  });
  expect(Boolean(live), "the update is live");
  if (live) {
    expect((await html("/news")).includes(live.title.replace(/…$/, "").slice(0, 30)), "it shows on /news");
    expect((await html("/")).includes(live.title.replace(/…$/, "").slice(0, 30)), "and in the home page News");
  }
}

/* 3 */
console.log("\n3. A scheduled post publishes when its time has passed");
await cm.page.goto(`${BASE}/admin/posts?do=write-article`, { waitUntil: "load" });
await hydrated(cm.page, "dialog[open] #article-title");
await cm.page.locator("#article-title").fill(`Scheduled check ${stamp}`);
await cm.page.locator("#article-excerpt").fill("A practice article that goes live on schedule.");
await cm.page.getByRole("button", { name: "Start writing" }).click();
await cm.page.waitForURL(/\/admin\/posts\/[^/?]+$/, { timeout: 45000 }).catch(() => {});
const schedId = decodeURIComponent(cm.page.url().split("/").pop() ?? "");
created.push(schedId);
await hydrated(cm.page, "aside button");
await cm.page.getByRole("button", { name: "Send for review" }).click();
await waitFor(async () => (await post(schedId))?.status === "in_review");
const at = new Date(Date.now() + 70_000);
const local = new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
await approve(cm.page, schedId, { scheduleAt: local });
expect(Boolean(await waitFor(async () => (await post(schedId))?.status === "scheduled")), "it's scheduled");
await new Promise((r) => setTimeout(r, 80_000));
await cm.page.goto(`${BASE}/admin`, { waitUntil: "load" });
const published = await waitFor(async () => {
  const r = unwrap((await store("posts"))[schedId]);
  return r?.published?.status === "published" ? r : null;
}, 30000);
expect(Boolean(published), "Today published it once its time had passed");

/* 4 */
console.log("\n4. An AI draft waits for review");
const before = new Set(Object.keys(await store("posts")));
await anon.request.post(`${BASE}/api/dev/content`, { data: { action: "aiDraft" } });
const aiId = await waitFor(async () => Object.keys(await store("posts")).find((k) => !before.has(k)));
if (aiId) {
  created.push(aiId);
  const p = await post(aiId);
  expect(p?.status === "in_review" && p?.origin?.kind === "ai", "it's in review with origin “ai”");
  await cm.page.goto(`${BASE}/admin/posts/${aiId}`, { waitUntil: "load" });
  await hydrated(cm.page, "input[name^='rv-']");
  const t = await cm.page.locator("main").innerText();
  expect(/Drafted by the writing helper/.test(t) && /read every line/.test(t) && /Things to check/.test(t), "the review shows the helper's badge, the extra check and the safety list");
} else expect(false, "the AI draft was created");

/* 5 */
console.log("\n5. Send to supporters");
if (u) {
  const subs = Object.values(await store("newsletterSubscribers")).map(unwrap);
  const donors = Object.values(await store("donors")).map(unwrap);
  const emails = new Set([...subs.filter((s) => s.status === "confirmed" && s.emailLower).map((s) => s.emailLower), ...donors.filter((d) => d.updatesConsent && !d.updatesWithdrawnAt && d.emailLower).map((d) => d.emailLower)]);
  const pending = subs.filter((s) => s.status === "pending" && s.emailLower).map((s) => s.emailLower).filter((e) => !emails.has(e));
  await cm.page.goto(`${BASE}/admin/posts/${updateId}`, { waitUntil: "load" });
  await hydrated(cm.page, "aside button");
  await cm.page.getByRole("button", { name: "See who would get it" }).click();
  await cm.page.getByRole("button", { name: /^Send to \d+/ }).click();
  const key = (e) => `supporter_update~${updateId}~${createHash("sha256").update(e).digest("hex").slice(0, 16)}`;
  const held = await waitFor(async () => {
    const o = await store("emailOutbox");
    const all = [...emails].map((e) => unwrap(o[key(e)]));
    return all.every((m) => m && (m.status === "held" || m.status === "suppressed")) ? all : null;
  }, 60000);
  expect(Boolean(held), `one email per supporter is held (${emails.size})`);
  const o = await store("emailOutbox");
  expect(pending.every((e) => !o[key(e)]), `none for unconfirmed subscribers (${pending.length})`);
}

/* Tidy up: archive the practice posts that went live. */
for (const id of created) {
  const r = unwrap((await store("posts"))[id]);
  if (r?.published?.status !== "published") continue;
  await cm.page.goto(`${BASE}/admin/posts/${id}`, { waitUntil: "load" });
  await hydrated(cm.page, "aside button");
  await cm.page.getByRole("button", { name: "Archive" }).click();
  await waitFor(async () => unwrap((await store("posts"))[id])?.published?.status === "archived" || unwrap((await store("posts"))[id])?.visibility === "archived", 15000);
}
await cm.ctx.close();
await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\nAll A8 checks passed.");
process.exit(fails.length ? 1 : 0);
