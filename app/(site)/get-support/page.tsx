import type { Metadata } from "next";
import Link from "next/link";
import { Baby, BookOpen, Briefcase, HeartHandshake, LockKeyhole, Mail, Phone, ShieldAlert, Trash2, UserRound, Users, UsersRound } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { HeartCluster } from "@/components/art/Decor";
import { CtaBand } from "@/components/layout/CtaBand";
import { PageHero } from "@/components/layout/PageHero";
import { EmergencyBlock } from "@/components/public/help/EmergencyBlock";
import { HelpFaq } from "@/components/public/help/HelpFaq";
import { HelpTypeGrid } from "@/components/public/help/HelpTypeGrid";
import { ctaOf, eyebrowOf, itemsOf, textOf, titleOf } from "@/components/public/help/page-copy";
import { StepCards } from "@/components/public/help/StepCards";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Button } from "@/components/ui/Button";
import { IconDisc } from "@/components/ui/IconDisc";
import { Notice } from "@/components/ui/Notice";
import { QuickExit } from "@/components/ui/QuickExit";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { getContact, getFaqs, getPage, getSafety } from "@/lib/content/public";
import { img } from "@/lib/media/pipeline";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { getSupportFormStatus } from "@/lib/server/intake/support";
import { baseUrl } from "@/lib/server/url";

// /get-support (public-pages §3.5): the calm front door for anyone asking for help. Every type of
// help links to the request form with that type chosen; child protection goes to the concern form
// first. Static: page copy, contact, safety and FAQs are cached reads refreshed by their tags.

const WHO_ICONS = [Baby, UsersRound, HeartHandshake, BookOpen, Users, Briefcase];
const PRIVACY_ICONS = [LockKeyhole, UserRound, Trash2];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("getSupport");
  return buildMetadata({
    title: page.seo.title ?? "Get Support",
    description: page.seo.description ?? page.hero.intro ?? "Ask Haven for help or refer a vulnerable child through a confidential request.",
    path: routes.getSupport(),
    noindex: page.seo.noindex === true,
  });
}

