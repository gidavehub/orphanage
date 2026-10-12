"use client";

import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Segmented } from "@/components/ui/form/Segmented";

export type Safeguarding = {
  peopleVisible: boolean;
  childInImage: boolean;
  identifiable: boolean;
  aiGenerated: boolean;
  locationRisk: "no" | "yes" | "unsure";
  consentState: "not_required" | "valid" | "missing" | "expired" | "withdrawn";
  consentRef: string;
};

const yesNo = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
] as const;

/**
 * The consent questions for a picture (admin-ux §6.13; D53): who is in it, whether a child can be
 * recognised, where it was taken, and the consent on file. A real photo of a child needs a signed
 * consent record before any page can use it.
 */
export function SafeguardingQuestions({ value, onChange, canConsent, disabled }: { value: Safeguarding; onChange: (v: Safeguarding) => void; canConsent: boolean; disabled?: boolean }) {
  const set = <K extends keyof Safeguarding>(k: K, v: Safeguarding[K]) => onChange({ ...value, [k]: v });
  const needsConsent = value.childInImage && !value.aiGenerated;
  return (
    <fieldset disabled={disabled} className="grid gap-4">
      <Segmented label="Is it an AI-made picture?" density="admin" skin="donat" value={value.aiGenerated ? "yes" : "no"} options={yesNo} onChange={(v) => set("aiGenerated", v === "yes")} />
      <Segmented label="Does it show people?" density="admin" skin="donat" value={value.peopleVisible ? "yes" : "no"} options={yesNo} onChange={(v) => onChange({ ...value, peopleVisible: v === "yes", ...(v === "no" ? { childInImage: false, identifiable: false } : {}) })} />
      {value.peopleVisible ? (
        <>
          <Segmented label="Is there a child in it?" density="admin" skin="donat" value={value.childInImage ? "yes" : "no"} options={yesNo} onChange={(v) => set("childInImage", v === "yes")} />
          <Segmented label="Could someone recognise a face?" density="admin" skin="donat" value={value.identifiable ? "yes" : "no"} options={yesNo} onChange={(v) => set("identifiable", v === "yes")} />
        </>
      ) : null}
      <Segmented
        label="Could someone recognise exactly where this is?"
        density="admin"
        skin="donat"
        value={value.locationRisk}
        options={[
          { value: "no", label: "No" },
          { value: "unsure", label: "Not sure" },
          { value: "yes", label: "Yes" },
        ]}
        onChange={(v) => set("locationRisk", v)}
      />
      {needsConsent || value.identifiable ? (
        <div className="grid gap-3 rounded-[16px] bg-sand/60 p-3">
          <Segmented
            label="Consent"
            density="admin"
            skin="donat"
            value={value.consentState === "valid" ? "valid" : "missing"}
            options={[
              { value: "valid", label: "Written consent on file", disabled: !canConsent },
              { value: "missing", label: "No consent yet" },
            ]}
            onChange={(v) => set("consentState", v === "valid" ? "valid" : "missing")}
          />
          {value.consentState === "valid" ? (
            <Field name="consentRef" label="Consent record reference" hint="Where the signed form is kept, e.g. CF-2026-014.">
              <Input density="admin" value={value.consentRef} maxLength={128} onChange={(e) => set("consentRef", e.target.value.replace(/[^A-Za-z0-9_~.-]/g, ""))} />
            </Field>
          ) : (
            <p className="text-[13.5px] text-umber">{needsConsent ? "Until consent is recorded, this photo can’t be used on the website." : "Pages can use it, but record consent when you can."}</p>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}

export function consentPayload(s: Safeguarding) {
  const needs = (s.childInImage && !s.aiGenerated) || s.identifiable;
  const state = !needs && !s.peopleVisible ? "not_required" : s.consentState === "valid" ? "valid" : needs ? "missing" : "not_required";
  return {
    peopleVisible: s.peopleVisible,
    childInImage: s.childInImage,
    identifiable: s.identifiable,
    aiGenerated: s.aiGenerated,
    locationRisk: s.locationRisk,
    consent: { state, ...(state === "valid" && s.consentRef ? { recordRef: s.consentRef } : {}) },
  };
}
