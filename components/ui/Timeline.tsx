import { PopInView } from "./PopInView";
import { renderIcon, type IconLike } from "./icon";
import type { StatusTone } from "@/lib/model/status-meta";
import { cn } from "@/lib/cn";

export type TimelineItem = {
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Display time ("2h ago", "12 Oct"); activity variant. */
  time?: string;
  /** Machine-readable time for `<time dateTime>` (ISO). */
  dateTime?: string;
  /** Absolute time shown as a tooltip when `time` is relative. */
  timeTitle?: string;
  /** Activity dot colour. */
  tone?: StatusTone;
  /** Process variant: replaces the numeral in the disc. Activity: replaces the dot. */
  icon?: IconLike;
  id?: string;
};

export type TimelineProps = {
  items: TimelineItem[];
  /**
   * `process`: numbered forest discs on a 2px rail ("How it works", "What happens next").
   * `activity`: small tone dots on a hairline rail, actor + action and a time (admin case log).
   */
  variant?: "process" | "activity";
  /** Process only: `horizontal` lays the steps out in a row from lg (programme "How the process works"). */
  layout?: "vertical" | "horizontal";
  /** Process titles render as headings at this level (default: plain bold text). */
  headingLevel?: 3 | 4;
  /** First numeral (default 1). */
  start?: number;
  className?: string;
};

const dot: Record<StatusTone, string> = {
  new: "bg-marigold",
  review: "bg-cocoa",
  waiting: "bg-clay",
  active: "bg-forest",
  referred: "bg-forest-700",
  approved: "bg-forest",
  done: "bg-forest",
  declined: "bg-coral-800",
  closed: "bg-edge",
  urgent: "bg-coral-800",
  restricted: "bg-night",
};

/** Steps or a case log (design-system §3.6). Server component; only the disc pops are client leaves. */
export function Timeline({ items, variant = "process", layout = "vertical", headingLevel, start = 1, className }: TimelineProps) {
  if (variant === "activity") {
    return (
      <ol className={cn("relative grid gap-5", className)}>
        <span aria-hidden className="absolute bottom-2 left-[4px] top-2 w-px bg-line" />
        {items.map((it, i) => (
          <li key={it.id ?? i} className="relative grid grid-cols-[10px_minmax(0,1fr)] gap-x-4">
            <span aria-hidden className="relative mt-[7px] grid size-[10px] place-items-center">
              {it.icon ? (
                <span className="grid size-5 place-items-center rounded-full bg-white text-body">{renderIcon(it.icon, "size-3")}</span>
              ) : (
                <span className={cn("size-[10px] rounded-full ring-4 ring-white", dot[it.tone ?? "closed"])} />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-[15px] leading-snug text-ink">{it.title}</div>
              {it.body ? <div className="mt-1 text-[14px] leading-relaxed text-body">{it.body}</div> : null}
              {it.time ? (
                <time dateTime={it.dateTime} title={it.timeTitle} className="mt-1 block font-grotesk text-[13px] tabular-nums text-body">
                  {it.time}
                </time>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  const horizontal = layout === "horizontal";
  const Title = headingLevel ? (`h${headingLevel}` as "h3" | "h4") : "p";
  return (
    <ol className={cn("grid gap-7", horizontal && "lg:flex lg:gap-6", className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li key={it.id ?? i} className={cn("relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-4", horizontal && "lg:flex lg:flex-1 lg:flex-col lg:gap-4")}>
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[17px] top-11 -bottom-5 w-[2px] rounded-full bg-line",
                  horizontal && "lg:bottom-auto lg:left-12 lg:right-[-12px] lg:top-[17px] lg:h-[2px] lg:w-auto",
                )}
              />
            ) : null}
            <PopInView delay={i * 120}>
              <span aria-hidden className="relative grid size-9 place-items-center rounded-full bg-forest font-display text-[15px] leading-none text-white">
                {it.icon ? renderIcon(it.icon, "size-[18px]") : String(start + i).padStart(2, "0")}
              </span>
            </PopInView>
            <div className="min-w-0 pt-1.5">
              <Title className="text-[17px] font-bold leading-snug text-ink">
                <span className="sr-only">Step {start + i}: </span>
                {it.title}
              </Title>
              {it.body ? <div className="mt-1.5 text-[15px] leading-relaxed text-body">{it.body}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
