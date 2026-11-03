#!/usr/bin/env node
// Vercel's build step (vercel.json buildCommand): the back end runs on Firebase Functions
// (functions/index.js), so app/api is left out of what Vercel builds and Vercel deploys no API
// functions at all. Vercel passes /api/* to the function instead (vercel.json rewrites). Only ever
// on Vercel: locally `next dev` keeps the whole app.

import fs from "node:fs";

if (!process.env.VERCEL) {
  console.log("Not on Vercel: app/api kept.");
} else {
  fs.rmSync("app/api", { recursive: true, force: true });
  console.log("app/api left out: the back end is on Firebase Functions.");
}
