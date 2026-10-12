import Link from "next/link";
import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { UrgencyPill } from "@/components/ui/StatusPill";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import type { StaffRef, Urgency } from "@/lib/model/dto";
import type { RecordKind } from "@/lib/model/refs";
import { KIND_TINT } from "@/lib/model/status-meta";
import { cn } from "@/lib/cn";

export type ListRowProps = {
  /** Where the row opens (the record, or the split view's detail route). */
  href: string;
  /** Colours the 4px bar at the row's left edge (admin-ux §10.3). */
  kind?: RecordKind;
  title: string;
  /** The case reference, in Inter tabular figures. */
  reference?: string;
  /** "Fatou C. · 2 hours ago". */
  meta?: React.ReactNode;
  /** One line, at most 90 characters. Concerns never pass one (Details are restricted). */
  preview?: string;
  /** A StatusPill (or RiskPill). */
  status?: React.ReactNode;
  urgency?: Urgency;
  assignee?: StaffRef | null;
  /** ISO country code for a round flag. */
  country?: string | null;
  /** Bold title and a marigold dot until the viewer opens it. */
  unread?: boolean;
  /** Concern rows: a lock, no preview. */
  restricted?: boolean;
  /** The row's single next-step button ("Take it", "Say thank you"), outside the link. */
  action?: React.ReactNode;
  /** Highlighted as the record open beside the list. */
  selected?: boolean;
  as?: "li" | "div";
  className?: string;
};

/**
 * One row in every admin list (admin-ux §1 rule 7, §9.2): 56px minimum, a kind bar, title and
 * reference, who and when, stage, urgency, who is looking after it, and one next-step button. The
 * row link and the button are siblings (never nested), so both are reachable by keyboard.
 */
export function ListRow({
  href,
  kind,
  title,
  reference,
  meta,
  preview,
  status,
  urgency,
  assignee,
  country,
  unread,
  restricted,
  action,
  selected,
  as: As = "li",
  className,
}: ListRowProps) {
  return (
    <As
      className={cn(
        "relative flex min-h-14 items-center gap-3 border-b border-line bg-white pl-4 pr-3 transition-colors last:border-b-0 hover:bg-cream-2",
        selected && "bg-mint/60 hover:bg-mint/60",
        className,
      )}
    >
      {kind ? <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: `var(--color-${KIND_TINT[kind]})` }} /> : null}
      <Link href={href} aria-current={selected ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 focus-visible:outline-offset-[-3px]">
        {unread ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-marigold" /> : <span aria-hidden className="size-2 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {reference ? <span className="font-grotesk text-[13px] font-semibold tabular-nums text-umber">{reference}</span> : null}
            <span className={cn("truncate text-[15px] leading-snug text-ink", unread ? "font-extrabold" : "font-bold")}>{title}</span>
            {restricted ? <Lock aria-label="Restricted" className="size-3.5 shrink-0 text-deep" strokeWidth={2.75} /> : null}
            {unread ? <span className="sr-only">(new)</span> : null}
          </span>
          {meta || preview || country ? (
            <span className="mt-0.5 flex min-w-0 items-center gap-2 font-grotesk text-[13px] text-body">
              {country && hasFlag(country) ? <FlagDisc code={country} className="size-4 shrink-0" /> : null}
              {meta ? <span className="shrink-0">{meta}</span> : null}
              {preview && !restricted ? <span className="truncate">“{preview}”</span> : null}
              {restricted ? <span className="truncate">Details are restricted</span> : null}
            </span>
          ) : null}
        </span>
      </Link>
      <span className="hidden shrink-0 items-center gap-2 sm:flex">
        {urgency ? <UrgencyPill urgency={urgency} size="sm" /> : null}
        {status}
      </span>
      {assignee ? <Avatar name={assignee.name} uid={assignee.uid} tone={assignee.tone} size={28} decorative={false} className="hidden md:inline-grid" /> : null}
      {action ? <span className="shrink-0">{action}</span> : null}
    </As>
  );
}
