import { FileText, Info } from "lucide-react";
import { AllocationBar } from "@/components/ui/AllocationBar";
import { ArrowLink } from "@/components/ui/ArrowLink";
import type { AllocationSummaryView } from "@/lib/content/types";
import { CURRENCIES, type Currency } from "@/lib/model/enums";
import { money } from "@/lib/money";
import { cn } from "@/lib/cn";

type Line = NonNullable<AllocationSummaryView["byCurrency"][Currency]>["lines"][number];

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pct = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

function period(start: string, end: string): string {
  const a = new Date(`${start}T12:00:00Z`);
  const b = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${start} – ${end}`;
  return `${longDate.format(a)} – ${longDate.format(b)}`;
}

/** Programme lines vs running costs (admin, fees, other). */
const RUNNING = new Set(["admin", "fees", "other"]);

/** The currencies that have anything to show, in the registry order. */
export function allocationCurrencies(summary: AllocationSummaryView): Currency[] {
  return CURRENCIES.filter((c) => {
    const b = summary.byCurrency[c];
    return !!b && b.lines.some((l) => l.amount > 0);
  });
}

/**
 * "Where the money went" (public-pages §3.12 item 3, PLAN D57): per currency (never summed), what
 * came in, what was put to work and how it was split, as a stacked bar that fills on reveal with its
 * legend, a real table under "Show as a table" (the no-JS and screen-reader version), the share that
 * went straight to programmes, and the annual report link. Unverified summaries carry the
 * "Illustrative" chip and note; after the launch switch they are not passed in at all (D46).
 */
export function MoneyWent({ summary, reportHref }: { summary: AllocationSummaryView; reportHref: string | null }) {
  const currencies = allocationCurrencies(summary);
  if (!currencies.length || !summary.showFigures) return null;
  const illustrative = !summary.verified;

  return (
    <div className="mt-12 grid gap-8">
      {currencies.map((c) => {
        const b = summary.byCurrency[c];
        if (!b) return null;
        const lines: Line[] = b.lines.filter((l) => l.amount > 0);
        const spent = lines.reduce((s, l) => s + l.amount, 0);
        const programmes = lines.filter((l) => !RUNNING.has(l.key)).reduce((s, l) => s + l.amount, 0);
        const carried = Math.max(0, b.received - spent);
        const programmeShare = spent > 0 ? Math.round((programmes / spent) * 100) : 0;
        const parts = lines.map((l) => ({ label: l.label, percent: spent > 0 ? (l.amount / spent) * 100 : 0, ...(l.tone ? { tone: l.tone } : {}) }));
        const figures = [
          { label: "Received", value: money(b.received, c) },
          { label: "Put to work", value: money(spent, c) },
          ...(carried > 0 ? [{ label: "Carried forward", value: money(carried, c) }] : []),
        ];
        return (
          <article key={c} aria-labelledby={`went-${c}`} className="relative overflow-hidden rounded-card-lg bg-cream p-6 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 id={`went-${c}`} className="text-[22px] font-extrabold leading-tight text-ink md:text-[26px]">
                  {summary.label}
                  {currencies.length > 1 ? <span className="text-body"> · {c}</span> : null}
                </h3>
                <p className="mt-1 font-grotesk text-[14px] text-body">{period(summary.periodStart, summary.periodEnd)}</p>
              </div>
              {illustrative ? <span className="rounded-full bg-night px-3 py-1.5 font-grotesk text-[12px] font-semibold text-marigold">Illustrative</span> : null}
            </div>

            <div className="mt-8 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
              <div className="flex flex-col gap-6">
                <dl className="grid grid-cols-2 gap-5 lg:grid-cols-1">
                  {figures.map((f) => (
                    <div key={f.label} className="border-l-4 border-marigold pl-4">
                      <dt className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.1em] text-body">{f.label}</dt>
                      <dd className="mt-1 font-display text-[34px] leading-none text-ink md:text-[40px]">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                {programmeShare > 0 ? (
                  <p className="rounded-card bg-forest px-5 py-4 text-[15px] leading-snug text-white">
                    <span className="block font-display text-[40px] leading-none text-marigold">{programmeShare}%</span>
                    went straight to programmes for children and families.
                  </p>
                ) : null}
              </div>

              <div className="min-w-0">
                <AllocationBar parts={parts} amount={{ value: spent, currency: c }} label={`How ${summary.label.toLowerCase()} was spent, in ${c}`} />
                <details className="group mt-6 rounded-control border border-line bg-white">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-bold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                    Show as a table
                    <span aria-hidden className="text-marigold-ink transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full min-w-[320px] border-collapse text-left text-[15px]">
                      <caption className="sr-only">
                        {summary.label}: spending by programme in {c}
                      </caption>
                      <thead>
                        <tr className="border-b border-line font-grotesk text-[12px] uppercase tracking-[0.08em] text-body">
                          <th scope="col" className="py-2 pr-3 font-semibold">
                            Used for
                          </th>
                          <th scope="col" className="py-2 pr-3 text-right font-semibold">
                            Amount
                          </th>
                          <th scope="col" className="py-2 text-right font-semibold">
                            Share
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l) => (
                          <tr key={l.key} className="border-b border-line/70 last:border-0">
                            <th scope="row" className="py-2.5 pr-3 font-semibold text-ink">
                              {l.label}
                            </th>
                            <td className="py-2.5 pr-3 text-right tabular-nums text-body">{money(l.amount, c)}</td>
                            <td className="py-2.5 text-right tabular-nums text-body">{pct.format(spent > 0 ? (l.amount / spent) * 100 : 0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-ink/20">
                          <th scope="row" className="py-2.5 pr-3 font-extrabold text-ink">
                            Total spent
                          </th>
                          <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-ink">{money(spent, c)}</td>
                          <td className="py-2.5 text-right font-bold tabular-nums text-ink">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </details>
              </div>
            </div>
          </article>
        );
      })}

      <div className={cn("flex flex-col gap-4 md:flex-row md:items-center", reportHref ? "md:justify-between" : "md:justify-center")}>
        {illustrative || summary.note ? (
          <p className="flex max-w-[720px] items-start gap-2 text-[14px] leading-relaxed text-body">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-ink" strokeWidth={2.25} />
            <span>
              {illustrative ? "These figures are illustrative placeholders pending verification by our finance team. " : ""}
              {summary.note ?? ""}
            </span>
          </p>
        ) : null}
        {reportHref ? (
          <ArrowLink href={reportHref} className="shrink-0 font-bold">
            <span className="inline-flex items-center gap-2">
              <FileText aria-hidden className="size-4 text-forest" strokeWidth={2.25} />
              Read the annual report
            </span>
          </ArrowLink>
        ) : null}
      </div>
    </div>
  );
}
