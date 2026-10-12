import type { Metadata } from "next";
import { Suspense } from "react";
import { HeartCrack, MailWarning } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { UndoUnsubscribe } from "@/components/public/newsletter/UndoUnsubscribe";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { getContact } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { unsubscribeByToken } from "@/lib/server/intake/newsletter";
import { undoUnsubscribe } from "../actions";

// /unsubscribe?token= (public-pages §3.23, PLAN D103, D129): the link in every update email. Opening
// it stops update emails for the address (newsletter and supporter updates; receipts still arrive)
// and offers Undo. The token is read inside Suspense; the shell is static. Never indexed.

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHero variant="plain" eyebrow="Email updates" title="Unsubscribe" crumbs={[{ label: "Unsubscribe" }]} />
      <Section tone="white" pad="md" cv={false} last label="Unsubscribe">
        <div className="mx-auto max-w-[640px]">
          <Suspense
            fallback={
              <div aria-busy="true" className="grid justify-items-center gap-5">
                <span className="sr-only">Updating your preferences…</span>
                <Skeleton className="size-16 rounded-full" />
                <Skeleton className="h-9 w-72 max-w-full" />
              </div>
            }
          >
            <Result searchParams={searchParams} />
          </Suspense>
        </div>
      </Section>
    </>
  );
}

async function Result({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  const [outcome, contact] = await Promise.all([unsubscribeByToken(token), getContact()]);

  if (outcome.state === "unsubscribed" && token) {
    return (
      <div role="status" className="rounded-card-lg bg-cream px-6 py-10 text-center md:px-12 md:py-12">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white text-clay shadow-soft">
          <HeartCrack aria-hidden className="size-7" strokeWidth={2.25} />
        </span>
        <h2 className="mt-5 text-[26px] font-extrabold leading-tight text-ink md:text-[30px]">You&rsquo;ve been unsubscribed.</h2>
        <p className="mx-auto mt-3 max-w-[460px] text-[16px] leading-relaxed text-body">
          We&rsquo;re sorry to see you go. You won&rsquo;t receive our updates any more. If you give, you&rsquo;ll still get your receipts.
        </p>
        <div className="mt-7">
          <UndoUnsubscribe token={token} action={undoUnsubscribe} />
        </div>
        <div className="mt-6">
          <Button href={routes.home} variant="quiet" icon="none">
            Back to the home page
          </Button>
        </div>
      </div>
    );
  }

  if (outcome.state === "unavailable") {
    return (
      <Notice tone="warning" title="We couldn't update your preferences just now" titleAs="h2" live>
        <p>
          Please try the link again in a few minutes, or email{" "}
          <a href={`mailto:${contact.email}`} className="font-bold underline decoration-2 underline-offset-4">
            {contact.email}
          </a>{" "}
          and we&rsquo;ll remove you.
        </p>
      </Notice>
    );
  }

  return (
    <div role="status" className="rounded-card-lg bg-cream px-6 py-10 text-center md:px-12 md:py-12">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-white text-clay-700 shadow-soft">
        <MailWarning aria-hidden className="size-7" strokeWidth={2.25} />
      </span>
      <h2 className="mt-5 text-[26px] font-extrabold leading-tight text-ink md:text-[30px]">This link has expired</h2>
      <p className="mx-auto mt-3 max-w-[460px] text-[16px] leading-relaxed text-body">
        Email{" "}
        <a href={`mailto:${contact.email}`} className="font-bold text-forest underline decoration-2 underline-offset-4">
          {contact.email}
        </a>{" "}
        and we&rsquo;ll remove you.
      </p>
    </div>
  );
}
