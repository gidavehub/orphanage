import type { Metadata } from "next";
import { Suspense } from "react";
import { MailWarning, RefreshCcw } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { textOf, titleOf } from "@/components/public/about/page-copy";
import { Button } from "@/components/ui/Button";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { getContact, getPage } from "@/lib/content/public";
import type { PageView } from "@/lib/content/types";
import { routes } from "@/lib/routes";
import { verifyDataRequest } from "@/lib/server/intake/dataRequest";

// /privacy/request/verify?token= (PLAN D104): the link in the `data_request_verify` email. Opening it
// confirms the request (unverified → verified) and starts the 30-day clock for the team. The token is
// read inside Suspense (Cache Components); the shell around it is static. Never indexed.

export const metadata: Metadata = {
  title: "Confirm your privacy request",
  robots: { index: false, follow: false },
};

export default async function VerifyPrivacyRequestPage({ searchParams }: PageProps<"/privacy/request/verify">) {
  const page = await getPage("privacyRequest");
  return (
    <>
      <PageHero
        variant="plain"
        eyebrow={page.hero.eyebrow}
        title="Your Privacy Request"
        crumbs={[{ label: "Policies", href: routes.policies() }, { label: "Privacy request", href: routes.privacyRequest() }, { label: "Confirm" }]}
      />
      <Section tone="white" pad="md" cv={false} label="Confirmation">
        <div className="mx-auto max-w-[680px]">
          <Suspense fallback={<VerifySkeleton />}>
            <VerifyResult searchParams={searchParams} page={page} />
          </Suspense>
        </div>
      </Section>
    </>
  );
}

function VerifySkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid justify-items-center gap-5 text-center">
      <span className="sr-only">Confirming your request…</span>
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}

async function VerifyResult({ searchParams, page }: { searchParams: PageProps<"/privacy/request/verify">["searchParams"]; page: PageView }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  const outcome = await verifyDataRequest(token);

  const next = [
    { id: "find", title: "We find your records", body: "Our privacy lead searches every place your details could be." },
    { id: "act", title: "We act and reply within 30 days", body: "We'll email you to say what we did, or why some records must be kept." },
  ];

  if (outcome.state === "verified" || outcome.state === "already") {
    const verified = outcome.state === "verified";
    return (
      <FormSuccess
        title={verified ? titleOf(page, "verified", ["Thank You. Your Request", "Is Confirmed."]).join(" ") : "Already Confirmed"}
        reference={outcome.reference}
        message={
          verified
            ? textOf(page, "verified", "Our team will reply within 30 days.")
            : "Thank you. You confirmed this request earlier, and our team is already working on it. We'll reply within 30 days of your request."
        }
        next={next}
        actions={
          <>
            <Button href="/" variant="forest">
              Back to the home page
            </Button>
            <Button href={routes.policy("privacy")} variant="outline" icon="none">
              Read our Privacy Policy
            </Button>
          </>
        }
      />
    );
  }

  if (outcome.state === "unavailable") {
    const contact = await getContact();
    return (
      <Notice tone="warning" title="We couldn't confirm your request just now" titleAs="h2" live>
        <p>
          Please try the link again in a few minutes. If it still doesn&rsquo;t work, email{" "}
          <a href={`mailto:${contact.teamEmails.privacy}`} className="font-bold underline decoration-2 underline-offset-4">
            {contact.teamEmails.privacy}
          </a>{" "}
          and we&rsquo;ll confirm it for you.
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
        {textOf(page, "expired", "This link has expired. Please send your request again.")} Confirmation links work for 7 days, and only the newest one counts.
      </p>
      <div className="mt-7 flex justify-center">
        <Button href={routes.privacyRequest()} variant="forest" icon="none" iconFirst>
          <RefreshCcw aria-hidden className="size-4" strokeWidth={2.5} />
          Send the request again
        </Button>
      </div>
    </div>
  );
}
