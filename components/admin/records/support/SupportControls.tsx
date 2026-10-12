"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Composer, type ComposerResult } from "@/components/admin/ui/Composer";
import { PersonPicker } from "@/components/admin/ui/PersonPicker";
import { StatusStepper } from "@/components/admin/ui/StatusStepper";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { Segmented } from "@/components/ui/form/Segmented";
import type { ActionResult } from "@/lib/forms/types";
import type { EdgeSpec } from "@/lib/model/flows";
import type { Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import type { StatusOf } from "@/lib/model/status";
import { REFERRAL_TYPES } from "@/lib/model/enums";

type S = StatusOf<"support">;
type MoveFn = (ref: string, edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;

export type SupportControlsProps = {
  reference: string;
  status: S;
  version: number;
  perms: Permission[];
  timezone: string;
  history: Array<{ status: S; at: Millis }>;
  blocked: Partial<Record<string, string>>;
  canWrite: boolean;
  hasEmail: boolean;
  applicantFirstName: string;
  people: Array<{ uid: string; name: string; roleLabel: string; openCount: number }>;
  assigneeUid: string | null;
  me: string;
  /** Active entries from People › Directory, for the referral step. */
  referralOptions?: Array<{ id: string; name: string; type: string; approved: boolean }>;
  actions: {
    move: MoveFn;
    take: (ref: string) => Promise<ActionResult>;
  };
};

const DECLINE_REASONS = [
  { value: "out_of_scope", label: "It's not something Haven can help with" },
  { value: "not_eligible", label: "Doesn't meet the criteria" },
  { value: "no_capacity", label: "We don't have the capacity right now" },
  { value: "referred_elsewhere", label: "Better helped by another service" },
  { value: "duplicate", label: "A duplicate of another request" },
  { value: "other", label: "Something else" },
];

const CLOSE_REASONS = [
  { value: "duplicate", label: "Duplicate" },
  { value: "spam", label: "Spam" },
  { value: "withdrawn", label: "They withdrew it" },
];

const TYPE_LABEL: Record<string, string> = {
  health: "Health",
  legal: "Legal",
  education: "Education",
  protection: "Child protection",
  psychosocial: "Psychosocial",
  community: "Community",
  government: "Government",
  other: "Other",
};

function useResult() {
  const { toast } = useToast();
  const router = useRouter();
  return (r: ActionResult<unknown>, ok: string) => {
    if (r.ok) {
      toast({ title: ok, tone: "success" });
      return true;
    }
    const e = r.error;
    if (e.kind === "conflict") {
      toast({ title: "Someone else saved changes a moment ago", description: "The page has been refreshed with the latest version.", tone: "danger" });
      router.refresh();
    } else if (e.kind === "validation") {
      toast({ title: Object.values(e.fields)[0] ?? "Please check the form.", tone: "danger" });
    } else {
      toast({ title: "message" in e ? e.message : "That didn't work.", tone: "danger" });
    }
    return false;
  };
}

/** The stage, the next steps and the sheets they need (admin-ux §6.4 StatusStepper). */
export function SupportControls(p: SupportControlsProps) {
  const [edge, setEdge] = useState<EdgeSpec<S> | null>(null);
  const [pending, start] = useTransition();
  const handle = useResult();

  const run = (edgeId: string, input: Record<string, unknown> = {}, ok = "Done") =>
    start(async () => {
      const r = await p.actions.move(p.reference, edgeId, p.version, input);
      if (handle(r, ok)) setEdge(null);
    });

  const onMove = (e: EdgeSpec<S>) => {
    if (!e.asks) {
      run(e.id, {}, `${p.reference}: ${e.verb}`);
      return;
    }
    setEdge(e);
  };

  return (
    <div className="grid gap-4">
      <StatusStepper
        workflow="support"
        status={p.status}
        perms={p.canWrite ? p.perms : []}
        history={p.history}
        onMove={onMove}
        blocked={p.blocked}
        pending={pending}
        timezone={p.timezone}
      />
      {edge ? <EdgeSheet edge={edge} props={p} pending={pending} onClose={() => setEdge(null)} onRun={run} /> : null}
    </div>
  );
}

function EdgeSheet({ edge, props: p, pending, onClose, onRun }: { edge: EdgeSpec<S>; props: SupportControlsProps; pending: boolean; onClose: () => void; onRun: (id: string, input: Record<string, unknown>, ok: string) => void }) {
  const [assignee, setAssignee] = useState<string | null>(p.assigneeUid);
  const [text, setText] = useState("");
  const [callNote, setCallNote] = useState("");
  const [reason, setReason] = useState("");
  const [letThemKnow, setLetThemKnow] = useState(true);
  const [toName, setToName] = useState("");
  const [toType, setToType] = useState<string>("health");
  const [partnerId, setPartnerId] = useState<string>("");
  const [consent, setConsent] = useState(false);

  let body: React.ReactNode = null;
  let submit: (() => void) | null = null;
  let label = edge.verb;

  switch (edge.id) {
    case "assign": {
      const person = p.people.find((x) => x.uid === assignee);
      body = (
        <PersonPicker
          label="Who will look after this request?"
          people={p.people.map((x) => ({ uid: x.uid, name: x.name, roleLabel: x.roleLabel, openCount: x.openCount }))}
          value={assignee}
          onChange={setAssignee}
          meUid={p.me}
        />
      );
      submit = person ? () => onRun("assign", { assignee: { uid: person.uid, name: person.name } }, `Given to ${person.name.split(" ")[0]}`) : null;
      label = person ? `Give it to ${person.name.split(" ")[0]}` : "Choose someone";
      break;
    }
    case "ask_more_info":
      body = (
        <div className="grid gap-5">
          <Field name="message" label={`What do you need from ${p.applicantFirstName}?`} hint={p.hasEmail ? "This goes in the email, in your words." : "There's no email address, so call them and ask."}>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={1500} />
          </Field>
          {!p.hasEmail ? (
            <Field name="callNote" label="What happened on the call?">
              <Textarea rows={3} value={callNote} onChange={(e) => setCallNote(e.currentTarget.value)} maxLength={1000} />
            </Field>
          ) : (
            <p className="rounded-control bg-cream p-4 text-[14px] text-body">They&rsquo;ll get the email &ldquo;We need a little more information&rdquo; with your message and a reply-by date 14 days from today.</p>
          )}
        </div>
      );
      submit = text.trim() ? () => onRun("ask_more_info", { message: text, callNote: callNote || undefined }, p.hasEmail ? "Email queued and the request is waiting for them" : "Noted, and the request is waiting for them") : null;
      label = p.hasEmail ? "Send and wait for them" : "Save and wait for them";
      break;
    case "refer":
      body = (
        <div className="grid gap-5">
          {p.referralOptions?.length ? (
            <Field name="partnerId" label="From the directory" optional hint="Or type another service below.">
              <Select
                value={partnerId}
                options={[
                  { value: "", label: "Someone not in the directory" },
                  ...p.referralOptions.map((o) => ({ value: o.id, label: `${o.name} · ${TYPE_LABEL[o.type] ?? o.type}${o.approved ? "" : " (not approved yet)"}` })),
                ]}
                onChange={(e) => {
                  const id = e.currentTarget.value;
                  setPartnerId(id);
                  const o = p.referralOptions?.find((x) => x.id === id);
                  if (o) {
                    setToName(o.name);
                    setToType(o.type);
                  }
                }}
              />
            </Field>
          ) : null}
          <Field name="toName" label="Who did you refer them to?" hint="The service or organisation.">
            <Input
              value={toName}
              onChange={(e) => {
                setToName(e.currentTarget.value);
                setPartnerId("");
              }}
              maxLength={120}
            />
          </Field>
          <Field name="toType" label="Kind of service">
            <Select value={toType} onChange={(e) => setToType(e.currentTarget.value)} options={REFERRAL_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t }))} />
          </Field>
          <Field name="note" label="Anything the team should know" optional>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={500} />
          </Field>
          <Checkbox name="consent" label={`${p.applicantFirstName} agreed we can share their details with this service.`} checked={consent} onChange={(e) => setConsent(e.currentTarget.checked)} />
        </div>
      );
      submit = toName.trim() && consent ? () => onRun("refer", { referral: { partnerId: partnerId || null, toName, toType, note: text || null, consentToShare: true } }, "Referral recorded") : null;
      break;
    case "complete":
      body = (
        <Field name="outcome" label="What support was given?" hint="A short, non-identifying summary: what helped, and what changed.">
          <Textarea rows={4} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={500} />
        </Field>
      );
      submit = text.trim().length >= 10 ? () => onRun("complete", { outcome: text }, "Marked as complete") : null;
      break;
    case "decline":
      body = (
        <div className="grid gap-5">
          <Field name="reasonCode" label="Why are we declining? (only the team sees this)">
            <Select value={reason} onChange={(e) => setReason(e.currentTarget.value)} placeholder="Choose a reason" options={DECLINE_REASONS} />
          </Field>
          <Field name="note" label="A note for the team" optional>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={500} />
          </Field>
          {p.hasEmail ? (
            <Segmented
              label={`Email ${p.applicantFirstName}?`}
              options={[
                { value: "yes", label: "Send a kind note" },
                { value: "no", label: "Don't email (told by phone)" },
              ]}
              value={letThemKnow ? "yes" : "no"}
              onChange={(v) => setLetThemKnow(v === "yes")}
            />
          ) : (
            <p className="text-[14px] text-body">There&rsquo;s no email address. Please tell them by phone if it&rsquo;s safe to.</p>
          )}
        </div>
      );
      submit = reason ? () => onRun("decline", { reasonCode: reason, note: text || undefined, letThemKnow }, letThemKnow && p.hasEmail ? "Declined, and a kind note is queued" : "Declined") : null;
      break;
    case "close_duplicate":
      body = (
        <Field name="closeReason" label="Why is it being closed?">
          <Select value={reason} onChange={(e) => setReason(e.currentTarget.value)} placeholder="Choose a reason" options={CLOSE_REASONS} />
        </Field>
      );
      submit = reason ? () => onRun("close_duplicate", { closeReason: reason }, "Closed") : null;
      break;
    case "reopen":
      body = (
        <Field name="reason" label="Why reopen it?" hint="At least a sentence: it's kept with the record.">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={500} />
        </Field>
      );
      submit = text.trim().length >= 10 ? () => onRun("reopen", { reason: text }, "Reopened") : null;
      break;
    case "move_to_safeguarding":
      body = (
        <p className="text-[15px] leading-relaxed text-ink">
          If something suggests a child is at risk, please tell the safeguarding team straight away using <strong>＋ New → Log a concern from a call</strong>, and mention this reference. They&rsquo;ll move it into Safeguarding.
        </p>
      );
      submit = null;
      label = "Use Log a concern";
      break;
    default:
      body = <p className="text-[15px] text-body">{edge.verb}?</p>;
      submit = () => onRun(edge.id, {}, edge.verb);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={edge.verb}
      size="md"
      dirty={!!text || !!toName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="quiet" icon="none" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="forest" icon="none" loading={pending} disabled={!submit || pending} onClick={() => submit?.()}>
            {label}
          </Button>
        </div>
      }
    >
      {body}
    </Sheet>
  );
}

