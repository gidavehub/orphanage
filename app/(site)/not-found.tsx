import type { Metadata } from "next";
import { blocksToPlain } from "@/components/content/Blocks";
import { NotFoundBody } from "@/components/layout/NotFoundBody";
import { getPage, getSafety } from "@/lib/content/public";

// notFound() inside a site page (unknown slugs, PLAN D5, D8): the site layout already supplies the
// chrome, so this renders only the 404 body (copy from pages.notFound, public-pages §3.23).

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default async function SiteNotFound() {
  const [page, safety] = await Promise.all([getPage("notFound"), getSafety()]);
  const text = blocksToPlain(page.sections.help?.body ?? []);
  return (
    <NotFoundBody
      eyebrow={page.hero.eyebrow}
      title={page.hero.title.join(" ")}
      text={text || undefined}
      emergencyNotice={safety.emergencyNotice}
    />
  );
}
