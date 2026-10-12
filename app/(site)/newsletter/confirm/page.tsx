import type { Metadata } from "next";
import { Suspense } from "react";
import { MailWarning } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/Button";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { getContact } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { confirmNewsletter } from "@/lib/server/intake/newsletter";

// /newsletter/confirm?token= (PLAN D103): the link in the `newsletter_confirm` email. Opening it
// confirms the subscription and shows the welcome on screen. Opening it again says "already". The
// token is read inside Suspense; the shell is static. Never indexed.

export const metadata: Metadata = {
  title: "Confirm Your Subscription",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function NewsletterConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHero variant="plain" art="hearts" eyebrow="Haven updates" title="Your Subscription" crumbs={[{ label: "News", href: routes.news() }, { label: "Confirm" }]} />
      <Section tone="white" pad="md" cv={false} last label="Confirmation">
        <div className="mx-auto max-w-[680px]">
          <Suspense
            fallback={
              <div aria-busy="true" className="grid justify-items-center gap-5">
                <span className="sr-only">Confirming your subscription…</span>
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
  const outcome = await confirmNewsletter(typeof sp.token === "string" ? sp.token : null);

  if (outcome.state === "confirmed" || outcome.state === "already") {
    const name = outcome.firstName ? `, ${outcome.firstName}` : "";
    return (
      <FormSuccess
        title={outcome.state === "confirmed" ? `You're In${name}!` : "You're Already Subscribed"}
        message={
          <p>
            {outcome.state === "confirmed"
              ? "Thank you for confirming. Once a month we'll send one honest update: what changed, where the money went and the families behind it."
              : "You confirmed earlier, so there's nothing more to do. Your updates are on their way."}
          </p>
        }
        next={[
          { title: "One email a month", body: "Real stories and verified numbers, never spam." },
          { title: "Unsubscribe any time", body: "Every email has a one-click link." },
        ]}
        actions={
          <>
            <Button href={routes.news()} variant="forest" icon="arrow">
              Read the Latest News
            </Button>
            <Button href={routes.donate()} variant="outline" icon="heart">
              Donate
            </Button>
          </>
        }
      />
    );
  }

  const contact = await getContact();
  if (outcome.state === "unavailable") {
    return (
      <Notice tone="warning" title="We couldn't confirm your subscription just now" titleAs="h2" live>
        <p>Please try the link again in a few minutes. If it still doesn&rsquo;t work, email {contact.email} and we&rsquo;ll add you.</p>
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
        Confirmation links work for 7 days, and only the newest one counts. Sign up again and we&rsquo;ll send a fresh link.
      </p>
      <div className="mt-7 flex justify-center">
        <Button href={`${routes.news()}#newsletter`} variant="forest">
          Sign Up Again
        </Button>
      </div>
    </div>
  );
}
