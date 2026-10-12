import Link from "next/link";
import { StatCard, type StatTone } from "@/components/ui/cards/StatCard";
import { cn } from "@/lib/cn";

export type KpiTileProps = {
  /** Uppercase Inter 12 label ("GIFTS", "REQUESTS"). */
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  /** One short line under the number ("handled this month"). */
  note?: string;
  tone: StatTone;
  /** Makes the whole tile a link to the filtered list. */
  href?: string;
  /** Count up once (Today's snapshot; never under reduced motion, D125). Default off. */
  countUp?: boolean;
  className?: string;
};

/**
 * An admin KPI tile (admin-ux §9.2; PLAN D120): the kit's `StatCard size="sm"` on an earth tone,
 * optionally a link with the lift-on-hover of clickable admin cards.
 */
export function KpiTile({ label, value, prefix, suffix, note, tone, href, countUp = false, className }: KpiTileProps) {
  const card = <StatCard label={label} value={value} prefix={prefix} suffix={suffix} note={note} tone={tone} size="sm" countUp={countUp} as="div" className={cn(!href && className)} />;
  if (!href) return card;
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-control transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:-translate-y-0.5",
        className,
      )}
    >
      {card}
    </Link>
  );
}
