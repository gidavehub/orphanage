// People-mix audit over every manifest asset that shows people (the `eth` tag).
//
//   node scripts/media/audit-mix.mjs
//
// Brief (2026-10-02): about one third Black, the rest South Asian, Southeast Asian and
// Arab; no white people. Exits 1 if the Black share leaves 30–36% or an untagged or
// "white" asset shows up.

import { images, videos } from "./manifest.mjs";

const people = [...images.filter((s) => s.kind !== "brush" && s.kind !== "chroma"), ...videos];
const counts = {};
const untagged = [];
for (const a of people) {
  if (!a.eth) untagged.push(a.id);
  else counts[a.eth] = (counts[a.eth] ?? 0) + 1;
}
const total = people.length - untagged.length;
const pct = (n) => `${((n / total) * 100).toFixed(0)}%`;

console.log(`\n  ${total} people assets`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ${String(n).padStart(3)}  ${pct(n)}`);

const black = (counts.black ?? 0) / total;
const fails = [];
if (black < 0.3 || black > 0.36) fails.push(`Black share ${pct(counts.black ?? 0)} is outside 30–36%`);
if (counts.white) fails.push(`${counts.white} asset(s) tagged white`);
if (untagged.length) fails.push(`untagged: ${untagged.join(", ")}`);
console.log(fails.length ? `\n  ✗ ${fails.join("\n  ✗ ")}` : "\n  ✓ mix within brief");
process.exit(fails.length ? 1 : 0);
