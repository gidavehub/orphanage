import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { routes } from "@/lib/routes";
import { stripeGiftsOf } from "@/lib/server/payments/portal";
import { verifyToken } from "@/lib/server/security/hmac";
import { baseUrl } from "@/lib/server/url";

// /donate/manage/choose?t= (integrations §3.7): a donor with more than one card gift picks which one
// to manage. The signed link is the only key; it expires after 60 minutes (or 7 days from a receipt).

export const metadata: Metadata = { title: "Choose a gift to manage", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ChoosePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHero variant="plain" art="hands" eyebrow="Your gift" title="Which gift?" intro="You give to Haven in more than one way. Choose the one to manage." crumbs={[{ label: "Donate", href: routes.donate() }, { label: "Manage your gift", href: routes.manage() }, { label: "Choose" }]} baseUrl={baseUrl()} />
      <Section tone="white" pad="md" cv={false} label="Your gifts">
        <Suspense fallback={null}>
          <List searchParams={searchParams} />
        </Suspense>
      </Section>
    </>
  );
}

async function List({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const claim = verifyToken(t, "portal");
  const gifts = claim ? await stripeGiftsOf(claim.sub).catch(() => []) : [];
  if (!claim || gifts.length === 0) {
    return (
      <div className="mx-auto max-w-[640px]">
        <Notice tone="info" title="This link has expired" compact>
          Please ask for a new one on the <a className="font-bold underline" href={routes.manage()}>Manage your gift</a> page.
        </Notice>
      </div>
    );
  }
  return (
    <ul className="mx-auto grid max-w-[640px] gap-3">
      {gifts.map((g, i) => (
        <li key={g.customerId}>
          <a href={`/api/stripe/portal?t=${encodeURIComponent(t)}&c=${i}`} className="group flex min-h-16 items-center justify-between gap-4 rounded-[22px] border border-line bg-white px-5 py-4 text-[17px] font-bold text-ink shadow-soft transition-colors hover:border-forest">
            {g.label}
            <ArrowRight aria-hidden className="size-5 shrink-0 text-forest transition-transform group-hover:translate-x-1" />
          </a>
        </li>
      ))}
    </ul>
  );
}
