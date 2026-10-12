// Leak check for the browser bundles (the A gate): nothing server-only reaches .next/static.
//
//   node scripts/qa/leaks.mjs [--base http://localhost:3100]
//
//  1. No value of a non-NEXT_PUBLIC_ variable from .env.local appears in any client file
//     (only variable NAMES are ever printed, never values).
//  2. No server-only module marker appears in client code (sealing, the store, Firebase Admin,
//     Stripe secret calls, local practice files).
//  3. With --base: the HTML of a public page and the admin sign-in page carries no secret either.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1].replace(/\/+$/, "") : null;
const ROOT = path.resolve(".next/static");

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(js|css|json|txt|map)$/.test(e.name)) out.push(p);
  }
  return out;
}

function parseEnv(text) {
  const vars = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    vars[m[1]] = v;
  }
  return vars;
}

const env = parseEnv(await readFile(".env.local", "utf8").catch(() => ""));
const secrets = Object.entries(env).filter(([k, v]) => !k.startsWith("NEXT_PUBLIC_") && v.length >= 8 && !/^(true|false|local|mailbox|redirect|resend|anthropic|gemini|\d+)$/i.test(v));
const MARKERS = ["sealField", "openSealed", "HAVEN_DATA_KEY", "FIREBASE_SERVICE_ACCOUNT_JSON", "firebase-admin", "LocalJsonAdapter", "STRIPE_SECRET_KEY", "RESEND_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_SERVICE_ACCOUNT_JSON", ".data/auth", "accounts.json", "createLocalAccount", "verifyLocalPassword", "server-only"];

const files = await walk(ROOT);
let problems = 0;
const hits = new Map();
for (const f of files) {
  const text = await readFile(f, "utf8");
  for (const [name, value] of secrets) if (text.includes(value)) hits.set(`value of ${name}`, [...(hits.get(`value of ${name}`) ?? []), path.relative(ROOT, f)]);
  for (const m of MARKERS) if (text.includes(m)) hits.set(`marker "${m}"`, [...(hits.get(`marker "${m}"`) ?? []), path.relative(ROOT, f)]);
}
console.log(`Scanned ${files.length} client files for ${secrets.length} secret values and ${MARKERS.length} server markers.`);
for (const [what, where] of hits) {
  problems++;
  console.log(`  ✗ ${what} in ${where.slice(0, 3).join(", ")}${where.length > 3 ? ` (+${where.length - 3})` : ""}`);
}

if (BASE) {
  for (const p of ["/", "/donate", "/admin/login", "/admin/forgot"]) {
    const html = await fetch(`${BASE}${p}`).then((r) => r.text());
    const bad = secrets.filter(([, v]) => html.includes(v)).map(([k]) => k);
    if (bad.length) {
      problems++;
      console.log(`  ✗ ${p} HTML carries the value of ${bad.join(", ")}`);
    } else console.log(`  ✓ ${p} HTML carries no secret value`);
  }
}

console.log(problems ? `\n${problems} leak(s) found.` : "\nNo leaks.");
process.exit(problems ? 1 : 0);
