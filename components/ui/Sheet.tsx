"use client";

import { useId, useRef, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { ConfirmDialog } from "./Modal";
import { useDialog } from "./useDialog";
import { cn } from "@/lib/cn";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  /** `auto` (default): a bottom sheet below 768px, a right panel from 768px. */
  side?: "right" | "bottom" | "auto";
  /** Right-panel width: sm 420, md 560 (default), lg 720, full. Design-system widths 480/640 map to md/lg. */
  size?: "sm" | "md" | "lg" | "full";
  /** Unsaved changes: closing asks "Keep editing / Discard changes" first. */
  dirty?: boolean;
  /** Sticky action bar (white, top hairline) holding the primary next step. */
  footer?: React.ReactNode;
  /** `restricted`: a deep header band for the safeguarding place. */
  tone?: "default" | "restricted";
  children: React.ReactNode;
  className?: string;
};

const widths = {
  sm: "md:max-w-[420px]",
  md: "md:max-w-[560px]",
  lg: "md:max-w-[720px]",
  full: "md:max-w-none",
} as const;

/**
 * The admin's main surface for opening records, also used for the public team bios (design-system
 * §3.5, admin-ux §9.2). Native `<dialog>`: focus trap, Esc, inert page. Right: full height on
 * cream-2, slides in over 480ms. Bottom: rounded top, drag handle (drag down to dismiss), 90svh.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  side = "auto",
  size = "md",
  dirty,
  footer,
  tone = "default",
  children,
  className,
}: SheetProps) {
  const [confirming, setConfirming] = useState(false);
  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };
  const { ref, onBackdropClick } = useDialog(open, requestClose);
  const titleId = useId();
  const descId = useId();
  const restricted = tone === "restricted";

  // Drag-to-dismiss on the bottom sheet's handle.
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
    panel.current.style.transition = "none";
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!panel.current || !d) return;
    panel.current.style.transition = "transform 300ms var(--ease-out-back)";
    panel.current.style.transform = "";
    if (d.dy > 120) requestClose();
  };

  const bottom = side === "bottom";
  const right = side === "right";

  return (
    <dialog
      ref={ref}
      data-haven-dialog
      data-lenis-prevent
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={onBackdropClick}
      className={cn(
        "m-0 max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 text-ink focus-forest",
        // Bottom placement (phones in auto mode).
        !right && "inset-x-0 bottom-0 top-auto h-auto w-full",
        // Right placement (always, or from 768px in auto mode).
        right && "inset-y-0 left-auto right-0 h-dvh w-full",
        !right && !bottom && "md:inset-x-auto md:inset-y-0 md:left-auto md:right-0 md:top-0 md:h-dvh",
        (right || !bottom) && widths[size],
        right && "open:animate-[sheet-in-right_0.48s_var(--ease-out-expo)]",
        bottom && "open:animate-[sheet-in-up_0.42s_var(--ease-out-expo)]",
        !right && !bottom && "open:animate-[sheet-in-up_0.42s_var(--ease-out-expo)] md:open:animate-[sheet-in-right_0.48s_var(--ease-out-expo)]",
        "motion-reduce:animate-none",
        className,
      )}
    >
      {open ? (
        <div
          ref={panel}
          className={cn(
            "flex flex-col overflow-hidden bg-cream-2 shadow-modal",
            !right && "max-h-[90svh] rounded-t-[30px]",
            right && "h-full",
            !right && !bottom && "md:h-full md:max-h-none md:rounded-none",
          )}
        >
          <header
            className={cn(
              "relative shrink-0 border-b px-5 pb-4 md:px-6",
              restricted ? "border-white/10 bg-deep text-white focus-marigold" : "border-line bg-white",
              right ? "pt-5" : "pt-3",
              !right && !bottom && "md:pt-5",
            )}
          >
            {!right ? (
              <div
                aria-hidden
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={cn("-mx-5 mb-2 flex h-6 cursor-grab touch-none items-center justify-center active:cursor-grabbing", !bottom && "md:hidden")}
              >
                <span className="h-1 w-10 rounded-full bg-mist" />
              </div>
            ) : null}
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {restricted ? (
                  <p className="mb-1 flex items-center gap-1.5 font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-marigold">
                    <ShieldAlert aria-hidden className="size-3.5" strokeWidth={2.5} /> Restricted
                  </p>
                ) : null}
                <h2 id={titleId} className="text-balance text-[20px] font-extrabold leading-tight md:text-[22px]">
                  {title}
                </h2>
                {description ? (
                  <div id={descId} className={cn("mt-1 text-[14px] leading-relaxed", restricted ? "text-white/80" : "text-body")}>
                    {description}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className={cn(
                  "-mr-1 grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-500 ease-out-expo hover:rotate-90",
                  restricted ? "bg-marigold text-night" : "bg-pebble text-ink hover:bg-marigold hover:text-night",
                )}
              >
                <X aria-hidden className="size-5" strokeWidth={2.5} />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6 md:py-6">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-line bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
              {footer}
            </footer>
          ) : null}
          <ConfirmDialog
            open={confirming}
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              onClose();
            }}
            title="Discard your changes?"
            body="You have changes that aren't saved yet."
            confirmLabel="Discard changes"
            cancelLabel="Keep editing"
            tone="danger"
          />
        </div>
      ) : null}
    </dialog>
  );
}
