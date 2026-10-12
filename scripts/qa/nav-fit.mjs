// The pill navigation must fit at every desktop width (xl and up): the last item must clear
// the search button.
//
//   node scripts/qa/nav-fit.mjs [--url http://localhost:3000/]

import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const i = args.indexOf("--url");
const URL = i === -1 ? "http://localhost:3000/" : args[i + 1];

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let fails = 0;
for (const w of [1280, 1300, 1366, 1400, 1440, 1536, 1920]) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 } });
  await page.goto(URL, { waitUntil: "load" });
  const r = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const items = nav.querySelector("ul").getBoundingClientRect().right;
    const search = nav.querySelector('button[aria-label="Search"]').getBoundingClientRect().left;
    return { gap: Math.round(search - items) };
  });
  const ok = r.gap >= 16;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${w}px: last nav item ends ${r.gap}px before the search button`);
  await page.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
