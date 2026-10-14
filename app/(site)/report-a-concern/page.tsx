import type { Metadata } from "next";
import { Keyboard, Phone } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { PageHero } from "@/components/layout/PageHero";
import { ConcernForm } from "@/components/public/help/ConcernForm";
import { EmergencyBlock } from "@/components/public/help/EmergencyBlock";
import { EveryChildNote } from "@/components/public/EveryChildNote";
import { eyebrowOf, itemsOf, textOf, titleOf } from "@/components/public/help/page-copy";
import { QuickExit } from "@/components/ui/QuickExit";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { Timeline } from "@/components/ui/Timeline";
import { getContact, getPage, getSafety, getSiteSettings } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { baseUrl } from "@/lib/server/url";
import { submitConcern } from "./actions";

// /report-a-concern (public-pages §3.7, PLAN D79, D94, D95, D108): deliberately calm. One column,
// no doodles, no playful motion. The emergency banner is not dismissible and lists only verified
// numbers. Reports go to the restricted safeguarding collection under a random reference. No
// referrer leaves this page, nothing is kept in the browser, and QuickExit is always one press away.

const FALLBACK_STEPS = [
  { title: "Your report is sent securely." },
  { title: "Authorised safeguarding staff are alerted." },
  { title: "It is reviewed and given a risk level." },
  { title: "Urgent cases are escalated." },
  { title: "Services or authorities are contacted." },
  { title: "Every action is recorded." },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("reportConcern");
  return {
    ...buildMetadata({
      title: page.seo.title ?? "Report a Concern",
      description: page.seo.description ?? "Tell Haven's safeguarding team, in confidence, if you are worried about a child's safety or wellbeing.",
      path: routes.concern(),
      noindex: page.seo.noindex === true,
    }),
    referrer: "no-referrer",
  };
}

export default async function ReportConcernPage() {
  const [page, contact, safety, site] = await Promise.all([getPage("reportConcern"), getContact(), getSafety(), getSiteSettings()]);
  const steps = itemsOf(page, "whatHappens", FALLBACK_STEPS);
  const staffOnly = textOf(page, "whatHappens", "Only approved safeguarding personnel can see reports.");
  const consentBlocks = page.sections.consent?.body ?? [];
  const consent =
    consentBlocks[0] && consentBlocks[0].type === "paragraph"
      ? consentBlocks[0].text
      : "I understand that Haven may share this information with child-protection services or the authorities where needed to keep a child safe, and I have read the [Privacy Policy](/policies/privacy).";

  return (
    <>
      <StudioSlot id="pages.reportConcern">
        <PageHero
          variant="plain"
          art="none"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Get Support", href: routes.getSupport() }, { label: "Report a Concern" }]}
          baseUrl={baseUrl()}
          meta={
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[14px] text-ink">
              <Keyboard aria-hidden className="size-4 text-forest" strokeWidth={2.25} />
              {textOf(page, "quickExit", "Need to leave quickly? Press Shift three times.")}
            </span>
          }
        />
      </StudioSlot>

      <Section tone="white" pad="none" width="form" cv={false} label="Report a concern" className="pb-20 pt-10 md:pb-24 md:pt-14">
        <EmergencyBlock text={safety.emergencyNotice} contacts={safety.emergencyContacts} />
        <EveryChildNote text={site.everyChild} compact className="mt-4" />
        <div className="mt-10 rounded-[30px] border border-line bg-white p-5 shadow-soft sm:p-8">
          <ConcernForm
            action={submitConcern}
            contact={{ phone: contact.phone, phoneHref: contact.phoneHref, email: contact.email }}
            safety={{ text: safety.emergencyNotice, contacts: safety.emergencyContacts }}
            copy={{
              anonymousNote: textOf(page, "anonymous", "Anonymous reports are taken seriously. We won't be able to contact you with questions or updates."),
              consent,
              successTitle: titleOf(page, "success", ["Thank You for", "Speaking Up."]).join(" "),
              nextSteps: steps.map((s) => ({ title: s.title, body: s.text })),
              staffOnly,
            }}
          />
        </div>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[15px] text-body">
          <Phone aria-hidden className="size-4 text-forest" strokeWidth={2.25} />
          Prefer to talk to someone?
          <a href={contact.phoneHref} className="inline-flex min-h-11 items-center font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink">
            Call {contact.phone}
          </a>
        </p>
      </Section>

      <Section tone="paper" pad="md" width="form" labelledBy="concern-next-title" last cvSize={800}>
        <SectionIntro id="concern-next-title" align="left" eyebrow={eyebrowOf(page, "whatHappens", "What Happens Next")} title={titleOf(page, "whatHappens", ["What Happens to", "Your Report"])} reveal={false} />
        <Timeline items={steps.map((s, i) => ({ id: `concern-next-${i}`, title: s.title, body: s.text }))} className="mt-10" />
        <p className="mt-8 rounded-control bg-white px-5 py-4 text-[15px] font-semibold leading-relaxed text-forest shadow-card">{staffOnly}</p>
      </Section>

      <QuickExit />
    </>
  );
}
