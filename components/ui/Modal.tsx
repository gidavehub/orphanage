"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { useDialog } from "./useDialog";
import { cn } from "@/lib/cn";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Sticky action row (Buttons). */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hide the close disc (ConfirmDialog has its own Cancel). */
  hideClose?: boolean;
  className?: string;
};

const widths = { sm: "max-w-[440px]", md: "max-w-[560px]", lg: "max-w-[760px]" } as const;

/**
 * A centred dialog on the native `<dialog>` with `showModal()` (design-system §3.5): focus trap, Esc,
 * inert page, focus returns to the trigger. Backdrop night/60 with blur; enters with a soft scale.
 */
export function Modal({ open, onClose, title, description, children, footer, size = "md", hideClose, className }: ModalProps) {
  const { ref, onBackdropClick } = useDialog(open, onClose);
  const titleId = useId();
  const descId = useId();

  return (
    <dialog
      ref={ref}
      data-haven-dialog
      data-lenis-prevent
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={onBackdropClick}
      className={cn(
        "m-auto w-[calc(100%-2rem)] overflow-visible border-0 bg-transparent p-0 text-ink focus-forest open:animate-[modal-in_0.4s_var(--ease-out-expo)] motion-reduce:animate-none",
        widths[size],
        className,
      )}
    >
      {open ? (
        <div className="relative flex max-h-[calc(100svh-2rem)] flex-col rounded-card-lg bg-white shadow-modal">
          <div className="flex items-start gap-4 px-7 pt-7 md:px-8 md:pt-8">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-balance text-[22px] font-extrabold leading-tight text-ink">
                {title}
              </h2>
              {description ? (
                <div id={descId} className="mt-2 text-[15px] leading-relaxed text-body">
                  {description}
                </div>
              ) : null}
            </div>
            {hideClose ? null : (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="group -mr-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-marigold text-night transition-transform duration-500 ease-out-expo hover:rotate-90"
              >
                <X aria-hidden className="size-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-2 pt-5 text-[15px] leading-relaxed text-body md:px-8">{children}</div> : null}
          {footer ? <div className="flex flex-wrap justify-end gap-3 px-7 pb-7 pt-5 md:px-8 md:pb-8">{footer}</div> : <div className="h-7 md:h-8" />}
        </div>
      ) : null}
    </dialog>
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for destructive actions; `default` (forest) otherwise. `primary` is an alias of default. */
  tone?: "danger" | "default" | "primary";
  /** For rare, heavy actions: the person types this text to enable the confirm button. */
  requireText?: string;
  /** Shows a spinner on the confirm button while the action runs. */
  busy?: boolean;
};

/** A small confirm on Modal. Prefer Undo over confirm for everyday actions (admin-ux §0). */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  requireText,
  busy,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const matches = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase();
  const close = () => {
    setTyped("");
    onCancel();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      hideClose
      description={body}
      footer={
        <>
          <Button variant="outline" size="sm" icon="none" onClick={close}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "forest"}
            size="sm"
            icon="none"
            loading={busy}
            disabled={!matches}
            onClick={() => {
              if (!matches) return;
              setTyped("");
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireText ? (
        <div className="grid gap-2">
          <label htmlFor={inputId} className="text-[15px] font-bold text-ink">
            Type <span className="font-grotesk">{requireText}</span> to confirm
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="h-11 w-full rounded-2xl border-[1.5px] border-edge bg-white px-4 text-[16px] text-ink hover:border-ink/60 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15"
          />
        </div>
      ) : null}
    </Modal>
  );
}
