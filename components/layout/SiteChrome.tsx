import type { SiteChrome as SiteChromeData } from "@/lib/content/types";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { ScrollTop } from "./ScrollTop";

/**
 * The public site's chrome (public-pages §1.5, PLAN D8–D9): Header, the site's single
 * `<main id="main" tabIndex={-1}>` (the SkipLink target), Footer and ScrollTop. Rendered by
 * `app/(site)/layout.tsx` and, for unmatched URLs, by `app/not-found.tsx` (which sits outside the site
 * layout). Pages never render their own `<main>`. Only the slices each part needs cross to the client.
 */
export function SiteChrome({ chrome, children }: { chrome: SiteChromeData; children: React.ReactNode }) {
  return (
    <>
      <Header chrome={{ contact: chrome.contact, ticker: chrome.ticker, nav: chrome.nav }} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <Footer
        chrome={{
          site: chrome.site,
          contact: chrome.contact,
          safety: chrome.safety,
          ctas: chrome.ctas,
          anyIllustrativeInUse: chrome.anyIllustrativeInUse,
        }}
      />
      <ScrollTop />
    </>
  );
}
