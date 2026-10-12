// Interaction check (P3; public-pages §4.10): appeal filter → "Donate Now" → the landing donate card
// preselects that appeal + currency, offers "See exactly where it goes", and a pledge goes through to
// the thank-you page. Then /donate/<cause>: switching cause keeps the amount (the layout persists).
//
//   node scripts/qa/donate-flow.mjs [--url http://localhost:3001/]
//
// Exits 1 on any failed expectation. Screenshot → media-src/qa/donate-flow.png.
// Requests carry a fresh fake X-Forwarded-For so repeated runs never hit the donation rate limit.

import { chromium } from "playwright-core";
import path from "path";

const args = process.argv.slice(2);
const i = args.indexOf("--url");
const URL_ = i === -1 ? "http://localhost:3001/" : args[i + 1];
const ORIGIN = new URL(URL_).origin;
const fakeIp = `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL_, { waitUntil: "load" });

const fails = [];
const expect = (ok, msg) => (ok ? console.log(`  ✓ ${msg}`) : (fails.push(msg), console.log(`  ✗ ${msg}`)));

console.log("\nLanding: appeal → donate card");
await page.locator("#appeals").scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
// Wait for hydration: retry the filter until it reports pressed.
const christmas = page.locator("#appeals").getByRole("button", { name: "Christmas", exact: true });
for (let t = 0; t < 20 && (await christmas.getAttribute("aria-pressed")) !== "true"; t++) {
  await christmas.click();
  await page.waitForTimeout(500);
}
await page.waitForTimeout(600);
const cards = page.locator("#appeals article");
expect((await cards.count()) === 1, `Christmas filter shows one appeal (got ${await cards.count()})`);
expect(await cards.first().getByText("Philippines").isVisible(), "card shows its country chip (Philippines)");
expect(await cards.first().getByText(/USD\s?3,400/).isVisible(), "card shows amounts in USD");

await page.getByRole("link", { name: "Donate Now to Christmas Gift Boxes for Children" }).click();
await page.waitForTimeout(1500);
const card = page.locator("#donate");
expect(await card.getByText("Giving to: Christmas Gift Boxes for Children").isVisible(), "donate card names the chosen appeal");
expect((await card.getByRole("radio", { name: "USD", exact: true }).getAttribute("aria-checked")) === "true", "currency switched to USD");
expect(await card.getByRole("radio", { name: "100", exact: true }).isVisible(), "USD preset amounts shown");

const where = card.getByRole("link", { name: /See exactly where it goes/ });
expect(await where.isVisible(), "'See exactly where it goes' link offered after the preselect");
const whereHref = (await where.getAttribute("href")) ?? "";
expect(/^\/donate\/christmas-gift-boxes\?/.test(whereHref) && /currency=USD/.test(whereHref), `the link carries the cause and the current state (${whereHref})`);

await card.getByRole("radio", { name: "GBP", exact: true }).click();
expect(await card.getByText("Pounds", { exact: false }).first().isVisible(), "GBP switch relabels the other-amount field");
await card.getByRole("radio", { name: "50", exact: true }).click();
expect(await card.getByRole("button", { name: "Donate Now" }).isEnabled(), "Donate Now enabled at GBP 50");
expect(/amount=50/.test((await where.getAttribute("href")) ?? "") && /currency=GBP/.test((await where.getAttribute("href")) ?? ""), "the link follows the amount and currency");
await page.screenshot({ path: path.resolve("media-src/qa/donate-flow.png") });

console.log("\nLanding: pledge-mode submission");
await card.getByRole("button", { name: "Donate Now" }).click();
await page.waitForTimeout(600);
expect(await card.getByRole("heading", { name: "Your details" }).isVisible(), "details step shown");
await card.getByLabel("Full name").fill("Flow Tester");
await card.getByLabel("Email").fill("flow.tester@example.org");
await card.getByLabel("Country").selectOption("gb");
const confirm = card.getByRole("button", { name: "Confirm My Pledge" });
expect(await confirm.isVisible(), "pledge route: the CTA reads 'Confirm My Pledge' (no Stripe key)");
await page.waitForTimeout(2600); // the time trap: a person takes longer than 2.5 s
await confirm.click();
await page.waitForURL(/\/donate\/thank-you\?ref=HVN-DN-\d{4}-\d{4,}&t=/, { timeout: 30000 }).catch(() => {});
await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 30000 }).catch(() => {});
await page.waitForTimeout(800);
const ty = page.url();
expect(/\/donate\/thank-you\?ref=HVN-DN-\d{4}-\d{4,}&t=/.test(ty), `lands on the pledge thank-you (${ty.replace(ORIGIN, "").slice(0, 60)}…)`);
expect(await page.getByRole("heading", { level: 1 }).getByText(/Flow/i).isVisible().catch(() => false), "thank-you greets the donor by first name");
expect(await page.getByText(/GBP\s?50/).first().isVisible().catch(() => false), "thank-you shows the amount");

console.log("\n/donate/<cause>: the widget persists across causes");
await page.goto(`${ORIGIN}/donate/education?amount=50&currency=USD&frequency=monthly`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const widget = page.locator("#donate-widget");
expect((await widget.getByRole("radio", { name: "50", exact: true }).getAttribute("aria-checked")) === "true", "the shareable URL preselects USD 50");
expect((await widget.getByRole("radio", { name: "Monthly", exact: true }).getAttribute("aria-checked")) === "true", "…and monthly");
await widget.getByRole("button", { name: /Change/ }).click();
await page.waitForTimeout(500);
await page.getByRole("dialog").getByRole("radio", { name: "Programmes" }).click().catch(() => {});
await page.getByRole("dialog").getByRole("button", { name: /Medical Support/ }).click();
await page.waitForURL(/\/donate\/medical/, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
expect(/\/donate\/medical\?/.test(page.url()), "picking a cause navigates to its page");
expect((await widget.getByRole("radio", { name: "50", exact: true }).getAttribute("aria-checked")) === "true", "the amount is kept after switching cause (no remount)");
expect(await widget.getByText("Medical Support").first().isVisible(), "the widget now gives to the new cause");

if (errors.length) fails.push(...errors);
await browser.close();
console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\n  all passed");
process.exit(fails.length ? 1 : 0);
