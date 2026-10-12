"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { MediaPicker } from "@/components/admin/ui/MediaPicker";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { RadioCards } from "@/components/ui/form/RadioCards";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { MediaPickerItem } from "@/lib/model/dto";
import { PROGRAMME_IDS } from "@/lib/model/enums";
import { PROGRAMME_LABEL } from "@/lib/model/labels";
import { assistAction, createPostAction, submitPostAction, updateSheetOptionsAction } from "@/app/admin/(desk)/posts/actions";
import { countries } from "@/content/world";

const MAX = 600;
const COUNTRY_OPTIONS = [...countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.code, label: c.name }));
const CATEGORY_OF: Record<string, string> = { education: "impact-update", medical: "impact-update", psychological: "impact-update", legal: "impact-update", protection: "safeguarding", family: "impact-update" };

/**
 * Global sheet `?do=post-update` (admin-ux §6.12 Update composer): one photo and one paragraph, from a
 * phone in a minute. A photo with a child and no consent yet can't go out. It's sent for review; a
 * content manager checks it and puts it live.
 */
export function PostUpdateSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [media, setMedia] = useState<MediaPickerItem[] | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [child, setChild] = useState<"no" | "consent" | "noconsent">("no");
  const [text, setText] = useState("");
  const [programme, setProgramme] = useState("education");
  const [country, setCountry] = useState("gm");
  const [helper, setHelper] = useState<string | null>(null);

  useEffect(() => {
    if (!open || media) return;
    updateSheetOptionsAction()
      .then((o) => setMedia(o.media))
      .catch(() => setMedia([]));
  }, [open, media]);

  const blocked = child === "noconsent";
  const ok = Boolean(photo) && text.trim().length >= 20 && text.length <= MAX && !blocked;

  const submit = () =>
    start(async () => {
      const words = text.trim().split(/\s+/);
      const title = words.slice(0, 9).join(" ").replace(/[.,;:!?]+$/, "") + (words.length > 9 ? "…" : "");
      const r = await createPostAction({
        format: "update",
        title: title.slice(0, 90),
        excerpt: text.trim().slice(0, 220),
        text: text.trim(),
        category: CATEGORY_OF[programme] ?? "impact-update",
        cover: photo,
        programmeIds: [programme],
        countries: [country],
      });
      if (!r.ok) {
        toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check.") : r.error.message, tone: "danger" });
        return;
      }
      const s = await submitPostAction(r.data.id, r.data.version);
      toast({ title: s.ok ? "Sent for review: a content manager will put it live" : "Saved as a draft. Send it for review from Posts.", tone: s.ok ? "success" : "default" });
      setText("");
      setPhoto(null);
      onClose();
      router.push(`/admin/posts/${r.data.id}`);
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Post an update"
      description="One photo and a few lines about what happened."
      dirty={Boolean(text || photo)}
      footer={
        <Button type="button" variant="forest" icon="send" block loading={pending} disabled={pending || !ok} onClick={submit}>
          Send for review
        </Button>
      }
    >
      <div className="grid gap-5">
        {!media ? (
          <p className="text-[15px] text-body">Loading photos…</p>
        ) : (
          <MediaPicker items={media} value={photo} onChange={setPhoto} kind="image" requireConsentFor="child" uploadHref="/admin/media?do=upload-media" label="Choose a photo" />
        )}
        <RadioCards
          name="child"
          legend="Does it show a child’s face?"
          columns={1}
          value={child}
          onChange={(v) => setChild(v as typeof child)}
          options={[
            { value: "no", label: "No" },
            { value: "consent", label: "Yes, and consent is on file" },
            { value: "noconsent", label: "Yes, and there’s no consent yet", tone: "urgent", description: "It can’t go on the website until written consent is recorded. Choose another photo, or record the consent in Photos first." },
          ]}
        />
        <Field name="text" label="What happened?" counter={{ max: MAX }}>
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="programme" label="Programme">
            <Select value={programme} options={PROGRAMME_IDS.map((p) => ({ value: p, label: PROGRAMME_LABEL[p] }))} onChange={(e) => setProgramme(e.target.value)} />
          </Field>
          <Field name="country" label="Country" hint="Country only, never a town.">
            <Select value={country} options={COUNTRY_OPTIONS} onChange={(e) => setCountry(e.target.value)} />
          </Field>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setHelper((r => (r.kind === "off" ? r.message : r.text))(await assistAction("warmer", text))))}
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest"
        >
          <Sparkles aria-hidden className="size-4 text-umber" /> Help me write it
        </button>
        {helper ? <p className="rounded-[14px] bg-sand/60 p-3 text-[14px] text-ink">{helper}</p> : null}
      </div>
    </Sheet>
  );
}
