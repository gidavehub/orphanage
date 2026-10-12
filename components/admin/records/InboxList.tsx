"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Clock, Lock, MoreHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { UrgencyPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { Chips } from "@/components/ui/form/Chips";
import { isTyping } from "@/lib/admin/hotkeys";
import { relativeTime } from "@/lib/admin/format";
import type { ActionResult } from "@/lib/forms/types";
import type { InboxItem } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import { adminHrefOfRef } from "@/lib/model/refs";
import { cn } from "@/lib/cn";

export type InboxKindChip = { id: string; label: string };

type Tab = "new" | "later" | "mine";

export type InboxListProps = {
  lists: Record<Tab, InboxItem[]>;
  kinds: InboxKindChip[];
  /** Server time, for ages ("2 hours ago"); refreshed with every render. */
  now: Millis;
  canWrite: boolean;
  actions: {
    take: (ref: string) => Promise<ActionResult>;
    snooze: (ref: string, until: Millis | null) => Promise<ActionResult>;
  };
};

const KIND_OF: Record<string, string> = {
  support: "requests",
  concern: "concerns",
  gift: "gifts",
  inkind: "inkind",
  reportRequest: "reports",
  volunteer: "volunteers",
  partner: "partners",
  message: "messages",
  story: "stories",
};

const TINT: Record<string, string> = {
  support: "forest",
  concern: "deep",
  gift: "coral",
  inkind: "clay",
  reportRequest: "cocoa",
  volunteer: "marigold",
  partner: "umber",
  message: "mint",
  story: "sand",
};

function shortRef(ref: string): string {
  const m = /^HVN-([A-Z]{2})-\d{4}-(\d+)$/.exec(ref);
  return m ? `${m[1]}-${m[2]}` : ref;
}

/** Later options (admin-ux §6.3 swipe left): later today, tomorrow morning, next Monday. */
function laterOptions(now: Millis): Array<{ label: string; at: Millis }> {
  const d = new Date(now);
  const at = (days: number, hour: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    x.setHours(hour, 0, 0, 0);
    return x.getTime();
  };
  const out: Array<{ label: string; at: Millis }> = [];
  if (d.getHours() < 15) out.push({ label: "Later today (4 pm)", at: at(0, 16) });
  out.push({ label: "Tomorrow morning", at: at(1, 9) });
  const toMonday = ((8 - d.getDay()) % 7) || 7;
  out.push({ label: "Next Monday", at: at(toMonday, 9) });
  out.push({ label: "In a week", at: at(7, 9) });
  return out;
}

/**
 * The Inbox list (admin-ux §6.3): New / Later / Mine, type chips, rows with the next step, a Later
 * menu and keyboard keys (j/k to move, o or Enter to open, t to take, l for later). Filters live in
 * the URL so a view can be shared. Swipe right to take, left for later, on phones.
 */
