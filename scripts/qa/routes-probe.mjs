// Hostile requests to every API route and token link get a calm refusal (PLAN §6.4 Q3).
//
//   node scripts/qa/routes-probe.mjs --base http://localhost:3100
//
// Signed out (and, where it matters, as a Viewer or from another site), each probe must be refused
// with the expected status family, never a 500, never a stack trace and never data (no email
// address, no HVN reference). Public files must not escape the public/ prefix. Every response carries
// the security headers; admin pages are noindex and never cached; the CSP stays Report-Only.
// Exit code 1 on any failed expectation.

const args = process.argv.slice(2);
const BASE = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3100").replace(/\/+$/, "");
const LEAK = /[^\s"@<>()\\/]+@[^\s"@<>()\\]+\.(?:org|com|net|gm|test|uk)\b|HVN-(?:SR|DN|RG|AP|RR|VA|PE)-\d{4}-\d{4}/i;
const TRACE = /\n\s+at [\w.<>]+ \(|node_modules[\\/]|ENOENT|TypeError:|ReferenceError:/;

const fails = [];
let n = 0;
// The site's own public addresses (footer, contact page) are not data.
const PUBLIC_EMAILS = new Set([...(await (await fetch(`${BASE}/contact`)).text()).matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0].toLowerCase()));
const scrub = (t) => [...PUBLIC_EMAILS].reduce((acc, e) => acc.split(e).join(""), t.replace(/HVN-SR-2026-00(01|12)/g, ""));

async function signIn(role) {
  const r = await fetch(`${BASE}/api/dev/session?role=${role}`, { method: "POST", redirect: "manual" });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => /haven_session=/.test(c)).join("; ");
}

/** expect: "refused" (401/403/404/405/400/422/429 or a redirect to sign-in or a friendly page), "redirect", "ok" (2xx, no data), or a status list. */
async function probe(label, url, { method = "GET", headers = {}, body, expect = "refused", leakOk = false } = {}) {
  n++;
  let r;
  try {
    r = await fetch(`${BASE}${url}`, { method, headers, body, redirect: "manual" });
  } catch (err) {
    fails.push(`${label}: request failed (${err.message})`);
    return null;
  }
  const text = r.status >= 300 && r.status < 400 ? "" : await r.text();
  const loc = r.headers.get("location") ?? "";
  const redirect = r.status >= 300 && r.status < 400;
  const refused = [400, 401, 403, 404, 405, 409, 410, 413, 415, 422, 429].includes(r.status) || (redirect && /\/admin\/login|\/admin\/confirm|\/link-expired|\/donate|\/resources$|\/$/.test(loc));
  const want =
    Array.isArray(expect) ? expect.includes(r.status)
    : expect === "refused" ? refused
    : expect === "redirect" ? redirect
    : expect === "page" ? r.status === 200 || r.status === 404
    : r.status >= 200 && r.status < 300;
  if (!want) fails.push(`${label}: ${r.status}${loc ? ` → ${loc}` : ""} (expected ${expect}) ${text.slice(0, 120).replace(/\s+/g, " ")}`);
  if (r.status >= 500 && !(Array.isArray(expect) && expect.includes(r.status))) fails.push(`${label}: server error ${r.status}`);
  if (TRACE.test(text)) fails.push(`${label}: a stack trace or internal path in the answer`);
  if (!leakOk && LEAK.test(scrub(text))) fails.push(`${label}: data in the answer (${LEAK.exec(scrub(text))?.[0]})`);
  return { status: r.status, headers: r.headers, text };
}

const json = { "Content-Type": "application/json" };
const evil = { Origin: "https://evil.example", "Content-Type": "application/json" };

// Admin APIs, signed out.
await probe("pulse signed out", "/api/admin/pulse");
await probe("search signed out", "/api/admin/search?q=a");
await probe("media upload signed out", "/api/admin/media/upload", { method: "POST", body: "x" });
await probe("studio preview signed out", "/api/admin/studio/preview?path=/");
await probe("upload sign signed out", "/api/admin/uploads/sign", { method: "POST", headers: json, body: "{}" });
await probe("upload complete signed out", "/api/admin/uploads/complete", { method: "POST", headers: json, body: "{}" });
await probe("local upload signed out", "/api/admin/uploads/local/abc123");
await probe("export signed out", "/admin/export/donations");

// Admin APIs as a Viewer: no uploads, no exports, no unknown datasets.
const viewer = await signIn("viewer");
await probe("media upload as viewer", "/api/admin/media/upload", { method: "POST", headers: { cookie: viewer }, body: "x" });
await probe("upload sign as viewer", "/api/admin/uploads/sign", { method: "POST", headers: { cookie: viewer, ...json }, body: JSON.stringify({ purpose: "media", contentType: "image/webp", size: 1000 }) });
await probe("export as viewer", "/admin/export/donations?contact=1", { headers: { cookie: viewer } });
await probe("unknown export", "/admin/export/safeguardingConcerns", { headers: { cookie: viewer } });
const superAdmin = await signIn("super_admin");
await probe("concerns are not exportable", "/admin/export/safeguardingConcerns", { headers: { cookie: superAdmin } });
await probe("search from another site", "/api/admin/search?q=a", { headers: { cookie: viewer, Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }, expect: [200, 403] });

