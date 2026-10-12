"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IDLE_LOCK_MS } from "@/lib/model/session";

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
const CHECK_EVERY_MS = 30_000;

/**
 * The 30-minute idle lock (PLAN D86): after half an hour without a tap, key or scroll, the shell
 * moves to /admin/locked?next=<here>. The desk stays mounted underneath (a client navigation), so
 * unlocking returns to the same screen with nothing lost. Time away in another tab counts too.
 */
export function IdleLock() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    let locked = false;
    const mark = () => {
      last = Date.now();
    };
    const check = () => {
      if (locked || Date.now() - last < IDLE_LOCK_MS) return;
      locked = true;
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/admin/locked?next=${encodeURIComponent(here)}`);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    for (const e of EVENTS) window.addEventListener(e, mark, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, mark, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
