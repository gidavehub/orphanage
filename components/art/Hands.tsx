"use client";

import { useInView } from "@/lib/motion/useInView";
import { cn } from "@/lib/cn";

/**
 * One open hand, palm facing the viewer, wrist at (0,0), fingers pointing up (−y).
 * Drawn as a single outline so it can be stroke-drawn or filled.
 */
export const HAND_PATH =
  "M-27 2C-28-14-33-27-45-38C-57-49-66-60-61-69C-56-77-45-72-37-62C-31-55-28-53-25-57" +
  "L-27-104C-27-116-13-117-13-105L-11-64" +
  "L-10-117C-10-129 4-129 4-117L5-63" +
  "L8-111C9-122 21-121 20-110L18-60" +
  "L25-95C27-105 38-103 36-93L29-47C26-30 24-14 26 2";

/** Small heart centred on (0,0), ~30 units wide. */
export const HEART_PATH =
  "M0 12C-8 6-15 0-15-7C-15-12-11-15-7-15C-4-15-1-13 0-10C1-13 4-15 7-15C11-15 15-12 15-7C15 0 8 6 0 12Z";

/** Line-art hand with a heart on the palm and a long forearm running off-canvas. */
function OutlineHand({ transform, color, width = 2.4, delay = 0 }: { transform: string; color: string; width?: number; delay?: number }) {
  const d = (s: number) => ({ "--draw-delay": `${delay + s}s` }) as React.CSSProperties;
  return (
    <g transform={transform} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path className="draw-path" pathLength={1} style={d(0.15)} d={HAND_PATH} />
      <path className="draw-path" pathLength={1} style={d(0)} d="M-27 2L-40 420" />
      <path className="draw-path" pathLength={1} style={d(0)} d="M26 2L14 420" />
      <path className="draw-path" pathLength={1} style={d(0.9)} d={HEART_PATH} transform="translate(-2 -30) scale(0.95)" />
    </g>
  );
}

/** Donat services-section hands (green + marigold), stroke-drawn on scroll. */
export function HandsLineArt({ className }: { className?: string }) {
  const [ref, inView] = useInView<SVGSVGElement>();
  return (
    <svg ref={ref} data-drawn={inView ? "" : undefined} viewBox="0 0 320 340" className={cn("overflow-visible", className)} aria-hidden>
      <OutlineHand transform="translate(205 118) rotate(48) scale(0.95)" color="var(--color-forest)" />
      <OutlineHand transform="translate(150 250) rotate(56) scale(0.72)" color="var(--color-marigold)" width={2.8} delay={0.35} />
    </svg>
  );
}

/** Three overlapping filled hands (flame / forest / marigold) around a heart — FAQ badge. */
export function ColorHands({ className }: { className?: string }) {
  return (
    <svg viewBox="-150 -150 300 300" className={cn("overflow-visible", className)} aria-hidden>
      <g className="origin-center animate-[spin_40s_linear_infinite] motion-reduce:animate-none">
        <path d={HAND_PATH} transform="rotate(-20) translate(0 -18) scale(0.95)" fill="var(--color-flame)" />
        <path d={HAND_PATH} transform="rotate(-140) translate(0 -18) scale(0.95)" fill="var(--color-forest)" />
        <path d={HAND_PATH} transform="rotate(100) translate(0 -18) scale(0.95)" fill="var(--color-marigold)" />
      </g>
      <path d={HEART_PATH} transform="scale(1.9)" fill="#fff" />
    </svg>
  );
}

/** Marigold hand with a forest heart, dots and a curly stem (testimonials + footer). */
export function HandDoodle({ className, dots = "var(--color-forest)" }: { className?: string; dots?: string }) {
  return (
    <svg viewBox="0 0 220 220" className={cn("overflow-visible", className)} aria-hidden>
      <g className="origin-[60%_60%] animate-wobble motion-reduce:animate-none">
        <path d={HAND_PATH} transform="translate(118 108) rotate(28) scale(0.72)" fill="var(--color-marigold)" />
        <path d={HEART_PATH} transform="translate(110 92) rotate(24) scale(0.9)" fill={dots} />
        {[
          [48, 30, 5],
          [34, 50, 4],
          [58, 58, 4.5],
          [28, 76, 3.5],
          [46, 92, 4],
          [70, 36, 3],
          [24, 104, 3],
        ].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={r * 0.8} ry={r * 1.3} fill={dots} transform={`rotate(-30 ${x} ${y})`} className="animate-twinkle" style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
      </g>
      <path
        d="M118 148C112 176 138 196 168 190C196 184 206 206 190 214C176 221 170 198 196 192C214 188 230 196 240 204"
        fill="none"
        stroke={dots}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
