// Geometry for the Haven "heart of bars" mark: a classic parametric heart
// sliced into vertical capsules — echoes Voices United's bar logo and the
// slatted Join sphere, while reading as a heart (care) at favicon size.

export type Bar = { x: number; y: number; w: number; h: number };

export function heartBars(count = 9, width = 100, gapRatio = 0.42): Bar[] {
  // Sample x = 16 sin³t, y = 13cos t − 5cos2t − 2cos3t − cos4t
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 4000; i++) {
    const t = (i / 4000) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x, y]);
  }
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const scale = width / 32;
  const slot = 32 / count;
  const barW = slot * (1 - gapRatio);
  const bars: Bar[] = [];
  for (let b = 0; b < count; b++) {
    const xc = -16 + slot * (b + 0.5);
    const near = pts.filter(([x]) => Math.abs(x - xc) < barW / 2);
    if (!near.length) continue;
    // A slice can cross the curve at 2 points (sides) or 4 (either side of the top cleft).
    const ys = near.map((p) => p[1]).sort((a, b2) => a - b2);
    let top = ys[0];
    const bottom = ys[ys.length - 1];
    // Centre slice: start at the cleft, not the lobes.
    if (Math.abs(xc) < slot * 0.6) {
      const cleft = near.filter(([x]) => Math.abs(x) < barW / 2).map((p) => p[1]);
      top = Math.max(...cleft.filter((y) => y < (minY + maxY) / 2));
    }
    const inset = barW / 2; // keep rounded ends inside the silhouette
    const y0 = (top - minY + inset * 0.5) * scale;
    const y1 = (bottom - minY - inset * 0.3) * scale;
    bars.push({ x: (xc - barW / 2 + 16) * scale, y: y0, w: barW * scale, h: Math.max(barW * scale, y1 - y0) });
  }
  return bars;
}

export const HEART_VIEW = { w: 100, h: (maxHeartHeight() / 32) * 100 };

function maxHeartHeight() {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i <= 2000; i++) {
    const t = (i / 2000) * Math.PI * 2;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  return max - min;
}
