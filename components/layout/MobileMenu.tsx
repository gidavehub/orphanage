"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, Mail, MapPin, Phone, Search, ShieldAlert, X } from "lucide-react";
import { Logo } from "@/components/art/Logo";
import { ProgrammeIcon } from "@/components/art/ProgrammeIcons";
import { SocialIcon } from "@/components/art/SocialIcons";
import { Button } from "@/components/ui/Button";
import type { SiteChrome } from "@/lib/content/types";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { isProgrammeId } from "@/lib/model/enums";
import { isCurrentHref, type NavItem, type NavLink } from "@/lib/nav";
import { routes } from "@/lib/routes";
import { homeTopClick } from "./NavDropdown";
import { cn } from "@/lib/cn";

/** The panel's id, for the menu buttons' aria-controls. */
export const MOBILE_MENU_ID = "site-menu";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  /** Opens the search overlay (the menu closes first). */
  onSearch: () => void;
  nav: NavItem[];
  contact: SiteChrome["contact"];
  /** The active top-level href and the pathname, from ActiveNavMarker (D4). */
  active: string | null;
  pathname: string | null;
};

/** Mega columns flatten into the accordion (design-system §4.2); plain dropdowns use their children. */
function groupsOf(item: NavItem): Array<{ title?: string; links: NavLink[] }> {
  if (item.mega) return item.mega.columns;
  return item.children?.length ? [{ links: item.children }] : [];
}

/**
 * The phone and tablet menu (public-pages §5.3, design-system §4.2): a right-hand deep panel from the
 * same nav config as the pill. "Need help now?" sits at the very top for vulnerable visitors. Each
 * row has two targets: the label (navigates and closes) and a 44px chevron that opens its links. The
 * current route gets a marigold left bar and aria-current. Esc, the close button and the backdrop
 * close it and focus returns to the button that opened it; every navigation closes it too
 * (MobileMenuCloser). It is not a native modal on purpose: QuickExit (z-75) must stay reachable above
 * it (z-70).
 */
