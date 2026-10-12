// Mobile LCP forensics: 4× CPU throttle + slow network, log every LCP candidate
// and the long tasks around it.
//   node scripts/qa/lcp.mjs [url]
import { chromium } from "playwright-core";
const URL = process.argv[2] || "http://localhost:3001/";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await p.addInitScript(() => {
  window.__lcp = [];
  window.__lt = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? e.element.tagName + "." + String(e.element.className?.baseVal ?? e.element.className).slice(0, 40) + " " + (e.url || "").split("/").pop().slice(0, 60) : e.url }))).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true });
});
await p.goto(URL, { waitUntil: "load" });
await p.waitForTimeout(9000);
const r = await p.evaluate(() => ({ lcp: window.__lcp, lt: window.__lt, fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0) }));
console.log("FCP", r.fcp);
console.log("LCP candidates:"); r.lcp.forEach((c) => console.log(`  ${c.t}ms size=${c.size} ${c.el}`));
console.log("long tasks (start, dur):", r.lt.map(([s, d]) => `${s}+${d}`).join("  "));
await b.close();
