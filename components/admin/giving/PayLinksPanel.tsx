"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/forms/types";

type Send = (refs: string[]) => Promise<ActionResult<{ queued: number }>>;

/**
 * "{n} donors asked to pay by card while card payments were off" (integrations §3.11). One button
 * sends each of them a secure 14-day link that completes their pledge (no second gift is made).
 */
export function PayLinksPanel({ pledges, send }: { pledges: Array<{ ref: string; amount: string; name: string }>; send: Send }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  if (!pledges.length || sent) return null;
  const n = pledges.length;
  return (
    <section aria-label="Card payment links" className="mb-5 flex flex-wrap items-center gap-4 rounded-[22px] bg-marigold-100 p-4 text-umber md:p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-umber">
        <CreditCard aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-[16px] font-extrabold">
          {n === 1 ? "1 donor asked" : `${n} donors asked`} to pay by card while card payments were off.
        </p>
        <p className="text-[14px]">Card payments are on now. Send each of them a secure link to complete their gift.</p>
      </div>
      <Button
        type="button"
        variant="forest"
        size="sm"
        icon="none"
        loading={pending}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await send(pledges.map((p) => p.ref));
            if (r.ok) {
              setSent(true);
              toast({ title: r.data.queued === 1 ? "1 payment link sent" : `${r.data.queued} payment links sent`, tone: "success" });
            } else toast({ title: r.error.kind === "validation" ? "Please check." : r.error.message, tone: "danger" });
          })
        }
      >
        Send them a payment link
      </Button>
    </section>
  );
}
