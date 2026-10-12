// Adds Haven's practice data to the local data store (idempotent: a repeat run creates nothing).
// Calls POST /api/dev/seed on a running Haven server in practice mode (local backend, not Vercel).
//
//   node scripts/dev/seed.mjs                                 http://localhost:3001 (Haven's dev port)
//   node scripts/dev/seed.mjs --base http://localhost:3100    another server (e.g. `next start`)
//
// Prints what was created per collection. Never prints credentials. Exit code 1 on failure.

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");

async function main() {
  let res;
  try {
    res = await fetch(`${BASE}/api/dev/seed`, { method: "POST", headers: { accept: "application/json" } });
  } catch (err) {
    console.error(`Could not reach ${BASE}. Is the Haven server running? (${err instanceof Error ? err.message : err})`);
    process.exit(1);
  }
  if (res.status === 404) {
    console.error(`${BASE}/api/dev/seed answered 404: practice helpers are only available with the local backend, off Vercel.`);
    process.exit(1);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    console.error(`Unexpected response (${res.status}) from ${BASE}/api/dev/seed.`);
    process.exit(1);
  }
  if (!res.ok || !body.ok) {
    console.error(`Seeding failed (${res.status}): ${body.error ?? "unknown error"}`);
    process.exit(1);
  }
  if (body.alreadySeeded) {
    console.log(`Practice data is already in place (version ${body.version}). Created 0 documents.`);
    return;
  }
  const rows = Object.entries(body.created ?? {}).sort(([a], [b]) => a.localeCompare(b));
  console.log(`Practice data added in ${body.durationMs} ms (version ${body.version}):`);
  for (const [collection, n] of rows) console.log(`  ${collection.padEnd(24)} ${String(n).padStart(4)}`);
  console.log(`  ${"total".padEnd(24)} ${String(body.total).padStart(4)}`);
}

await main();
