import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GiveColumn } from "@/components/donate/GiveColumn";
import { getPage } from "@/lib/content/public";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo/meta";
import { loadGiveColumn } from "./_column";

// /donate: "Where it's needed most" with the "Choose a Cause" list (public-pages §4.1, §4.5). The
// widget and the closing band come from the (give) layout; this page is the left column only.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("donate");
  return buildMetadata({
    title: page.seo.title ?? "Donate",
    description: page.seo.description ?? page.hero.intro ?? "Give to Haven and see exactly where your money goes.",
    path: routes.donate(),
  });
}

export default async function DonatePage() {
  const data = await loadGiveColumn("general");
  if (!data) notFound();
  return <GiveColumn data={data} />;
}
