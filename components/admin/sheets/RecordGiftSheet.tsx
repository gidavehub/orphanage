"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Chips } from "@/components/ui/form/Chips";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { PRESENCE_FIRST } from "@/lib/countries";
import { IN_KIND_CATEGORIES, type AllocationTarget, type Currency } from "@/lib/model/enums";
import { IN_KIND_CATEGORY_LABEL } from "@/lib/model/labels";
import { toMinor } from "@/lib/money";
import { giftSheetOptions, moveGift, recordGiftAction } from "@/app/admin/(desk)/giving/actions";
import { cn } from "@/lib/cn";

const STEPS = ["Who gave?", "What did they give?", "Where should it go?"];

/**
 * Global sheet `?do=record-gift` (admin-ux §6.6 Record a gift): three short steps for a gift that
 * arrived in cash, by bank or mobile money, or in kind. Optionally sends the thank-you straight away.
 */
export function RecordGiftSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [opts, setOpts] = useState<{ targets: Array<{ key: string; label: string; target: unknown }>; currencies: string[] } | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<"individual" | "organisation">("individual");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("gm");
  const [anonymous, setAnonymous] = useState(false);
  const [updates, setUpdates] = useState(false);

  const [kind, setKind] = useState<"cash" | "in_kind">("cash");
  const [currency, setCurrency] = useState<Currency>("GMD");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState("one_time");
  const [ext, setExt] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("");

  const [target, setTarget] = useState("general");
  const [arrived, setArrived] = useState(true);
  const [thankNow, setThankNow] = useState(true);

  useEffect(() => {
    if (!open || opts) return;
    giftSheetOptions()
      .then(setOpts)
      .catch(() => setOpts({ targets: [{ key: "general", label: "Where it's needed most", target: { type: "general" } }], currencies: ["GMD", "USD", "GBP", "EUR"] }));
  }, [open, opts]);

  const stepOk = step === 0 ? name.trim().length >= 2 : step === 1 ? (kind === "cash" ? Number(amount) > 0 : desc.trim().length > 2) : true;

  const submit = () =>
    start(async () => {
      const t = opts?.targets.find((x) => x.key === target)?.target as AllocationTarget | undefined;
      const r = await recordGiftAction({
        donor: { fullName: name, type, organisation: type === "organisation" ? org : null, email: email || null, phone: phone || null, country, anonymous, updates },
        kind,
        currency,
        amountMinor: Number(amount) > 0 ? toMinor(Number(amount), currency) : 0,
        method: method as never,
        externalRef: ext || null,
        frequency: frequency as never,
        receivedAt: arrived ? new Date(`${date}T12:00:00Z`).getTime() : null,
        inKind: kind === "in_kind" ? { categories: cats as never, description: desc, quantity: qty || null } : null,
        target: t ?? { type: "general" },
        arrived,
      });
      if (!r.ok) {
        toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check the form.") : r.error.message, tone: "danger" });
        return;
      }
      const ref = r.data.ref;
      if (arrived && thankNow) {
        const ack = await moveGift(ref, kind, "acknowledge", 1, { letThemKnow: !!email });
        if (!ack.ok) toast({ title: "Recorded, but the thank-you didn't go. Send it from the gift.", tone: "danger" });
      }
      toast({ title: `Gift recorded · ${ref.replace(/^HVN-/, "")}`, tone: "success", action: { label: "Open", onClick: () => router.push(`/admin/giving/${encodeURIComponent(ref)}`) } });
      onClose();
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Record a gift"
      description={STEPS[step]}
      dirty={!!name || !!amount || !!desc}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex gap-1.5">
            <span className="sr-only">{`Step ${step + 1} of 3`}</span>
            {STEPS.map((_, i) => (
              <span key={i} aria-hidden className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-forest" : i < step ? "w-2 bg-forest" : "w-2 bg-line")} />
            ))}
          </span>
          <span className="flex gap-2">
            {step > 0 ? (
              <Button variant="quiet" icon="none" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            {step < 2 ? (
              <Button variant="forest" icon="none" disabled={!stepOk} onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            ) : (
              <Button variant="forest" icon="heart" iconFirst loading={pending} disabled={pending} onClick={submit}>
                Record this gift
              </Button>
            )}
          </span>
        </div>
      }
    >
      {step === 0 ? (
        <div className="grid gap-5">
          <Field name="gift-name" label="Name">
            <Input value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={100} />
          </Field>
          <Segmented label="Giving as" options={[{ value: "individual", label: "A person" }, { value: "organisation", label: "An organisation" }]} value={type} onChange={(v) => setType(v as "individual")} />
          {type === "organisation" ? (
            <Field name="gift-org" label="Organisation">
              <Input value={org} onChange={(e) => setOrg(e.currentTarget.value)} maxLength={120} />
            </Field>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="gift-email" label="Email" optional hint="For the thank-you and receipt.">
              <Input type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} maxLength={254} />
            </Field>
            <Field name="gift-phone" label="Phone" optional>
              <Input value={phone} onChange={(e) => setPhone(e.currentTarget.value)} maxLength={24} />
            </Field>
          </div>
          <Field name="gift-country" label="Country">
            <CountrySelect priority={PRESENCE_FIRST} value={country} onChange={(e) => setCountry(e.currentTarget.value)} />
          </Field>
          <Checkbox name="gift-anon" label="Keep their name off the website" checked={anonymous} onChange={(e) => setAnonymous(e.currentTarget.checked)} />
          <Checkbox name="gift-updates" label="They'd like to hear how their gift helps (updates by email)" checked={updates} onChange={(e) => setUpdates(e.currentTarget.checked)} />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-5">
          <Segmented label="What did they give?" options={[{ value: "cash", label: "Money" }, { value: "in_kind", label: "In kind" }]} value={kind} onChange={(v) => setKind(v as "cash")} />
          {kind === "cash" ? (
            <>
              <Segmented label="Currency" options={(opts?.currencies ?? ["GMD", "USD", "GBP", "EUR"]).map((c) => ({ value: c, label: c }))} value={currency} onChange={(v) => setCurrency(v as Currency)} />
              <Field name="gift-amount" label={`Amount (${currency})`}>
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.currentTarget.value.replace(/[^\d.]/g, ""))} />
              </Field>
              <Field name="gift-method" label="How">
                <Select
                  value={method}
                  onChange={(e) => setMethod(e.currentTarget.value)}
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "bank_transfer", label: "Bank transfer" },
                    { value: "mobile_money", label: "Mobile money" },
                    { value: "cheque", label: "Cheque" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </Field>
              <Segmented
                label="How often"
                options={[
                  { value: "one_time", label: "Once" },
                  { value: "monthly", label: "Monthly" },
                  { value: "quarterly", label: "Quarterly" },
                  { value: "annual", label: "Yearly" },
                ]}
                value={frequency}
                onChange={(v) => setFrequency(v)}
              />
              <Field name="gift-ext" label="Reference number" optional>
                <Input value={ext} onChange={(e) => setExt(e.currentTarget.value)} maxLength={80} />
              </Field>
            </>
          ) : (
            <>
              <Field name="gift-cats" label="What kind of items">
                <Chips multiple tone="coral" label="Items" value={cats} onChange={(v) => setCats(v)} options={IN_KIND_CATEGORIES.map((c) => ({ value: c, label: IN_KIND_CATEGORY_LABEL[c] }))} />
              </Field>
              <Field name="gift-desc" label="Describe the items">
                <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.currentTarget.value)} maxLength={1000} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="gift-qty" label="How many" optional>
                  <Input value={qty} onChange={(e) => setQty(e.currentTarget.value)} maxLength={80} />
                </Field>
                <Field name="gift-est" label={`Estimated value (${currency})`} optional>
                  <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.currentTarget.value.replace(/[^\d.]/g, ""))} />
                </Field>
              </div>
            </>
          )}
          <Field name="gift-date" label="Date received">
            <Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.currentTarget.value)} />
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-5">
          <Field name="gift-target" label="Where should it go?">
            <Select value={target} onChange={(e) => setTarget(e.currentTarget.value)} options={(opts?.targets ?? [{ key: "general", label: "Where it's needed most" }]).map((t) => ({ value: t.key, label: t.label }))} />
          </Field>
          <Segmented
            label="Has it arrived?"
            options={[
              { value: "yes", label: "Yes, we have it" },
              { value: "no", label: "It's a promise" },
            ]}
            value={arrived ? "yes" : "no"}
            onChange={(v) => setArrived(v === "yes")}
          />
          {arrived ? (
            <Segmented
              label="Send a thank-you now?"
              options={[
                { value: "yes", label: email ? "Send thank-you and receipt" : "Issue the receipt" },
                { value: "no", label: "Not now" },
              ]}
              value={thankNow ? "yes" : "no"}
              onChange={(v) => setThankNow(v === "yes")}
            />
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
