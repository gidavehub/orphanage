// Lighthouse (mobile + desktop) against a running production server, with retries.
//   npx next build && npx next start -p 3001   (separate terminal), then:
//   node scripts/qa/lighthouse.mjs [url]
import { spawnSync } from "child_process";
import { readFileSync, existsSync, rmSync } from "fs";

const URL = process.argv[2] || "http://localhost:3001/";
const env = { ...process.env, CHROME_PATH: "C:/Program Files/Google/Chrome/Application/chrome.exe" };

function run(preset) {
  const out = `media-src/qa/lh-${preset}.json`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (existsSync(out)) rmSync(out);
    spawnSync(
      "npx",
      ["-y", "lighthouse@12", URL, "--quiet", "--chrome-flags=--headless=new", "--only-categories=performance,accessibility,best-practices,seo",
        "--output=json", `--output-path=${out}`, preset === "desktop" ? "--preset=desktop" : "--form-factor=mobile"],
      { env, shell: true, stdio: "ignore", timeout: 240_000 },
    );
    try {
      return JSON.parse(readFileSync(out, "utf8")); // EPERM on temp-profile cleanup is harmless if the report exists
    } catch {
      console.log(`  ${preset}: attempt ${attempt} produced no report, retrying…`);
    }
  }
  return null;
}

for (const preset of ["mobile", "desktop"]) {
  const r = run(preset);
  if (!r) {
    console.log(`${preset.toUpperCase()}: failed after 3 attempts`);
    continue;
  }
  const a = r.audits;
  console.log(`${preset.toUpperCase()}: ` + Object.entries(r.categories).map(([k, c]) => `${k} ${Math.round(c.score * 100)}`).join(" | "));
  console.log("  " + ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"]
    .map((id) => id.split("-").map((w) => w[0]).join("").toUpperCase() + " " + a[id].displayValue).join(" | "));
  const lcp = a["largest-contentful-paint-element"].details?.items;
  const node = lcp?.[0]?.items?.[0]?.node;
  if (node) console.log(`  LCP element: ${node.nodeLabel || ""} ${node.snippet.slice(0, 90)}`);
  const phases = lcp?.[1]?.items;
  if (phases) console.log("  LCP phases: " + phases.map((p) => `${p.phase} ${Math.round(p.timing)}ms`).join(", "));
}
