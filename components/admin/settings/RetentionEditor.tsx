"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/form/Select";
import type { ActionResult } from "@/lib/forms/types";
import type { RetentionMode, RetentionPolicySetting } from "@/lib/model/domain/settings";
import type { Millis } from "@/lib/model/enums";
import type { RetentionRow } from "@/lib/server/dal/settings";

type Save = (changes: Record<string, RetentionPolicySetting>, baseUpdatedAt: Millis | null) => Promise<ActionResult<{ updatedAt: Millis }>>;

const MODE: Record<RetentionMode, string> = {
  auto_delete: "Delete automatically",
  auto_anonymise: "Remove names automatically",
  review: "Ask a person first",
  ttl: "Delete automatically",
  linked: "Kept with the request it belongs to",
};

function years(days: number): string {
  if (days === 0) return "—";
  if (days % 365 === 0 || days >= 2555) {
    const y = Math.round(days / 365);
    return `${y} year${y === 1 ? "" : "s"}`;
  }
  if (days % 30 === 0 && days < 365) return `${days / 30} month${days === 30 ? "" : "s"}`;
  return `${days} days`;
}

/** How long Haven keeps each kind of record (admin-ux §6.16; PLAN D105), within the allowed limits. */
export function RetentionEditor({ rows, updatedAt, save }: { rows: RetentionRow[]; updatedAt: Millis | null; save: Save }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [edits, setEdits] = useState<Record<string, RetentionPolicySetting>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = Object.keys(edits).length > 0;

  const set = (r: RetentionRow, patch: Partial<RetentionPolicySetting>) =>
    setEdits((e) => {
      const next = { days: e[r.id]?.days ?? r.days, mode: e[r.id]?.mode ?? r.mode, ...patch };
      const copy = { ...e };
      if (next.days === r.days && next.mode === r.mode) delete copy[r.id];
      else copy[r.id] = next;
      return copy;
    });

  const submit = () =>
    start(async () => {
      const r = await save(edits, updatedAt);
      if (r.ok) {
        setEdits({});
        setErrors({});
        toast({ title: "Saved. Haven keeps records this way from now on.", tone: "success" });
        return;
      }
      if (r.error.kind === "validation") setErrors(r.error.fields);
      toast({ title: r.error.kind === "validation" ? "Some of these aren’t allowed. See the notes." : r.error.message, tone: "danger" });
    });

  return (
    <div className="grid gap-4">
      <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-white shadow-soft">
        {rows.map((r) => {
          const days = edits[r.id]?.days ?? r.days;
          const mode = edits[r.id]?.mode ?? r.mode;
          const fixed = r.minDays === r.maxDays && r.modes.length === 1;
          const choices = [...new Set([r.minDays, 30, 90, 180, 365, 730, 1095, 2190, 2555, 3650, r.maxDays, r.days].filter((d) => d >= r.minDays && d <= r.maxDays))].sort((a, b) => a - b);
          return (
            <li key={r.id} data-ref={r.id} className="grid gap-2 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_180px_220px] md:items-center md:gap-4">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">{r.label}</p>
                {errors[r.id] ? <p className="text-[13px] font-semibold text-danger">{errors[r.id]}</p> : null}
              </div>
              {fixed ? (
                <p className="text-[14px] text-body md:col-span-2">
                  {years(days)} · {MODE[mode]}
                </p>
              ) : (
                <>
                  <Select aria-label={`How long to keep: ${r.label}`} value={String(days)} options={choices.map((d) => ({ value: String(d), label: years(d) }))} onChange={(e) => set(r, { days: Number(e.target.value) })} />
                  <Select aria-label={`Then: ${r.label}`} value={mode} disabled={r.modes.length === 1} options={r.modes.map((m) => ({ value: m, label: MODE[m] }))} onChange={(e) => set(r, { mode: e.target.value as RetentionMode })} />
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {dirty ? (
          <button type="button" onClick={() => setEdits({})} className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-bold text-body hover:bg-cream">
            Undo changes
          </button>
        ) : null}
        <Button type="button" variant="forest" size="sm" icon="none" loading={pending} disabled={!dirty || pending} onClick={submit}>
          Save how long we keep things
        </Button>
      </div>
    </div>
  );
}