export default async function GetSupportPage() {
  const [page, contact, safety, faqs, formStatus] = await Promise.all([getPage("getSupport"), getContact(), getSafety(), getFaqs({ placement: "support" }), getSupportFormStatus()]);
  const request = ctaOf(page, "actions", { label: "Request Support", href: routes.request() });
  const helpTypes = itemsOf(page, "helpTypes", [
    { title: "Child-protection concern", icon: "protection" },
    { title: "Education or school fees", icon: "education" },
    { title: "Medical", icon: "medical" },
    { title: "Psychological or counselling", icon: "psychological" },
    { title: "Legal", icon: "legal" },
    { title: "Food or essential supplies", icon: "food" },
    { title: "Family support", icon: "family" },
    { title: "Other", icon: "other" },
  ]);
  const steps = itemsOf(page, "whatHappens", [
    { title: "Submit securely" },
    { title: "We confirm we've received it", text: "We contact you your preferred way." },
    { title: "We review and verify" },
    { title: "We may ask for more information" },
    { title: "We connect you with support or a referral" },
  ]);
  const reviewLines = (page.sections.whatHappens?.body ?? []).length
    ? textOf(page, "whatHappens", "").split(/\n+/).filter(Boolean)
    : ["Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support.", "Because of fraud, all information is checked and verified."];
  const who = itemsOf(page, "whoCanAsk", [{ title: "Children and young people" }, { title: "Parents" }, { title: "Caregivers" }, { title: "Teachers" }, { title: "Community members" }, { title: "Professionals" }]);
  const privacy = itemsOf(page, "privacy", [
    { title: "Only authorised staff can see your request." },
    { title: "We only ask for what we need." },
    { title: "You can ask us to correct or delete your information." },
  ]);
  const talk = ctaOf(page, "talkFirst", request);

  return (
    <>
      <StudioSlot id="pages.getSupport">
        <PageHero
          variant="plain"
          art="hands"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Get Support" }]}
          baseUrl={baseUrl()}
          actions={
            <>
              <Button href={request.href} variant="marigold-ink" size="lg" className="max-sm:w-full">
                {request.label}
              </Button>
              <Button href={routes.concern()} variant="outline" size="lg" icon="none" className="max-sm:w-full">
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert aria-hidden className="size-4" strokeWidth={2.5} /> Report a Concern
                </span>
              </Button>
            </>
          }
          notice={<EmergencyBlock compact text={safety.emergencyNotice} contacts={safety.emergencyContacts} />}
        />
      </StudioSlot>

      {/* What kind of help do you need? */}
      <Section tone="paper" pad="none" cv={false} labelledBy="help-types-title" className="pb-20 pt-4 md:pb-28 md:pt-6">
        <SectionIntro
          id="help-types-title"
          eyebrow={eyebrowOf(page, "helpTypes", "Choose What You Need")}
          title={titleOf(page, "helpTypes", ["What Kind of Help", "Do You Need?"])}
          intro="Choose the one that fits best. You can explain everything in your own words on the form."
        />
        <div className="mt-12 md:mt-14">
          <HelpTypeGrid items={helpTypes} counsellingOpen={formStatus.open && formStatus.counsellingOpen} />
        </div>
      </Section>

      {/* What happens after you ask */}
      <Section tone="clay" pad="md" labelledBy="what-happens-title" cvSize={1000}>
        {/* The brand marigold script is 2.5:1 on clay: the soft marigold keeps the eyebrow AA (large text). */}
        <SectionIntro
          id="what-happens-title"
          light
          className="[&_.font-script]:text-marigold-100 [&_[data-eyebrow-rule]]:bg-marigold-100"
          eyebrow={eyebrowOf(page, "whatHappens", "What Happens Next")}
          title={titleOf(page, "whatHappens", ["What Happens After You Ask"])}
        />
        <StepCards items={steps} className="mt-12 md:mt-14" />
        <Notice tone="info" title="Please know" className="mx-auto mt-10 max-w-[860px]">
          {reviewLines.map((line) => (
            <p key={line} className="[&+&]:mt-1.5">
              {line}
            </p>
          ))}
        </Notice>
      </Section>

      {/* Who can ask */}
      <Section tone="white" pad="md" labelledBy="who-title" cvSize={800}>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
          <div>
            <SectionIntro id="who-title" align="left" eyebrow={eyebrowOf(page, "whoCanAsk", "Who Can Ask")} title={titleOf(page, "whoCanAsk", ["Anyone Worried About a Child"])} />
            <Reveal as="ul" stagger={0.05} y={16} className="mt-9 flex flex-wrap gap-3">
              {who.map((w, i) => {
                const Icon = WHO_ICONS[i % WHO_ICONS.length];
                return (
                  <li key={w.title} className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-cream-2 py-2 pl-2.5 pr-5 text-[15px] font-bold text-ink">
                    <span aria-hidden className="grid size-8 place-items-center rounded-full bg-mint text-forest">
                      <Icon className="size-4" strokeWidth={2.25} />
                    </span>
                    {w.title}
                  </li>
                );
              })}
            </Reveal>
          </div>
          <Reveal className="relative">
            <div className="relative isolate overflow-hidden rounded-card bg-cream p-7 md:p-9">
              <HeartCluster className="absolute -right-6 -top-6 -z-10 w-[150px] text-marigold-100" />
              <p className="font-script text-[26px] font-bold leading-none text-marigold-ink">{titleOf(page, "youngPeople", ["A Note for Children", "and Young People"]).join(" ")}</p>
              <p className="mt-4 text-[16px] leading-[1.8] text-ink">
                {textOf(
                  page,
                  "youngPeople",
                  "You can ask for help yourself. If you can, ask a trusted adult to help you fill in the form. If you are in danger right now, tell a trusted adult or call the emergency number where you live.",
                )}
              </p>
              <ArrowLink href={request.href} className="mt-5 font-bold">
                Ask for help
              </ArrowLink>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Your privacy */}
      <Section tone="vu-cream" pad="md" labelledBy="privacy-title" cvSize={700}>
        <SectionIntro id="privacy-title" eyebrow={eyebrowOf(page, "privacy", "Your Privacy")} title={titleOf(page, "privacy", ["Your Information Is Safe"])} />
        <Reveal as="ul" stagger={0.08} className="mx-auto mt-12 grid max-w-[1080px] gap-5 md:grid-cols-3">
          {privacy.map((p, i) => (
            <li key={p.title} className="flex items-center gap-5 rounded-card bg-white p-5 shadow-card md:flex-col md:p-7 md:text-center">
              <IconDisc icon={PRIVACY_ICONS[i % PRIVACY_ICONS.length]} size={64} className="max-md:size-[52px]" />
              <div className="min-w-0">
                <p className="text-[17px] font-bold leading-snug text-ink">{p.title}</p>
                {p.text ? <p className="mt-2 text-[15px] leading-relaxed text-body">{p.text}</p> : null}
              </div>
            </li>
          ))}
        </Reveal>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <ArrowLink href={routes.policy("privacy")} className="font-bold">
            Read our Privacy Policy
          </ArrowLink>
          <ArrowLink href={routes.privacyRequest()} className="font-bold">
            Correct or delete your information
          </ArrowLink>
        </div>
      </Section>

      {/* Questions */}
      {faqs.length ? (
        <Section tone="paper" pad="md" width="reading" labelledBy="support-faq-title" cvSize={900}>
          <SectionIntro id="support-faq-title" eyebrow={eyebrowOf(page, "questions", "Questions")} title={titleOf(page, "questions", ["Before You Ask"])} />
          <HelpFaq faqs={faqs} className="mt-10" />
          <p className="mt-8 text-center text-[15px] text-body">
            More answers on our{" "}
            <Link href={routes.faq()} className="font-bold text-forest underline decoration-marigold decoration-2 underline-offset-4 hover:text-ink">
              questions page
            </Link>
            .
          </p>
        </Section>
      ) : null}

      <CtaBand
        variant="safeguarding"
        id="talk-first-title"
        title={titleOf(page, "talkFirst", ["Prefer to Talk First?"]).join(" ")}
        text={textOf(page, "talkFirst", "Call or email our team and we will talk it through with you, in confidence.")}
        emergencyNotice={safety.emergencyNotice}
        hands={[
          { src: img("hand-left"), alt: "", width: 1400, height: 382 },
          { src: img("hand-right"), alt: "", width: 1400, height: 428 },
        ]}
        actions={
          <>
            <Button href={contact.phoneHref} variant="marigold-ink" size="lg" icon="none">
              <span className="inline-flex items-center gap-2">
                <Phone aria-hidden className="size-4" strokeWidth={2.5} /> {contact.phone}
              </span>
            </Button>
            <Button href={`mailto:${contact.email}`} variant="outline-light" size="lg" icon="none">
              <span className="inline-flex items-center gap-2">
                <Mail aria-hidden className="size-4" strokeWidth={2.5} /> Email us
              </span>
            </Button>
            <Button href={talk.href} variant="white-ink" size="lg">
              {talk.label}
            </Button>
          </>
        }
      />

      <QuickExit />
    </>
  );
}
