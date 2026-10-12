"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A tiny leaf that reads the path (D4: path hooks only in Suspense-wrapped leaves) and tells its
 * parent when the route changes, so the mobile menu and search overlay close on every navigation,
 * including back and forward (public-pages §5.3). Render it inside `<Suspense fallback={null}>`.
 * It never fires on mount, and Activity re-showing a hidden route does not count as a navigation.
 */
export function MobileMenuCloser({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const last = useRef(pathname);
  const notify = useEffectEvent(onNavigate);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    notify();
  }, [pathname]);

  return null;
}
