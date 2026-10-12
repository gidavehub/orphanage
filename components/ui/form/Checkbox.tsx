import { useId } from "react";
import { AlertCircle, Check } from "lucide-react";
import { errorClass } from "./styles";
import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  name: string;
  /** A sentence; links inside it are forest and underlined. */
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Error under the box; also sets aria-invalid. */
  error?: string;
  invalid?: boolean;
  /** `dark` for coral, deep or photo surfaces. */
  surface?: "light" | "dark";
  ref?: React.Ref<HTMLInputElement>;
};

/**
 * A 22px checkbox with a full-sentence label (consent, privacy, preferences). Native input, styled:
 * checked is a forest box with a white check (design-system §3.3).
 */
export function Checkbox({ name, label, hint, error, invalid, surface = "light", id, className, ref, "aria-describedby": describedBy, ...rest }: CheckboxProps) {
  const auto = useId();
  // A lone consent box (no `value`) takes the field name as its id, so ErrorSummary can link to it;
  // boxes in a group (each with a value) get unique ids.
  const inputId = id ?? (rest.value === undefined ? name : `${name}-${auto}`);
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const dark = surface === "dark";
  const bad = invalid || !!error;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-start gap-3">
        <span className="relative mt-[1px] grid size-[22px] shrink-0 place-items-center">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            name={name}
            aria-describedby={[describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined}
            aria-invalid={bad || undefined}
            className={cn(
              "peer size-[22px] cursor-pointer appearance-none rounded-[7px] border-[1.5px] bg-white transition-colors duration-200",
              "checked:border-forest checked:bg-forest disabled:cursor-not-allowed disabled:border-mist disabled:bg-pebble",
              bad ? "border-coral-800" : dark ? "border-white/70" : "border-edge hover:border-ink/60",
            )}
            {...rest}
          />
          <Check aria-hidden strokeWidth={3.5} className="pointer-events-none absolute size-3.5 text-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100" />
        </span>
        <label
          htmlFor={inputId}
          className={cn(
            "cursor-pointer text-[15px] leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4",
            dark ? "text-white [&_a]:text-white" : "text-body [&_a]:text-forest",
          )}
        >
          {label}
        </label>
      </div>
      {hint ? (
        <div id={hintId} className={cn("pl-[34px] text-[14px] leading-relaxed", dark ? "text-white/85" : "text-body")}>
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className={cn(errorClass(surface), "pl-[34px]")}>
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
