// Regenerate content/media-credits.ts (media provenance for the handoff) from manifest.mjs.
//
//   node scripts/media/credits.mjs

import { writeFile } from "fs/promises";
import { images, videos } from "./manifest.mjs";

const IMAGE_MODEL = "gemini-3.1-flash-image";
const VIDEO_MODEL = "gemini-omni-1.1-flash-preview";

const credits = [
  ...images.filter((s) => s.kind !== "brush").map((s) => ({ id: s.id, type: "image", section: s.section, model: IMAGE_MODEL, childPlaceholder: !!s.child })),
  ...videos.map((c) => ({ id: c.id, type: "video", section: c.section, model: VIDEO_MODEL, childPlaceholder: !!c.child })),
  { id: "brush/*", type: "image", section: "art", model: `${IMAGE_MODEL} → potrace`, childPlaceholder: false },
];

const out = `// AUTO-GENERATED from scripts/media/manifest.mjs (node scripts/media/credits.mjs): media provenance for the handoff.
// Every asset below is AI-generated with Optiq Studio (Vertex AI) and is illustrative.
// childPlaceholder: true → MUST be replaced with real, consented photography before launch
// (ToR §3 hero guidance + §15 safeguarding).

export type MediaCredit = { id: string; type: "image" | "video"; section: string; model: string; childPlaceholder: boolean };

export const mediaCredits: MediaCredit[] = ${JSON.stringify(credits, null, 2)};
`;

await writeFile("content/media-credits.ts", out);
const kids = credits.filter((c) => c.childPlaceholder).length;
console.log(`  ✓ content/media-credits.ts: ${credits.length} entries, ${kids} child placeholders`);
