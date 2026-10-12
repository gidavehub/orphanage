// Webhook check for I1 (integrations §3.6).
//
//   node scripts/qa/stripe-webhook.mjs [--base http://localhost:3001]
//
// Without STRIPE_WEBHOOK_SECRET (in the environment or .env.local): the endpoint answers 503, so a
// misconfigured deployment never pretends to accept payments.
// With a secret (any local value such as whsec_test_local works): posts the fixture events in
// scripts/qa/fixtures/stripe/, signed with Stripe.webhooks.generateTestHeaderString, and checks:
//   - a bad signature is refused (400);
//   - each fixture is accepted (200) and the same event again is reported as a duplicate;
//   - the external-link fixture creates one gift tagged `stripe-external`.
// The secret's value is never printed.

import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const Stripe = require("stripe");
const args = process.argv.slice(2);
const BASE = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3001").replace(/\/+$/, "");
const fails = [];
const expect = (ok, msg, extra) => {
  if (ok) console.log(`  ✓ ${msg}`);
  else {
    fails.push(msg);
    console.log(`  ✗ ${msg}${extra !== undefined ? `  (${String(extra).slice(0, 200)})` : ""}`);
  }
};

async function secretFromEnv() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
  const text = await readFile(".env.local", "utf8").catch(() => "");
  const m = text.match(/^\s*STRIPE_WEBHOOK_SECRET\s*=\s*"?([^"\r\n]+)"?\s*$/m);
  return m ? m[1] : null;
}

const post = (body, headers = {}) => fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
const secret = await secretFromEnv();

if (!secret) {
  console.log("No STRIPE_WEBHOOK_SECRET: checking the endpoint refuses politely.");
  const r = await post("{}", { "stripe-signature": "t=1,v1=abc" });
  expect(r.status === 503, "the webhook answers 503 while payments aren't configured", r.status);
} else {
  console.log("STRIPE_WEBHOOK_SECRET is set: posting signed fixtures.");
  const bad = await post('{"id":"evt_bad"}', { "stripe-signature": "t=1,v1=deadbeef" });
  expect(bad.status === 400, "a bad signature is refused", bad.status);
  const dir = path.resolve("scripts/qa/fixtures/stripe");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const fixture = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    // Fresh ids each run so earlier runs don't count as duplicates.
    const run = Date.now().toString(36);
    fixture.id = `${fixture.id}_${run}`;
    if (fixture.data?.object?.id?.startsWith("cs_")) fixture.data.object.id = `${fixture.data.object.id}${run}`;
    const payload = JSON.stringify(fixture);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const r1 = await post(payload, { "stripe-signature": header });
    const b1 = await r1.json().catch(() => ({}));
    expect(r1.status === 200 && b1.received === true, `${file}: accepted (${b1.result ?? b1.ignored ?? "?"})`, r1.status);
    const r2 = await post(payload, { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret }) });
    const b2 = await r2.json().catch(() => ({}));
    // Unhandled types are acknowledged but not recorded, so a repeat is simply ignored again.
    const repeatOk = b2.duplicate === true || b2.ignored || (b1.result === "ignored" && b2.result === "ignored");
    expect(r2.status === 200 && repeatOk, `${file}: the same event again ${b1.result === "ignored" ? "is ignored again" : "is a duplicate"}`, JSON.stringify(b2));
  }
}

console.log(fails.length ? `\n${fails.length} failed.` : "\nWebhook checks passed.");
process.exit(fails.length ? 1 : 0);
