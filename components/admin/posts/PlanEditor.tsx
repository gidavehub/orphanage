"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { SchemaForm } from "@/components/admin/studio/SchemaForm";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { SectionDTO } from "@/lib/studio/server";

type SaveDoc = (input: { id: string; baseVersion: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult<{ version: number; at: Millis }>>;

/**
 * Topics & milestones (admin-ux §6.12; PLAN D48): the plan for each month and the monthly draft's
 * settings, saved together, plus "Draft this month's story now" (it says so warmly when the writing
 * helper isn't connected).
 */
export function PlanEditor({ d, save, draftNow }: { d: SectionDTO; save: SaveDoc; draftNow: () => Promise<{ created: string | null; message: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<unknown>(d.value);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[22px] bg-white p-5 shadow-soft">
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
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            variant="forest"
            size="sm"
            icon="none"
            loading={pending}
            disabled={pending || !dirty || !d.canEdit}
            onClick={() =>
              start(async () => {
                const r = await save({ id: d.id, baseVersion: d.version, data: value, intent: "publish" });
                if (r.ok) {
                  setDirty(false);
                  setErrors({});
                  toast({ title: "Plan saved", tone: "success" });
                  router.refresh();
                } else {
                  if (r.error.kind === "validation") setErrors(r.error.fields);
                  toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check.") : r.error.message, tone: "danger" });
                }
              })
            }
          >
            Save the plan
          </Button>
        </div>
      </section>
      <aside className="grid content-start gap-3 rounded-[22px] bg-white p-5 shadow-soft xl:sticky xl:top-24">
        <h2 className="inline-flex items-center gap-1.5 text-[16px] font-extrabold text-ink">
          <Sparkles aria-hidden className="size-4 text-umber" /> This month’s story
        </h2>
        <p className="text-[14px] text-body">The helper drafts it on the chosen day from published updates, checked figures and this plan. It never reads requests, concerns, sessions or donors. A person always reviews it.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon="none"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await draftNow();
              toast({ title: r.message, tone: r.created ? "success" : "default" });
              if (r.created) router.push(`/admin/posts/review/${r.created}`);
            })
          }
        >
          Draft this month’s story now
        </Button>
      </aside>
    </div>
  );
}
