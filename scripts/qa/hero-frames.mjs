// Capture the hero at fixed times so every slide (and its flag chip) can be checked once settled.
//
//   node scripts/qa/hero-frames.mjs [--url http://localhost:3100/] [--w 1440 --h 900]
//
// Output → media-src/qa/hero/<w>-slide-<n>.png (gitignored scratch).

import { chromium } from "playwright-core";
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
const OUT = path.resolve("media-src/qa/hero");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, isMobile: W < 768, hasTouch: W < 768 });
await page.goto(URL, { waitUntil: "load" });
const dots = page.locator('[aria-label^="Show slide"]');
const n = await dots.count();
for (let i = 0; i < n; i++) {
  await dots.nth(i).click();
  await page.mouse.move(W / 2, H / 2); // hover pauses the autoplay on this slide
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, `${W}-slide-${i + 1}.png`) });
  console.log(`  ✓ slide ${i + 1}`);
}
await browser.close();
