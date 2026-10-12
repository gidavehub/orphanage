import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  /** Donat draws a rule on both sides when centred, one trailing rule when left-aligned. */
  lines?: "both" | "right" | "none";
  /**
   * `brand` (default) is the landing's marigold script, fine on dark and photo surfaces (9.8:1 on night).
   * `ink` keeps the marigold rules but sets the words in marigold-ink, for light surfaces (AA, design-system §2.2).
   */
  tone?: "brand" | "ink";
  className?: string;
};

export function Eyebrow({ children, lines = "both", tone = "brand", className }: Props) {
  const rule = <span aria-hidden className="h-[2px] w-[50px] shrink-0 bg-marigold md:w-[60px]" data-eyebrow-rule />;
  return (
    <p
      className={cn(
        "flex items-center gap-3 font-script text-[22px] font-bold leading-none md:text-[26px]",
        tone === "ink" ? "text-marigold-ink" : "text-marigold",
        lines === "both" && "justify-center",
        className,
      )}
    >
      {lines === "both" && rule}
      <span className="-translate-y-[2px]">{children}</span>
      {lines !== "none" && rule}
    </p>
  );
}
