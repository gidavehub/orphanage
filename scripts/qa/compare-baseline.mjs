// Pixel-compare fresh section screenshots against media-src/qa/baseline/.
//
//   node scripts/qa/shoot.mjs --url http://localhost:3100/            (writes media-src/qa/1440)
//   node scripts/qa/shoot.mjs --url http://localhost:3100/ --w 375 --h 812
//   node scripts/qa/compare-baseline.mjs [--widths 1440,375] [--max 3]
//
// Prints the share of differing pixels per section (channel delta > 24 counts as different).
// Animated sections (hero Ken Burns, carousels, marquees, videos) legitimately differ, so they
// are reported as "animated" rather than failed. Diff images → media-src/qa/diff/<width>/.

import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";
import path from "path";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};
const WIDTHS = String(flag("--widths", "1440,375")).split(",");
const MAX = Number(flag("--max", 3)); // % of differing pixels allowed for static sections
// Sections whose content moves on its own; differences there are expected.
const ANIMATED = /hero|world|map|focus|manifesto|appeals|donate|stories|testimonials|join|partners/;

let failed = 0;
for (const w of WIDTHS) {
  const base = path.resolve("media-src/qa/baseline", w);
  const now = path.resolve("media-src/qa", w);
  const out = path.resolve("media-src/qa/diff", w);
  await mkdir(out, { recursive: true });
  const files = (await readdir(base)).filter((f) => f.endsWith(".png"));
  console.log(`\n  ${w}px`);
  for (const f of files) {
    let a, b;
    try {
      a = await sharp(path.join(base, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      b = await sharp(path.join(now, f)).resize(a.info.width, a.info.height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    } catch {
      console.log(`  ? ${f}: missing in fresh run`);
      continue;
    }
    const diff = Buffer.alloc(a.data.length);
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      const hit = d > 24;
      if (hit) n++;
      diff[i] = hit ? 255 : a.data[i] * 0.25;
      diff[i + 1] = hit ? 0 : a.data[i + 1] * 0.25;
      diff[i + 2] = hit ? 80 : a.data[i + 2] * 0.25;
      diff[i + 3] = 255;
    }
    const pct = (n / (a.data.length / 4)) * 100;
    const animated = ANIMATED.test(f);
    const ok = pct <= MAX || animated;
    if (!ok) failed++;
    if (pct > 0.5) await sharp(diff, { raw: { width: a.info.width, height: a.info.height, channels: 4 } }).png().toFile(path.join(out, f));
    console.log(`  ${ok ? (pct <= MAX ? "✓" : "~") : "✗"} ${f.padEnd(22)} ${pct.toFixed(2).padStart(6)}%${animated && pct > MAX ? "  (animated section)" : ""}`);
  }
}
console.log(failed ? `\n  ${failed} static section(s) differ by more than ${MAX}%` : "\n  all static sections match the baseline");
process.exit(failed ? 1 : 0);
