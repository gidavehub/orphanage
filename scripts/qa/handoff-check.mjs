// Every seed file with a `// CLIENT` placeholder is listed in HANDOFF.md (PLAN §6.4 Q6).
//
//   node scripts/qa/handoff-check.mjs

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const handoff = await readFile("HANDOFF.md", "utf8");
// index.ts holds the before-launch checklist mechanism itself, not a placeholder.
const seeds = (await files("content/seed")).map((f) => f.split(path.sep).join("/")).filter((f) => !f.endsWith("/index.ts"));
const missing = [];
let markers = 0;
for (const f of seeds) {
  const n = ((await readFile(f, "utf8")).match(/\/\/ CLIENT/g) ?? []).length;
  if (!n) continue;
  markers += n;
  if (!handoff.includes(f)) missing.push(`${f} (${n})`);
}
if (missing.length) console.log(`  ✗ not listed in HANDOFF.md: ${missing.join(", ")}`);
console.log(missing.length ? "\nhandoff-check: some placeholders are not listed." : `handoff-check: ${markers} placeholders in ${seeds.length} seed files, every file listed.`);
process.exit(missing.length ? 1 : 0);
