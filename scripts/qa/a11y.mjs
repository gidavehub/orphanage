// Automated accessibility audit (axe-core, WCAG 2 A + AA) of public pages (PLAN §6.4 Q1).
//
//   node scripts/qa/a11y.mjs 375 http://localhost:3100/donate            one page at one width
//   node scripts/qa/a11y.mjs --all --base http://localhost:3100 [--widths 375,1280] [--only /donate,/faq]
//   … [--cookie "haven_session=…"] [--role super_admin]                    as a signed-in person
//
// --all checks every URL in /sitemap.xml plus the pages the sitemap leaves out (forms' result pages,
// token pages, search, 404). Each page is scrolled top to bottom first so scroll-revealed content is
// in its final state. The only contrast exemptions are the brand colour pairings the owner kept on
// purpose (HANDOFF.md §6: white text on marigold or coral, and marigold text) and decorative text
// inside aria-hidden (WCAG 1.4.3). Anything else fails the run.

import { chromium } from "playwright-core";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const ALL = args.includes("--all");
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--all"));
const BASE = String(flag("--base", positional[1] ? new URL(positional[1]).origin : "http://localhost:3100")).replace(/\/+$/, "");
const WIDTHS = ALL ? String(flag("--widths", "375,1280")).split(",").map(Number) : [Number(positional[0] || 1440)];
const ONLY = flag("--only", null)?.split(",");
const COOKIE = flag("--cookie", null);
const ROLE = flag("--role", null);

// Brand pairings kept on purpose (HANDOFF.md §6): marigold text (script eyebrows), coral accent words
// in headings, and white text on marigold or coral. Colours match within a small distance, since
// anti-aliasing and translucent overlays shift the measured hex a little.
const rgb = (hex) => (/^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : null);
const near = (hex, family, d) => {
  const c = rgb(hex);
  return !!c && family.some((f) => Math.hypot(...rgb(f).map((v, i) => v - c[i])) <= d);
};
const MARIGOLD = ["#f5af08", "#e09f00"];
const CORAL = ["#f25e44", "#e14f36", "#f47660", "#f0462c"]; // coral, its hover, coral under white/15, flame
const exempt = (d) => {
  const fg = String(d?.fgColor ?? "").toLowerCase();
  const bg = String(d?.bgColor ?? "").toLowerCase();
  const whiteish = (rgb(fg) ?? [0]).every((v) => v >= 0xe0);
  return near(fg, MARIGOLD, 12) || near(fg, CORAL, 12) || (whiteish && (near(bg, MARIGOLD, 30) || near(bg, CORAL, 30)));
};

const EXTRA = [
  "/search?q=education",
  "/link-expired",
  "/unsubscribe?t=x",
  "/newsletter/confirm?t=x",
  "/donate/manage",
  "/donate/thank-you",
  "/privacy/request",
  "/get-support/request",
  "/report-a-concern",
  "/request-a-report",
  "/stories/share",
  "/get-involved/volunteer",
  "/get-involved/partner",
  "/contact",
  "/no-such-page",
];

async function urls() {
  if (!ALL) return [positional[1] ? new URL(positional[1]).pathname + new URL(positional[1]).search : "/"];
  if (ONLY) return ONLY;
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const fromMap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  return [...new Set([...fromMap, ...EXTRA])];
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const list = await urls();
const results = [];

for (const W of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, ...(W < 500 ? { isMobile: true, hasTouch: true } : {}) });
  if (ROLE) await ctx.request.post(`${BASE}/api/dev/session?role=${encodeURIComponent(ROLE)}`);
  if (COOKIE) {
    const [name, ...rest] = COOKIE.split("=");
    await ctx.addCookies([{ name: name.trim(), value: rest.join("=").trim(), url: BASE }]);
  }
  for (const url of list) {
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(120000);
    const row = { url, W, fail: [], exempted: 0, minor: [], error: null };
    try {
      await page.goto(`${BASE}${url}`, { waitUntil: "load" });
      await page.waitForTimeout(800);
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += 500) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(90);
      }
      // Back to the top: the page hero fades out as it scrolls away, so audit it in view.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1500);
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const violations = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        // Text inside aria-hidden is decoration (the footer's faded giant line): WCAG 1.4.3 exempts it.
        const decorative = (target) => {
          try {
            return !!document.querySelector(target)?.closest('[aria-hidden="true"]');
          } catch {
            return false;
          }
        };
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(" ").slice(0, 140), data: n.any?.[0]?.data ?? null, decorative: decorative(n.target[0]) })) }));
      });
      for (const v of violations) {
        const nodes = v.id === "color-contrast" ? v.nodes.filter((n) => !exempt(n.data) && !n.decorative) : v.nodes;
        row.exempted += v.nodes.length - nodes.length;
        if (!nodes.length) continue;
        const sample = nodes[0].target + (nodes[0].data?.contrastRatio ? ` (${nodes[0].data.fgColor} on ${nodes[0].data.bgColor}, ${nodes[0].data.contrastRatio})` : "");
        row.fail.push(`[${v.impact}] ${v.id} ×${nodes.length}: ${v.help} — ${sample}`);
      }
    } catch (err) {
      row.error = String(err?.message ?? err).slice(0, 200);
    } finally {
      await page.close();
    }
    results.push(row);
    if (!ALL) {
      for (const f of row.fail) console.log(`  ${f}`);
    }
  }
  await ctx.close();
  if (ALL) console.log(`width ${W}: ${list.length} pages`);
}
await browser.close();

let bad = 0;
for (const r of results) {
  if (!r.error && !r.fail.length) continue;
  bad++;
  console.log(`  ✗ ${r.W} ${r.url}${r.error ? ` error: ${r.error}` : ""}`);
  for (const f of r.fail) console.log(`      ${f}`);
}
const exempted = results.reduce((n, r) => n + r.exempted, 0);
console.log(`\n${results.length} page checks, ${bad} with violations; ${exempted} brand-pairing contrast nodes exempted (HANDOFF.md §6).`);
process.exit(bad ? 1 : 0);
