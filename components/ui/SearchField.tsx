"use client";

import Form from "next/form";
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type SearchFieldProps = {
  name?: string;
  /** Accessible label (visually hidden unless `showLabel`). */
  label: string;
  showLabel?: boolean;
  placeholder?: string;
  defaultValue?: string;
  /** Controlled value. */
  value?: string;
  /** Called 250ms after typing pauses (and immediately on clear or Enter). */
  onSearch?: (q: string) => void;
  /** Debounce in ms (default 250). */
  debounce?: number;
  /** A GET form target (e.g. "/search"): Enter submits through next/form (client navigation, works without JavaScript). */
  action?: string;
  size?: "md" | "lg";
  /** `dark` for deep/night overlays (SearchOverlay). */
  surface?: "light" | "dark";
  autoFocus?: boolean;
  id?: string;
  className?: string;
};

/** A pill search input with a leading Search icon and a clear button (design-system §3.6). */
export function SearchField({
  name = "q",
  label,
  showLabel,
  placeholder,
  defaultValue = "",
  value,
  onSearch,
  debounce = 250,
  action,
  size = "md",
  surface = "light",
  autoFocus,
  id,
  className,
}: SearchFieldProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-search`;
  const [inner, setInner] = useState(defaultValue);
  const q = value ?? inner;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const dark = surface === "dark";

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (next: string, now = false) => {
    if (value === undefined) setInner(next);
    clearTimeout(timer.current);
    if (!onSearch) return;
    if (now) onSearch(next.trim());
    else timer.current = setTimeout(() => onSearch(next.trim()), debounce);
  };

  const field = (
    <div className={cn("relative", className)}>
      <label htmlFor={inputId} className={showLabel ? cn("mb-2 block text-[15px] font-bold", dark ? "text-white" : "text-ink") : "sr-only"}>
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className={cn("pointer-events-none absolute left-5 top-1/2 size-[18px] -translate-y-1/2", dark ? "text-white/80" : "text-body")}
          strokeWidth={2.25}
        />
        <input
          ref={input}
          id={inputId}
          name={name}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          placeholder={placeholder}
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !action) {
              e.preventDefault();
              update(q, true);
            }
            if (e.key === "Escape" && q) {
              e.preventDefault();
              update("", true);
            }
          }}
          className={cn(
            "w-full rounded-full pl-12 pr-12 text-[16px] transition-[border-color,box-shadow,background-color] duration-300 [&::-webkit-search-cancel-button]:appearance-none",
            size === "lg" ? "h-[60px]" : "h-[52px]",
            dark
              ? "bg-white/15 text-white ring-1 ring-white/30 placeholder:text-white/80 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
              : "border-[1.5px] border-edge bg-white text-ink placeholder:text-body hover:border-ink/60 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15",
          )}
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              update("", true);
              input.current?.focus();
            }}
            className={cn(
              "absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full transition-colors",
              dark ? "text-white hover:bg-white/15" : "text-ink hover:bg-ink/[0.06]",
            )}
          >
            <X aria-hidden className="size-4" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>
  );

  return action ? (
    <Form role="search" action={action} onSubmit={() => clearTimeout(timer.current)}>
      {field}
    </Form>
  ) : (
    <div role="search">{field}</div>
  );
}
