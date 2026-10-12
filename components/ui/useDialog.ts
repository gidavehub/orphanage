"use client";

import { useEffect, useRef } from "react";

/**
 * Drives a native `<dialog>` from an `open` prop with `showModal()`: focus trap, Esc, inert page and
 * the top layer come free. Esc and the native close path call `requestClose` so the parent stays the
 * source of truth. The effect cleanup closes the dialog, so a route hidden by Activity never leaves
 * the page locked, and focus returns to whatever opened it.
 */
export function useDialog(open: boolean, requestClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  }, [requestClose]);

  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!d.open) d.showModal();

    // Esc is handled on keydown (preventDefault stops the native close), so a dirty Sheet can ask
    // "Keep editing / Discard changes" first. Inner widgets that use Esc call preventDefault themselves.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      closeRef.current();
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    // Browsers may still close a dialog without a cancelable `cancel`; keep the prop in sync. A stale
    // `close` (queued by a previous cleanup, e.g. React's dev double-mount) arrives while the dialog is
    // open again: ignore it.
    const onClose = () => {
      if (!d.open) closeRef.current();
    };
    d.addEventListener("keydown", onKeyDown);
    d.addEventListener("cancel", onCancel);
    d.addEventListener("close", onClose);
    return () => {
      d.removeEventListener("keydown", onKeyDown);
      d.removeEventListener("cancel", onCancel);
      d.removeEventListener("close", onClose);
      if (d.open) d.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  /** Closes when a click lands on the backdrop (outside the dialog box). */
  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const d = ref.current;
    if (!d || e.target !== d) return;
    const r = d.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) closeRef.current();
  };

  return { ref, onBackdropClick };
}
