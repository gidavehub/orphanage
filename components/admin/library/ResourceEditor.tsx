"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { MediaPicker } from "@/components/admin/ui/MediaPicker";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { RadioCards } from "@/components/ui/form/RadioCards";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import { PROGRAMME_IDS, RESOURCE_CATEGORIES } from "@/lib/model/enums";
import { PROGRAMME_LABEL, RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import type { ResourceEditorDTO, SaveResourceInput } from "@/lib/server/dal/resources";
import { PdfUpload, type UploadedPdf } from "./PdfUpload";

type Save = (input: SaveResourceInput) => Promise<ActionResult<{ id: string; version: number }>>;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);

/**
 * Add or edit a library item (admin-ux §6.8): the PDF, title, category, date, short description, a
 * readable summary, a cover, who can get it (choice cards) and whether it shows on the website.
 */
export function ResourceEditor({ d, save }: { d: ResourceEditorDTO; save: Save }) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = useState(d.value);
  const [file, setFile] = useState<UploadedPdf | null>(null);
  const [slugTouched, setSlugTouched] = useState(d.id !== null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));

  const submit = () =>
    start(async () => {
      const r = await save({ ...v, id: d.id, expectedVersion: d.version, uploadId: file?.uploadId ?? null });
      if (r.ok) {
        setErrors({});
        setFile(null);
        toast({ title: v.showing ? "Saved and on the website" : "Saved", tone: "success" });
        if (!d.id) router.replace(`/admin/library/${r.data.id}`);
        else router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "validation") setErrors(e.fields);
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted fields.") : e.message, tone: "danger" });
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 gap-5">
        <section aria-labelledby="res-file" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="res-file" className="mb-3 text-[18px] font-extrabold text-ink">
            The file
          </h2>
          {d.uploadsOn ? (
            <PdfUpload current={d.file} value={file} onChange={setFile} error={errors.file} />
          ) : (
            <p className="text-[15px] text-body">File storage isn’t switched on yet. You can describe the report now and add the PDF later.</p>
          )}
        </section>

        <section aria-labelledby="res-words" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="res-words" className="mb-4 text-[18px] font-extrabold text-ink">
            About it
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="title" label="Title" error={errors.title} className="md:col-span-2">
              <Input
                value={v.title}
                maxLength={120}
                onChange={(e) => {
                  set("title", e.target.value);
                  if (!slugTouched && !d.everPublished) set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field name="category" label="Category" error={errors.category}>
              <Select value={v.category} options={RESOURCE_CATEGORIES.map((c) => ({ value: c, label: RESOURCE_CATEGORY_LABEL[c] }))} onChange={(e) => set("category", e.target.value as typeof v.category)} />
            </Field>
            <Field name="publicationDate" label="Publication date" error={errors.publicationDate}>
              <Input type="date" value={v.publicationDate} onChange={(e) => set("publicationDate", e.target.value)} />
            </Field>
            <Field name="shortDescription" label="Short description" hint="Shown on the library card." counter={{ max: 300 }} error={errors.shortDescription} className="md:col-span-2">
              <Textarea rows={2} value={v.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
            </Field>
            <Field name="summary" label="Summary or preview" hint="Shown on the report’s page. Leave a blank line between paragraphs." optional error={errors.summary} className="md:col-span-2">
              <Textarea rows={6} value={v.summary} onChange={(e) => set("summary", e.target.value)} />
            </Field>
            <Field name="slug" label="Web address" hint={d.everPublished ? "This can’t change now that it has been on the website." : "Lowercase words joined by hyphens."} error={errors.slug}>
              <Input
                value={v.slug}
                readOnly={d.everPublished}
                leading={<span className="text-[14px] text-body">/resources/</span>}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field name="language" label="Language" optional>
              <Input value={v.language} maxLength={40} onChange={(e) => set("language", e.target.value)} />
            </Field>
          </div>
          <fieldset className="mt-4">
            <legend className="text-[15px] font-bold text-ink">Programmes it’s about</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {PROGRAMME_IDS.map((p) => (
                <Checkbox key={p} name={`programme-${p}`} value={p} label={PROGRAMME_LABEL[p]} checked={v.programmeIds.includes(p)} onChange={(e) => set("programmeIds", e.target.checked ? [...v.programmeIds, p] : v.programmeIds.filter((x) => x !== p))} />
              ))}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="res-cover" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="res-cover" className="mb-3 text-[18px] font-extrabold text-ink">
            Cover
          </h2>
          <Checkbox name="plainCover" label="Use a plain Haven cover (forest green with the title)" checked={v.coverMediaId === null} onChange={(e) => set("coverMediaId", e.target.checked ? null : (d.media[0]?.id ?? null))} />
          {v.coverMediaId !== null ? <MediaPicker className="mt-4" items={d.media} value={v.coverMediaId} onChange={(id) => set("coverMediaId", id)} kind="image" requireConsentFor="child" uploadHref="/admin/media" /> : null}
        </section>

        <section aria-labelledby="res-access" className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="res-access" className="mb-3 text-[18px] font-extrabold text-ink">
            Who can get it?
          </h2>
          <RadioCards
            name="access"
            legend="Who can get it?"
            legendHidden
            value={v.access}
            onChange={(val) => set("access", val as typeof v.access)}
            error={errors.access}
            options={[
              { value: "public", label: "Anyone can download it", description: "It appears on the website with a Download button." },
              { value: "controlled", label: "People must ask first", description: "They fill in a short form; you approve each one." },
            ]}
          />
        </section>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="grid gap-4 rounded-[22px] bg-white p-5 shadow-soft">
          <Segmented
            label="On the website"
            density="admin"
            skin="donat"
            value={v.showing ? "showing" : "hidden"}
            options={[
              { value: "showing", label: "Showing", disabled: !d.canPublish },
              { value: "hidden", label: "Hidden" },
            ]}
            onChange={(val) => set("showing", val === "showing")}
          />
          {!d.canPublish ? <p className="text-[13.5px] text-body">Someone who can publish puts it on the website.</p> : null}
          <Checkbox name="featured" label="Feature it at the top of the library" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} />
          <Button type="button" variant="forest" icon="none" loading={pending} disabled={pending} onClick={submit}>
            {d.id ? "Save changes" : "Add it to the library"}
          </Button>
          {d.publicHref ? (
            <Link href={d.publicHref} target="_blank" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
              See it on the website <ExternalLink aria-hidden className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
