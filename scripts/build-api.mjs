#!/usr/bin/env node
// Builds Haven's back end for Firebase Functions (functions/index.js): the app's own Next.js build,
// copied to functions/app, so app/api/** runs there exactly as written. The pages are in it too but
// never asked for: Vercel serves them.
//
//   npm run deploy:api      (this script, then firebase deploy --only functions)
//
// The build takes Vercel's production NEXT_PUBLIC_* values (Next writes them into the code, and this
// computer's .env.local holds practice ones). functions/.env gets the plain settings the function
// needs; its secrets live in Secret Manager. Vercel keeps secret values unreadable, so only plain
// values are pulled: the temporary file is deleted at once and nothing is printed.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS = path.join(ROOT, "functions");
const OUT = path.join(FUNCTIONS, "app");
const NEXT = path.join(ROOT, ".next");

/** The function's own address (gcloud functions describe api --region us-central1). */
const API_ORIGIN = process.env.HAVEN_API_ORIGIN ?? "";
/** Plain production values the function uses, besides NEXT_PUBLIC_*. */
const PLAIN = ["EMAIL_FROM", "EMAIL_REPLY_TO"];

function productionValues() {
  const tmp = path.join(os.tmpdir(), `haven-prod-${process.pid}.env`);
  try {
    execSync(`npx vercel env pull "${tmp}" --environment=production --yes`, { cwd: ROOT, stdio: "ignore", timeout: 180_000 });
    const out = {};
    for (const line of fs.readFileSync(tmp, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z][A-Z0-9_]*)="?(.*?)"?$/.exec(line);
      if (!m) continue;
      const [, key, value] = m;
      if ((key.startsWith("NEXT_PUBLIC_") || PLAIN.includes(key)) && value) out[key] = value.replace(/\\n/g, "\n");
    }
    return out;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const prod = productionValues();
for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", ...PLAIN]) {
  if (!prod[key]) throw new Error(`Vercel production has no ${key}.`);
}
const vercelProject = JSON.parse(fs.readFileSync(path.join(ROOT, ".vercel", "project.json"), "utf8"));

// Build with production's public values, and nothing that would make Next think it is on Vercel.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("VERCEL")));
execSync("npx next build", { cwd: ROOT, stdio: "inherit", env: { ...env, ...prod } });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// Left out: the build cache, development and tracing files, types, and the browser's files (Vercel
// serves those).
const SKIP = new Set(["cache", "dev", "trace", "trace-build", "diagnostics", "types", "turbopack", "static", "node_modules"]);
for (const name of fs.readdirSync(NEXT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(NEXT, name), path.join(OUT, ".next", name), { recursive: true, dereference: true });
}

// Turbopack asks for its external packages under hashed names (.next/node_modules/sharp-20c6…), links
// into this computer's node_modules that Firebase never uploads. In the function's copy each is asked
// for by its real name, installed with the function (functions/package.json).
const hashed = path.join(NEXT, "node_modules");
const renames = fs.existsSync(hashed) ? fs.readdirSync(hashed).map((name) => [name, name.replace(/-[0-9a-f]{16}$/, "")]) : [];
const rewrite = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rewrite(p);
    else if (/\.(c|m)?js$/.test(e.name)) {
      const s = fs.readFileSync(p, "utf8");
      let t = s;
      for (const [from, to] of renames) t = t.split(from).join(to);
      if (t !== s) fs.writeFileSync(p, t);
    }
  }
};
if (renames.length) rewrite(path.join(OUT, ".next", "server"));
const wanted = JSON.parse(fs.readFileSync(path.join(FUNCTIONS, "package.json"), "utf8")).dependencies;
for (const [, name] of renames) if (!wanted[name]) throw new Error(`The build needs ${name} at run time: add it to functions/package.json.`);
// Next looks in .next/static when it starts, even with nothing to serve from it.
fs.mkdirSync(path.join(OUT, ".next", "static"), { recursive: true });
fs.writeFileSync(path.join(OUT, ".next", "static", ".keep"), "");
fs.writeFileSync(path.join(OUT, "package.json"), JSON.stringify({ private: true }) + "\n");

// The function's plain settings (Firebase loads functions/.env at deploy).
const settings = {
  HAVEN_DEPLOY_ENV: "production",
  HAVEN_BACKEND: "firestore",
  // The data key's id in production (its sealed fields carry kid "local").
  HAVEN_DATA_KEY_ID: "local",
  HAVEN_API_ORIGIN: API_ORIGIN,
  HAVEN_VERCEL_PROJECT_ID: vercelProject.projectId,
  HAVEN_VERCEL_TEAM_ID: vercelProject.orgId,
  ...prod,
};
const quote = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
fs.writeFileSync(path.join(FUNCTIONS, ".env"), Object.entries(settings).filter(([, v]) => v !== "").map(([k, v]) => `${k}=${quote(v)}`).join("\n") + "\n");

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`functions/app ready (${(size(OUT) / 1e6).toFixed(1)} MB); externals: ${renames.map(([, n]) => n).join(", ") || "none"}; API origin: ${API_ORIGIN || "not set yet"}`);
