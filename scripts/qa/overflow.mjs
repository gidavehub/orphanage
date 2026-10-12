// Lists elements that stick out horizontally (outside any clipping ancestor), page by page.
//
//   node scripts/qa/overflow.mjs 375 768 1280 1440 --base http://localhost:3100 [--all] [--only /donate,/faq]
//   … [--cookie "haven_session=…"] [--role super_admin]   as a signed-in person (e.g. --only /admin,/admin/inbox)
//
// Without --all only the landing is checked; --all reads every URL from /sitemap.xml (the P gate).
// Exit 1 when any page scrolls sideways at any width.
import { chromium } from "playwright-core";
import { applySession, sessionFlags } from "./_session.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");
const ALL = args.includes("--all");
const ONLY = flag("--only") ? String(flag("--only")).split(",") : null;
const CONCURRENCY = Number(flag("--concurrency", 3));
const widths = args.filter((a, i) => /^\d+$/.test(a) && !["--concurrency"].includes(args[i - 1])).map(Number);
const SESSION = sessionFlags(args);

let routes = ONLY ?? ["/"];
if (ALL && !ONLY) {
  const xml = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text());
  routes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext();
await applySession(ctx, BASE, SESSION);
let failures = 0;

async function check(W, path) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: W, height: 900 });
  try {
    await p.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 90000 });
    await p.waitForTimeout(1200);
    return await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const clipped = (el) => {
        for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (["hidden", "clip"].includes(s.overflowX) || s.position === "fixed") return true;
        }
        return false;
      };
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== "fixed")
          out.push(`${el.tagName}.${String(el.className?.baseVal ?? el.className).slice(0, 70)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
      return { scroll: document.documentElement.scrollWidth - vw, out: out.slice(0, 6) };
    });
  } catch (err) {
    return { scroll: -1, out: [String(err?.message ?? err).slice(0, 160)] };
  } finally {
    await p.close();
  }
}

for (const W of widths.length ? widths : [375, 768, 1024, 1440]) {
  const queue = [...routes];
  const bad = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const path = queue.shift();
        const r = await check(W, path);
        if (r.scroll !== 0) bad.push({ path, ...r });
      }
    }),
  );
  console.log(`${W}px: ${routes.length - bad.length}/${routes.length} pages fit`);
  for (const x of bad) {
    failures++;
    console.log(`   ${x.path}: ${x.scroll < 0 ? "error" : `scroll overflow ${x.scroll}px`}`);
    x.out.forEach((o) => console.log("      " + o));
  }
}
await b.close();
process.exit(failures ? 1 : 0);
