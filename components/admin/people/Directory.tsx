"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, Globe, Mail, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { FlagDisc } from "@/components/ui/flag";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { PRESENCE_FIRST } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import { PROGRAMME_IDS, REFERRAL_TYPES, type ReferralType } from "@/lib/model/enums";
import { PROGRAMME_LABEL, REFERRAL_TYPE_LABEL } from "@/lib/model/labels";
import type { ReferralPartnerDTO, ReferralPartnerInput } from "@/lib/server/dal/referralPartners";
import { cn } from "@/lib/cn";

type Save = (input: ReferralPartnerInput) => Promise<ActionResult<{ id: string; version: number }>>;

const blank = (): ReferralPartnerInput => ({
  id: null,
  expectedVersion: 0,
  name: "",
  type: "health" as ReferralType,
  services: "",
  country: "gm",
  locality: null,
  contactName: null,
  email: null,
  phone: null,
  website: null,
  notes: null,
  programmeIds: [],
  active: true,
  approved: false,
});

/**
 * The referral directory (admin-ux §6.9): services we refer people to, with what they offer, contact
 * details and "Approved by Haven". Active entries appear in a support request's referral step.
 */
export function Directory({ rows, canEdit, save }: { rows: ReferralPartnerDTO[]; canEdit: boolean; save: Save }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ReferralPartnerInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [type, setType] = useState<string>("");
  const [pending, start] = useTransition();
  const shown = type ? rows.filter((r) => r.type === type) : rows;
  const set = <K extends keyof ReferralPartnerInput>(k: K, v: ReferralPartnerInput[K]) => setEditing((x) => (x ? { ...x, [k]: v } : x));

  const submit = () =>
    start(async () => {
      if (!editing) return;
      const r = await save(editing);
      if (r.ok) {
        toast({ title: editing.id ? "Directory entry saved" : "Added to the directory", tone: "success" });
        setEditing(null);
        setErrors({});
        router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "validation") setErrors(e.fields);
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of service">
          {["", ...REFERRAL_TYPES].map((t) => (
            <button key={t || "all"} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={cn("h-9 rounded-full px-3.5 text-[13.5px] font-bold", type === t ? "bg-forest text-white" : "bg-white text-ink shadow-chip")}>
              {t ? REFERRAL_TYPE_LABEL[t as ReferralType] : "All"}
            </button>
          ))}
        </div>
        {canEdit ? (
          <Button type="button" variant="forest" size="sm" icon="none" onClick={() => setEditing(blank())}>
            <Plus aria-hidden className="size-4" /> Add a service
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">No services here yet.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id} className={cn("flex flex-col rounded-[22px] bg-white p-4 shadow-soft", !r.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-extrabold text-ink">{r.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-body">
                    {REFERRAL_TYPE_LABEL[r.type]} · <FlagDisc code={r.country} className="size-4" /> {r.locality ?? ""}
                  </p>
                </div>
                {r.approvedAt ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[12px] font-bold text-deep">
                    <BadgeCheck aria-hidden className="size-3.5" /> Approved
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-marigold-100 px-2.5 py-1 text-[12px] font-bold text-umber">Not approved yet</span>
                )}
              </div>
              <p className="mt-2 text-[14.5px] text-ink">{r.services}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
                {r.contactName ? <span className="text-body">{r.contactName}</span> : null}
                {r.email ? (
                  <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">
                    <Mail aria-hidden className="size-3.5" /> {r.email}
                  </a>
                ) : null}
                {r.phone ? (
                  <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">
                    <Phone aria-hidden className="size-3.5" /> {r.phone}
                  </a>
                ) : null}
                {r.website ? (
                  <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">
                    <Globe aria-hidden className="size-3.5" /> Website
                  </a>
                ) : null}
              </div>
              {canEdit ? (
                <div className="mt-auto pt-3">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...r, id: r.id, expectedVersion: r.version, approved: Boolean(r.approvedAt) })}
                    className="inline-flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest"
                  >
                    Edit
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => {
          setEditing(null);
          setErrors({});
        }}
        title={editing?.id ? "Edit the service" : "Add a service"}
        description="A service we can refer people to."
        footer={
          <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending} onClick={submit}>
            {editing?.id ? "Save" : "Add it"}
          </Button>
        }
      >
        {editing ? (
          <div className="grid gap-4">
            <Field name="name" label="Name of the service or organisation" error={errors.name}>
              <Input value={editing.name} maxLength={120} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field name="type" label="What kind of service" error={errors.type}>
              <Select value={editing.type} options={REFERRAL_TYPES.map((t) => ({ value: t, label: REFERRAL_TYPE_LABEL[t] }))} onChange={(e) => set("type", e.target.value as ReferralType)} />
            </Field>
            <Field name="services" label="What they offer" counter={{ max: 300 }} error={errors.services}>
              <Textarea rows={2} value={editing.services} onChange={(e) => set("services", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="country" label="Country" error={errors.country}>
                <CountrySelect priority={PRESENCE_FIRST} includeOther={false} value={editing.country} onChange={(e) => set("country", e.target.value)} />
              </Field>
              <Field name="locality" label="Town or area" optional>
                <Input value={editing.locality ?? ""} onChange={(e) => set("locality", e.target.value || null)} />
              </Field>
              <Field name="contactName" label="Who to ask for" optional>
                <Input value={editing.contactName ?? ""} onChange={(e) => set("contactName", e.target.value || null)} />
              </Field>
              <Field name="phone" label="Phone" optional>
                <Input type="tel" value={editing.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} />
              </Field>
              <Field name="email" label="Email" optional error={errors.email}>
                <Input type="email" value={editing.email ?? ""} onChange={(e) => set("email", e.target.value || null)} />
              </Field>
              <Field name="website" label="Website" optional error={errors.website}>
                <Input type="url" value={editing.website ?? ""} onChange={(e) => set("website", e.target.value || null)} />
              </Field>
            </div>
            <fieldset>
              <legend className="text-[15px] font-bold text-ink">Programmes they help with</legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {PROGRAMME_IDS.map((p) => (
                  <Checkbox key={p} name={`rp-programme-${p}`} value={p} label={PROGRAMME_LABEL[p]} checked={editing.programmeIds.includes(p)} onChange={(e) => set("programmeIds", e.target.checked ? [...editing.programmeIds, p] : editing.programmeIds.filter((x) => x !== p))} />
                ))}
              </div>
            </fieldset>
            <Field name="notes" label="Notes for the team" hint="About the service, never about the people we refer." optional counter={{ max: 1000 }} error={errors.notes}>
              <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
            </Field>
            <Checkbox name="approved" label="Approved by Haven: we have checked this service and its professionals." checked={editing.approved} onChange={(e) => set("approved", e.target.checked)} />
            <Checkbox name="active" label="Show it when the team records a referral" checked={editing.active} onChange={(e) => set("active", e.target.checked)} />
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
