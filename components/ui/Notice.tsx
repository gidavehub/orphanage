import { AlertTriangle, CheckCircle2, Info, ShieldAlert, XCircle } from "lucide-react";
import { renderIcon, type IconLike } from "./icon";
import { cn } from "@/lib/cn";

export type NoticeTone = "emergency" | "info" | "success" | "warning" | "danger" | "disclaimer";

export type NoticeProps = {
  tone: NoticeTone;
  title?: string;
  /** Body. The emergency tone falls back to the standard emergency sentence. */
  children?: React.ReactNode;
  /** Override the tone's icon; `false` hides it. */
  icon?: IconLike | false;
  /** One Button or link under the body. */
  action?: React.ReactNode;
  /** The notice appeared because of something the person did: announce it (role="status"). */
  live?: boolean;
  /** Tighter padding and 14px text (FormShell aside, NotFoundBody, admin). */
  compact?: boolean;
  /** Heading level for the title (default: a paragraph, so it never breaks the page outline). */
  titleAs?: "p" | "h2" | "h3";
  id?: string;
  className?: string;
};

/** Default emergency copy when the page passes none (site settings normally supply it). */
const EMERGENCY_TITLE = "If a child is in immediate danger";
export const EMERGENCY_BODY =
  "Contact the appropriate emergency, law-enforcement or child-protection authority immediately. Do not wait for a response from this website.";

// Every pairing passes AA (design-system §3.4, §6.1).
const tones: Record<NoticeTone, { box: string; icon: string; title: string; body: string; glyph: IconLike }> = {
  emergency: { box: "bg-deep text-white rounded-card focus-marigold", icon: "text-marigold", title: "text-white", body: "text-white/85", glyph: ShieldAlert },
  info: { box: "bg-cream border-l-4 border-marigold rounded-2xl", icon: "text-marigold-ink", title: "text-ink", body: "text-ink/85", glyph: Info },
  success: { box: "bg-mint rounded-2xl", icon: "text-forest-700", title: "text-forest-700", body: "text-forest-700", glyph: CheckCircle2 },
  warning: { box: "bg-clay-100 rounded-2xl", icon: "text-clay-700", title: "text-ink", body: "text-ink", glyph: AlertTriangle },
  danger: { box: "bg-coral-100 rounded-2xl", icon: "text-coral-800", title: "text-coral-800", body: "text-ink", glyph: XCircle },
  disclaimer: { box: "bg-paper rounded-2xl", icon: "text-forest", title: "text-forest", body: "font-semibold italic text-forest", glyph: Info },
};

/**
 * Safeguarding, disclaimer and status callouts (design-system §3.4, PLAN D123). The emergency tone is
 * never dismissible. `role="note"` by default; `live` notices use `role="status"`.
 */
export function Notice({ tone, title, children, icon, action, live, compact, titleAs: TitleTag = "p", id, className }: NoticeProps) {
  const t = tones[tone];
  const emergency = tone === "emergency";
  const heading = title ?? (emergency ? EMERGENCY_TITLE : undefined);
  const body = children ?? (emergency ? EMERGENCY_BODY : undefined);
  const glyph = icon === false ? null : renderIcon(icon ?? t.glyph, cn("mt-0.5 shrink-0", compact ? "size-[18px]" : "size-5", t.icon), 2.25);

  return (
    <div
      id={id}
      role={live ? "status" : "note"}
      className={cn("flex items-start gap-3", compact ? "px-4 py-3.5 text-[14px]" : "px-5 py-4 text-[15px] md:p-5", t.box, className)}
    >
      {glyph}
      <div className="min-w-0 flex-1 leading-relaxed">
        {heading ? <TitleTag className={cn("font-extrabold leading-snug", compact ? "text-[15px]" : "text-[16px]", t.title)}>{heading}</TitleTag> : null}
        {body ? <div className={cn(heading && "mt-1", t.body)}>{body}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
