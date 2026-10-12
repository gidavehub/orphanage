import { Check } from "lucide-react";
import { Fieldset } from "@/components/ui/form/Fieldset";
import { cn } from "@/lib/cn";

export type ChoicePill<T extends string = string> = { value: T; label: string; hint?: string };

export type ChoicePillsProps<T extends string> = {
  /** Field name; also the fieldset id the error summary links to. */
  name: string;
  legend: React.ReactNode;
  hint?: React.ReactNode;
  options: readonly ChoicePill<T>[];
  /** Controlled value ("" = nothing chosen yet). */
  value?: T | "";
  defaultValue?: T;
  onChange?: (value: T) => void;
  error?: string;
  /** `urgent` paints the checked pill coral (immediate danger: Yes). */
  urgentValue?: T;
  /** Stack full-width on phones (long labels). */
  stack?: boolean;
  className?: string;
};

/**
 * A required single choice as 44px pills (Yes / No / Not sure, urgency, method). Unlike Segmented it
 * starts with nothing chosen, so a question is never answered by default. Native radios inside the
 * labels give keyboard and screen-reader support; the fieldset carries legend, hint and error.
 */
export function ChoicePills<T extends string>({
  name,
  legend,
  hint,
  options,
  value,
  defaultValue,
  onChange,
  error,
  urgentValue,
  stack,
  className,
}: ChoicePillsProps<T>) {
  return (
    <Fieldset legend={legend} hint={hint} name={name} error={error} size="sm" className={className}>
      <div className={cn("flex flex-wrap gap-2.5", stack && "max-sm:flex-col")}>
        {options.map((o) => {
          const urgent = urgentValue !== undefined && o.value === urgentValue;
          return (
            <label
              key={o.value}
              className={cn(
                "group relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] bg-white px-5 py-2 text-[15px] font-bold text-ink transition-[background-color,border-color,color,transform] duration-300 ease-out-expo",
                "hover:-translate-y-px hover:border-forest",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-[color:var(--focus,var(--color-forest))]",
                error ? "border-coral-800" : "border-edge",
                urgent
                  ? "has-[:checked]:border-coral-800 has-[:checked]:bg-coral-800 has-[:checked]:text-white"
                  : "has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-white",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                className="sr-only"
                {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
                {...(onChange ? { onChange: () => onChange(o.value) } : value !== undefined ? { readOnly: true } : {})}
              />
              <span
                aria-hidden
                className="grid size-[18px] place-items-center rounded-full border-[1.5px] border-current opacity-60 transition-opacity group-has-[:checked]:border-white group-has-[:checked]:bg-white group-has-[:checked]:opacity-100"
              >
                <Check className={cn("size-3 scale-0 transition-transform duration-300 ease-out-back group-has-[:checked]:scale-100", urgent ? "text-coral-800" : "text-forest")} strokeWidth={3.5} />
              </span>
              <span>{o.label}</span>
              {o.hint ? <span className="font-grotesk text-[13px] font-medium opacity-80">{o.hint}</span> : null}
            </label>
          );
        })}
      </div>
    </Fieldset>
  );
}
