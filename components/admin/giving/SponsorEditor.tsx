"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import { AGE_BANDS, CURRENCIES, SUPPORT_CATEGORIES, type AgeBand, type Currency, type SupportCategory } from "@/lib/model/enums";
import { AGE_BAND_LABEL, SPONSOR_PROFILE_STATUS_LABEL, SUPPORT_CATEGORY_LABEL } from "@/lib/model/labels";
import { SAFETY_FLAG_LABEL, safetyFlags, type SafetyFlag } from "@/lib/content/safety";
import type { SponsorEditorDTO, SponsorInput, SponsorPeriod } from "@/lib/server/dal/sponsors";
import { cn } from "@/lib/cn";
import { countries } from "@/content/world";

type Actions = {
  save: (input: SponsorInput) => Promise<ActionResult<{ code: string; version: number }>>;
  publish: (code: string, expectedVersion: number, reviewed: boolean) => Promise<ActionResult<{ version: number }>>;
  setStatus: (code: string, expectedVersion: number, to: "draft" | "archived") => Promise<ActionResult<{ version: number }>>;
  addUpdate: (code: string, text: string) => Promise<ActionResult<{ id: string }>>;
};

const PERIODS: Array<{ value: SponsorPeriod; label: string }> = [
  { value: "one_off", label: "Once" },
  { value: "per_term", label: "Each term" },
  { value: "per_month", label: "Each month" },
  { value: "per_year", label: "Each year" },
];

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Banjul" });
const COUNTRY_OPTIONS = [...countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.code, label: c.name }));

/** The text with flagged words marked, so people see exactly what to change. */
function Marked({ text, flags }: { text: string; flags: SafetyFlag[] }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const f of flags) {
    if (f.index < at) continue;
    parts.push(text.slice(at, f.index));
    parts.push(
      <mark key={f.index} className="rounded bg-coral/15 px-0.5 text-coral-800 underline decoration-coral-800 decoration-wavy underline-offset-4">
        {text.slice(f.index, f.index + f.text.length)}
      </mark>,
    );
    at = f.index + f.text.length;
  }
  parts.push(text.slice(at));
  return <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{parts}</p>;
}

/**
 * A sponsorship profile (PLAN D55). The safety check runs as you type and again on the server;
 * a profile with anything to check can't go live, and a live profile only takes words that pass.
 */
