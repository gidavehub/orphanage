// Acceptance check for the volunteer application (P7; public-pages §3.17).
//
//   node scripts/qa/forms/volunteer.mjs --base http://localhost:3001
//
// 1. Continue on an empty first step shows errors and stays on step 1.
// 2. `?interest=` preselects that interest on step 2.
// 3. A complete application shows an HVN-VA reference; the record is `submitted` with the answers;
//    volunteer_acknowledgement is held with its fixed subject.

import { BASE, expect, finish, heldEmail, open, store, tick, unwrap, waitFor } from "./_lib.mjs";

const VA_RE = /HVN-VA-\d{4}-\d{4,}/;
const { browser, page, pageErrors } = await open();

console.log("\n1. Empty first step");
await page.goto(`${BASE}/get-involved/volunteer?interest=education_support`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForTimeout(800);
expect((await page.locator("[aria-invalid='true']").count()) > 0, "errors are shown");
expect(await page.locator("#vol-step-0").isVisible(), "still on step 1");

console.log("\n2. A complete application");
const email = `vol.${Date.now()}@example.org`;
await page.getByLabel("Full name").fill("Awa Volunteer");
await page.getByLabel("Email address").fill(email);
await page.getByLabel("Phone or WhatsApp").fill("+220 700 1234");
await page.locator("select[name='country']").selectOption("gm");
expect(await tick(page, "I am 18 or older"), "the age box can be ticked");
await page.getByRole("button", { name: "English" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForTimeout(900);
expect(await page.locator("#vol-step-1").isVisible(), "moved to step 2");
expect((await page.getByRole("button", { name: "Education support" }).getAttribute("aria-pressed")) === "true", "?interest= preselected Education support");
await page.getByText("Either", { exact: true }).click();
await page.getByText("4 to 8 hours a week", { exact: true }).click();
await page.locator("fieldset:has(legend:has-text('worked with children'))").getByText("No", { exact: true }).click();
await page.getByLabel("Why would you like to volunteer with Haven?").fill("I trained as a teacher and would love to help children read and enjoy school again.");
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForTimeout(900);
expect(await page.locator("#vol-step-2").isVisible(), "moved to step 3", await page.locator("[aria-invalid='true']").evaluateAll((els) => els.map((e) => e.getAttribute("name") || e.id).join(", ")));
await tick(page, "Haven may contact me about volunteering.");
await tick(page, /I have read the Privacy Policy/);
await tick(page, /volunteers working with children must complete safeguarding checks/);
await page.waitForTimeout(2600); // the time trap
await page.getByRole("button", { name: /Send My Application/ }).click();
const ref = await waitFor(async () => (await page.locator("body").innerText()).match(VA_RE)?.[0] ?? null, 30000);
expect(Boolean(ref), `HVN-VA reference on screen (${ref ?? "none"})`);

const rec = ref ? await waitFor(async () => unwrap((await store("volunteerApplications"))[ref])) : null;
expect(rec && rec.status === "submitted", "record stored as submitted", rec?.status);
expect(rec && rec.applicant?.emailLower === email, "applicant email stored");
expect(rec && Array.isArray(rec.interests) && rec.interests.includes("education_support"), "interests stored");
expect(rec && rec.availability?.mode === "either" && rec.availability?.hoursPerWeek === "4-8", "availability stored");
expect(rec && rec.isAdult === true && rec.safeguardingAcknowledged?.at > 0, "age and safeguarding stamps stored");

const mail = ref ? await heldEmail("volunteer_acknowledgement", ref) : null;
expect(mail && mail.doc.status === "held", "volunteer_acknowledgement held", mail?.doc.status ?? "missing");
expect(mail && (mail.doc.subject ?? "").includes(ref), "subject carries the reference", mail?.doc.subject);

await finish(browser, pageErrors, "volunteer");