export function MobileMenu({ open, onClose, onSearch, nav, contact, active, pathname }: MobileMenuProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const lenis = useLenis();
  const toTop = homeTopClick(lenis);
  const goHome = (e: React.MouseEvent<HTMLAnchorElement>) => {
    toTop(e);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    lenis?.stop();
    const t = window.setTimeout(() => closeBtn.current?.focus({ preventScroll: true }), 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null && !el.closest("[inert]"));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!panel.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      lenis?.start();
      if (opener?.isConnected && opener.offsetParent !== null) opener.focus({ preventScroll: true });
    };
  }, [open, onClose, lenis]);

  // Collapse the open group whenever the menu closes, so it reopens tidy.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setExpanded(null);
  }

  return (
    <div
      className={cn("fixed inset-0 z-[70] transition-[visibility] duration-500 xl:hidden", open ? "visible" : "invisible")}
      inert={!open}
    >
      <div
        aria-hidden
        onClick={onClose}
        className={cn("absolute inset-0 bg-night/60 backdrop-blur-sm transition-opacity duration-500", open ? "opacity-100" : "opacity-0")}
      />
      <div
        ref={panel}
        id={MOBILE_MENU_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-lenis-prevent
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col overflow-y-auto overscroll-contain bg-deep text-white transition-transform duration-700 ease-out-expo",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-deep px-5 py-4">
          <Link href="/" prefetch={open ? null : false} onClick={goHome} aria-label="Haven home">
            <Logo tone="light" className="text-[30px]" />
          </Link>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-11 place-items-center rounded-full bg-marigold text-night transition-transform duration-500 hover:rotate-90"
          >
            <X aria-hidden strokeWidth={2.5} className="size-5" />
          </button>
        </div>

        <div className="flex-1 px-5 pb-10 pt-5">
          {/* Need help now? First, for anyone on a phone who is worried about a child. */}
          <section aria-labelledby="menu-help-title" className="rounded-[22px] bg-white/[0.06] p-4 ring-1 ring-white/10">
            <p id="menu-help-title" className="font-script text-[26px] font-bold leading-none text-marigold">
              Need help now?
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <Button href={routes.request()} variant="marigold-ink" size="sm" icon="none" onClick={onClose} className="px-3">
                Request Support
              </Button>
              <Button href={routes.concern()} variant="outline-light" size="sm" icon="none" onClick={onClose} className="px-3">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert aria-hidden className="size-4" /> Report a Concern
                </span>
              </Button>
            </div>
          </section>

          <button
            type="button"
            onClick={onSearch}
            aria-haspopup="dialog"
            className="mt-4 flex h-12 w-full items-center gap-3 rounded-full bg-white/10 px-5 text-left text-[16px] text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Search aria-hidden className="size-[18px] text-marigold" strokeWidth={2.5} />
            Search programmes and help
          </button>

          <nav aria-label="Mobile" className="mt-3">
            <ul>
              {nav.map((item, i) => {
                const groups = groupsOf(item);
                const isOpen = expanded === item.href;
                const isActive = active === item.href;
                const panelId = `menu-group-${i}`;
                return (
                  <li
                    key={item.href}
                    className={cn("border-b border-white/10 transition-all duration-700 ease-out-expo", open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0")}
                    style={{ transitionDelay: open ? `${120 + i * 45}ms` : "0ms" }}
                  >
                    <div className="relative flex items-center">
                      <span
                        aria-hidden
                        className={cn("absolute -left-5 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r bg-marigold transition-opacity", isActive ? "opacity-100" : "opacity-0")}
                      />
                      <Link
                        href={item.href}
                        prefetch={open ? null : false}
                        aria-current={isActive ? "page" : undefined}
                        onClick={item.homeAnchor ? goHome : onClose}
                        className={cn("flex min-h-14 flex-1 items-center py-3 text-lg font-bold transition-colors hover:text-marigold", isActive && "text-marigold")}
                      >
                        {item.label}
                      </Link>
                      {groups.length ? (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          aria-label={`Show ${item.label} links`}
                          onClick={() => setExpanded((e) => (e === item.href ? null : item.href))}
                          className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10"
                        >
                          <ChevronDown aria-hidden className={cn("size-5 transition-transform duration-300", isOpen && "rotate-180 text-marigold")} />
                        </button>
                      ) : null}
                    </div>
                    {groups.length ? (
                      <div
                        id={panelId}
                        inert={!isOpen}
                        className={cn("grid transition-[grid-template-rows] duration-500 ease-out-expo", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
                      >
                        <div className="overflow-hidden">
                          {groups.map((g, gi) => (
                            <div key={g.title ?? gi}>
                              {g.title ? (
                                <p className="pb-1 pl-4 pt-2 font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">{g.title}</p>
                              ) : null}
                              <ul className="pb-3">
                                {g.links.map((c) => {
                                  const current = isCurrentHref(c.href, pathname);
                                  return (
                                    <li key={c.href}>
                                      <Link
                                        href={c.href}
                                        prefetch={open && isOpen ? null : false}
                                        onClick={onClose}
                                        aria-current={current ? "page" : undefined}
                                        className={cn(
                                          "flex min-h-11 items-center gap-3 py-1.5 pl-4 text-[15px] font-semibold transition-colors hover:text-marigold",
                                          current ? "text-marigold" : "text-white/80",
                                        )}
                                      >
                                        {c.icon && isProgrammeId(c.icon) ? (
                                          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-white">
                                            <ProgrammeIcon name={c.icon} className="size-6" />
                                          </span>
                                        ) : c.urgent ? (
                                          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-coral-100 text-coral-800">
                                            <ShieldAlert strokeWidth={2.4} className="size-4" />
                                          </span>
                                        ) : null}
                                        {c.label}
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-6">
            <Button
              href={routes.donate()}
              variant="marigold-ink"
              size="lg"
              icon="heart"
              iconFirst
              onClick={onClose}
              aria-current={active === routes.donate() ? "page" : undefined}
              className="w-full"
            >
              Donate Now
            </Button>
          </div>

          <ul className="mt-8 grid gap-4 text-[15px] text-white/85">
            {contact.offices.map((o) => (
              <li key={o.label} className="flex items-start gap-3">
                <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold" />
                <span>
                  <span className="block text-[13px] text-white/60">{o.label}</span>
                  {o.address}
                  {o.phone && o.phoneHref ? (
                    <a href={o.phoneHref} className="block underline-offset-4 hover:text-marigold hover:underline">
                      {o.phone}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-3">
              <Phone aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold" />
              <a href={contact.phoneHref} className="hover:text-marigold">
                {contact.phone}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold" />
              <a href={`mailto:${contact.email}`} className="[overflow-wrap:anywhere] hover:text-marigold">
                {contact.email}
              </a>
            </li>
            {contact.hours ? (
              <li className="flex items-start gap-3">
                <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold" />
                {contact.hours}
              </li>
            ) : null}
          </ul>
          {contact.socials.length ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {contact.socials.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    aria-label={s.name}
                    className="grid size-11 place-items-center rounded-full border border-white/20 transition-colors hover:border-marigold hover:bg-marigold hover:text-night"
                  >
                    <SocialIcon name={s.icon} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
