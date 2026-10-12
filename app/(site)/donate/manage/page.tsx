import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClock, CreditCard, Mail } from "lucide-react";
import { FormAsideCard, FormShell } from "@/components/layout/FormShell";
import { PageHero } from "@/components/layout/PageHero";
import { ManageLinkForm } from "@/components/public/donate/ManageLinkForm";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { getContact } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { features } from "@/lib/server/env";
import { baseUrl } from "@/lib/server/url";
import { requestManageLink } from "./actions";

// /donate/manage (integrations §3.7; PLAN D70): donors who give every month, quarter or year by card
// change or stop their gift through Stripe's secure page, reached by a link we email them. No donor
// accounts. Without card payments the page explains who to email instead.

export const metadata: Metadata = {
  title: "Manage your regular gift",
  description: "Change your card, the amount, or stop your regular gift to Haven.",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ManagePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHero variant="plain" art="hands" eyebrow="Your gift" title="Manage your regular gift" intro="Change your card or the amount, or stop your gift. We’ll email you a secure link." crumbs={[{ label: "Donate", href: routes.donate() }, { label: "Manage your gift" }]} baseUrl={baseUrl()} />
      <Section tone="white" pad="md" cv={false} label="Manage your gift">
        <Suspense fallback={null}>
          <Body searchParams={searchParams} />
        </Suspense>
      </Section>
    </>
  );
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const [sp, contact] = await Promise.all([searchParams, getContact()]);
  const done = sp.done === "1";
  const donations = contact.teamEmails.donations;
  return (
    <FormShell
      form={
        <div className="grid gap-6">
          {done ? (
            <Notice tone="success" title="All done" compact>
              Your changes are saved with our card processor. Thank you for giving to Haven.
            </Notice>
          ) : null}
          {features.stripe ? (
            <ManageLinkForm action={requestManageLink} />
          ) : (
            <Notice tone="info" title="Card payments are being set up" compact>
              To change or stop a regular gift, please email <a className="font-bold underline" href={`mailto:${donations}`}>{donations}</a> and we’ll take care of it.
            </Notice>
          )}
        </div>
      }
      aside={
        <>
          <FormAsideCard title="What you can do">
            <ul className="grid gap-3 text-[15px] text-ink">
              <li className="flex gap-2.5">
                <CreditCard aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" /> Update your card
              </li>
              <li className="flex gap-2.5">
                <CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" /> Change the amount or stop your gift
              </li>
              <li className="flex gap-2.5">
                <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" /> See your past payments
              </li>
            </ul>
          </FormAsideCard>
          <FormAsideCard title="Gave by bank or mobile money?" tone="white">
            <p className="text-[15px] text-body">
              Email <a className="font-bold text-forest underline" href={`mailto:${donations}`}>{donations}</a> and our team will help.
            </p>
          </FormAsideCard>
        </>
      }
    />
  );
}
