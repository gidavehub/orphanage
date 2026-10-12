import { ArrowUpRight, Clock3, MapPin, Phone } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import type { ContactView } from "@/lib/content/types";
import { cn } from "@/lib/cn";

/** A Google Maps search link for an office (no embed, so no third-party cookies: public-pages §3.2.10). */
function directionsHref(office: ContactView["offices"][number]): string {
  return office.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(office.address)}`;
}

/**
 * The office cards under the world map on /about (public-pages §3.2.10), from settings.contact:
 * the office, its address, its phone when set, and "Get directions" (a link out, never an embed).
 */
export function OfficeCards({ offices, hours, className }: { offices: ContactView["offices"]; hours?: string; className?: string }) {
  return (
    <Reveal as="ul" stagger={0.12} y={30} className={cn("grid gap-5 md:grid-cols-2", className)}>
      {offices.map((o, i) => (
        <li key={o.label} className="relative flex flex-col overflow-hidden rounded-card-lg bg-white p-6 shadow-card sm:p-8">
          <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1.5", i % 2 ? "bg-clay" : "bg-forest")} />
          <div className="flex items-start gap-4">
            <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-full", i % 2 ? "bg-clay-100 text-clay-700" : "bg-mint text-forest")}>
              <MapPin className="size-6" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[21px] font-extrabold leading-tight text-ink">{o.label}</h3>
              <p className="mt-1.5 text-[16px] leading-relaxed text-body">{o.address}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 text-[15px] text-ink">
            {o.phone && o.phoneHref ? (
              <a href={o.phoneHref} className="inline-flex min-h-11 items-center gap-2.5 font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink">
                <Phone aria-hidden className="size-4" strokeWidth={2.5} />
                {o.phone}
              </a>
            ) : null}
            {hours ? (
              <p className="flex items-start gap-2.5 text-body">
                <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-ink" strokeWidth={2.5} />
                {hours}
              </p>
            ) : null}
          </div>
          <div className="mt-auto pt-6">
            <a
              href={directionsHref(o)}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-deep px-6 text-[15px] font-bold text-white transition-colors duration-300 hover:bg-marigold hover:text-night"
            >
              Get directions
              <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.5} />
              <span className="sr-only"> to our {o.label} office (opens Google Maps in a new tab)</span>
            </a>
          </div>
        </li>
      ))}
    </Reveal>
  );
}
