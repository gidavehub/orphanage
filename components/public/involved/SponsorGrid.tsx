"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { HeartHandshake, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { IconDisc } from "@/components/ui/IconDisc";
import { Chips } from "@/components/ui/form/Chips";
import { QueryPrefill } from "@/components/public/help/QueryPrefill";
import { countryName } from "@/lib/countries";
import { fromMinor, formatMoney } from "@/lib/money";
import type { SponsorProfilePublic } from "@/lib/model/dto";
import type { AgeBand, SupportCategory } from "@/lib/model/enums";
import { SUPPORT_CATEGORY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

const PERIOD_LABEL: Record<SponsorProfilePublic["period"], string> = {
  per_month: "/ month",
  per_term: "/ term",
  per_year: "/ year",
  one_off: "once",
};

/** "10–14" for the big Anton numeral; "Age not shared" when unknown. */
function ageNumeral(a: AgeBand): string {
  if (a === "unknown") return "—";
  return a.replace("-", "–");
}

const TONES = ["bg-forest", "bg-clay", "bg-cocoa", "bg-umber"] as const;

export type SponsorGridProps = {
  profiles: SponsorProfilePublic[];
  emptyText: string;
  emptyCta: { label: string; href: string };
};

/**
 * The sponsorship profiles (public-pages §3.19, D55): client-side filters by category and age band,
 * `?ref=` highlights and scrolls to one profile, funded profiles sort last with a ribbon. No photos,
 * no names, no precise places: only what the public DTO carries.
 */
export function SponsorGrid({ profiles, emptyText, emptyCta }: SponsorGridProps) {
  const [category, setCategory] = useState<string>("all");
  const [age, setAge] = useState<string>("all");
  const [focus, setFocus] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(profiles.map((p) => p.category))], [profiles]);
  const ages = useMemo(() => [...new Set(profiles.map((p) => p.ageBand))].filter((a) => a !== "unknown"), [profiles]);
  const shown = profiles.filter((p) => (category === "all" || p.category === category) && (age === "all" || p.ageBand === age));
  const open = profiles.some((p) => p.status === "published");

  const onPrefill = useCallback((v: Record<string, string>) => {
    if (v.ref) setFocus(v.ref.toUpperCase());
  }, []);

  useEffect(() => {
    if (!focus) return;
    // After the sections above have laid out (reveals and content-visibility shift the page), jump.
    const t = window.setTimeout(() => document.getElementById(`sp-${focus}`)?.scrollIntoView({ block: "start", behavior: "auto" }), 350);
    return () => window.clearTimeout(t);
  }, [focus]);

  if (!profiles.length || !open) {
    return (
      <>
        {profiles.length ? <Cards items={profiles} focus={focus} /> : null}
        <EmptyState
          title={emptyText}
          note="Thank you!"
          art="hands"
          action={
            <Button href={emptyCta.href} variant="flame-ink" icon="heart">
              {emptyCta.label}
            </Button>
          }
        />
      </>
    );
  }

  return (
    <div>
      <Suspense fallback={null}>
        <QueryPrefill keys={["ref"]} onValues={onPrefill} />
      </Suspense>
      {categories.length > 1 || ages.length > 1 ? (
        <div className="grid gap-4 md:flex md:flex-wrap md:items-center md:justify-between">
          {categories.length > 1 ? (
            <Chips
              label="Filter by support"
              tone="clay"
              scroll
              value={category}
              onChange={setCategory}
              options={[{ value: "all", label: "All support" }, ...categories.map((c) => ({ value: c, label: SUPPORT_CATEGORY_LABEL[c as SupportCategory] }))]}
            />
          ) : null}
          {ages.length > 1 ? (
            <Chips
              label="Filter by age"
              tone="clay"
              scroll
              value={age}
              onChange={setAge}
              options={[{ value: "all", label: "Any age" }, ...ages.map((a) => ({ value: a, label: ageNumeral(a) }))]}
            />
          ) : null}
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {shown.length} {shown.length === 1 ? "profile" : "profiles"} shown
      </p>
      {shown.length ? (
        <Cards items={shown} focus={focus} className="mt-10" />
      ) : (
        <EmptyState
          compact
          title="No profiles match these filters."
          art="hearts"
          action={
            <Button
              variant="outline"
              icon="none"
              onClick={() => {
                setCategory("all");
                setAge("all");
              }}
            >
              Show All Profiles
            </Button>
          }
        />
      )}
    </div>
  );
}

function Cards({ items, focus, className }: { items: SponsorProfilePublic[]; focus: string | null; className?: string }) {
  return (
    <ul className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((p, i) => {
        const funded = p.status === "fully_funded";
        const amount = fromMinor(p.amount.amountMinor, p.amount.currency);
        const donateHref = routes.donate("sponsor-a-child", {
          ref: p.code,
          frequency: p.period === "per_month" ? "monthly" : undefined,
          amount,
          currency: p.amount.currency,
        });
        const slots = Math.max(p.sponsorsNeeded, p.sponsorsCurrent);
        return (
          <li
            key={p.code}
            id={`sp-${p.code}`}
            className={cn(
              "relative flex scroll-mt-32 flex-col overflow-hidden rounded-card-lg bg-white shadow-card transition-shadow",
              focus === p.code && "ring-4 ring-marigold ring-offset-4 ring-offset-paper",
            )}
          >
            {funded ? (
              <span className="absolute right-0 top-6 z-10 rounded-l-full bg-forest px-4 py-1.5 text-[13px] font-bold text-white shadow-soft">Fully sponsored, thank you!</span>
            ) : null}
            <div className={cn("flex items-end justify-between gap-4 px-6 pb-6 pt-7 text-white", TONES[i % TONES.length])}>
              <div>
                <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.14em] text-white">Age</p>
                <p className="font-display text-[56px] leading-[0.9] tracking-[0.01em]">{ageNumeral(p.ageBand)}</p>
              </div>
              <IconDisc icon={p.programmeId} size={64} halo="none" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sand px-3 py-1 text-[13px] font-bold text-ink">{SUPPORT_CATEGORY_LABEL[p.category]}</span>
                {p.country && hasFlag(p.country) ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-body">
                    <FlagDisc code={p.country} className="size-5" />
                    {countryName(p.country)}
                  </span>
                ) : null}
                <span className="ml-auto font-grotesk text-[12px] font-semibold tracking-[0.06em] text-body">{p.code}</span>
              </div>
              <p className="mt-4 text-[16px] leading-relaxed text-ink">{p.need}</p>
              {p.lastUpdate ? (
                <p className="mt-3 border-l-2 border-marigold pl-3 text-[14px] leading-relaxed text-body">
                  <span className="font-bold text-ink">Programme update: </span>
                  {p.lastUpdate.text}
                </p>
              ) : null}
              <div className="mt-auto pt-6">
                <p className="flex items-baseline gap-1.5">
                  <span className="font-display text-[30px] leading-none text-ink">{formatMoney(p.amount)}</span>
                  <span className="text-[15px] font-semibold text-body">{PERIOD_LABEL[p.period]}</span>
                </p>
                {slots > 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] text-body">
                    <Users aria-hidden className="size-4 text-forest" strokeWidth={2.25} />
                    {Math.min(p.sponsorsCurrent, slots)} of {slots} {slots === 1 ? "sponsor" : "sponsors"}
                  </p>
                ) : null}
                {funded ? null : (
                  <Button href={donateHref} variant="flame-ink" className="mt-5 w-full" icon="none">
                    <span className="inline-flex items-center gap-2">
                      <HeartHandshake aria-hidden className="size-[18px]" strokeWidth={2.25} />
                      {p.period === "per_month" ? "Sponsor Monthly" : "Sponsor Now"}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
