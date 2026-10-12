// Acceptance check for the newsletter double opt-in and unsubscribe (P7; PLAN D103, public-pages §3.23).
//
//   node scripts/qa/forms/newsletter.mjs --base http://localhost:3001
//
// 1. Signing up on the landing JoinSphere → newsletter_confirm held; the subscriber is `pending`.
// 2. The confirm link from that email confirms (status `confirmed`); opening it again says "already".
// 3. /unsubscribe?token= (signed here with the practice secret) unsubscribes and writes an
//    `unsubscribe` suppression; Undo re-subscribes and lifts it.
// 4. Garbage tokens show the expired states.

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { BASE, expect, finish, heldEmail, mailboxHtml, open, store, unwrap, waitFor } from "./_lib.mjs";

const { browser, page, pageErrors } = await open();

async function envValue(name) {
  try {
    const text = await readFile(".env.local", "utf8");
    return text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
  } catch {
    return null;
  }
}
const emailHash = (secret, email) => createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("base64url").slice(0, 32);
function sign(secret, payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(`haven.token.v1.${encoded}`).digest("base64url");
  return `${encoded}.${mac}`;
}

console.log("\n1. Sign up");
const email = `nl.${Date.now()}@example.org`;
await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const form = page.locator("#newsletter form, form:has(input[name='source'][value='join_section'])").first();
await form.scrollIntoViewIfNeeded();
await form.locator("input[type='email']").fill(email);
await page.waitForTimeout(2600); // the time trap
await form.locator("button[type='submit']").click();
await page.waitForTimeout(1500);
expect(/check your inbox|confirm/i.test(await page.locator("body").innerText()), "the sign-up says to check the inbox");

const lookup = await envValue("HAVEN_LOOKUP_SECRET");
const hmacSecret = await envValue("HAVEN_HMAC_SECRET");
expect(Boolean(lookup && hmacSecret), "practice secrets readable (values not printed)");
const id = lookup ? emailHash(lookup, email) : "";
const sub = id ? await waitFor(async () => unwrap((await store("newsletterSubscribers"))[id])) : null;
expect(sub && sub.status === "pending" && sub.confirmTokenHash, "subscriber stored as pending with a token hash", sub?.status);
const mail = await heldEmail("newsletter_confirm", id);
expect(mail && mail.doc.status === "held" && mail.doc.subject === "Please confirm your subscription to Haven updates", "newsletter_confirm held with its subject", mail?.doc.subject ?? "missing");

console.log("\n2. Confirm");
const html = mail ? await mailboxHtml(mail.id) : "";
const link = html.match(/href="([^"]*\/newsletter\/confirm\?token=[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
expect(Boolean(link), "the email carries a confirm link");
if (link) {
  const u = new URL(link, BASE);
  await page.goto(`${BASE}${u.pathname}${u.search}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(/You.re In/i.test(await page.locator("main").innerText()), "the welcome shows");
  const confirmed = await waitFor(async () => {
    const s = unwrap((await store("newsletterSubscribers"))[id]);
    return s && s.status === "confirmed" ? s : null;
  });
  expect(Boolean(confirmed) && !confirmed.confirmTokenHash, "status confirmed, token hash cleared");
  await page.goto(`${BASE}${u.pathname}${u.search}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  expect(/already/i.test(await page.locator("main").innerText()), "a second visit says already subscribed");
}

console.log("\n3. Unsubscribe and undo");
if (hmacSecret && id) {
  const token = sign(hmacSecret, { p: "unsubscribe", sub: id, exp: null });
  await page.goto(`${BASE}/unsubscribe?token=${encodeURIComponent(token)}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(/You.ve been unsubscribed/i.test(await page.locator("main").innerText()), "the unsubscribed message shows");
  const off = await waitFor(async () => {
    const s = unwrap((await store("newsletterSubscribers"))[id]);
    return s && s.status === "unsubscribed" ? s : null;
  });
  expect(Boolean(off), "status unsubscribed");
  expect(unwrap((await store("emailSuppressions"))[id])?.reason === "unsubscribe", "an unsubscribe suppression is written");
  await page.getByRole("button", { name: /Undo/ }).click();
  await page.waitForTimeout(1500);
  expect(/Welcome back/i.test(await page.locator("main").innerText()), "Undo says welcome back");
  const back = await waitFor(async () => {
    const s = unwrap((await store("newsletterSubscribers"))[id]);
    return s && s.status === "confirmed" ? s : null;
  });
  expect(Boolean(back), "status confirmed again");
  expect(!(await store("emailSuppressions"))[id], "the suppression is lifted");
}

console.log("\n4. Garbage tokens");
await page.goto(`${BASE}/unsubscribe?token=garbage`, { waitUntil: "load" });
await page.waitForTimeout(1000);
expect(/expired/i.test(await page.locator("main").innerText()), "unsubscribe: expired state");
await page.goto(`${BASE}/newsletter/confirm?token=garbage`, { waitUntil: "load" });
await page.waitForTimeout(1000);
expect(/expired/i.test(await page.locator("main").innerText()), "confirm: expired state");

await finish(browser, pageErrors, "newsletter");
