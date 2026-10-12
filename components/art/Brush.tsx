import { brushes, type BrushName } from "./brush-index";
import { cn } from "@/lib/cn";

// Brush shapes are traced from Optiq-generated ink plates (public/brush/*.svg) and
// applied as CSS masks: one shape can be any colour, or cut a photo into a brush patch.

type Transform = { flipX?: boolean; flipY?: boolean; rotate?: number };

function transform({ flipX, flipY, rotate }: Transform) {
  const t = [rotate ? `rotate(${rotate}deg)` : "", flipX ? "scaleX(-1)" : "", flipY ? "scaleY(-1)" : ""].filter(Boolean).join(" ");
  return t || undefined;
}

export function maskStyle(name: BrushName, size = "100% 100%"): React.CSSProperties {
  const url = `url(/brush/${name}.svg)`;
  return {
    maskImage: url,
    WebkitMaskImage: url,
    maskSize: size,
    WebkitMaskSize: size,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };
}

/** A solid brush mark in `color`, sized by width (height follows the plate's aspect). */
export function Brush({
  name,
  color = "currentColor",
  className,
  style,
  ...t
}: { name: BrushName; color?: string; className?: string; style?: React.CSSProperties } & Transform) {
  const { w, h } = brushes[name];
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      style={{
        aspectRatio: `${w} / ${h}`,
        backgroundColor: color,
        transform: transform(t),
        ...maskStyle(name),
        ...style,
      }}
    />
  );
}

/** Clips its children (usually a photo) to a brush shape. */
export function BrushMask({
  name,
  className,
  children,
  size,
  style,
}: {
  name: BrushName;
  className?: string;
  children: React.ReactNode;
  size?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("relative", className)} style={{ ...maskStyle(name, size), ...style }}>
      {children}
    </div>
  );
}
