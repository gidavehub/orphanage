import { FlagDisc } from "./flag";
import { renderIcon, type IconLike } from "./icon";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "forest"
  | "marigold"
  | "clay"
  | "coral"
  | "glass"
  /** Count badge (admin-ux §9.2): marigold with night text. */
  | "count"
  /** Lock / restricted badge: deep with white text. */
  | "deep";

export type BadgeProps = {
  tone?: BadgeTone;
  icon?: IconLike;
  /** Glass tone only: a round country flag before the words (the hero PlaceChip). */
  flag?: string;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
};

// Every text/background pair passes AA (design-system §6.1).
const tones: Record<BadgeTone, string> = {
  neutral: "bg-pebble text-body",
  forest: "bg-mint text-forest-700",
  marigold: "bg-marigold-100 text-umber",
  clay: "bg-clay-100 text-clay-700",
  coral: "bg-coral-100 text-coral-800",
  glass: "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md",
  count: "bg-marigold text-night",
  deep: "bg-deep text-white",
};

/** Small label for categories, file facts and states ("Public · PDF 2.4 MB", "AI draft", counts). */
export function Badge({ tone = "neutral", icon, flag, size = "md", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-grotesk font-semibold leading-none",
        size === "md" ? "h-7 px-3 text-[12.5px]" : "h-6 px-2.5 text-[12px]",
        flag && "pl-1",
        tones[tone],
        className,
      )}
    >
      {flag ? <FlagDisc code={flag} className={cn("ring-2 ring-white/80", size === "md" ? "size-5" : "size-4")} /> : null}
      {renderIcon(icon, "size-3.5 shrink-0")}
      <span className="truncate">{children}</span>
    </span>
  );
}
