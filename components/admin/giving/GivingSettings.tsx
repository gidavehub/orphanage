"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Info, Plus, Trash2, X } from "lucide-react";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { RadioCards } from "@/components/ui/form/RadioCards";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { DocData } from "@/lib/content/types";
import type { ActionResult } from "@/lib/forms/types";
import type { BankDetails, PaymentInstruction, PaymentSettings } from "@/lib/model/domain/settings";
import { CURRENCIES, FREQUENCIES, LOCAL_PAYMENT_METHODS, type Currency, type Millis } from "@/lib/model/enums";
import { FREQUENCY_LABEL, LOCAL_PAYMENT_METHOD_LABEL } from "@/lib/model/labels";
import type { GivingSettingsDTO } from "@/lib/server/dal/paymentSettings";
import { cn } from "@/lib/cn";

type DonateConfig = DocData<"donate.config">;
type SavePayment = (input: unknown) => Promise<ActionResult<{ at: Millis }>>;
type SaveDonate = (input: { id: string; baseVersion: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult>;

const PROVIDERS = [
  { value: "wave", label: "Wave" },
  { value: "afrimoney", label: "Afrimoney" },
  { value: "qmoney", label: "QMoney" },
] as const;


function Card({ id, title, intro, children, className }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-[22px] bg-white p-5 shadow-soft", className)}>
      <h2 id={id} className="text-[18px] font-extrabold text-ink">
        {title}
      </h2>
      {intro ? <p className="mt-1 text-[14.5px] text-body">{intro}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function useResult() {
  const { toast } = useToast();
  const router = useRouter();
  return (r: ActionResult<unknown>, ok: string, setErrors: (e: Record<string, string>) => void): boolean => {
    if (r.ok) {
      setErrors({});
      toast({ title: ok, tone: "success" });
      router.refresh();
      return true;
    }
    const e = r.error;
    if (e.kind === "validation") setErrors(e.fields);
    if (e.kind === "conflict") router.refresh();
    toast({
      title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted fields.") : e.kind === "blocked" ? e.reasons[0] ?? e.message : e.message,
      tone: "danger",
    });
    return false;
  };
}

/**
 * Settings › Giving (admin-ux §6.16; PLAN D131): two saves, because they live in two places. "How
 * people pay" is settings/payment (routes, limits, instructions, receipts, helper rates); "What
 * donors choose from" is the donate.config content doc (currencies, presets, frequencies, in-kind).
 */
export function GivingSettings({ d, savePayment, saveDonate }: { d: GivingSettingsDTO; savePayment: SavePayment; saveDonate: SaveDonate }) {
  return (
    <div className="grid gap-8">
      <PaymentForm d={d} save={savePayment} />
      <DonateForm d={d} save={saveDonate} />
    </div>
  );
}

/* ── How people pay (settings/payment) ─────────────────────────────────── */

function blankInstruction(): PaymentInstruction {
  return { methods: [], bank: null, mobileMoney: [], note: null };
}
const BLANK_BANK: BankDetails = { bankName: "", accountName: "", accountNumber: "" };

function PaymentForm({ d, save }: { d: GivingSettingsDTO; save: SavePayment }) {
  const [p, setP] = useState<PaymentSettings>(d.payment);
  const [cur, setCur] = useState<Currency>("GMD");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const handle = useResult();
  const ins = p.instructions[cur] ?? blankInstruction();
  const setIns = (next: Partial<PaymentInstruction>) => setP((x) => ({ ...x, instructions: { ...x.instructions, [cur]: { ...(x.instructions[cur] ?? blankInstruction()), ...next } } }));
  const err = (k: string) => errors[k] ?? Object.entries(errors).find(([path]) => path.startsWith(`${k}.`))?.[1];

  const submit = () =>
    start(async () => {
      const { updatedAt: _u, updatedBy: _b, ...rest } = p;
      void _u;
      void _b;
      handle(await save({ ...rest, baseUpdatedAt: d.baseUpdatedAt }), "Giving settings saved", setErrors);
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-5"
      aria-labelledby="pay-heading"
    >
      <h2 id="pay-heading" className="text-[22px] font-extrabold text-ink">
        How people pay
      </h2>

      <Card id="routes" title="Card or bank details, for each currency" intro="Card gifts go through Stripe. Everything else becomes a promise with your bank or mobile-money details, and finance confirms when it arrives.">
        <ul className="grid gap-4">
          {CURRENCIES.map((c) => (
            <li key={c} className="grid gap-3 rounded-[16px] border border-line p-4 md:grid-cols-[80px_minmax(0,1fr)_200px] md:items-center">
              <p className="font-grotesk text-[17px] font-semibold text-ink">{c}</p>
              <div>
                <Segmented
                  label={`How ${c} gifts are paid`}
                  density="admin"
                  skin="donat"
                  value={p.routes[c]}
                  options={[
                    { value: "local", label: "Mobile money or bank" },
                    { value: "stripe", label: "Card" },
                  ]}
                  onChange={(v) => setP((x) => ({ ...x, routes: { ...x.routes, [c]: v } }))}
                />
                {p.routes[c] === "stripe" && !d.cardReady[c] ? (
                  <p className="mt-2 inline-flex items-start gap-1.5 text-[13.5px] text-umber">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {d.stripeConnected ? `The Stripe account can’t take ${c} yet, so donors still see bank details.` : "Card gifts start once Stripe is connected. Until then donors see bank and mobile-money details."}
                  </p>
                ) : null}
              </div>
              <Field name={`maxOnline.${c}`} label="Largest card gift" hint="Above this, donors get bank details." error={err(`maxOnline.${c}`)}>
                <NumberInput value={p.maxOnline[c]} leading={<span className="text-[13px] font-semibold text-body">{c}</span>} onValue={(n) => setP((x) => ({ ...x, maxOnline: { ...x.maxOnline, [c]: n } }))} />
              </Field>
            </li>
          ))}
        </ul>
        <Field name="coverFeesPercent" label="“Cover the fees” adds" hint="Offered to card donors so the full gift reaches the programme." className="mt-4 max-w-[220px]" error={err("coverFeesPercent")}>
          <NumberInput value={p.coverFeesPercent} trailing={<span className="text-body">%</span>} onValue={(n) => setP((x) => ({ ...x, coverFeesPercent: n }))} />
        </Field>
      </Card>

      <Card id="instructions" title="Bank and mobile-money details" intro="Shown to donors after they promise a gift, and on the thank-you page.">
        <Segmented label="Currency" density="admin" skin="donat" value={cur} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setCur(v)} />
        <fieldset className="mt-4">
          <legend className="text-[15px] font-bold text-ink">Ways to pay in {cur}</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {LOCAL_PAYMENT_METHODS.map((m) => (
              <Checkbox
                key={m}
                name={`method-${cur}-${m}`}
                value={m}
                label={LOCAL_PAYMENT_METHOD_LABEL[m]}
                checked={ins.methods.includes(m)}
                onChange={(e) => setIns({ methods: e.target.checked ? [...ins.methods, m] : ins.methods.filter((x) => x !== m) })}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-5 rounded-[16px] border border-line p-4">
          <Checkbox name={`bank-${cur}`} label={`Show bank transfer details for ${cur}`} checked={ins.bank !== null} onChange={(e) => setIns({ bank: e.target.checked ? { ...BLANK_BANK } : null })} />
          {ins.bank ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(
                [
                  ["bankName", "Bank", false],
                  ["accountName", "Account name", false],
                  ["accountNumber", "Account number", false],
                  ["branch", "Branch", true],
                  ["sortCode", "Sort code", true],
                  ["iban", "IBAN", true],
                  ["swift", "SWIFT / BIC", true],
                  ["referenceHint", "What to write as the reference", true],
                ] as const
              ).map(([k, label, optional]) => (
                <Field key={k} name={`bank-${cur}-${k}`} label={label} optional={optional} error={err(`instructions.${cur}.bank.${k}`)}>
                  <Input value={ins.bank?.[k] ?? ""} onChange={(e) => setIns({ bank: { ...(ins.bank ?? BLANK_BANK), [k]: e.target.value } })} />
                </Field>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3">
          <p className="text-[15px] font-bold text-ink">Mobile-money accounts</p>
          {ins.mobileMoney.map((m, i) => (
            <div key={i} className="grid gap-2 rounded-[16px] border border-line p-3 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <Field name={`mm-${cur}-${i}-provider`} label="Provider">
                <Select value={m.provider} options={[...PROVIDERS]} onChange={(e) => setIns({ mobileMoney: ins.mobileMoney.map((x, j) => (j === i ? { ...x, provider: e.target.value as typeof m.provider } : x)) })} />
              </Field>
              <Field name={`mm-${cur}-${i}-name`} label="Account name" error={err(`instructions.${cur}.mobileMoney.${i}.name`)}>
                <Input value={m.name} onChange={(e) => setIns({ mobileMoney: ins.mobileMoney.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              </Field>
              <Field name={`mm-${cur}-${i}-number`} label="Number" error={err(`instructions.${cur}.mobileMoney.${i}.number`)}>
                <Input inputMode="tel" value={m.number} onChange={(e) => setIns({ mobileMoney: ins.mobileMoney.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)) })} />
              </Field>
              <button
                type="button"
                aria-label={`Remove ${m.name || "this account"}`}
                onClick={() => setIns({ mobileMoney: ins.mobileMoney.filter((_, j) => j !== i) })}
                className="grid size-11 place-items-center rounded-full text-coral-800 hover:bg-coral/10"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>
          ))}
          {ins.mobileMoney.length < 6 ? (
            <button
              type="button"
              onClick={() => setIns({ mobileMoney: [...ins.mobileMoney, { provider: "wave", name: "", number: "" }] })}
              className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[14px] font-bold text-ink hover:border-forest"
            >
              <Plus aria-hidden className="size-4" /> Add a mobile-money account
            </button>
          ) : null}
        </div>
        <Field name={`note-${cur}`} label="A note for donors" optional className="mt-5" counter={{ max: 300 }} error={err(`instructions.${cur}.note`)}>
          <Textarea rows={2} value={ins.note ?? ""} onChange={(e) => setIns({ note: e.target.value || null })} />
        </Field>
      </Card>

      <Card id="thanks" title="Thank-you emails">
        <RadioCards
          name="autoSend"
          legend="When an online gift arrives"
          value={p.receipt.autoSend ? "auto" : "manual"}
          onChange={(v) => setP((x) => ({ ...x, receipt: { ...x.receipt, autoSend: v === "auto" } }))}
          options={[
            { value: "auto", label: "Send the thank-you and receipt automatically", description: "Online gifts are thanked straight away. Gifts you record are thanked when you choose." },
            { value: "manual", label: "I’ll send each one myself", description: "Every gift waits on Giving for someone to say thank you." },
          ]}
        />
      </Card>

      <Card id="receipt" title="Receipts" intro="Printed on every receipt and in the thank-you email.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="legalName" label="Organisation’s legal name" error={err("receipt.legalName")}>
            <Input value={p.receipt.legalName} onChange={(e) => setP((x) => ({ ...x, receipt: { ...x.receipt, legalName: e.target.value } }))} />
          </Field>
          <Field name="registration" label="Registration number" optional error={err("receipt.registration")}>
            <Input value={p.receipt.registration} onChange={(e) => setP((x) => ({ ...x, receipt: { ...x.receipt, registration: e.target.value } }))} />
          </Field>
          <Field name="signatory" label="Signed by" optional hint="A role is fine, like “Finance Officer”." error={err("receipt.signatory")}>
            <Input value={p.receipt.signatory} onChange={(e) => setP((x) => ({ ...x, receipt: { ...x.receipt, signatory: e.target.value } }))} />
          </Field>
          <div className="self-end pb-2">
            <Checkbox
              name="goodsServicesStatement"
              label="Say that no goods or services were given in return"
              checked={p.receipt.goodsServicesStatement}
              onChange={(e) => setP((x) => ({ ...x, receipt: { ...x.receipt, goodsServicesStatement: e.target.checked } }))}
            />
          </div>
          <Field name="footer" label="Footer text" optional counter={{ max: 400 }} className="md:col-span-2" error={err("receipt.footer")}>
            <Textarea rows={3} value={p.receipt.footer} onChange={(e) => setP((x) => ({ ...x, receipt: { ...x.receipt, footer: e.target.value } }))} />
          </Field>
        </div>
      </Card>

      <Card id="fx" title="Helper exchange rates" intro="Only used to suggest how much a gift in one currency adds to a goal in another. Finance can always change the suggestion. They’re a guide, not a live rate.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CURRENCIES.map((c) => (
            <Field key={c} name={`fx-${c}`} label={c === "USD" ? "USD (the base)" : `${c} per 1 USD`} error={err(`fx.${c}`)}>
              <NumberInput value={p.fx[c]} readOnly={c === "USD"} onValue={(n) => setP((x) => ({ ...x, fx: { ...x.fx, [c]: n } }))} />
            </Field>
          ))}
        </div>
        {d.payment.updatedAt ? (
          <p className="mt-3 text-[13px] text-body">
            Last updated {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Banjul" }).format(d.payment.updatedAt)}.
          </p>
        ) : null}
      </Card>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] z-10 flex justify-end md:bottom-4">
        <Button type="submit" variant="forest" icon="none" loading={pending} disabled={pending} className="shadow-soft">
          Save how people pay
        </Button>
      </div>
    </form>
  );
}

/* ── What donors choose from (donate.config) ───────────────────────────── */

function DonateForm({ d, save }: { d: GivingSettingsDTO; save: SaveDonate }) {
  const [c, setC] = useState<DonateConfig>(d.donate.value);
  const [item, setItem] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const handle = useResult();
  const err = (k: string) => errors[k] ?? Object.entries(errors).find(([path]) => path.startsWith(`${k}.`))?.[1];
  const setCur = (k: Currency, next: Partial<DonateConfig["currencies"][Currency]>) => setC((x) => ({ ...x, currencies: { ...x.currencies, [k]: { ...x.currencies[k], ...next } } }));

  const submit = () => start(async () => void handle(await save({ id: "donate.config", baseVersion: d.donate.version, data: c, intent: "publish" }), "Donate choices saved and live", setErrors));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-5"
      aria-labelledby="choose-heading"
    >
      <h2 id="choose-heading" className="text-[22px] font-extrabold text-ink">
        What donors choose from
      </h2>
      <Card id="currencies" title="Currencies and amounts" intro="Six amounts appear as buttons. The smallest gift applies to typed amounts too.">
        <ul className="grid gap-4">
          {CURRENCIES.map((k) => {
            const cc = c.currencies[k];
            return (
              <li key={k} className={cn("rounded-[16px] border p-4", cc.enabled ? "border-line" : "border-dashed border-line bg-sand/40")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Checkbox name={`cur-${k}`} label={`Accept ${k} (${cc.name})`} checked={cc.enabled} onChange={(e) => setCur(k, { enabled: e.target.checked })} />
                  <label className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink">
                    <input type="radio" name="defaultCurrency" checked={c.defaultCurrency === k} disabled={!cc.enabled} onChange={() => setC((x) => ({ ...x, defaultCurrency: k }))} className="size-5 accent-forest" />
                    Show first
                  </label>
                </div>
                {cc.enabled ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Field name={`min-${k}`} label="Smallest gift" error={err(`currencies.${k}.min`)}>
                      <NumberInput value={cc.min} leading={<span className="text-[13px] font-semibold text-body">{k}</span>} onValue={(n) => setCur(k, { min: n })} />
                    </Field>
                    <fieldset>
                      <legend className="mb-1.5 text-[15px] font-bold text-ink">Amount buttons</legend>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {cc.amounts.map((a, i) => (
                          <NumberInput key={i} aria-label={`${k} amount ${i + 1}`} value={a} density="admin" onValue={(n) => setCur(k, { amounts: cc.amounts.map((x, j) => (j === i ? n : x)) })} />
                        ))}
                      </div>
                      {err(`currencies.${k}.amounts`) ? <p className="mt-1 text-[13px] font-semibold text-coral-800">{err(`currencies.${k}.amounts`)}</p> : null}
                    </fieldset>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {err("currencies") || err("defaultCurrency") ? <p className="mt-2 text-[14px] font-semibold text-coral-800">{err("currencies") ?? err("defaultCurrency")}</p> : null}
      </Card>

      <Card id="frequencies" title="How often people can give">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {FREQUENCIES.map((f) => (
            <Checkbox key={f} name={`freq-${f}`} value={f} label={FREQUENCY_LABEL[f]} checked={c.frequencies[f]} onChange={(e) => setC((x) => ({ ...x, frequencies: { ...x.frequencies, [f]: e.target.checked } }))} />
          ))}
        </div>
        {err("frequencies") ? <p className="mt-2 text-[14px] font-semibold text-coral-800">{err("frequencies")}</p> : null}
      </Card>

      <Card id="inkind" title="Things people can give in kind" intro="Between three and twelve. Shown as choices on the in-kind form.">
        <ul className="flex flex-wrap gap-2">
          {c.inKind.map((x, i) => (
            <li key={`${x}-${i}`} className="inline-flex h-10 items-center gap-1 rounded-full bg-sand pl-4 pr-1.5 text-[14px] font-semibold text-ink">
              {x}
              <button
                type="button"
                aria-label={`Remove ${x}`}
                onClick={() => setC((y) => ({ ...y, inKind: y.inKind.filter((_, j) => j !== i) }))}
                className="grid size-7 place-items-center rounded-full hover:bg-white"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {c.inKind.length < 12 ? (
          <div className="mt-3 flex max-w-[460px] gap-2">
            <Input
              aria-label="Add a kind of item"
              placeholder="For example: School shoes"
              value={item}
              maxLength={32}
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (item.trim()) setC((y) => ({ ...y, inKind: [...y.inKind, item.trim()] }));
                  setItem("");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon="plus"
              iconFirst
              onClick={() => {
                if (item.trim()) setC((y) => ({ ...y, inKind: [...y.inKind, item.trim()] }));
                setItem("");
              }}
            >
              Add
            </Button>
          </div>
        ) : null}
        {err("inKind") ? <p className="mt-2 text-[14px] font-semibold text-coral-800">{err("inKind")}</p> : null}
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="forest" icon="none" loading={pending} disabled={pending}>
          Save and put live
        </Button>
      </div>
    </form>
  );
}
