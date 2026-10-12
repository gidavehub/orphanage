"use client";

import { useEffect } from "react";
import { Phone, RotateCcw } from "lucide-react";
import { Brush } from "@/components/art/Brush";
import { HandDoodle } from "@/components/art/Hands";
import { AnchorLink } from "@/components/ui/AnchorLink";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { routeHref } from "@/lib/routes";

// Errors inside a site page (PLAN D10; public-pages §3.23; design-system §4.1). Renders inside the
// site layout, so the Header and Footer (with Haven's phone and email) stay on screen. `retry`
// re-fetches and re-renders the segment (Next 16.3).
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // The digest links this to the server log line; never show the message itself to visitors.
    console.error("[haven] page error", error.digest ?? "");
  }, [error]);

  return (
    <section aria-labelledby="error-title" className="paper relative isolate overflow-hidden pb-[max(9rem,12vw)] pt-16 focus-forest md:pt-24">
      <Brush name="splash" color="var(--color-marigold)" rotate={-18} className="absolute -right-24 -top-24 -z-10 w-[320px] opacity-70 md:w-[440px]" />
      <HandDoodle className="absolute bottom-[14vw] left-[4%] -z-10 hidden w-[130px] lg:block" />
      <div className="wrap flex flex-col items-center text-center">
        <p className="font-script text-[26px] font-bold leading-tight text-marigold-ink md:text-[30px]">Sorry about this</p>
        <h1 id="error-title" className="mt-3 max-w-[900px] text-balance font-display text-[44px] uppercase leading-[0.95] text-ink md:text-[72px]">
          Something went wrong on our side
        </h1>
        <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-body">
          Please try again in a moment. If you need help now, our phone number and email are at the bottom of this page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => retry()} variant="forest" size="sm" icon="none">
            <span className="inline-flex items-center gap-2">
              <RotateCcw aria-hidden className="size-4" strokeWidth={2.5} /> Try again
            </span>
          </Button>
          <Button href="/" variant="outline" size="sm">
            Home
          </Button>
          <AnchorLink
            to="contact"
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-bold text-forest underline-offset-4 hover:underline"
          >
            <Phone aria-hidden className="size-4" strokeWidth={2.5} /> Contact details
          </AnchorLink>
        </div>
        <Notice tone="emergency" compact className="mt-12 w-full max-w-[640px] text-left" />
        <p className="mt-6 text-[14px] text-body">
          Worried about a child? <a href={routeHref("report")} className="font-bold text-forest underline underline-offset-4">Report a concern</a>
        </p>
      </div>
    </section>
  );
}