export function InboxList({ lists, kinds, now, canWrite, actions }: InboxListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get("tab") as Tab) || "new";
  const kind = params.get("type") ?? "all";
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [focus, setFocus] = useState(0);
  const [menu, setMenu] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo(() => (lists[tab] ?? []).filter((i) => kind === "all" || KIND_OF[i.kind] === kind), [lists, tab, kind]);
  const openRef = pathname.split("/")[3] ? decodeURIComponent(pathname.split("/")[3]!) : null;

  const setParam = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (v === null || v === "all" || (k === "tab" && v === "new")) sp.delete(k);
    else sp.set(k, v);
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const hrefOf = useCallback((i: InboxItem) => {
    // Support requests and messages open beside the list; other kinds open in their own place.
    if (i.kind === "support" || i.kind === "message" || i.kind === "story") {
      const qs = params.toString();
      return `/admin/inbox/${encodeURIComponent(i.ref)}${qs ? `?${qs}` : ""}`;
    }
    return adminHrefOfRef(i.ref, i.kind);
  }, [params]);

  const doTake = useCallback(
    (ref: string) =>
      start(async () => {
        const r = await actions.take(ref);
        if (r.ok) toast({ title: `You took ${shortRef(ref)}`, tone: "success" });
        else toast({ title: "message" in r.error ? r.error.message : "That didn't work.", tone: "danger" });
      }),
    [actions, toast],
  );
  const doLater = useCallback(
    (ref: string, at: Millis | null, label: string) =>
      start(async () => {
        setMenu(null);
        const r = await actions.snooze(ref, at);
        if (r.ok) toast({ title: at ? `${shortRef(ref)} is put aside: ${label.toLowerCase()}` : `${shortRef(ref)} is back`, tone: "success", action: at ? { label: "Undo", onClick: () => void actions.snooze(ref, null) } : undefined });
        else toast({ title: "message" in r.error ? r.error.message : "That didn't work.", tone: "danger" });
      }),
    [actions, toast],
  );

  // Keyboard (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || !items.length) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "arrowdown") setFocus((f) => Math.min(items.length - 1, f + 1));
      else if (k === "k" || k === "arrowup") setFocus((f) => Math.max(0, f - 1));
      else if ((k === "o" || k === "enter") && items[focus]) router.push(hrefOf(items[focus]!));
      else if (k === "t" && canWrite && items[focus] && !items[focus]!.restricted) doTake(items[focus]!.ref);
      else if (k === "l" && canWrite && items[focus] && !items[focus]!.restricted) setMenu(items[focus]!.ref);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, focus, canWrite, router, hrefOf, doTake]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${focus}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "new", label: `New ${lists.new.length}` },
    { value: "later", label: `Later ${lists.later.length}` },
    { value: "mine", label: `Mine ${lists.mine.length}` },
  ];
  const kindOptions = [{ value: "all", label: "All" }, ...kinds.map((k) => ({ value: k.id, label: k.label, count: (lists[tab] ?? []).filter((i) => KIND_OF[i.kind] === k.id).length }))];

  return (
    <div className={cn("grid gap-3 transition-opacity", pending && "opacity-80")}>
      <Chips label="Inbox tabs" tone="forest" value={tab} onChange={(v) => setParam("tab", v)} options={tabs} />
      {kinds.length > 1 ? <Chips label="Type" tone="clay" size="sm" scroll value={kind} onChange={(v) => setParam("type", v)} options={kindOptions} /> : null}

      {items.length ? (
        <ul ref={listRef} className="overflow-hidden rounded-[22px] bg-white shadow-soft">
          {items.map((i, idx) => {
            const age = now - i.createdAt;
            const waiting = i.status === "new" && age > 48 * 3_600_000 && !i.restricted;
            return (
              <SwipeRow key={i.ref} enabled={canWrite && !i.restricted && tab !== "later"} onRight={() => doTake(i.ref)} onLeft={() => setMenu(i.ref)}>
                <div
                  data-row={idx}
                  className={cn(
                    "relative flex min-h-16 items-center gap-3 border-b border-line pl-4 pr-2 last:border-b-0",
                    openRef === i.ref ? "bg-mint/60" : focus === idx ? "bg-cream" : "bg-white hover:bg-cream-2",
                  )}
                >
                  <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: `var(--color-${TINT[i.kind] ?? "forest"})` }} />
                  <Link href={hrefOf(i)} onClick={() => setFocus(idx)} aria-current={openRef === i.ref ? "true" : undefined} className="flex min-w-0 flex-1 items-start gap-2.5 py-3">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.unread ? "bg-marigold" : "bg-transparent")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-grotesk text-[12.5px] font-semibold tabular-nums text-umber">{shortRef(i.ref)}</span>
                        <span className={cn("truncate text-[15px] leading-snug text-ink", i.unread ? "font-extrabold" : "font-bold")}>
                          {i.restricted ? `Concern · ${i.risk ? `risk ${i.risk}` : "risk not set"}` : i.title}
                        </span>
                        {i.restricted ? <Lock aria-label="Restricted" className="size-3.5 shrink-0 text-deep" strokeWidth={2.75} /> : null}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 font-grotesk text-[12.5px] text-body">
                        {!i.restricted && i.country && hasFlag(i.country) ? <FlagDisc code={i.country} className="size-3.5 shrink-0" /> : null}
                        <span className="truncate">
                          {i.restricted ? "Details are restricted" : i.who} ·{" "}
                          <span className={cn(waiting && "font-bold text-umber")}>{waiting ? `Waiting ${Math.round(age / 86_400_000)} days` : relativeTime(i.createdAt, now)}</span>
                          {i.snoozedUntil ? ` · back ${relativeTime(i.snoozedUntil, now)}` : ""}
                        </span>
                      </span>
                      {!i.restricted && i.preview ? <span className="mt-0.5 block truncate text-[13px] italic text-body">“{i.preview}”</span> : null}
                    </span>
                  </Link>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {i.urgency !== "normal" ? <UrgencyPill urgency={i.urgency} size="sm" /> : null}
                    {i.assignee ? <Avatar name={i.assignee.name} uid={i.assignee.uid} tone={i.assignee.tone} size={28} /> : null}
                    {canWrite && !i.restricted ? (
                      <span className="relative">
                        <button type="button" aria-label={`More for ${shortRef(i.ref)}`} aria-expanded={menu === i.ref} onClick={() => setMenu(menu === i.ref ? null : i.ref)} className="grid size-10 place-items-center rounded-full text-body hover:bg-pebble">
                          <MoreHorizontal aria-hidden className="size-5" />
                        </button>
                        {menu === i.ref ? (
                          <span role="menu" className="absolute right-0 top-11 z-20 grid w-[220px] gap-0.5 rounded-2xl bg-white p-1.5 shadow-float">
                            {!i.assignee ? (
                              <button role="menuitem" type="button" onClick={() => { setMenu(null); doTake(i.ref); }} className="rounded-xl px-3 py-2.5 text-left text-[14px] font-bold text-forest hover:bg-mint">
                                Take it
                              </button>
                            ) : null}
                            {i.snoozedUntil ? (
                              <button role="menuitem" type="button" onClick={() => doLater(i.ref, null, "")} className="rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-ink hover:bg-cream">
                                Bring it back now
                              </button>
                            ) : (
                              laterOptions(now).map((o) => (
                                <button key={o.label} role="menuitem" type="button" onClick={() => doLater(i.ref, o.at, o.label)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-ink hover:bg-cream">
                                  <Clock aria-hidden className="size-4 text-marigold-ink" /> {o.label}
                                </button>
                              ))
                            )}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </div>
              </SwipeRow>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          compact
          art="plane"
          title={tab === "new" ? "All caught up. Lovely." : tab === "later" ? "Nothing put aside for later." : "Nothing assigned to you."}
          body={tab === "new" ? "New requests will appear here the moment they arrive." : tab === "mine" ? "Take something from New when you're ready." : undefined}
          className="rounded-[22px] bg-white"
        />
      )}
      <p className="hidden px-1 font-grotesk text-[12px] text-body lg:block">
        Keys: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>o</kbd> open · <kbd>t</kbd> take · <kbd>l</kbd> later · <kbd>g</kbd> then <kbd>t</kbd> Today
      </p>
    </div>
  );
}

/**
 * Swipe on touch screens (admin-ux §6.3): right reveals forest "Take it", left reveals marigold
 * "Later". Commits at 35% of the width or 96px; vertical scrolling stays free (touch-action pan-y).
 */
function SwipeRow({ enabled, onRight, onLeft, children }: { enabled: boolean; onRight: () => void; onLeft: () => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const width = useRef(320);
  if (!enabled) return <li>{children}</li>;
  return (
    <li
      className="relative touch-pan-y overflow-hidden"
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        width.current = (e.currentTarget as HTMLElement).offsetWidth;
        start.current = { x: e.clientX, y: e.clientY, locked: null };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.locked === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) s.locked = Math.abs(mx) > Math.abs(my);
        if (s.locked) setDx(mx);
      }}
      onPointerUp={() => {
        const s = start.current;
        start.current = null;
        if (s?.locked && Math.abs(dx) >= Math.min(96, width.current * 0.35)) {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
          if (dx > 0) onRight();
          else onLeft();
        }
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <span aria-hidden className={cn("absolute inset-0 flex items-center px-5 text-[13px] font-extrabold uppercase tracking-[0.08em]", dx > 0 ? "justify-start bg-forest text-white" : "justify-end bg-marigold text-night")}>
        {dx > 0 ? "Take it" : dx < 0 ? "Later" : ""}
      </span>
      <div className="relative" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 250ms ease" }}>
        {children}
      </div>
    </li>
  );
}
