import { controlClass, type ControlStyle } from "./styles";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  ControlStyle & {
    ref?: React.Ref<HTMLTextAreaElement>;
  };

/**
 * Multi-line text that grows with its content up to about 12 lines (`field-sizing: content`, with
 * `rows` as the fallback). Pair with Field's `counter` for a live character count.
 */
export function Textarea({ skin, density, surface, invalid, rows = 5, className, ref, ...rest }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlClass({ skin, density, surface, invalid }, "textarea"), "block resize-y leading-relaxed field-sizing-content max-h-[calc(12lh+2rem)]", className)}
      {...rest}
      aria-invalid={rest["aria-invalid"] ?? (invalid || undefined)}
    />
  );
}
