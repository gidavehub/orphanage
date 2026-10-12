"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import { StatusStepper } from "@/components/admin/ui/StatusStepper";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { FlagDisc } from "@/components/ui/flag";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { formatStaffDate } from "@/lib/admin/format";
import { countryName } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import type { TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import type { VolunteerDetailDTO } from "@/lib/server/dal/volunteers";
import { cn } from "@/lib/cn";
import { NoteComposer, SeenOnOpen } from "./support/SupportControls";
import { Timeline } from "./Timeline";

type R<T = { version: number }> = Promise<ActionResult<T>>;
export type VolunteerViewActions = {
  move: (ref: string, edgeId: string, version: number, input?: Record<string, unknown>) => R<{ version: number; at: Millis; status: string }>;
  checklist: (ref: string, version: number, stepId: string, done: boolean) => R;
  followUp: (ref: string, version: number, uid: string | null, at: Millis | null) => R;
  check: (ref: string, version: number, status: "not_required" | "pending" | "cleared" | "not_cleared") => R;
  addNote: (ref: string, kind: "note" | "call", text: string) => Promise<ActionResult>;
  seen: (ref: string) => Promise<void>;
};

export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[22px] bg-white p-5 shadow-soft", className)}>
      <h3 className="mb-3 text-[16px] font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-3 py-1.5 text-[14.5px]">
      <dt className="text-body">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

/** Steps and reasons shared by the volunteer and partner views. */
export function useRecordActions() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (p: () => Promise<ActionResult<unknown>>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await p();
      if (r.ok) {
        toast({ title: ok, tone: "success" });
        after?.();
        router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });
  return { pending, run };
}

export function FollowUp({ person, at, people, tz, canManage, save, pending }: { person: { uid: string; name: string } | null; at: Millis | null; people: Array<{ uid: string; name: string }>; tz: string; canManage: boolean; save: (uid: string | null, at: Millis | null) => void; pending: boolean }) {
  const [uid, setUid] = useState(person?.uid ?? "");
  const [date, setDate] = useState(at ? new Date(at).toISOString().slice(0, 10) : "");
  if (!canManage) return <p className="text-[14.5px] text-ink">{person ? `${person.name}${at ? `, by ${formatStaffDate(at, tz)}` : ""}` : "No one yet"}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-end">
      <Field name="followUpUid" label="Who follows up">
        <Select value={uid} options={[{ value: "", label: "No one yet" }, ...people.map((p) => ({ value: p.uid, label: p.name }))]} onChange={(e) => setUid(e.target.value)} />
      </Field>
      <Field name="followUpAt" label="By" optional>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="button" variant="outline" size="sm" icon="none" disabled={pending} onClick={() => save(uid || null, date ? Date.parse(`${date}T09:00:00Z`) : null)}>
        Save
      </Button>
    </div>
  );
}

