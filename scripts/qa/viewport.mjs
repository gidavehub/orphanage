// Hero fit check: at scroll 0 the hero's bottom edge must sit on the viewport's bottom edge
// (unless the hero's min-height wins on very short screens).
//
//   node scripts/qa/viewport.mjs [--url http://localhost:3000/]

import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const i = args.indexOf("--url");
const URL = i === -1 ? "http://localhost:3000/" : args[i + 1];
const SIZES = [
  [1902, 955],
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [390, 844],
  [375, 667],
];

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let fails = 0;
for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
  await page.goto(URL, { waitUntil: "load" });
  const r = await page.evaluate(() => {
    const hero = document.querySelector('section[aria-roledescription="carousel"]');
    const b = hero.getBoundingClientRect();
    return { bottom: Math.round(b.bottom), height: Math.round(b.height), min: parseFloat(getComputedStyle(hero).minHeight) };
  });
  const minWins = r.height <= r.min + 1;
  const ok = Math.abs(r.bottom - h) <= 2 || minWins;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${w}×${h}: hero ${r.height}px, bottom ${r.bottom}px${minWins ? ` (min-height ${r.min}px wins)` : ""}`);
  await page.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
