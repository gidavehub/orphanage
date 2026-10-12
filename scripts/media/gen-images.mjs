// Generate Haven stills with Optiq Studio's Vertex image model.
//
//   node scripts/media/gen-images.mjs --dry-run            print prompts, spend nothing
//   node scripts/media/gen-images.mjs                      render everything missing
//   node scripts/media/gen-images.mjs --only hero-2,about  specific ids
//   node scripts/media/gen-images.mjs --kind brush         one kind
//   node scripts/media/gen-images.mjs --force --only x     re-render
//
// Auth: GOOGLE_APPLICATION_CREDENTIALS → C:\Projects\optiq\secrets\davelabs-tools-sa.json
// (defaulted below; the key is never copied into this repo).

import { GoogleAuth } from "google-auth-library";
import { mkdir, writeFile, access, appendFile } from "fs/promises";
import path from "path";
import { images, PHOTO_STYLE, WORLD_STYLE, PORTRAIT_STYLE, BRUSH_STYLE, CHROMA_STYLE } from "./manifest.mjs";

process.env.GOOGLE_APPLICATION_CREDENTIALS ||= "C:/Projects/optiq/secrets/davelabs-tools-sa.json";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = "gemini-3.1-flash-image";
const URL = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;
const RAW = path.resolve("media-src/raw");
const LOG = path.resolve("media-src/generation-log.jsonl");

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1] ?? true;
};
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
const ONLY = flag("--only") ? String(flag("--only")).split(",") : null;
const KIND = flag("--kind");
const CONCURRENCY = Number(flag("--concurrency") || 2);

const STYLE = { photo: PHOTO_STYLE, world: WORLD_STYLE, portrait: PORTRAIT_STYLE, brush: BRUSH_STYLE, chroma: CHROMA_STYLE };
const promptFor = (s) => `${s.prompt}\n\n${STYLE[s.kind]}`;

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

async function call(body, label) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt >= 4) throw e;
      await sleep(5000);
      continue;
    }
    if (res.ok) return res.json();
    const t = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt < 5) {
      const wait = res.status === 429 ? 35000 : 8000;
      console.log(`    · ${res.status} on ${label}; retry in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    const err = new Error(`${res.status}: ${t.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
}

async function render(shot) {
  const out = path.join(RAW, `${shot.id}.png`);
  if (!FORCE && (await exists(out))) return console.log(`  ✓ ${shot.id} (exists)`);
  const t0 = Date.now();
  const size = shot.size ?? (shot.kind === "brush" || shot.kind === "chroma" ? "2K" : undefined);
  const imageConfig = { aspectRatio: shot.aspect, ...(size ? { imageSize: size } : {}) };
  const body = (cfg) => ({
    contents: [{ role: "user", parts: [{ text: promptFor(shot) }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: cfg },
  });
  let data;
  try {
    data = await call(body(imageConfig), shot.id);
  } catch (e) {
    if (e.status === 400 && size) {
      console.log(`    · ${shot.id}: imageSize ${size} rejected, retrying at default size`);
      data = await call(body({ aspectRatio: shot.aspect }), shot.id);
    } else throw e;
  }
  const cand = data.candidates?.[0];
  const inline = cand?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) {
    const why = cand?.finishReason || data.promptFeedback?.blockReason || "no image";
    const text = cand?.content?.parts?.find((p) => p.text)?.text?.slice(0, 160) || "";
    throw new Error(`no image (${why}) ${text}`);
  }
  const buf = Buffer.from(inline.data, "base64");
  await writeFile(out, buf);
  await appendFile(LOG, JSON.stringify({ id: shot.id, model: MODEL, at: new Date().toISOString(), bytes: buf.length, prompt: promptFor(shot) }) + "\n");
  console.log(`  ✓ ${shot.id}  ${(buf.length / 1e6).toFixed(2)} MB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

const wanted = images.filter((s) => (!ONLY || ONLY.includes(s.id)) && (!KIND || s.kind === KIND));
if (!wanted.length) {
  console.error("nothing matched");
  process.exit(1);
}
console.log(`\n  ${MODEL} · ${wanted.length} still(s) → ${RAW}\n`);

if (DRY) {
  for (const s of wanted) console.log(`── ${s.id} (${s.aspect}${s.size ? " " + s.size : ""}, ${s.kind}${s.child ? ", child placeholder" : ""})\n${promptFor(s)}\n`);
  process.exit(0);
}

await mkdir(RAW, { recursive: true });
const failures = [];
const queue = [...wanted];
async function worker(n) {
  await sleep(n * 4000); // stagger starts
  while (queue.length) {
    const shot = queue.shift();
    try {
      await render(shot);
    } catch (e) {
      console.log(`  ✗ ${shot.id}: ${e.message}`);
      failures.push(shot.id);
    }
    await sleep(6000);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
console.log(failures.length ? `\n  failed: ${failures.join(", ")}` : "\n  all done");
