import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export type ImageCreditProps = {
  label?: string;
  /** Corner of the positioned parent; `static` flows inline (captions, admin rows). */
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right" | "static";
  className?: string;
};

const positions = {
  "bottom-left": "absolute bottom-3 left-3",
  "bottom-right": "absolute bottom-3 right-3",
  "top-left": "absolute left-3 top-3",
  "top-right": "absolute right-3 top-3",
  static: "",
} as const;

/**
 * "Illustrative image" chip over any AI image with people visible (D54: `UiImage.illustrative`), so
 * nobody mistakes an AI-generated child for a real beneficiary. Every card, hero and Block image
 * renders it when its image is illustrative, except the landing hero.
 */
export function ImageCredit({ label = "Illustrative image", position = "bottom-left", className }: ImageCreditProps) {
  return (
    <span
      className={cn(
        "pointer-events-none z-[2] inline-flex items-center gap-1 rounded-full bg-night/75 px-2.5 py-1 font-grotesk text-[11px] font-medium leading-none text-white backdrop-blur-sm",
        positions[position],
        className,
      )}
    >
      <Sparkles aria-hidden className="size-3 text-marigold" strokeWidth={2.25} />
      {label}
    </span>
  );
}
