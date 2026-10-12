"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { Segmented } from "@/components/ui/form/Segmented";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";

type SaveDoc = (input: { id: string; baseVersion: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult<{ version: number; at: Millis }>>;

/** The before-launch switch (PLAN D46): once on, unverified figures never render. Super admins only. */
export function HideUnverifiedSwitch({ value, version, site, canChange, save }: { value: boolean; version: number; site: unknown; canChange: boolean; save: SaveDoc }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Segmented
        label="Figures that haven’t been checked"
        density="admin"
        skin="donat"
        value={value ? "hide" : "show"}
        options={[
          { value: "show", label: "Show as examples", disabled: !canChange || pending },
          { value: "hide", label: "Hide them", disabled: !canChange || pending },
        ]}
        onChange={(v) =>
          start(async () => {
            const data = { ...(site as Record<string, unknown>), figures: { ...((site as { figures?: object }).figures ?? {}), hideUnverified: v === "hide" } };
            const r = await save({ id: "settings.site", baseVersion: version, data, intent: "publish" });
            toast({ title: r.ok ? (v === "hide" ? "Unchecked figures are hidden on the website" : "Unchecked figures show as examples") : r.error.kind === "validation" ? "That didn’t save." : r.error.message, tone: r.ok ? "success" : "danger" });
            router.refresh();
          })
        }
      />
      {!canChange ? <p className="text-[13.5px] text-body">Only a super admin can change this.</p> : null}
    </div>
  );
}
