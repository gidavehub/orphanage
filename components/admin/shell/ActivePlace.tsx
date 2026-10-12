"use client";

import { useEffect, useEffectEvent } from "react";
import { usePathname } from "next/navigation";
import type { Area, Place } from "@/lib/admin/access";

/** The place a desk URL belongs to: the longest matching place href ("/admin" only matches itself). */
export function areaOfPath(pathname: string, places: readonly Place[]): Area | null {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/admin";
  let best: Place | null = null;
  for (const p of places) {
    const hit = p.href === "/admin" ? path === "/admin" : path === p.href || path.startsWith(`${p.href}/`);
    if (hit && (!best || p.href.length > best.href.length)) best = p;
  }
  return best?.area ?? null;
}

/**
 * Reports which place the current route belongs to, so the pill, dock and phone title can mark it
 * (aria-current and the marigold underline or dot). The shell renders this tiny leaf inside
 * `<Suspense fallback={null}>`: path hooks never sit in the shell itself (PLAN D4).
 */
export function ActivePlace({ places, onChange }: { places: readonly Place[]; onChange: (area: Area | null) => void }) {
  const pathname = usePathname();
  const area = areaOfPath(pathname, places);
  const report = useEffectEvent(onChange);
  useEffect(() => {
    report(area);
  }, [area]);
  return null;
}
