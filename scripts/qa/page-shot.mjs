// Screenshot any page (viewport or full page) for visual review.
//
//   node scripts/qa/page-shot.mjs <url> <out.png> [width=1440] [height=900] [--full]
//
// Full-page mode scrolls through first so IntersectionObserver reveals have fired.

import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const full = args.includes("--full");
const [url, out, w = "1440", h = "900"] = args.filter((a) => a !== "--full");
if (!url || !out) {
  console.error("usage: page-shot.mjs <url> <out.png> [width] [height] [--full]");
  process.exit(1);
}
const width = Number(w);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage({ viewport: { width, height: Number(h) }, isMobile: width < 768, hasTouch: width < 768 });
await p.goto(url, { waitUntil: "load" });
await p.waitForTimeout(2500);
if (full) {
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 500) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await p.waitForTimeout(120);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(800);
}
await p.screenshot({ path: out, fullPage: full });
await b.close();
console.log(`  ✓ ${url} → ${out}`);