// Scheduled jobs.
for (const job of ["tick", "retention", "editorial"]) {
  await probe(`cron ${job} no secret`, `/api/cron/${job}`, { expect: [401, 403, 404] });
  await probe(`cron ${job} wrong secret`, `/api/cron/${job}`, { headers: { Authorization: "Bearer wrong-secret-value-000000000000" }, expect: [401, 403, 404] });
}

// Webhooks without valid signatures.
await probe("stripe webhook unsigned", "/api/stripe/webhook", { method: "POST", headers: json, body: JSON.stringify({ id: "evt_x", type: "checkout.session.completed" }), expect: [400, 401, 404, 503] });
await probe("stripe webhook bad signature", "/api/stripe/webhook", { method: "POST", headers: { ...json, "Stripe-Signature": "t=1,v1=00" }, body: "{}", expect: [400, 401, 404, 503] });
await probe("email webhook unsigned", "/api/email/webhook", { method: "POST", headers: json, body: JSON.stringify({ type: "email.bounced", data: { to: ["a@b.org"] } }), expect: [400, 401, 404, 503] });

// Donor links and token routes with garbage.
for (const [label, url] of [
  ["stripe portal", "/api/stripe/portal?t=garbage"],
  ["stripe return", "/api/stripe/return?session_id=cs_test_garbage"],
  ["pay link", "/api/donations/pay?t=garbage"],
  ["report link", "/r/garbage"],
]) await probe(label, url, { expect: "refused" });
await probe("donation garbage", "/api/donations", { method: "POST", headers: json, body: "{not json" });
await probe("donation from another site", "/api/donations", { method: "POST", headers: evil, body: "{}" });
await probe("public upload empty", "/api/uploads", { method: "POST", body: "" });
await probe("public upload from another site", "/api/uploads", { method: "POST", headers: { Origin: "https://evil.example" }, body: "x" });
await probe("session bad token", "/api/auth/session", { method: "POST", headers: json, body: JSON.stringify({ idToken: "garbage" }), expect: [400, 401, 403, 404, 429, 503] });
await probe("session from another site", "/api/auth/session", { method: "POST", headers: evil, body: JSON.stringify({ idToken: "garbage" }), expect: [400, 401, 403, 404] });
await probe("practice sign-in from another site", "/api/dev/session?role=super_admin", { method: "POST", headers: { Origin: "https://evil.example" }, expect: [403, 404] });
await probe("resource download unknown", "/api/resources/no-such-thing/download", { expect: "refused" });

// Token pages: a friendly page, never an error or data.
for (const url of ["/unsubscribe?t=garbage", "/newsletter/confirm?t=garbage", "/donate/manage?t=garbage", "/donate/receipt?t=garbage", "/donate/thank-you?session_id=cs_garbage", "/admin/invite/garbage", "/admin/reset/garbage", "/privacy/request?t=garbage"]) {
  await probe(`page ${url}`, url, { expect: "page" });
}

// Public files: only public/media and public/resources, never a path out.
for (const url of [
  "/m/private/uploads/x/y",
  "/m/quarantine/a/b/c",
  "/m/public/media/..%2F..%2F..%2F.env.local",
  "/m/public/media/x/..%2F..%2F..%2Fpackage.json",
  "/m/public/resources/%2e%2e/%2e%2e/.env.local",
  "/m/public/media/nope/abc.webp",
  "/api/dev/files/..%2F..%2F.env.local",
]) await probe(`file ${url}`, url, { expect: [400, 403, 404, 410] });

// Headers.
const home = await fetch(`${BASE}/`, { redirect: "manual" });
const adminLogin = await fetch(`${BASE}/admin/login`, { redirect: "manual" });
const h = (r, k) => r.headers.get(k) ?? "";
if (!h(home, "content-security-policy-report-only")) fails.push("public pages: no Content-Security-Policy-Report-Only");
if (h(home, "content-security-policy")) fails.push("public pages: an enforced CSP (it should stay Report-Only until the reports are clean)");
for (const [k, v] of [["x-frame-options", /SAMEORIGIN/i], ["x-content-type-options", /nosniff/], ["strict-transport-security", /max-age=\d{7,}/], ["referrer-policy", /strict-origin-when-cross-origin/], ["permissions-policy", /camera=\(\)/]]) {
  if (!v.test(h(home, k))) fails.push(`public pages: ${k} is "${h(home, k)}"`);
}
if (!/noindex/.test(h(adminLogin, "x-robots-tag"))) fails.push("admin: not noindex");
if (!/no-store/.test(h(adminLogin, "cache-control"))) fails.push(`admin: cache-control is "${h(adminLogin, "cache-control")}"`);
const robots = await (await fetch(`${BASE}/robots.txt`)).text();
if (!/Disallow:\s*\/admin/i.test(robots)) fails.push("robots.txt does not disallow /admin");

// Known framework behaviour (not ours): a malformed %-sequence in a dynamic segment (/r/%E0%A4%A) gets
// Next's bare "Internal Server Error" 500 with no detail, before any app code runs.
const bad = await fetch(`${BASE}/r/%E0%A4%A`, { redirect: "manual" });
const badText = await bad.text();
if (bad.status >= 500 && (TRACE.test(badText) || badText.length > 200)) fails.push("malformed URL: the error page says more than \"Internal Server Error\"");
console.log(`  · malformed %-sequence in a dynamic URL: ${bad.status} (framework; no detail in the answer)`);

for (const f of fails) console.log(`  ✗ ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s) in ${n} probes.` : `\n${n} probes: every route refuses calmly and the headers are in place.`);
process.exit(fails.length ? 1 : 0);
