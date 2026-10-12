"use client";

import { useEffect, useId, useRef } from "react";
import { AlertCircle } from "lucide-react";
import type { FieldErrors } from "@/lib/forms/types";
import type { AnyFormState } from "./Field";
import { cn } from "@/lib/cn";

export type ErrorSummaryProps = {
  /** Field errors (name → first message). Defaults to the FormState's. */
  errors?: FieldErrors;
  /** The form's useActionState state. Its message shows when there are no field errors (rate limit, server). */
  state?: AnyFormState;
  title?: string;
  /** Overrides the form-level sentence. */
  message?: string;
  /** Element id for a field name, when it differs from the name. */
  idFor?: (name: string) => string;
  /** Change it (e.g. a submit counter) to take focus again when client-side errors repeat unchanged. */
  focusKey?: string | number;
  className?: string;
};

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Moves focus to a field (or the first control inside a group) and brings its label into view. */
function focusField(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const target = el.matches("input, select, textarea, button, fieldset") ? el : (el.querySelector<HTMLElement>(FOCUSABLE) ?? el);
  if (!target.matches(`${FOCUSABLE}, fieldset`) && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  const box = el.closest<HTMLElement>("[data-field]") ?? el;
  box.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  target.focus({ preventScroll: true });
  return true;
}

/**
 * "There's a problem" at the top of a form after a failed submit (design-system §3.3, GOV.UK
 * pattern): it takes focus, lists each error as a link to its field, and shows form-level messages.
 * Renders nothing while the form has no error.
 */
export function ErrorSummary({ errors, state, title = "There's a problem", message, idFor, focusKey, className }: ErrorSummaryProps) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isError = state?.status === "error";
  const fieldErrors = errors ?? (isError ? state.fieldErrors : undefined) ?? {};
  const entries = Object.entries(fieldErrors).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "_form");
  const formLevel = message ?? fieldErrors._form ?? (isError && entries.length === 0 ? state.message : undefined);
  const show = entries.length > 0 || !!formLevel;

  // Take focus when a new error result arrives: each submit returns a new state object; client errors
  // are compared by content (so re-renders while typing never steal focus) or re-armed by focusKey.
  const signature = show ? JSON.stringify([entries, formLevel ?? null]) : "";
  useEffect(() => {
    if (signature) box.current?.focus();
  }, [signature, state, focusKey]);

  if (!show) return null;
  return (
    <div
      ref={box}
      role="group"
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn("rounded-control border-2 border-coral-800 bg-coral-100 p-5 outline-offset-4 focus-forest md:p-6", className)}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-[18px] font-extrabold leading-tight text-coral-800">
        <AlertCircle aria-hidden className="size-5 shrink-0" strokeWidth={2.5} />
        {title}
      </h2>
      {formLevel ? <p className="mt-2 text-[15px] leading-relaxed text-ink">{formLevel}</p> : null}
      {entries.length ? (
        <ul className="mt-3 grid gap-1.5">
          {entries.map(([name, msg]) => {
            const id = idFor ? idFor(name) : name;
            return (
              <li key={name}>
                <a
                  href={`#${id}`}
                  onClick={(e) => {
                    if (focusField(id)) e.preventDefault();
                  }}
                  className="text-[15px] font-bold text-coral-800 underline decoration-2 underline-offset-4 hover:text-ink"
                >
                  {msg}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
