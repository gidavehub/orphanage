import { Brush } from "./Brush";
import { cn } from "@/lib/cn";

/** Section background tones (design-system §3.1). Shared by Section, PageHero and BrushEdge. */
export type SectionTone =
  | "white"
  | "paper"
  | "cream"
  | "cream-2"
  | "vu-cream"
  | "sand"
  | "mint"
  | "forest"
  | "deep"
  | "night"
  | "clay"
  | "coral";

const SECTION_TONES: readonly string[] = ["white", "paper", "cream", "cream-2", "vu-cream", "sand", "mint", "forest", "deep", "night", "clay", "coral"];

/** The CSS colour of a section tone (or any CSS colour passed through unchanged). */
export function toneColor(tone: SectionTone | string): string {
  if (tone === "white") return "white";
  return SECTION_TONES.includes(tone) ? `var(--color-${tone})` : tone;
}

export type BrushEdgeProps = {
  /** `top` bites up into the section above; `bottom` hangs down over the section below (flipped). */
  position: "top" | "bottom";
  /** The tone of the section the edge belongs to (the colour it paints). */
  color: SectionTone | string;
  shape?: "band" | "torn";
  /** Forced aspect height against a 1400 width (default 120; the Footer uses 150). */
  height?: number;
  className?: string;
};

/**
 * The squash-and-flip torn edge used by Partners and the Footer (design-system §3.1): full width,
 * aspect 1400/height, overlapping its neighbour by about 58%. Purely decorative.
 */
export function BrushEdge({ position, color, shape = "band", height = 120, className }: BrushEdgeProps) {
  const top = position === "top";
  return (
    <Brush
      name={shape}
      color={toneColor(color)}
      flipY={!top}
      className={cn(
        "pointer-events-none absolute inset-x-0 z-[1] w-full",
        top ? "bottom-[calc(100%-2px)]" : "top-full -translate-y-[58%]",
        className,
      )}
      style={{ aspectRatio: `1400 / ${height}` }}
    />
  );
}
