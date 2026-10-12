import { FLAG_SPRITE, spriteCountries } from "@/content/world";
import { cn } from "@/lib/cn";

const index = new Map(spriteCountries.map((c, i) => [c.code, i]));
const rows = Math.ceil(spriteCountries.length / FLAG_SPRITE.cols);

/** Round country flag cut from the baked sprite (scripts/art/flags-sprite.mjs). Decorative unless labelled. */
export function Flag({ code, label, className }: { code: string; label?: string; className?: string }) {
  const i = index.get(code) ?? 0;
  const { cols, src } = FLAG_SPRITE;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 rounded-full bg-sand bg-no-repeat", className)}
      style={{
        backgroundImage: `url(${src})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${((i % cols) / (cols - 1)) * 100}% ${(Math.floor(i / cols) / (rows - 1)) * 100}%`,
      }}
    />
  );
}
