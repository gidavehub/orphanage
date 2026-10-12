import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Download, FileText, Lock, Tag } from "lucide-react";
import { Blocks } from "@/components/content/Blocks";
import { PageHero } from "@/components/layout/PageHero";
import { textOf } from "@/components/public/help/page-copy";
import { ReportRequestForm } from "@/components/public/resources/ReportRequestForm";
import { cardProps, disclaimerFor, fileSize, isoDay, publishedLabel } from "@/components/public/resources/format";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { Timeline } from "@/components/ui/Timeline";
import { ResourceCard } from "@/components/ui/cards/ResourceCard";
import { getContact, getPage } from "@/lib/content/public";
import type { Block } from "@/lib/content/schema";
import type { Resolved } from "@/lib/content/types";
import type { ResourceSummary } from "@/lib/model/dto";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { getResource, getResourceSlugs, getResources } from "@/lib/server/public/resources";
import { absolute } from "@/lib/server/url";
import { requestReport } from "../../request-a-report/actions";

// /resources/[slug] (public-pages §3.10, PLAN D101, D59): the document hero (category, date, file
// facts, access), the cover beside the executive summary, then either the download button (public)
// or the request timeline with the inline ReportRequestForm, the report fixed (controlled). Medical
// and legal items carry their disclaimer. Three related items close the page.

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getResourceSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/resources/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const r = await getResource(decodeURIComponent(slug));
  if (!r) return { title: "Resource not found" };
  return buildMetadata({
    title: r.title,
    description: r.shortDescription || `${RESOURCE_CATEGORY_LABEL[r.category]} from Haven.`,
    path: routes.resource(r.slug),
    image: r.cover?.src,
  });
}

function hrefsOf(r: ResourceSummary) {
  return {
    href: routes.resource(r.slug),
    ...(r.access === "public" && r.file ? { downloadHref: routes.resourceDownload(r.slug) } : {}),
    ...(r.access === "controlled" ? { requestHref: routes.requestReport(r.slug) } : {}),
  };
}

