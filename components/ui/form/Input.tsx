import { controlClass, type ControlStyle } from "./styles";
import { cn } from "@/lib/cn";

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  ControlStyle & {
    /** An icon or currency code inside the field, before the text ("GMD ▸ ____"). */
    leading?: React.ReactNode;
    /** A unit or button inside the field, after the text. */
    trailing?: React.ReactNode;
    ref?: React.Ref<HTMLInputElement>;
  };

/**
 * Single-line input (design-system §3.3): 16px text so iOS never zooms, visible label from Field.
 * Always pass the right `type`, `inputMode` and `autoComplete`.
 */
export function Input({ skin, density, surface, invalid, leading, trailing, className, ref, ...rest }: InputProps) {
  const style = { skin, density, surface, invalid };
  const ariaInvalid = rest["aria-invalid"] ?? (invalid || undefined);
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(controlClass(style), className)} {...rest} aria-invalid={ariaInvalid} />;
  }
  return (
    <div
      className={cn(
        controlClass(style),
        "flex items-center gap-2.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70",
        className,
      )}
    >
      {leading ? <span className="flex shrink-0 items-center text-body">{leading}</span> : null}
      <input
        ref={ref}
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit placeholder:text-inherit placeholder:opacity-70 focus:outline-none focus-visible:outline-none"
        {...rest}
        aria-invalid={ariaInvalid}
      />
      {trailing ? <span className="flex shrink-0 items-center text-body">{trailing}</span> : null}
    </div>
  );
}

