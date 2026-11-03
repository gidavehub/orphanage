#!/usr/bin/env node
// Tries the Firebase Functions back end on this computer before a deploy: functions/server.js (the
// built app in functions/app) behind a plain Node server, with functions/.env loaded and no secrets.
// Checks that Next starts under the wrapper and answers the guarded routes the way production must,
// and that the response hold runs after-response work before a response ends.
//
//   node scripts/build-api.mjs && node scripts/try-api.mjs

import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

for (const line of fs.readFileSync(path.join(ROOT, "functions", ".env"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z][A-Z0-9_]*)="(.*)"$/.exec(line);
  if (m) process.env[m[1]] ??= m[2].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
process.env.NODE_ENV = "production";

const { serve, holdEnd, holds } = require(path.join(ROOT, "functions", "server.js"));
let failed = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? `  (${detail})` : ""}`);
};

/* 1. The hold, on its own: tasks run before the response ends, in order of being queued. */
{
  const events = [];
  const res = { end: () => events.push("end") };
  const tasks = [];
  const state = { ended: false };
  holdEnd(res, tasks, state);
  const hold = (t) => (state.ended ? void t() : tasks.push(t));
  holds.run(hold, () => {
    const get = globalThis[Symbol.for("haven.request-hold")]?.get;
    get()(async () => {
      await new Promise((r) => setTimeout(r, 50));
      events.push("email sent");
      get()(async () => events.push("queued by the first"));
    });
    res.end();
  });
  await new Promise((r) => setTimeout(r, 300));
  check(events.join(" → ") === "email sent → queued by the first → end", "after-response work finishes before the response ends", events.join(" → "));
}

/* 2. The real app behind the wrapper. */
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    serve(req, res).catch((err) => {
      res.statusCode = 500;
      res.end(String(err));
    });
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const call = async (p, init = {}) => {
  const r = await fetch(base + p, { ...init, headers: { "x-forwarded-host": "orphanage-delta.vercel.app", "x-forwarded-for": "203.0.113.7, 198.51.100.1", ...(init.headers ?? {}) } });
  return { status: r.status, text: await r.text() };
};
try {
  const started = Date.now();
  const cron = await call("/api/cron/tick");
  check(cron.status === 401, "a cron call without the secret is refused", `${cron.status} after ${Date.now() - started} ms (first call starts Next)`);
  const hook = await call("/api/stripe/webhook", { method: "POST", body: "{}" });
  check(hook.status === 400 && /signature/i.test(hook.text), "the Stripe webhook wants a signature", `${hook.status} ${hook.text.slice(0, 60)}`);
  const signed = await call("/api/stripe/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=00" } });
  check([400, 503].includes(signed.status), "a forged Stripe signature never gets through", `${signed.status} ${signed.text.slice(0, 60)}`);
  const pulse = await call("/api/admin/pulse");
  check(pulse.status === 401, "the admin pulse wants a session", String(pulse.status));
  const dev = await call("/api/dev/selftest?suite=store");
  check(dev.status === 404, "practice helpers are switched off", String(dev.status));
  const page = await call("/api/nothing-here");
  check(page.status === 404, "an unknown /api path is a 404", String(page.status));
} finally {
  server.close();
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
