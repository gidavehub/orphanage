import { renderDiscIcon, type DiscIcon } from "./icon";
import { cn } from "@/lib/cn";

export type IconDiscProps = {
  /** A programme id (duotone ProgrammeIcon), a lucide component or an element. */
  icon: DiscIcon;
  size?: 44 | 52 | 64 | 96;
  /** The mega-menu halo: a 5px ring in marigold-100 (default) or mint. */
  halo?: "marigold" | "mint" | "none";
  /** `urgent` is the child-protection disc: coral-800 icon on coral-100 (design-system §4.2). */
  tone?: "white" | "urgent" | "deep";
  className?: string;
};

const sizes = {
  44: { disc: "size-11", icon: "size-[22px]", programme: "size-[26px]" },
  52: { disc: "size-[52px]", icon: "size-6", programme: "size-[30px]" },
  64: { disc: "size-16", icon: "size-7", programme: "size-[38px]" },
  96: { disc: "size-24", icon: "size-10", programme: "size-[54px]" },
} as const;

const halos = {
  marigold: "shadow-[0_0_0_5px_var(--color-marigold-100)]",
  mint: "shadow-[0_0_0_5px_var(--color-mint)]",
  none: "",
} as const;

const tones = {
  white: "bg-white text-forest",
  urgent: "bg-coral-100 text-coral-800",
  deep: "bg-deep text-marigold",
} as const;

/**
 * The white disc with a soft halo from the programmes mega menu (design-system §3.2). It carries
 * the `group` hover animations of programme icons when an ancestor has `group`.
 * Used in service cards, RadioCards, mega panels and admin task cards. Always decorative.
 */
export function IconDisc({ icon, size = 52, halo = "marigold", tone = "white", className }: IconDiscProps) {
  const s = sizes[size];
  const isProgramme = typeof icon === "string";
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center rounded-full", s.disc, tones[tone], halos[halo], className)}>
      {renderDiscIcon(icon, isProgramme ? s.programme : s.icon)}
    </span>
  );
}
