// The A gate's layout and accessibility sweep of the team space: every place, a record of each kind,
// the sign-in pages and the quick-action sheets. Signs in as a practice super admin.
//
//   node scripts/qa/admin/audit.mjs --base http://localhost:3100 [--widths 375,768,1280] [--axe 375,1280] [--only /admin/team]
//
// Overflow: any page that scrolls sideways (or an element sticking out outside a clipping ancestor).
// Axe: wcag2a + wcag2aa violations (serious/critical fail the run; moderate/minor are listed).

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");
const WIDTHS = String(flag("--widths", "375,768,1280")).split(",").map(Number);
const AXE_AT = String(flag("--axe", "375,1280")).split(",").map(Number);
const ONLY = flag("--only", null)?.split(",") ?? null;
const DATA = path.resolve(".data");
const unwrap = (d) => (d && typeof d === "object" && "data" in d && d.data && typeof d.data === "object" ? d.data : d);
async function firstKey(c, pred = () => true) {
  try {
    const all = JSON.parse(await readFile(path.join(DATA, "db", c, "_docs.json"), "utf8"));
    return Object.entries(all).find(([k, v]) => !k.startsWith("_") && pred(unwrap(v)))?.[0] ?? null;
  } catch {
    return null;
  }
}

const refs = {
  support: await firstKey("supportRequests"),
  concern: await firstKey("safeguardingConcerns"),
  gift: await firstKey("donations"),
  session: await firstKey("appointments"),
  report: await firstKey("reportRequests"),
  volunteer: await firstKey("volunteerApplications"),
  resource: await firstKey("resources"),
  post: await firstKey("posts"),
  cause: await firstKey("causes"),
  sponsor: await firstKey("sponsorProfiles"),
  message: await firstKey("contactMessages"),
};

const PAGES = [
  "/admin",
  "/admin/inbox",
  refs.message && `/admin/inbox/${refs.message}`,
  "/admin/requests",
  refs.support && `/admin/requests/${refs.support}`,
  "/admin/safeguarding",
  refs.concern && `/admin/safeguarding/${refs.concern}`,
  "/admin/giving",
  refs.gift && `/admin/giving/${refs.gift}`,
  "/admin/giving/causes",
  refs.cause && `/admin/giving/causes/${refs.cause}`,
  "/admin/giving/where-it-goes",
  "/admin/giving/sponsorship",
  refs.sponsor && `/admin/giving/sponsorship/${refs.sponsor}`,
  "/admin/counselling",
  refs.session && `/admin/counselling/${refs.session}`,
  "/admin/library",
  refs.resource && `/admin/library/${refs.resource}`,
  "/admin/library/requests",
  refs.report && `/admin/library/requests/${refs.report}`,
  "/admin/people",
  "/admin/people/partners",
  "/admin/people/directory",
  refs.volunteer && `/admin/people/${refs.volunteer}`,
  "/admin/website",
  "/admin/website/home",
  "/admin/website/key-info",
  "/admin/website/changes",
  "/admin/website/launch",
  "/admin/posts",
  refs.post && `/admin/posts/${refs.post}`,
  "/admin/posts/plan",
  "/admin/media",
  "/admin/team",
  "/admin/team/loc_seed_programme_officer",
  "/admin/me",
  "/admin/activity",
  "/admin/settings",
  "/admin/settings/giving",
  "/admin/settings/newsletter",
  "/admin/settings/connections",
  "/admin/settings/email-log",
  "/admin/settings/data",
  "/admin/settings/emails",
  "/admin/settings/emails/support_confirmation",
  "/admin/help",
  "/admin?do=record-gift",
  "/admin?do=log-request",
  "/admin?do=log-concern",
  "/admin?do=invite",
  "/admin?do=post-update",
  "/admin?do=upload-media",
].filter(Boolean);
const PUBLIC = ["/admin/login", "/admin/forgot", "/donate/manage"];
const pages = ONLY ?? PAGES;

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = [];

async function audit(ctx, url, W) {
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(150000);
  const row = { url, W, scroll: 0, out: [], axe: [], error: null };
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: "load" });
    // Streamed content and sheets open a frame after hydration.
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(url.includes("?do=") ? 2200 : 1400);
    Object.assign(
      row,
      await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const clipped = (el) => {
          for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
            const s = getComputedStyle(a);
            if (["hidden", "clip", "auto", "scroll"].includes(s.overflowX) || s.position === "fixed") return true;
          }
          return false;
        };
        const out = [];
        for (const el of document.querySelectorAll("body *")) {
          if (el.closest("[hidden], [inert], template")) continue;
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== "fixed") out.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 60)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
        }
        return { scroll: document.documentElement.scrollWidth - vw, out: out.slice(0, 4) };
      }),
    );
    if (AXE_AT.includes(W)) {
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      // Public pages: the shared header and footer carry the landing brand pairings the P gate
      // documented as exempt (public-pages §8); everything else on the page is checked.
      const publicPage = !url.startsWith("/admin");
      row.axe = await page.evaluate(async (pub) => {
        const ctx = pub ? { exclude: [["#site-footer"], ["header"]] } : document;
        const r = await window.axe.run(ctx, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, sample: v.nodes[0]?.target.join(" ").slice(0, 120) + (v.nodes[0]?.any?.[0]?.data?.contrastRatio ? ` (ratio ${v.nodes[0].any[0].data.contrastRatio})` : "") }));
      }, publicPage);
    }
  } catch (err) {
    row.error = String(err?.message ?? err).slice(0, 200);
  } finally {
    await page.close();
  }
  return row;
}

for (const W of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, ...(W < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.request.post(`${BASE}/api/dev/session?role=super_admin`);
  for (const url of pages) results.push(await audit(ctx, url, W));
  await ctx.close();
  if (!ONLY) {
    const anon = await browser.newContext({ viewport: { width: W, height: 900 } });
    for (const url of PUBLIC) results.push(await audit(anon, url, W));
    await anon.close();
  }
  console.log(`width ${W} done`);
}
await browser.close();

let bad = 0;
for (const r of results) {
  const serious = r.axe.filter((v) => v.impact === "serious" || v.impact === "critical");
  const fail = r.error || r.scroll > 0 || serious.length;
  if (fail) bad++;
  if (fail || r.axe.length || r.out.length) {
    console.log(`\n${fail ? "✗" : "·"} ${r.url} @${r.W}${r.error ? `  ERROR ${r.error}` : ""}${r.scroll > 0 ? `  scrolls sideways by ${r.scroll}px` : ""}`);
    for (const o of r.out) console.log(`    sticks out: ${o}`);
    for (const v of r.axe) console.log(`    axe [${v.impact}] ${v.id} ×${v.count}: ${v.sample}`);
  }
}
console.log(`\n${results.length} checks, ${bad} failing.`);
process.exit(bad ? 1 : 0);
