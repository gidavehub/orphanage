"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { PdfUpload, type UploadedPdf } from "@/components/admin/library/PdfUpload";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { RadioCards } from "@/components/ui/form/RadioCards";
import { Select } from "@/components/ui/form/Select";
import { RESOURCE_CATEGORIES, type ResourceCategory } from "@/lib/model/enums";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import { saveResourceAction } from "@/app/admin/(desk)/library/actions";

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
 * Global sheet `?do=add-report` (admin-ux §3.4, §6.8): the quick way to add a library item from
 * anywhere: the PDF, a title, a category and who can get it. It's saved hidden, and the full editor
 * opens for the summary, cover and "Show it on the website".
 */
export function AddReportSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [file, setFile] = useState<UploadedPdf | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ResourceCategory>("annual_reports");
  const [access, setAccess] = useState<"public" | "controlled">("controlled");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () =>
    start(async () => {
      const slug = slugify(title);
      const r = await saveResourceAction({
        id: null,
        expectedVersion: 0,
        uploadId: file?.uploadId ?? null,
        slug,
        title,
        category,
        access,
        showing: false,
        shortDescription: "",
        summary: "",
        coverMediaId: null,
        publicationDate: new Date().toISOString().slice(0, 10),
        programmeIds: [],
        language: "English",
        featured: false,
      });
      if (r.ok) {
        toast({ title: "Added to the library, hidden for now", tone: "success" });
        onClose();
        router.push(`/admin/library/${r.data.id}`);
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
      title="Add a report"
      description="A report or guide for the Reports & resources library."
      dirty={Boolean(title || file)}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || title.trim().length < 3} onClick={submit}>
          Add it, then finish the details
        </Button>
      }
    >
      <div className="grid gap-4">
        <PdfUpload current={null} value={file} onChange={setFile} error={errors.file} />
        <Field name="title" label="Title" error={errors.title ?? errors.slug}>
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field name="category" label="Category">
          <Select value={category} options={RESOURCE_CATEGORIES.map((c) => ({ value: c, label: RESOURCE_CATEGORY_LABEL[c] }))} onChange={(e) => setCategory(e.target.value as ResourceCategory)} />
        </Field>
        <RadioCards
          name="access"
          legend="Who can get it?"
          value={access}
          onChange={(v) => setAccess(v as "public" | "controlled")}
          columns={1}
          options={[
            { value: "public", label: "Anyone can download it", description: "A Download button on the website." },
            { value: "controlled", label: "People must ask first", description: "You approve each request." },
          ]}
        />
      </div>
    </Sheet>
  );
}
