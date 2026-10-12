import { cn } from "@/lib/cn";

/**
 * Haven logo: a brush-stroke roof sheltering an "H" whose crossbar is a heart,
 * followed by the "aven" wordmark in Nunito Black (Donat-style stylised initial).
 */

export function HavenMark({
  className,
  title,
  animated,
  roof = "var(--color-flame)",
  stem = "var(--color-forest)",
  heart = "var(--color-marigold)",
}: {
  className?: string;
  title?: string;
  animated?: boolean;
  roof?: string;
  stem?: string;
  heart?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 116"
      className={cn("haven-mark overflow-visible", animated && "haven-mark--animated", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        className="haven-mark__roof"
        fill={roof}
        d="M3.5 46.5c0-3.6 2.2-6.1 5-8.2L54 5.2c3.7-2.8 8.3-2.8 12 0l45.5 33.1c2.8 2.1 5 4.6 5 8.2 0 6-6.5 9.4-11.6 5.8L60 19.6 15.1 52.3C10 55.9 3.5 52.5 3.5 46.5z"
      />
      <rect className="haven-mark__stem" x="18" y="45" width="20" height="68" rx="10" fill={stem} />
      <rect className="haven-mark__stem" x="82" y="45" width="20" height="68" rx="10" fill={stem} />
      <path
        className="haven-mark__heart"
        fill={heart}
        d="M60 98.5c-12.4-8.3-24-16.6-24-28.2 0-7.3 5.4-12.3 11.7-12.3 5.3 0 9.9 3.1 12.3 7.6 2.4-4.5 7-7.6 12.3-7.6 6.3 0 11.7 5 11.7 12.3 0 11.6-11.6 19.9-24 28.2z"
      />
    </svg>
  );
}

const markTones = {
  color: {},
  /** For coral / photo backgrounds where the flame roof would disappear. */
  mono: { roof: "#ffffff", stem: "#ffffff", heart: "var(--color-marigold)" },
} as const;

export function Logo({
  tone = "dark",
  mark = "color",
  className,
  markClassName,
  animated,
}: {
  tone?: "dark" | "light";
  mark?: keyof typeof markTones;
  className?: string;
  markClassName?: string;
  animated?: boolean;
}) {
  return (
    <span role="img" className={cn("inline-flex items-end leading-none", className)} aria-label="Haven">
      <HavenMark
        className={cn("h-[1.12em] w-auto shrink-0", markClassName)}
        animated={animated}
        {...markTones[mark]}
      />
      <span
        aria-hidden
        className={cn(
          "-ml-[0.02em] font-sans font-black tracking-[-0.035em]",
          tone === "dark" ? "text-ink" : "text-white",
        )}
        style={{ fontSize: "1em", lineHeight: 0.74 }}
      >
        aven
      </span>
    </span>
  );
}
