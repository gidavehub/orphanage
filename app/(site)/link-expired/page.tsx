import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { getContact } from "@/lib/content/public";
import { routes } from "@/lib/routes";

// /link-expired: where an old, revoked or mistyped secure link lands (report delivery /r/<token>).
// Static and never indexed; it says what to do next instead of showing an error.

export const metadata: Metadata = {
  title: "This Link Has Expired",
  robots: { index: false, follow: false },
};

export default async function LinkExpiredPage() {
  const contact = await getContact();
  const email = contact.teamEmails.media || contact.email;
  return (
    <>
      <PageHero variant="plain" art="hands" eyebrow="Secure link" title="This Link Has Expired" crumbs={[{ label: "Link expired" }]} />
      <Section tone="white" pad="md" last label="What to do next">
        <div className="mx-auto flex max-w-[640px] flex-col items-center text-center">
          <span aria-hidden className="grid size-16 place-items-center rounded-full bg-marigold/15 text-marigold-ink">
            <Clock className="size-8" strokeWidth={2} />
          </span>
          <p className="mt-6 text-[18px] leading-relaxed text-ink">
            For your safety, download links work for 7 days and can only be used by the person they were sent to.
          </p>
          <p className="mt-3 text-[16px] leading-relaxed text-body">
            Ask for the report again and we&rsquo;ll send you a fresh link, or email{" "}
            <a href={`mailto:${email}`} className="break-all font-bold text-forest underline-offset-4 hover:underline">
              {email}
            </a>
            .
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href={routes.requestReport()} variant="forest">
              Request It Again
            </Button>
            <Button href={routes.resources()} variant="outline" icon="none">
              Browse Resources
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
