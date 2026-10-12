import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { StudioSlot } from "@/components/content/StudioSlot";
import { FormAsideCard, FormShell } from "@/components/layout/FormShell";
import { PageHero } from "@/components/layout/PageHero";
import { itemsOf, textOf } from "@/components/public/help/page-copy";
import { ReportRequestForm } from "@/components/public/resources/ReportRequestForm";
import { Section } from "@/components/ui/Section";
import { Timeline } from "@/components/ui/Timeline";
import { getContact, getPage } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { getResourceOptions } from "@/lib/server/public/resources";
import { requestReport } from "./actions";

// /request-a-report (public-pages §3.11, PLAN D59): the report picker (`?report=` preselects it
// client-side, so the page stays static), the request fields, and the HVN-RR success screen. A free
// report swaps the form for its download.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("requestReport");
  return buildMetadata({
    title: page.seo.title ?? "Request a Report",
    description: page.seo.description ?? page.hero.intro ?? "Ask Haven for a report that is shared on request.",
    path: routes.requestReport(),
    noindex: page.seo.noindex === true,
  });
}

export default async function RequestReportPage() {
  const [page, contact, reports] = await Promise.all([getPage("requestReport"), getContact(), getResourceOptions()]);
  const steps = itemsOf(page, "steps", ["Request", "Review", "Approval", "Emailed to you"].map((title) => ({ title })));
  const reportsEmail = contact.teamEmails.media || contact.email;

  return (
    <>
      <StudioSlot id="pages.requestReport">
        <PageHero
          variant="plain"
          art="hands"
          eyebrow={page.hero.eyebrow ?? "Resources"}
          title={page.hero.title}
          intro={page.hero.intro}
          crumbs={[{ label: "Resources", href: routes.resources() }, { label: "Request a Report" }]}
        />
      </StudioSlot>

      <Section tone="white" pad="md" cv={false} last label="Report request form">
        <FormShell
          form={
            <ReportRequestForm
              action={requestReport}
              reports={reports}
              contact={{ phone: contact.phone, email: contact.email }}
              responseTime={contact.responseTimes.reportRequest}
              freeDownloadText={textOf(page, "freeDownload", "Good news: this one is free to download.")}
              links={{ privacy: routes.policy("privacy"), resources: routes.resources() }}
            />
          }
          aside={
            <>
              <FormAsideCard title="How It Works">
                <Timeline items={steps.map((s) => ({ title: s.title, body: s.text }))} className="mt-1" />
              </FormAsideCard>
              <FormAsideCard title="Questions About a Report?" tone="white">
                <p>Write to us and we&rsquo;ll help you find the right one.</p>
                <a href={`mailto:${reportsEmail}`} className="mt-4 inline-flex min-h-11 items-center gap-2.5 break-all font-bold text-forest underline-offset-4 hover:underline">
                  <Mail aria-hidden className="size-[18px] shrink-0" strokeWidth={2.25} />
                  {reportsEmail}
                </a>
              </FormAsideCard>
            </>
          }
        />
      </Section>
    </>
  );
}
