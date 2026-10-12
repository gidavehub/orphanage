"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, Lock, Plus, Search } from "lucide-react";
import { HavenMark, Logo } from "@/components/art/Logo";
import { COPY } from "@/lib/admin/copy";
import { PLACE_DESCRIPTION, type Place } from "@/lib/admin/access";
import { cn } from "@/lib/cn";
import { AvatarMenu } from "./AvatarMenu";
import { PlaceIcon } from "./PlaceIcon";
import { Popover } from "./Popover";
import { useShell } from "./ShellContext";

/** The count shown on a place: new Inbox items, or new concerns (a quiet lock badge, no alarm colour). */
export function usePlaceBadge(place: Place): { count: number; lock: boolean } | null {
  const { pulse } = useShell();
  if (!pulse) return null;
  if (place.badge === "inbox" && pulse.inboxNew > 0) return { count: pulse.inboxNew, lock: false };
  if (place.badge === "concerns" && typeof pulse.concernsNew === "number" && pulse.concernsNew > 0) return { count: pulse.concernsNew, lock: true };
  return null;
}

function Badge({ count, lock, className }: { count: number; lock: boolean; className?: string }) {
  const n = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full px-1.5 font-grotesk text-[11px] font-semibold tabular-nums leading-none",
        lock ? "bg-deep text-white ring-1 ring-white/40" : "bg-marigold text-night",
        className,
      )}
    >
      {lock ? <Lock aria-hidden className="size-2.5" strokeWidth={3} /> : null}
      {n}
    </span>
  );
}

function PillLink({ place, active }: { place: Place; active: boolean }) {
  const badge = usePlaceBadge(place);
  return (
    <li className="h-full">
      <Link
        href={place.href}
        data-tour={place.area}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative inline-flex h-full items-center gap-2 whitespace-nowrap px-3 text-[15px] font-bold text-white xl:px-4",
          "after:absolute after:inset-x-3 after:bottom-3 after:h-[3px] after:origin-left after:rounded-full after:bg-marigold after:transition-transform after:duration-300 xl:after:inset-x-4",
          active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
        )}
      >
        {place.label}
        {badge ? (
          <>
            <Badge count={badge.count} lock={badge.lock} />
            <span className="sr-only">{badge.lock ? "new concerns" : "new"}</span>
          </>
        ) : null}
      </Link>
    </li>
  );
}

/** "Haven" + "team" (admin-ux §3.1). The Caveat word uses marigold-ink so it passes AA on white. */
export function DeskMark({ compact }: { compact?: boolean }) {
  return (
    <Link href="/admin" aria-label="Haven team: Today" className="flex shrink-0 items-end gap-1.5">
      {compact ? <HavenMark className="h-8 w-8" /> : <Logo className="text-[30px]" />}
      <span aria-hidden className={cn("font-script font-bold leading-none text-marigold-ink", compact ? "text-[22px]" : "-mb-0.5 text-[26px]")}>
        team
      </span>
    </Link>
  );
}

/**
 * The desktop bar (≥ 1024px; admin-ux §3.1, design-system §5.2): mark, the forest pill with up to six
 * places plus More ▾, then Find, ＋ New, Updates and the avatar menu. Sticky, white glass once scrolled.
 */
export function TopBar() {
  const { places, activeArea, quickActions, unreadUpdates, openPanel } = useShell();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 hidden transition-[background-color,box-shadow] duration-300 lg:block",
        scrolled ? "bg-white/90 shadow-bar backdrop-blur-xl" : "bg-white",
      )}
    >
      <div className="mx-auto flex h-[76px] w-full max-w-[1400px] items-center gap-4 px-6">
        <DeskMark />
        <nav aria-label="Places" className="flex min-w-0 flex-1 justify-center">
          <ul className="flex h-14 items-center rounded-full bg-forest px-2">
            {places.pill.map((p) => (
              <PillLink key={p.area} place={p} active={activeArea === p.area} />
            ))}
            {places.more.length ? (
              <li className="h-full">
                <Popover
                  label={COPY["shell.more"]}
                  align="center"
                  triggerClassName="inline-flex h-14 items-center gap-1 rounded-full px-3 text-[15px] font-bold text-white transition-colors hover:text-marigold xl:px-4"
                  trigger={
                    <>
                      {COPY["shell.more"]}
                      <ChevronDown aria-hidden className="size-4" strokeWidth={2.75} />
                    </>
                  }
                  panelClassName="w-[min(640px,90vw)] p-3"
                >
                  {(close) => (
                    <ul className="grid grid-cols-2 gap-1">
                      {places.more.map((p) => (
                        <li key={p.area}>
                          <Link
                            href={p.href}
                            onClick={close}
                            aria-current={activeArea === p.area ? "page" : undefined}
                            className="flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-cream aria-[current=page]:bg-mint"
                          >
                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint text-forest">
                              <PlaceIcon name={p.icon} className="size-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[15px] font-extrabold text-ink">{p.label}</span>
                              <span className="block text-[13px] leading-snug text-body">{PLACE_DESCRIPTION[p.area]}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Popover>
              </li>
            ) : null}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => openPanel("find")}
            data-tour="find"
            aria-label={COPY["shell.findHint"]}
            title={COPY["shell.findHint"]}
            className="grid size-12 place-items-center rounded-full bg-marigold text-night transition-transform duration-300 hover:scale-105"
          >
            <Search aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
          {quickActions.length ? (
            <button
              type="button"
              onClick={() => openPanel("new")}
              data-tour="new"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-marigold px-5 text-[15px] font-bold text-night transition-colors hover:bg-forest hover:text-white"
            >
              <Plus aria-hidden className="size-4" strokeWidth={3} />
              {COPY["shell.new"]}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => openPanel("updates")}
            aria-label={unreadUpdates > 0 ? `${COPY["shell.updates"]}: ${unreadUpdates} unread` : COPY["shell.updates"]}
            className="relative grid size-11 place-items-center rounded-full border border-line bg-white text-ink transition-colors hover:border-forest hover:text-forest"
          >
            <Bell aria-hidden className="size-5" strokeWidth={2.25} />
            {unreadUpdates > 0 ? <span aria-hidden className="absolute right-2 top-2 size-2.5 rounded-full bg-marigold ring-2 ring-white" /> : null}
          </button>
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
}

/**
 * The phone and tablet top line (< 1024px; admin-ux §3.3): the mark, the current place's name,
 * Updates and the avatar. The bottom dock carries the places.
 */
export function PhoneTopLine() {
  const { places, activeArea, unreadUpdates, openPanel } = useShell();
  const current = [...places.pill, ...places.more].find((p) => p.area === activeArea);
  return (
    <header className="sticky top-0 z-40 bg-white/95 shadow-bar backdrop-blur lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <DeskMark compact />
        {current ? (
          <p className="min-w-0 truncate border-l border-line pl-3 text-[16px] font-extrabold text-ink" aria-hidden>
            {current.label}
          </p>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openPanel("updates")}
            aria-label={unreadUpdates > 0 ? `${COPY["shell.updates"]}: ${unreadUpdates} unread` : COPY["shell.updates"]}
            className="relative grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-cream"
          >
            <Bell aria-hidden className="size-5" strokeWidth={2.25} />
            {unreadUpdates > 0 ? <span aria-hidden className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-marigold ring-2 ring-white" /> : null}
          </button>
          <AvatarMenu size={36} />
        </div>
      </div>
    </header>
  );
}
