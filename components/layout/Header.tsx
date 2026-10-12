"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Search, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/art/Logo";
import { SocialIcon } from "@/components/art/SocialIcons";
import type { SiteChrome } from "@/lib/content/types";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { DONATE_NAV } from "@/lib/nav";
import { routes } from "@/lib/routes";
import { ActiveNavMarker } from "./ActiveNavMarker";
import { MobileMenuCloser } from "./MobileMenuCloser";
import { homeTopClick, NavDropdown } from "./NavDropdown";
import { Ticker } from "./Ticker";
import { SearchOverlay } from "./SearchOverlay";
import { MobileMenu, MOBILE_MENU_ID } from "./MobileMenu";
import { cn } from "@/lib/cn";

/** What the Header reads from getSiteChrome(): contact details, socials, the ticker and the route-based nav. */
export type HeaderChrome = Pick<SiteChrome, "contact" | "ticker" | "nav">;

const TOPBAR_H = 122; // Donat: info bar height; the pill straddles its bottom edge

function InfoColumn({ label, value, href, className }: { label: string; value: string; href?: string; className?: string }) {
  const V = href ? "a" : "p";
  return (
    <div className={cn("flex flex-col justify-center border-l border-line pl-8", className)}>
      <p className="text-[14px] leading-tight text-body">{label}</p>
      <V {...(href ? { href } : {})} className="mt-1 text-[21px] font-semibold leading-tight tracking-[-0.01em] text-ink transition-colors hover:text-forest">
        {value}
      </V>
    </div>
  );
}

function MenuGlyph({ hover }: { hover?: boolean }) {
  return (
    <span aria-hidden className="grid gap-[5px]">
      <span className={cn("h-[2px] w-5 rounded bg-current", hover && "transition-all group-hover:w-3.5")} />
      <span className="h-[2px] w-5 rounded bg-current" />
      <span className={cn("h-[2px] w-3.5 rounded bg-current", hover && "transition-all group-hover:w-5")} />
    </span>
  );
}

/**
 * Donat header (public-pages §5.2–5.3, design-system §4.2): info bar, hanging forest pill, sticky drop
 * and glass mode, the same on every public page. Every link is a real route: the logo and Home go to
 * "/" (on the home page they scroll to the top), the shield to Report a Concern, Donate Now to
 * /donate. Path hooks live only in the two Suspense-wrapped leaves (D4): ActiveNavMarker reports the
 * active item (aria-current + persistent underline) and MobileMenuCloser closes the menu, the search
 * overlay and any open dropdown on every navigation.
 */
