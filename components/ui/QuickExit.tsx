"use client";

import { useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

/** Where QuickExit sends people: a neutral page that leaves nothing about Haven on screen (D95). */
const QUICK_EXIT_URL = "https://www.google.com/search?q=weather";

/** Clears this tab's form state, then replaces the page (Back will not return here). */
export function quickExit() {
  try {
    window.sessionStorage.clear();
  } catch {
    /* storage can be blocked; leaving matters more */
  }
  window.location.replace(QUICK_EXIT_URL);
}

const PRESSES = 3;
const WINDOW_MS = 2000;

export type QuickExitProps = {
  label?: string;
  className?: string;
};

/**
 * "Leave this site" (D95): a fixed night pill bottom-left on desktop (ScrollTop owns bottom-right), a
 * full-width 48px bar on phones. Click, or press Shift three times, clears sessionStorage and
 * replaces the page with a neutral search. Rendered on /report-a-concern, /get-support/** and the
 * counselling request pages. No Esc trigger, so closing dialogs never ejects anyone.
 */
export function QuickExit({ label = "Leave this site", className }: QuickExitProps) {
  const presses = useRef<number[]>([]);
  const otherKey = useRef(false);

  useEffect(() => {
    document.body.setAttribute("data-quick-exit", "");
    // Count a Shift only when it is pressed and released on its own (typing capitals never triggers it).
    const down = (e: KeyboardEvent) => {
      if (e.key !== "Shift") otherKey.current = true;
      else if (!e.repeat) otherKey.current = false;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== "Shift" || otherKey.current) return;
      const now = performance.now();
      presses.current = [...presses.current.filter((t) => now - t < WINDOW_MS), now];
      if (presses.current.length >= PRESSES) {
        presses.current = [];
        quickExit();
      }
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      document.body.removeAttribute("data-quick-exit");
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed z-[60] focus-marigold",
        "inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom)] max-md:bg-night md:inset-x-auto md:bottom-6 md:left-6 md:pb-0",
        className,
      )}
    >
      <button
        type="button"
        onClick={quickExit}
        aria-describedby="quick-exit-hint"
        className="group flex h-12 w-full items-center justify-center gap-2.5 bg-night px-5 text-[15px] font-bold text-white shadow-float transition-colors duration-300 hover:bg-deep md:w-auto md:rounded-full"
      >
        <LogOut aria-hidden className="size-[18px] text-marigold" strokeWidth={2.5} />
        <span className="underline decoration-marigold decoration-2 underline-offset-[6px]">{label}</span>
      </button>
      <span id="quick-exit-hint" className="sr-only">
        Leaves this website straight away and opens a weather search. You can also press the Shift key three times.
      </span>
    </div>
  );
}
