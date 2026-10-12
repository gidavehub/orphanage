"use client";

import { useEffect, useState } from "react";
import { Hand, Inbox, Plus, Search, Sun, X } from "lucide-react";
import { cn } from "@/lib/cn";

const STEPS = [
  { target: "today", icon: Sun, title: "This is Today", body: "Your starting point. It shows what needs you, what's coming up and how Haven is doing this month." },
  { target: "inbox", icon: Inbox, title: "The Inbox", body: "Every new request, gift, message and application arrives here. Take one, and it becomes yours." },
  { target: "new", icon: Plus, title: "＋ New", body: "Log a phone call, record a gift, post an update or book a session, from any page." },
  { target: "find", icon: Search, title: "Find anything", body: "Type a name, an email, a phone number or a reference. Ctrl K (⌘ K on a Mac) opens it from anywhere." },
] as const;

/** The visible element tagged for a step (the top bar on desktop, the dock on phones). */
function targetOf(name: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)];
  return all.find((el) => el.offsetParent !== null && el.getClientRects().length > 0) ?? null;
}

/**
 * The first-day tour (admin-ux §6.18): four short steps over Today, Inbox, ＋ New and Find. The step's
 * control gets a pulsing marigold ring; every step can be skipped; finishing or skipping stores
 * tourDoneAt so it never shows again.
 */
export function FirstDayTour({ onDone }: { onDone: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const el = targetOf(STEPS[step]!.target);
    if (!el) return;
    el.classList.add("tour-ring");
    return () => el.classList.remove("tour-ring");
  }, [step, open]);

  if (!open) return null;
  const s = STEPS[step]!;
  const Icon = s.icon;
  const finish = () => {
    setOpen(false);
    void onDone().catch(() => undefined);
  };
  const last = step === STEPS.length - 1;

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="tour-title" className="fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[440px] rounded-[26px] bg-deep p-5 text-white shadow-float md:bottom-8 md:left-auto md:right-8 md:mx-0">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-marigold text-night">
          <Icon className="size-5" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.1em] text-marigold-100">
            <Hand aria-hidden className="mr-1 inline size-3.5" /> Your first day · {step + 1} of {STEPS.length}
          </p>
          <h2 id="tour-title" className="mt-1 text-[19px] font-extrabold">
            {s.title}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white">{s.body}</p>
        </div>
        <button type="button" onClick={finish} aria-label="Skip the tour" className="grid size-10 shrink-0 place-items-center rounded-full text-white/90 hover:bg-white/10">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-marigold" : "w-1.5 bg-white/40")} />
          ))}
        </span>
        <span className="flex gap-2">
          <button type="button" onClick={finish} className="h-11 rounded-full px-4 text-[14px] font-bold text-white/90 hover:bg-white/10">
            Skip
          </button>
          <button type="button" onClick={() => (last ? finish() : setStep((n) => n + 1))} className="h-11 rounded-full bg-marigold px-5 text-[14px] font-bold text-night hover:bg-white">
            {last ? "Let's start" : "Next"}
          </button>
        </span>
      </div>
    </div>
  );
}
