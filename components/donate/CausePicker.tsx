"use client";

import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Sheet } from "@/components/ui/Sheet";
import { Chips } from "@/components/ui/form/Chips";
import { cn } from "@/lib/cn";
import type { WidgetCause } from "./model";

// "Change" in the widget's "Giving to" row (public-pages §4.4 step 1): a bottom sheet on phones and a
// 560px dialog from 768px, both native <dialog>s with a focus trap. Tabs: Most needed · Programmes ·
// Appeals · Projects. Each choice shows the photo, title, a one-liner, a mini progress bar (when the
// figures may be shown) and its season.

type Tab = "needed" | "programmes" | "appeals" | "projects";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "needed", label: "Most needed" },
  { value: "programmes", label: "Programmes" },
  { value: "appeals", label: "Appeals" },
  { value: "projects", label: "Projects" },
];

function tabOf(c: WidgetCause): Tab {
  if (c.kind === "general") return "needed";
  if (c.kind === "programme") return "programmes";
  if (c.kind === "project") return "projects";
  return "appeals";
}

const QUERY = "(min-width: 768px)";
function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}

export function CausePicker({
  open,
  onClose,
  causes,
  current,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  causes: WidgetCause[];
  current: string;
  onPick: (slug: string) => void;
}) {
  const wide = useWide();
  const live = useMemo(() => causes.filter((c) => c.live || c.kind === "general"), [causes]);
  const lists = useMemo(() => {
    const out: Record<Tab, WidgetCause[]> = { needed: [], programmes: [], appeals: [], projects: [] };
    for (const c of live) out[tabOf(c)].push(c);
    // "Most needed": where it's needed most, then the three appeals furthest from their goal.
    const neediest = out.appeals
      .filter((c) => c.showFigures && c.goal > 0)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 3);
    out.needed = [...out.needed, ...neediest];
    return out;
  }, [live]);
  const currentCause = live.find((c) => c.slug === current);
  const [tab, setTab] = useState<Tab>(currentCause ? tabOf(currentCause) : "needed");
  const shown = lists[tab];

  const body = (
    <div className="pb-2">
      <Chips
        label="Kind of cause"
        tone="clay"
        size="sm"
        scroll
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={TABS.filter((t) => lists[t.value].length > 0).map((t) => ({ value: t.value, label: t.label, count: lists[t.value].length }))}
      />
      <ul className="mt-4 grid gap-2" aria-label={TABS.find((t) => t.value === tab)?.label}>
        {shown.map((c) => {
          const on = c.slug === current;
          const pct = c.showFigures && c.goal > 0 ? Math.min(100, c.percent) : null;
          return (
            <li key={c.slug}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(c.slug)}
                className={cn(
                  "group grid w-full grid-cols-[64px_minmax(0,1fr)_24px] items-center gap-4 rounded-tile border p-2.5 pr-4 text-left transition-[border-color,background-color,box-shadow] duration-300",
                  on ? "border-coral bg-coral/[0.06] shadow-thumb" : "border-mist bg-white hover:border-coral/50 hover:bg-cream-2",
                )}
              >
                <span className="relative aspect-square overflow-hidden rounded-[14px] bg-sand">
                  <Image src={c.image.src} alt="" fill sizes="64px" className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-110" style={c.image.focal ? { objectPosition: `${c.image.focal.x}% ${c.image.focal.y}%` } : undefined} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[16px] font-bold leading-snug text-ink">{c.title}</span>
                    {c.kind !== "general" && c.kind !== "programme" ? (
                      <span className="rounded-full bg-sand px-2 py-0.5 font-grotesk text-[11px] font-semibold uppercase tracking-[0.06em] text-umber">{c.season}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] text-body">{c.summary}</span>
                  {pct !== null ? (
                    <span className="mt-2 flex items-center gap-2">
                      <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                        <span className={cn("block h-full rounded-full", c.tone === "forest" ? "bg-forest" : c.tone === "clay" ? "bg-clay" : "bg-coral-800")} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="font-grotesk text-[12px] tabular-nums text-body">{Math.round(pct)}% funded</span>
                    </span>
                  ) : null}
                </span>
                <span aria-hidden className={cn("grid size-6 place-items-center rounded-full transition-colors", on ? "bg-coral-800 text-white" : "border border-mist text-transparent")}>
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="mt-4 text-[15px] text-body">Nothing is open here right now. Please choose another tab.</p> : null}
    </div>
  );

  const title = "Choose where your gift goes";
  const description = "Every cause has its own page and breakdown. Your amount stays as it is.";
  if (wide) {
    return (
      <Modal open={open} onClose={onClose} title={title} description={description} size="md">
        {body}
      </Modal>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title={title} description={description} side="bottom">
      {body}
    </Sheet>
  );
}
