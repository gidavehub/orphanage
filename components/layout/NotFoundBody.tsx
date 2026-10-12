import { ShieldAlert } from "lucide-react";
import { Brush } from "@/components/art/Brush";
import { HandDoodle } from "@/components/art/Hands";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SearchField } from "@/components/ui/SearchField";
import { routeHref, routes } from "@/lib/routes";

export type NotFoundBodyProps = {
  /** Caveat line (pages.notFound can override). */
  eyebrow?: string;
  title?: string;
  text?: string;
  /** The emergency sentence from settings.safety; a standard one is shown otherwise. */
  emergencyNotice?: string;
};

/**
 * The 404 body (public-pages §3.23, D8): rendered by `app/not-found.tsx` inside SiteChrome and by
 * `app/(site)/not-found.tsx` inside the site layout. Owns the page's `<h1>`.
 */
export function NotFoundBody({
  eyebrow = "Let's get you somewhere safe",
  title = "Page not found",
  text = "The page you were looking for has moved or no longer exists. Search the site, or pick one of these.",
  emergencyNotice,
}: NotFoundBodyProps) {
  return (
    <section aria-labelledby="not-found-title" className="paper relative isolate overflow-hidden pb-[max(9rem,12vw)] pt-16 focus-forest md:pt-24">
      <Brush name="splash" color="var(--color-marigold)" rotate={-18} className="absolute -right-24 -top-24 -z-10 w-[320px] opacity-70 md:w-[440px]" />
      <HandDoodle className="absolute bottom-[14vw] left-[4%] -z-10 hidden w-[130px] lg:block" />
      <div className="wrap flex flex-col items-center text-center">
        <p className="font-script text-[26px] font-bold leading-tight text-marigold-ink md:text-[30px]">{eyebrow}</p>
        <h1 id="not-found-title" className="mt-3 font-display text-[52px] uppercase leading-[0.95] text-ink md:text-[80px] xl:text-[96px]">
          {title}
        </h1>
        <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-body">{text}</p>
        <div className="mt-8 w-full max-w-[520px] text-left">
          <SearchField action={routes.search()} label="Search the site" placeholder="Search for help, programmes, news…" size="lg" />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/" variant="forest" size="sm">
            Home
          </Button>
          <Button href={routeHref("donate")} variant="marigold-ink" size="sm" icon="heart" iconFirst>
            Donate
          </Button>
          <Button href={routeHref("support")} variant="outline" size="sm">
            Request Support
          </Button>
          <Button href={routeHref("report")} variant="outline" size="sm" icon="none">
            <span className="inline-flex items-center gap-2">
              <ShieldAlert aria-hidden className="size-4" strokeWidth={2.5} /> Report a Concern
            </span>
          </Button>
        </div>
        <Notice tone="emergency" compact className="mt-12 w-full max-w-[640px] text-left">
          {emergencyNotice}
        </Notice>
      </div>
    </section>
  );
}
