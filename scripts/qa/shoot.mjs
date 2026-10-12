// Headless visual QA: screenshots of each landing section via the local Chrome.
//
//   node scripts/qa/shoot.mjs                     desktop 1440×900, every section
//   node scripts/qa/shoot.mjs --w 375 --h 812     mobile
//   node scripts/qa/shoot.mjs --only donate,faq   selected anchors
//   node scripts/qa/shoot.mjs --full              one full-page capture
//   … --url http://localhost:3100/admin --role super_admin (or --cookie "haven_session=…")   signed in
//
// Output → media-src/qa/<width>/<name>.png (gitignored scratch).

import { chromium } from "playwright-core";
import { applySession, sessionFlags } from "./_session.mjs";
import { mkdir } from "fs/promises";
import path from "path";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const W = Number(flag("--w", 1440));
const H = Number(flag("--h", 900));
const URL = flag("--url", "http://localhost:3000/");
const ONLY = flag("--only", null)?.split(",");
const FULL = args.includes("--full");
const REDUCED = args.includes("--reduced");
const OUT = path.resolve("media-src/qa", `${W}${REDUCED ? "-reduced" : ""}`);

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

// Section anchors: [name, selector, extra offset]
const SECTIONS = [
  ["01-hero", "top", 0],
  ["01b-world", "#world-title", -110],
  ["01c-map", "svg[aria-labelledby=world-map-title]", -140],
  ["02-programmes", "#programmes", 0],
  ["03-about", "#about", 0],
  ["04-duo", "#involved", -120],
  ["05-manifesto", "#manifesto-title", -40],
  ["06-impact", "#impact", 0],
  ["07-focus", "#focus-title", 0],
  ["08-appeals", "#appeals", 0],
  ["09-donate", "#donate", 0],
  ["10-doors", "#support", 0],
  ["11-stories", "#stories", 0],
  ["12-founder", "#founder-title", -200],
  ["13-team", "#team", 0],
  ["14-restoring", "#restoring-title", -220],
  ["15-partners", "#partners-title", -120],
  ["16-testimonials", "#testimonials-title", -140],
  ["17-journey", "#journey-title", -120],
  ["18-projects", "#projects-title", -180],
  ["19-faq", "#faq", 0],
  ["20-join", "#join-title", -560],
  ["21-news", "#news", 0],
  ["22-footer", "#site-footer", -80],
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: REDUCED ? "reduce" : "no-preference",
  isMobile: W < 768,
  hasTouch: W < 768,
});
await applySession(ctx, new globalThis.URL(URL).origin, sessionFlags(args));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(2500);

if (FULL) {
  // Walk down the page first so every scroll-triggered reveal has fired.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += Math.round(H * 0.6)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "full.png"), fullPage: true });
  console.log(`  ✓ full page → ${OUT}`);
} else {
  for (const [name, sel, off] of SECTIONS) {
    if (ONLY && !ONLY.some((o) => name.includes(o))) continue;
    // Two passes: content-visibility sections above re-measure once they render, moving the anchor.
    for (const wait of [700, 2600]) {
      await page.evaluate(
        ([s, o]) => {
          const lenis = window.__lenis;
          if (s === "top") return lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0);
          const el = document.querySelector(s);
          if (!el) return;
          const y = el.getBoundingClientRect().top + window.scrollY + o;
          if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
        },
        [sel, off],
      );
      await page.waitForTimeout(wait);
    }
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  ✓ ${name}`);
  }
}

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(`  horizontal overflow: ${overflow}px`);
if (errors.length) console.log("  console errors:\n   " + [...new Set(errors)].join("\n   "));
await browser.close();
