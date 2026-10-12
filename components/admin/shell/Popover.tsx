"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A small disclosure popover for the shell (the avatar menu and the More card): a real button with
 * aria-expanded, closes on Escape (focus returns to the button), on a click outside and on any link
 * inside. Hidden routes (Activity) close it through the effect cleanup.
 */
export function Popover({
  label,
  trigger,
  triggerClassName,
  panelClassName,
  align = "right",
  children,
}: {
  /** Accessible name of the trigger. */
  label: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  align?: "left" | "right" | "center";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    const first = root.current?.querySelector<HTMLElement>(`#${CSS.escape(panelId)} a, #${CSS.escape(panelId)} button`);
    first?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, panelId]);

  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "absolute top-[calc(100%+12px)] z-50 rounded-card bg-white p-2 text-ink shadow-float",
          align === "right" && "right-0",
          align === "left" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          open && "animate-[hero-rise_0.35s_var(--ease-out-expo)_both] motion-reduce:animate-none",
          panelClassName,
        )}
      >
        {open ? children(close) : null}
      </div>
    </div>
  );
}
