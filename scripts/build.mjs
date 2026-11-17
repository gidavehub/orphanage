#!/usr/bin/env node
// Builds Haven once and splits it in two (owner, 2026-11-17: "Make sure all my functions are in
// cloud function not Vercel"):
//  - functions/app: the whole Next.js server (every page, Server Action and /api route), served by
//    the Firebase function (functions/index.js);
//  - .vercel/output: what Vercel holds, as a prebuilt deployment with no functions at all: the
//    browser's files (/_next/static, public/) and one route that passes every other request to the
//    function.
//
//   npm run deploy      (this script, then firebase deploy --only functions, then vercel --prebuilt)
//
// The build uses Vercel's production NEXT_PUBLIC_* values (Next writes them into the code; this
// computer's .env.local holds practice ones), and reads production Firestore for the pages it
// prerenders, with a one-hour access token from the gcloud configuration named in
// HAVEN_GCLOUD_CONFIG (default "haven"). Nothing secret is printed or written to disk except the
// function's plain settings (functions/.env); its secrets live in Secret Manager.

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS = path.join(ROOT, "functions");
const OUT = path.join(FUNCTIONS, "app");
const NEXT = path.join(ROOT, ".next");
const VERCEL_OUT = path.join(ROOT, ".vercel", "output");

/** The function's own address (gcloud functions describe api --region us-central1 → serviceConfig.uri). */
const API_ORIGIN = process.env.HAVEN_API_ORIGIN ?? "https://api-dvfijsfwpq-uc.a.run.app";
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

function accessToken() {
  const config = process.env.HAVEN_GCLOUD_CONFIG ?? "haven";
  const token = execSync("gcloud auth print-access-token", { env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: config }, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  if (!token) throw new Error(`No access token from the gcloud configuration "${config}".`);
  return token;
}

const prod = productionValues();
for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", ...PLAIN]) {
  if (!prod[key]) throw new Error(`Vercel production has no ${key}.`);
}

/* 1. One production build, reading production data, with nothing that would make Next think it is on Vercel. */
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("VERCEL")));
const built = spawnSync("npx next build", {
  cwd: ROOT,
  shell: true,
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
  env: {
    ...env,
    ...prod,
    HAVEN_BACKEND: "firestore",
    HAVEN_BUILD_ACCESS_TOKEN: accessToken(),
    // Pages read sealed settings with the same key as production (it is this computer's practice key).
    HAVEN_DATA_KEY: fs.readFileSync(path.join(ROOT, ".data", "keys", "data.key"), "utf8").trim(),
    HAVEN_DATA_KEY_ID: "local",
    // Vercel Web Analytics stays on (the collector is still Vercel's, at /_vercel/insights).
    NEXT_PUBLIC_ANALYTICS: "on",
  },
});
process.stdout.write(built.stdout ?? "");
process.stderr.write(built.stderr ?? "");
if (built.status !== 0) throw new Error("next build failed.");
// A page prerendered after a failed read would show built-in content instead of the live site, and
// the function would serve it as is: stop rather than deploy that.
const output = `${built.stdout}
${built.stderr}`;
if (/_read_failed|Failed to initialize Google Cloud Firestore|Data is unavailable/.test(output)) {
  throw new Error("The build could not read production Firestore (see the read_failed lines above). Nothing was copied; check the gcloud configuration and try again.");
}

/* 2. The function's copy: the server build, the browser's files (served when Vercel hasn't got them
      yet, between the two deploys), public/ (the image optimizer reads it) and assets/. */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const SKIP = new Set(["cache", "dev", "trace", "trace-build", "diagnostics", "types", "turbopack", "node_modules"]);
for (const name of fs.readdirSync(NEXT)) {
  if (SKIP.has(name)) continue;
  // Source maps (a third of the build) stay behind: the function never reads them, and the upload is
  // the slow part of a deploy.
  fs.cpSync(path.join(NEXT, name), path.join(OUT, ".next", name), { recursive: true, dereference: true, filter: (src) => !src.endsWith(".map") });
}
fs.cpSync(path.join(ROOT, "public"), path.join(OUT, "public"), { recursive: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });

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
fs.writeFileSync(path.join(OUT, "package.json"), JSON.stringify({ private: true }) + "\n");

// The function's plain settings (Firebase loads functions/.env at deploy).
const settings = {
  HAVEN_DEPLOY_ENV: "production",
  HAVEN_BACKEND: "firestore",
  // The data key's id in production (its sealed fields carry kid "local").
  HAVEN_DATA_KEY_ID: "local",
  HAVEN_API_ORIGIN: API_ORIGIN,
  ...prod,
  NEXT_PUBLIC_ANALYTICS: "on",
};
const quote = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
fs.writeFileSync(path.join(FUNCTIONS, ".env"), Object.entries(settings).filter(([, v]) => v !== "").map(([k, v]) => `${k}=${quote(v)}`).join("\n") + "\n");

/* 3. Vercel's share: static files and one route to the function (Build Output API v3, no functions). */
fs.rmSync(VERCEL_OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(VERCEL_OUT, "static", "_next"), { recursive: true });
fs.cpSync(path.join(NEXT, "static"), path.join(VERCEL_OUT, "static", "_next", "static"), { recursive: true });
fs.cpSync(path.join(ROOT, "public"), path.join(VERCEL_OUT, "static"), { recursive: true });
const config = {
  version: 3,
  routes: [
    { src: "^/_next/static/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
    { handle: "filesystem" },
    // Everything else is the function's: pages, Server Actions, /api, images, metadata routes. Vercel
    // keeps no copy (the function's cache is the site's cache: lib/server/cache.ts).
    { src: "^/(.*)$", dest: `${API_ORIGIN}/$1`, headers: { "x-vercel-enable-rewrite-caching": "0" } },
  ],
};
fs.writeFileSync(path.join(VERCEL_OUT, "config.json"), JSON.stringify(config, null, 2) + "\n");

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(
  `functions/app ready (${(size(OUT) / 1e6).toFixed(1)} MB; externals: ${renames.map(([, n]) => n).join(", ") || "none"}); ` +
    `.vercel/output ready (${(size(VERCEL_OUT) / 1e6).toFixed(1)} MB of static files); function: ${API_ORIGIN}`,
);
