"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { confirmHref, isStepUp } from "@/components/admin/team/RolePicker";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { RadioCards } from "@/components/ui/form/RadioCards";
import type { ActionResult } from "@/lib/forms/types";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/model/enums";

type Refund = (ref: string, amountMinor: number | null) => Promise<ActionResult<{ requested: number }>>;

/**
 * "Refund by card" on a gift paid through Stripe (integrations §3.9). Stripe makes the refund; its
 * confirmation then updates the gift, the totals and emails the donor. Needs a recent sign-in.
 */
export function RefundSheet({ reference, amountMinor, currency, refundedMinor, refund }: { reference: string; amountMinor: number; currency: Currency; refundedMinor: number; refund: Refund }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "part">("full");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const left = amountMinor - refundedMinor;
  const partMinor = Math.round(Number(amount.replace(/,/g, "")) * 100);

  const submit = () =>
    start(async () => {
      const r = await refund(reference, mode === "full" ? null : partMinor);
      if (r.ok) {
        toast({ title: "Refund requested", description: "It shows here once Stripe confirms, and the donor gets an email.", tone: "success" });
        setOpen(false);
        router.refresh();
        return;
      }
      if (isStepUp(r.error)) {
        router.push(confirmHref());
        return;
      }
      if (r.error.kind === "validation") setError(Object.values(r.error.fields)[0]);
      toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check.") : r.error.message, tone: "danger" });
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink hover:border-danger hover:text-danger">
        <Undo2 aria-hidden className="size-4" /> Refund by card
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Refund this gift"
        description={`${formatMoney({ amountMinor: left, currency })} can still be refunded.`}
        footer={
          <Button type="button" variant="danger" icon="none" block loading={pending} disabled={pending || (mode === "part" && !(partMinor > 0 && partMinor <= left))} onClick={submit}>
            {mode === "full" ? `Refund ${formatMoney({ amountMinor: left, currency })}` : "Refund this amount"}
          </Button>
        }
      >
        <div className="grid gap-4">
          <RadioCards
            name="refund-mode"
            legend="How much?"
            value={mode}
            onChange={(v) => setMode(v as "full" | "part")}
            columns={1}
            options={[
              { value: "full", label: "All of it", description: "The gift is cancelled and removed from the totals." },
              { value: "part", label: "Part of it", description: "The gift stays; the totals go down by the refund." },
            ]}
          />
          {mode === "part" ? (
            <Field name="refund-amount" label={`Amount (${currency})`} error={error}>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          ) : null}
          <Notice tone="info" compact title="Stripe makes the refund">
            It usually reaches the donor’s card in 5 to 10 days. Card fees aren’t returned by Stripe.
          </Notice>
        </div>
      </Sheet>
    </>
  );
}