export function SponsorEditor({ d, actions }: { d: SponsorEditorDTO; actions: Actions }) {
  const router = useRouter();
  const { toast } = useToast();
  const [f, setF] = useState({
    ageBand: d.ageBand,
    category: d.category,
    country: d.country ?? "",
    description: d.description,
    amount: d.amount ? String(d.amount) : "",
    currency: d.currency,
    period: d.period,
    sponsorsNeeded: String(d.sponsorsNeeded),
    sponsorsCurrent: String(d.sponsorsCurrent),
    linkedSupportRef: d.linkedSupportRef ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [update, setUpdate] = useState("");
  const [pending, start] = useTransition();
  const flags = useMemo(() => safetyFlags(f.description), [f.description]);
  const updateFlags = useMemo(() => safetyFlags(update), [update]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const live = d.status === "published" || d.status === "fully_funded";
  const editable = d.can.edit && d.status !== "archived";

  const handle = <T,>(r: ActionResult<T>, ok: string): r is { ok: true; data: T } => {
    if (r.ok) {
      setErrors({});
      setReasons([]);
      toast({ title: ok, tone: "success" });
      return true;
    }
    const e = r.error;
    if (e.kind === "validation") setErrors(e.fields);
    if (e.kind === "blocked") setReasons(e.reasons);
    if (e.kind === "conflict") router.refresh();
    toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted fields.") : e.message, tone: "danger" });
    return false;
  };

  const input = (): SponsorInput => ({
    ...(d.code ? { code: d.code, expectedVersion: d.version } : {}),
    ageBand: f.ageBand as AgeBand,
    category: f.category as SupportCategory,
    country: f.country || null,
    description: f.description,
    amount: Number(f.amount.replace(/,/g, "")),
    currency: f.currency as Currency,
    period: f.period as SponsorPeriod,
    sponsorsNeeded: Number(f.sponsorsNeeded),
    sponsorsCurrent: Number(f.sponsorsCurrent),
    ...(d.can.seeLink ? { linkedSupportRef: f.linkedSupportRef.trim() || null } : {}),
  });

  const save = () =>
    start(async () => {
      const r = await actions.save(input());
      if (handle(r, d.code ? "Saved" : `Profile ${r.ok ? r.data.code : ""} drafted`) && !d.code) router.replace(`/admin/giving/sponsorship/${r.data.code}`);
    });
  const publish = () => start(async () => void handle(await actions.publish(d.code!, d.version, reviewed), "Live on the sponsorship page"));
  const setStatus = (to: "draft" | "archived", ok: string) => start(async () => void handle(await actions.setStatus(d.code!, d.version, to), ok));
  const post = () =>
    start(async () => {
      if (handle(await actions.addUpdate(d.code!, update), "Update posted")) setUpdate("");
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 gap-5">
        <section aria-labelledby="sp-need" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="sp-need" className="mb-4 text-[18px] font-extrabold text-ink">
            The need
          </h2>
          <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
            <Field name="description" label="What the support pays for" hint="Describe the need, not the child. No names, towns or villages, or health history." counter={{ max: 300 }} error={errors.description} className="md:col-span-2">
              <Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            {f.description.trim() ? (
              <div className={cn("rounded-[16px] p-4 md:col-span-2", flags.length ? "bg-coral/5 ring-1 ring-coral/30" : "bg-mint/60")} aria-live="polite">
                <p className={cn("mb-2 inline-flex items-center gap-1.5 text-[14px] font-bold", flags.length ? "text-coral-800" : "text-deep")}>
                  {flags.length ? <ShieldAlert aria-hidden className="size-4" /> : <ShieldCheck aria-hidden className="size-4" />}
                  {flags.length ? `${flags.length} thing${flags.length === 1 ? "" : "s"} to change before it can go live` : "Nothing to check: no names, places or health details found"}
                </p>
                {flags.length ? (
                  <>
                    <Marked text={f.description} flags={flags} />
                    <ul className="mt-3 grid gap-1 text-[14px] text-ink">
                      {flags.map((x) => (
                        <li key={x.index}>
                          <span className="font-bold">{SAFETY_FLAG_LABEL[x.kind]}:</span> {x.message}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
            <Field name="category" label="What it’s for" error={errors.category}>
              <Select value={f.category} options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: SUPPORT_CATEGORY_LABEL[c] }))} onChange={(e) => set("category", e.target.value)} />
            </Field>
            <Field name="ageBand" label="Age band" error={errors.ageBand}>
              <Select value={f.ageBand} options={AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABEL[a] }))} onChange={(e) => set("ageBand", e.target.value)} />
            </Field>
            <Field name="country" label="Country" hint="The country only." optional error={errors.country}>
              <Select value={f.country} options={[{ value: "", label: "Don’t say" }, ...COUNTRY_OPTIONS]} onChange={(e) => set("country", e.target.value)} />
            </Field>
            {d.can.seeLink ? (
              <Field name="linkedSupportRef" label="Linked support request" hint="Only programme officers see this. It never appears on the website." optional error={errors.linkedSupportRef}>
                <Input value={f.linkedSupportRef} placeholder="HVN-SR-2026-0012" onChange={(e) => set("linkedSupportRef", e.target.value.toUpperCase())} />
              </Field>
            ) : null}
          </fieldset>
        </section>

        <section aria-labelledby="sp-money" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="sp-money" className="mb-4 text-[18px] font-extrabold text-ink">
            Amount and sponsors
          </h2>
          <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Segmented label="Currency" density="admin" skin="donat" options={CURRENCIES.map((c) => ({ value: c, label: c }))} value={f.currency} onChange={(v) => set("currency", v)} />
            </div>
            <Field name="amount" label="Amount needed" error={errors.amount}>
              <Input inputMode="decimal" value={f.amount} leading={<span className="text-[13px] font-semibold text-body">{f.currency}</span>} onChange={(e) => set("amount", e.target.value)} />
            </Field>
            <div>
              <Segmented label="How often" density="admin" skin="donat" options={PERIODS} value={f.period} onChange={(v) => set("period", v)} />
            </div>
            <Field name="sponsorsNeeded" label="Sponsors needed" error={errors.sponsorsNeeded}>
              <Input inputMode="numeric" value={f.sponsorsNeeded} onChange={(e) => set("sponsorsNeeded", e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field name="sponsorsCurrent" label="Sponsors so far" hint="When it reaches the number needed, the profile shows “Fully sponsored”." error={errors.sponsorsCurrent}>
              <Input inputMode="numeric" value={f.sponsorsCurrent} onChange={(e) => set("sponsorsCurrent", e.target.value.replace(/\D/g, ""))} />
            </Field>
          </fieldset>
        </section>

        {d.code ? (
          <section aria-labelledby="sp-updates" className="rounded-[22px] bg-white p-5 shadow-soft">
            <h2 id="sp-updates" className="text-[18px] font-extrabold text-ink">
              Updates for sponsors
            </h2>
            <p className="mt-1 text-[14.5px] text-body">About the programme, never about one child: “This term, 40 children in the programme sat their exams.”</p>
            <Field name="update" label="Write an update" labelHidden counter={{ max: 500 }} error={errors.update} className="mt-3">
              <Textarea rows={3} value={update} placeholder="What has the programme done this term?" onChange={(e) => setUpdate(e.target.value)} />
            </Field>
            {updateFlags.length ? (
              <ul className="mt-2 grid gap-1 text-[14px] text-coral-800">
                {updateFlags.map((x) => (
                  <li key={x.index}>{x.message}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="outline" size="sm" icon="send" disabled={pending || update.trim().length < 10 || updateFlags.length > 0} onClick={post}>
                Post the update
              </Button>
            </div>
            {d.updates.length ? (
              <ol className="mt-4 grid gap-3 border-t border-line pt-4">
                {d.updates.map((u) => (
                  <li key={u.id}>
                    <p className="text-[15px] text-ink">{u.text}</p>
                    <p className="mt-0.5 text-[13px] text-body">
                      {dateFmt.format(u.at)} · {u.by}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ) : null}
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="grid gap-3 rounded-[22px] bg-white p-5 shadow-soft">
          {d.code ? (
            <p className="text-[15px] text-body">
              <span className="font-bold text-ink">{SPONSOR_PROFILE_STATUS_LABEL[d.status]}.</span>{" "}
              {d.review ? `Checked and put live by ${d.review.by} on ${dateFmt.format(d.review.at)}.` : d.status === "draft" ? "Not on the website yet." : null}
            </p>
          ) : (
            <p className="text-[15px] text-body">A new profile starts as a draft. A content manager checks it and puts it live.</p>
          )}
          {reasons.length ? (
            <ul className="grid gap-1 rounded-[14px] bg-coral/10 p-3 text-[14px] text-coral-800">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          {editable ? (
            <Button type="button" variant={d.status === "draft" && d.can.publish ? "outline" : "forest"} icon="none" disabled={pending} onClick={save}>
              {d.code ? "Save changes" : "Save as a draft"}
            </Button>
          ) : null}
          {d.code && d.status === "draft" && d.can.publish ? (
            <div className="grid gap-3 rounded-[16px] border border-line p-3">
              <Checkbox name="reviewed" label="I’ve checked: no names, precise locations or medical history." checked={reviewed} error={errors.reviewed} onChange={(e) => setReviewed(e.target.checked)} />
              <Button type="button" variant="forest" icon="none" disabled={pending || !reviewed || flags.length > 0} onClick={publish}>
                <Check aria-hidden className="size-4" /> Put it live
              </Button>
              {flags.length ? <p className="text-[13px] text-coral-800">Change the highlighted words first.</p> : null}
            </div>
          ) : null}
          {d.code && live && d.can.publish ? (
            <Button type="button" variant="ghost" icon="none" disabled={pending} onClick={() => setStatus("draft", "Taken off the website")}>
              Take it off the website
            </Button>
          ) : null}
          {d.code && d.status !== "archived" ? (
            <Button type="button" variant="ghost" icon="none" disabled={pending} onClick={() => setStatus("archived", "Archived")}>
              Archive
            </Button>
          ) : null}
          {d.code && d.status === "archived" ? (
            <Button type="button" variant="outline" icon="none" disabled={pending} onClick={() => setStatus("draft", "Brought back as a draft")}>
              Bring it back as a draft
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
