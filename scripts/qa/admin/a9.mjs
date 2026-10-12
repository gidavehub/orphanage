// Acceptance check for A9 (PLAN §6.2 A9): team, invitations, password reset, Me, Activity, Settings
// and exports.
//
//   node scripts/qa/admin/a9.mjs --base http://localhost:3001
//
//  1. A super admin invites a content manager from the Invite sheet: `staff_invite` is held with an
//     /admin/invite/<token> link.
//  2. Accepting the invitation (password) creates the account and signs them in to Today.
//  3. Forgot → reset: the same answer for unknown emails; a 1-hour link; the new password signs in.
//  4. With the other super admin paused, the last super admin can't drop their own role (and the
//     page says so). The paused super admin is restored afterwards.
//  5. Activity › Only sensitive lists record views (and only sensitive entries).
//  6. The email log lists held emails and shows a preview in a sandboxed frame.
//  7. Exporting gifts with contact details asks for a recent sign-in, and a donor name starting with
//     "=" is escaped in the CSV.
//  8. Everyone but the super admin gets NoAccess on Settings › Data.
//  9. Me: change the text size and an email preference; they stick.

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
async function authFile(name) {
  try {
    return JSON.parse(await readFile(path.join(DATA, "auth", name), "utf8"));
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
const toast = (page) => page.locator("ol[aria-live]").innerText().catch(() => "");

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
async function as(role, extra = "") {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  await ctx.request.post(`${BASE}/api/dev/session?role=${role}${extra}`);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  page.setDefaultTimeout(45000);
  return { ctx, page };
}
const stamp = Date.now().toString(36);
const inviteEmail = `qa.cm.${stamp}@example.org`;
const inviteName = `Amara Qa${stamp.slice(-4)}`;

/* 1 ─────────────────────────────────────────────────────────────────── */
console.log("\n1. Invite a content manager");
const sa = await as("super_admin");
await sa.page.goto(`${BASE}/admin/team`, { waitUntil: "load" });
await hydrated(sa.page, "a[data-ref]");
await sa.page.getByRole("button", { name: "Invite someone" }).first().click();
await sa.page.locator("#invite-name").waitFor();
await hydrated(sa.page, "#invite-name");
await sa.page.locator("#invite-name").fill(inviteName);
await sa.page.locator("#invite-email").fill(inviteEmail);
await sa.page.locator("input[name='invite-role-content_manager']").evaluate((el) => el.click());
await sa.page.getByRole("button", { name: "Send the invitation" }).click();
const sentToast = await waitFor(async () => (/Invitation sent/.test(await toast(sa.page)) ? true : null), 30000);
expect(Boolean(sentToast), "the sheet confirms the invitation was sent");
const inviteMail = await waitFor(async () => {
  const hit = Object.entries(await store("emailOutbox")).map(([id, d]) => [id, unwrap(d)]).find(([, d]) => d.template === "staff_invite" && d.to?.includes(inviteEmail));
  return hit && hit[1].status === "held" ? hit : null;
}, 40000);
const inviteLink = inviteMail?.[1]?.vars?.link ?? "";
expect(Boolean(inviteMail), "staff_invite is held in the email log", inviteMail?.[1]?.status);
expect(/\/admin\/invite\/[A-Za-z0-9_-]{20,}$/.test(inviteLink), `the email links to /admin/invite/<token>`, inviteLink);
await sa.page.goto(`${BASE}/admin/team`, { waitUntil: "load" });
expect((await sa.page.locator(`li[data-ref="${inviteEmail}"]`).count()) === 1, "Team shows the invitation under Waiting to join");

/* 2 ─────────────────────────────────────────────────────────────────── */
console.log("\n2. Accept the invitation");
const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const np = await fresh.newPage();
np.setDefaultNavigationTimeout(150000);
const password = `Kind river ${stamp} walks`;
let newUid = null;
if (inviteLink) {
  await np.goto(new URL(new URL(inviteLink).pathname, BASE).toString(), { waitUntil: "load" });
  expect((await np.locator("h1").innerText()).includes(inviteName.split(" ")[0]), "the invitation greets them by name");
  await hydrated(np, "#password");
  await np.locator("#password").fill("short");
  await np.getByRole("button", { name: "Join the team" }).click();
  const weak = await waitFor(async () => ((await np.locator("#password-error").count()) ? np.locator("#password-error").innerText() : null), 20000);
  expect(Boolean(weak), "a short password is refused with a message", weak);
  await np.locator("#password").fill(password);
  await np.getByRole("button", { name: "Join the team" }).click();
  await np.waitForURL((u) => new URL(u).pathname === "/admin", { timeout: 90000 }).catch(() => undefined);
  expect(new URL(np.url()).pathname === "/admin", "accepting signs them in and lands on Today", np.url());
  const staff = Object.entries(await store("staff")).map(([id, d]) => [id, unwrap(d)]).find(([, d]) => d.email === inviteEmail);
  newUid = staff?.[0] ?? null;
  expect(Boolean(staff) && staff[1].roles?.join() === "content_manager" && staff[1].status === "active", "a content manager account was created", JSON.stringify(staff?.[1]?.roles));
  const inv = Object.values(await store("invitations")).map(unwrap).find((d) => d.email === inviteEmail);
  expect(Boolean(inv?.acceptedAt), "the invitation is marked accepted");
  await np.goto(new URL(new URL(inviteLink).pathname, BASE).toString(), { waitUntil: "load" });
  expect(/expired/i.test(await np.locator("h1").innerText()), "the link can't be used twice");
}

/* 3 ─────────────────────────────────────────────────────────────────── */
console.log("\n3. Forgot your password → reset");
const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ap = await anon.newPage();
ap.setDefaultNavigationTimeout(150000);
async function askReset(email) {
  await ap.goto(`${BASE}/admin/forgot`, { waitUntil: "load" });
  await hydrated(ap, "#email");
  await ap.locator("#email").fill(email);
  await ap.getByRole("button", { name: "Send me a link" }).click();
  return waitFor(async () => {
    const t = await ap.locator("main").innerText().catch(() => "");
    return /Check your email/.test(t) ? t : null;
  }, 30000);
}
const unknownAnswer = await askReset(`nobody.${stamp}@example.org`);
const knownAnswer = await askReset(inviteEmail);
expect(Boolean(unknownAnswer) && Boolean(knownAnswer) && unknownAnswer.replace(/\s+/g, " ") === knownAnswer.replace(/\s+/g, " "), "unknown and known emails get the same answer");
const resetMail = await waitFor(async () => {
  const hit = Object.values(await store("emailOutbox")).map(unwrap).find((d) => d.template === "staff_password_reset" && d.to?.includes(inviteEmail));
  return hit?.status === "held" ? hit : null;
}, 40000);
const resetLink = resetMail?.vars?.link ?? "";
expect(/\/admin\/reset\/[A-Za-z0-9_-]{20,}$/.test(resetLink), "staff_password_reset is held with an /admin/reset/<token> link", resetLink);
const resets = await authFile("resets.json");
const newest = Object.values(resets.resets ?? {}).sort((a, b) => b.createdAt - a.createdAt)[0];
expect(newest && newest.expiresAt - newest.createdAt === 3_600_000, "the reset link works for 1 hour", newest ? newest.expiresAt - newest.createdAt : "none");
const password2 = `Bright window ${stamp} opens`;
if (resetLink) {
  await ap.goto(new URL(new URL(resetLink).pathname, BASE).toString(), { waitUntil: "load" });
  await hydrated(ap, "#password");
  await ap.locator("#password").fill(password2);
  await ap.getByRole("button", { name: "Save my new password" }).click();
  await ap.waitForURL(/\/admin\/login\?reset=1/, { timeout: 60000 }).catch(() => undefined);
  const note = await waitFor(async () => ((await ap.getByText("Password changed", { exact: true }).count()) ? true : null), 30000);
  expect(new URL(ap.url()).search === "?reset=1" && Boolean(note), "they're sent to sign in with a “Password changed” note", ap.url());
  await ap.locator("#email:visible").waitFor();
  await ap.waitForFunction(() => [...document.querySelectorAll("#email")].some((el) => el.offsetParent && Object.keys(el).some((k) => k.startsWith("__reactProps"))));
  await ap.locator("#email:visible").fill(inviteEmail);
  await ap.locator("#password:visible").fill(password2);
  await ap.getByRole("button", { name: "Sign in", exact: true }).click();
  await ap.waitForURL((u) => new URL(u).pathname === "/admin", { timeout: 90000 }).catch(() => undefined);
  expect(new URL(ap.url()).pathname === "/admin", "the new password signs in", ap.url());
  await np.goto(`${BASE}/admin/me`, { waitUntil: "load" });
  await np.waitForURL((u) => new URL(u).pathname === "/admin/login", { timeout: 30000 }).catch(() => undefined);
  expect(new URL(np.url()).pathname === "/admin/login", "the reset signed out their other sessions", np.url());
}

/* 4 ─────────────────────────────────────────────────────────────────── */
console.log("\n4. The last super admin");
const admins = Object.entries(await store("staff")).map(([id, d]) => [id, unwrap(d)]).filter(([, d]) => d.status === "active" && d.roles?.includes("super_admin"));
const others = admins.filter(([id]) => id !== "loc_seed_super_admin");
for (const [uid] of others) {
  await sa.page.goto(`${BASE}/admin/team/${uid}`, { waitUntil: "load" });
  await hydrated(sa.page, "input[name='person-role-super_admin']");
  await sa.page.getByRole("button", { name: "Pause their access" }).click();
  await sa.page.getByRole("button", { name: "Pause access", exact: true }).click();
  await waitFor(async () => (/access is paused/.test(await toast(sa.page)) ? true : null), 30000);
}
const left = Object.values(await store("staff")).map(unwrap).filter((d) => d.status === "active" && d.roles?.includes("super_admin")).length;
expect(left === 1, `only one active super admin remains (${left})`);
await sa.page.goto(`${BASE}/admin/team/loc_seed_super_admin`, { waitUntil: "load" });
await hydrated(sa.page, "input[name='person-role-super_admin']");
expect(/only super admin/.test(await sa.page.locator("main").innerText()), "their page says they're the only super admin");
await sa.page.locator("input[name='person-role-super_admin']").evaluate((el) => el.click());
await sa.page.locator("input[name='person-role-content_manager']").evaluate((el) => el.click());
await sa.page.getByRole("button", { name: "Save their access" }).click();
const refused = await waitFor(async () => {
  const t = await toast(sa.page);
  return /at least one super admin/.test(t) ? t : null;
}, 30000);
expect(Boolean(refused), "dropping the last super admin role is refused", await toast(sa.page));
const self = unwrap((await store("staff")).loc_seed_super_admin);
expect(self?.roles?.includes("super_admin"), "they're still a super admin");
for (const [uid] of others) {
  await sa.page.goto(`${BASE}/admin/team/${uid}`, { waitUntil: "load" });
  await hydrated(sa.page, "input[name='person-role-super_admin']");
  await sa.page.getByRole("button", { name: "Restore their access" }).click();
  await waitFor(async () => (/can sign in again/.test(await toast(sa.page)) ? true : null), 30000);
}
const back = Object.values(await store("staff")).map(unwrap).filter((d) => d.status === "active" && d.roles?.includes("super_admin")).length;
expect(back === admins.length, `the paused super admin is restored (${back})`);

/* 5 ─────────────────────────────────────────────────────────────────── */
console.log("\n5. Activity › Only sensitive");
const someRef = Object.keys(await store("supportRequests"))[0];
if (someRef) await sa.page.goto(`${BASE}/admin/requests/${someRef}`, { waitUntil: "load" });
await sa.page.goto(`${BASE}/admin/activity?only=sensitive`, { waitUntil: "load" });
await sa.page.locator("main li[data-sensitive]").first().waitFor({ state: "attached", timeout: 30000 }).catch(() => undefined);
const rows = sa.page.locator("main li[data-sensitive]");
const allRows = await sa.page.locator("main section li").count();
const sens = await rows.count();
expect(sens > 0 && sens === allRows, `every row is sensitive (${sens}/${allRows})`);
const text = await sa.page.locator("main").innerText();
expect(/viewed|opened/i.test(text), "record views are listed");
const cm = await as("content_manager");
await cm.page.goto(`${BASE}/admin/activity?only=sensitive`, { waitUntil: "load" });
expect((await cm.page.getByText("Only sensitive").count()) === 0, "a content manager doesn't get the sensitive filter");

/* 6 ─────────────────────────────────────────────────────────────────── */
console.log("\n6. Email log previews");
await sa.page.goto(`${BASE}/admin/settings/email-log?status=held`, { waitUntil: "load" });
await sa.page.locator('main li[data-template="staff_invite"] a').first().waitFor({ state: "attached", timeout: 30000 }).catch(() => undefined);
const held = await sa.page.locator('main li[data-template="staff_invite"] a').count();
expect(held > 0, "held invitation emails are listed");
if (held) {
  await sa.page.locator('main li[data-template="staff_invite"] a').first().click();
  await sa.page.waitForURL(/\/admin\/settings\/email-log\/.+/);
  const frame = sa.page.locator("main iframe");
  expect((await frame.getAttribute("sandbox")) === "", "the preview is in a sandboxed frame");
  const body = await sa.page.frameLocator("main iframe").locator("body").innerText().catch(() => "");
  expect(/invited|join/i.test(body), "the preview shows the email", body.slice(0, 120));
}
await sa.page.goto(`${BASE}/admin/settings/connections`, { waitUntil: "load" });
await hydrated(sa.page, "li[data-ref=email] button");
await sa.page.getByRole("button", { name: "Send me a test email" }).click();
const testMail = await waitFor(async () => Object.values(await store("emailOutbox")).map(unwrap).find((d) => d.template === "email_test" && d.toStaffUids?.includes("loc_seed_super_admin") && d.createdAt > Date.now() - 60000), 30000);
expect(Boolean(testMail), "“Send me a test email” queues email_test to them", testMail?.status);

/* 7 ─────────────────────────────────────────────────────────────────── */
console.log("\n7. Export gifts");
const fo = await as("finance_officer");
await fo.page.goto(`${BASE}/admin/giving?do=record-gift`, { waitUntil: "load" });
await fo.page.locator("#gift-name").waitFor();
await hydrated(fo.page, "#gift-name");
await fo.page.locator("#gift-name").fill(`=HYPERLINK("x") Qa${stamp.slice(-3)}`);
await fo.page.locator("#gift-email").fill(`qa.formula.${stamp}@example.org`);
await fo.page.getByRole("button", { name: "Continue" }).click();
await fo.page.getByRole("radio", { name: "USD" }).check({ force: true }).catch(async () => fo.page.getByText("USD", { exact: true }).click());
await fo.page.locator("#gift-amount").fill("12");
await fo.page.getByRole("button", { name: "Continue" }).click();
await fo.page.getByRole("button", { name: "Record this gift" }).click();
await waitFor(async () => (/Gift recorded/.test(await fo.page.locator("body").innerText()) ? true : null), 30000);
const stale = await as("finance_officer", "&authAgeMin=45");
const r1 = await stale.ctx.request.get(`${BASE}/admin/export/donations?contact=1`, { maxRedirects: 0 });
expect(r1.status() >= 300 && r1.status() < 400 && /\/admin\/confirm\?next=/.test(r1.headers().location ?? ""), "an old sign-in is asked to confirm first", `${r1.status()} ${r1.headers().location}`);
const r0 = await stale.ctx.request.get(`${BASE}/admin/export/donations`, { maxRedirects: 0 });
const plain = await r0.text();
expect(r0.status() === 200 && !/Donor,Email/.test(plain) && !/qa\.formula/.test(plain), "without contact details there are no names or emails");
const r2 = await fo.ctx.request.get(`${BASE}/admin/export/donations?contact=1`, { maxRedirects: 0 });
const csv = await r2.text();
expect(r2.status() === 200 && /text\/csv/.test(r2.headers()["content-type"] ?? ""), "a recent sign-in downloads the CSV", r2.status());
expect(csv.includes(`"'=HYPERLINK(""x"") Qa${stamp.slice(-3)}"`), "a name starting with = is escaped", csv.split("\r\n").find((l) => l.includes("HYPERLINK")));
const exported = Object.values(await store("auditLog")).map(unwrap).filter((d) => d.action === "export.run" && d.sensitive === true && d.at > Date.now() - 120000);
expect(exported.length > 0, "the download is logged as sensitive");
const cmExport = await cm.ctx.request.get(`${BASE}/admin/export/donations`, { maxRedirects: 0 });
expect(cmExport.status() === 404, "a content manager can't export gifts", cmExport.status());

/* 8 ─────────────────────────────────────────────────────────────────── */
console.log("\n8. Settings › Data is for super admins");
for (const role of ["content_manager", "programme_officer", "safeguarding_officer", "finance_officer", "counsellor", "report_manager", "viewer"]) {
  const { ctx, page } = await as(role);
  await page.goto(`${BASE}/admin/settings/data`, { waitUntil: "load" });
  await page.locator("#no-access-title").waitFor({ state: "attached", timeout: 30000 }).catch(() => undefined);
  const noAccess = (await page.locator("#no-access-title").count()) === 1 && (await page.getByRole("heading", { name: "Privacy requests", exact: true }).count()) === 0 && (await page.locator("li[data-ref]").count()) === 0;
  expect(noAccess, `${role} gets NoAccess`);
  await ctx.close();
}
await sa.page.goto(`${BASE}/admin/settings/data`, { waitUntil: "load" });
await sa.page.getByRole("heading", { name: "Privacy requests", exact: true }).waitFor({ timeout: 30000 }).catch(() => undefined);
expect((await sa.page.getByRole("heading", { name: "Privacy requests", exact: true }).count()) === 1, "the super admin sees privacy requests and retention");
await sa.page.locator("li[data-ref='concern'] select").first().waitFor({ state: "attached", timeout: 30000 }).catch(() => undefined);
const concernDays = await sa.page.locator("li[data-ref='concern'] select").first().locator("option").evaluateAll((os) => os.map((o) => Number(o.value)));
const concernMode = sa.page.locator("li[data-ref='concern'] select").nth(1);
expect(concernDays.length > 0 && Math.min(...concernDays) >= 2555 && (await concernMode.isDisabled()), "safeguarding records can't go below 7 years or skip a person's review", concernDays.join(","));

/* 9 ─────────────────────────────────────────────────────────────────── */
console.log("\n9. Me");
const po = await as("programme_officer");
await po.page.goto(`${BASE}/admin/me`, { waitUntil: "load" });
await hydrated(po.page, "#me-name");
await po.page.getByRole("radiogroup", { name: "Text size" }).getByRole("radio", { name: "Larger" }).click();
await po.page.getByRole("radiogroup", { name: "Drafts waiting for review" }).getByRole("radio", { name: "Off" }).click();
await po.page.getByRole("button", { name: "Save my changes" }).click();
await waitFor(async () => (/Saved/.test(await toast(po.page)) ? true : null), 30000);
const poDoc = unwrap((await store("staff")).loc_seed_programme_officer);
expect(poDoc?.textSize === "large" && poDoc?.notificationPrefs?.email?.drafts === "off", "text size and email choice are saved", JSON.stringify({ t: poDoc?.textSize, d: poDoc?.notificationPrefs?.email?.drafts }));
await po.page.goto(`${BASE}/admin/me`, { waitUntil: "load" });
expect((await po.page.locator("[data-text=lg]").count()) === 1, "the larger text applies across the team space");
// Put them back.
await hydrated(po.page, "#me-name");
await po.page.getByRole("radiogroup", { name: "Text size" }).getByRole("radio", { name: "Standard" }).click();
await po.page.getByRole("radiogroup", { name: "Drafts waiting for review" }).getByRole("radio", { name: "Once a day" }).click();
await po.page.getByRole("button", { name: "Save my changes" }).click();
await waitFor(async () => (/Saved/.test(await toast(po.page)) ? true : null), 30000);

/* 10 ────────────────────────────────────────────────────────────────── */
console.log("\n10. Switch off the practice accounts this check made");
const qaStaff = Object.entries(await store("staff")).map(([id, d]) => [id, unwrap(d)]).filter(([, d]) => /^qa\.cm\./.test(d.email ?? "") && d.status === "active");
for (const [uid, d] of qaStaff) {
  await sa.page.goto(`${BASE}/admin/team/${uid}`, { waitUntil: "load" });
  await hydrated(sa.page, "input[name='person-role-super_admin']");
  await sa.page.getByRole("button", { name: "They’ve left Haven" }).click();
  await sa.page.getByRole("button", { name: "Switch off the account", exact: true }).click();
  const off = await waitFor(async () => unwrap((await store("staff"))[uid])?.status === "deactivated", 30000);
  expect(Boolean(off), `${d.displayName} is switched off`);
}
if (newUid) {
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/admin/login`, { waitUntil: "load" });
  await hydrated(page2, "#email");
  await page2.locator("#email").fill(inviteEmail);
  await page2.locator("#password").fill(password2);
  await page2.getByRole("button", { name: "Sign in", exact: true }).click();
  await page2.waitForTimeout(4000);
  expect(new URL(page2.url()).pathname === "/admin/login", "a switched-off account can't sign in", page2.url());
  await ctx2.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} failed:\n - ${fails.join("\n - ")}` : "\nAll A9 checks passed.");
process.exit(fails.length ? 1 : 0);
