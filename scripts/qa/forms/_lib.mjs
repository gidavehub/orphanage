// Shared helpers for the P7 form checks (volunteer, partnership, reportRequest, newsletter): flags,
// the expect/fail tally, the practice store under .data/, the held mailbox and a headless Chrome.

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
export const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
export const BASE = String(flag("--base", flag("--url", "http://localhost:3001"))).replace(/\/+$/, "");
export const DATA = path.resolve(flag("--data", ".data"));
const CHROME = flag("--chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe");

export const fails = [];
export const expect = (ok, msg, extra) => {
  if (ok) console.log(`  ✓ ${msg}`);
  else {
    fails.push(msg);
    console.log(`  ✗ ${msg}${extra !== undefined ? `\n      ${String(extra).slice(0, 300)}` : ""}`);
  }
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fakeIp = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;

export const unwrap = (doc) => (doc && typeof doc === "object" && "data" in doc && doc.data && typeof doc.data === "object" ? doc.data : doc);

export async function store(collection) {
  try {
    return JSON.parse(await readFile(path.join(DATA, "db", collection, "_docs.json"), "utf8"));
  } catch {
    return {};
  }
}

export async function waitFor(fn, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  return null;
}

/** The held outbox record for a template whose JSON mentions `needle`, once it left the queue. */
export async function heldEmail(template, needle) {
  return waitFor(async () => {
    const all = await store("emailOutbox");
    const hit = Object.entries(all).find(([id, d]) => id.startsWith(`${template}~`) && (id + JSON.stringify(d)).includes(needle));
    const doc = hit ? unwrap(hit[1]) : null;
    return doc && doc.status !== "queued" && doc.status !== "sending" ? { id: hit[0], doc } : null;
  });
}

export async function mailboxHtml(id) {
  try {
    return await readFile(path.join(DATA, "mailbox", `${id}.html`), "utf8");
  } catch {
    return "";
  }
}

/** Ticks a checkbox by its label, retrying while the form re-renders. */
export async function tick(page, label) {
  const box = page.getByLabel(label);
  for (let t = 0; t < 3 && !(await box.isChecked()); t++) await box.click({ force: true });
  return box.isChecked();
}

export async function open() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  return { browser, page, pageErrors };
}

export async function finish(browser, pageErrors, name) {
  if (pageErrors.length) expect(false, "no page errors", pageErrors.join(" | "));
  await browser.close();
  console.log(fails.length ? `\n  ${fails.length} failure(s)` : `\nAll ${name} checks passed.`);
  process.exit(fails.length ? 1 : 0);
}
