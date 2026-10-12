import { staffInitials, staffTone, type StaffTone } from "@/lib/model/dto";
import { cn } from "@/lib/cn";

export type AvatarProps = {
  /** Staff only, never beneficiaries (design-system §3.6). */
  name: string;
  /** Stable key for the colour (uid). Falls back to the name. */
  uid?: string;
  /** A precomputed tone (StaffRef.tone) wins over the hash. */
  tone?: StaffTone;
  size?: 28 | 36 | 44;
  /** Adds the 2px white ring used in stacks. */
  ring?: boolean;
  /** Decorative when the name is printed beside it (default). Pass false to announce the name. */
  decorative?: boolean;
  className?: string;
};

// White on forest/clay/cocoa/umber/deep and night on marigold all pass AA.
const toneClass: Record<StaffTone, string> = {
  forest: "bg-forest text-white",
  clay: "bg-clay text-white",
  cocoa: "bg-cocoa text-white",
  umber: "bg-umber text-white",
  deep: "bg-deep text-white",
  marigold: "bg-marigold text-night",
};

const sizeClass = {
  28: "size-7 text-[11px]",
  36: "size-9 text-[13px]",
  44: "size-11 text-[15px]",
} as const;

/** Initials on an earth tone chosen from a hash of the uid (D91: initials and tone are derived). */
export function Avatar({ name, uid, tone, size = 36, ring, decorative = true, className }: AvatarProps) {
  const t = tone ?? staffTone(uid ?? name);
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      title={name}
      className={cn(
        "inline-grid shrink-0 select-none place-items-center rounded-full font-sans font-extrabold leading-none",
        sizeClass[size],
        toneClass[t],
        ring && "ring-2 ring-white",
        className,
      )}
    >
      {staffInitials(name)}
    </span>
  );
}
