"use client";

import { useEffect, useEffectEvent } from "react";
import { usePathname } from "next/navigation";
import { isActive, type NavItem } from "@/lib/nav";

/**
 * Works out which top-level nav item the current route belongs to (public-pages §5.1–5.2,
 * design-system §4.2) and reports its `href` (or null) plus the pathname to the Header, which marks
 * that item with `aria-current="page"` and the persistent marigold underline, and marks the exact
 * row inside dropdowns and the mobile menu. Reading `usePathname()` here, in a leaf the Header wraps
 * in `<Suspense fallback={null}>`, keeps the rest of the Header in the static shell (D4). `items` come
 * from `getSiteChrome().nav` (prefix lists, never functions, D24).
 */
export function ActiveNavMarker({
  items,
  onChange,
}: {
  items: ReadonlyArray<NavItem>;
  onChange: (href: string | null, pathname: string) => void;
}) {
  const pathname = usePathname();
  const report = useEffectEvent(onChange);
  const active = items.find((item) => isActive(item, pathname))?.href ?? null;

  useEffect(() => {
    report(active, pathname);
  }, [active, pathname]);

  return null;
}
