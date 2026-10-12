// Cron check for I6 (integrations §7).
//
//   node scripts/qa/cron.mjs [--base http://localhost:3001]
//
//  - /api/cron/tick and /api/cron/retention answer 401 without the bearer;
//  - with CRON_SECRET (from the environment or .env.local; never printed) the tick answers a JSON
//    summary with every step, and two concurrent ticks give one "locked";
//  - the retention dry run lists due paths and deletes nothing.

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const BASE = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3001").replace(/\/+$/, "");
const fails = [];
const expect = (ok, msg, extra) => {
  if (ok) console.log(`  ✓ ${msg}`);
  else {
    fails.push(msg);
    console.log(`  ✗ ${msg}${extra !== undefined ? `  (${String(extra).slice(0, 300)})` : ""}`);
  }
};

async function secret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const text = await readFile(".env.local", "utf8").catch(() => "");
  const m = text.match(/^\s*CRON_SECRET\s*=\s*"?([^"\r\n]+)"?\s*$/m);
  return m ? m[1] : null;
}

const get = (path, token) => fetch(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

expect((await get("/api/cron/tick")).status === 401, "tick without the bearer → 401");
expect((await get("/api/cron/retention")).status === 401, "retention without the bearer → 401");
expect((await get("/api/cron/tick", "wrong-secret")).status === 401, "tick with a wrong secret → 401");

const token = await secret();
if (!token) {
  console.log("  · CRON_SECRET is not set: skipping the authorised checks.");
} else {
  const [a, b] = await Promise.all([get("/api/cron/tick", token), get("/api/cron/tick", token)]);
  const [ja, jb] = [await a.json(), await b.json()];
  const ran = [ja, jb].find((j) => j.steps);
  const locked = [ja, jb].filter((j) => j.locked === true).length;
  expect(a.status === 200 && b.status === 200, "both concurrent ticks answer 200");
  expect(Boolean(ran) && locked === 1, "one tick runs, the other reports locked", JSON.stringify({ a: Object.keys(ja), b: Object.keys(jb) }));
  if (ran) {
    const names = ["outbox", "posts", "closeNoResponse", "followUps", "concernBackstop", "stripeSweep", "stripeEnrich"];
    expect(names.every((n) => n in ran.steps), "the summary lists every step", Object.keys(ran.steps).join(","));
    const failed = Object.entries(ran.steps).filter(([, s]) => !s.ok);
    expect(failed.length === 0, "every step succeeded", failed.map(([k, s]) => `${k}: ${s.error}`).join(" | "));
    console.log(`  · daily block: ${typeof ran.daily === "string" ? ran.daily : `ran (${Object.keys(ran.daily).join(", ")})`}`);
  }
  const r = await get("/api/cron/retention?dryRun=1", token);
  const jr = await r.json();
  expect(r.status === 200 && jr.dryRun === true && jr.deleted === 0 && Array.isArray(jr.due), `retention dry run lists ${jr.due?.length ?? "?"} due item(s) and deletes nothing`);
  expect((jr.due ?? []).every((d) => !d.path.startsWith("safeguardingConcerns/") || d.mode === "review"), "safeguarding concerns are only ever for review");
}

console.log(fails.length ? `\n${fails.length} failed.` : "\nCron checks passed.");
process.exit(fails.length ? 1 : 0);
