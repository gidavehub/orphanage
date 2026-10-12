// Every exported async entry point of the admin Data Access Layer checks who is asking (PLAN §6.4 Q3).
//
//   node scripts/qa/dal-guards.mjs
//
// A static scan of lib/server/dal/*.ts. An exported async function passes when its body calls
// requireStaff(…), or calls another DAL function that does (followed through the files), or takes the
// Viewer that requireStaff returned as a parameter (a helper for an entry point that already checked).
// Anything else is listed: it must be guarded or moved out of the DAL.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIR = "lib/server/dal";
const fns = new Map(); // name → { file, body, takesViewer, exported }

for (const f of (await readdir(DIR)).filter((f) => f.endsWith(".ts"))) {
  const src = (await readFile(path.join(DIR, f), "utf8")).replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^(export )?async function (\w+)\s*(?:<[^>]*>)?\(/.exec(lines[i]);
    if (!m) continue;
    let end = i;
    while (end < lines.length && lines[end] !== "}") end++;
    const body = lines.slice(i, end + 1).join("\n");
    const sig = body.slice(0, body.indexOf("{\n") + 1 || body.indexOf("{"));
    fns.set(`${f}:${m[2]}`, { file: f, name: m[2], body, exported: !!m[1], takesViewer: /\b\w+\s*:\s*Viewer\b/.test(sig) });
  }
}

const byName = new Map();
for (const [key, fn] of fns) byName.set(fn.name, [...(byName.get(fn.name) ?? []), key]);

const guarded = new Set();
for (const [key, fn] of fns) if (/\brequireStaff\(/.test(fn.body) || fn.takesViewer) guarded.add(key);
for (let changed = true; changed; ) {
  changed = false;
  for (const [key, fn] of fns) {
    if (guarded.has(key)) continue;
    const calls = [...fn.body.matchAll(/\b(\w+)\(/g)].map((m) => m[1]).filter((n) => n !== fn.name);
    if (calls.some((n) => (byName.get(n) ?? []).some((k) => guarded.has(k)))) {
      guarded.add(key);
      changed = true;
    }
  }
}

// Building blocks that return no record data, each called only from checked entry points.
const ALLOWED = new Map([["_shared.ts:staffRefs", "the team's display names, for showing who did what"]]);

const exported = [...fns.entries()].filter(([, fn]) => fn.exported);
const open = exported.filter(([key]) => !guarded.has(key) && !ALLOWED.has(key));
for (const [, fn] of open) console.log(`  ✗ ${fn.file} ${fn.name}: no requireStaff, no Viewer parameter`);
const viewerOnly = exported.filter(([key, fn]) => guarded.has(key) && fn.takesViewer && !/\brequireStaff\(/.test(fn.body)).map(([, fn]) => `${fn.file.replace(/\.ts$/, "")}.${fn.name}`);
console.log(`  ${exported.length} exported async DAL functions; ${viewerOnly.length} take a Viewer from their caller: ${viewerOnly.join(", ")}`);
for (const [key, why] of ALLOWED) console.log(`  · ${key.replace(".ts:", ".")} allowed: ${why}`);
console.log(open.length ? `\n${open.length} unguarded DAL function(s).` : "\nEvery DAL entry point checks who is asking.");
process.exit(open.length ? 1 : 0);
