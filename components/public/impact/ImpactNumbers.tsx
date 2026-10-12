import { Info } from "lucide-react";
import { Counter } from "@/components/ui/Counter";
import { StatCard, type StatTone } from "@/components/ui/cards/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import type { ResolvedStat } from "@/lib/content/types";
import { CURRENCIES, type Currency } from "@/lib/model/enums";
import { cn } from "@/lib/cn";

// The ToR §3 figures on /impact (public-pages §3.12, PLAN D45–D46), by id and in this order. The
// first three are the large cards; the rest are medium. "Volunteers and partners engaged" falls
// back to the two landing figures (active volunteers, community partners) until it has a value.
const LARGE = ["children-supported", "families-reached", "school-fee-interventions"] as const;
const MEDIUM = ["counselling-sessions", "medical-cases", "volunteers-partners"] as const;
const VOLUNTEER_FALLBACK = ["active-volunteers", "community-partners"] as const;
const RECEIVED = "donations-received";
const DISTRIBUTED = "donations-distributed";

const STAT_TONE: Record<string, StatTone> = { clay: "clay", marigold: "marigold", cocoa: "cocoa", forest: "forest", umber: "umber", coral: "clay", deep: "forest" };
const LARGE_TONES: StatTone[] = ["clay", "marigold", "forest"];
const MEDIUM_TONES: StatTone[] = ["cocoa", "umber", "marigold", "forest"];

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "As of September 2026" from the stat's YYYY-MM-DD. */
function asOfLabel(asOf?: string): string | null {
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  const d = new Date(`${asOf}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : `As of ${monthYear.format(d)}`;
}

function noteOf(s: ResolvedStat): string | undefined {
  const asOf = asOfLabel(s.asOf);
  if (s.note && asOf) return `${s.note} ${asOf}.`;
  return s.note ?? asOf ?? undefined;
}

/** Which of the D45 figures are live (getStats() already drops unverified ones after the launch switch). */
export function pickImpactStats(stats: Record<string, ResolvedStat>) {
  const large = LARGE.map((id) => stats[id]).filter((s): s is ResolvedStat => !!s);
  const medium = MEDIUM.flatMap((id) => {
    if (stats[id]) return [stats[id]];
    if (id === "volunteers-partners") return VOLUNTEER_FALLBACK.map((f) => stats[f]).filter((s): s is ResolvedStat => !!s);
    return [];
  });
  const received = stats[RECEIVED] ?? null;
  const distributed = stats[DISTRIBUTED] ?? null;
  const count = large.length + medium.length + (received ? 1 : 0) + (distributed ? 1 : 0);
  const anyIllustrative = [...large, ...medium, received, distributed].some((s) => s && !s.verified);
  return { large, medium, received, distributed, count, anyIllustrative };
}

type Picked = ReturnType<typeof pickImpactStats>;

/** Per-currency money rows for the donations card; one figure in the stat's own unit when there are no amounts. */
function moneyRows(received: ResolvedStat | null, distributed: ResolvedStat | null) {
  const currencies = CURRENCIES.filter((c) => (received?.amounts?.[c] ?? 0) > 0 || (distributed?.amounts?.[c] ?? 0) > 0);
  return currencies.map((c: Currency) => ({ currency: c, received: received?.amounts?.[c] ?? null, distributed: distributed?.amounts?.[c] ?? null }));
}

/** The wide "Donations received and distributed" card: two counters per currency, never summed (D45). */
function DonationsCard({ received, distributed }: { received: ResolvedStat | null; distributed: ResolvedStat | null }) {
  const rows = moneyRows(received, distributed);
  const illustrative = (received && !received.verified) || (distributed && !distributed.verified);
  const asOf = asOfLabel(received?.asOf ?? distributed?.asOf);
  const counters: Array<{ key: string; label: string; value: number; prefix?: string; suffix?: string }> = [];
  if (rows.length) {
    for (const r of rows) {
      if (r.received !== null) counters.push({ key: `r-${r.currency}`, label: `Received (${r.currency})`, value: r.received, prefix: `${r.currency} ` });
      if (r.distributed !== null) counters.push({ key: `d-${r.currency}`, label: `Distributed (${r.currency})`, value: r.distributed, prefix: `${r.currency} ` });
    }
  } else {
    if (received) counters.push({ key: "r", label: received.label, value: received.value, suffix: received.suffix });
    if (distributed) counters.push({ key: "d", label: distributed.label, value: distributed.value, suffix: distributed.suffix });
  }
  if (!counters.length) return null;
  return (
    <article className="relative col-span-full flex flex-col gap-8 overflow-hidden rounded-card bg-deep p-7 text-white md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-grotesk text-[12px] font-medium uppercase tracking-[0.06em]">Donations received and distributed</p>
          {asOf ? <p className="mt-1 font-grotesk text-[14px] text-white/85">{asOf}</p> : null}
        </div>
        {illustrative ? <span className="rounded-full bg-white px-2.5 py-1 font-grotesk text-[11.5px] font-semibold text-deep">Illustrative</span> : null}
      </div>
      <dl className="grid gap-8 sm:grid-cols-2">
        {counters.map((c) => (
          <div key={c.key}>
            <dt className="font-grotesk text-[14px] text-white">{c.label}</dt>
            <dd className="mt-2 font-display text-[48px] leading-none md:text-[64px]">
              <Counter value={c.value} prefix={c.prefix} suffix={c.suffix} suffixClassName="text-marigold" />
            </dd>
          </div>
        ))}
      </dl>
      <p className="max-w-[640px] font-grotesk text-[14px] leading-relaxed text-white">Every currency is counted on its own: we never add dollars, dalasi and other currencies together.</p>
    </article>
  );
}

const MEDIUM_SPAN: Record<number, string> = { 1: "lg:col-span-12", 2: "lg:col-span-6", 3: "lg:col-span-4", 4: "lg:col-span-3" };

/**
 * The numbers bento (public-pages §3.12 item 2): three large cards, up to four medium ones and the
 * wide donations card. Unverified figures carry the "Illustrative" chip and the footnote; after the
 * before-launch switch they are gone, and with fewer than three figures left the grid becomes the
 * "We're verifying our latest figures" empty state (D46).
 */
export function ImpactNumbers({ picked, footnote, emptyText }: { picked: Picked; footnote: string; emptyText: string }) {
  if (picked.count < 3) {
    return <EmptyState art="hearts" title={emptyText} body="Only figures checked by our programme and finance teams are shown here." className="mt-12" />;
  }
  const mediumSpan = MEDIUM_SPAN[Math.min(4, picked.medium.length)] ?? "lg:col-span-3";
  return (
    <>
      <Reveal as="ul" stagger={0.08} className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
        {picked.large.map((s, i) => (
          <li key={s.id} className={cn("grid", picked.large.length === 3 ? "lg:col-span-4" : picked.large.length === 2 ? "lg:col-span-6" : "lg:col-span-12", i === 2 && "sm:col-span-2 lg:col-span-4")}>
            <StatCard
              label={s.label}
              value={s.value}
              suffix={s.suffix}
              note={noteOf(s)}
              tone={STAT_TONE[s.tone ?? ""] ?? LARGE_TONES[i % LARGE_TONES.length]}
              illustrative={!s.verified}
              as="div"
              className={cn("min-h-[260px]! md:min-h-[340px]!", !s.verified && "[&>p:first-child]:pr-24")}
            />
          </li>
        ))}
        {picked.medium.map((s, i) => (
          <li key={s.id} className={cn("grid", mediumSpan, picked.medium.length % 2 === 1 && i === picked.medium.length - 1 && "sm:col-span-2")}>
            <StatCard
              label={s.label}
              value={s.value}
              suffix={s.suffix}
              note={noteOf(s)}
              tone={STAT_TONE[s.tone ?? ""] ?? MEDIUM_TONES[i % MEDIUM_TONES.length]}
              illustrative={!s.verified}
              as="div"
              className={cn("min-h-[220px]! md:min-h-[280px]!", !s.verified && "[&>p:first-child]:pr-24")}
            />
          </li>
        ))}
        {picked.received || picked.distributed ? (
          <li className="grid sm:col-span-2 lg:col-span-12">
            <DonationsCard received={picked.received} distributed={picked.distributed} />
          </li>
        ) : null}
      </Reveal>
      {picked.anyIllustrative ? (
        <p className="mx-auto mt-8 flex max-w-[720px] items-start justify-center gap-2 text-center text-[14px] leading-relaxed text-body">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-ink" strokeWidth={2.25} />
          <span>{footnote}</span>
        </p>
      ) : null}
    </>
  );
}
