import Link from "next/link";
import { CreditCard, FlaskConical } from "lucide-react";
import { COPY } from "@/lib/admin/copy";

export type PracticeRibbonProps = { message: string; actionLabel: string; href: string };

/**
 * The sand practice-mode ribbon (admin-ux §3.7; design-system §5.2): shown on every desk screen while
 * the data lives in the local `.data/` folder, so nobody confuses practice with real records. The
 * text comes from practiceRibbon() (lib/server/integrations/status.ts). Umber on sand passes AA.
 */
export function PracticeRibbon({ message, actionLabel, href }: PracticeRibbonProps) {
  return (
    <div role="note" aria-label="Practice mode" className="bg-sand text-umber">
      <div className="mx-auto flex min-h-9 w-full max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 md:px-6">
        <FlaskConical aria-hidden className="size-4 shrink-0" strokeWidth={2.25} />
        <p className="min-w-0 flex-1 font-grotesk text-[13px] font-semibold leading-snug">{message}</p>
        <Link href={href} className="inline-flex min-h-8 items-center rounded-full px-2 font-grotesk text-[13px] font-semibold underline underline-offset-4 hover:bg-umber/10">
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

/** Stripe test keys are in use (design-system §5.2): test gifts never count in totals. */
export function TestPaymentsRibbon() {
  return (
    <div role="note" aria-label="Payments in test mode" className="border-t border-umber/10 bg-marigold-100 text-umber">
      <div className="mx-auto flex min-h-8 w-full max-w-[1400px] items-center gap-3 px-4 py-1 md:px-6">
        <CreditCard aria-hidden className="size-4 shrink-0" strokeWidth={2.25} />
        <p className="font-grotesk text-[13px] font-semibold leading-snug">{COPY["ribbon.stripeTest"]}</p>
      </div>
    </div>
  );
}