export function Header({ chrome }: { chrome: HeaderChrome }) {
  const { contact, nav } = chrome;
  const lenis = useLenis();
  const [stuck, setStuck] = useState(false);
  const [glass, setGlass] = useState(false);
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [route, setRoute] = useState<{ active: string | null; path: string | null }>({ active: null, path: null });
  const [navEpoch, setNavEpoch] = useState(0);
  const markerItems = useMemo(() => [...nav, DONATE_NAV], [nav]);

  const closeSearch = useCallback(() => setSearch(false), []);
  const closeMenu = useCallback(() => setMenu(false), []);
  const openSearch = useCallback(() => {
    setMenu(false);
    setSearch(true);
  }, []);
  const onNavigate = useCallback(() => {
    setMenu(false);
    setSearch(false);
    setNavEpoch((n) => n + 1);
  }, []);
  const onRoute = useCallback((active: string | null, path: string) => setRoute({ active, path }), []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      setStuck(y > TOPBAR_H + 40);
      // VU detail: the nav turns to frosted glass over full-bleed photo sections (and PageHero photo).
      const probe = document.elementsFromPoint(window.innerWidth / 2, 46);
      setGlass(y > TOPBAR_H + 40 && probe.some((el) => (el as HTMLElement).closest?.("[data-nav-theme='glass']")));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const donateActive = route.active === DONATE_NAV.href;
  const goHome = homeTopClick(lenis);

  return (
    <>
      <header id="top" className="relative z-40 bg-white">
        {/* ── Top info bar (Donat) ─────────────────────────────── */}
        <div className="wrap-wide flex h-[84px] items-center justify-between gap-6 xl:h-[92px]">
          <Link href="/" onClick={goHome} aria-label="Haven home" className="shrink-0">
            <Logo className="text-[34px] md:text-[40px]" animated />
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-8 lg:flex">
            <InfoColumn label={`${contact.addressLabel}:`} value={contact.address} className="hidden border-0 pl-0 2xl:flex" />
            <InfoColumn label={`${contact.phoneLabel}:`} value={contact.phone} href={contact.phoneHref} className="border-0 pl-0 2xl:border-l 2xl:pl-8" />
            <InfoColumn label={`${contact.emailLabel}:`} value={contact.email} href={`mailto:${contact.email}`} />
          </div>

          <div className="hidden items-center gap-2.5 xl:flex">
            {contact.socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                aria-label={s.name}
                className="grid size-[46px] place-items-center rounded-full border border-line text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-forest hover:bg-forest hover:text-white"
              >
                <SocialIcon name={s.icon} className="size-[15px]" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 xl:hidden">
            <Link
              href={routes.donate()}
              aria-current={donateActive ? "page" : undefined}
              className="hidden h-11 items-center gap-2 rounded-full bg-marigold px-5 text-sm font-bold text-white sm:flex"
            >
              <Heart aria-hidden className="size-4" fill="currentColor" strokeWidth={0} /> Donate
            </Link>
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menu}
              aria-controls={MOBILE_MENU_ID}
              onClick={() => setMenu(true)}
              className="group grid size-11 place-items-center rounded-full bg-forest text-white"
            >
              <MenuGlyph hover />
            </button>
          </div>
        </div>
        {/* Spacer that the pill hangs over (desktop only) */}
        <div className="hidden h-[30px] xl:block" />

        {/* ── Pill navigation ─────────────────────────────────── */}
        <div
          className={cn(
            "left-0 right-0 z-50 hidden xl:block",
            stuck
              ? cn(
                  "fixed top-0 animate-[nav-drop_0.7s_var(--ease-out-expo)] py-[14px] transition-[background-color,box-shadow] duration-500",
                  glass ? "bg-transparent" : "bg-white shadow-[0_10px_30px_-18px_rgba(6,21,18,0.35)]",
                )
              : "absolute top-[92px]",
          )}
        >
          <nav aria-label="Primary" data-active-nav={route.active ?? undefined} className="wrap-wide flex h-[60px] items-stretch">
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center rounded-full pl-[30px] pr-7 transition-[background-color,border-color] duration-500",
                glass ? "border border-white/25 bg-white/15 backdrop-blur-xl" : "border border-transparent bg-forest",
              )}
            >
              {/* Tighter at 1280–1400px laptops: short labels (About · Programmes · Impact) keep the pill fitting. */}
              <ul className="flex h-full shrink-0 items-center gap-[22px] min-[1400px]:gap-[30px] 2xl:gap-[34px]">
                {nav.map((item) => (
                  <NavDropdown
                    key={item.href}
                    item={item}
                    active={route.active === item.href}
                    pathname={route.path}
                    closeSignal={navEpoch}
                  />
                ))}
              </ul>
              <Ticker messages={chrome.ticker} className="ml-auto hidden max-w-[440px] flex-1 pl-8 2xl:flex" />
            </div>
            <button
              type="button"
              aria-label="Search"
              aria-haspopup="dialog"
              aria-expanded={search}
              onClick={openSearch}
              className="grid aspect-square h-full shrink-0 place-items-center rounded-full bg-marigold text-white transition-transform duration-300 hover:scale-105"
            >
              <Search aria-hidden strokeWidth={2.6} className="size-[22px]" />
            </button>
            <Link
              href={routes.concern()}
              aria-label="Report a concern"
              aria-current={route.path === routes.concern() ? "page" : undefined}
              className="group relative grid aspect-square h-full shrink-0 place-items-center rounded-full bg-forest text-white transition-transform duration-300 hover:scale-105"
            >
              <ShieldAlert aria-hidden strokeWidth={2.4} className="size-[22px]" />
              <span
                aria-hidden
                className="pointer-events-none absolute top-[calc(100%+10px)] whitespace-nowrap rounded-full bg-night px-3 py-1.5 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Report a Concern
              </span>
            </Link>
            <Link
              href={routes.donate()}
              aria-current={donateActive ? "page" : undefined}
              className="group flex h-full w-[176px] shrink-0 items-center justify-center gap-2.5 rounded-full bg-marigold text-[15px] font-extrabold text-white transition-colors duration-300 hover:bg-flame min-[1440px]:w-[200px]"
            >
              <Heart aria-hidden className="size-4 animate-heartbeat" fill="currentColor" strokeWidth={0} />
              Donate Now
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile sticky bar: logo, Donate, menu (public-pages §5.3). QuickExit (z-75) stays above it and the menu. */}
      <nav
        aria-label="Quick links"
        className={cn(
          "fixed inset-x-0 top-0 z-40 bg-white/95 shadow-[0_10px_30px_-18px_rgba(6,21,18,0.35)] backdrop-blur transition-transform duration-500 ease-out-expo xl:hidden",
          stuck ? "translate-y-0" : "-translate-y-full",
        )}
        inert={!stuck}
      >
        <div className="wrap-wide flex h-[68px] items-center justify-between">
          <Link href="/" onClick={goHome} aria-label="Haven home">
            <Logo className="text-[28px]" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={routes.donate()}
              aria-current={donateActive ? "page" : undefined}
              className="flex h-10 items-center gap-2 rounded-full bg-marigold px-4 text-sm font-bold text-white"
            >
              <Heart aria-hidden className="size-4" fill="currentColor" strokeWidth={0} /> Donate
            </Link>
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menu}
              aria-controls={MOBILE_MENU_ID}
              onClick={() => setMenu(true)}
              className="grid size-10 place-items-center rounded-full bg-forest text-white"
            >
              <MenuGlyph />
            </button>
          </div>
        </div>
      </nav>

      <SearchOverlay open={search} onClose={closeSearch} />
      <MobileMenu
        open={menu}
        onClose={closeMenu}
        onSearch={openSearch}
        nav={nav}
        contact={contact}
        active={route.active}
        pathname={route.path}
      />
      <Suspense fallback={null}>
        <MobileMenuCloser onNavigate={onNavigate} />
      </Suspense>
      <Suspense fallback={null}>
        <ActiveNavMarker items={markerItems} onChange={onRoute} />
      </Suspense>
    </>
  );
}
