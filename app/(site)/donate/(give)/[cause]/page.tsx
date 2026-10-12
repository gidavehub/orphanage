import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { GiveColumn } from "@/components/donate/GiveColumn";
import { getCause, getCauses } from "@/lib/content/public";
import { loadGiveColumn } from "../_column";
import { GENERAL_CAUSE_SLUG, isReservedCauseSlug, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";

// /donate/[cause]: the canonical, shareable page of one cause (public-pages §4.1). Every live cause is
// prerendered; causes created later in the admin render on first visit. A closed cause still renders
// (with "This appeal has closed, thank you!") while the widget gives where it's needed most.
// Unknown slugs are a 404; /donate/general is /donate.
//
// `instant = false` (route segment config, not one of the D5-forbidden exports): params are read at the
// top of the page instead of under a loading.tsx boundary, so an unknown slug renders blocking and
// answers a real HTTP 404. A streamed shell would answer 200 and only then show "not found". Every
// live cause is in generateStaticParams, so those pages stay fully prerendered.
export const instant = false;

export async function generateStaticParams(): Promise<Array<{ cause: string }>> {
  const causes = await getCauses({ liveOnly: true });
  return causes.filter((c) => c.slug !== GENERAL_CAUSE_SLUG && !isReservedCauseSlug(c.slug)).map((c) => ({ cause: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/donate/[cause]">): Promise<Metadata> {
  const { cause: slug } = await params;
  const cause = await getCause(decodeURIComponent(slug));
  if (!cause || cause.slug === GENERAL_CAUSE_SLUG) return { title: "Donate" };
  return buildMetadata({
    title: cause.seo.title ?? `Donate to ${cause.title}`,
    description: cause.seo.description ?? cause.summary,
    path: cause.href,
    noindex: cause.seo.noindex === true,
  });
}

export default async function CausePage({ params }: PageProps<"/donate/[cause]">) {
  const { cause: raw } = await params;
  const slug = decodeURIComponent(raw).toLowerCase();
  if (slug === GENERAL_CAUSE_SLUG) permanentRedirect(routes.donate());
  if (isReservedCauseSlug(slug)) notFound();
  const data = await loadGiveColumn(slug);
  if (!data) notFound();
  return <GiveColumn data={data} />;
}
