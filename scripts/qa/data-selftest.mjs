// Runs Haven's data-layer selftest suites against a running server in practice mode.
// Calls GET /api/dev/selftest?suite=<name> for each suite and prints every case.
//
//   node scripts/qa/data-selftest.mjs                                   every suite, http://localhost:3001
//   node scripts/qa/data-selftest.mjs --base http://localhost:3100      another server
//   node scripts/qa/data-selftest.mjs --suite store,refs                selected suites
//   node scripts/qa/data-selftest.mjs --cookie jar.txt                  send a session cookie (curl -c jar)
//
// Exit code 1 when any case fails or a suite cannot run. Suites with no cases yet are reported as such.

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");
const ONLY = flag("--suite", null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const JAR = flag("--cookie", null);

/** Cookies from a curl cookie jar (Netscape format) for the server's host. */
async function cookieHeader() {
  if (!JAR) return null;
  const text = await readFile(JAR, "utf8");
  const pairs = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/^#HttpOnly_/, "");
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cols = trimmed.split("\t");
    if (cols.length >= 7) pairs.push(`${cols[5]}=${cols[6]}`);
  }
  return pairs.length ? pairs.join("; ") : null;
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // not JSON
  }
  return { res, body };
}

async function main() {
  const cookie = await cookieHeader();
  const headers = { accept: "application/json", ...(cookie ? { cookie } : {}) };

  let suites = ONLY;
  if (!suites) {
    let probe;
    try {
      probe = await getJson(`${BASE}/api/dev/selftest?suite=__list__`, headers);
    } catch (err) {
      console.error(`Could not reach ${BASE}. Is the Haven server running? (${err instanceof Error ? err.message : err})`);
      process.exit(1);
    }
    if (probe.res.status === 404 && Array.isArray(probe.body?.suites)) {
      suites = probe.body.suites.filter((s) => s !== "all");
    } else {
      console.error(`${BASE}/api/dev/selftest is not available (status ${probe.res.status}). Practice helpers need the local backend, off Vercel.`);
      process.exit(1);
    }
  }

  let failed = 0;
  let passed = 0;
  const started = Date.now();
  for (const name of suites) {
    let out;
    try {
      out = await getJson(`${BASE}/api/dev/selftest?suite=${encodeURIComponent(name)}`, headers);
    } catch (err) {
      console.log(`\n✗ ${name}: request failed (${err instanceof Error ? err.message : err})`);
      failed++;
      continue;
    }
    const { res, body } = out;
    if (!res.ok || !body || !Array.isArray(body.cases)) {
      console.log(`\n✗ ${name}: HTTP ${res.status}${body?.error ? ` (${body.error})` : ""}`);
      failed++;
      continue;
    }
    const mark = body.failed === 0 ? "✓" : "✗";
    console.log(`\n${mark} ${name}: ${body.passed} passed, ${body.failed} failed${body.cases.length === 0 ? " (no cases yet)" : ""}`);
    for (const c of body.cases) {
      console.log(`   ${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? `  — ${c.detail}` : ""}`);
    }
    passed += body.passed;
    failed += body.failed;
  }
  console.log(`\n${failed === 0 ? "All passed" : "FAILURES"}: ${passed} passed, ${failed} failed in ${Date.now() - started} ms (${BASE})`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
