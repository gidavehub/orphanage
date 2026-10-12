// Bake the world-flags sprite (public/flags/sprite.webp) from flag-icons' square SVGs.
//
//   node scripts/art/flags-sprite.mjs
//
// One small WebP instead of ~90 SVG requests: several flags with coats of arms are
// 20–80 KB as SVG. Order and grid come from content/world.ts (Node strips its types).

import sharp from "sharp";
import { readFile, mkdir } from "fs/promises";
import path from "path";
import { spriteCountries as countries, FLAG_SPRITE } from "../../content/world.ts";

const SRC = path.resolve("node_modules/flag-icons/flags/1x1");
const OUT = path.resolve("public/flags/sprite.webp");
const { cell, cols } = FLAG_SPRITE;
const rows = Math.ceil(countries.length / cols);

const tiles = await Promise.all(
  countries.map(async ({ code }, i) => {
    const svg = await readFile(path.join(SRC, `${code}.svg`));
    const input = await sharp(svg, { density: 300 }).resize(cell, cell, { fit: "cover" }).png().toBuffer();
    return { input, left: (i % cols) * cell, top: Math.floor(i / cols) * cell };
  }),
);

await mkdir(path.dirname(OUT), { recursive: true });
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles)
  .webp({ quality: 82, effort: 6 })
  .toFile(OUT);

const { size } = await import("fs").then((fs) => fs.statSync(OUT));
console.log(`  ✓ ${countries.length} flags → ${path.relative(process.cwd(), OUT)} (${cols}×${rows}, ${(size / 1024).toFixed(0)} KB)`);
