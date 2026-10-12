import type { Metadata } from "next";
import { blocksToPlain } from "@/components/content/Blocks";
import { NotFoundBody } from "@/components/layout/NotFoundBody";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { SkipLink } from "@/components/layout/SkipLink";
import { getPage, getSiteChrome } from "@/lib/content/public";
import { SmoothScroll } from "@/lib/motion/SmoothScroll";

// Unmatched URLs (PLAN D8). This file renders inside the ROOT layout only, never inside
// app/(site)/layout.tsx, so it brings the site chrome itself (public-pages §1.5 gotcha).
// notFound() inside site pages renders app/(site)/not-found.tsx instead.

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const [chrome, page] = await Promise.all([getSiteChrome(), getPage("notFound")]);
  const text = blocksToPlain(page.sections.help?.body ?? []);
  return (
    <>
      <SkipLink />
      <SmoothScroll>
        <SiteChrome chrome={chrome}>
          <NotFoundBody
            eyebrow={page.hero.eyebrow}
            title={page.hero.title.join(" ")}
            text={text || undefined}
            emergencyNotice={chrome.safety.emergencyNotice}
          />
        </SiteChrome>
      </SmoothScroll>
    </>
  );
}
