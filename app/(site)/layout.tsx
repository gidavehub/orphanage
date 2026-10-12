import { Suspense } from "react";
import { SiteAnalytics } from "@/components/analytics/SiteAnalytics";
import { PreviewBanner } from "@/components/content/PreviewBanner";
import { StudioBridgeSlot } from "@/components/content/StudioBridgeSlot";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { SkipLink } from "@/components/layout/SkipLink";
import { ToastProvider } from "@/components/ui/Toast";
import { exitPreview } from "@/lib/content/actions";
import { getSiteChrome } from "@/lib/content/public";
import { RouteScrollReset } from "@/lib/motion/RouteScrollReset";
import { SmoothScroll } from "@/lib/motion/SmoothScroll";

// The public site's layout (PLAN D7–D9; public-pages §1.5). SkipLink first; Lenis lives only here;
// SiteChrome owns the single <main id="main">. The chrome comes from the cached getSiteChrome(), so it
// is part of every page's static shell. Runtime reads (pathname, draftMode) sit in Suspense leaves;
// no cookies() or headers() here.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getSiteChrome();
  return (
    <>
      <SkipLink />
      <Suspense fallback={null}>
        <PreviewBanner exitAction={exitPreview} />
      </Suspense>
      <SmoothScroll>
        <ToastProvider>
          <SiteChrome chrome={chrome}>{children}</SiteChrome>
        </ToastProvider>
        <Suspense fallback={null}>
          <RouteScrollReset />
        </Suspense>
      </SmoothScroll>
      <Suspense fallback={null}>
        <StudioBridgeSlot />
      </Suspense>
      <SiteAnalytics />
    </>
  );
}
