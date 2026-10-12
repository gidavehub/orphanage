"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Play, ShieldAlert, Sparkles } from "lucide-react";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import type { MediaItemDTO } from "@/lib/server/dal/media";
import { cn } from "@/lib/cn";
import { consentPayload, SafeguardingQuestions, type Safeguarding } from "./SafeguardingQuestions";

type Filter = "all" | "photos" | "films" | "uploads" | "illustrative" | "consent";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "photos", label: "Photos" },
  { id: "films", label: "Films" },
  { id: "uploads", label: "Added by the team" },
  { id: "illustrative", label: "Illustrative (AI)" },
  { id: "consent", label: "Needs consent" },
];

/**
 * Photos & files (admin-ux §6.13): every picture and film, filterable, each opening a sheet with its
 * description, consent answers and where it's used. "Withdraw consent" stops the file at once (410)
 * and pages show a warm neutral picture instead.
 */
export function MediaLibrary({ items, canUpload, canConsent, update, withdraw }: { items: MediaItemDTO[]; canUpload: boolean; canConsent: boolean; update: (input: { assetId: string; baseVersion: number; meta: unknown }) => Promise<ActionResult>; withdraw: (id: string, note?: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<MediaItemDTO | null>(null);
  const shown = useMemo(
    () =>
      items.filter((m) =>
        filter === "photos" ? m.kind === "image" : filter === "films" ? m.kind === "video" : filter === "uploads" ? m.source === "upload" : filter === "illustrative" ? m.illustrative : filter === "consent" ? m.needsConsent || m.consent === "withdrawn" : true,
      ),
    [items, filter],
  );
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-bold", filter === f.id ? "bg-forest text-white" : "bg-white text-ink shadow-chip")}>
              {f.label}
            </button>
          ))}
        </div>
        {canUpload ? (
          <Button type="button" variant="forest" size="sm" icon="plus" iconFirst onClick={() => openGlobalSheet(router, "upload-media")}>
            Add a photo
          </Button>
        ) : null}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => setOpen(m)} className={cn("group block w-full overflow-hidden rounded-[18px] bg-white text-left shadow-soft", m.status !== "active" && "opacity-60")}>
              <div className="relative aspect-[4/3] bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.poster ?? m.src} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {m.kind === "video" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-night/80 px-2 py-0.5 text-[11.5px] font-bold text-white">
                      <Play aria-hidden className="size-3" /> Film
                    </span>
                  ) : null}
                  {m.illustrative ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11.5px] font-bold text-umber">
                      <Sparkles aria-hidden className="size-3" /> Illustrative
                    </span>
                  ) : null}
                  {m.needsConsent ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-coral-800 px-2 py-0.5 text-[11.5px] font-bold text-white">
                      <ShieldAlert aria-hidden className="size-3" /> Needs consent
                    </span>
                  ) : null}
                  {m.consent === "withdrawn" ? <span className="rounded-full bg-night px-2 py-0.5 text-[11.5px] font-bold text-white">Withdrawn</span> : null}
                </div>
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-[13px] text-ink">{m.alt || m.caption || m.id}</p>
                <p className="mt-0.5 text-[12px] text-body">{m.usedIn.length ? `Used in ${m.usedIn.length} place${m.usedIn.length === 1 ? "" : "s"}` : "Not used yet"}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <MediaSheet item={open} onClose={() => setOpen(null)} canConsent={canConsent} update={update} withdraw={withdraw} />
    </div>
  );
}

function MediaSheet({ item, onClose, canConsent, update, withdraw }: { item: MediaItemDTO | null; onClose: () => void; canConsent: boolean; update: (input: { assetId: string; baseVersion: number; meta: unknown }) => Promise<ActionResult>; withdraw: (id: string, note?: string) => Promise<ActionResult> }) {
  return (
    <Sheet open={item !== null} onClose={onClose} title="Photo details" size="md">
      {item ? <MediaEditor key={`${item.id}:${item.version}`} m={item} canConsent={canConsent} update={update} withdraw={withdraw} onDone={onClose} /> : null}
    </Sheet>
  );
}

function MediaEditor({ m, canConsent, update, withdraw, onDone }: { m: MediaItemDTO; canConsent: boolean; update: (input: { assetId: string; baseVersion: number; meta: unknown }) => Promise<ActionResult>; withdraw: (id: string, note?: string) => Promise<ActionResult>; onDone: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [alt, setAlt] = useState(m.alt);
  const [decorative, setDecorative] = useState(m.decorative);
  const [caption, setCaption] = useState(m.caption ?? "");
  const [credit, setCredit] = useState(m.credit ?? "");
  const [sg, setSg] = useState<Safeguarding>({ peopleVisible: m.peopleVisible, childInImage: m.childInImage, identifiable: m.identifiable, aiGenerated: m.aiGenerated, locationRisk: m.locationRisk, consentState: m.consent, consentRef: m.consentRef ?? "" });
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const done = (r: ActionResult, ok: string) => {
    if (r.ok) {
      toast({ title: ok, tone: "success" });
      router.refresh();
      onDone();
    } else toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check.") : r.error.message, tone: "danger" });
  };
  return (
    <div className="grid gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.poster ?? m.src} alt="" className="max-h-64 w-full rounded-[16px] object-cover" />
      <p className="text-[13px] text-body">
        {m.id}
        {m.width && m.height ? ` · ${m.width} × ${m.height}` : ""}
        {m.source === "upload" ? " · added by the team" : " · from the photo set"}
      </p>
      {m.usedIn.length ? <p className="text-[13.5px] text-ink">Used in: {m.usedIn.slice(0, 8).join(", ")}</p> : null}
      <Field name="m-alt" label="Describe the photo" hint="For people who can’t see it.">
        <Textarea rows={2} value={alt} maxLength={240} disabled={decorative} onChange={(e) => setAlt(e.target.value)} />
      </Field>
      <Checkbox name="m-decorative" label="It’s decorative, so it needs no description" checked={decorative} onChange={(e) => setDecorative(e.target.checked)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="m-caption" label="Caption" optional>
          <Input value={caption} maxLength={240} onChange={(e) => setCaption(e.target.value)} />
        </Field>
        <Field name="m-credit" label="Photo by" optional>
          <Input value={credit} maxLength={120} onChange={(e) => setCredit(e.target.value)} />
        </Field>
      </div>
      <SafeguardingQuestions value={sg} onChange={setSg} canConsent={canConsent} disabled={m.consent === "withdrawn"} />
      <Button
        type="button"
        variant="forest"
        icon="none"
        loading={pending}
        disabled={pending}
        onClick={() => start(async () => done(await update({ assetId: m.id, baseVersion: m.version, meta: { alt, decorative, caption, credit, safeguarding: consentPayload(sg) } }), "Photo details saved"))}
      >
        Save
      </Button>
      {m.consent !== "withdrawn" && canConsent ? (
        <div className="grid gap-2 rounded-[16px] border border-coral/30 p-3">
          <p className="text-[14px] text-ink">If someone in this photo asks us to stop using it, withdraw consent. It disappears from the website at once and pages show a neutral picture instead.</p>
          {confirm ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="danger" size="sm" icon="none" disabled={pending} onClick={() => start(async () => done(await withdraw(m.id), "Consent withdrawn: the photo is no longer shown"))}>
                Yes, withdraw consent
              </Button>
              <Button type="button" variant="ghost" size="sm" icon="none" onClick={() => setConfirm(false)}>
                Not now
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" icon="none" className="w-fit" onClick={() => setConfirm(true)}>
              Withdraw consent
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
