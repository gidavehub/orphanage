"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { AllocationBar } from "@/components/ui/AllocationBar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { Item } from "@/lib/content/types";
import type { ActionResult } from "@/lib/forms/types";
import { CURRENCIES, PROGRAMME_IDS, type Currency, type Millis } from "@/lib/model/enums";
import { PROGRAMME_LABEL } from "@/lib/model/labels";
import { formatMoney, toMinor } from "@/lib/money";
import type { AllocationSummaryEditorDTO } from "@/lib/server/dal/allocations";
import { cn } from "@/lib/cn";

type Summary = Item<"allocationSummaries">;
type Line = NonNullable<Summary["byCurrency"][Currency]>["lines"][number];
type Save = (input: { collection: string; id?: string; baseVersion?: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult<{ id: string; version: number; at: Millis }>>;

const KEYS = [...PROGRAMME_IDS.map((p) => ({ value: p, label: PROGRAMME_LABEL[p] })), { value: "admin", label: "Running costs" }, { value: "fees", label: "Payment fees" }, { value: "other", label: "Something else" }];
const labelOf = (k: string) => KEYS.find((x) => x.value === k)?.label ?? k;
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Banjul" });

/**
 * A yearly "where the money went" summary (PLAN D57): per currency, what came in and what went to
 * each programme, with a live bar. Never adds currencies together. Finance ticks it as checked.
 */
export function AllocationSummaryEditor({ d, save }: { d: AllocationSummaryEditorDTO; save: Save }) {
  const router = useRouter();
  const { toast } = useToast();
  const [s, setS] = useState<Summary>(d.value);
  const first = (CURRENCIES.find((c) => d.value.byCurrency[c]) ?? "USD") as Currency;
  const [cur, setCur] = useState<Currency>(first);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const block = s.byCurrency[cur];
  const setBlock = (next: { received: number; lines: Line[] } | undefined) =>
    setS((x) => {
      const by = { ...x.byCurrency };
      if (next) by[cur] = next;
      else delete by[cur];
      return { ...x, byCurrency: by };
    });
  const spent = block?.lines.reduce((n, l) => n + l.amount, 0) ?? 0;
  const err = (k: string) => errors[k] ?? Object.entries(errors).find(([p]) => p.startsWith(`${k}.`))?.[1];

  const submit = (intent: "draft" | "publish") =>
    start(async () => {
      const data: Record<string, unknown> = { ...s };
      for (const k of ["note", "reportResourceSlug"]) if (!data[k]) delete data[k];
      const r = await save({ collection: "allocationSummaries", ...(d.id ? { id: d.id, baseVersion: d.version } : {}), data, intent });
      if (r.ok) {
        setErrors({});
        toast({ title: intent === "publish" ? "Live on the Impact page" : "Saved as a draft", tone: "success" });
        if (!d.id) router.replace(`/admin/giving/where-it-goes/${r.data.id}`);
        else router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "validation") setErrors(e.fields);
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted fields.") : e.kind === "blocked" ? (e.reasons[0] ?? e.message) : e.message, tone: "danger" });
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 gap-5">
        <section aria-labelledby="sum-period" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="sum-period" className="mb-4 text-[18px] font-extrabold text-ink">
            The year
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field name="label" label="Name" error={err("label")}>
              <Input value={s.label} maxLength={60} onChange={(e) => setS((x) => ({ ...x, label: e.target.value }))} />
            </Field>
            <Field name="periodStart" label="From" error={err("periodStart")}>
              <Input type="date" value={s.periodStart} onChange={(e) => setS((x) => ({ ...x, periodStart: e.target.value }))} />
            </Field>
            <Field name="periodEnd" label="To" error={err("periodEnd")}>
              <Input type="date" value={s.periodEnd} onChange={(e) => setS((x) => ({ ...x, periodEnd: e.target.value }))} />
            </Field>
          </div>
        </section>

        <section aria-labelledby="sum-money" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="sum-money" className="text-[18px] font-extrabold text-ink">
            In and out, by currency
          </h2>
          <p className="mt-1 text-[14.5px] text-body">Each currency is shown on its own. Add the ones Haven received that year.</p>
          <div className="mt-4">
            <Segmented
              label="Currency"
              density="admin"
              skin="donat"
              value={cur}
              options={CURRENCIES.map((c) => ({ value: c, label: s.byCurrency[c] ? `${c} ✓` : c }))}
              onChange={(v) => setCur(v)}
            />
          </div>
          {block ? (
            <div className="mt-4 grid gap-4">
              <Field name={`received-${cur}`} label={`Received in ${cur}`} error={err(`byCurrency.${cur}.received`)} className="max-w-[260px]">
                <NumberInput value={block.received} leading={<span className="text-[13px] font-semibold text-body">{cur}</span>} onValue={(n) => setBlock({ ...block, received: n })} />
              </Field>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-[15px] font-bold text-ink">Where it went</legend>
                {block.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto] items-center gap-2 max-sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <Select
                      aria-label={`Line ${i + 1}: programme`}
                      density="admin"
                      value={l.key}
                      options={KEYS}
                      className="max-sm:col-span-3"
                      onChange={(e) => setBlock({ ...block, lines: block.lines.map((x, j) => (j === i ? { ...x, key: e.target.value as Line["key"], label: x.label === labelOf(x.key) ? labelOf(e.target.value) : x.label } : x)) })}
                    />
                    <Input aria-label={`Line ${i + 1}: label`} density="admin" value={l.label} maxLength={60} onChange={(e) => setBlock({ ...block, lines: block.lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                    <NumberInput aria-label={`Line ${i + 1}: amount`} density="admin" value={l.amount} onValue={(n) => setBlock({ ...block, lines: block.lines.map((x, j) => (j === i ? { ...x, amount: n } : x)) })} />
                    <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setBlock({ ...block, lines: block.lines.filter((_, j) => j !== i) })} className="grid size-9 place-items-center rounded-full text-coral-800 hover:bg-coral/10">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                ))}
                {block.lines.length < 12 ? (
                  <button
                    type="button"
                    onClick={() => setBlock({ ...block, lines: [...block.lines, { key: "other", label: "Something else", amount: 0 }] })}
                    className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[14px] font-bold text-ink hover:border-forest"
                  >
                    <Plus aria-hidden className="size-4" /> Add a line
                  </button>
                ) : null}
              </fieldset>
              {block.lines.some((l) => l.amount > 0) ? (
                <AllocationBar parts={block.lines.filter((l) => l.amount > 0).map((l) => ({ label: l.label, percent: (l.amount / Math.max(spent, block.received || spent)) * 100 }))} label={`Where the ${cur} went`} />
              ) : null}
              <p className={cn("text-[14px] font-semibold", spent > block.received ? "text-coral-800" : "text-body")}>
                {formatMoney({ amountMinor: toMinor(spent, cur), currency: cur })} placed of {formatMoney({ amountMinor: toMinor(block.received, cur), currency: cur })} received
                {spent > block.received ? ". That’s more than came in." : block.received > spent ? `. ${formatMoney({ amountMinor: toMinor(block.received - spent, cur), currency: cur })} carried forward.` : "."}
              </p>
              <button type="button" onClick={() => setBlock(undefined)} className="w-fit text-[14px] font-bold text-coral-800 underline-offset-4 hover:underline">
                Remove {cur} from this year
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBlock({ received: 0, lines: [] })}
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[14px] font-bold text-ink hover:border-forest"
            >
              <Plus aria-hidden className="size-4" /> Add {cur} for this year
            </button>
          )}
        </section>

        <section aria-labelledby="sum-check" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="sum-check" className="mb-3 text-[18px] font-extrabold text-ink">
            Checked by finance
          </h2>
          <Checkbox
            name="verified"
            label="I’ve checked these amounts against the year’s accounts."
            hint={d.verifiedBy && d.verifiedAt ? `Last confirmed by ${d.verifiedBy} on ${dateFmt.format(d.verifiedAt)}.` : "Until this is ticked, the Impact page shows the figures as examples, or hides them before launch."}
            checked={s.verification.status === "verified"}
            onChange={(e) => setS((x) => ({ ...x, verification: { ...x.verification, status: e.target.checked ? "verified" : "placeholder" } }))}
          />
          <Field name="evidence" label="Where the figures come from" optional className="mt-3">
            <Input value={s.verification.evidence ?? ""} maxLength={300} placeholder="For example: audited accounts 2025" onChange={(e) => setS((x) => ({ ...x, verification: { ...x.verification, evidence: e.target.value || undefined } }))} />
          </Field>
          <Field name="note" label="A note under the figures" optional counter={{ max: 300 }} className="mt-3" error={err("note")}>
            <Textarea rows={2} value={s.note ?? ""} onChange={(e) => setS((x) => ({ ...x, note: e.target.value || undefined }))} />
          </Field>
        </section>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="grid gap-3 rounded-[22px] bg-white p-5 shadow-soft">
          <p className="text-[15px] text-body">{d.id === null ? "Prefilled from what has been put towards each programme. Check every line." : d.hasDraft ? "You have changes that aren’t live yet." : d.everLive ? "Everything here is live." : "Not live yet."}</p>
          <Button type="button" variant="forest" icon="none" loading={pending} disabled={pending} onClick={() => submit("publish")}>
            <Check aria-hidden className="size-4" /> Put it live
          </Button>
          <Button type="button" variant="outline" icon="none" disabled={pending} onClick={() => submit("draft")}>
            Save as a draft
          </Button>
        </div>
      </aside>
    </div>
  );
}
