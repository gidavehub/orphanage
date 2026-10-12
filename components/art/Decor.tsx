"use client";

import { useInView } from "@/lib/motion/useInView";
import { cn } from "@/lib/cn";
import { HAND_PATH, HEART_PATH } from "./Hands";

/** Donat's looping hand-drawn arrow; draws itself in on scroll. `flip` mirrors it. */
export function CurlyArrow({ className, flip, color = "var(--color-marigold)" }: { className?: string; flip?: boolean; color?: string }) {
  const [ref, inView] = useInView<SVGSVGElement>();
  return (
    <svg
      ref={ref}
      data-drawn={inView ? "" : undefined}
      viewBox="0 0 220 130"
      className={cn("overflow-visible", flip && "-scale-x-100", className)}
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path className="draw-path" pathLength={1} style={{ "--draw-dur": "1.6s" } as React.CSSProperties} d="M6 124C14 92 40 70 78 66C104 63 118 58 124 44C130 28 116 14 104 22C92 30 100 52 126 56C156 60 184 48 206 34" />
      <path className="draw-path" pathLength={1} style={{ "--draw-dur": "0.5s", "--draw-delay": "1.45s" } as React.CSSProperties} d="M188 28L207 33L200 51" />
    </svg>
  );
}

/** Coral blob that bleeds off the top-left of the CTA band. */
export function CoralBlob({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 110" className={className} aria-hidden>
      <path fill="var(--color-flame)" d="M0 0H220C214 36 180 74 132 92C84 110 30 104 0 84Z">
        <animate
          attributeName="d"
          dur="9s"
          repeatCount="indefinite"
          values="M0 0H220C214 36 180 74 132 92C84 110 30 104 0 84Z;M0 0H220C220 42 188 82 136 98C86 112 34 96 0 78Z;M0 0H220C214 36 180 74 132 92C84 110 30 104 0 84Z"
        />
      </path>
    </svg>
  );
}

/** Green organic swoosh with a marigold heart and scattered dots (top-right of the CTA band). */
export function GreenBlobHeart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 200" className={cn("overflow-visible", className)} aria-hidden>
      <path fill="var(--color-forest)" d="M220 26C170 20 124 46 118 92C114 122 132 138 150 128C170 116 164 86 196 76C206 73 214 74 220 76Z">
        <animate
          attributeName="d"
          dur="11s"
          repeatCount="indefinite"
          values="M220 26C170 20 124 46 118 92C114 122 132 138 150 128C170 116 164 86 196 76C206 73 214 74 220 76Z;M220 20C166 22 118 52 116 98C114 128 136 142 154 130C172 118 168 90 198 82C208 79 214 80 220 82Z;M220 26C170 20 124 46 118 92C114 122 132 138 150 128C170 116 164 86 196 76C206 73 214 74 220 76Z"
        />
      </path>
      <g className="origin-center animate-heartbeat" style={{ transformBox: "fill-box" }}>
        <path d={HEART_PATH} transform="translate(186 146) rotate(-18) scale(2.1)" fill="var(--color-marigold)" />
      </g>
      {[
        [92, 38, 6],
        [104, 20, 5],
        [78, 60, 5.5],
        [120, 8, 4],
        [66, 82, 4.5],
        [90, 86, 4],
        [58, 42, 3.5],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="var(--color-marigold)" className="animate-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
    </svg>
  );
}

/** Soft grey heart with two small hearts — decoration beside the About heading. */
export function HeartCluster({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden fill="currentColor">
      <path d={HEART_PATH} transform="translate(64 70) rotate(-14) scale(3.2)" />
      <path d={HEART_PATH} transform="translate(118 30) rotate(12) scale(1.4)" />
      <path d={HEART_PATH} transform="translate(140 58) rotate(20) scale(0.8)" />
    </svg>
  );
}

/** Heart-shaped clip path for images (objectBoundingBox units). */
export function HeartClipDef({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <clipPath id={id} clipPathUnits="objectBoundingBox">
          <path d="M.5 .97C.33 .84 .02 .64 .02 .33C.02 .15 .15 .03 .3 .03C.39 .03 .46 .08 .5 .15C.54 .08 .61 .03 .7 .03C.85 .03 .98 .15 .98 .33C.98 .64 .67 .84 .5 .97Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Donat's faint pastel doodles: raised hands, hearts and sprigs (appeals + projects). */
export function DoodleField({ className }: { className?: string }) {
  const hand = (x: number, y: number, r: number, s: number, c: string) => (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill="none" stroke={c} strokeWidth={2.6 / s} strokeLinecap="round" strokeLinejoin="round">
      <path d={HAND_PATH} />
      <path d={HEART_PATH} transform="translate(-2 -30) scale(0.9)" />
      <path d="M-27 2L-30 150M26 2L22 150" />
    </g>
  );
  const sprig = (x: number, y: number, r: number, c: string) => (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M0 60C2 38 4 18 0 0" />
      {[10, 24, 38].map((yy, i) => (
        <g key={i}>
          <ellipse cx="-8" cy={yy} rx="7" ry="3.2" transform={`rotate(-35 -8 ${yy})`} />
          <ellipse cx="8" cy={yy + 6} rx="7" ry="3.2" transform={`rotate(35 8 ${yy + 6})`} />
        </g>
      ))}
    </g>
  );
  const heart = (x: number, y: number, s: number, c: string) => <path d={HEART_PATH} transform={`translate(${x} ${y}) scale(${s})`} fill={c} />;
  return (
    <svg viewBox="0 0 600 420" className={cn("pointer-events-none", className)} aria-hidden>
      <g opacity="0.55">
        {hand(210, 250, -6, 0.9, "#f2b8ae")}
        {hand(330, 238, 8, 0.8, "#f5d58a")}
        {hand(460, 262, -4, 0.95, "#f2b8ae")}
        {hand(560, 230, 10, 0.7, "#a9cfc2")}
        {sprig(120, 170, -14, "#a9cfc2")}
        {sprig(400, 120, 12, "#f5d58a")}
        {sprig(520, 60, -8, "#f2b8ae")}
        {heart(90, 90, 0.9, "#f2b8ae")}
        {heart(270, 70, 0.7, "#a9cfc2")}
        {heart(470, 150, 0.75, "#f5d58a")}
        {heart(160, 330, 0.6, "#a9cfc2")}
        {heart(380, 360, 0.8, "#f2b8ae")}
      </g>
    </svg>
  );
}
