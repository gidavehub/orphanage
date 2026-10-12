// Bake assets/og-bg.jpg, the backdrop of app/opengraph-image.tsx (link previews).
//
//   node scripts/art/og-bg.mjs
//
// The left ~45% sits under the dark text gradient, so the photos live on the right: a 2×2
// mosaic of hero families, matching the site's people mix (Gambia, India, Philippines, Yemen).

import sharp from "sharp";
import { mediaMap } from "../../content/media-map.ts";

const W = 1200;
const H = 630;
const LEFT = 470; // where the mosaic starts
const GAP = 6;
const tiles = [
  mediaMap.poster["hero-1"],
  mediaMap.img["hero-family-in"],
  mediaMap.img["hero-family-ph"],
  mediaMap.img["hero-family-ye"],
];

const cw = Math.floor((W - LEFT - GAP) / 2);
const ch = Math.floor((H - GAP) / 2);
const composite = await Promise.all(
  tiles.map(async (url, i) => ({
    input: await sharp(`public${url}`).resize(cw, ch, { fit: "cover", position: "attention" }).toBuffer(),
    left: LEFT + (i % 2) * (cw + GAP),
    top: Math.floor(i / 2) * (ch + GAP),
  })),
);

await sharp({ create: { width: W, height: H, channels: 3, background: "#061512" } })
  .composite(composite)
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile("assets/og-bg.jpg");
console.log("  ✓ assets/og-bg.jpg (2×2 family mosaic)");
