"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  /** URL-driven tabs (resource categories, admin queues): every tab a link with aria-current. */
  href?: string;
};

export type TabsProps = {
  tabs: TabItem[];
  /** Selected tab id (controlled). */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** `underline` (default): Nunito 16/700 with the nav's sliding marigold bar. `pill`: the Segmented look. */
  variant?: "underline" | "pill";
  /** Accessible name of the tab list. */
  label: string;
  /** Panels by tab id; rendered as WAI-ARIA tabpanels. Omit when the page renders content itself. */
  panels?: Record<string, React.ReactNode>;
  className?: string;
};

/**
 * Tabs (design-system §3.6). Button tabs follow the WAI-ARIA tabs pattern (arrow keys, Home/End,
 * roving tabindex, automatic activation). When tabs carry `href`, they render as links with
 * aria-current="page" instead of tab roles, so the state lives in the URL.
 */
export function Tabs({ tabs, value, defaultValue, onChange, variant = "underline", label, panels, className }: TabsProps) {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id);
  const current = value ?? inner;
  const linkMode = tabs.length > 0 && tabs.every((t) => t.href);
  const listRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onChange?.(id);
  };

  // Slide the single underline indicator under the active tab (500ms ease-out-expo).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || variant !== "underline") return;
    const measure = () => {
      const el = list.querySelector<HTMLElement>(`[data-tab="${CSS.escape(current ?? "")}"]`);
      setBar(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [current, variant, tabs.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (linkMode) return;
    const i = tabs.findIndex((t) => t.id === current);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    select(tabs[n].id);
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(tabs[n].id)}"]`)?.focus();
  };

  const pill = variant === "pill";
  const tabClass = (on: boolean) =>
    cn(
      "relative z-10 inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-colors duration-300",
      pill
        ? cn("h-11 rounded-full px-5 text-[14px] font-bold", on ? "bg-white text-ink shadow-thumb" : "text-ink/70 hover:text-ink")
        : cn("h-12 px-1 text-[16px] font-bold", on ? "text-ink" : "text-body hover:text-ink"),
    );
  const count = (t: TabItem, on: boolean) =>
    t.count === undefined ? null : (
      <span
        className={cn(
          "inline-grid h-6 min-w-6 place-items-center rounded-full px-2 font-grotesk text-[12px] font-semibold tabular-nums leading-none",
          on ? "bg-marigold text-night" : "bg-pebble text-body",
        )}
      >
        {t.count}
        <span className="sr-only"> items</span>
      </span>
    );

  return (
    <div className={className}>
      <div className={cn("relative -mx-1 overflow-x-auto px-1 scrollbar-none", !pill && "scroll-fade-x sm:[mask-image:none]")}>
        <div
          ref={listRef}
          role={linkMode ? undefined : "tablist"}
          aria-label={linkMode ? undefined : label}
          onKeyDown={onKeyDown}
          className={cn("relative flex", pill ? "w-fit gap-1 rounded-full bg-field p-1" : "w-max min-w-full gap-7 border-b border-line")}
        >
          {linkMode ? (
            <nav aria-label={label} className={cn("flex", pill ? "gap-1" : "gap-7")}>
              {tabs.map((t) => {
                const on = t.id === current;
                return (
                  <Link key={t.id} href={t.href as string} data-tab={t.id} aria-current={on ? "page" : undefined} className={tabClass(on)}>
                    {t.label}
                    {count(t, on)}
                  </Link>
                );
              })}
            </nav>
          ) : (
            tabs.map((t) => {
              const on = t.id === current;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${t.id}`}
                  data-tab={t.id}
                  aria-selected={on}
                  aria-controls={panels ? `${base}-panel-${t.id}` : undefined}
                  tabIndex={on ? 0 : -1}
                  onClick={() => select(t.id)}
                  className={tabClass(on)}
                >
                  {t.label}
                  {count(t, on)}
                </button>
              );
            })
          )}
          {!pill && bar ? (
            <span
              aria-hidden
              className="absolute -bottom-px left-0 h-[2px] rounded-full bg-marigold transition-[transform,width] duration-500 ease-out-expo motion-reduce:transition-none"
              style={{ width: bar.width, transform: `translateX(${bar.left}px)` }}
            />
          ) : null}
        </div>
      </div>
      {panels && !linkMode
        ? tabs.map((t) => (
            <div
              key={t.id}
              role="tabpanel"
              id={`${base}-panel-${t.id}`}
              aria-labelledby={`${base}-tab-${t.id}`}
              hidden={t.id !== current}
              tabIndex={0}
              className="pt-6 focus-visible:outline-offset-4"
            >
              {panels[t.id]}
            </div>
          ))
        : null}
    </div>
  );
}
