"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutGrid, Lock, Plus, Search } from "lucide-react";
import { HavenMark } from "@/components/art/Logo";
import { COPY } from "@/lib/admin/copy";
import type { Place } from "@/lib/admin/access";
import { cn } from "@/lib/cn";
import { PlaceIcon } from "./PlaceIcon";
import { useShell } from "./ShellContext";
import { usePlaceBadge } from "./TopBar";

const slot =
  "relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-bold leading-none transition-colors";

function ActiveDot({ on }: { on: boolean }) {
  return <span aria-hidden className={cn("absolute top-1.5 size-1 rounded-full bg-marigold transition-opacity", on ? "opacity-100" : "opacity-0")} />;
}

function PlaceSlot({ place, active }: { place: Place; active: boolean }) {
  const badge = usePlaceBadge(place);
  return (
    <Link href={place.href} data-tour={place.area} aria-current={active ? "page" : undefined} className={cn(slot, active ? "text-forest" : "text-body hover:text-ink")}>
      <ActiveDot on={active} />
      <span className="relative">
        <PlaceIcon name={place.icon} className="size-[22px]" />
        {badge ? (
          <span
            className={cn(
              "absolute -right-3 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center gap-0.5 rounded-full px-1 font-grotesk text-[10px] font-semibold tabular-nums",
              badge.lock ? "bg-deep text-white" : "bg-marigold text-night",
            )}
          >
            {badge.lock ? <Lock aria-hidden className="size-2" strokeWidth={3} /> : null}
            {badge.count > 99 ? "99+" : badge.count}
            <span className="sr-only">{badge.lock ? " new concerns" : " new"}</span>
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate px-1">{place.label}</span>
    </Link>
  );
}

/**
 * The phone and tablet dock (< 1024px; admin-ux §3.3, design-system §5.2): Today · the role's main
 * place · ＋ New (a raised marigold disc) · Find · Places. Viewers get Today · Find · Places. Labels
 * always show; the active slot is forest with a marigold dot. It hides while the on-screen keyboard
 * is open (visualViewport), and respects the safe area.
 */
export function BottomDock() {
  const { places, activeArea, quickActions, openPanel } = useShell();
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboard(vv.height < window.innerHeight * 0.72);
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const primary = places.dockPrimary.area !== "today" ? places.dockPrimary : null;

  return (
    <nav
      aria-label="Places"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-dock transition-transform duration-300 ease-out-expo lg:hidden",
        keyboard && "translate-y-full",
      )}
    >
      <ul className="mx-auto flex max-w-[560px] items-end px-2">
        <li className="flex flex-1">
          <Link href="/admin" data-tour="today" aria-current={activeArea === "today" ? "page" : undefined} className={cn(slot, activeArea === "today" ? "text-forest" : "text-body hover:text-ink")}>
            <ActiveDot on={activeArea === "today"} />
            <HavenMark className="size-[24px]" stem={activeArea === "today" ? "var(--color-forest)" : "var(--color-body)"} />
            <span>Today</span>
          </Link>
        </li>
        {primary ? (
          <li className="flex min-w-0 flex-1">
            <PlaceSlot place={primary} active={activeArea === primary.area} />
          </li>
        ) : null}
        {quickActions.length ? (
          <li className="flex flex-1 justify-center">
            <button type="button" data-tour="new" onClick={() => openPanel("new")} className={cn(slot, "text-ink")}>
              <span className="-mt-7 grid size-14 place-items-center rounded-full bg-marigold text-night shadow-float ring-4 ring-white">
                <Plus aria-hidden className="size-6" strokeWidth={3} />
              </span>
              <span>{COPY["shell.new"]}</span>
            </button>
          </li>
        ) : null}
        <li className="flex flex-1">
          <button type="button" data-tour="find" onClick={() => openPanel("find")} className={cn(slot, "text-body hover:text-ink")}>
            <Search aria-hidden className="size-[22px]" strokeWidth={2.25} />
            <span>{COPY["shell.find"]}</span>
          </button>
        </li>
        <li className="flex flex-1">
          <button type="button" onClick={() => openPanel("places")} className={cn(slot, "text-body hover:text-ink")}>
            <LayoutGrid aria-hidden className="size-[22px]" strokeWidth={2.25} />
            <span>{COPY["shell.places"]}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
