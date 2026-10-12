import { cloneElement, isValidElement } from "react";
import { AlertCircle } from "lucide-react";
import type { FormState } from "@/lib/forms/types";
import { FieldCounter } from "./FieldCounter";
import { errorClass, hintClass, labelClass, type Density, type Skin, type Surface } from "./styles";
import { cn } from "@/lib/cn";

/** Any FormState: fields only read its error and echoed values. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFormState = FormState<string, any>;

/** The first error for a field from a FormState (error states only). */
export function fieldError(state: AnyFormState | undefined, name: string): string | undefined {
  return state && state.status === "error" ? state.fieldErrors?.[name] : undefined;
}

/** The value typed before a failed submit, echoed back by the action (FormState.values). */
export function fieldValue(state: AnyFormState | undefined, name: string): string | undefined {
  return state && state.status === "error" ? state.values?.[name] : undefined;
}

/** Ids a field derives from its control id. */
function fieldIds(id: string) {
  return { hint: `${id}-hint`, error: `${id}-error`, count: `${id}-count` };
}

export type FieldProps = {
  /** Form field name; also the control id (ErrorSummary links to `#name`) unless `id` is given. */
  name: string;
  label: React.ReactNode;
  /** Shown above the control (GOV.UK order: heard before typing). */
  hint?: React.ReactNode;
  /** Error message; defaults to the FormState's fieldErrors[name]. */
  error?: string;
  /** The form's useActionState state: supplies `error` and echoes the typed value back. */
  state?: AnyFormState;
  /** Marks the label "(optional)". Fields are required by default, so required ones carry no marker. */
  optional?: boolean;
  labelHidden?: boolean;
  /** Live character count against `max` (turns coral-800 past it). */
  counter?: { max: number };
  id?: string;
  skin?: Skin;
  density?: Density;
  surface?: Surface;
  className?: string;
  /** The control: Input, Textarea, Select, CountrySelect, PhoneInput, MoneyField or a native element. */
  children: React.ReactElement;
};

type ControlProps = {
  id?: string;
  name?: string;
  value?: unknown;
  defaultValue?: unknown;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
  required?: boolean;
  invalid?: boolean;
  skin?: Skin;
  density?: Density;
  surface?: Surface;
};

/**
 * The wrapper and single source of `id`, `aria-describedby` and `aria-invalid` (design-system §3.3).
 * Label above, hint above the control, error below it with an icon, optional live counter.
 * Server-safe: it clones its one child with the wiring.
 */
export function Field({
  name,
  label,
  hint,
  error,
  state,
  optional,
  labelHidden,
  counter,
  id,
  skin = "donat",
  density = "default",
  surface = "light",
  className,
  children,
}: FieldProps) {
  const controlId = id ?? name;
  const ids = fieldIds(controlId);
  const message = error ?? fieldError(state, name);
  const echoed = fieldValue(state, name);

  let control: React.ReactNode = children;
  if (isValidElement<ControlProps>(children)) {
    const own = children.props;
    const describedBy = [own["aria-describedby"], hint ? ids.hint : null, message ? ids.error : null, counter ? ids.count : null]
      .filter(Boolean)
      .join(" ");
    const isComponent = typeof children.type !== "string";
    const injected: ControlProps = {
      id: own.id ?? controlId,
      name: own.name ?? name,
      "aria-describedby": describedBy || undefined,
      "aria-invalid": message ? true : own["aria-invalid"],
      "aria-required": optional || own.required !== undefined ? own["aria-required"] : true,
    };
    if (own.value === undefined && own.defaultValue === undefined && echoed !== undefined) injected.defaultValue = echoed;
    if (isComponent) {
      injected.invalid = own.invalid ?? !!message;
      injected.skin = own.skin ?? skin;
      injected.density = own.density ?? density;
      injected.surface = own.surface ?? surface;
    }
    control = cloneElement(children, injected);
  }

  return (
    <div data-field={name} className={cn("grid min-w-0 grid-cols-1 content-start", density === "admin" ? "gap-1.5" : "gap-2", className)}>
      <label htmlFor={controlId} className={cn(labelClass(skin, surface), labelHidden && "sr-only")}>
        {label}
        {optional ? <span className={cn("ml-1.5 font-normal", surface === "dark" ? "text-white/85" : "text-body")}>(optional)</span> : null}
      </label>
      {hint ? (
        <div id={ids.hint} className={hintClass(surface)}>
          {hint}
        </div>
      ) : null}
      {control}
      {message || counter ? (
        <div className="flex items-start justify-between gap-4">
          {message ? (
            <p id={ids.error} className={errorClass(surface)}>
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
              <span>{message}</span>
            </p>
          ) : (
            <span />
          )}
          {counter ? <FieldCounter controlId={controlId} id={ids.count} max={counter.max} initial={echoed?.length ?? 0} /> : null}
        </div>
      ) : null}
    </div>
  );
}
