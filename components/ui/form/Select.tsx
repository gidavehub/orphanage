import { controlClass, type ControlStyle } from "./styles";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectGroup = { label: string; options: SelectOption[] };

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> &
  ControlStyle & {
    options?: SelectOption[];
    groups?: SelectGroup[];
    /** A first, empty choice ("Choose one"). It is disabled so it cannot be re-chosen once a value is set. */
    placeholder?: string;
    /** Inside the field, before the text (a flag in CountrySelect). */
    leading?: React.ReactNode;
    ref?: React.Ref<HTMLSelectElement>;
  };

/** Always a native `<select>` (mobile pickers, accessibility) with the Donate chevron (design-system §3.3). */
export function Select({ skin, density, surface, invalid, options, groups, placeholder, leading, className, children, ref, ...rest }: SelectProps) {
  const style = { skin, density, surface, invalid };
  const select = (
    <select
      ref={ref}
      className={cn(
        controlClass(style, "select"),
        surface === "dark" ? "select-chevron-light" : "select-chevron",
        "min-w-0 cursor-pointer truncate pr-12 [&>option]:text-ink",
        leading ? "pl-14" : undefined,
        className,
      )}
      {...rest}
      aria-invalid={rest["aria-invalid"] ?? (invalid || undefined)}
    >
      {placeholder !== undefined ? (
        <option value="" disabled={rest.required}>
          {placeholder}
        </option>
      ) : null}
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
      {groups?.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
      {children}
    </select>
  );
  if (!leading) return select;
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center">
        {leading}
      </span>
      {select}
    </div>
  );
}
