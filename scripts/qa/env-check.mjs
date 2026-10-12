// .env.example against the code (PLAN §6.4 Q6): every variable the app reads is documented, and
// every documented variable is read somewhere.
//
//   node scripts/qa/env-check.mjs
//
// Reads come from lib/server/env.ts (the only server reader), NEXT_PUBLIC_* reads in client code, and
// instrumentation.ts. Commented lines in .env.example ("# VERCEL_ENV=") count as documented.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && !e.name.startsWith(".")) out.push(...(await files(p)));
    } else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const read = new Set();
const grab = (text, re) => {
  for (const m of text.matchAll(re)) read.add(m[1]);
};
grab(await readFile("lib/server/env.ts", "utf8"), /process\.env\.([A-Z0-9_]+)/g);
grab(await readFile("instrumentation.ts", "utf8").catch(() => ""), /process\.env\.([A-Z0-9_]+)/g);
for (const f of [...(await files("components")), ...(await files("lib")), ...(await files("app"))]) grab(await readFile(f, "utf8"), /process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g);

const documented = new Set([...(await readFile(".env.example", "utf8")).matchAll(/^#? ?([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
const missing = [...read].filter((v) => !documented.has(v)).sort();
const unread = [...documented].filter((v) => !read.has(v)).sort();
if (missing.length) console.log(`  ✗ read but not in .env.example: ${missing.join(", ")}`);
if (unread.length) console.log(`  ✗ in .env.example but never read: ${unread.join(", ")}`);
console.log(missing.length || unread.length ? "\nenv-check: mismatches found." : `env-check: ${read.size} variables, all documented and all read.`);
process.exit(missing.length || unread.length ? 1 : 0);
