"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { isCurrentHref, type NavItem } from "@/lib/nav";
import { MegaPanel } from "./MegaPanel";
import { cn } from "@/lib/cn";

/**
 * On the home page, "Home" and the logo scroll back to the top (through Lenis) instead of reloading
 * the route (public-pages §5.2–5.4). Everywhere else they are plain links to "/".
 */
export function homeTopClick(lenis: ReturnType<typeof useLenis>) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.location.pathname !== "/") return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (lenis) lenis.scrollTo(0, { duration: 1.4, immediate: reduce });
    else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    if (window.location.hash) window.history.replaceState(window.history.state, "", "/");
  };
}

/** A fixed-size 2px bar that shimmers while the link's destination is loading (design-system §4.2). */
function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-3 left-0 h-[2px] w-full bg-white/80 transition-opacity duration-200",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
}

/** The label: the full text from 1400px, the short one (About · Programmes · Impact) below. */
function Label({ item }: { item: NavItem }) {
  if (!item.short) return <>{item.label}</>;
  return (
    <>
      <span className="min-[1400px]:hidden">{item.short}</span>
      <span className="hidden min-[1400px]:inline">{item.label}</span>
    </>
  );
}

function topLinkClass(active: boolean) {
  return cn(
    "relative flex h-full items-center whitespace-nowrap text-[16px] font-semibold text-white transition-colors duration-300 hover:text-marigold",
    "after:absolute after:bottom-3 after:left-0 after:h-[2px] after:w-full after:bg-marigold after:transition-transform after:duration-500 after:ease-out-expo",
    // The active item keeps white text and a persistent underline (marigold text on forest is 3.09:1).
    active ? "after:origin-left after:scale-x-100 hover:text-white" : "after:origin-right after:scale-x-0 hover:after:origin-left hover:after:scale-x-100",
  );
}

export type NavDropdownProps = {
  item: NavItem;
  /** This item owns the current route: aria-current="page" and the persistent underline (D4). */
  active: boolean;
  /** The current pathname (from ActiveNavMarker), to mark the exact row inside the menu. */
  pathname: string | null;
  /** Changes on every navigation: an open menu closes (back/forward included). */
  closeSignal: number;
  className?: string;
};

/**
 * A top-level pill item (public-pages §5.2). The label is a real `Link`; items with a menu get a
 * separate chevron `<button aria-expanded aria-controls>`. Hover opens the menu for mouse users;
 * keyboard users Tab to the chevron and press Enter or Space. Esc closes it and returns focus to the
 * chevron, and focus leaving the item closes it. Only Programmes renders the mega panel (D126).
 */
export function NavDropdown({ item, active, pathname, closeSignal, className }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLLIElement>(null);
  const chevron = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const lenis = useLenis();
  const hasMenu = !!(item.children?.length || item.mega);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 140);
  };
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  // Close on every navigation, including back and forward (the Header bumps closeSignal).
  const [lastSignal, setLastSignal] = useState(closeSignal);
  if (lastSignal !== closeSignal) {
    setLastSignal(closeSignal);
    setOpen(false);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLLIElement>) => {
    if (e.key !== "Escape" || !open) return;
    e.preventDefault();
    close();
    chevron.current?.focus();
  };

  const onBlur = (e: React.FocusEvent<HTMLLIElement>) => {
    if (open && !wrap.current?.contains(e.relatedTarget as Node | null)) close();
  };

  const label = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={item.homeAnchor ? homeTopClick(lenis) : close}
      className={topLinkClass(active)}
    >
      <Label item={item} />
      <PendingHint />
    </Link>
  );

  if (!hasMenu) {
    return <li className={cn("flex h-full items-center", className)}>{label}</li>;
  }

  return (
    <li
      ref={wrap}
      className={cn("relative flex h-full items-center", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      {label}
      <button
        ref={chevron}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Show ${item.label} menu`}
        onClick={() => (open ? close() : show())}
        className="grid h-full w-6 place-items-center text-white transition-colors duration-300 hover:text-marigold"
      >
        <ChevronDown aria-hidden strokeWidth={3} className={cn("size-[15px] transition-transform duration-300", open && "rotate-180")} />
      </button>

      {item.mega ? (
        <MegaPanel id={menuId} mega={item.mega} open={open} pathname={pathname} onNavigate={close} />
      ) : (
        <div
          id={menuId}
          className={cn(
            "absolute left-1/2 top-[calc(100%+14px)] z-50 -translate-x-1/2 transition-[opacity,transform,visibility] duration-300 ease-out-expo",
            open ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0",
          )}
        >
          <span aria-hidden className="absolute inset-x-0 -top-[14px] h-[14px]" />
          <span aria-hidden className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 rounded-sm bg-white" />
          <ul className="relative w-[260px] rounded-3xl bg-white p-3 shadow-float">
            {(item.children ?? []).map((c, i) => {
              const current = isCurrentHref(c.href, pathname);
              return (
                <li
                  key={c.href}
                  className={cn("transition-[opacity,transform] duration-500 ease-out-expo", open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}
                  style={{ transitionDelay: open ? `${50 + i * 40}ms` : "0ms" }}
                >
                  <Link
                    href={c.href}
                    prefetch={open ? null : false}
                    onClick={close}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "group flex min-h-11 items-center rounded-xl px-4 py-2.5 text-[15px] font-bold transition-all duration-300 hover:bg-cream focus-forest",
                      c.urgent ? "gap-2.5 text-coral-800" : cn("gap-0 hover:gap-2.5 hover:text-forest", current ? "gap-2.5 bg-cream text-forest" : "text-ink"),
                    )}
                  >
                    {c.urgent ? (
                      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-coral-100 text-coral-800">
                        <ShieldAlert strokeWidth={2.4} className="size-[15px]" />
                      </span>
                    ) : (
                      <span aria-hidden className={cn("h-[2px] bg-marigold transition-all duration-300 group-hover:w-3.5", current ? "w-3.5" : "w-0")} />
                    )}
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}
