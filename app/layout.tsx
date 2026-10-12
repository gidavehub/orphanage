import type { Metadata, Viewport } from "next";
import { Nunito, Anton, Caveat, Inter } from "next/font/google";
import { OrgJsonLd } from "@/components/seo/OrgJsonLd";
import { getContact, getSiteSettings } from "@/lib/content/public";
import { env } from "@/lib/server/env";
import { baseUrl } from "@/lib/server/url";
import "./globals.css";

// The one root layout (PLAN D1): html/body, the four fonts, globals.css, the no-JS reveal fix and the
// organisation's NGO JSON-LD (public-pages §7.2, from the cached site and contact settings).
// No chrome and no Lenis here: the public site's chrome lives in app/(site)/layout.tsx, the admin's
// in app/admin/layout.tsx (D7, D9).

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/** Base metadata from the cached site settings; absolute URLs resolve against NEXT_PUBLIC_SITE_URL. */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  const title = `${site.name} | ${site.tagline}`;
  // Previews and staging on Vercel stay out of search engines (public-pages §7.1).
  const indexable = !env.onVercel || env.vercelEnv === "production";
  return {
    metadataBase: new URL(baseUrl()),
    title: { default: title, template: `%s | ${site.name}` },
    description: site.description,
    applicationName: site.name,
    openGraph: {
      title,
      description: site.description,
      siteName: site.name,
      type: "website",
    },
    twitter: { card: "summary_large_image" },
    ...(indexable ? {} : { robots: { index: false, follow: false } }),
  };
}

export const viewport: Viewport = {
  themeColor: "#1f715a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [site, contact] = await Promise.all([getSiteSettings(), getContact()]);
  return (
    <html lang="en" className={`${nunito.variable} ${anton.variable} ${caveat.variable} ${inter.variable}`}>
      <head>
        <noscript>
          <style>{`[data-reveal],[data-reveal-stagger]>*{opacity:1!important;translate:none!important;scale:none!important}`}</style>
        </noscript>
      </head>
      <body>
        <OrgJsonLd base={baseUrl()} site={site} contact={contact} />
        {children}
      </body>
    </html>
  );
}
