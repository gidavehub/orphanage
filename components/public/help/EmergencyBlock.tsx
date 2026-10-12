import { Phone } from "lucide-react";
import { Notice } from "@/components/ui/Notice";
import { FlagDisc } from "@/components/ui/flag";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/cn";

export type EmergencyContact = { country: string; label: string; number: string };

export type EmergencyBlockProps = {
  /** settings.safety.emergencyNotice. */
  text: string;
  /** Verified numbers only (getSafety() already drops unverified ones, D51). */
  contacts: readonly EmergencyContact[];
  title?: string;
  action?: React.ReactNode;
  /** Announce it (it appeared because of an answer). */
  live?: boolean;
  compact?: boolean;
  id?: string;
  className?: string;
};

function telHref(n: string): string {
  return `tel:${n.replace(/[^\d+]/g, "")}`;
}

/**
 * The emergency notice (not dismissible) with the verified local numbers grouped by country
 * (public-pages §3.7.2). Until a number is verified only the notice shows.
 */
export function EmergencyBlock({ text, contacts, title = "If a child is in immediate danger", action, live, compact, id, className }: EmergencyBlockProps) {
  const byCountry = new Map<string, EmergencyContact[]>();
  // settings.safety's sentence usually opens with the title itself: never say it twice. The title
  // stays as the heading and the body carries the rest of the sentence.
  const t = text.trim();
  const repeats = !!title && t.toLowerCase().startsWith(title.trim().toLowerCase());
  const rest = repeats ? t.slice(title.trim().length).replace(/^[\s,:;.–—-]+/, "") : t;
  const body = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : t;
  for (const c of contacts) byCountry.set(c.country, [...(byCountry.get(c.country) ?? []), c]);
  return (
    <Notice tone="emergency" title={title} live={live} compact={compact} id={id} className={className} action={action}>
      <p>{body}</p>
      {byCountry.size ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {[...byCountry.entries()].map(([code, rows]) => (
            <li key={code} className="rounded-2xl bg-white/[0.07] p-4">
              <p className="flex items-center gap-2 text-[14px] font-bold text-white">
                <FlagDisc code={code} className="size-5" />
                {countryName(code)}
              </p>
              <ul className="mt-2 grid gap-1.5">
                {rows.map((r) => (
                  <li key={`${r.label}-${r.number}`} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px]">
                    <span className="text-white/85">{r.label}</span>
                    <a href={telHref(r.number)} className={cn("inline-flex min-h-11 items-center gap-1.5 font-grotesk font-semibold tabular-nums text-marigold underline-offset-4 hover:underline")}>
                      <Phone aria-hidden className="size-3.5" strokeWidth={2.5} />
                      {r.number}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}
