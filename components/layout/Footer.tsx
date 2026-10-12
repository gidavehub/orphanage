import Link from "next/link";
import { ArrowUpRight, Heart, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import type { SiteChrome } from "@/lib/content/types";
import { PROGRAMME_IDS, PROGRAMME_SLUG } from "@/lib/model/enums";
import { PROGRAMME_LABEL } from "@/lib/model/labels";
import { buildFooterLinks, type NavLink } from "@/lib/nav";
import { Logo } from "@/components/art/Logo";
import { SocialIcon } from "@/components/art/SocialIcons";
import { Brush } from "@/components/art/Brush";
import { HandDoodle } from "@/components/art/Hands";
import { Button } from "@/components/ui/Button";
import { FooterGiantText } from "./FooterGiantText";

function LinkColumn({ title, links }: { title: string; links: NavLink[] }) {
  const id = `footer-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <nav aria-labelledby={id}>
      <h3 id={id} className="text-[22px] font-bold text-white">
        {title}
      </h3>
      <span aria-hidden className="mt-2 block h-[2px] w-12 bg-marigold" />
      <ul className="mt-6 grid gap-3.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group inline-flex items-center gap-3 text-[16px] text-white/75 transition-colors hover:text-marigold">
              <ArrowUpRight aria-hidden className="size-4 text-marigold transition-transform duration-300 group-hover:rotate-45" strokeWidth={2.5} />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Built from the six programme ids and the default policies; used only while the caller does not pass
 * `chrome.footerLinks` (getSiteChrome builds those from the live programmes and policies).
 */
const FALLBACK_LINKS = buildFooterLinks(
  PROGRAMME_IDS.map((id) => ({ id, slug: PROGRAMME_SLUG[id], title: PROGRAMME_LABEL[id], navBlurb: "" })),
  [],
);

/** What the Footer reads from getSiteChrome(). */
export type FooterChrome = Pick<SiteChrome, "site" | "contact" | "safety" | "ctas" | "anyIllustrativeInUse"> &
  Partial<Pick<SiteChrome, "footerLinks">>;

/**
 * Donat footer (brush-torn top, splash, doodle, contact card) + VU giant statement line
 * (public-pages §5.6, design-system §4.3). Every link is a real route: the safeguarding row goes to
 * Request Support and Report a Concern, the brand column's Donate Now to /donate, and the columns come
 * from `buildFooterLinks` (Quick Links, all six programmes, and the legal row with a low-key,
 * rel="nofollow" Administrator Login). Offices, phone and email come from settings.contact. The year
 * is computed inside the cached getSiteSettings() (D15). While any AI image with people is live, the
 * illustrative notice sits under the legal links (D54).
 */
export function Footer({ chrome }: { chrome: FooterChrome }) {
  const { site, contact, safety } = chrome;
  const links = chrome.footerLinks ?? FALLBACK_LINKS;
  const [requestCta, concernCta] = chrome.ctas.footer;
  return (
    <footer id="site-footer" data-site-footer="" className="relative isolate scroll-mt-24 bg-night text-white">
      {/* Torn brush edge biting into the section above */}
      <Brush name="band" color="var(--color-night)" className="absolute inset-x-0 bottom-[calc(100%-2px)] w-full" style={{ aspectRatio: "1400 / 150" }} />
      <Brush name="drip" color="var(--color-marigold)" className="absolute -left-10 -top-24 -z-0 w-[170px] md:w-[230px]" rotate={-10} />
      <HandDoodle className="absolute right-[2%] top-16 hidden w-[120px] lg:block" dots="var(--color-forest)" />

      {/* Inner content skips first-render layout (cv-auto); the brush edge above stays unclipped. */}
      <div className="cv-auto">
        <div className="wrap relative pt-24">
          {/* Safeguarding row */}
          <div className="grid items-center gap-8 border-b border-white/10 pb-14 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-[28px] font-extrabold md:text-[36px]">{safety.footerHeading}</h2>
              <p className="mt-3 flex max-w-[620px] items-start gap-2.5 text-[15px] leading-relaxed text-white/70">
                <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold" />
                {safety.emergencyNotice}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button href={requestCta.href} variant="marigold" size="lg">
                {requestCta.label}
              </Button>
              <Button href={concernCta.href} variant="outline-light" size="lg" icon="none">
                {concernCta.label}
              </Button>
            </div>
          </div>

          <div className="grid gap-12 py-16 md:grid-cols-2 xl:grid-cols-[1.35fr_0.8fr_0.9fr_1.25fr]">
            <div>
              <Logo tone="light" className="text-[42px]" />
              <p className="mt-6 max-w-[330px] text-[16px] leading-[1.75] text-white/70">{site.description}</p>
              <div className="mt-8">
                <Button href={chrome.ctas.donate.href} variant="forest" icon="heart" iconFirst size="lg">
                  {chrome.ctas.donate.label}
                </Button>
              </div>
            </div>
            <LinkColumn title="Quick Links" links={links.quick} />
            <LinkColumn title="Our Programmes" links={links.programmes} />

            {/* Contact card with vertical social rail */}
            <div className="relative rounded-[30px] border border-white/10 bg-night-2 py-9 pl-8 pr-24">
              <h3 className="text-[24px] font-bold">Contact Us</h3>
              <div className="mt-7 grid gap-6">
                <div className="flex items-start gap-5">
                  <MapPin aria-hidden className="mt-0.5 size-6 shrink-0 text-white/80" strokeWidth={1.5} />
                  <span>
                    <span className="block text-[13px] text-white/60">{contact.addressLabel}:</span>
                    {contact.offices.map((o) => (
                      <span key={o.label} className="block text-[16px] font-semibold leading-snug">
                        {o.address}
                        {o.phone && o.phoneHref ? (
                          <a href={o.phoneHref} className="block text-[14px] font-normal text-white/75 hover:text-marigold">
                            {o.phone}
                          </a>
                        ) : null}
                      </span>
                    ))}
                  </span>
                </div>
                <a href={contact.phoneHref} className="group flex items-center gap-5">
                  <Phone aria-hidden className="size-6 text-white/80" strokeWidth={1.5} />
                  <span>
                    <span className="block text-[13px] text-white/60">{contact.phoneLabel}:</span>
                    <span className="block text-[20px] font-semibold group-hover:text-marigold">{contact.phone}</span>
                  </span>
                </a>
                <a href={`mailto:${contact.email}`} className="group flex items-center gap-5">
                  <Mail aria-hidden className="size-6 text-white/80" strokeWidth={1.5} />
                  <span>
                    <span className="block text-[13px] text-white/60">{contact.emailLabel}:</span>
                    <span className="block text-[16px] font-semibold [overflow-wrap:anywhere] group-hover:text-marigold">{contact.email}</span>
                  </span>
                </a>
              </div>
              <ul className="absolute right-4 top-1/2 grid -translate-y-1/2 gap-3">
                {contact.socials.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      aria-label={s.name}
                      className="grid size-11 place-items-center rounded-full bg-white text-night transition-all duration-300 hover:-translate-x-1 hover:bg-marigold hover:text-white"
                    >
                      <SocialIcon name={s.icon} className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <FooterGiantText text={site.footerStatement} />

          <nav aria-label="Legal and help">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 pb-10 pt-6 text-[14px] text-white/55">
              {links.legal.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} rel={l.rel} prefetch={l.rel === "nofollow" ? false : undefined} className="inline-flex min-h-6 items-center hover:text-marigold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {chrome.anyIllustrativeInUse && site.illustrativeNotice ? (
            <p className="-mt-4 pb-8 text-center text-[13px] leading-relaxed text-white/60">{site.illustrativeNotice}</p>
          ) : null}
        </div>

        <div className="bg-forest py-5 text-center text-[15px] text-white">
          © {site.year} <span className="text-marigold">{site.name}</span>. All Rights Reserved.{" "}
          <span className="inline-flex items-center gap-1 text-white/90">
            Made with <Heart aria-hidden className="size-3.5 text-marigold" fill="currentColor" strokeWidth={0} /> {site.signOff}
          </span>
        </div>
      </div>
    </footer>
  );
}
