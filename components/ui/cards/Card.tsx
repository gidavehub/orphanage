import Link from "next/link";
import { cn } from "@/lib/cn";

export type CardProps = {
  as?: "article" | "div" | "li";
  tone?: "white" | "cream" | "paper" | "mint" | "sand";
  pad?: "none" | "sm" | "md" | "lg";
  radius?: "tile" | "control" | "card" | "card-lg";
  shadow?: "none" | "soft" | "card";
  /** Hover lift (−6px) and a deeper shadow over 500ms; also makes the card a `group`. */
  interactive?: boolean;
  /**
   * Makes the whole card one link: an invisible stretched link sits over it, named by `linkLabel`.
   * Do not put other links inside such a card; use CardLink on the title instead when it has one.
   */
  href?: string;
  linkLabel?: string;
  id?: string;
  className?: string;
  children: React.ReactNode;
};

const tones = { white: "bg-white", cream: "bg-cream", paper: "paper", mint: "bg-mint", sand: "bg-sand" } as const;
const pads = { none: "", sm: "p-5", md: "p-6 md:p-7", lg: "p-8 md:p-10" } as const;
const radii = { tile: "rounded-tile", control: "rounded-control", card: "rounded-card", "card-lg": "rounded-card-lg" } as const;
const shadows = { none: "", soft: "shadow-soft", card: "shadow-card" } as const;

/** The base surface of the card family (design-system §3.7). */
export function Card({
  as: As = "div",
  tone = "white",
  pad = "md",
  radius = "card",
  shadow = "card",
  interactive,
  href,
  linkLabel,
  id,
  className,
  children,
}: CardProps) {
  return (
    <As
      id={id}
      className={cn(
        "relative",
        tones[tone],
        pads[pad],
        radii[radius],
        shadows[shadow],
        (interactive || href) && "group transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1.5 hover:shadow-card-hover",
        href && CARD_FOCUS_RING,
        className,
      )}
    >
      {children}
      {href ? (
        <Link href={href} data-card-link aria-label={linkLabel} className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-none" />
      ) : null}
    </As>
  );
}

/**
 * A card title link stretched over its whole card (`after:absolute after:inset-0`), so the card is one
 * link without nesting. The card needs `relative`; the focus ring is drawn around the card.
 */
export function CardLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} data-card-link className={cn("after:absolute after:inset-0 after:z-[1] after:rounded-[inherit] focus-visible:outline-none", className)}>
      {children}
    </Link>
  );
}

/** Ring around a card when its stretched CardLink has keyboard focus. Add to the card's className. */
export const CARD_FOCUS_RING =
  "has-[a[data-card-link]:focus-visible]:outline has-[a[data-card-link]:focus-visible]:outline-[3px] has-[a[data-card-link]:focus-visible]:outline-offset-[3px] has-[a[data-card-link]:focus-visible]:outline-[color:var(--focus,var(--color-forest))]";
