import { spriteCountries } from "@/content/world";
import { Flag } from "@/components/art/Flag";
import { cn } from "@/lib/cn";

const SPRITE = new Set(spriteCountries.map((c) => c.code));

/** True when the flag sprite has this (lowercase ISO) country. */
export function hasFlag(code: string | null | undefined): boolean {
  return !!code && SPRITE.has(code.toLowerCase());
}

/**
 * A round flag from the sprite, or a neutral sand disc when the sprite has no such country
 * (design-system §3.3: never grow the sprite for forms). Decorative unless `label` is given.
 */
export function FlagDisc({ code, label, className }: { code: string | null | undefined; label?: string; className?: string }) {
  if (code && hasFlag(code)) return <Flag code={code.toLowerCase()} label={label} className={className} />;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 rounded-full bg-sand", className)}
    />
  );
}
