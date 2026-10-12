"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { consentPayload, SafeguardingQuestions, type Safeguarding } from "@/components/admin/media/SafeguardingQuestions";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Textarea } from "@/components/ui/form/Textarea";
import { addPhotoAction } from "@/app/admin/(desk)/media/actions";

type Uploaded = { uploadId: string; width: number; height: number; sizeBytes: number; preview: string; fileName: string };

const START: Safeguarding = { peopleVisible: false, childInImage: false, identifiable: false, aiGenerated: false, locationRisk: "no", consentState: "missing", consentRef: "" };

/**
 * Global sheet `?do=upload-media` (admin-ux §6.13): choose a photo (it's re-encoded without location
 * data), describe it, answer the consent questions, add it to the library.
 */
export function UploadMediaSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [decorative, setDecorative] = useState(false);
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [sg, setSg] = useState<Safeguarding>(START);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const choose = async (file: File) => {
    setProblem(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/media/upload", { method: "POST", body });
      const j = (await res.json()) as Uploaded & { message?: string };
      if (!res.ok) throw new Error(j.message ?? "The photo didn’t upload.");
      setUp(j);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The photo didn’t upload.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    start(async () => {
      if (!up) return;
      const r = await addPhotoAction({ uploadId: up.uploadId, meta: { alt, decorative, ...(caption.trim() ? { caption } : {}), ...(credit.trim() ? { credit } : {}), safeguarding: consentPayload(sg) } });
      if (r.ok) {
        toast({ title: "Added to the library", tone: "success" });
        setUp(null);
        setAlt("");
        setCaption("");
        setCredit("");
        setSg(START);
        onClose();
        router.refresh();
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
      title="Add a photo"
      description="For the website. Location data is removed when it uploads."
      dirty={Boolean(up)}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || !up} onClick={submit}>
          Add it to the library
        </Button>
      }
    >
      <div className="grid gap-5">
        {up ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={up.preview} alt="" className="h-28 w-40 rounded-[14px] object-cover" />
            <div className="text-[13.5px] text-body">
              <p className="font-bold text-ink">{up.fileName}</p>
              <p>
                {up.width} × {up.height} · {Math.round(up.sizeBytes / 1024)} KB · location data removed
              </p>
              <button type="button" onClick={() => input.current?.click()} className="mt-1 font-bold text-forest underline-offset-4 hover:underline">
                Choose another
              </button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-line bg-sand/30 p-8 text-center hover:border-forest">
            <UploadCloud aria-hidden className="size-7 text-forest" />
            <span className="text-[15px] font-bold text-ink">{busy ? "Uploading…" : "Choose a photo"}</span>
            <span className="text-[13px] text-body">JPG, PNG or WebP, up to 4 MB.</span>
          </button>
        )}
        <input
          ref={input}
          id="photo-file"
          type="file"
          aria-label="Photo file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void choose(f);
          }}
        />
        {problem ? (
          <p role="alert" className="text-[14px] font-semibold text-coral-800">
            {problem}
          </p>
        ) : null}
        {up ? (
          <>
            <Field name="alt" label="Describe the photo" hint="For people who can’t see it: what’s happening, not who." error={errors.alt}>
              <Textarea rows={2} value={alt} maxLength={240} disabled={decorative} onChange={(e) => setAlt(e.target.value)} />
            </Field>
            <Checkbox name="decorative" label="It’s decorative (a texture or pattern), so it needs no description" checked={decorative} onChange={(e) => setDecorative(e.target.checked)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="caption" label="Caption" optional>
                <Input value={caption} maxLength={240} onChange={(e) => setCaption(e.target.value)} />
              </Field>
              <Field name="credit" label="Photo by" optional>
                <Input value={credit} maxLength={120} onChange={(e) => setCredit(e.target.value)} />
              </Field>
            </div>
            <SafeguardingQuestions value={sg} onChange={setSg} canConsent />
            {errors["safeguarding.consent.recordRef"] ? <p className="text-[14px] font-semibold text-coral-800">{errors["safeguarding.consent.recordRef"]}</p> : null}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
