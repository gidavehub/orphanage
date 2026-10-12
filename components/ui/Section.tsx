import { BrushEdge, type SectionTone } from "@/components/art/BrushEdge";
import { cn } from "@/lib/cn";

export type { SectionTone };

/** A torn brush edge on a section boundary, painted in `color` (usually this section's own tone). */
export type SectionEdge = { shape?: "band" | "torn"; color: SectionTone; height?: number };

export type SectionProps = {
  id?: string;
  tone?: SectionTone;
  /** Content measure: grids `wrap` (1330), media bands `wrap-wide`, prose `reading` (720), forms `form` (760). */
  width?: "wrap" | "wrap-wide" | "reading" | "form" | "none";
  pad?: "none" | "sm" | "md" | "lg";
  /** Edge biting up into the section above. */
  edgeTop?: SectionEdge;
  /** Edge hanging down over the section below. */
  edgeBottom?: SectionEdge;
  /**
   * Skip layout and paint until near the viewport (`cv-auto`). Default true. Pass false for the first
   * section after the hero, form sections, and pages with a TOC or in-page anchors (design-system §7).
   */
  cv?: boolean;
  /** Realistic intrinsic height in px for short sections (default 900). */
  cvSize?: number;
  /** Turns the sticky nav to frosted glass over this section. */
  navTheme?: "glass";
  /** id of the heading that names this section (preferred). */
  labelledBy?: string;
  /** aria-label when there is no visible heading. */
  label?: string;
  /** The section before the Footer: extra bottom room so the Footer's torn edge never eats content. */
  last?: boolean;
  as?: "section" | "div";
  className?: string;
  /** Classes for the measure wrapper. */
  innerClassName?: string;
  children: React.ReactNode;
};

const DARK: readonly SectionTone[] = ["forest", "deep", "night", "clay", "coral"];

const toneClass: Record<SectionTone, string> = {
  white: "bg-white",
  paper: "paper",
  cream: "bg-cream",
  "cream-2": "bg-cream-2",
  "vu-cream": "bg-vu-cream",
  sand: "bg-sand",
  mint: "bg-mint",
  forest: "bg-forest text-white",
  deep: "bg-deep text-white",
  night: "bg-night text-white",
  clay: "bg-clay text-white",
  coral: "bg-coral text-white",
};

const padClass = {
  none: "",
  sm: "py-14 md:py-16",
  md: "py-20 md:py-28",
  lg: "py-24 md:py-32",
} as const;

/** The SectionShell every inner-page band uses (design-system §3.1). Renders `<section aria-labelledby>`. */
export function Section({
  id,
  tone = "white",
  width = "wrap",
  pad = "md",
  edgeTop,
  edgeBottom,
  cv = true,
  cvSize,
  navTheme,
  labelledBy,
  label,
  last,
  as: As = "section",
  className,
  innerClassName,
  children,
}: SectionProps) {
  const dark = DARK.includes(tone);
  const hasEdge = !!(edgeTop || edgeBottom);
  const cvStyle = cv && cvSize ? ({ containIntrinsicSize: `auto ${cvSize}px` } as React.CSSProperties) : undefined;

  const body =
    width === "none" ? (
      children
    ) : width === "reading" || width === "form" ? (
      <div className={cn("wrap", innerClassName)}>
        <div className={cn("mx-auto w-full", width === "reading" ? "max-w-reading" : "max-w-form")}>{children}</div>
      </div>
    ) : (
      <div className={cn(width, innerClassName)}>{children}</div>
    );

  return (
    <As
      id={id}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      data-nav-theme={navTheme}
      className={cn(
        "relative",
        toneClass[tone],
        dark ? "focus-marigold" : "focus-forest",
        padClass[pad],
        last && "pb-[max(9rem,12vw)] md:pb-[max(9rem,12vw)]",
        // Paint containment would clip the brush edges, so cv-auto moves to an inner wrapper then.
        cv && !hasEdge && "cv-auto",
        edgeBottom && "z-[1]",
        className,
      )}
      style={hasEdge ? undefined : cvStyle}
    >
      {edgeTop ? <BrushEdge position="top" color={edgeTop.color} shape={edgeTop.shape} height={edgeTop.height} /> : null}
      {hasEdge && cv ? (
        <div className="cv-auto" style={cvStyle}>
          {body}
        </div>
      ) : (
        body
      )}
      {edgeBottom ? <BrushEdge position="bottom" color={edgeBottom.color} shape={edgeBottom.shape} height={edgeBottom.height} /> : null}
    </As>
  );
}
