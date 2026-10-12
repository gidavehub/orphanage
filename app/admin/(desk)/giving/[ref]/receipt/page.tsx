import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/admin/giving/PrintButton";
import { ReceiptDocument } from "@/components/admin/giving/ReceiptDocument";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { receiptFor } from "@/lib/server/dal/donations";
import { receiptOrg } from "@/lib/server/giving/receipts";

export const metadata: Metadata = { title: "Receipt" };

export default function ReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Receipt params={params} />
    </Suspense>
  );
}

async function Receipt({ params }: { params: Promise<{ ref: string }> }) {
  const { ref: raw } = await params;
  const ref = decodeURIComponent(raw);
  const [r, org] = await Promise.all([receiptFor(ref), receiptOrg()]);
  if (!r) notFound();
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/giving/${encodeURIComponent(ref)}`} className="text-[14px] font-bold text-forest">
          ‹ Back to the gift
        </Link>
        <PrintButton />
      </div>
      <ReceiptDocument r={r} org={org} />
    </div>
  );
}
