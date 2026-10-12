import { Check, ShieldAlert } from "lucide-react";
import { Fieldset } from "./Fieldset";
import { IconDisc } from "../IconDisc";
import type { DiscIcon } from "../icon";
import { cn } from "@/lib/cn";

export type RadioCardOption = {
  value: string;
  label: string;
  description?: React.ReactNode;
  /** A programme id, a lucide icon or an element, shown in a 52px IconDisc. */
  icon?: DiscIcon;
  /** `urgent`: the child-protection choice (coral-800 border, ShieldAlert). */
  tone?: "default" | "urgent";
  disabled?: boolean;
  /** A count or note on the right ("3 open"). */
  meta?: React.ReactNode;
};

type Shared = {
  name: string;
  legend: React.ReactNode;
  legendHidden?: boolean;
  hint?: React.ReactNode;
  options: RadioCardOption[];
  /** Mobile is always one column. */
  columns?: 1 | 2 | 3 | 4;
  error?: string;
  /** `sm`: tighter cards for the admin (ChoiceCards). */
  size?: "md" | "sm";
  className?: string;
};

export type RadioCardsProps = Shared & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
};

const cols = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

function Card({
  option,
  input,
  size,
}: {
  option: RadioCardOption;
  input: React.ReactNode;
  size: "md" | "sm";
}) {
  const urgent = option.tone === "urgent";
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-4 rounded-control border-2 bg-white shadow-card transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out-expo",
        size === "md" ? "p-5" : "p-4",
        "hover:-translate-y-0.5 hover:shadow-card-hover has-[:checked]:bg-mint/40",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-[color:var(--focus,var(--color-forest))]",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:disabled]:hover:translate-y-0",
        urgent ? "border-coral-800 has-[:checked]:border-coral-800" : "border-transparent has-[:checked]:border-forest",
      )}
    >
      {input}
      {option.icon || urgent ? (
        <IconDisc icon={urgent && !option.icon ? ShieldAlert : (option.icon as DiscIcon)} size={52} tone={urgent ? "urgent" : "white"} halo={urgent ? "none" : "marigold"} />
      ) : null}
      <span className="min-w-0 flex-1 pr-7">
        <span className={cn("block font-bold leading-snug", size === "md" ? "text-[17px]" : "text-[16px]", urgent ? "text-coral-800" : "text-ink")}>
          {option.label}
        </span>
        {option.description ? <span className="mt-1 block text-[14px] leading-relaxed text-body">{option.description}</span> : null}
        {option.meta ? <span className="mt-2 block font-grotesk text-[13px] text-body">{option.meta}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute right-4 top-4 grid size-6 scale-50 place-items-center rounded-full text-white opacity-0 transition-[transform,opacity] duration-300 ease-out-back group-has-[:checked]:scale-100 group-has-[:checked]:opacity-100",
          urgent ? "bg-coral-800" : "bg-forest",
        )}
      >
        <Check className="size-3.5" strokeWidth={3.5} />
      </span>
    </label>
  );
}

/**
 * Large selectable cards (type of support, cause, donation type, in-kind items; design-system §3.3).
 * A visually hidden native radio inside each card gives keyboard support for free.
 * `ChoiceCards` is the same component under admin-ux's name (D120).
 */
export function RadioCards({ name, legend, legendHidden, hint, options, columns = 2, error, size = "md", value, defaultValue, onChange, required, className }: RadioCardsProps) {
  return (
    <Fieldset legend={legend} legendHidden={legendHidden} hint={hint} name={name} error={error} size="sm" className={className}>
      <div className={cn("grid gap-3", cols[columns])}>
        {options.map((o) => (
          <Card
            key={o.value}
            option={o}
            size={size}
            input={
              <input
                type="radio"
                name={name}
                value={o.value}
                disabled={o.disabled}
                required={required}
                {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
                {...(onChange ? { onChange: () => onChange(o.value) } : value !== undefined ? { readOnly: true } : {})}
                className="sr-only"
              />
            }
          />
        ))}
      </div>
    </Fieldset>
  );
}
