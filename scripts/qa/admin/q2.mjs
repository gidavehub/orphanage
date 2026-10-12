// Phase Q2: the team space on phones, for every role (PLAN §6.4 Q2).
//
//   node scripts/qa/admin/q2.mjs --base http://localhost:3100 [--role counsellor] [--skip-sheets]
//
// 1. Each of the eight roles, at 360 and 390 wide (a phone, touch): Today and every place the role
//    may open (the rbac.mjs matrix). No page may scroll sideways; at 390 an axe audit (WCAG 2 A/AA)
//    must find nothing serious or critical.
// 2. As a super admin at 390: every ＋ New action opens its sheet with focus inside, Tab never leaves
//    the sheet, Escape closes it, and focus goes back to the ＋ New button.
// Exit 1 on any failure.

import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = String(flag("--base", "http://localhost:3100")).replace(/\/+$/, "");
const ONLY = flag("--role", null);

const PLACES = {
  inbox: "/admin/inbox",
  requests: "/admin/requests",
  safeguarding: "/admin/safeguarding",
  giving: "/admin/giving",
  counselling: "/admin/counselling",
  library: "/admin/library",
  people: "/admin/people",
  website: "/admin/website/home",
  posts: "/admin/posts",
  media: "/admin/media",
  team: "/admin/team",
  activity: "/admin/activity",
  settings: "/admin/settings",
};
const ALLOWED = {
  super_admin: Object.keys(PLACES),
  content_manager: ["inbox", "giving", "library", "website", "posts", "media", "activity", "settings"],
  programme_officer: ["inbox", "requests", "giving", "counselling", "people", "website", "posts", "activity", "settings"],
  safeguarding_officer: ["inbox", "safeguarding", "website", "media", "activity", "settings"],
  finance_officer: ["inbox", "giving", "website", "activity", "settings"],
  counsellor: ["counselling"],
  report_manager: ["inbox", "library", "website", "activity", "settings"],
  viewer: ["requests", "giving", "library", "people", "website", "activity"],
};
const ROLES = ONLY ? [ONLY] : Object.keys(ALLOWED);

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const fails = [];
let checks = 0;

async function phoneContext(W, role) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, isMobile: true, hasTouch: true });
  const r = await ctx.request.post(`${BASE}/api/dev/session?role=${role}`);
  if (!r.ok()) throw new Error(`sign-in as ${role} failed (${r.status()})`);
  return ctx;
}

async function settle(page) {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(900);
}

// 1. Roles × phone widths.
for (const role of ROLES) {
  for (const W of [360, 390]) {
    const ctx = await phoneContext(W, role);
    const urls = ["/admin", ...ALLOWED[role].map((p) => PLACES[p])];
    for (const url of urls) {
      checks++;
      const page = await ctx.newPage();
      page.setDefaultNavigationTimeout(120000);
      try {
        await page.goto(`${BASE}${url}`, { waitUntil: "load" });
        await settle(page);
        const { scroll, out } = await page.evaluate(() => {
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
            if (r.width && (r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== "fixed") out.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 50)}`);
          }
          return { scroll: document.documentElement.scrollWidth - vw, out: out.slice(0, 3) };
        });
        if (scroll > 0) fails.push(`${role} ${W} ${url}: scrolls sideways by ${scroll}px (${out.join(", ")})`);
        if (W === 390) {
          await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
          const v = await page.evaluate(async () => {
            const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
            return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id} ×${x.nodes.length} (${x.nodes[0]?.target.join(" ").slice(0, 80)})`);
          });
          for (const x of v) fails.push(`${role} ${W} ${url}: ${x}`);
        }
      } catch (err) {
        fails.push(`${role} ${W} ${url}: ${String(err?.message ?? err).slice(0, 140)}`);
      } finally {
        await page.close();
      }
    }
    await ctx.close();
  }
  console.log(`  ${role}: ${1 + ALLOWED[role].length} pages × 2 widths`);
}

// 2. Sheets: focus in, trapped, back to ＋ New.
if (!args.includes("--skip-sheets") && (!ONLY || ONLY === "super_admin")) {
  const ctx = await phoneContext(390, "super_admin");
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(120000);
  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  await settle(page);
  const newButton = page.locator('button[data-tour="new"]:visible').first();
  const openPanel = async () => {
    await newButton.click();
    await page.waitForSelector("dialog[open] ul button", { timeout: 8000 });
    await page.waitForTimeout(300);
    return page.locator("dialog[open] ul button");
  };
  let items = await openPanel();
  const labels = (await items.allInnerTexts()).map((t) => t.split("\n").pop().trim()).filter(Boolean);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if (!labels.length) fails.push("sheets: the ＋ New panel listed no actions");
  for (const label of labels) {
    checks++;
    try {
      items = await openPanel();
      await items.filter({ hasText: label }).first().click();
      await page.waitForSelector("dialog[open]", { timeout: 8000 });
      await page.waitForTimeout(700);
      // A native modal <dialog> makes the page inert: past the last control, Tab visits the browser's
      // own UI (the document reports <body>) and then comes back. Landing on any page element
      // outside the sheet is the failure.
      const where = () => page.evaluate(() => {
        const d = [...document.querySelectorAll("dialog[open]")].pop();
        const a = document.activeElement;
        if (d && d.contains(a)) return "inside";
        if (!a || a === document.body || a === document.documentElement) return "browser";
        return `${a.tagName.toLowerCase()} "${(a.textContent ?? "").trim().slice(0, 30)}"`;
      });
      if ((await where()) !== "inside") fails.push(`sheet "${label}": focus is not inside the sheet when it opens`);
      let cameBack = false;
      let wentOut = false;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        const w = await where();
        if (w === "browser") wentOut = true;
        else if (w === "inside") cameBack ||= wentOut;
        else {
          fails.push(`sheet "${label}": Tab reached the page behind the sheet (${w})`);
          break;
        }
      }
      if (wentOut && !cameBack) fails.push(`sheet "${label}": after the last control, Tab did not come back into the sheet`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      const after = await page.evaluate(() => ({ open: !!document.querySelector("dialog[open]"), focus: document.activeElement?.outerHTML.slice(0, 120) ?? "" }));
      if (after.open) fails.push(`sheet "${label}": Escape did not close it`);
      else if (!(await newButton.evaluate((b) => b === document.activeElement))) fails.push(`sheet "${label}": focus did not return to ＋ New (it is on ${after.focus || "the page"})`);
    } catch (err) {
      fails.push(`sheet "${label}": ${String(err?.message ?? err).slice(0, 140)}`);
      await page.keyboard.press("Escape").catch(() => undefined);
    }
  }
  console.log(`  sheets: ${labels.length} quick actions (${labels.join(", ")})`);
  await ctx.close();
}

await browser.close();
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s) in ${checks} checks.` : `\nQ2: ${checks} checks passed.`);
process.exit(fails.length ? 1 : 0);
