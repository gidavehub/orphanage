"use client";

import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import type { SignOutAction } from "@/components/admin/auth/SignOutButton";
import type { Area } from "@/lib/admin/access";
import { useGoChords } from "@/lib/admin/hotkeys";
import { reportNetwork } from "@/lib/admin/net";
import type { PulseDTO, ShellViewer } from "@/lib/model/dto";
import type { NotificationDTO } from "@/lib/server/dal/notifications";
import { ActivePlace } from "./ActivePlace";
import { BottomDock } from "./BottomDock";
import { IdleLock } from "./IdleLock";
import { OfflineRibbon } from "./OfflineRibbon";
import { PracticeRibbon, TestPaymentsRibbon, type PracticeRibbonProps } from "./PracticeRibbon";
import { ShellContext, type QuickAction, type ShellPanel, type ShellPlaces, type ShellState } from "./ShellContext";
import { FindDialog, PlacesSheet, QuickActionsSheet, UpdatesSheet } from "./ShellPanels";
import { SheetHost } from "./SheetHost";
import { PhoneTopLine, TopBar } from "./TopBar";

export type AdminShellProps = {
  viewer: ShellViewer;
  places: ShellPlaces;
  quickActions: QuickAction[];
  /** The sand ribbon in practice mode (practiceRibbon()), else null. */
  practice: PracticeRibbonProps | null;
  /** Stripe has a test key: "Payments in test mode" sits under the practice ribbon (design-system §5.2). */
  paymentsInTestMode?: boolean;
  /** The latest in-app updates, loaded with the shell. */
  updates: NotificationDTO[];
  signOutAction: SignOutAction;
  children: React.ReactNode;
};

const PULSE_MS = 30_000;

/**
 * The 30-second pulse (admin-ux §3.6, PLAN D83): GET /api/admin/pulse while the tab is visible and
 * once on focus. The route is A1's; until it exists (404) polling stops quietly. A 401 means the
 * session ended elsewhere, so the app reloads into the sign-in page.
 */
function usePulse(): PulseDTO | null {
  const [pulse, setPulse] = useState<PulseDTO | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let controller: AbortController | null = null;
    const poll = async () => {
      if (stopped.current || document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch("/api/admin/pulse", { credentials: "same-origin", cache: "no-store", signal: controller.signal, headers: { accept: "application/json" } });
        if (res.status === 401) {
          window.location.replace("/admin/login");
          return;
        }
        if (res.status === 404 || res.status === 405) {
          stopped.current = true;
          return;
        }
        reportNetwork(true);
        if (!res.ok) return;
        const body = (await res.json()) as PulseDTO;
        if (body && typeof body.inboxNew === "number") setPulse(body);
      } catch (err) {
        // Offline (not an abort): the ribbon says so; try again next time.
        if (!(err instanceof DOMException && err.name === "AbortError")) reportNetwork(false);
      }
    };
    void poll();
    timer = setInterval(() => void poll(), PULSE_MS);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      if (timer) clearInterval(timer);
      controller?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return pulse;
}

/**
 * The desk frame (admin-ux §3, §9.1; design-system §5.2; PLAN D2–D4, D9, D117, D125): the forest pill
 * bar from 1024px, the phone top line and dock below it, the practice ribbon, the one `<main>` of
 * the admin, toasts that clear the dock, the global sheets (`?do=`), Find, ＋ New, Places, Updates,
 * the 30-second pulse and the idle lock. No Lenis and no GSAP. Path hooks live only in the
 * Suspense-wrapped leaves (ActivePlace, SheetHost). The forest focus ring is set here (D117).
 */
export function AdminShell({ viewer, places, quickActions, practice, paymentsInTestMode, updates, signOutAction, children }: AdminShellProps) {
  const [activeArea, setActiveArea] = useState<Area | null>(null);
  const [panel, setPanel] = useState<ShellPanel | null>(null);
  const [now, setNow] = useState(0);
  const pulse = usePulse();

  const openPanel = useCallback((p: ShellPanel) => {
    if (p === "updates") setNow(Date.now());
    setPanel(p);
  }, []);
  const closePanel = useCallback(() => setPanel(null), []);

  // Ctrl/Cmd+K opens Find from anywhere (admin-ux §3.5).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPanel("find");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const router = useRouter();
  const goTo = useCallback((href: string) => router.push(href), [router]);
  const canGo = useCallback((href: string) => href === "/admin" || [...places.pill, ...places.more].some((p) => p.href === href), [places]);
  useGoChords(goTo, canGo);

  const initialUnread = updates.filter((u) => !u.read).length;
  const unreadUpdates = pulse ? pulse.updatesUnread : initialUnread;
  const allPlaces = useMemo(() => [...places.pill, ...places.more], [places]);

  const state = useMemo<ShellState>(
    () => ({ viewer, places, quickActions, activeArea, pulse, unreadUpdates, openPanel, signOutAction }),
    [viewer, places, quickActions, activeArea, pulse, unreadUpdates, openPanel, signOutAction],
  );

  return (
    <ShellContext.Provider value={state}>
      <ToastProvider>
        <div
          data-text={viewer.textSize === "large" ? "lg" : undefined}
          className="min-h-dvh focus-forest [--toast-bottom-md:calc(5.5rem+env(safe-area-inset-bottom))] [--toast-bottom:calc(5.5rem+env(safe-area-inset-bottom))] lg:[--toast-bottom-md:1.5rem]"
        >
          {/* Printing a receipt or a summary prints only the page itself. */}
          <div className="contents print:hidden">
            <TopBar />
            <PhoneTopLine />
            <OfflineRibbon />
            {practice ? <PracticeRibbon {...practice} /> : null}
            {paymentsInTestMode ? <TestPaymentsRibbon /> : null}
          </div>
          <main id="main" data-desk tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 focus:outline-none md:px-6 lg:pb-16 lg:pt-8">
            {children}
          </main>
          <div className="contents print:hidden">
            <BottomDock />
          </div>

          <FindDialog open={panel === "find"} onClose={closePanel} />
          <QuickActionsSheet open={panel === "new"} onClose={closePanel} />
          <PlacesSheet open={panel === "places"} onClose={closePanel} />
          <UpdatesSheet open={panel === "updates"} onClose={closePanel} updates={updates} now={now} />

          <Suspense fallback={null}>
            <ActivePlace places={allPlaces} onChange={setActiveArea} />
          </Suspense>
          <Suspense fallback={null}>
            <SheetHost />
          </Suspense>
          <IdleLock />
        </div>
      </ToastProvider>
    </ShellContext.Provider>
  );
}
