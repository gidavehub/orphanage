"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { RiskLevel } from "@/lib/model/status";
import { cn } from "@/lib/cn";

type Move = (ref: string, edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;
type ActionKind = "contacted_authority" | "contacted_service" | "home_visit" | "call" | "meeting" | "follow_up_due" | "follow_up_done" | "other";

// Placeholder definitions until Haven's policy review (admin-ux §17).
const RISKS: Array<{ value: RiskLevel; label: string; line: string }> = [
  { value: "low", label: "Low", line: "No current harm. Follow up." },
  { value: "medium", label: "Medium", line: "Needs action this week." },
  { value: "high", label: "High", line: "Harm likely. Act today." },
  { value: "immediate", label: "Immediate", line: "A child is in danger now. Escalate now." },
];

const ESCALATE_TO = [
  { value: "police", label: "Police" },
  { value: "social_welfare", label: "Social welfare" },
  { value: "child_protection_authority", label: "Child-protection authority" },
  { value: "health", label: "Health services" },
  { value: "other", label: "Other" },
];

const ACTION_KINDS: Array<{ value: ActionKind; label: string }> = [
  { value: "call", label: "A call" },
  { value: "home_visit", label: "A home visit" },
  { value: "meeting", label: "A meeting" },
  { value: "contacted_service", label: "Contacted a service" },
  { value: "contacted_authority", label: "Contacted an authority" },
  { value: "follow_up_done", label: "A follow-up done" },
  { value: "other", label: "Something else" },
];

function useHandle() {
  const { toast } = useToast();
  const router = useRouter();
  return (r: ActionResult<unknown>, ok: string): boolean => {
    if (r.ok) {
      toast({ title: ok, tone: "success" });
      return true;
    }
    const e = r.error;
    if (e.kind === "conflict") router.refresh();
    toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    return false;
  };
}

const toMillis = (v: string) => (v ? new Date(v).getTime() : null);

/**
 * The §7 steps for a concern: risk cards first, then escalate / refer / monitor / close, and the
 * actions log. Restricted look: deep and quiet, no celebrations.
 */
export function ConcernControls({
  reference,
  version,
  status,
  risk,
  edges,
  twoPerson,
  closure,
  emergencyNotice,
  actions,
}: {
  reference: string;
  version: number;
  status: string;
  risk: RiskLevel | null;
  edges: string[];
  twoPerson: boolean;
  closure: { byName: string; reason: string; secondSignOffAt: Millis | null; byMe: boolean } | null;
  emergencyNotice: string;
  actions: { move: Move; addAction: (ref: string, a: { kind: ActionKind; detail: string; dueAt?: Millis | null }) => Promise<ActionResult>; requestClose: (ref: string, reason: string, note: string) => Promise<ActionResult> };
}) {
  const [pending, start] = useTransition();
  const handle = useHandle();
  const [sheet, setSheet] = useState<null | "risk" | "escalate" | "refer" | "monitor" | "close" | "action" | "reopen">(null);
  const [level, setLevel] = useState<RiskLevel | null>(risk);
  const [text, setText] = useState("");
  const [to, setTo] = useState("police");
  const [extRef, setExtRef] = useState("");
  const [due, setDue] = useState("");
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<ActionKind>("call");

  const close = () => {
    setSheet(null);
    setText("");
    setExtRef("");
    setDue("");
    setReason("");
  };
  const run = (edgeId: string, input: Record<string, unknown>, ok: string) => start(async () => void (handle(await actions.move(reference, edgeId, version, input), ok) && close()));

  const highRisk = risk === "high" || risk === "immediate";
  const needsSecond = twoPerson && highRisk;

  return (
    <div className="grid gap-5">
      {status === "screening" || status === "risk_assessed" ? (
        <div>
          <p className="mb-3 text-[15px] font-extrabold text-ink">How serious is this?</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {RISKS.map((r) => (
              <button
                key={r.value}
                type="button"
                disabled={!edges.includes("assess_risk") && status !== "screening"}
                onClick={() => {
                  setLevel(r.value);
                  setSheet("risk");
                }}
                aria-pressed={risk === r.value}
                className={cn(
                  "grid min-h-[88px] content-start gap-1 rounded-[16px] border-2 p-3 text-left transition-colors",
                  risk === r.value ? "border-deep bg-deep text-white" : "border-line bg-white text-ink hover:border-deep",
                  r.value === "immediate" && risk !== r.value && "border-coral-800/40",
                )}
              >
                <span className="text-[15px] font-extrabold">{r.label}</span>
                <span className={cn("text-[13px] leading-snug", risk === r.value ? "text-white" : "text-body")}>{r.line}</span>
              </button>
            ))}
          </div>
          {status === "risk_assessed" ? <p className="mt-2 text-[13px] text-body">The risk level is set. Escalate, refer or monitor below.</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        {edges.includes("escalate") ? (
          <Button variant="forest" size="sm" icon="none" onClick={() => setSheet("escalate")}>
            Escalate now
          </Button>
        ) : null}
        {edges.includes("refer") ? (
          <Button variant="quiet" size="sm" icon="none" onClick={() => setSheet("refer")}>
            Record a referral to services
          </Button>
        ) : null}
        {edges.includes("monitor") ? (
          <Button variant="quiet" size="sm" icon="none" onClick={() => setSheet("monitor")}>
            Monitor and follow up
          </Button>
        ) : null}
        {status !== "closed" ? (
          <Button variant="quiet" size="sm" icon="none" onClick={() => setSheet("action")}>
            Record an action
          </Button>
        ) : null}
        {edges.includes("close_no_concern") || edges.includes("close") ? (
          <Button variant="quiet" size="sm" icon="none" onClick={() => setSheet("close")}>
            {closure && !closure.secondSignOffAt && !closure.byMe ? "Confirm closure" : "Close"}
          </Button>
        ) : null}
        {edges.includes("reopen") ? (
          <Button variant="quiet" size="sm" icon="none" onClick={() => setSheet("reopen")}>
            Reopen
          </Button>
        ) : null}
      </div>

      {closure && !closure.secondSignOffAt && status !== "closed" ? (
        <p className="rounded-[14px] bg-marigold-100 px-4 py-3 text-[14px] text-umber">
          {closure.byMe ? "You asked to close this. Waiting for a second safeguarding officer to confirm." : `${closure.byName} asked to close this (${closure.reason}). Please review, then confirm the closure.`}
        </p>
      ) : null}

      {sheet ? (
        <Sheet
          open
          tone="restricted"
          onClose={close}
          title={
            sheet === "risk"
              ? `Risk: ${RISKS.find((r) => r.value === level)?.label ?? ""}`
              : sheet === "escalate"
                ? "Escalate now"
                : sheet === "refer"
                  ? "Referral to services"
                  : sheet === "monitor"
                    ? "Next follow-up"
                    : sheet === "action"
                      ? "Record an action"
                      : sheet === "reopen"
                        ? "Reopen the concern"
                        : "Close the concern"
          }
          dirty={!!text}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="quiet" icon="none" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="forest"
                icon="none"
                loading={pending}
                disabled={pending}
                onClick={() => {
                  if (sheet === "risk") {
                    if (status === "screening") run("assess_risk", { riskLevel: level, rationale: text }, "Risk level recorded");
                    else handle({ ok: false, error: { kind: "not_allowed", message: "The risk is already set. Record an action to explain any change." } }, "");
                  } else if (sheet === "escalate") run("escalate", { escalateTo: to, externalRef: extRef, action: { kind: "contacted_authority", detail: text } }, "Escalated, and the team has been alerted");
                  else if (sheet === "refer") run("refer", { action: { kind: "contacted_service", detail: text } }, "Referral recorded");
                  else if (sheet === "monitor") run("monitor", { action: { kind: "follow_up_due", detail: text || "Follow-up", dueAt: toMillis(due) } }, "Follow-up scheduled");
                  else if (sheet === "reopen") run("reopen", { reason: text }, "Reopened");
                  else if (sheet === "action") start(async () => void (handle(await actions.addAction(reference, { kind, detail: text, dueAt: toMillis(due) }), "Action recorded") && close()));
                  else if (sheet === "close") {
                    if (status === "screening" || (status === "risk_assessed" && edges.includes("close_no_concern") && ["no_concern", "duplicate", "spam"].includes(reason)))
                      run("close_no_concern", { closureReason: reason, closingNote: text }, "Closed");
                    else if (needsSecond && (!closure || closure.byMe || closure.secondSignOffAt))
                      start(async () => void (handle(await actions.requestClose(reference, reason, text), "Closure requested. A second safeguarding officer must confirm.") && close()));
                    else run("close", { closureReason: reason || "resolved", closingNote: text }, needsSecond ? "Closure confirmed" : "Closed");
                  }
                }}
              >
                {sheet === "escalate" ? "Escalate and alert the team" : sheet === "close" ? (needsSecond && (!closure || closure.byMe) ? "Ask for closure" : "Close the concern") : "Save"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-5">
            {sheet === "risk" ? (
              <>
                {level === "immediate" ? <p className="rounded-[14px] bg-coral-800 p-4 text-[14.5px] font-semibold text-white">{emergencyNotice}</p> : null}
                <Field name="rationale" label="Why this level?" hint="Facts only: what you know and how you know it.">
                  <Textarea rows={5} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={2000} />
                </Field>
              </>
            ) : null}
            {sheet === "escalate" ? (
              <>
                <p className="rounded-[14px] bg-coral-800 p-4 text-[14.5px] font-semibold text-white">{emergencyNotice}</p>
                <Field name="to" label="Escalated to">
                  <Select value={to} onChange={(e) => setTo(e.currentTarget.value)} options={ESCALATE_TO} />
                </Field>
                <Field name="detail" label="Who you spoke to, when, and what was agreed">
                  <Textarea rows={5} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={2000} />
                </Field>
                <Field name="extRef" label="Their reference number" optional>
                  <Input value={extRef} onChange={(e) => setExtRef(e.currentTarget.value)} maxLength={120} />
                </Field>
              </>
            ) : null}
            {sheet === "refer" ? (
              <Field name="detail" label="Which service, who you spoke to, and what was agreed">
                <Textarea rows={5} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={2000} />
              </Field>
            ) : null}
            {sheet === "monitor" || sheet === "action" ? (
              <>
                {sheet === "action" ? (
                  <Field name="kind" label="What happened">
                    <Select value={kind} onChange={(e) => setKind(e.currentTarget.value as ActionKind)} options={ACTION_KINDS} />
                  </Field>
                ) : null}
                <Field name="detail" label={sheet === "monitor" ? "What should happen at the follow-up" : "Details"}>
                  <Textarea rows={4} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={2000} />
                </Field>
                <Field name="due" label="Next follow-up" optional={sheet === "action"}>
                  <Input type="datetime-local" value={due} onChange={(e) => setDue(e.currentTarget.value)} />
                </Field>
              </>
            ) : null}
            {sheet === "close" ? (
              <>
                <Field name="reason" label="Why is it closing?">
                  <Select
                    value={reason}
                    onChange={(e) => setReason(e.currentTarget.value)}
                    placeholder="Choose a reason"
                    options={
                      status === "screening" || status === "risk_assessed"
                        ? [
                            { value: "no_concern", label: "No concern after screening" },
                            { value: "duplicate", label: "A duplicate" },
                            { value: "spam", label: "Spam" },
                            ...(status === "risk_assessed" ? [{ value: "resolved", label: "Resolved" }, { value: "referred_out", label: "Handed to an authority" }] : []),
                          ]
                        : [
                            { value: "resolved", label: "Resolved" },
                            { value: "referred_out", label: "Handed to an authority" },
                            { value: "other", label: "Other" },
                          ]
                    }
                  />
                </Field>
                <Field name="note" label="Closing note">
                  <Textarea rows={4} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={2000} />
                </Field>
                {needsSecond ? <p className="text-[14px] text-body">High and immediate risk concerns need a second safeguarding officer to confirm the closure.</p> : null}
              </>
            ) : null}
            {sheet === "reopen" ? (
              <Field name="reason" label="Why reopen it?" hint="At least a sentence.">
                <Textarea rows={3} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={500} />
              </Field>
            ) : null}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