export default async function ResourcePage({ params }: PageProps<"/resources/[slug]">) {
  const { slug: raw } = await params;
  const r = await getResource(decodeURIComponent(raw));
  if (!r) notFound();

  const [page, contact, sameCategory] = await Promise.all([getPage("requestReport"), getContact(), getResources({ category: r.category })]);
  const related = sameCategory.items.filter((x) => x.slug !== r.slug).slice(0, 3);
  const isPublic = r.access === "public";
  const disclaimer = disclaimerFor(r.category);
  const summary = r.executiveSummary as Resolved<Block>[];
  const fileFacts = r.file ? `PDF${r.file.pageCount ? ` · ${r.file.pageCount} pages` : ""} · ${fileSize(r.file.sizeBytes)}` : null;

  const meta = (
    <>
      <Link
        href={routes.resources({ category: r.category })}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-marigold-100 px-4 font-grotesk text-[13px] font-semibold uppercase tracking-[0.08em] text-umber transition-colors hover:bg-marigold hover:text-night"
      >
        <Tag aria-hidden className="size-3.5" strokeWidth={2.5} />
        {RESOURCE_CATEGORY_LABEL[r.category]}
      </Link>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays aria-hidden className="size-4 text-marigold-ink" />
        <time dateTime={isoDay(r.publicationDate)}>{publishedLabel(r.publicationDate)}</time>
      </span>
      {fileFacts ? (
        <span className="inline-flex items-center gap-1.5">
          <FileText aria-hidden className="size-4 text-marigold-ink" />
          {fileFacts}
        </span>
      ) : null}
      <span className={isPublic ? "inline-flex items-center gap-1.5 font-bold text-forest" : "inline-flex items-center gap-1.5 font-bold text-clay"}>
        {isPublic ? <Download aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
        {isPublic ? "Free download" : "On request"}
      </span>
    </>
  );

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Report",
          name: r.title,
          description: r.shortDescription,
          ...(r.publicationDate ? { datePublished: new Date(r.publicationDate).toISOString().slice(0, 10) } : {}),
          inLanguage: r.language,
          isAccessibleForFree: isPublic,
          publisher: { "@type": "NGO", name: "Haven", url: absolute("/") },
          url: absolute(routes.resource(r.slug)),
        }}
      />
      <PageHero variant="article" eyebrow={RESOURCE_CATEGORY_LABEL[r.category]} title={r.title} intro={r.shortDescription} meta={meta} crumbs={[{ label: "Resources", href: routes.resources() }, { label: r.title }]} />

      <Section tone="white" pad="md" cv={false} label="Report">
        <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="paper relative aspect-[3/4] overflow-hidden rounded-card shadow-card">
              {r.cover ? (
                <Image src={r.cover.src} alt={r.cover.alt} fill sizes="(min-width:1024px) 360px, 90vw" className="object-cover" priority />
              ) : (
                <span className="absolute inset-0 grid place-items-center">
                  <FileText aria-hidden className="size-24 text-forest/35" strokeWidth={1.25} />
                </span>
              )}
            </div>
            {r.placeholder ? <p className="mt-3 text-[13px] italic text-body">This report is being prepared. Ask for it now and we&rsquo;ll send it when it&rsquo;s ready.</p> : null}
          </div>

          <div className="min-w-0">
            <h2 className="text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">Executive Summary</h2>
            <div className="mt-5">
              {summary.length ? (
                <Blocks blocks={summary} size="md" measure={false} />
              ) : (
                <p className="text-[17px] leading-relaxed text-body">{r.shortDescription || "A summary will be added soon."}</p>
              )}
            </div>
            {disclaimer ? (
              <Notice tone="disclaimer" compact className="mt-8">
                {disclaimer}
              </Notice>
            ) : null}

            {isPublic ? (
              <div className="mt-10 rounded-card-lg bg-mint p-7 md:p-9">
                <p className="text-[18px] font-extrabold text-ink">Free to download</p>
                <p className="mt-2 text-[15px] leading-relaxed text-body">Share it with anyone who could use it.</p>
                {r.downloadHref ? (
                  <a href={r.downloadHref} className="mt-6 inline-flex h-[52px] items-center gap-2.5 rounded-full bg-forest px-7 text-[15px] font-bold text-white transition-colors hover:bg-deep">
                    <Download aria-hidden className="size-[18px]" strokeWidth={2.5} />
                    Download PDF{r.file ? ` (${fileSize(r.file.sizeBytes)})` : ""}
                  </a>
                ) : (
                  <p className="mt-4 text-[15px] font-semibold text-ink">The file is being prepared. Please check back soon.</p>
                )}
              </div>
            ) : (
              <div id="request" className="mt-10 scroll-mt-28 rounded-card-lg border border-line bg-white p-5 shadow-soft sm:p-8">
                <p className="flex items-center gap-2 text-[18px] font-extrabold text-ink">
                  <Lock aria-hidden className="size-5 text-clay" strokeWidth={2.5} /> This report is shared on request.
                </p>
                <Timeline
                  className="mt-6"
                  items={[
                    { title: "Request", body: "Tell us who you are and why you need it." },
                    { title: "Review", body: "Our team reads every request." },
                    { title: "Approval", body: "A report manager approves it." },
                    { title: "Emailed to you", body: "A secure link that works for 7 days." },
                  ]}
                />
                <div className="mt-8 border-t border-line pt-8">
                  <ReportRequestForm
                    action={requestReport}
                    reports={[]}
                    locked={{ slug: r.slug, title: r.title, category: r.category, access: r.access, downloadHref: null }}
                    contact={{ phone: contact.phone, email: contact.email }}
                    responseTime={contact.responseTimes.reportRequest}
                    freeDownloadText={textOf(page, "freeDownload", "Good news: this one is free to download.")}
                    links={{ privacy: routes.policy("privacy"), resources: routes.resources() }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {related.length ? (
        <Section tone="paper" pad="md" labelledBy="related-title" cvSize={800}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="related-title" className="text-[26px] font-extrabold leading-tight text-ink md:text-[32px]">
              More in {RESOURCE_CATEGORY_LABEL[r.category]}
            </h2>
            <Button href={routes.resources({ category: r.category })} variant="outline" size="sm">
              See All
            </Button>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((x) => (
              <li key={x.id} className="grid">
                <ResourceCard {...cardProps(x, hrefsOf(x))} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section tone="cream" pad="md" last label="Looking for something else">
        <div className="mx-auto flex max-w-[860px] flex-col items-center gap-5 text-center">
          <h2 className="font-display text-[34px] uppercase leading-[1.02] text-ink md:text-[46px]">Looking for Something Else?</h2>
          <p className="max-w-[540px] text-[16px] leading-relaxed text-body">Browse the full library, or tell us about a report that isn&rsquo;t listed.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href={routes.resources()} variant="forest">
              All Resources
            </Button>
            <Button href={routes.requestReport()} variant="outline" icon="none">
              Request a Report
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
