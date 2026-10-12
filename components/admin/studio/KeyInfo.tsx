"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { SectionDTO } from "@/lib/studio/server";
import { SchemaForm } from "./SchemaForm";

type SaveDoc = (input: { id: string; baseVersion: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult<{ version: number; at: Millis }>>;
type Restore = (input: { id: string; version: number; baseVersion: number; intent?: "draft" | "publish" }) => Promise<ActionResult>;

const NOTES: Record<string, string> = {
  "settings.safety": "This wording protects children. Change it only after the safeguarding lead agrees.",
};

/**
 * Key information (admin-ux §6.11): the facts that appear across the whole site, each card saving on
 * its own and going live straight away, with a 10-second Undo. The one deliberate exception to
 * draft-then-publish, because these are small factual edits.
 */
export function KeyInfo({ cards, save, restore }: { cards: SectionDTO[]; save: SaveDoc; restore: Restore }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {cards.map((c) => (
        <KeyCard key={`${c.id}:${c.version}`} d={c} save={save} restore={restore} />
      ))}
    </div>
  );
}

function KeyCard({ d, save, restore }: { d: SectionDTO; save: SaveDoc; restore: Restore }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<unknown>(d.value);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const allLocked = !d.canEdit || Object.keys(d.locked).length === Object.keys((d.value as object) ?? {}).length;

  const submit = () =>
    start(async () => {
      const before = d.version;
      const r = await save({ id: d.id, baseVersion: before, data: value, intent: "publish" });
      if (!r.ok) {
        const e = r.error;
        if (e.kind === "validation") setErrors(e.fields);
        if (e.kind === "conflict") router.refresh();
        toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted fields.") : e.message, tone: "danger" });
        return;
      }
      setErrors({});
      setDirty(false);
      const after = r.data.version;
      toast({
        title: `${d.label} is live`,
        tone: "success",
        action: {
          label: "Undo",
          onClick: () =>
            start(async () => {
              const u = await restore({ id: d.id, version: before, baseVersion: after, intent: "publish" });
              toast({ title: u.ok ? "Put back as it was" : "That couldn’t be undone. Edit it again instead.", tone: u.ok ? "success" : "danger" });
              router.refresh();
            }),
        },
      });
      router.refresh();
    });

  return (
    <section aria-labelledby={`k-${d.id}`} className="flex flex-col rounded-[22px] bg-white p-5 shadow-soft">
      <h2 id={`k-${d.id}`} className="text-[18px] font-extrabold text-ink">
        {d.label}
      </h2>
      {NOTES[d.id] ? (
        <p className="mt-1 inline-flex items-start gap-1.5 text-[13.5px] font-semibold text-umber">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {NOTES[d.id]}
        </p>
      ) : null}
      <div className="mt-4">
        <SchemaForm
          schema={d.schema}
          value={value}
          locked={d.locked}
          media={d.media}
          errors={errors}
          disabled={!d.canEdit}
          onChange={(v) => {
            setValue(v);
            setDirty(true);
          }}
        />
      </div>
      {!allLocked ? (
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="forest" size="sm" icon="none" loading={pending} disabled={pending || !dirty} onClick={submit}>
            Save and put live
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-[13.5px] text-body">Someone else on the team keeps this up to date.</p>
      )}
    </section>
  );
}