export function StageMoves({ edges, statusLabel, onMove, pending }: { edges: Array<{ id: string; verb: string; asks?: string; to: string }>; statusLabel: (s: string) => string; onMove: (id: string, input: Record<string, unknown>) => void; pending: boolean }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState("");
  if (!edges.length) return null;
  const edge = edges.find((e) => e.id === asking);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {edges.map((e) => (
          <Button
            key={e.id}
            type="button"
            size="sm"
            icon="none"
            variant={e.id === "decline" || e.id === "inactivate" || e.id === "close" ? "outline" : "forest"}
            disabled={pending}
            onClick={() => (e.asks === "reason" || e.asks === "schedule" ? setAsking(e.id) : onMove(e.id, {}))}
          >
            {e.verb}
          </Button>
        ))}
      </div>
      {edge ? (
        <div className="grid gap-2 rounded-[16px] bg-sand/60 p-4">
          {edge.asks === "schedule" ? (
            <Field name="interviewAt" label="When is the interview?" optional>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          ) : (
            <Field name="reason" label={`Why ${edge.verb.toLowerCase()}?`} hint="A short line for the team. It isn’t sent to them.">
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="forest"
              icon="none"
              disabled={pending || (edge.asks === "reason" && reason.trim().length < 3)}
              onClick={() => {
                onMove(edge.id, edge.asks === "schedule" ? (when ? { interviewAt: Date.parse(when) } : {}) : { reason });
                setAsking(null);
                setReason("");
              }}
            >
              {edge.verb} → {statusLabel(edge.to)}
            </Button>
            <Button type="button" size="sm" variant="ghost" icon="none" onClick={() => setAsking(null)}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const CHECK = [
  { value: "not_required", label: "Not needed for this role" },
  { value: "pending", label: "Waiting for the result" },
  { value: "cleared", label: "Cleared" },
  { value: "not_cleared", label: "Not cleared" },
];

/** A volunteer application (admin-ux §6.9): stage and next steps, getting ready, follow-up, the person and their offer. */
export function VolunteerView({ d, timeline, tz, actions }: { d: VolunteerDetailDTO; timeline: TimelineEntryDTO[]; tz: string; actions: VolunteerViewActions }) {
  const { pending, run } = useRecordActions();
  const statusLabel = (s: string) => (s === "declined" ? "Not this time" : ({ submitted: "Submitted", screening: "Screening", interview: "Interview", approved: "Approved", onboarding: "Onboarding", active: "Active", inactive: "Inactive" } as Record<string, string>)[s] ?? s);
  const done = d.checklist.filter((s) => s.doneAt).length;

  return (
    <article aria-label={`Volunteer application ${d.ref}`} className="grid gap-5">
      <SeenOnOpen reference={d.ref} seen={actions.seen} />
      <header className="rounded-[26px] bg-white p-5 shadow-soft md:p-6">
        <Link href="/admin/people" className="mb-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-forest">
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} /> Volunteers
        </Link>
        <p className="font-grotesk text-[13px] font-semibold tabular-nums text-umber">{d.ref}</p>
        <h2 className="mt-1 flex flex-wrap items-center gap-2 text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">
          {d.name} <FlagDisc code={d.country} className="size-6" label={countryName(d.country)} />
        </h2>
        <p className="mt-1 text-[14px] text-body">Applied {formatStaffDate(d.createdAt, tz)}</p>
        <div className="mt-5">
          <StatusStepper workflow="volunteer" status={d.status} perms={[]} compact />
        </div>
        {d.canManage ? (
          <div className="mt-5 border-t border-line pt-4">
            <StageMoves edges={d.edges} statusLabel={statusLabel} pending={pending} onMove={(id, input) => run(() => actions.move(d.ref, id, d.version, input), `${d.name.split(" ")[0]} moved on`)} />
          </div>
        ) : null}
        {d.declineReason ? <p className="mt-3 text-[14px] text-body">Not this time: {d.declineReason}</p> : null}
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-5">
          {d.checklist.length || d.status === "approved" || d.status === "onboarding" ? (
            <Section title={`Getting ready${d.checklist.length ? ` · ${done} of ${d.checklist.length}` : ""}`}>
              <ul className="grid gap-2">
                {(d.checklist.length ? d.checklist : [
                  { id: "policy", label: "Read the safeguarding policy", doneAt: null, doneBy: null },
                  { id: "references", label: "References checked", doneAt: null, doneBy: null },
                  { id: "interview", label: "Interview done", doneAt: null, doneBy: null },
                  { id: "conduct", label: "Code of conduct signed", doneAt: null, doneBy: null },
                  { id: "training", label: "Safeguarding training done", doneAt: null, doneBy: null },
                ]).map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-[14px] p-2 hover:bg-sand/50">
                      <input type="checkbox" id={`step-${s.id}`} className="mt-0.5 size-5 accent-forest" checked={Boolean(s.doneAt)} disabled={!d.canManage || pending} onChange={(e) => run(() => actions.checklist(d.ref, d.version, s.id, e.target.checked), e.target.checked ? "Ticked" : "Unticked")} />
                      <span className="text-[15px] text-ink">
                        {s.label}
                        {s.doneAt ? <span className="block text-[12.5px] text-body">{s.doneBy ? `${s.doneBy.split(" ")[0]}, ` : ""}{formatStaffDate(s.doneAt, tz)}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {d.canManage ? (
            <Section title="Add to the record">
              <NoteComposer reference={d.ref} addNote={actions.addNote} />
            </Section>
          ) : null}
          <Section title="What happened">
            <Timeline entries={timeline} tz={tz} />
          </Section>
        </div>

        <div className="grid min-w-0 gap-5">
          <Section title="Follow-up">
            <FollowUp person={d.followUp.person} at={d.followUp.at} people={d.people} tz={tz} canManage={d.canManage} pending={pending} save={(uid, at) => run(() => actions.followUp(d.ref, d.version, uid, at), "Follow-up saved")} />
          </Section>
          <Section title="The person">
            <dl>
              <Row label="Email">
                <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline">
                  <Mail aria-hidden className="size-4" /> {d.email}
                </a>
              </Row>
              {d.phone ? (
                <Row label="Phone">
                  <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline">
                    <Phone aria-hidden className="size-4" /> {d.phone}
                  </a>
                </Row>
              ) : null}
              <Row label="Lives in">{[d.locality, countryName(d.country)].filter(Boolean).join(", ")}</Row>
              <Row label="Happy to be contacted">{d.consentToContact ? "Yes" : "No"}</Row>
              {d.heardFrom ? <Row label="Heard about us">{d.heardFrom}</Row> : null}
            </dl>
          </Section>
          <Section title="What they offer">
            <dl>
              <Row label="Interests">{d.interests.join(", ")}</Row>
              {d.skills ? <Row label="Skills">{d.skills}</Row> : null}
              {d.languages.length ? <Row label="Languages">{d.languages.join(", ")}</Row> : null}
              {d.availability ? <Row label="Availability">{d.availability}</Row> : null}
              <Row label="Worked with children">{d.workedWithChildren}</Row>
            </dl>
            {d.motivation ? <p className="mt-3 whitespace-pre-wrap rounded-[16px] bg-sand/50 p-3 text-[14.5px] text-ink">{d.motivation}</p> : null}
          </Section>
          <Section title="Safeguarding check">
            <p className="mb-3 inline-flex items-center gap-2 text-[14.5px] text-ink">
              <ShieldCheck aria-hidden className="size-4 text-forest" /> {d.backgroundCheckConsent ? "They agreed to a check if the role involves children." : "They haven’t agreed to a check yet."}
            </p>
            {d.canManage ? (
              <Field name="check" label="The outcome">
                <Select
                  value={d.safeguardingCheck?.status ?? ""}
                  placeholder="Not recorded yet"
                  options={CHECK}
                  onChange={(e) => run(() => actions.check(d.ref, d.version, e.target.value as "pending"), "Check recorded")}
                />
              </Field>
            ) : (
              <p className="text-[14.5px] text-ink">{CHECK.find((c) => c.value === d.safeguardingCheck?.status)?.label ?? "Not recorded yet"}</p>
            )}
            <p className="mt-2 text-[12.5px] text-body">Only the outcome is kept here. Check documents stay offline.</p>
          </Section>
        </div>
      </div>
    </article>
  );
}
