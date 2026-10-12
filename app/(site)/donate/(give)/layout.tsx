import { Suspense } from "react";
import { blocksToPlain } from "@/components/content/Blocks";
import { DonateClosing } from "@/components/donate/DonateClosing";
import { DonateStateProvider } from "@/components/donate/DonateStateProvider";
import { DonateWidget, WidgetSkeleton } from "@/components/donate/DonateWidget";
import { StickyGiveBar } from "@/components/donate/StickyGiveBar";
import { getPage } from "@/lib/content/public";
import { loadGiving } from "@/lib/server/giving/pledge";

// The donate shell (public-pages §4.3, PLAN D37–D40, D63): it persists across /donate and every
// /donate/[cause], so switching cause swaps only the left column and the widget keeps its amount,
// currency, step and typed details. The routes and limits are decided here on the server and passed
// down as plain data (never NEXT_PUBLIC_). Static: no request data is read here; the widget reads the
// shareable query in its own Suspense boundary.
//
// Phones: the give hero (order 1), the widget (order 2), then the sections (order 3); the children
// wrapper uses `display: contents` below lg so the page's blocks join the same flex column.
export default async function GiveLayout({ children }: { children: React.ReactNode }) {
  const [{ config, causes }, page] = await Promise.all([loadGiving(), getPage("donate")]);
  const closing = page.sections.closing;
  const share = page.sections.share;

  return (
    <DonateStateProvider config={config} causes={causes}>
      <div className="paper relative">
        <div className="wrap pb-20 pt-8 md:pt-12 lg:pb-28">
          <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,1fr)_460px] xl:gap-16">
            <div className="contents lg:col-start-1 lg:row-start-1 lg:block lg:min-w-0">{children}</div>
            <aside
              aria-label="Make a gift"
              data-lenis-prevent
              className="order-2 lg:sticky lg:top-[96px] lg:col-start-2 lg:row-start-1 lg:-mx-5 lg:max-h-[calc(100svh-108px)] lg:overflow-y-auto lg:px-5 lg:pb-12 lg:[scrollbar-width:thin] xl:top-[100px] xl:max-h-[calc(100svh-112px)]"
            >
              <Suspense fallback={<WidgetSkeleton />}>
                <DonateWidget variant="page" />
              </Suspense>
            </aside>
          </div>
        </div>
      </div>
      <DonateClosing
        eyebrow={closing?.eyebrow}
        title={closing?.title ?? ["Your Support Will Positively", "Impact a Child's Welfare", "and Future"]}
        text={closing?.body ? blocksToPlain(closing.body) : undefined}
        shareTitle={share?.title?.join(" ") ?? "Share this appeal"}
      />
      <StickyGiveBar />
    </DonateStateProvider>
  );
}
