"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Brush } from "@/components/art/Brush";
import { Button } from "@/components/ui/Button";
import { IconDisc } from "@/components/ui/IconDisc";
import { isProgrammeId } from "@/lib/model/enums";
import { isCurrentHref, type NavFeature, type NavItem, type NavLink } from "@/lib/nav";
import { cn } from "@/lib/cn";

type Mega = NonNullable<NavItem["mega"]>;

const featureTone: Record<NavFeature["tone"], string> = {
  forest: "bg-forest",
  deep: "bg-deep",
  clay: "bg-clay-700",
};

/** The stagger every row shares: 300ms open, rows 60ms + i×35ms (design-system §4.2). */
function rise(open: boolean, i: number) {
  return {
    className: cn("transition-[opacity,transform] duration-500 ease-out-expo", open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"),
    style: { transitionDelay: open ? `${60 + i * 35}ms` : "0ms" },
  };
}

function ProgrammeRow({ link, current, open, onNavigate }: { link: NavLink; current: boolean; open: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={link.href}
      prefetch={open ? null : false}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3.5 rounded-2xl p-3 transition-colors duration-300 hover:bg-cream focus-forest",
        current && "bg-cream",
      )}
    >
      {link.icon && isProgrammeId(link.icon) ? <IconDisc icon={link.icon} size={52} /> : null}
      <span className="min-w-0">
        <span className={cn("block text-[15px] font-extrabold transition-colors group-hover:text-forest", current ? "text-forest" : "text-ink")}>
          {link.label}
        </span>
        {link.description ? <span className="block text-[13px] leading-snug text-body">{link.description}</span> : null}
      </span>
    </Link>
  );
}

function FeatureCard({ feature, open, onNavigate }: { feature: NavFeature; open: boolean; onNavigate: () => void }) {
  return (
    <div
      className={cn(
        "relative isolate flex w-[260px] shrink-0 flex-col overflow-hidden rounded-card p-6 text-white transition-[opacity,transform] duration-700 ease-out-expo",
        featureTone[feature.tone],
        open ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0",
      )}
      style={{ transitionDelay: open ? "120ms" : "0ms" }}
    >
      <Brush name="drip" color="var(--color-marigold)" className="absolute -right-9 -top-12 -z-10 w-[118px] opacity-90" rotate={12} />
      <Brush name="splash" color="var(--color-white)" className="absolute -bottom-16 -left-14 -z-10 w-[170px] opacity-[0.06]" />
      <p className="font-script text-[26px] font-bold leading-none text-marigold">{feature.eyebrow}</p>
      <p className="mt-3 text-[20px] font-extrabold leading-tight">{feature.title}</p>
      <p className="mt-2.5 text-[14px] leading-relaxed text-white/80">{feature.text}</p>
      <div className="mt-auto pt-5">
        <Button href={feature.cta.href} variant="marigold-ink" size="sm" icon="arrow" onClick={onNavigate} className="w-full">
          {feature.cta.label}
        </Button>
      </div>
    </div>
  );
}

/**
 * The Programmes mega panel (PLAN D126: the only mega panel; design-system §4.2 styling). The six
 * programmes keep today's 2×3 icon grid with the halo discs; a 260px feature card on the right points
 * people who are unsure to Request Support; the bottom row holds "All programmes →" and the urgent
 * Report a Concern pill (public-pages §5.2).
 */
export function MegaPanel({
  id,
  mega,
  open,
  pathname,
  onNavigate,
}: {
  id: string;
  mega: Mega;
  open: boolean;
  pathname: string | null;
  onNavigate: () => void;
}) {
  let row = 0;
  return (
    <div
      id={id}
      className={cn(
        "absolute -left-10 top-[calc(100%+14px)] z-50 transition-[opacity,transform,visibility] duration-300 ease-out-expo",
        open ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0",
      )}
    >
      {/* Hover bridge over the gap between the pill and the panel. */}
      <span aria-hidden className="absolute inset-x-0 -top-[14px] h-[14px]" />
      <span aria-hidden className="absolute -top-2 left-[88px] size-4 rotate-45 rounded-sm bg-white" />
      <div className="relative flex w-[880px] gap-4 rounded-3xl bg-white p-4 shadow-float">
        <div className="flex min-w-0 flex-1 flex-col">
          {mega.columns.map((col, c) => (
            <div key={col.title ?? c}>
              {col.title ? (
                <p className="px-3 pb-1.5 pt-1 font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-body">{col.title}</p>
              ) : null}
              <ul className="grid grid-cols-2 gap-1.5">
                {col.links.map((link) => {
                  const r = rise(open, row++);
                  return (
                    <li key={link.href} className={r.className} style={r.style}>
                      <ProgrammeRow link={link} current={isCurrentHref(link.href, pathname)} open={open} onNavigate={onNavigate} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {mega.footer ? (
            <div
              className={cn("mx-3 mt-auto flex items-center justify-between gap-4 border-t border-line pt-3.5", rise(open, row).className)}
              style={rise(open, row).style}
            >
              <Link
                href={mega.footer.link.href}
                prefetch={open ? null : false}
                onClick={onNavigate}
                aria-current={isCurrentHref(mega.footer.link.href, pathname) ? "page" : undefined}
                className="group inline-flex min-h-11 items-center gap-2 text-[15px] font-extrabold text-forest transition-colors hover:text-ink focus-forest"
              >
                {mega.footer.link.label}
                <ArrowRight aria-hidden strokeWidth={2.75} className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              {mega.footer.actions?.length ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {mega.footer.actions.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      prefetch={open ? null : false}
                      onClick={onNavigate}
                      className={cn(
                        "inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-bold transition-colors duration-300 focus-forest",
                        a.urgent
                          ? "border-[1.5px] border-coral-800 text-coral-800 hover:bg-coral-800 hover:text-white"
                          : "border border-ink/80 text-ink hover:border-forest hover:bg-forest hover:text-white",
                      )}
                    >
                      {a.icon === "shield" ? <ShieldAlert aria-hidden strokeWidth={2.4} className="size-4" /> : null}
                      {a.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {mega.feature ? <FeatureCard feature={mega.feature} open={open} onNavigate={onNavigate} /> : null}
      </div>
    </div>
  );
}
