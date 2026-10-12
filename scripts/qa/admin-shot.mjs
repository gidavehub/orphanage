// Screenshot an admin page as a practice role (dev or local `next start` in practice mode).
//   node scripts/qa/admin-shot.mjs <role> <path> <out.png> [width] [height] [--full]
import { chromium } from "playwright-core";
const [role, path, out, w = "1280", h = "900"] = process.argv.slice(2);
const full = process.argv.includes("--full");
const base = process.env.BASE ?? "http://localhost:3001";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: Number(w), height: Number(h) } });
const res = await ctx.request.post(`${base}/api/dev/session?role=${role}`);
if (!res.ok()) throw new Error(`sign-in failed: ${res.status()}`);
const p = await ctx.newPage();
await p.goto(`${base}${path}`, { waitUntil: "load", timeout: 120000 });
await p.waitForTimeout(2500);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await p.screenshot({ path: out, fullPage: full });
console.log(`  ✓ ${role} ${path} → ${out} (horizontal overflow ${overflow}px)`);
await b.close();
