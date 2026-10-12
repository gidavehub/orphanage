// With "reduce motion" switched on, Haven holds still and hides nothing (PLAN §6.4 Q1).
//
//   node scripts/qa/reduced-motion.mjs --base http://localhost:3100 [--only /,/about]
//
// For each page, in a browser that prefers reduced motion (desktop and phone): after scrolling
// through, no text is left invisible (opacity ≈ 0 waiting for an animation); no video plays by
// itself; no CSS animation runs for ever; and the slideshows do not advance on their own (the
// visible slide text is the same 8 seconds later). Exit 1 on any failure.

import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = String(flag("--base", "http://localhost:3100")).replace(/\/+$/, "");

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const firstNews = [...sitemap.matchAll(/<loc>[^<]*?(\/news\/[^<]+)<\/loc>/g)][0]?.[1];
const PAGES = flag("--only", null)?.split(",") ?? ["/", "/about", "/donate/education", "/programmes/education", "/impact", "/stories", firstNews].filter(Boolean);

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const fails = [];

for (const [label, viewport, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", isMobile: mobile, hasTouch: mobile });
  for (const url of PAGES) {
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(1200);
      const slideText = () =>
        page.evaluate(() => {
          const h1 = document.querySelector("h1");
          return h1 ? h1.innerText.trim() : "";
        });
      const before = await slideText();
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += 600) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(80);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(8000 - Math.min(6000, H / 600 * 80));
      const after = await slideText();
      if (before && after && before !== after) fails.push(`${label} ${url}: the headline changed on its own ("${before.slice(0, 40)}" → "${after.slice(0, 40)}")`);
      const state = await page.evaluate(() => {
        const invisible = [];
        for (const el of document.querySelectorAll("h1, h2, h3, p, li, a, button, figcaption, blockquote")) {
          // Collapsed panels (an accordion's closed items) hide their text until opened: that is not motion.
          if (el.closest("[hidden], [inert], [aria-hidden='true'], [aria-expanded='false'], dialog:not([open]), template, .sr-only")) continue;
          const text = el.textContent?.trim();
          if (!text) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          let o = 1;
          for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
            const s = getComputedStyle(a);
            if (s.visibility === "hidden" || s.display === "none") { o = -1; break; }
            o *= Number(s.opacity);
          }
          if (o >= 0 && o < 0.05) invisible.push(`${el.tagName.toLowerCase()} "${text.slice(0, 40)}"`);
        }
        const playing = [...document.querySelectorAll("video")].filter((v) => !v.paused && !v.ended).map((v) => v.currentSrc.split("/").pop());
        const forever = document
          .getAnimations()
          .filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations === Infinity)
          .map((a) => (a.effect?.target instanceof Element ? `${a.effect.target.tagName.toLowerCase()}.${String(a.effect.target.className).slice(0, 40)}` : "?"));
        return { invisible: invisible.slice(0, 5), playing, forever: [...new Set(forever)].slice(0, 5) };
      });
      if (state.invisible.length) fails.push(`${label} ${url}: text left invisible: ${state.invisible.join("; ")}`);
      if (state.playing.length) fails.push(`${label} ${url}: video playing by itself: ${state.playing.join(", ")}`);
      if (state.forever.length) fails.push(`${label} ${url}: endless animation: ${state.forever.join(", ")}`);
    } catch (err) {
      fails.push(`${label} ${url}: ${String(err?.message ?? err).slice(0, 140)}`);
    } finally {
      await page.close();
    }
  }
  await ctx.close();
  console.log(`  ${label}: ${PAGES.length} pages`);
}
await browser.close();
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s).` : "\nReduced motion: nothing moves by itself and nothing is hidden.");
process.exit(fails.length ? 1 : 0);
