import Link from "next/link";
import { ArrowUpRight, ArrowRight, Download, Heart, Play, Plus, Send } from "lucide-react";
import { Spinner } from "./Spinner";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "forest"
  | "marigold"
  | "flame"
  | "clay"
  | "outline"
  | "outline-light"
  | "white"
  | "vu"
  | "vu-outline"
  | "vu-white"
  /* Accessible additions (design-system §2.1); they do not change the variants above. */
  | "marigold-ink"
  | "coral-ink"
  | "flame-ink"
  | "white-ink"
  | "danger"
  /* Quiet admin actions (admin-ux §9.2, merged per D120). */
  | "quiet"
  | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonIcon = "arrow" | "arrow-right" | "heart" | "play" | "send" | "download" | "plus" | "none";

const variants: Record<ButtonVariant, string> = {
  forest: "bg-forest text-white hover:bg-marigold hover:text-night",
  marigold: "bg-marigold text-white hover:bg-forest",
  flame: "bg-flame text-white hover:bg-forest",
  clay: "bg-clay text-white hover:bg-umber",
  outline: "border border-ink/80 text-ink hover:bg-forest hover:border-forest hover:text-white",
  "outline-light": "border border-white/70 text-white hover:bg-white hover:text-night",
  white: "bg-white text-ink hover:bg-marigold hover:text-white",
  vu: "font-grotesk uppercase tracking-[0.02em] font-medium bg-coral text-white hover:bg-night",
  "vu-outline":
    "font-grotesk uppercase tracking-[0.02em] font-medium border border-ink/80 text-ink hover:bg-ink hover:text-white",
  "vu-white":
    "font-grotesk uppercase tracking-[0.02em] font-medium bg-white text-ink hover:bg-night hover:text-white",
  // Night text on marigold (9.80:1). Every new functional marigold CTA uses this, never `marigold`.
  "marigold-ink": "bg-marigold text-night hover:bg-forest hover:text-white",
  // White on coral-800 (5.42:1): VU-chapter submit buttons that must pass AA.
  "coral-ink": "font-grotesk uppercase tracking-[0.02em] font-medium bg-coral-800 text-white hover:bg-night",
  // The Donat-voice twin of `flame` that passes AA (white on coral-800, 5.42:1).
  "flame-ink": "bg-coral-800 text-white hover:bg-forest",
  // `white` whose marigold hover keeps night text (on forest blocks).
  "white-ink": "bg-white text-ink hover:bg-marigold hover:text-night",
  // Destructive, only inside a confirm: coral-800 outline that fills on hover.
  danger: "border-[1.5px] border-coral-800 bg-white text-coral-800 hover:bg-coral-800 hover:text-white",
  quiet: "border border-line bg-white text-ink hover:border-ink/40 hover:bg-cream",
  ghost: "text-ink hover:bg-ink/[0.06]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-11 px-7 text-[14px] gap-2",
  md: "h-[52px] px-9 text-[15px] gap-2.5",
  lg: "h-[58px] px-10 text-[15px] gap-2.5",
};

/** The class list of a Button, for elements that must look like one (e.g. a card's visual-only CTA). */
export function buttonClassName({
  variant = "forest",
  size = "md",
  block,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}) {
  return cn(
    "group/btn relative inline-flex items-center justify-center whitespace-nowrap rounded-full font-bold",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-out",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
    variants[variant],
    sizes[size],
    block && "w-full",
    className,
  );
}

/** The trailing (or leading) glyph of a Button. */
export function ButtonGlyph({ icon }: { icon: ButtonIcon }) {
  const common = "size-[15px] shrink-0";
  switch (icon) {
    case "arrow":
      return (
        <span className="relative inline-flex size-[15px] overflow-hidden" aria-hidden>
          <ArrowUpRight
            strokeWidth={3}
            className={cn(common, "transition-transform duration-500 ease-out-expo group-hover/btn:translate-x-full group-hover/btn:-translate-y-full")}
          />
          <ArrowUpRight
            strokeWidth={3}
            className={cn(common, "absolute inset-0 -translate-x-full translate-y-full transition-transform duration-500 ease-out-expo group-hover/btn:translate-x-0 group-hover/btn:translate-y-0")}
          />
        </span>
      );
    case "arrow-right":
      return (
        <ArrowRight
          strokeWidth={2.5}
          aria-hidden
          className={cn(common, "transition-transform duration-300 group-hover/btn:translate-x-1")}
        />
      );
    case "heart":
      return <Heart aria-hidden fill="currentColor" strokeWidth={0} className={cn(common, "group-hover/btn:animate-heartbeat")} />;
    case "play":
      return <Play aria-hidden fill="currentColor" strokeWidth={0} className={common} />;
    case "send":
      return <Send aria-hidden fill="currentColor" strokeWidth={1.5} className={cn(common, "-rotate-12")} />;
    case "download":
      return <Download aria-hidden strokeWidth={2.5} className={cn(common, "transition-transform duration-300 group-hover/btn:translate-y-0.5")} />;
    case "plus":
      return <Plus aria-hidden strokeWidth={3} className={cn(common, "transition-transform duration-300 group-hover/btn:rotate-90")} />;
    default:
      return null;
  }
}

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ButtonIcon;
  iconFirst?: boolean;
  /** Swaps the glyph for a Spinner, sets aria-busy and disables the button (links become aria-disabled). */
  loading?: boolean;
  /** Full width. */
  block?: boolean;
  className?: string;
  children: React.ReactNode;
};

export type ButtonAsLinkProps = BaseProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">;
export type ButtonAsButtonProps = BaseProps & { href?: undefined } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
export type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps;

export function Button(props: ButtonProps) {
  const { variant = "forest", size = "md", icon = "arrow", iconFirst, loading, block, className, children, ...rest } = props;
  const cls = buttonClassName({ variant, size, block, className });
  // While loading the spinner takes the glyph's place (leading when there is no glyph), so the width barely moves.
  const glyph = loading ? <Spinner size={16} label="" className="shrink-0" /> : <ButtonGlyph icon={icon} />;
  const leading = iconFirst || (loading && icon === "none");
  const inner = (
    <>
      {leading && glyph}
      <span>{children}</span>
      {!leading && glyph}
    </>
  );

  if ("href" in rest && typeof rest.href === "string") {
    const { href, ...linkRest } = rest;
    return (
      <Link
        href={href}
        className={cls}
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
        tabIndex={loading ? -1 : undefined}
        {...linkRest}
      >
        {inner}
      </Link>
    );
  }
  const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type={buttonRest.type ?? "button"}
      className={cls}
      {...buttonRest}
      disabled={buttonRest.disabled || loading}
      aria-busy={loading || undefined}
    >
      {inner}
    </button>
  );
}
