// Internal link checker (PLAN P8, the P gate). Crawls same-origin pages from the start URL and the
// sitemap, then reports:
//   broken       internal links that answer 4xx/5xx (redirects are followed and must end in 2xx)
//   placeholders href="#" links (client placeholders such as social profiles not yet supplied)
//   jsonld       application/ld+json blocks that do not parse
// Exit 1 when anything is broken or a JSON-LD block fails to parse; placeholders only warn.
//
//   node scripts/qa/links.mjs --url http://localhost:3100/ [--max 400] [--concurrency 4]

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const START = new URL(flag("--url", flag("--base", "http://localhost:3001/")));
const ORIGIN = START.origin;
const MAX = Number(flag("--max", 400));
const CONCURRENCY = Number(flag("--concurrency", 4));
const TIMEOUT = Number(flag("--timeout", 120000));

// Never crawl into private or token areas; they are checked by their own scripts.
const SKIP_CRAWL = [/^\/admin/, /^\/api\//, /^\/r\//, /^\/m\//, /^\/donate\/thank-you/, /^\/donate\/receipt/, /^\/donate\/manage/, /^\/unsubscribe/, /^\/newsletter\/confirm/, /^\/privacy\/request\/verify/];
const SKIP_CHECK = [/^\/admin/, /^\/donate\/manage/];

const pages = new Map(); // path → status
const linkSources = new Map(); // path → Set(source pages)
const placeholders = new Map(); // source → count
const jsonldErrors = [];
const queue = [];

function norm(href, from) {
  try {
    const u = new URL(href, from);
    if (u.origin !== ORIGIN) return null;
    u.hash = "";
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${ORIGIN}${path}`, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": "haven-links-qa" } });
    const type = res.headers.get("content-type") ?? "";
    const body = type.includes("text/html") ? await res.text() : (await res.arrayBuffer(), "");
    return { status: res.status, body, finalPath: new URL(res.url).pathname };
  } catch (err) {
    return { status: 0, body: "", error: String(err?.message ?? err) };
  } finally {
    clearTimeout(t);
  }
}

function enqueue(path, source) {
  if (!path) return;
  if (!linkSources.has(path)) linkSources.set(path, new Set());
  if (source) linkSources.get(path).add(source);
  if (pages.has(path) || queue.includes(path)) return;
  if (SKIP_CHECK.some((re) => re.test(path))) return;
  if (pages.size + queue.length >= MAX) return;
  queue.push(path);
}

function scan(path, html) {
  const crawl = !SKIP_CRAWL.some((re) => re.test(path.split("?")[0]));
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (href === "#" || href === "") {
      placeholders.set(path, (placeholders.get(path) ?? 0) + 1);
      continue;
    }
    if (/^(mailto|tel|sms|whatsapp|javascript):/i.test(href) || href.startsWith("#")) continue;
    if (crawl) enqueue(norm(href, `${ORIGIN}${path}`), path);
  }
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(m[1]);
    } catch (err) {
      jsonldErrors.push(`${path}: ${String(err.message).slice(0, 120)}`);
    }
  }
}

async function worker() {
  while (queue.length) {
    const path = queue.shift();
    if (pages.has(path)) continue;
    pages.set(path, "pending");
    const res = await get(path);
    pages.set(path, res.status || res.error);
    if (res.status >= 200 && res.status < 300 && res.body) scan(path, res.body);
    process.stdout.write(res.status >= 200 && res.status < 400 ? "." : "x");
  }
}

// Seed: the start page and every sitemap URL.
enqueue(`${START.pathname}${START.search}`, null);
const sm = await get("/sitemap.xml");
for (const m of (sm.body || "").matchAll(/<loc>([^<]+)<\/loc>/g)) enqueue(norm(m[1], ORIGIN), "sitemap.xml");
if (!sm.body) {
  // sitemap.xml is served as application/xml; fetch it as text.
  const r = await fetch(`${ORIGIN}/sitemap.xml`).then((x) => x.text()).catch(() => "");
  for (const m of r.matchAll(/<loc>([^<]+)<\/loc>/g)) enqueue(norm(m[1], ORIGIN), "sitemap.xml");
}

console.log(`Crawling ${ORIGIN} (max ${MAX})`);
while (queue.length) await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log("");

const broken = [...pages.entries()].filter(([, s]) => typeof s !== "number" || s >= 400 || s === 0);
console.log(`\nChecked ${pages.size} URLs.`);
if (broken.length) {
  console.log(`\nBroken (${broken.length}):`);
  for (const [p, s] of broken) console.log(`  ${s}  ${p}   ← ${[...(linkSources.get(p) ?? [])].slice(0, 3).join(", ") || "start"}`);
}
if (placeholders.size) {
  const total = [...placeholders.values()].reduce((a, b) => a + b, 0);
  console.log(`\nPlaceholder href="#" links: ${total} across ${placeholders.size} pages (client details still to come; not a failure).`);
}
if (jsonldErrors.length) {
  console.log(`\nJSON-LD that does not parse (${jsonldErrors.length}):`);
  for (const e of jsonldErrors) console.log(`  ${e}`);
}
const ok = !broken.length && !jsonldErrors.length;
console.log(ok ? "\n0 broken links, all JSON-LD parses." : "\nFAILED");
process.exit(ok ? 0 : 1);
