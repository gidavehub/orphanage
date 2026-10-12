import type { Metadata } from "next";
import { Clock3, LockKeyhole, Mail } from "lucide-react";
import { FormAsideCard, FormShell } from "@/components/layout/FormShell";
import { PageHero } from "@/components/layout/PageHero";
import { itemsOf, textOf } from "@/components/public/about/page-copy";
import { PrivacyRequestForm } from "@/components/public/policies/PrivacyRequestForm";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Section } from "@/components/ui/Section";
import { Timeline } from "@/components/ui/Timeline";
import { getContact, getPage } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";
import { sendDataRequest } from "./actions";

// /privacy/request (PLAN D104; data-model §11.5): ask Haven to show, correct or delete what it holds,
// or to stop contacting you. The page is static; the form posts to a Server Action. Nothing starts
// until the requester confirms their email address (/privacy/request/verify).

const FALLBACK_STEPS = [
  { title: "Send your request" },
  { title: "Confirm your email", text: "We send a link to the address you give us." },
  { title: "We find your records" },
  { title: "We act and reply within 30 days" },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("privacyRequest");
  return buildMetadata({
    title: page.seo.title ?? "Privacy request",
    description: page.seo.description ?? page.hero.intro ?? "Ask Haven to show you, correct or delete the information we hold about you.",
    path: routes.privacyRequest(),
  });
}

export default async function PrivacyRequestPage() {
  const [page, contact] = await Promise.all([getPage("privacyRequest"), getContact()]);
  const items = itemsOf(page, "steps");
  const steps = items.length ? items : FALLBACK_STEPS;
  const privacyEmail = contact.teamEmails.privacy;

  return (
    <>
      <PageHero
        variant="plain"
        art="hands"
        eyebrow={page.hero.eyebrow}
        title={page.hero.title}
        intro={page.hero.intro}
        crumbs={[{ label: "Policies", href: routes.policies() }, { label: "Privacy Policy", href: routes.policy("privacy") }, { label: "Privacy request" }]}
        baseUrl={baseUrl()}
      />

      <Section tone="white" pad="md" cv={false} label="Privacy request form">
        <FormShell
          form={
            <PrivacyRequestForm
              action={sendDataRequest}
              checkEmail={textOf(page, "checkEmail", "Please check your email. Your request starts once you open the confirmation link we've sent you.")}
              steps={steps}
              privacyEmail={privacyEmail}
              policyHref={routes.policy("privacy")}
            />
          }
          aside={
            <>
              <FormAsideCard title={page.sections.steps?.eyebrow ?? "How it works"}>
                <Timeline items={steps.map((s, i) => ({ id: `step-${i}`, title: s.title, body: s.text }))} />
              </FormAsideCard>
              <FormAsideCard title="Prefer to write to us?" tone="white">
                <p className="flex items-start gap-2.5">
                  <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold-ink" strokeWidth={2.25} />
                  <a href={`mailto:${privacyEmail}`} className="break-all font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink">
                    {privacyEmail}
                  </a>
                </p>
                <p className="mt-3 flex items-start gap-2.5">
                  <Clock3 aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold-ink" strokeWidth={2.25} />
                  <span>We reply to every privacy request within 30 days.</span>
                </p>
              </FormAsideCard>
              <FormAsideCard title="What we may need to keep">
                <p className="flex items-start gap-2.5">
                  <LockKeyhole aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" strokeWidth={2.25} />
                  <span>
                    The law asks us to keep some records for a time, such as gift receipts and safeguarding reports. When that applies we restrict them, stop all contact and
                    tell you why.
                  </span>
                </p>
                <ArrowLink href={`${routes.policy("privacy")}#retention-periods`} className="mt-4 font-bold">
                  How long we keep information
                </ArrowLink>
              </FormAsideCard>
            </>
          }
        />
      </Section>
    </>
  );
}
