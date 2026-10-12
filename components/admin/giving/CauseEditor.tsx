"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, Lock, Plus, Trash2 } from "lucide-react";
import { MediaPicker } from "@/components/admin/ui/MediaPicker";
import { AllocationBar } from "@/components/ui/AllocationBar";
import { NumberInput } from "@/components/admin/ui/NumberInput";
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
import type { CauseEditorDTO } from "@/lib/server/dal/causes";
import { cn } from "@/lib/cn";

type Cause = Item<"causes">;
type Save = (input: { collection: string; id?: string; baseVersion?: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult<{ id: string; version: number; at: Millis }>>;

const KINDS = [
  { value: "appeal", label: "Seasonal appeal" },
  { value: "programme", label: "A programme" },
  { value: "project", label: "A project" },
  { value: "general", label: "Where it’s needed most" },
  { value: "sponsorship", label: "Sponsorship" },
];
const STATUS = [
  { value: "active", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Finished" },
] as const;
const TONES = ["forest", "marigold", "clay", "cocoa", "coral", "deep", "umber"] as const;

const toDate = (ms?: number) => (ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10));
const fromDate = (s: string): number | undefined => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) : undefined);
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
/** Drops optional keys left blank, so the schema sees them as absent rather than empty. */
function clean(c: Cause): Cause {
  const out: Record<string, unknown> = { ...c };
  for (const k of ["eyebrow", "programmeId", "place", "startsAt", "endsAt", "allocationAsOf"]) {
    if (out[k] === "" || out[k] === undefined || out[k] === null) delete out[k];
  }
  out.allocation = c.allocation.map((p) => {
    const row: Record<string, unknown> = { label: p.label.trim(), percent: p.percent };
    if (p.note) row.note = p.note;
    if (p.tone) row.tone = p.tone;
    return row;
  });
  return out as Cause;
}

/**
 * The cause editor (admin-ux §6.6): words and picture for content managers, money for finance. Locked
 * fields stay visible with the reason. "Raised" is computed from gifts and never typed; finance can
 * add an opening balance. The breakdown must add up to 100% before it can go live.
 */
