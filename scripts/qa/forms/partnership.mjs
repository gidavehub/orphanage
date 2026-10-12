// Acceptance check for the partnership enquiry (P7; public-pages §3.18).
//
//   node scripts/qa/forms/partnership.mjs --base http://localhost:3001
//
// 1. An empty submit shows errors and stores nothing.
// 2. `?type=institutional_referral` preselects that partnership type.
// 3. A complete enquiry shows an HVN-PE reference; the record is `new` with the organisation and
//    contact; partnership_acknowledgement is held.

import { BASE, expect, finish, heldEmail, open, store, tick, unwrap, waitFor } from "./_lib.mjs";

const PE_RE = /HVN-PE-\d{4}-\d{4,}/;
const { browser, page, pageErrors } = await open();

console.log("\n1. Empty submit");
const before = Object.keys(await store("partnershipEnquiries")).length;
await page.goto(`${BASE}/get-involved/partner?type=institutional_referral#enquiry`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Send Enquiry/ }).click();
await page.waitForTimeout(900);
expect((await page.locator("[aria-invalid='true']").count()) > 0, "errors are shown");
expect(Object.keys(await store("partnershipEnquiries")).length === before, "nothing stored");

console.log("\n2. Prefill");
expect(await page.locator("input[name='partnershipType'][value='institutional_referral']").isChecked(), "?type= preselected Institutional referral");

console.log("\n3. A complete enquiry");
const email = `pe.${Date.now()}@example.org`;
await page.getByLabel("Organisation name").fill("Bright Futures Children's Home");
await page.locator("select[name='orgKind']").selectOption("orphanage_childrens_home");
await page.locator("select[name='country']").selectOption("gm");
await page.locator("#website").fill("brightfutures.example.org");
await page.getByLabel("Contact person").fill("Fatou Ceesay");
await page.getByLabel("Email address").fill(email);
await page.getByLabel("Tell us about your proposal").fill("We care for 24 children in Brikama and would like help with school fees, counselling and a verification visit from your team.");
expect(await tick(page, /Haven may contact me about this enquiry/), "the consent box can be ticked");
await page.waitForTimeout(2600); // the time trap
await page.getByRole("button", { name: /Send Enquiry/ }).click();
const ref = await waitFor(async () => (await page.locator("body").innerText()).match(PE_RE)?.[0] ?? null, 30000);
expect(Boolean(ref), `HVN-PE reference on screen (${ref ?? "none"})`);

const rec = ref ? await waitFor(async () => unwrap((await store("partnershipEnquiries"))[ref])) : null;
expect(rec && rec.status === "new", "record stored as new", rec?.status);
expect(rec && rec.partnershipType === "institutional_referral", "partnership type stored");
expect(rec && rec.organisation?.kind === "orphanage_childrens_home" && rec.organisation?.website === "https://brightfutures.example.org", "organisation stored (website normalised)", JSON.stringify(rec?.organisation));
expect(rec && rec.contact?.emailLower === email, "contact email stored");

const mail = ref ? await heldEmail("partnership_acknowledgement", ref) : null;
expect(mail && mail.doc.status === "held", "partnership_acknowledgement held", mail?.doc.status ?? "missing");

await finish(browser, pageErrors, "partnership");
