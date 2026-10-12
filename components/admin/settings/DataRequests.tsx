"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Mail } from "lucide-react";
import { confirmHref, isStepUp } from "@/components/admin/team/RolePicker";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Textarea } from "@/components/ui/form/Textarea";
import { formatStaffDate } from "@/lib/admin/format";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { DataRequestRow } from "@/lib/server/dal/settings";
import { cn } from "@/lib/cn";

type Move = (ref: string, edgeId: string, version: number, input?: { note?: string; reason?: string }) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;

const TYPE: Record<DataRequestRow["type"], string> = {
  access: "Wants a copy of their information",
  correction: "Wants something corrected",
  deletion: "Wants their information deleted",
  stop_contact: "Wants us to stop contacting them",
};
const STATUS: Record<DataRequestRow["status"], { label: string; cls: string }> = {
  unverified: { label: "Email not confirmed yet", cls: "bg-sand text-body" },
  verified: { label: "Ready to start", cls: "bg-marigold-100 text-umber" },
  in_progress: { label: "Being worked on", cls: "bg-cream text-ink" },
  completed: { label: "Done", cls: "bg-mint text-deep" },
  rejected: { label: "Closed without action", cls: "bg-sand text-body" },
};

/** Privacy requests (admin-ux §6.16; PLAN D104): confirmed requests, 30 days to answer each. */
export function DataRequests({ open, closed, now, tz, move }: { open: DataRequestRow[]; closed: DataRequestRow[]; now: Millis; tz: string; move: Move }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [finishing, setFinishing] = useState<{ row: DataRequestRow; edge: "complete" | "reject" } | null>(null);
  const [text, setText] = useState("");

  const run = (row: DataRequestRow, edge: string, input?: { note?: string; reason?: string }) =>
    start(async () => {
      const r = await move(row.ref, edge, row.version, input);
      if (r.ok) {
        toast({ title: edge === "start" ? `${row.ref} is being worked on` : edge === "complete" ? `${row.ref} is done. We’ve emailed them.` : `${row.ref} is closed`, tone: "success" });
        setFinishing(null);
        setText("");
        return;
      }
      const e = r.error;
      if (isStepUp(e)) {
        router.push(confirmHref());
        return;
      }
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });

  const row = (r: DataRequestRow) => {
    const daysLeft = Math.ceil((r.dueAt - now) / 86_400_000);
    const late = daysLeft < 0 && !["completed", "rejected"].includes(r.status);
    return (
      <li key={r.ref} data-ref={r.ref} className="rounded-[22px] bg-white p-4 shadow-soft md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-grotesk text-[13px] font-bold tabular-nums text-body">{r.ref}</p>
            <p className="text-[16px] font-extrabold text-ink">{TYPE[r.type]}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-body">
          <span className="font-semibold text-ink">{r.name}</span>
          <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">
            <Mail aria-hidden className="size-3.5" /> {r.email}
          </a>
          {!["completed", "rejected"].includes(r.status) ? (
            <span className={cn("inline-flex items-center gap-1", late && "font-bold text-danger")}>
              <CalendarClock aria-hidden className="size-3.5" /> {late ? `${-daysLeft} days late` : `Answer by ${formatStaffDate(r.dueAt, tz)}`}
            </span>
          ) : null}
        </p>
        {r.details ? <p className="mt-2 whitespace-pre-line rounded-2xl bg-cream px-3.5 py-2.5 text-[14.5px] text-ink">{r.details}</p> : null}
        {r.knownReferences.length ? <p className="mt-2 text-[13.5px] text-body">They mentioned: {r.knownReferences.join(", ")}</p> : null}
        {r.done ? <p className="mt-2 text-[13.5px] text-body">What was done: {r.done}</p> : null}
        {r.rejectionReason ? <p className="mt-2 text-[13.5px] text-body">Why it was closed: {r.rejectionReason}</p> : null}
        {r.status === "verified" || r.status === "in_progress" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {r.status === "verified" ? (
              <Button type="button" variant="forest" size="sm" icon="none" disabled={pending} onClick={() => run(r, "start")}>
                Start work
              </Button>
            ) : (
              <Button type="button" variant="forest" size="sm" icon="none" disabled={pending} onClick={() => setFinishing({ row: r, edge: "complete" })}>
                Mark it done
              </Button>
            )}
            <button type="button" disabled={pending} onClick={() => setFinishing({ row: r, edge: "reject" })} className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-bold text-body hover:bg-cream disabled:opacity-50">
              We can’t do this
            </button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      {open.length === 0 ? <p className="rounded-[22px] bg-white p-5 text-[15px] text-body shadow-soft">No privacy requests waiting.</p> : <ul className="grid gap-3">{open.map((r) => row(r))}</ul>}
      {closed.length ? (
        <details className="rounded-[22px] bg-white/60 p-4">
          <summary className="cursor-pointer text-[14.5px] font-bold text-ink">Finished requests ({closed.length})</summary>
          <ul className="mt-3 grid gap-3">
            {closed.map((r) => row(r))}
          </ul>
        </details>
      ) : null}

      <Sheet
        open={finishing !== null}
        onClose={() => setFinishing(null)}
        title={finishing?.edge === "complete" ? "Mark it done" : "Close without action"}
        description={finishing?.edge === "complete" ? "They’ll get an email saying their request is complete." : "Say why, for the record. They aren’t emailed; reply to them yourself."}
        footer={
          <Button
            type="button"
            variant="forest"
            icon="none"
            block
            loading={pending}
            disabled={pending || text.trim().length < (finishing?.edge === "complete" ? 5 : 10)}
            onClick={() => finishing && run(finishing.row, finishing.edge, finishing.edge === "complete" ? { note: text } : { reason: text })}
          >
            {finishing?.edge === "complete" ? "Mark done and email them" : "Close the request"}
          </Button>
        }
      >
        <Field name="dr-text" label={finishing?.edge === "complete" ? "What was done" : "Why we can’t do it"} hint={finishing?.edge === "complete" ? "For example: “Sent a copy of their records by email on 12 October.”" : undefined} counter={{ max: 600 }}>
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </Sheet>
    </div>
  );
}
