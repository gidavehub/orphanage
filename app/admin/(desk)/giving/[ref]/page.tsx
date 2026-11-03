import type { Metadata } from "next";
import { Suspense } from "react";
import { RefundSheet } from "@/components/admin/giving/RefundSheet";
import { GiftView } from "@/components/admin/records/GiftView";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { requireStaff, toShellViewer } from "@/lib/server/auth/session";
import { getGiftDetail } from "@/lib/server/dal/donations";
import { stripeKeys } from "@/lib/server/payments/keys";
import { moveGift, refundCardAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: decodeURIComponent(ref) };
}

export default function GiftPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Panel params={params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: Promise<{ ref: string }> }) {
  const v = await requireStaff("donation.read", "donation.manage");
  const { ref } = await params;
  const [d, keys] = await Promise.all([getGiftDetail(decodeURIComponent(ref)), stripeKeys()]);
  // Card gifts are refunded through Stripe (its confirmation updates the gift); others use "Record refund".
  const cardRefund = keys.mode !== "off" && d.online && d.canWrite && d.amount && ["received", "acknowledged", "allocated", "completed"].includes(d.status);
  return (
    <>
      {cardRefund ? (
        <div className="mb-4 flex justify-end">
          <RefundSheet reference={d.ref} amountMinor={d.amount!.amountMinor} currency={d.amount!.currency} refundedMinor={d.refundedMinor} refund={refundCardAction} />
        </div>
      ) : null}
      <GiftView d={cardRefund ? { ...d, edges: d.edges.filter((e) => e !== "refund") } : d} tz={v.timezone} perms={toShellViewer(v).perms} move={moveGift} />
    </>
  );
}
