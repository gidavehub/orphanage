import { Check, MessageCircleHeart } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The "In plain words" box at the top of a policy (public-pages §3.21): the policy's summary bullets
 * on cream, with a marigold rule, so anyone can get the gist before the full text.
 */
export function PlainWords({ points, className }: { points: readonly string[]; className?: string }) {
  if (!points.length) return null;
  return (
    <section aria-labelledby="plain-words-title" className={cn("rounded-card bg-cream p-6 md:p-8", className)}>
      <h2 id="plain-words-title" className="flex items-center gap-2.5 text-[20px] font-extrabold leading-tight text-ink">
        <MessageCircleHeart aria-hidden className="size-6 text-marigold-ink" strokeWidth={2.25} />
        In plain words
      </h2>
      <span aria-hidden className="mt-3 block h-[2px] w-12 bg-marigold" />
      <ul className="mt-5 grid gap-3.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[16px] leading-relaxed text-ink">
            <span aria-hidden className="mt-[3px] grid size-[22px] shrink-0 place-items-center rounded-full bg-forest text-white">
              <Check className="size-3" strokeWidth={3.5} />
            </span>
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}
