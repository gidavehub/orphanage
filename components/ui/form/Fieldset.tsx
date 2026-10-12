import { AlertCircle } from "lucide-react";
import { fieldError, type AnyFormState } from "./Field";
import { errorClass } from "./styles";
import { cn } from "@/lib/cn";

export type FieldsetProps = {
  legend: React.ReactNode;
  hint?: React.ReactNode;
  /**
   * The group's field name (radio and checkbox groups): becomes the fieldset id so ErrorSummary can
   * link to it, and reads its error from `state`.
   */
  name?: string;
  error?: string;
  state?: AnyFormState;
  /** `lg` (default): a form step or group, Nunito 800 22 with the marigold rule. `sm`: a radio/checkbox group, 16/700. */
  size?: "lg" | "sm";
  legendHidden?: boolean;
  surface?: "light" | "dark";
  className?: string;
  children: React.ReactNode;
};

/** Groups related fields under a legend (design-system §3.3). Separate groups with `mt-12`. */
export function Fieldset({ legend, hint, name, error, state, size = "lg", legendHidden, surface = "light", className, children }: FieldsetProps) {
  const message = error ?? (name ? fieldError(state, name) : undefined);
  const base = name ?? undefined;
  const hintId = hint && base ? `${base}-hint` : undefined;
  const errorId = message && base ? `${base}-error` : undefined;
  const dark = surface === "dark";
  return (
    <fieldset
      id={base}
      tabIndex={base ? -1 : undefined}
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={message ? true : undefined}
      className={cn("min-w-0 border-0 p-0 outline-offset-8", className)}
    >
      <legend className={cn(legendHidden ? "sr-only" : "mb-1 p-0", dark ? "text-white" : "text-ink")}>
        {size === "lg" ? (
          <span className="block text-[22px] font-extrabold leading-tight">
            {legend}
            <span aria-hidden className="mt-2.5 block h-[2px] w-12 bg-marigold" />
          </span>
        ) : (
          <span className="block text-[16px] font-bold leading-snug">{legend}</span>
        )}
      </legend>
      {hint ? (
        <div id={hintId} className={cn("text-[14px] leading-relaxed", dark ? "text-white/85" : "text-body", size === "lg" ? "mt-3" : "mt-1")}>
          {hint}
        </div>
      ) : null}
      {message ? (
        <p id={errorId} className={cn(errorClass(surface), "mt-2")}>
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
          <span>{message}</span>
        </p>
      ) : null}
      <div className={cn("grid grid-cols-1", size === "lg" ? "mt-6 gap-6" : "mt-3 gap-3")}>{children}</div>
    </fieldset>
  );
}
