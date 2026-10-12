"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { createPostAction } from "@/app/admin/(desk)/posts/actions";

const CATEGORIES = [
  { value: "impact-update", label: "Impact update" },
  { value: "story", label: "Story" },
  { value: "news", label: "News" },
  { value: "appeal-update", label: "Appeal update" },
  { value: "partnerships", label: "Partnerships" },
  { value: "safeguarding", label: "Safeguarding" },
];

/** Global sheet `?do=write-article` (admin-ux §6.12): a title and summary, then the full editor opens. */
export function WriteArticleSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("news");
  const submit = () =>
    start(async () => {
      const r = await createPostAction({ format: "article", title, excerpt, category });
      if (!r.ok) {
        toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check.") : r.error.message, tone: "danger" });
        return;
      }
      setTitle("");
      setExcerpt("");
      onClose();
      router.push(`/admin/posts/${r.data.id}`);
    });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Write an article"
      description="Start with a title and a short summary. The editor opens for the rest."
      dirty={Boolean(title || excerpt)}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || title.trim().length < 3 || excerpt.trim().length < 10} onClick={submit}>
          Start writing
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field name="article-title" label="Title" counter={{ max: 90 }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field name="article-excerpt" label="Short summary" hint="For cards and sharing." counter={{ max: 220 }}>
          <Textarea rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </Field>
        <Field name="article-category" label="Kind of post">
          <Select value={category} options={CATEGORIES} onChange={(e) => setCategory(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
