import type { Metadata } from "next";
import { Clock3, Mail, Phone, ShieldAlert } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { FormAsideCard, FormShell } from "@/components/layout/FormShell";
import { PageHero } from "@/components/layout/PageHero";
import { EmergencyBlock } from "@/components/public/help/EmergencyBlock";
import { itemsOf, textOf, titleOf } from "@/components/public/help/page-copy";
import { SupportRequestForm } from "@/components/public/help/SupportRequestForm";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { QuickExit } from "@/components/ui/QuickExit";
import { Section } from "@/components/ui/Section";
import { Timeline } from "@/components/ui/Timeline";
import { getContact, getPage, getProgrammes, getSafety } from "@/lib/content/public";
import type { ProgrammeNoticeKind } from "@/lib/content/schema";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { getSupportFormStatus } from "@/lib/server/intake/support";
import { publicUploadsAvailable } from "@/lib/server/intake/upload";
import { baseUrl } from "@/lib/server/url";
import { submitSupportRequest } from "./actions";

// /get-support/request (public-pages §3.6, PLAN D79–D82, D95–D96): the confidential four-step
// request. The page is static; `?type=` is read client-side inside Suspense by the form. Sending runs
// the intake pipeline in a Server Action and answers with the HVN-SR reference (or, for danger and
// child protection, the concern's reference, with the same screen, D79). No drafts: a leave guard.

const FALLBACK_NEXT = [
  { title: "We confirm we've received it", text: "We contact you your preferred way." },
  { title: "We review and verify" },
  { title: "We connect you with support or a referral" },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("requestSupport");
  return buildMetadata({
    title: page.seo.title ?? "Request Support",
    description: page.seo.description ?? "A confidential request for support from Haven.",
    path: routes.request(),
    noindex: page.seo.noindex === true,
  });
}

export default async function RequestSupportPage() {
  const [page, contact, safety, programmes, status] = await Promise.all([getPage("requestSupport"), getContact(), getSafety(), getProgrammes(), getSupportFormStatus()]);
  const notice = (kind: ProgrammeNoticeKind, fallback: string) => programmes.flatMap((p) => p.notices).find((n) => n.kind === kind)?.text ?? fallback;
  const nextSteps = itemsOf(page, "success", FALLBACK_NEXT);
  const contactCard = { phone: contact.phone, phoneHref: contact.phoneHref, email: contact.email };

  return (
    <>
      <StudioSlot id="pages.requestSupport">
        <PageHero
          variant="plain"
          art="none"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Get Support", href: routes.getSupport() }, { label: "Request Support" }]}
          baseUrl={baseUrl()}
          className="[&>div]:lg:py-16"
        />
      </StudioSlot>

      <Section tone="paper" pad="none" cv={false} label="Request support form" last innerClassName="-mt-2">
        <FormShell
          form={
            <div className="grid gap-6 [&>*]:min-w-0">
              <EmergencyBlock text={safety.emergencyNotice} contacts={safety.emergencyContacts} compact />
              <div className="rounded-[30px] bg-white p-5 shadow-soft sm:p-8">
                {status.open ? (
                  <SupportRequestForm
                    action={submitSupportRequest}
                    uploadUrl={publicUploadsAvailable() ? "/api/uploads" : null}
                    counsellingOpen={status.counsellingOpen}
                    contact={contactCard}
                    safety={{ text: safety.emergencyNotice, contacts: safety.emergencyContacts }}
                    responseTime={contact.responseTimes.support}
                    copy={{
                      explanationHint: textOf(page, "explanationHint", "Please don't include children's full names or exact home addresses. We'll ask for details we need later."),
                      documentsHint: textOf(page, "documentsHint", "Only upload documents if they help explain your situation. Files are stored securely and only authorised staff can see them."),
                      reviewNote: textOf(page, "review", "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support."),
                      successTitle: titleOf(page, "success", ["Thank You.", "We've Received Your Request."]).join(" "),
                      successNote: textOf(page, "success", "Please keep this reference."),
                      nextSteps: nextSteps.map((s) => ({ title: s.title, body: s.text })),
                      medicalDisclaimer: notice("medical", "We do not provide medical diagnoses or replace professional medical advice."),
                      legalDisclaimer: notice("legal", "General website information is not legal advice."),
                      counsellingDisclaimer: notice("assessment", "Assessments are made only by qualified professionals. There are no automated diagnoses."),
                    }}
                  />
                ) : (
                  <Notice tone="warning" title="The request form is paused for now" titleAs="h2">
                    <p>{status.closedMessage ?? "We can't take new requests through the website at the moment."}</p>
                    <p className="mt-2">
                      Please call us on{" "}
                      <a href={contact.phoneHref} className="font-bold text-forest underline underline-offset-4">
                        {contact.phone}
                      </a>{" "}
                      or email{" "}
                      <a href={`mailto:${contact.email}`} className="font-bold text-forest underline underline-offset-4">
                        {contact.email}
                      </a>
                      .
                    </p>
                  </Notice>
                )}
              </div>
            </div>
          }
          aside={
            <>
              <FormAsideCard title="What Happens Next">
                <Timeline items={nextSteps.map((s, i) => ({ id: `next-${i}`, title: s.title, body: s.text }))} />
                <p className="mt-5 flex items-start gap-2.5 border-t border-marigold-line pt-4 text-[14px]">
                  <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-ink" strokeWidth={2.25} />
                  <span>We aim to reply within {contact.responseTimes.support}.</span>
                </p>
              </FormAsideCard>
              <FormAsideCard title="Prefer to Talk?" tone="white">
                <p>Call or email us and we&apos;ll help you, in confidence.</p>
                <p className="mt-4 flex items-center gap-2.5">
                  <Phone aria-hidden className="size-4 shrink-0 text-forest" strokeWidth={2.25} />
                  <a href={contact.phoneHref} className="inline-flex min-h-11 items-center font-bold text-ink hover:text-forest">
                    {contact.phone}
                  </a>
                </p>
                <p className="flex items-center gap-2.5">
                  <Mail aria-hidden className="size-4 shrink-0 text-forest" strokeWidth={2.25} />
                  <a href={`mailto:${contact.email}`} className="inline-flex min-h-11 items-center break-all font-bold text-ink hover:text-forest">
                    {contact.email}
                  </a>
                </p>
                {contact.hours ? <p className="mt-2 text-[14px]">{contact.hours}</p> : null}
              </FormAsideCard>
              <FormAsideCard title="Is a Child Being Harmed?" tone="deep">
                <p>If a child is being harmed or is at risk, please use our confidential concern form. It goes straight to our safeguarding team.</p>
                <Button href={routes.concern()} variant="marigold-ink" size="sm" icon="none" className="mt-5">
                  <span className="inline-flex items-center gap-2">
                    <ShieldAlert aria-hidden className="size-4" strokeWidth={2.5} /> Report a Concern
                  </span>
                </Button>
              </FormAsideCard>
            </>
          }
        />
      </Section>

      <QuickExit />
    </>
  );
}
