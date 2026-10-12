import { AlertTriangle, ArrowUpRight, Check, Clock, Lock, Sparkles, X } from "lucide-react";
import { riskMeta, statusMeta, URGENCY_META, type StatusIcon, type StatusTone } from "@/lib/model/status-meta";
import type { Urgency } from "@/lib/model/dto";
import type { RiskLevel, StatusOf, Workflow } from "@/lib/model/status";
import { cn } from "@/lib/cn";

/** Pill looks: the status tones plus the risk-only `high`. */
export type PillTone = StatusTone | "high";

// Background / text pairs all pass AA (design-system §3.4 table).
const toneClass: Record<PillTone, string> = {
  new: "bg-marigold-100 text-umber",
  review: "bg-sand text-cocoa",
  waiting: "bg-clay-100 text-clay-700",
  active: "bg-mint text-forest-700",
  referred: "bg-white text-forest-700 ring-1 ring-inset ring-forest/40",
  approved: "bg-white text-forest-700 ring-1 ring-inset ring-forest/40",
  done: "bg-forest text-white",
  declined: "bg-coral-100 text-coral-800",
  closed: "bg-pebble text-body",
  urgent: "bg-coral-800 text-white",
  restricted: "bg-night text-marigold",
  high: "bg-coral-100 text-coral-800",
};

const dotClass: Record<PillTone, string> = {
  new: "bg-marigold",
  review: "bg-cocoa",
  waiting: "bg-clay-700",
  active: "bg-forest",
  referred: "bg-forest",
  approved: "bg-forest",
  done: "bg-white",
  declined: "bg-coral-800",
  closed: "bg-body",
  urgent: "bg-white",
  restricted: "bg-marigold",
  high: "bg-coral-800",
};

function Marker({ icon, tone }: { icon?: StatusIcon; tone: PillTone }) {
  const glyph = "size-3 shrink-0";
  switch (icon) {
    case "dot":
      return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotClass[tone])} />;
    case "pulse":
      return (
        <span aria-hidden className="relative grid size-2 shrink-0 place-items-center">
          <span className={cn("absolute inset-0 animate-pulse-ring rounded-full", dotClass[tone])} />
          <span className={cn("relative size-2 rounded-full", dotClass[tone])} />
        </span>
      );
    case "clock":
      return <Clock aria-hidden className={glyph} strokeWidth={2.5} />;
    case "arrow":
      return <ArrowUpRight aria-hidden className={glyph} strokeWidth={2.75} />;
    case "check":
      return <Check aria-hidden className={glyph} strokeWidth={3} />;
    case "x":
      return <X aria-hidden className={glyph} strokeWidth={3} />;
    case "lock":
      return <Lock aria-hidden className={glyph} strokeWidth={2.5} />;
    case "sparkles":
      return <Sparkles aria-hidden className={glyph} strokeWidth={2.25} />;
    case "alert":
      return <AlertTriangle aria-hidden className={glyph} strokeWidth={2.5} />;
    default:
      return null;
  }
}

export type TonePillProps = {
  tone: PillTone;
  label: string;
  icon?: StatusIcon;
  size?: "sm" | "md";
  className?: string;
};

/** The pill itself. Colour is never the only signal: the words always show, plus a marker. */
export function TonePill({ tone, label, icon, size = "md", className }: TonePillProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-grotesk font-semibold leading-none",
        size === "md" ? "h-7 px-3 text-[12.5px]" : "h-6 px-2.5 text-[12px]",
        toneClass[tone],
        className,
      )}
    >
      <Marker icon={icon} tone={tone} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export type StatusPillProps<W extends Workflow> = {
  workflow: W;
  status: StatusOf<W>;
  size?: "sm" | "md";
  className?: string;
};

/** A record's stage, label and tone from lib/model/status-meta.ts (PLAN D20). */
export function StatusPill<W extends Workflow>({ workflow, status, size, className }: StatusPillProps<W>) {
  const m = statusMeta(workflow, status);
  return <TonePill tone={m.tone} label={m.label} icon={m.icon} size={size} className={className} />;
}

/** A concern's risk level, always worded "Risk: …"; `null` reads "Not yet assessed" (D76). */
export function RiskPill({ level, size, className }: { level: RiskLevel | null | undefined; size?: "sm" | "md"; className?: string }) {
  const m = riskMeta(level);
  return <TonePill tone={m.tone} label={`Risk: ${m.label}`} icon={m.icon} size={size} className={className} />;
}

/** Derived urgency on Inbox rows and Today (D83). `normal` renders nothing. */
export function UrgencyPill({ urgency, size, className }: { urgency: Urgency; size?: "sm" | "md"; className?: string }) {
  if (urgency === "normal") return null;
  const m = URGENCY_META[urgency];
  const icon: StatusIcon = urgency === "immediate" ? "pulse" : urgency === "urgent" ? "alert" : "clock";
  return <TonePill tone={m.tone} label={m.label} icon={icon} size={size} className={className} />;
}
