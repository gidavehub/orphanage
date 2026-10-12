import type { Metadata } from "next";
import { Suspense } from "react";
import { ThankYouView } from "@/components/donate/thanks/ThankYouView";
import { getContact, getPage } from "@/lib/content/public";
import { resolveThanks } from "@/lib/server/giving/thanks";
import { buildMetadata } from "@/lib/seo/meta";

// /donate/thank-you (public-pages §4.9; PLAN D67, D70): outside (give), so no widget and no shared
// state. Read-only: ?session_id= (Stripe) reads the checkout intent; ?ref=&t= (pledge or in-kind) needs
// a valid signed token; anything else is the generic thank-you with no personal data. Never indexed.

export const metadata: Metadata = buildMetadata({
  title: "Thank You",
  description: "Thank you for supporting Haven.",
  path: "/donate/thank-you",
  noindex: true,
});

function one(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.length > 0 && s.length <= 2048 ? s : null;
}

async function ThanksBody({ searchParams }: { searchParams: PageProps<"/donate/thank-you">["searchParams"] }) {
  const sp = await searchParams;
  const [view, page, contact] = await Promise.all([
    resolveThanks({ ref: one(sp.ref), t: one(sp.t), sessionId: one(sp.session_id) }),
    getPage("thankYou"),
    getContact(),
  ]);
  return <ThankYouView view={view} page={page} contact={contact} />;
}

function ThanksSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="bg-vu-cream">
      <div className="wrap py-16 md:py-24">
        <span className="skeleton block size-[76px] rounded-full" />
        <span className="skeleton mt-8 block h-16 w-[70%] max-w-[520px] rounded-2xl" />
        <span className="skeleton mt-4 block h-16 w-[50%] max-w-[380px] rounded-2xl" />
        <span className="skeleton mt-6 block h-5 w-[80%] max-w-[560px] rounded-full" />
      </div>
    </div>
  );
}

export default function ThankYouPage({ searchParams }: PageProps<"/donate/thank-you">) {
  return (
    <Suspense fallback={<ThanksSkeleton />}>
      <ThanksBody searchParams={searchParams} />
    </Suspense>
  );
}
