// Generate Haven clips with Optiq Studio's Omni video model (Vertex Interactions API).
//
//   node scripts/media/gen-videos.mjs --dry-run
//   node scripts/media/gen-videos.mjs                 render everything missing
//   node scripts/media/gen-videos.mjs --only hero-1   one clip
//
// Mirrors C:\Projects\optiq\scripts\generate-shop2ship-landing.mjs: background create + 5s poll,
// step-list input, 720p. Keeps to ≤3 starts per 90s (the platform's safe rate).

import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { access, mkdir, writeFile, appendFile } from "fs/promises";
import path from "path";
import { videos, VIDEO_STYLE, WORLD_VIDEO_STYLE } from "./manifest.mjs";

process.env.GOOGLE_APPLICATION_CREDENTIALS ||= "C:/Projects/optiq/secrets/davelabs-tools-sa.json";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";

// Single source of truth for the model id is Optiq's shipping code.
const MODEL = (() => {
  try {
    const src = readFileSync("C:/Projects/optiq/functions/omniVideo.js", "utf8");
    const m = src.match(/^const MODEL = "([^"]+)"/m);
    if (m) return m[1];
  } catch {}
  return "gemini-omni-1.1-flash-preview";
})();

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1] ?? true;
};
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
const ONLY = flag("--only") ? String(flag("--only")).split(",") : null;
const RAW = path.resolve("media-src/raw");
const LOG = path.resolve("media-src/generation-log.jsonl");

const prompt = (c) => `${c.style === "world" ? WORLD_VIDEO_STYLE : VIDEO_STYLE}\n\nACTION: ${c.scene}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

const starts = [];
async function startSlot() {
  // ≤3 interaction starts in any rolling 90s window.
  for (;;) {
    const now = Date.now();
    while (starts.length && now - starts[0] > 90_000) starts.shift();
    if (starts.length < 3) {
      starts.push(now);
      return;
    }
    await sleep(90_000 - (now - starts[0]) + 250);
  }
}

async function render(ai, clip) {
  const dest = path.join(RAW, `${clip.id}.mp4`);
  if (!FORCE && (await exists(dest))) return console.log(`  ✓ ${clip.id} (exists)`), { ok: true };
  const t0 = Date.now();
  let interaction;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await startSlot();
    try {
      interaction = await ai.interactions.create({
        model: MODEL,
        input: [{ type: "user_input", content: [{ type: "text", text: prompt(clip) }] }],
        background: true,
        store: true,
        response_format: { type: "video", resolution: "720p", aspect_ratio: clip.aspect },
      });
      break;
    } catch (err) {
      const msg = String(err?.message || err);
      if (attempt < 3 && /429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
        console.log(`  · ${clip.id}: 429, waiting 45s`);
        await sleep(45_000);
        continue;
      }
      console.log(`  ✗ ${clip.id}: create failed — ${msg.slice(0, 240)}`);
      return { ok: false };
    }
  }
  console.log(`  … ${clip.id} started (${interaction.id})`);

  let current = interaction;
  const deadline = Date.now() + 12 * 60_000;
  while (current.status === "in_progress" || current.status === "queued") {
    if (Date.now() > deadline) return console.log(`  ✗ ${clip.id}: timed out`), { ok: false };
    await sleep(5000);
    try {
      current = await ai.interactions.get(interaction.id);
    } catch {
      /* transient poll error */
    }
  }
  if (current.status !== "completed") {
    console.log(`  ✗ ${clip.id}: ${current.status} — ${String(current.output_text || JSON.stringify(current)).slice(0, 240)}`);
    return { ok: false };
  }
  const v = current.output_video;
  let bytes;
  if (v?.data) bytes = Buffer.from(v.data, "base64");
  else if (v?.uri) {
    const res = await fetch(v.uri);
    if (!res.ok) return console.log(`  ✗ ${clip.id}: download ${res.status}`), { ok: false };
    bytes = Buffer.from(await res.arrayBuffer());
  } else return console.log(`  ✗ ${clip.id}: no video returned`), { ok: false };

  await writeFile(dest, bytes);
  await appendFile(LOG, JSON.stringify({ id: clip.id, model: MODEL, at: new Date().toISOString(), bytes: bytes.length, prompt: prompt(clip) }) + "\n");
  console.log(`  ✓ ${clip.id}  ${(bytes.length / 1e6).toFixed(2)} MB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return { ok: true };
}

const wanted = videos.filter((c) => !ONLY || ONLY.includes(c.id));
console.log(`\n  ${MODEL} · 720p · ${wanted.length} clip(s) → ${RAW}\n`);
if (DRY) {
  for (const c of wanted) console.log(`── ${c.id} (${c.aspect}${c.child ? ", child placeholder" : ""})\n${prompt(c)}\n`);
  process.exit(0);
}
await mkdir(RAW, { recursive: true });
const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });
const results = await Promise.all(wanted.map((c) => render(ai, c)));
const failed = wanted.filter((_, i) => !results[i].ok).map((c) => c.id);
console.log(failed.length ? `\n  failed: ${failed.join(", ")}` : "\n  all done");
