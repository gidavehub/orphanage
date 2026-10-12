// Runs every public form's acceptance check in turn (PLAN §6.4 Q5).
//
//   node scripts/qa/forms.mjs --base http://localhost:3100 [--only support,concern]
//
// Each script in scripts/qa/forms/ (except _lib.mjs) runs as its own process with the same --base;
// a summary lists which passed. Exit 1 when any failed.

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = flag("--base", "http://localhost:3100");
const ONLY = flag("--only", null)?.split(",");
const DIR = path.join("scripts", "qa", "forms");

const names = (await readdir(DIR))
  .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
  .map((f) => f.replace(/\.mjs$/, ""))
  .filter((n) => !ONLY || ONLY.includes(n));

const run = (name) =>
  new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(DIR, `${name}.mjs`), "--base", BASE], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ name, code, out, secs: Math.round((Date.now() - started) / 1000) }));
  });

const results = [];
for (const name of names) {
  const r = await run(name);
  results.push(r);
  console.log(`  ${r.code === 0 ? "✓" : "✗"} ${name} (${r.secs} s)`);
  if (r.code !== 0) {
    const failed = r.out.split(/\r?\n/).filter((l) => /✗|Error|error/.test(l)).slice(0, 8);
    for (const l of failed) console.log(`      ${l.trim()}`);
  }
}
const bad = results.filter((r) => r.code !== 0);
console.log(bad.length ? `\n${bad.length} of ${results.length} form checks failed.` : `\nAll ${results.length} form checks passed.`);
process.exit(bad.length ? 1 : 0);
