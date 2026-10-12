"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { PRESENCE_FIRST } from "@/lib/countries";
import { CONTACT_METHODS, CONCERN_TYPES, RELATIONSHIPS, YES_NO_UNSURE, type ConcernType, type ContactMethod, type Relationship, type YesNoUnsure } from "@/lib/model/enums";
import { AGE_BAND_LABEL, CONCERN_TYPE_LABEL, CONTACT_METHOD_LABEL, RELATIONSHIP_LABEL, YES_NO_UNSURE_LABEL } from "@/lib/model/labels";
import { CONCERN_AGE_BANDS } from "@/lib/schemas/forms/concern";
import { logConcernAction } from "@/app/admin/(desk)/_intake/actions";

type Form = {
  childAge: string;
  country: string;
  area: string;
  concernTypes: ConcernType[];
  narrative: string;
  inDangerNow: YesNoUnsure;
  authoritiesContacted: YesNoUnsure;
  authorityDetails: string;
  reporterMode: "named" | "anonymous";
  name: string;
  phone: string;
  email: string;
  relationship: Relationship;
  followUpMethod: ContactMethod;
  followUpTimes: string;
};

const blank = (): Form => ({
  childAge: "unknown",
  country: "gm",
  area: "",
  concernTypes: [],
  narrative: "",
  inDangerNow: "unsure",
  authoritiesContacted: "unsure",
  authorityDetails: "",
  reporterMode: "named",
  name: "",
  phone: "",
  email: "",
  relationship: "community_member",
  followUpMethod: "phone",
  followUpTimes: "",
});

/**
 * Global sheet `?do=log-concern` (admin-ux §3.4): a worry about a child's safety that came in by phone
 * or in person. Same checks and alerts as the website form; the caller can stay anonymous.
 */
export function LogConcernSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const named = f.reporterMode === "named";

  const submit = () =>
    start(async () => {
      const r = await logConcernAction({
        ...f,
        area: f.area || null,
        authorityDetails: f.authoritiesContacted === "yes" ? f.authorityDetails || null : null,
        name: named ? f.name : null,
        phone: named ? f.phone || null : null,
        email: named ? f.email || null : null,
        relationship: named ? f.relationship : null,
        followUpMethod: named ? f.followUpMethod : null,
        followUpTimes: named ? f.followUpTimes || null : null,
      });
      if (r.ok) {
        toast({ title: `Concern ${r.data.reference} logged`, description: "The safeguarding team has been alerted.", tone: "success" });
        onClose();
        router.push(`/admin/safeguarding/${r.data.reference}`);
        return;
      }
      const e = r.error;
      if (e.kind === "validation") setErrors(e.fields);
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log a concern from a call"
      description="A worry about a child’s safety that came in by phone or in person."
      dirty={Boolean(f.narrative || f.name)}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || f.narrative.trim().length < 30 || f.concernTypes.length === 0} onClick={submit}>
          Log the concern and alert the team
        </Button>
      }
    >
      <div className="grid gap-4">
        <Notice tone="emergency" compact title="If a child is in immediate danger, contact the authorities now">
          Then log it here so the safeguarding team can follow up.
        </Notice>
        <Field name="lc-narrative" label="What they told you" hint="As close to their words as you can. Use initials, not children’s names." counter={{ max: 4000 }} error={errors.narrative}>
          <Textarea rows={6} value={f.narrative} onChange={(e) => set("narrative", e.target.value)} />
        </Field>
        <fieldset>
          <legend className="text-[15px] font-bold text-ink">What kind of concern?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CONCERN_TYPES.map((t) => (
              <Checkbox
                key={t}
                name={`lc-type-${t}`}
                value={t}
                label={CONCERN_TYPE_LABEL[t]}
                checked={f.concernTypes.includes(t)}
                onChange={(e) => set("concernTypes", e.currentTarget.checked ? [...f.concernTypes, t] : f.concernTypes.filter((x) => x !== t))}
              />
            ))}
          </div>
          {errors.concernTypes ? <p className="mt-2 text-[14px] font-semibold text-danger">{errors.concernTypes}</p> : null}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="lc-childAge" label="The child’s age" error={errors.childAge}>
            <Select value={f.childAge} options={CONCERN_AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABEL[a] }))} onChange={(e) => set("childAge", e.target.value)} />
          </Field>
          <Field name="lc-country" label="Country" error={errors.country}>
            <CountrySelect priority={PRESENCE_FIRST} includeOther={false} value={f.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
        </div>
        <Field name="lc-area" label="Town or area" optional>
          <Input value={f.area} maxLength={300} onChange={(e) => set("area", e.target.value)} />
        </Field>
        <Segmented label="Is the child in danger now?" density="admin" skin="donat" options={YES_NO_UNSURE.map((y) => ({ value: y, label: YES_NO_UNSURE_LABEL[y] }))} value={f.inDangerNow} onChange={(v) => set("inDangerNow", v as YesNoUnsure)} />
        <Segmented label="Have the authorities been told?" density="admin" skin="donat" options={YES_NO_UNSURE.map((y) => ({ value: y, label: YES_NO_UNSURE_LABEL[y] }))} value={f.authoritiesContacted} onChange={(v) => set("authoritiesContacted", v as YesNoUnsure)} />
        {f.authoritiesContacted === "yes" ? (
          <Field name="lc-authorityDetails" label="Who, and any reference" optional>
            <Input value={f.authorityDetails} maxLength={300} onChange={(e) => set("authorityDetails", e.target.value)} />
          </Field>
        ) : null}

        <h3 className="mt-2 text-[16px] font-extrabold text-ink">The person who called</h3>
        <Segmented label="Did they give their details?" density="admin" skin="donat" options={[{ value: "named", label: "Yes" }, { value: "anonymous", label: "They stayed anonymous" }]} value={f.reporterMode} onChange={(v) => set("reporterMode", v as "named" | "anonymous")} />
        {named ? (
          <>
            <Field name="lc-name" label="Their name" error={errors.name}>
              <Input value={f.name} maxLength={120} autoComplete="off" onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="lc-phone" label="Phone" optional error={errors.phone}>
                <Input type="tel" value={f.phone} autoComplete="off" onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field name="lc-email" label="Email" optional error={errors.email}>
                <Input type="email" value={f.email} autoComplete="off" onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field name="lc-relationship" label="How they know the child" error={errors.relationship}>
                <Select value={f.relationship} options={RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_LABEL[r] }))} onChange={(e) => set("relationship", e.target.value as Relationship)} />
              </Field>
              <Field name="lc-followUpMethod" label="Safe way to follow up" error={errors.followUpMethod}>
                <Select value={f.followUpMethod} options={CONTACT_METHODS.map((m) => ({ value: m, label: CONTACT_METHOD_LABEL[m] }))} onChange={(e) => set("followUpMethod", e.target.value as ContactMethod)} />
              </Field>
            </div>
            <Field name="lc-followUpTimes" label="When it’s safe to contact them" error={errors.followUpTimes}>
              <Input value={f.followUpTimes} maxLength={200} onChange={(e) => set("followUpTimes", e.target.value)} />
            </Field>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
