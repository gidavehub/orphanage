// Serves Haven's own Next.js build (./app, copied by scripts/build-api.mjs) for one request, so every
// app/api/** route runs here exactly as written. Kept apart from index.js so it can be tried
// locally without the Firebase wrapper (scripts/try-api.mjs).
//
// Put back or added before Next sees a request:
//  - the body: Firebase reads it first (req.rawBody), and the webhooks check signatures on it;
//  - the host: Vercel passes the visitor's host as x-forwarded-host (cookies, origin checks);
//  - the visitor's IP (x-vercel-forwarded-for, which lib/server/security/spam.ts reads first):
//    Google appends the connecting address to x-forwarded-for, so for a call through Vercel the
//    visitor is the entry before it, and for a direct call (Stripe, Resend, Scheduler) the last one;
//  - a hold for after-response work (lib/server/after.ts): Cloud Run takes the CPU away once a
//    response is sent, so queued emails and cache refreshes run first, then the response ends.

const path = require("node:path");
const { AsyncLocalStorage } = require("node:async_hooks");
const { Readable } = require("node:stream");

const APP = path.join(__dirname, "app");
const OURS = /^(orphanage-delta\.vercel\.app|(www\.)?haveninternationalorphanages\.org)$/;
const HOLD_LIMIT_MS = 20_000;

const holds = new AsyncLocalStorage();
globalThis[Symbol.for("haven.request-hold")] = { get: () => holds.getStore() };

let ready = null;

function nextHandler() {
  ready ||= (async () => {
    const { config } = require("./app/.next/required-server-files.json");
    // Nothing is kept between API calls (no-store-cache.js says why).
    config.cacheHandlers = { ...(config.cacheHandlers || {}), default: path.join(__dirname, "no-store-cache.js") };
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
    process.chdir(APP);
    const next = require("next");
    const app = next({ dev: false, dir: APP, conf: config, hostname: "localhost", port: Number(process.env.PORT) || 8080 });
    await app.prepare();
    return app.getRequestHandler();
  })();
  // A start that failed is tried again on the next request.
  ready.catch(() => (ready = null));
  return ready;
}

/** The request as Next needs it: the body readable again, the visitor's host and address. */
function asSent(req) {
  const body = req.rawBody && req.rawBody.length ? [req.rawBody] : [];
  const r = Readable.from(body);
  for (const k of ["headers", "rawHeaders", "method", "url", "httpVersion", "httpVersionMajor", "httpVersionMinor", "socket", "connection", "trailers", "rawTrailers"]) r[k] = req[k];
  const headers = { ...req.headers };
  const forwarded = String(headers["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase();
  const viaSite = OURS.test(forwarded);
  if (viaSite) headers.host = forwarded;
  headers["x-forwarded-proto"] = "https";
  const chain = String(headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const visitor = viaSite && chain.length >= 2 ? chain[chain.length - 2] : chain[chain.length - 1];
  if (visitor) headers["x-vercel-forwarded-for"] = visitor;
  else delete headers["x-vercel-forwarded-for"];
  r.headers = headers;
  return r;
}

/** Holds res.end until the request's after-response tasks settle (or HOLD_LIMIT_MS passes). */
function holdEnd(res, tasks, state) {
  const end = res.end;
  res.end = function (...args) {
    if (!tasks.length) {
      state.ended = true;
      return end.apply(res, args);
    }
    const deadline = Date.now() + HOLD_LIMIT_MS;
    (async () => {
      // Tasks may queue more tasks (an email that queues another): keep going until none are left.
      while (tasks.length && Date.now() < deadline) {
        const batch = tasks.splice(0);
        const left = Math.max(0, deadline - Date.now());
        await Promise.race([Promise.allSettled(batch.map((t) => Promise.resolve().then(t))), new Promise((r) => setTimeout(r, left))]);
      }
    })().finally(() => {
      state.ended = true;
      end.apply(res, args);
    });
    return res;
  };
}

async function serve(req, res) {
  const handle = await nextHandler();
  const tasks = [];
  const state = { ended: false };
  const hold = (task) => {
    if (state.ended) {
      void Promise.resolve().then(task).catch(() => undefined);
      return;
    }
    tasks.push(task);
  };
  holdEnd(res, tasks, state);
  return holds.run(hold, () => handle(asSent(req), res));
}

// holdEnd and holds are exported for scripts/try-api.mjs, which checks the hold on its own.
module.exports = { serve, holdEnd, holds };
