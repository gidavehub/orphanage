// Acceptance check for report requests and downloads (P7; public-pages §3.9–3.11, PLAN D59, D101).
//
//   node scripts/qa/forms/reportRequest.mjs --base http://localhost:3001
//
// 1. /resources/annual-report-2025 shows the request path (no download).
// 2. A request for a listed report from /request-a-report?report=<controlled slug> → HVN-RR with the
//    resourceId; report_request_confirmation held; the stored resource's requestCount + 1.
// 3. "Other / not listed" → HVN-RR with resourceId null and the requestedTitle.
// 4. Choosing a free report swaps the form for its download.
// 5. GET /api/resources/<public slug>/download → 302 to /m/public/resources/… and downloadCount + 1.
// 6. /r/garbage → the expired page, not a 500.

import { BASE, expect, finish, heldEmail, open, store, tick, unwrap, waitFor } from "./_lib.mjs";

const RR_RE = /HVN-RR-\d{4}-\d{4,}/;
const CONTROLLED = "sample-safeguarding-practice-review";
const PUBLIC = "sample-positive-parenting-guide";
const { browser, page, pageErrors } = await open();

async function fillRequester(email, reason) {
  await page.getByLabel("Your name").fill("Report Tester");
  await page.getByLabel("Organisation").fill("Child Rights Research Lab");
  await page.getByLabel("Email address").fill(email);
  await page.locator("select[name='country']").selectOption("gm");
  await page.getByLabel("Why would you like this report?").fill(reason);
  await tick(page, /Haven may contact me about this request/);
  await page.waitForTimeout(2600); // the time trap
  await page.getByRole("button", { name: /Send Request/ }).click();
  return waitFor(async () => (await page.locator("body").innerText()).match(RR_RE)?.[0] ?? null, 30000);
}

console.log("\n1. The placeholder report page");
await page.goto(`${BASE}/resources/annual-report-2025`, { waitUntil: "load" });
await page.waitForTimeout(1500);
const main = await page.locator("main").innerText();
expect(/shared on request/i.test(main) && !/Download PDF/.test(main), "shows the request path, no download");

console.log("\n2. A listed report");
const resourcesBefore = await store("resources");
const countBefore = unwrap(resourcesBefore[CONTROLLED])?.requestCount ?? 0;
await page.goto(`${BASE}/request-a-report?report=${CONTROLLED}`, { waitUntil: "load" });
await page.waitForTimeout(2500);
expect((await page.locator("select[name='report']").inputValue()) === CONTROLLED, "?report= preselected the report");
const ref = await fillRequester(`rr.${Date.now()}@example.org`, "We are reviewing safeguarding practice across partner organisations this year.");
expect(Boolean(ref), `HVN-RR reference on screen (${ref ?? "none"})`);
const rec = ref ? await waitFor(async () => unwrap((await store("reportRequests"))[ref])) : null;
expect(rec && rec.status === "new" && rec.resourceId === CONTROLLED && rec.requestedTitle === null, "stored with the resourceId", JSON.stringify({ s: rec?.status, id: rec?.resourceId }));
const mail = ref ? await heldEmail("report_request_confirmation", ref) : null;
expect(mail && mail.doc.status === "held", "report_request_confirmation held", mail?.doc.status ?? "missing");
const countAfter = unwrap((await store("resources"))[CONTROLLED])?.requestCount ?? 0;
expect(countAfter === countBefore + 1, `requestCount + 1 (${countBefore} → ${countAfter})`);

console.log("\n3. Other / not listed");
await page.goto(`${BASE}/request-a-report`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.locator("select[name='report']").selectOption("other");
await page.getByLabel("Describe the report").fill("Programme evaluation for the Kanifing family support pilot, 2024");
const ref2 = await fillRequester(`rr2.${Date.now()}@example.org`, "A partner foundation asked us for the pilot evaluation before renewing.");
expect(Boolean(ref2), `HVN-RR reference on screen (${ref2 ?? "none"})`);
const rec2 = ref2 ? await waitFor(async () => unwrap((await store("reportRequests"))[ref2])) : null;
expect(rec2 && rec2.resourceId === null && /Kanifing/.test(rec2.requestedTitle ?? ""), "resourceId null + requestedTitle", JSON.stringify({ id: rec2?.resourceId, t: rec2?.requestedTitle }));

console.log("\n4. A free report");
await page.goto(`${BASE}/request-a-report?report=${PUBLIC}`, { waitUntil: "load" });
await page.waitForTimeout(2500);
expect((await page.getByText(/free to download/i).count()) > 0 && (await page.getByLabel("Your name").count()) === 0, "the form swaps to the download");

console.log("\n5. Public download");
const dlBefore = unwrap((await store("resources"))[PUBLIC])?.downloadCount ?? 0;
const res = await fetch(`${BASE}/api/resources/${PUBLIC}/download`, { redirect: "manual" });
const loc = res.headers.get("location") ?? "";
expect(res.status === 302 && /\/m\/public\/resources\//.test(loc), "302 to /m/public/resources/…", `${res.status} ${loc}`);
const dlAfter = await waitFor(async () => {
  const n = unwrap((await store("resources"))[PUBLIC])?.downloadCount ?? 0;
  return n > dlBefore ? n : null;
}, 8000);
expect(Boolean(dlAfter), `downloadCount + 1 (${dlBefore} → ${dlAfter ?? dlBefore})`);
const file = await fetch(new URL(loc, BASE));
expect(file.status === 200 && (file.headers.get("content-type") ?? "").includes("pdf"), "the file is served as a PDF", `${file.status} ${file.headers.get("content-type")}`);

console.log("\n6. A garbage delivery link");
const r = await fetch(`${BASE}/r/garbage`, { redirect: "manual" });
expect(r.status === 302 && /\/link-expired$/.test(r.headers.get("location") ?? ""), "302 to /link-expired", `${r.status} ${r.headers.get("location")}`);
const exp = await fetch(`${BASE}/link-expired`);
expect(exp.status === 200, "the expired page renders");

await finish(browser, pageErrors, "report request");
