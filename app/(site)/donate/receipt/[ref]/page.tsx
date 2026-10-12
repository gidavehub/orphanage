import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintButton } from "@/components/admin/giving/PrintButton";
import { ReceiptDocument } from "@/components/admin/giving/ReceiptDocument";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { receiptFor } from "@/lib/server/dal/donations";
import { receiptOrg } from "@/lib/server/giving/receipts";
import { verifyToken } from "@/lib/server/security/hmac";

// /donate/receipt/<ref>?t= (PLAN D112): the donor's receipt from the thank-you email. The signed
// token (purpose "receipt", one year) must name this gift. Never indexed.

export const metadata: Metadata = { title: "Your receipt", robots: { index: false, follow: false } };

type Props = { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function PublicReceiptPage(props: Props) {
  return (
    <Section tone="paper" pad="md" cv={false} last label="Receipt">
      <Suspense fallback={<Skeleton className="mx-auto h-[520px] w-full max-w-[760px] rounded-[18px]" />}>
        <Receipt {...props} />
      </Suspense>
    </Section>
  );
}

async function Receipt({ params, searchParams }: Props) {
  const [{ ref: raw }, sp] = await Promise.all([params, searchParams]);
  const ref = decodeURIComponent(raw);
  const claim = verifyToken(typeof sp.t === "string" ? sp.t : null, "receipt");
  const r = claim && claim.sub === ref ? await receiptFor(ref, { public: true }) : null;
  if (!r) {
    return (
      <div className="mx-auto max-w-[560px] rounded-[18px] bg-white p-8 text-center shadow-soft">
        <p className="text-[20px] font-extrabold text-ink">This receipt link isn&rsquo;t working</p>
        <p className="mt-2 text-[15px] text-body">Please reply to your thank-you email and we&rsquo;ll send the receipt again.</p>
      </div>
    );
  }
  const org = await receiptOrg();
  return (
    <div className="grid gap-5">
      <div className="mx-auto flex w-full max-w-[760px] justify-end print:hidden">
        <PrintButton />
      </div>
      <ReceiptDocument r={r} org={org} />
    </div>
  );
}
