// Post-process generated media into web-ready assets under public/media.
//
//   node scripts/media/process.mjs            everything that has a raw source
//   node scripts/media/process.mjs --only hand-left,hero-1 --force
//
// Stills  → WebP (max 2400px). Chroma plates → keyed to alpha + trimmed.
// Clips   → H.264 720p CRF 28, muted, faststart + WebP poster at ~1s.

import sharp from "sharp";
import { spawn } from "child_process";
import { access, mkdir, stat } from "fs/promises";
import path from "path";
import { images, videos } from "./manifest.mjs";
import { fingerprint, hasAsset } from "./fingerprint.mjs";

const FFMPEG =
  process.env.FFMPEG ||
  "C:/Users/conne/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe";

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1] ?? true;
};
const FORCE = args.includes("--force");
const ONLY = flag("--only") ? String(flag("--only")).split(",") : null;

const RAW = path.resolve("media-src/raw");
const IMG = path.resolve("public/media/img");
const VID = path.resolve("public/media/video");
const POST = path.resolve("public/media/posters");
const exists = (p) => access(p).then(() => true, () => false);
const mb = async (p) => ((await stat(p)).size / 1e6).toFixed(2);

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
  });
}

/** Chroma-key a pure-green plate to alpha with soft edges and green despill. */
async function keyGreen(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const spill = g - Math.max(r, b);
    // spill > 90 → fully background; < 25 → fully subject; ramp between.
    const a = spill >= 90 ? 0 : spill <= 25 ? 1 : 1 - (spill - 25) / 65;
    data[i + 3] = Math.round(a * 255);
    if (spill > 0) data[i + 1] = Math.max(r, b) + Math.min(spill, 6); // despill
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

async function still(shot) {
  if (shot.kind === "brush") return; // traced separately (trace-brushes.mjs)
  const src = path.join(RAW, `${shot.id}.png`);
  if (!(await exists(src))) return console.log(`  · ${shot.id}: no raw source yet`);
  const out = path.join(IMG, `${shot.id}.webp`);
  if (!FORCE && (await hasAsset(IMG, shot.id, "webp"))) return;
  let pipeline;
  if (shot.kind === "chroma") {
    pipeline = sharp(await keyGreen(src)).resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 90 });
  } else {
    pipeline = sharp(src).resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 5 });
  }
  await pipeline.toFile(out);
  console.log(`  ✓ img  ${shot.id.padEnd(20)} ${await mb(out)} MB`);
}

async function clip(c) {
  const src = path.join(RAW, `${c.id}.mp4`);
  if (!(await exists(src))) return console.log(`  · ${c.id}: no raw clip yet`);
  const out = path.join(VID, `${c.id}.mp4`);
  const poster = path.join(POST, `${c.id}.webp`);
  // `trimStart` drops a clip's opening seconds (some open on letterbox bars).
  const start = String(c.trimStart ?? 0);
  if (FORCE || !(await hasAsset(VID, c.id, "mp4"))) {
    const scale = c.aspect === "9:16" ? "scale=720:-2" : "scale=1280:-2";
    await run(FFMPEG, [
      "-y", "-ss", start, "-i", src, "-an", "-vf", `${scale},fps=30`, "-c:v", "libx264", "-preset", "slow", "-crf", "28",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
    ]);
    console.log(`  ✓ clip ${c.id.padEnd(20)} ${await mb(out)} MB`);
  }
  if (FORCE || !(await hasAsset(POST, c.id, "webp"))) {
    const tmp = path.join(RAW, `${c.id}.poster.png`);
    await run(FFMPEG, ["-y", "-ss", String((c.trimStart ?? 0) + 0.6), "-i", src, "-frames:v", "1", tmp]);
    await sharp(tmp).webp({ quality: 80 }).toFile(poster);
    console.log(`  ✓ post ${c.id.padEnd(20)} ${await mb(poster)} MB`);
  }
}

await Promise.all([IMG, VID, POST].map((d) => mkdir(d, { recursive: true })));
const pick = (list) => list.filter((x) => !ONLY || ONLY.includes(x.id));
for (const s of pick(images)) {
  try {
    await still(s);
  } catch (e) {
    console.log(`  ✗ ${s.id}: ${e.message}`);
  }
}
// Clips marked `stitch` are joined by stitch.mjs rather than published one by one.
for (const c of pick(videos).filter((v) => !v.stitch)) {
  try {
    await clip(c);
  } catch (e) {
    console.log(`  ✗ ${c.id}: ${e.message}`);
  }
}
await fingerprint();
console.log("  done");
