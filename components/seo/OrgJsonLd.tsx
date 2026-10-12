import { JsonLd } from "./JsonLd";
import { countries } from "@/content/world";
import type { ContactView, SiteSettingsView } from "@/lib/content/types";

/**
 * The root NGO JSON-LD (public-pages §7.2): name, logo, contact points, offices, the countries served
 * and a DonateAction. `@id` is `${site}/#org`, so articles and reports can point their publisher at it.
 * Placeholder social links ("#") are left out; nonprofitStatus waits for the client's confirmation.
 */
export function OrgJsonLd({ base, site, contact }: { base: string; site: SiteSettingsView; contact: ContactView }) {
  const id = `${base}/#org`;
  return (
    <JsonLd
      id="org-jsonld"
      data={{
        "@context": "https://schema.org",
        "@type": "NGO",
        "@id": id,
        name: site.name,
        alternateName: "The Orphanage Project",
        legalName: site.orgName,
        url: `${base}/`,
        logo: `${base}/icon.svg`,
        slogan: site.tagline,
        description: site.description,
        foundingDate: String(site.foundedYear),
        address: contact.offices.map((o) => ({
          "@type": "PostalAddress",
          addressLocality: o.address,
          addressCountry: /gambia/i.test(o.label) ? "GM" : /united states|usa/i.test(o.label) ? "US" : undefined,
        })),
        contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", telephone: contact.phone, email: contact.email, availableLanguage: ["en"] }],
        sameAs: contact.socials.map((s) => s.href).filter((h) => /^https?:\/\//.test(h)),
        areaServed: countries.map((c) => ({ "@type": "Country", name: c.name })),
        potentialAction: { "@type": "DonateAction", target: `${base}/donate`, recipient: { "@id": id } },
      }}
    />
  );
}
