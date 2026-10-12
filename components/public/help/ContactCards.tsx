import { Clock3, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { SocialIcon } from "@/components/art/SocialIcons";
import { Button } from "@/components/ui/Button";
import { IconDisc } from "@/components/ui/IconDisc";
import type { ContactView } from "@/lib/content/public";
import { routes } from "@/lib/routes";

function directionsHref(o: ContactView["offices"][number]): string {
  return o.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`;
}

/**
 * The left column of /contact (public-pages §3.8.3): offices with directions, phone, email and
 * hours, the social rail and a nudge towards the request form.
 */
export function ContactCards({ contact }: { contact: ContactView }) {
  return (
    <div className="grid gap-5">
      <section aria-labelledby="offices-title" className="rounded-card bg-cream p-6 md:p-7">
        <h2 id="offices-title" className="text-[19px] font-extrabold text-ink">
          Our Offices
        </h2>
        <span aria-hidden className="mt-2 block h-[2px] w-10 bg-marigold" />
        <ul className="mt-5 grid gap-5">
          {contact.offices.map((o) => (
            <li key={o.label} className="flex items-start gap-4">
              <IconDisc icon={MapPin} size={44} />
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-ink">{o.label}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-body">{o.address}</p>
                {o.phone && o.phoneHref ? (
                  <a href={o.phoneHref} className="mt-1 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-ink hover:text-forest">
                    <Phone aria-hidden className="size-4 text-forest" strokeWidth={2.25} />
                    {o.phone}
                  </a>
                ) : null}
                <a
                  href={directionsHref(o)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center gap-2 text-[15px] font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink"
                >
                  <Navigation aria-hidden className="size-4" strokeWidth={2.25} />
                  Get directions
                  <span className="sr-only"> to the {o.label} office (opens in a new tab)</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reach-title" className="rounded-card bg-white p-6 shadow-soft md:p-7">
        <h2 id="reach-title" className="text-[19px] font-extrabold text-ink">
          Call or Email
        </h2>
        <span aria-hidden className="mt-2 block h-[2px] w-10 bg-marigold" />
        <div className="mt-5 grid gap-4">
          <a href={contact.phoneHref} className="group flex items-center gap-4">
            <IconDisc icon={Phone} size={44} />
            <span className="min-w-0">
              <span className="block text-[13px] text-body">{contact.phoneLabel}</span>
              <span className="block text-[17px] font-bold text-ink group-hover:text-forest">{contact.phone}</span>
            </span>
          </a>
          <a href={`mailto:${contact.email}`} className="group flex items-center gap-4">
            <IconDisc icon={Mail} size={44} />
            <span className="min-w-0">
              <span className="block text-[13px] text-body">{contact.emailLabel}</span>
              <span className="block text-[17px] font-bold text-ink [overflow-wrap:anywhere] group-hover:text-forest">{contact.email}</span>
            </span>
          </a>
          {contact.hours ? (
            <p className="flex items-center gap-4">
              <IconDisc icon={Clock3} size={44} />
              <span className="min-w-0">
                <span className="block text-[13px] text-body">Office hours</span>
                <span className="block text-[15px] font-semibold text-ink">{contact.hours}</span>
              </span>
            </p>
          ) : null}
        </div>
        {contact.socials.length ? (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-[14px] font-bold text-ink">Follow our work</p>
            <ul className="mt-3 flex flex-wrap gap-2.5">
              {contact.socials.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    aria-label={s.name}
                    className="grid size-11 place-items-center rounded-full bg-paper text-night transition-[background-color,color,transform] duration-300 hover:-translate-y-0.5 hover:bg-marigold hover:text-night"
                  >
                    <SocialIcon name={s.icon} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="need-help-title" className="relative overflow-hidden rounded-card bg-forest p-6 text-white focus-marigold md:p-7">
        <span aria-hidden className="pointer-events-none absolute -bottom-12 -right-12 size-40 rounded-full bg-white/[0.07]" />
        <h2 id="need-help-title" className="text-[19px] font-extrabold">
          Need Help for a Child?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white">Ask for education, medical, counselling, legal or family support through our confidential request.</p>
        <Button href={routes.request()} variant="white-ink" size="sm" icon="arrow-right" className="mt-5">
          Request Support
        </Button>
      </section>
    </div>
  );
}