export function CauseEditor({ d, save }: { d: CauseEditorDTO; save: Save }) {
  const router = useRouter();
  const { toast } = useToast();
  const [c, setC] = useState<Cause>(d.value);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [slugTouched, setSlugTouched] = useState(d.id !== null);
  const set = <K extends keyof Cause>(k: K, v: Cause[K]) => setC((x) => ({ ...x, [k]: v }));
  const words = d.can.words;
  const money = d.can.money;

  const total = useMemo(() => c.allocation.reduce((s, p) => s + (Number.isFinite(p.percent) ? p.percent : 0), 0), [c.allocation]);
  const totalOk = c.allocation.length === 0 || Math.abs(total - 100) < 0.01;
  const recordedOwn = d.recorded[c.currency] ?? 0;
  const raised = c.offlineRaised + recordedOwn + c.convertedRaised;

  const submit = (intent: "draft" | "publish") =>
    start(async () => {
      setErrors({});
      setReasons([]);
      const data = clean(c);
      const r = await save({ collection: "causes", ...(d.id ? { id: d.id, baseVersion: d.version } : {}), data, intent });
      if (r.ok) {
        toast({ title: intent === "publish" ? "Live on the website" : "Saved as a draft", tone: "success" });
        if (!d.id) router.replace(`/admin/giving/causes/${r.data.id}`);
        else router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "validation") {
        setErrors(e.fields);
        toast({ title: Object.values(e.fields)[0] ?? "Please check the highlighted fields.", tone: "danger" });
      } else if (e.kind === "blocked") {
        setReasons(e.reasons);
        toast({ title: e.message, tone: "danger" });
      } else {
        if (e.kind === "conflict") router.refresh();
        toast({ title: e.message, tone: "danger" });
      }
    });

  const err = (k: string) => errors[k] ?? Object.entries(errors).find(([p]) => p.startsWith(`${k}.`))?.[1];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 gap-5">
        <section aria-labelledby="cause-words" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="cause-words" className="mb-4 text-[18px] font-extrabold text-ink">
            What it’s called
          </h2>
          <fieldset disabled={!words} className="grid gap-4 md:grid-cols-2">
            <Field name="title" label="Title" counter={{ max: 60 }} error={err("title")} className="md:col-span-2">
              <Input
                value={c.title}
                maxLength={80}
                onChange={(e) => {
                  set("title", e.target.value);
                  if (!slugTouched && !d.everLive) set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field name="eyebrow" label="Small line above the title" hint="For example “Seasonal appeal · Ramadan”." optional error={err("eyebrow")}>
              <Input value={c.eyebrow ?? ""} maxLength={48} onChange={(e) => set("eyebrow", e.target.value as Cause["eyebrow"])} />
            </Field>
            <Field name="season" label="Season or group" hint="Shown on cards, like “Year-round” or “Christmas”." error={err("season")}>
              <Input value={c.season} maxLength={24} onChange={(e) => set("season", e.target.value)} />
            </Field>
            <Field name="summary" label="Short description" counter={{ max: 300 }} error={err("summary")} className="md:col-span-2">
              <Textarea value={c.summary} rows={3} onChange={(e) => set("summary", e.target.value)} />
            </Field>
            <Field name="kind" label="What kind of cause is it?" error={err("kind")}>
              <Select value={c.kind} options={KINDS} onChange={(e) => set("kind", e.target.value as Cause["kind"])} />
            </Field>
            <Field name="programmeId" label="Programme" optional error={err("programmeId")}>
              <Select
                value={c.programmeId ?? ""}
                options={[{ value: "", label: "Not linked to one programme" }, ...PROGRAMME_IDS.map((p) => ({ value: p, label: PROGRAMME_LABEL[p] }))]}
                onChange={(e) => set("programmeId", (e.target.value || undefined) as Cause["programmeId"])}
              />
            </Field>
            <Field name="place" label="Country" hint="Country only, never a town or village." optional error={err("place")}>
              <Select
                value={c.place ?? ""}
                options={[{ value: "", label: "Wherever Haven works" }, ...d.countries.map((x) => ({ value: x.code, label: x.name }))]}
                onChange={(e) => set("place", (e.target.value || undefined) as Cause["place"])}
              />
            </Field>
            <Field
              name="slug"
              label="Web address"
              hint={d.everLive ? "This can’t change now that it has been live." : "Lowercase words joined by hyphens."}
              error={err("slug")}
            >
              <Input
                value={c.slug}
                maxLength={80}
                leading={<span className="text-[14px] text-body">/donate/</span>}
                readOnly={d.everLive}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
            </Field>
          </fieldset>
        </section>

        <section aria-labelledby="cause-picture" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="cause-picture" className="mb-4 text-[18px] font-extrabold text-ink">
            Picture
          </h2>
          {words ? (
            <MediaPicker items={d.media} value={c.image.$media} onChange={(id) => id && set("image", { $media: id })} kind="image" requireConsentFor="child" uploadHref="/admin/media" />
          ) : (
            <p className="text-[15px] text-body">Only the content team can change the picture.</p>
          )}
          {err("image") ? <p className="mt-2 text-[14px] font-semibold text-coral-800">{err("image")}</p> : null}
        </section>

        <section aria-labelledby="cause-when" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="cause-when" className="mb-4 text-[18px] font-extrabold text-ink">
            When and where it shows
          </h2>
          <fieldset disabled={!words} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Segmented label="Is it running?" density="admin" skin="donat" options={STATUS} value={c.status} onChange={(v) => set("status", v)} />
            </div>
            <Field name="startsAt" label="Starts" hint="Leave empty to start straight away." optional error={err("startsAt")}>
              <Input type="date" value={toDate(c.startsAt)} onChange={(e) => set("startsAt", fromDate(e.target.value) as Cause["startsAt"])} />
            </Field>
            <Field name="endsAt" label="Ends" hint="Leave empty to keep it open." optional error={err("endsAt")}>
              <Input type="date" value={toDate(c.endsAt)} onChange={(e) => set("endsAt", fromDate(e.target.value) as Cause["endsAt"])} />
            </Field>
            <Field name="groupId" label="Show it with the appeals on the home page" optional error={err("groupId")}>
              <Select
                value={c.groupId}
                options={[{ value: "", label: "Not on the home page" }, ...d.groups.map((g) => ({ value: g.id, label: `Yes, under “${g.label}”` }))]}
                onChange={(e) => set("groupId", e.target.value as Cause["groupId"])}
              />
            </Field>
            <div className="self-end pb-1">
              <Checkbox name="featured" label="Feature it near the top of the donate page" checked={c.featured} onChange={(e) => set("featured", e.target.checked)} />
            </div>
            <Field name="tone" label="Card colour" optional>
              <Select value={c.tone} options={TONES.map((t) => ({ value: t, label: t[0]!.toUpperCase() + t.slice(1) }))} onChange={(e) => set("tone", e.target.value as Cause["tone"])} />
            </Field>
          </fieldset>
        </section>

        <section aria-labelledby="cause-money" className="rounded-[22px] bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="cause-money" className="text-[18px] font-extrabold text-ink">
              The money
            </h2>
            {!money ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pebble px-3 py-1 text-[13px] font-bold text-body">
                <Lock aria-hidden className="size-3.5" /> {d.moneyLock}
              </p>
            ) : null}
          </div>
          <fieldset disabled={!money} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Segmented
                label="Currency of the goal"
                density="admin"
                skin="donat"
                options={CURRENCIES.map((k) => ({ value: k, label: k }))}
                value={c.currency}
                onChange={(v) => set("currency", v as Currency)}
              />
            </div>
            <Field name="goal" label="Goal" hint="0 means no goal is shown." error={err("goal")}>
              <NumberInput value={c.goal} leading={<span className="font-grotesk text-[14px] font-semibold text-body">{c.currency}</span>} onValue={(n) => set("goal", n)} />
            </Field>
            <Field name="offlineRaised" label="Raised before Haven’s records began" hint="An opening balance from finance records." optional error={err("offlineRaised")}>
              <NumberInput value={c.offlineRaised} leading={<span className="font-grotesk text-[14px] font-semibold text-body">{c.currency}</span>} onValue={(n) => set("offlineRaised", n)} />
            </Field>
            <Field name="convertedRaised" label="Added from gifts in other currencies" hint="Finance’s converted figure; other currencies are never added automatically." optional error={err("convertedRaised")}>
              <NumberInput value={c.convertedRaised} leading={<span className="font-grotesk text-[14px] font-semibold text-body">{c.currency}</span>} onValue={(n) => set("convertedRaised", n)} />
            </Field>
            <div className="rounded-[16px] bg-sand/60 p-4">
              <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.08em] text-body">Raised so far</p>
              <p className="mt-1 font-grotesk text-[20px] font-semibold tabular-nums text-ink">{formatMoney({ amountMinor: toMinor(raised, c.currency), currency: c.currency })}</p>
              <p className="mt-1 text-[13px] text-body">
                {formatMoney({ amountMinor: toMinor(recordedOwn, c.currency), currency: c.currency })} put towards it through Giving. Worked out from gifts, never typed.
              </p>
              {Object.entries(d.recorded)
                .filter(([k]) => k !== c.currency)
                .map(([k, v]) => (
                  <p key={k} className="mt-1 text-[13px] text-body">
                    Also {formatMoney({ amountMinor: toMinor(v!, k as Currency), currency: k as Currency })} in {k}.
                  </p>
                ))}
            </div>
          </fieldset>

          <div className="mt-6">
            <h3 className="text-[16px] font-extrabold text-ink">Where the money goes</h3>
            <p className="mt-1 text-[14px] text-body">Lines with a share of each gift. They must add up to 100%.</p>
            <fieldset disabled={!money} className="mt-3 grid gap-2">
              <legend className="sr-only">Breakdown lines</legend>
              {c.allocation.map((p, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-2">
                  <Input
                    aria-label={`Line ${i + 1}: what it pays for`}
                    value={p.label}
                    maxLength={60}
                    density="admin"
                    onChange={(e) => set("allocation", c.allocation.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                  <NumberInput
                    aria-label={`Line ${i + 1}: percent`}
                    value={p.percent}
                    density="admin"
                    trailing={<span className="text-body">%</span>}
                    onValue={(n) => set("allocation", c.allocation.map((x, j) => (j === i ? { ...x, percent: Math.min(100, n) } : x)))}
                  />
                  <div className="flex">
                    <button
                      type="button"
                      aria-label={`Move line ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => set("allocation", swap(c.allocation, i, i - 1))}
                      className="grid size-9 place-items-center rounded-full text-body hover:bg-sand disabled:opacity-30"
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move line ${i + 1} down`}
                      disabled={i === c.allocation.length - 1}
                      onClick={() => set("allocation", swap(c.allocation, i, i + 1))}
                      className="grid size-9 place-items-center rounded-full text-body hover:bg-sand disabled:opacity-30"
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove line ${i + 1}`}
                      onClick={() => set("allocation", c.allocation.filter((_, j) => j !== i))}
                      className="grid size-9 place-items-center rounded-full text-coral-800 hover:bg-coral/10"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {c.allocation.length < 8 ? (
                <button
                  type="button"
                  onClick={() => set("allocation", [...c.allocation, { label: "", percent: Math.max(0, Math.round((100 - total) * 10) / 10) }])}
                  className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[14px] font-bold text-ink hover:border-forest"
                >
                  <Plus aria-hidden className="size-4" /> Add a line
                </button>
              ) : null}
            </fieldset>
            {c.allocation.length ? (
              <div className="mt-4">
                <AllocationBar parts={c.allocation.filter((p) => p.label.trim())} label="Preview of where the money goes" />
                <p className={cn("mt-2 inline-flex items-center gap-1.5 text-[14px] font-bold", totalOk ? "text-forest" : "text-umber")} aria-live="polite">
                  {totalOk ? <Check aria-hidden className="size-4" /> : null}
                  {totalOk ? "Adds up to 100%" : `Adds up to ${Math.round(total * 10) / 10}%. It needs to be 100%.`}
                </p>
              </div>
            ) : null}
            <fieldset disabled={!money} className="mt-4 grid gap-4 md:grid-cols-2">
              <Field name="allocationAsOf" label="From the budget dated" optional error={err("allocationAsOf")}>
                <Input type="date" value={c.allocationAsOf ?? ""} onChange={(e) => set("allocationAsOf", (e.target.value || undefined) as Cause["allocationAsOf"])} />
              </Field>
            </fieldset>
          </div>

          <fieldset disabled={!money} className="mt-6 rounded-[16px] border border-line p-4">
            <legend className="px-1 text-[15px] font-extrabold text-ink">Checked by finance</legend>
            <Checkbox
              name="verified"
              label="I’ve checked the goal, the opening balance and the breakdown against the finance records."
              hint={d.verifiedBy ? `Last confirmed by ${d.verifiedBy}. Changing a figure asks for a fresh check.` : "Until this is ticked, the donate page treats the figures as examples."}
              checked={c.verification.status === "verified"}
              onChange={(e) => set("verification", { ...c.verification, status: e.target.checked ? "verified" : "placeholder" })}
            />
            <Field name="evidence" label="Where the figures come from" optional className="mt-3" error={err("verification")}>
              <Input value={c.verification.evidence ?? ""} maxLength={300} placeholder="For example: 2026 programme budget, approved 12 Sep" onChange={(e) => set("verification", { ...c.verification, evidence: e.target.value || undefined })} />
            </Field>
          </fieldset>
        </section>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="grid gap-3 rounded-[22px] bg-white p-5 shadow-soft">
          <p className="text-[15px] text-body">
            {d.id === null ? "A new cause. Save it as a draft, or put it live when it’s ready." : d.hasDraft ? "You have changes that aren’t live yet." : d.everLive ? "Everything here is live." : "Not live yet."}
          </p>
          {reasons.length ? (
            <ul className="grid gap-1 rounded-[14px] bg-marigold-100 p-3 text-[14px] text-umber">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          <Button type="button" variant="forest" icon="none" loading={pending} disabled={pending || !d.can.publish} onClick={() => submit("publish")}>
            Put it live
          </Button>
          <Button type="button" variant="outline" icon="none" disabled={pending} onClick={() => submit("draft")}>
            Save as a draft
          </Button>
          {d.everLive ? (
            <Link href={d.href} target="_blank" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
              See the donate page <ExternalLink aria-hidden className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </aside>
    </div>
  );
}


function swap<T>(list: T[], a: number, b: number): T[] {
  const out = [...list];
  [out[a], out[b]] = [out[b]!, out[a]!];
  return out;
}
