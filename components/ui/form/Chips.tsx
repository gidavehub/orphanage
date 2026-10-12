"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChipOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** A count after the label (admin filters). */
  count?: number;
  /** Listing filters: the chip is a link and the filter lives in the URL (design-system §3.3). */
  href?: string;
};

type Base = {
  options: ChipOption[];
  /** Accessible name of the group. */
  label: string;
  /**
   * `clay`: the Appeals filter pills (active clay, white chips with a soft shadow).
   * `coral`: the donate card's in-kind chips (coral-800 text and a check when on).
   * `forest`: admin filters (active forest/white).
   */
  tone?: "clay" | "coral" | "forest";
  /** `sm` is the landing's 40px; `md` (default) is 44px. */
  size?: "sm" | "md";
  /** One scrolling row on phones (with an edge fade) instead of wrapping. */
  scroll?: boolean;
  /** Submits the selection with the form (hidden inputs). */
  name?: string;
  align?: "start" | "center";
  className?: string;
};

export type ChipsProps =
  | (Base & { multiple?: false; value?: string; defaultValue?: string; onChange?: (value: string) => void })
  | (Base & { multiple: true; value?: string[]; defaultValue?: string[]; onChange?: (value: string[]) => void });

const toneClass = {
  clay: {
    base: "font-bold",
    on: "bg-clay text-white",
    off: "bg-white text-ink shadow-chip hover:bg-sand",
  },
  coral: {
    base: "border font-grotesk",
    on: "border-coral bg-coral/10 text-coral-800",
    off: "border-mist bg-white text-ink hover:border-coral/50",
  },
  forest: {
    base: "border font-bold",
    on: "border-forest bg-forest text-white",
    off: "border-line bg-white text-ink hover:border-forest hover:text-forest",
  },
} as const;

/**
 * Pill toggles for filters and multi-choices (design-system §3.3; merges FilterPills, CheckboxPills
 * and FilterChips, D120). Buttons carry aria-pressed; link chips carry aria-current="page".
 */
export function Chips(props: ChipsProps) {
  const { options, label, tone = "clay", size = "md", scroll, name, align = "start", className } = props;
  const [inner, setInner] = useState<string[]>(() => {
    const d = props.defaultValue;
    return d === undefined ? (props.multiple ? [] : options[0] ? [options[0].value] : []) : Array.isArray(d) ? d : [d];
  });
  const controlled = props.value !== undefined;
  const selected: string[] = controlled ? (Array.isArray(props.value) ? props.value : [props.value as string]) : inner;
  const t = toneClass[tone];

  const toggle = (v: string) => {
    let next: string[];
    if (props.multiple) next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    else next = [v];
    if (!controlled) setInner(next);
    if (props.multiple) props.onChange?.(next);
    else props.onChange?.(v);
  };

  const chipClass = (on: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full transition-colors duration-300",
      tone === "coral" ? (size === "sm" ? "px-3.5 py-2 text-[12.5px]" : "h-11 px-4 text-[14px]") : size === "sm" ? "h-10 px-5 text-[14px]" : "h-11 px-5 text-[14px]",
      t.base,
      on ? t.on : t.off,
    );

  const content = (o: ChipOption, on: boolean) => (
    <>
      {tone === "coral" && on ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
      {o.icon}
      {o.label}
      {o.count !== undefined ? (
        <span className={cn("font-grotesk text-[12px] font-semibold tabular-nums", on ? undefined : "text-body")}>{o.count}</span>
      ) : null}
    </>
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex gap-2",
        scroll ? "-mx-4 flex-nowrap overflow-x-auto px-4 pb-1 scrollbar-none scroll-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]" : "flex-wrap",
        align === "center" && "justify-center",
        className,
      )}
    >
      {options.map((o) => {
        const on = selected.includes(o.value);
        return o.href ? (
          <Link key={o.value} href={o.href} scroll={false} aria-current={on ? "page" : undefined} className={chipClass(on)}>
            {content(o, on)}
          </Link>
        ) : (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => toggle(o.value)} className={chipClass(on)}>
            {content(o, on)}
          </button>
        );
      })}
      {name ? selected.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
    </div>
  );
}
