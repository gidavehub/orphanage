"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = { value: T; label: string; disabled?: boolean };

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  /** Accessible name of the radio group. */
  label: string;
  /** Submits the choice with the form (a hidden input). */
  name?: string;
  /** `md` (default) is 44px for new uses; `sm` is the landing donate card's 40px. */
  size?: "sm" | "md";
  /** `vu`: Inter uppercase (the donate card). `donat`: Nunito title case. */
  skin?: "vu" | "donat";
  /** `admin`: 13px/700 title case (admin-ux §9.2). */
  density?: "default" | "admin";
  id?: string;
  "aria-describedby"?: string;
  className?: string;
};

/**
 * A pill radio group with a sliding white thumb, extracted from the donate card (design-system §3.3).
 * Roving tabindex: Tab enters on the selected option, arrow keys move and select, Home/End jump.
 */
export function Segmented<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  label,
  name,
  size = "md",
  skin = "vu",
  density = "default",
  id,
  "aria-describedby": describedBy,
  className,
}: SegmentedProps<T>) {
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  const idx = Math.max(0, options.findIndex((o) => o.value === current));
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (value === undefined) setInner(o.value);
    onChange?.(o.value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(idx);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = enabled[(pos + 1) % enabled.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (next === undefined || next < 0) return;
    e.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };

  const text =
    density === "admin"
      ? "text-[13px] font-bold"
      : skin === "vu"
        ? "font-grotesk text-[11px] font-medium uppercase tracking-[0.04em] sm:text-[12px]"
        : "text-[14px] font-bold";

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      className={cn("relative grid rounded-full bg-field p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-full bg-white shadow-thumb transition-transform duration-500 ease-out-expo motion-reduce:transition-none"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(calc(${idx} * 100%))`, left: 4 }}
      />
      {options.map((o, i) => {
        const on = i === idx;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => select(i)}
            className={cn(
              "relative z-10 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              size === "md" ? "h-11" : "h-10",
              text,
              on ? "text-ink" : "text-ink/65 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
      {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
    </div>
  );
}
