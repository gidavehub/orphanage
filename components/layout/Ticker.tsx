"use client";

import { useEffect, useState } from "react";
import { HAND_PATH, HEART_PATH } from "@/components/art/Hands";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { cn } from "@/lib/cn";

/** Small multicolour hand-and-heart glyph used beside the ticker (Donat detail). */
export function HandHeartGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="-70 -130 140 140" className={className} aria-hidden>
      <path d={HAND_PATH} transform="rotate(-18) scale(0.95)" fill="var(--color-marigold)" />
      <path d={HEART_PATH} transform="translate(8 -52) scale(1.6)" fill="var(--color-flame)" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/** Rotating one-line messages that slide up inside the nav pill (only the visible one is exposed to screen readers). */
export function Ticker({ messages, className }: { messages: readonly string[]; className?: string }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((n) => (n + 1) % messages.length), 4200);
    return () => clearInterval(id);
  }, [messages.length, reduce]);

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5 text-[15px] font-semibold text-white", className)} aria-live="off">
      <HandHeartGlyph className="size-[22px] shrink-0 animate-wobble" />
      <div className="relative h-[22px] min-w-0 flex-1 overflow-hidden">
        {messages.map((m, n) => (
          <p
            key={m}
            aria-hidden={n === i ? undefined : true}
            className={cn(
              "absolute inset-x-0 top-0 truncate leading-[22px] transition-all duration-700 ease-out-expo",
              n === i ? "translate-y-0 opacity-100" : n === (i - 1 + messages.length) % messages.length ? "-translate-y-full opacity-0" : "translate-y-full opacity-0",
            )}
          >
            {m}
          </p>
        ))}
      </div>
    </div>
  );
}
