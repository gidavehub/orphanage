// Acceptance check for POST /api/donations (P3; public-pages §4.7, integrations §3.11, PLAN D64–D71).
// Runs against a dev or practice server in local mode and reads the practice store under .data/.
//
//   node scripts/qa/forms/donation.mjs --base http://localhost:3001
//
// Every request uses a fresh fake client IP (X-Forwarded-For) so earlier runs never trip the limit.
// Exit code 1 on any failed expectation. Never prints secrets: the donor id is only compared, not derived.

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");
const DATA = path.resolve(flag("--data", ".data"));

const fails = [];
const expect = (ok, msg, extra) => {
  if (ok) console.log(`  ✓ ${msg}`);
  else {
    fails.push(msg);
    console.log(`  ✗ ${msg}${extra !== undefined ? `\n      ${typeof extra === "string" ? extra : JSON.stringify(extra).slice(0, 400)}` : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ip = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;

async function store(collection) {
  try {
    return JSON.parse(await readFile(path.join(DATA, "db", collection, "_docs.json"), "utf8"));
  } catch {
    return {};
  }
}
async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function post(body, { from = ip(), origin = BASE } = {}) {
  const res = await fetch(`${BASE}/api/donations`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": from },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const donor = (tag) => ({
  fullName: `QA Donor ${tag}`,
  email: `qa.donor+${tag}@example.org`,
  phone: "+220 700 0000",
  country: "gm",
  type: "individual",
  anonymous: false,
  updates: true,
});

const cash = (over = {}) => ({
  mode: "cash",
  submissionId: randomUUID(),
  cause: "education",
  donor: donor("cash"),
  attribution: { utmSource: "qa", utmMedium: "script", utmCampaign: "p3" },
  company_website: "",
  _elapsed: 6000,
  currency: "USD",
  amount: 50,
  frequency: "monthly",
  coverFees: false,
  ...over,
});

const REF_RE = /^HVN-DN-\d{4}-\d{4,}$/;

async function waitForOutbox(id, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const outbox = await store("emailOutbox");
    if (outbox[id] && outbox[id].status !== "queued" && outbox[id].status !== "sending") return outbox[id];
    await sleep(500);
  }
  return (await store("emailOutbox"))[id] ?? null;
}

const page = await fetch(`${BASE}/donate`).then((r) => r.text()).catch(() => "");
if (!/<title>[^<]*Haven/.test(page)) {
  console.log(`  ✗ ${BASE}/donate is not Haven (check --base)`);
  process.exit(1);
}

console.log("\nCash pledge (USD 50, monthly, no Stripe key)");
const before = Object.keys(await store("donations")).length;
const c1 = await post(cash());
expect(c1.status === 200 && c1.json?.kind === "pledge", "answers { kind: 'pledge', next }", c1);
const next = c1.json?.next ?? "";
const nextUrl = new URL(next || "/", BASE);
const ref = nextUrl.searchParams.get("ref") ?? "";
expect(nextUrl.pathname === "/donate/thank-you" && REF_RE.test(ref) && !!nextUrl.searchParams.get("t"), `next is /donate/thank-you?ref=HVN-DN-…&t=… (${ref})`);
const donations = await store("donations");
const d = donations[ref];
expect(!!d, "a donation record exists under its reference");
if (d) {
  expect(d.status === "pledged" && d.kind === "cash", "status pledged, kind cash");
  expect(d.cash?.amount?.amountMinor === 5000 && d.cash?.amount?.currency === "USD", "amount stored as 5000 minor units USD");
  expect(d.frequency === "monthly", "frequency monthly (one_time token in code)");
  expect(d.causeSlug === "education" && d.preferredTarget?.type === "programme", "cause education → programme target");
  expect(d.attribution?.utmCampaign === "p3", "UTM attribution stored");
  expect(d.updatesConsent && typeof d.updatesConsent.at === "number", "updates consent stamped");
  expect(typeof d.donorId === "string" && /^[A-Za-z0-9_-]{32}$/.test(d.donorId) && !d.donorId.includes("@"), "donorId is a 32-char hash, not the email");
  const donors = await store("donors");
  expect(donors[d.donorId]?.emailLower === "qa.donor+cash@example.org", "donor upserted under donors/{emailHash}");
  expect(Object.keys(donations).length === before + 1, "exactly one new donation");
}
const ob = await waitForOutbox(`pledge_instructions~${ref}`);
expect(ob?.status === "held", "outbox pledge_instructions~ref is held (mailbox mode)", ob?.status);
expect(ob && /HVN-DN-/.test(ob.subject) && !/QA Donor/.test(ob.subject), "subject carries only the reference", ob?.subject);
expect(await exists(path.join(DATA, "mailbox", `pledge_instructions~${ref}.html`)), "mailbox file written");

console.log("\nThank-you page");
const ty = await fetch(new URL(next, BASE)).then(async (r) => ({ status: r.status, html: await r.text() }));
expect(ty.status === 200 && ty.html.includes(ref) && /How to Pay/i.test(ty.html), "pledge variant shows the reference and how to pay");
expect(/noindex/.test(ty.html), "thank-you is noindex");
expect(!ty.html.includes("qa.donor+cash@example.org"), "the full email address never appears");
const tampered = new URL(next, BASE);
tampered.searchParams.set("t", `${tampered.searchParams.get("t")}x`);
const tg = await fetch(tampered).then((r) => r.text());
// (The URL itself, with its ref, is echoed in Next's router payload, so look at the rendered parts.)
expect(!/Quote this reference/.test(tg) && !/>Reference</.test(tg) && /Thank you/i.test(tg), "a tampered t shows the generic variant (no reference, no details)");

console.log("\nDouble submit");
const sid = randomUUID();
const a = await post(cash({ submissionId: sid, donor: donor("dupe") }));
const b = await post(cash({ submissionId: sid, donor: donor("dupe") }));
const refA = new URL(a.json?.next ?? "/", BASE).searchParams.get("ref");
const refB = new URL(b.json?.next ?? "/", BASE).searchParams.get("ref");
expect(!!refA && refA === refB, "the same submissionId returns the same reference", { refA, refB });

console.log("\nIn-kind offer");
const k = await post({
  mode: "in_kind",
  submissionId: randomUUID(),
  cause: "eid-clothes-gifts",
  donor: donor("kind"),
  company_website: "",
  _elapsed: 9000,
  items: ["clothing", "bedding"],
  description: "Two boxes of children's clothes and four blankets, all washed.",
  condition: "good",
  estValue: { amount: 1500, currency: "GMD" },
  handover: "collection",
  location: "Serrekunda",
});
const kref = new URL(k.json?.next ?? "/", BASE).searchParams.get("ref") ?? "";
expect(k.status === 200 && k.json?.kind === "pledge" && REF_RE.test(kref), `in-kind answers a pledge with a DN reference (${kref})`, k);
const kd = (await store("donations"))[kref];
expect(kd?.kind === "in_kind" && kd?.inKind?.categories?.includes("bedding") && kd?.inKind?.delivery === "collection", "in-kind record keeps items and handover");
const kob = await waitForOutbox(`inkind_follow_up~${kref}`);
expect(kob?.status === "held", "outbox inkind_follow_up~ref is held", kob?.status);

console.log("\nGMD gift");
const g = await post(cash({ currency: "GMD", amount: 2500, frequency: "one_time", cause: "eid-clothes-gifts", method: "wave", donor: donor("gmd") }));
const gref = new URL(g.json?.next ?? "/", BASE).searchParams.get("ref") ?? "";
expect(g.json?.kind === "pledge" && REF_RE.test(gref), "GMD pledges (GMD routes locally even when card payments are on)", g);
const gd = (await store("donations"))[gref];
expect(gd?.cash?.localMethod === "wave" && gd?.cash?.method === "mobile_money", "method chip recorded (Wave → mobile money)");

console.log("\nCover fees");
const f = await post(cash({ coverFees: true, amount: 100, frequency: "one_time", donor: donor("fees") }));
const fd = (await store("donations"))[new URL(f.json?.next ?? "/", BASE).searchParams.get("ref") ?? ""];
expect(fd?.cash?.baseAmount?.amountMinor === 10000 && fd?.cash?.amount?.amountMinor > 10000 && fd?.cash?.coverFees === true, "cover fees: base kept, charged amount topped up", fd?.cash);

console.log("\nBots and bad input");
const count0 = Object.keys(await store("donations")).length;
const hp = await post(cash({ company_website: "http://spam.example", donor: donor("bot") }));
expect(hp.status === 200 && hp.json?.kind === "pledge" && !new URL(hp.json?.next ?? "/", BASE).searchParams.get("ref"), "honeypot → fake success (generic thank-you, no reference)", hp);
const fast = await post(cash({ _elapsed: 300, donor: donor("fast") }));
expect(fast.status === 200 && !new URL(fast.json?.next ?? "/", BASE).searchParams.get("ref"), "faster than 2.5 s → fake success", fast);
expect(Object.keys(await store("donations")).length === count0, "bots store nothing");
const low = await post(cash({ amount: 2, donor: donor("low") }));
expect(low.status === 422 && !!low.json?.fieldErrors?.amount, "below the minimum → 422 with an amount error", low);
const unknown = await post(cash({ cause: "no-such-cause", donor: donor("unknown") }));
expect(unknown.status === 422 && !!unknown.json?.fieldErrors?.cause, "unknown cause → 422 with a cause error", unknown);
const badEmail = await post(cash({ donor: { ...donor("bad"), email: "not-an-email" } }));
expect(badEmail.status === 422 && !!badEmail.json?.fieldErrors?.["donor.email"], "bad email → donor.email error", badEmail);
const cross = await post(cash(), { origin: "https://evil.example" });
expect(cross.status === 403, "cross-site POST → 403", cross.status);

console.log("\nRate limit (10 per hour per IP)");
const from = ip();
const statuses = [];
for (let i = 0; i < 11; i++) {
  // Invalid on purpose (no donor): counted by the limiter, never stored.
  const r = await post({ ...cash(), donor: undefined }, { from });
  statuses.push(r.status);
}
expect(statuses.slice(0, 10).every((s) => s === 422) && statuses[10] === 429, "the 11th request in an hour is rate-limited (429)", statuses.join(","));

console.log(fails.length ? `\n  ${fails.length} failure(s)` : "\n  all passed");
process.exit(fails.length ? 1 : 0);
