import type { Metadata } from "next";
import { Mail, Phone, ShieldAlert } from "lucide-react";
import { blocksToPlain } from "@/components/content/Blocks";
import { StudioSlot } from "@/components/content/StudioSlot";
import { FormAsideCard, FormShell } from "@/components/layout/FormShell";
import { PageHero } from "@/components/layout/PageHero";
import { ShareStoryForm, type ShareStoryCopy } from "@/components/public/stories/ShareStoryForm";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { Timeline } from "@/components/ui/Timeline";
import { getContact, getPage, getProgrammes } from "@/lib/content/public";
import { isRouteKey, routeHref, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { publicUploadsAvailable } from "@/lib/server/intake/upload";
import { shareStory } from "./actions";

// /stories/share (public-pages §3.14, PLAN D58): the calm "Share your story" form. Copy comes from
// pages.shareStory; the form posts to a Server Action that runs the intake pipeline and answers with
// the HVN-SS reference. The optional adult-only photo goes through /api/uploads (quarantine, EXIF
// stripped) when storage is connected; otherwise the team asks for it later. No CtaBand after a form that may carry personal stories (design-system §3.1).

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("shareStory");
  return buildMetadata({
    title: page.seo.title ?? "Share Your Story",
    description: page.seo.description ?? page.hero.intro ?? "Share your story with Haven.",
    path: routes.shareStory(),
    noindex: page.seo.noindex === true,
  });
}

export default async function ShareStoryPage() {
  const [page, programmes, contact] = await Promise.all([getPage("shareStory"), getProgrammes(), getContact()]);
  const s = page.sections;
  const consents = s.consents?.items ?? [];
  const nextSteps = (s.next?.items ?? []).map((i) => ({ title: i.title, body: i.text }));
  const copy: ShareStoryCopy = {
    photos: blocksToPlain(s.photos?.body ?? []) || "Please don't send photos of children.",
    publishConsent:
      consents[0]?.text ?? "I give Haven permission to edit and publish my story, without children's names or exact locations.",
    guardianConsent: consents[1]?.text ?? "I am the child's parent or legal guardian.",
    successTitle: s.success?.title?.join(" ") ?? "Thank You for Sharing",
    successMessage: blocksToPlain(s.success?.body ?? []) || "A member of our team will read your story and contact you before anything is published.",
    next: nextSteps,
  };
  const safetyCta = s.safety?.cta && isRouteKey(s.safety.cta.to) ? { label: s.safety.cta.label, href: routeHref(s.safety.cta.to) } : { label: "Report a Concern", href: routes.concern() };
  const storyEmail = contact.teamEmails.media || contact.email;

  return (
    <>
      <StudioSlot id="pages.shareStory">
        <PageHero
          variant="plain"
          art="hands"
          eyebrow={page.hero.eyebrow}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Stories", href: routes.stories() }, { label: page.hero.title.join(" ") }]}
        />
      </StudioSlot>

      <Section tone="white" pad="md" cv={false} last label="Share your story form">
        <FormShell
          form={
            <ShareStoryForm
              action={shareStory}
              copy={copy}
              uploadUrl={publicUploadsAvailable() ? "/api/uploads" : null}
              programmes={programmes.map((p) => ({ id: p.id, title: p.title }))}
              privacyHref={routes.policy("privacy")}
              storiesHref={routes.stories()}
              homeHref={routes.home}
            />
          }
          aside={
            <>
              {nextSteps.length ? (
                <FormAsideCard title={s.next?.title?.join(" ") ?? "How We Look After Your Story"}>
                  <Timeline items={nextSteps} className="mt-1" />
                </FormAsideCard>
              ) : null}
              <FormAsideCard title={s.safety?.title?.join(" ") ?? "Is a Child in Danger?"} tone="deep">
                <p className="flex gap-3">
                  <ShieldAlert aria-hidden className="mt-1 size-5 shrink-0 text-marigold" strokeWidth={2.25} />
                  <span>{blocksToPlain(s.safety?.body ?? []) || "Please don't use this form. Tell our safeguarding team straight away."}</span>
                </p>
                <Button href={safetyCta.href} variant="marigold-ink" size="sm" icon="arrow" className="mt-5">
                  {safetyCta.label}
                </Button>
              </FormAsideCard>
              <FormAsideCard title={s.talk?.title?.join(" ") ?? "Prefer to Talk?"} tone="white">
                <p>{blocksToPlain(s.talk?.body ?? []) || "You can also tell us your story by email or phone."}</p>
                <ul className="mt-4 grid gap-2.5">
                  <li>
                    <a href={`mailto:${storyEmail}`} className="inline-flex min-h-11 items-center gap-2.5 break-all font-bold text-forest underline-offset-4 hover:underline">
                      <Mail aria-hidden className="size-[18px] shrink-0" strokeWidth={2.25} />
                      {storyEmail}
                    </a>
                  </li>
                  {contact.phone ? (
                    <li>
                      <a href={contact.phoneHref} className="inline-flex min-h-11 items-center gap-2.5 font-bold text-forest underline-offset-4 hover:underline">
                        <Phone aria-hidden className="size-[18px] shrink-0" strokeWidth={2.25} />
                        {contact.phone}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </FormAsideCard>
            </>
          }
        />
      </Section>
    </>
  );
}
