"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
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
import { AGE_BANDS, CONTACT_METHODS, RELATIONSHIPS, SUPPORT_CATEGORIES, URGENCY3, type ContactMethod, type Relationship, type SupportCategory, type Urgency3 } from "@/lib/model/enums";
import { AGE_BAND_LABEL, CONTACT_METHOD_LABEL, RELATIONSHIP_LABEL, SUPPORT_CATEGORY_LABEL, URGENCY3_LABEL } from "@/lib/model/labels";
import { logRequestAction } from "@/app/admin/(desk)/_intake/actions";

type Form = {
  category: SupportCategory;
  urgency: Urgency3;
  immediateDanger: "no" | "yes";
  explanation: string;
  childAge: string;
  fullName: string;
  relationship: Relationship;
  relationshipOther: string;
  phone: string;
  email: string;
  country: string;
  locality: string;
  preferredContact: ContactMethod;
  safeToContact: "yes" | "careful";
  bestTimes: string;
  agreed: boolean;
};

const blank = (): Form => ({
  category: "education",
  urgency: "medium",
  immediateDanger: "no",
  explanation: "",
  childAge: "",
  fullName: "",
  relationship: "parent",
  relationshipOther: "",
  phone: "",
  email: "",
  country: "gm",
  locality: "",
  preferredContact: "phone",
  safeToContact: "yes",
  bestTimes: "",
  agreed: false,
});

/**
 * Global sheet `?do=log-request` (admin-ux §3.4): someone asked for help by phone or in person. The
 * same checks and record as the website form; anyone in danger becomes a safeguarding concern.
 */
export function LogRequestSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = Boolean(f.fullName || f.explanation || f.phone || f.email);

  const submit = () =>
    start(async () => {
      const r = await logRequestAction({
        ...f,
        childAge: f.childAge || null,
        relationshipOther: f.relationship === "other" ? f.relationshipOther : null,
        phone: f.phone || null,
        email: f.email || null,
        locality: f.locality || null,
        bestTimes: f.bestTimes || null,
        educationNeeds: [],
        counsellingDays: [],
        counsellingPeriods: [],
      });
      if (r.ok) {
        toast({ title: r.data.concern ? `Logged as a safeguarding concern (${r.data.reference})` : `Request ${r.data.reference} logged`, description: r.data.concern ? "The safeguarding team has been alerted." : undefined, tone: "success" });
        onClose();
        if (!r.data.concern) router.push(`/admin/requests/${r.data.reference}`);
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
      title="Log a request from a call or visit"
      description="Someone asked for help by phone or in person."
      dirty={dirty}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || !f.agreed || f.fullName.trim().length < 2 || f.explanation.trim().length < 10} onClick={submit}>
          {f.immediateDanger === "yes" ? "Log it as a safeguarding concern" : "Log the request"}
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field name="lr-category" label="What do they need help with?" error={errors.category}>
          <Select value={f.category} options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: SUPPORT_CATEGORY_LABEL[c] }))} onChange={(e) => set("category", e.target.value as SupportCategory)} />
        </Field>
        <Segmented label="Is anyone in danger right now?" density="admin" skin="donat" options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} value={f.immediateDanger} onChange={(v) => set("immediateDanger", v as "no" | "yes")} />
        {f.immediateDanger === "yes" ? (
          <Notice tone="emergency" compact title="If a child is in danger now, contact the authorities first">
            This will be logged as a safeguarding concern, not a support request, and the safeguarding team is alerted.{" "}
            <button type="button" className="font-bold underline" onClick={() => openGlobalSheet(router, "log-concern")}>
              Use the concern form instead
            </button>
          </Notice>
        ) : null}
        <Field name="lr-urgency" label="How urgent is it?">
          <Select value={f.urgency} options={URGENCY3.map((u) => ({ value: u, label: URGENCY3_LABEL[u] }))} onChange={(e) => set("urgency", e.target.value as Urgency3)} />
        </Field>
        <Field name="lr-explanation" label="What’s happening" hint="In their words. No children’s names." counter={{ max: 2000 }} error={errors.explanation}>
          <Textarea rows={5} value={f.explanation} onChange={(e) => set("explanation", e.target.value)} />
        </Field>
        <Field name="lr-childAge" label="The child’s age" optional>
          <Select value={f.childAge} placeholder="Not said" options={AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABEL[a] }))} onChange={(e) => set("childAge", e.target.value)} />
        </Field>

        <h3 className="mt-2 text-[16px] font-extrabold text-ink">The person who asked</h3>
        <Field name="lr-fullName" label="Their name" error={errors.fullName}>
          <Input value={f.fullName} maxLength={120} autoComplete="off" onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field name="lr-relationship" label="How they know the child" error={errors.relationship}>
          <Select value={f.relationship} options={RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_LABEL[r] }))} onChange={(e) => set("relationship", e.target.value as Relationship)} />
        </Field>
        {f.relationship === "other" ? (
          <Field name="lr-relationshipOther" label="Their relationship" error={errors.relationshipOther}>
            <Input value={f.relationshipOther} maxLength={60} onChange={(e) => set("relationshipOther", e.target.value)} />
          </Field>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="lr-phone" label="Phone" optional hint="With the country code, e.g. +220…" error={errors.phone}>
            <Input type="tel" value={f.phone} autoComplete="off" onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field name="lr-email" label="Email" optional error={errors.email}>
            <Input type="email" value={f.email} autoComplete="off" onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field name="lr-country" label="Country" error={errors.country}>
            <CountrySelect priority={PRESENCE_FIRST} includeOther={false} value={f.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field name="lr-locality" label="Town or region" optional>
            <Input value={f.locality} maxLength={80} onChange={(e) => set("locality", e.target.value)} />
          </Field>
        </div>
        <Field name="lr-preferredContact" label="Best way to reach them" error={errors.preferredContact}>
          <Select value={f.preferredContact} options={CONTACT_METHODS.map((m) => ({ value: m, label: CONTACT_METHOD_LABEL[m] }))} onChange={(e) => set("preferredContact", e.target.value as ContactMethod)} />
        </Field>
        <Segmented label="Is it safe to contact them on these details?" density="admin" skin="donat" options={[{ value: "yes", label: "Yes" }, { value: "careful", label: "Only with care" }]} value={f.safeToContact} onChange={(v) => set("safeToContact", v as "yes" | "careful")} />
        {f.safeToContact === "careful" ? (
          <Field name="lr-bestTimes" label="When or how it’s safe" error={errors.bestTimes}>
            <Input value={f.bestTimes} maxLength={120} onChange={(e) => set("bestTimes", e.target.value)} />
          </Field>
        ) : null}
        <Checkbox
          name="lr-agreed"
          label="They agreed to Haven keeping these details and contacting them about this request."
          checked={f.agreed}
          error={errors.agreed}
          onChange={(e) => set("agreed", e.currentTarget.checked)}
        />
      </div>
    </Sheet>
  );
}
