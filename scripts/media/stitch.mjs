// Join raw clips into one seamless loop with crossfades (the "Every Child" manifesto film).
//
//   node scripts/media/stitch.mjs --out manifesto --in grow-gm,grow-in,grow-ph,grow-ye
//
// Each clip loses its first second (the model sometimes opens on letterbox bars), then the
// clips crossfade into each other and the last one crossfades back into the first: the output
// starts FADE seconds into clip 1, so the browser's loop point is invisible.
// → public/media/video/<out>.mp4 (H.264 720p, muted) + public/media/posters/<out>.webp

import sharp from "sharp";
import { spawn } from "child_process";
import path from "path";
import { fingerprint } from "./fingerprint.mjs";

const FFMPEG =
  process.env.FFMPEG ||
  "C:/Users/conne/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe";

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1];
};
const OUT = flag("--out");
const IN = flag("--in")?.split(",");
if (!OUT || !IN?.length) {
  console.error("usage: stitch.mjs --out <id> --in <id,id,...>");
  process.exit(1);
}
const TRIM = 1; // seconds dropped from each clip's start
const FADE = 0.8;
const RAW = path.resolve("media-src/raw");

function run(argv, capture = false) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 || capture ? resolve(err) : reject(new Error(err.slice(-800)))));
  });
}

async function duration(file) {
  const info = await run(["-i", file], true);
  const m = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`no duration for ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const files = IN.map((id) => path.join(RAW, `${id}.mp4`));
const lens = await Promise.all(files.map(async (f) => (await duration(f)) - TRIM));

// Inputs: every clip, then clip 1 again for the closing fade back to the start.
const inputs = [...files, files[0]].flatMap((f) => ["-i", f]);
const norm = (i, extra = "") => `[${i}:v]trim=start=${TRIM}${extra},setpts=PTS-STARTPTS,scale=1280:720,fps=30,setsar=1,format=yuv420p[c${i}]`;
const parts = files.map((_, i) => norm(i));
parts.push(norm(files.length, `:duration=${FADE + 0.1}`));

let acc = "c0";
let offset = 0;
const seq = [...lens, FADE + 0.1];
for (let i = 1; i < seq.length; i++) {
  offset += seq[i - 1] - FADE;
  const out = i === seq.length - 1 ? "joined" : `x${i}`;
  parts.push(`[${acc}][c${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${out}]`);
  acc = out;
}
// Drop the first FADE seconds so the loop starts exactly where the closing fade lands.
parts.push(`[joined]trim=start=${FADE},setpts=PTS-STARTPTS[v]`);

const video = path.resolve("public/media/video", `${OUT}.mp4`);
await run([
  "-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[v]", "-an",
  "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video,
]);

const tmp = path.join(RAW, `${OUT}.poster.png`);
await run(["-y", "-ss", "1.5", "-i", video, "-frames:v", "1", tmp]);
await sharp(tmp).webp({ quality: 80 }).toFile(path.resolve("public/media/posters", `${OUT}.webp`));

const total = (await duration(video)).toFixed(1);
console.log(`  ✓ ${OUT}.mp4 ← ${IN.join(" + ")} (${total}s loop) + poster`);
await fingerprint();
