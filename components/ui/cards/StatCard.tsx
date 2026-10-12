import { Counter } from "../Counter";
import { cn } from "@/lib/cn";

export type StatTone = "clay" | "marigold" | "cocoa" | "forest" | "umber";

export type StatCardProps = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  note?: string;
  tone: StatTone;
  /** `lg`: the landing Impact card. `sm`: the admin Today / KpiTile size (min-h 140, Anton 40). */
  size?: "lg" | "sm";
  /** Count up from zero when it scrolls into view (default: on for `lg`, off for `sm`). */
  countUp?: boolean;
  /** Compact numbers ("15K"). */
  compact?: boolean;
  /** Unverified placeholder figure: shows an "Illustrative" chip (D46). */
  illustrative?: boolean;
  /**
   * `aa` (default): notes in full white or night so 14px text passes AA on every tone.
   * `landing`: the landing Impact notes (white/90, night/80; full white on clay, which needs it for AA), for the home section only.
   */
  contrast?: "aa" | "landing";
  as?: "article" | "li" | "div";
  className?: string;
};

// Earth-tone cards (client: "more colours… orange, brown, yellow"). Text pairs pass AA.
const tones: Record<StatTone, { card: string; suffix: string; note: string; landingNote: string; chip: string }> = {
  clay: { card: "bg-clay text-white", suffix: "text-sand", note: "text-white", landingNote: "text-white", chip: "bg-white text-clay-700" },
  marigold: { card: "bg-marigold text-night", suffix: "text-umber", note: "text-night", landingNote: "text-night/80", chip: "bg-night text-marigold" },
  cocoa: { card: "bg-cocoa text-white", suffix: "text-marigold", note: "text-white", landingNote: "text-white/90", chip: "bg-white text-cocoa" },
  forest: { card: "bg-forest text-white", suffix: "text-marigold", note: "text-white", landingNote: "text-white/90", chip: "bg-white text-forest-700" },
  umber: { card: "bg-umber text-white", suffix: "text-marigold", note: "text-white", landingNote: "text-white/90", chip: "bg-white text-umber" },
};

const fmt = new Intl.NumberFormat("en-US");
function formatValue(n: number, compact?: boolean) {
  if (compact && n >= 1000) return `${Math.round(n / 1000)}K`;
  return fmt.format(Math.round(n));
}

/** A big number on an earth tone (the landing Impact card; design-system §3.7). */
export function StatCard({ label, value, prefix, suffix, note, tone, size = "lg", countUp, compact, illustrative, contrast = "aa", as: As = "article", className }: StatCardProps) {
  const t = tones[tone];
  const noteClass = contrast === "landing" ? t.landingNote : t.note;
  const lg = size === "lg";
  const animate = countUp ?? lg;
  const number = animate ? (
    <Counter value={value} prefix={prefix} suffix={suffix} compact={compact} suffixClassName={t.suffix} />
  ) : (
    <span className="tabular-nums">
      {prefix}
      {formatValue(value, compact)}
      {suffix ? <span className={t.suffix}>{suffix}</span> : null}
    </span>
  );

  if (!lg) {
    return (
      <As className={cn("flex min-h-[140px] flex-col justify-between rounded-control p-5", t.card, className)}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-grotesk text-[12px] font-medium uppercase tracking-[0.06em]">{label}</p>
          {illustrative ? <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-grotesk text-[11px] font-semibold", t.chip)}>Illustrative</span> : null}
        </div>
        <div>
          <p className="font-display text-[40px] leading-none">{number}</p>
          {note ? <p className={cn("mt-2 font-grotesk text-[13px] leading-snug", noteClass)}>{note}</p> : null}
        </div>
      </As>
    );
  }

  return (
    <As
      className={cn(
        "group relative flex min-h-[300px] flex-col justify-between rounded-card p-7 transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1.5 hover:shadow-earth md:min-h-[380px]",
        t.card,
        className,
      )}
    >
      <p className="font-grotesk text-[12px] font-medium uppercase tracking-[0.06em]">{label}</p>
      {illustrative ? (
        <span className={cn("absolute right-6 top-6 rounded-full px-2.5 py-1 font-grotesk text-[11.5px] font-semibold", t.chip)}>Illustrative</span>
      ) : null}
      <div>
        <p className="font-display text-[64px] leading-none md:text-[76px]">{number}</p>
        {note ? <p className={cn("mt-4 max-w-[280px] font-grotesk text-[14px] leading-relaxed", noteClass)}>{note}</p> : null}
      </div>
    </As>
  );
}
