"use client";

import { useEffect } from "react";

/** Present in this tab's sessionStorage while a sensitive form is open. It holds no form content. */
const GUARD_KEY = "hv.leave-guard";

/**
 * Warns before the tab is closed or reloaded while a sensitive form has unsent answers (public-pages
 * §2.4, PLAN D95: no drafts on the support and concern forms, a `beforeunload` guard instead).
 *
 * QuickExit must never be held up by this prompt. It clears sessionStorage before it leaves, which
 * removes the marker this hook keeps there, so a missing marker means "leaving on purpose" and no
 * prompt is shown. Where sessionStorage is blocked the guard stays off rather than risk trapping
 * someone who needs to leave quickly.
 */
export function useLeaveGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    try {
      window.sessionStorage.setItem(GUARD_KEY, "1");
    } catch {
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      let marked = false;
      try {
        marked = window.sessionStorage.getItem(GUARD_KEY) === "1";
      } catch {
        marked = false;
      }
      if (!marked) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      try {
        window.sessionStorage.removeItem(GUARD_KEY);
      } catch {
        /* storage blocked: nothing to remove */
      }
    };
  }, [active]);
}