/** "Take it" for a request no one is looking after yet. */
export function TakeButton({ reference, take }: { reference: string; take: (ref: string) => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  const handle = useResult();
  return (
    <Button variant="forest" size="sm" icon="none" loading={pending} onClick={() => start(async () => void handle(await take(reference), `${reference} is yours`))}>
      Take it
    </Button>
  );
}

/** Marks the record seen once it is open (the Inbox's unread dot). */
export function SeenOnOpen({ reference, seen }: { reference: string; seen: (ref: string) => Promise<void> }) {
  useEffect(() => {
    void seen(reference).catch(() => undefined);
  }, [reference, seen]);
  return null;
}

/** Note / Log a call composer (admin-ux §6.4 Composer). */
export function NoteComposer({ reference, addNote }: { reference: string; addNote: (ref: string, kind: "note" | "call", text: string) => Promise<ActionResult> }) {
  const onSubmit = async ({ mode, text }: { mode: string; text: string }): Promise<ComposerResult> => {
    const r = await addNote(reference, mode === "call" ? "call" : "note", text);
    if (r.ok) return { ok: true, message: mode === "call" ? "Call logged" : "Note added" };
    const e = r.error;
    return { ok: false, message: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the note.") : "message" in e ? e.message : "That didn't save." };
  };
  return <Composer reference={reference} modes={["note", "call"]} onSubmit={onSubmit} sensitive />;
}

/** Eligibility and verification (needed before Approve). */
export function TriagePanel({
  reference,
  version,
  eligibility,
  verification,
  method,
  canWrite,
  save,
}: {
  reference: string;
  version: number;
  eligibility: "eligible" | "ineligible" | "unclear" | null;
  verification: string;
  method: string | null;
  canWrite: boolean;
  save: (ref: string, input: { eligibility: "eligible" | "ineligible" | "unclear" | null; verification: "not_started" | "in_progress" | "verified" | "failed"; method: string | null; expectedVersion: number }) => Promise<ActionResult>;
}) {
  const [elig, setElig] = useState<string>(eligibility ?? "");
  const [ver, setVer] = useState<string>(verification);
  const [how, setHow] = useState(method ?? "");
  const [pending, start] = useTransition();
  const handle = useResult();
  const dirty = elig !== (eligibility ?? "") || ver !== verification || how !== (method ?? "");
  if (!canWrite) return null;
  return (
    <div className="grid gap-4">
      <Segmented
        label="Eligibility"
        options={[
          { value: "eligible", label: "Eligible" },
          { value: "unclear", label: "Unclear" },
          { value: "ineligible", label: "Not eligible" },
        ]}
        value={elig as "eligible"}
        onChange={(v) => setElig(v)}
      />
      <Field name={`verification-${reference}`} label="Checked and verified?">
        <Select
          value={ver}
          onChange={(e) => setVer(e.currentTarget.value)}
          options={[
            { value: "not_started", label: "Not started" },
            { value: "in_progress", label: "Checking now" },
            { value: "verified", label: "Verified" },
            { value: "failed", label: "Couldn't verify" },
          ]}
        />
      </Field>
      <Field name={`method-${reference}`} label="How was it checked?" optional hint="For example: called the school, saw the fee letter.">
        <Input value={how} onChange={(e) => setHow(e.currentTarget.value)} maxLength={200} />
      </Field>
      <div>
        <Button
          variant="forest"
          size="sm"
          icon="none"
          disabled={!dirty || pending}
          loading={pending}
          onClick={() =>
            start(async () => {
              void handle(
                await save(reference, {
                  eligibility: (elig || null) as "eligible" | null,
                  verification: ver as "verified",
                  method: how || null,
                  expectedVersion: version,
                }),
                "Checks saved",
              );
            })
          }
        >
          Save the checks
        </Button>
      </div>
    </div>
  );
}
