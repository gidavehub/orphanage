"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const fmt = new Intl.NumberFormat("en");

/**
 * Live "120 / 500" counter for the control with `controlId` (Field's `counter`). It listens to the
 * control's input events, so the control itself needs no wiring. Past `max` it turns coral-800 and
 * says how many characters to remove; the sr-only text only changes at that threshold.
 */
export function FieldCounter({ controlId, id, max, initial = 0 }: { controlId: string; id: string; max: number; initial?: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    const el = document.getElementById(controlId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    const sync = () => setCount(el.value.length);
    sync();
    el.addEventListener("input", sync);
    // Form resets (after a successful send) clear the value without an input event.
    const form = el.form;
    const onReset = () => setTimeout(sync, 0);
    form?.addEventListener("reset", onReset);
    return () => {
      el.removeEventListener("input", sync);
      form?.removeEventListener("reset", onReset);
    };
  }, [controlId]);

  const over = count > max;
  return (
    <p id={id} className={cn("ml-auto shrink-0 font-grotesk text-[12px] tabular-nums", over ? "font-semibold text-coral-800" : "text-body")}>
      <span aria-hidden>
        {fmt.format(count)} / {fmt.format(max)}
      </span>
      <span className="sr-only">{over ? `${fmt.format(count - max)} characters too many` : `Up to ${fmt.format(max)} characters`}</span>
    </p>
  );
}
