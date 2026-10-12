"use client";

import { RotateCcw } from "lucide-react";
import { useDonateContext } from "./DonateStateProvider";

/** `?cancelled=1` (Stripe's cancel_url): a calm sand banner above the give hero (public-pages §4.3). */
export function CancelledNotice({ text }: { text: string }) {
  const ctx = useDonateContext();
  if (!ctx?.state.cancelled) return null;
  return (
    <p role="status" className="mt-6 flex items-start gap-3 rounded-2xl bg-sand px-5 py-4 text-[15px] font-semibold leading-snug text-umber">
      <RotateCcw aria-hidden className="mt-0.5 size-5 shrink-0" />
      {text}
    </p>
  );
}
