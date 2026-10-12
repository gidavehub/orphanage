"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";

type Copy = { greeting?: string; main?: string; signOff?: string };
type Preview = (id: string, copy: Copy) => Promise<{ subject: string; html: string; problems: Record<string, string> } | null>;
type Save = (id: string, copy: Copy, base: Millis | null) => Promise<ActionResult<{ updatedAt: Millis }>>;

/**
 * One email's wording (admin-ux "Emails Haven sends"): greeting, main paragraph and sign-off, with a
 * live preview of exactly what people get. Empty fields use Haven's standard words. The subject never
 * changes here. Only {firstName} and {ref} can be filled in.
 */
export function EmailCopyEditor({
  id,
  initial,
  standard,
  sensitive,
  mainLimit,
  updatedAt,
  firstPreview,
  preview,
  save,
}: {
  id: string;
  initial: Copy;
  standard: { greeting: string; main: string; signOff: string };
  sensitive: boolean;
  mainLimit: number;
  updatedAt: Millis | null;
  firstPreview: { subject: string; html: string };
  preview: Preview;
  save: Save;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [copy, setCopy] = useState<Copy>(initial);
  const [shown, setShown] = useState(firstPreview);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [base, setBase] = useState(updatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = (["greeting", "main", "signOff"] as const).some((k) => (copy[k] ?? "") !== (initial[k] ?? ""));

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void preview(id, copy).then((p) => {
        if (!p) return;
        setShown({ subject: p.subject, html: p.html });
        setProblems(p.problems);
      });
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [copy, id, preview]);

  const set = (k: keyof Copy, v: string) => setCopy((c) => ({ ...c, [k]: v }));

  const submit = () =>
    start(async () => {
      const r = await save(id, copy, base);
      if (r.ok) {
        setBase(r.data.updatedAt);
        toast({ title: "Saved. New emails use this wording.", tone: "success" });
        return;
      }
      if (r.error.kind === "validation") setProblems(r.error.fields);
      toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check.") : r.error.message, tone: "danger" });
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section aria-labelledby="copy-title" className="grid content-start gap-4 rounded-[26px] bg-white p-5 shadow-soft">
        <h2 id="copy-title" className="text-[18px] font-extrabold text-ink">
          The words
        </h2>
        <div className="rounded-2xl bg-cream px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.04em] text-body">
            <Lock aria-hidden className="size-3.5" /> Subject
          </p>
          <p className="mt-0.5 text-[15px] font-bold text-ink" data-subject>
            {shown.subject}
          </p>
          <p className="mt-1 text-[13px] text-body">Subjects stay fixed so people always recognise Haven’s emails.</p>
        </div>
        {sensitive ? (
          <Notice tone="info" compact title="A private email">
            It must never say what the person asked about. Keep the words general: no names, places or health matters.
          </Notice>
        ) : null}
        <Field name="copy-greeting" label="Greeting" hint={`Leave empty for “${standard.greeting}”`} optional error={problems.greeting}>
          <Input value={copy.greeting ?? ""} placeholder={standard.greeting} maxLength={120} onChange={(e) => set("greeting", e.target.value)} />
        </Field>
        <Field name="copy-main" label="Main paragraph" hint="Leave empty for Haven’s standard words. You can use {firstName} and {ref}." optional counter={{ max: mainLimit }} error={problems.main}>
          <Textarea rows={6} value={copy.main ?? ""} placeholder={standard.main} onChange={(e) => set("main", e.target.value)} />
        </Field>
        <Field name="copy-signOff" label="Sign-off" hint={`Leave empty for “${standard.signOff}”`} optional error={problems.signOff}>
          <Input value={copy.signOff ?? ""} placeholder={standard.signOff} maxLength={120} onChange={(e) => set("signOff", e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="forest" size="sm" icon="none" loading={pending} disabled={!dirty || pending || Object.keys(problems).length > 0} onClick={submit}>
            Save the wording
          </Button>
          {dirty ? (
            <button type="button" onClick={() => setCopy(initial)} className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-bold text-body hover:bg-cream">
              Undo changes
            </button>
          ) : null}
          {initial.main || initial.greeting || initial.signOff ? (
            <button type="button" onClick={() => setCopy({})} className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-bold text-forest hover:bg-mint">
              Use Haven’s standard words
            </button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="preview-title" className="overflow-hidden rounded-[26px] bg-white shadow-soft">
        <h2 id="preview-title" className="border-b border-line px-5 py-3 text-[15px] font-extrabold text-ink">
          What people get <span className="font-semibold text-body">(with sample details)</span>
        </h2>
        <iframe title={`Preview: ${shown.subject}`} sandbox="" referrerPolicy="no-referrer" srcDoc={shown.html} className="block h-[70vh] min-h-[480px] w-full border-0 bg-white" />
      </section>
    </div>
  );
}
