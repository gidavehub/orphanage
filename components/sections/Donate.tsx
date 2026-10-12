import { AutoVideo } from "@/components/ui/AutoVideo";
import { Reveal } from "@/components/ui/Reveal";
import { VuHeading } from "@/components/ui/SectionHeading";
import { DonateWidget } from "@/components/donate/DonateWidget";
import { givingFromHome, type GivingConfig, type WidgetCause } from "@/components/donate/model";
import type { HomeView } from "@/lib/content/types";

// The landing donate chapter (public-pages §4.10): the coral video and the VU heading stay as they
// were; the card is the shared DonateWidget in its "landing" variant (local state, the cause as a
// <select>, no URL syncing). An appeal card's "Donate Now" preselects that cause and its currency.
// Routes, limits and causes are assembled on the server (lib/server/giving/pledge.ts → loadGiving,
// never NEXT_PUBLIC_) and passed in by the page as `giving`. Without it the card falls back to the home
// doc's donate slice with the payment defaults (every gift pledges; the server still decides the route).
export function Donate({ donate, giving }: { donate: HomeView["donate"]; giving?: { config: GivingConfig; causes: WidgetCause[] } }) {
  const { config, causes } = giving ?? givingFromHome(donate);
  const { copy } = donate;

  return (
    <section id="donate" data-nav-theme="glass" aria-labelledby="donate-title" className="relative isolate overflow-hidden bg-coral pb-20 pt-32 text-white md:pb-24 md:pt-[120px] cv-auto">
      <AutoVideo src={copy.media.src} poster={copy.media.poster} aria-hidden className="absolute inset-0 -z-20 size-full object-cover" />
      {/* VU: photo melts into solid coral toward the bottom */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(242,94,68,0)_0%,rgba(242,94,68,0.15)_35%,rgba(242,94,68,0.85)_62%,#f25e44_78%)]" />

      <div className="wrap flex flex-col items-center">
        {/* ── The card ── */}
        <Reveal y={50} className="w-full max-w-[460px]">
          <DonateWidget
            variant="landing"
            config={config}
            causes={causes}
            copy={{
              anywhereLabel: copy.anywhereLabel,
              securityNote: copy.securityNote,
              updatesConsentLabel: copy.updatesConsentLabel,
              anonymousLabel: copy.anonymousLabel,
            }}
          />
        </Reveal>

        {/* ── Headline ── */}
        <Reveal className="mt-10 text-center">
          <VuHeading id="donate-title" parts={copy.title} accentClass="text-night" className="text-white" />
          <p className="mx-auto mt-5 max-w-[620px] font-grotesk text-[16px] leading-relaxed text-white/90">{copy.text}</p>
        </Reveal>
      </div>
    </section>
  );
}
