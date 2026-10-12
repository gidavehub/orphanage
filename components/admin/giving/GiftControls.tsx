"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { StatusStepper } from "@/components/admin/ui/StatusStepper";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Segmented } from "@/components/ui/form/Segmented";
import type { ActionResult } from "@/lib/forms/types";
import type { EdgeSpec } from "@/lib/model/flows";
import type { Currency, Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";
import type { StatusOf } from "@/lib/model/status";
import type { GiftDetailDTO } from "@/lib/server/dal/donations";
import { cn } from "@/lib/cn";

type S = StatusOf<"donation">;
type Move = (ref: string, kind: "cash" | "in_kind", edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
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

/** The gift's stage and the sheets each step needs (admin-ux §6.6). */
export function GiftControls({ d, perms, tz, move }: { d: GiftDetailDTO; perms: Permission[]; tz: string; move: Move }) {
  const [edge, setEdge] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const handle = useHandle();
  const run = (id: string, input: Record<string, unknown>, ok: string) => start(async () => void (handle(await move(d.ref, d.kind, id, d.version, input), ok) && setEdge(null)));

  const onMove = (e: EdgeSpec<S>) => {
    if (["receive", "acknowledge", "allocate", "reallocate", "cancel_pledge", "refund", "reopen"].includes(e.id)) setEdge(e.id);
    else run(e.id, {}, e.verb);
  };

  return (
    <div className="grid gap-4">
      <StatusStepper workflow={d.workflow} status={d.status} perms={d.canWrite ? perms : []} history={d.history} timezone={tz} pending={pending} onMove={onMove} />
      {edge === "receive" ? <ReceiveSheet d={d} pending={pending} onClose={() => setEdge(null)} onRun={run} /> : null}
      {edge === "acknowledge" ? <AcknowledgeSheet d={d} pending={pending} onClose={() => setEdge(null)} onRun={run} /> : null}
      {edge === "allocate" || edge === "reallocate" ? <AllocationSheet d={d} edgeId={edge} pending={pending} onClose={() => setEdge(null)} onRun={run} /> : null}
      {edge === "cancel_pledge" || edge === "refund" || edge === "reopen" ? <CancelSheet d={d} edgeId={edge} pending={pending} onClose={() => setEdge(null)} onRun={run} /> : null}
    </div>
  );
}

type SheetProps = { d: GiftDetailDTO; pending: boolean; onClose: () => void; onRun: (id: string, input: Record<string, unknown>, ok: string) => void };

function Footer({ onClose, onGo, label, disabled, pending }: { onClose: () => void; onGo: () => void; label: string; disabled?: boolean; pending: boolean }) {
  return (
    <div className="flex justify-end gap-3">
      <Button variant="quiet" icon="none" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="forest" icon="none" loading={pending} disabled={disabled || pending} onClick={onGo}>
        {label}
      </Button>
    </div>
  );
}

function ReceiveSheet({ d, pending, onClose, onRun }: SheetProps) {
  const [method, setMethod] = useState("bank_transfer");
  const [ext, setExt] = useState(d.externalRef ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("");
  const cash = d.kind === "cash";
  return (
    <Sheet
      open
      onClose={onClose}
      title={cash ? "Mark as received" : "Mark items received"}
      footer={
        <Footer
          onClose={onClose}
          pending={pending}
          disabled={!cash && !desc.trim()}
          label="It has arrived"
          onGo={() =>
            onRun(
              "receive",
              cash ? { method, externalRef: ext || null, receivedAt: new Date(`${date}T12:00:00Z`).getTime() } : { received: { description: desc, quantity: qty, valueMinor: null }, receivedAt: new Date(`${date}T12:00:00Z`).getTime() },
              cash ? `${d.amountLabel} marked as received` : "Items marked as received",
            )
          }
        />
      }
    >
      <div className="grid gap-5">
        {cash ? (
          <>
            <p className="font-display text-[34px] text-ink">{d.amountLabel}</p>
            <Field name="method" label="How did it arrive?">
              <Select value={method} onChange={(e) => setMethod(e.currentTarget.value)} options={d.online ? [{ value: "stripe", label: "Card (Stripe)" }, ...METHODS] : METHODS} />
            </Field>
            <Field name="ext" label="Bank or mobile-money reference" optional>
              <Input value={ext} onChange={(e) => setExt(e.currentTarget.value)} maxLength={80} />
            </Field>
          </>
        ) : (
          <>
            <Field name="desc" label="What arrived?">
              <Input value={desc} onChange={(e) => setDesc(e.currentTarget.value)} maxLength={300} placeholder="40 school bags, 2 boxes of exercise books" />
            </Field>
            <Field name="qty" label="How many" optional>
              <Input value={qty} onChange={(e) => setQty(e.currentTarget.value)} maxLength={80} />
            </Field>
          </>
        )}
        <Field name="date" label="Date received">
          <Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.currentTarget.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function AcknowledgeSheet({ d, pending, onClose, onRun }: SheetProps) {
  const [send, setSend] = useState(!!d.donor.email);
  return (
    <Sheet open onClose={onClose} title="Say thank you" footer={<Footer onClose={onClose} pending={pending} label={send ? "Send thank-you and receipt" : "Issue the receipt"} onGo={() => onRun("acknowledge", { letThemKnow: send }, send ? "Thank-you and receipt queued" : "Receipt issued")} />}>
      <div className="grid gap-4 text-[15px] leading-relaxed text-ink">
        <p>Haven gives this gift the next receipt number, then {send ? `emails ${d.donor.anonymous ? "the donor" : d.donor.name.split(" ")[0]} a thank-you with the receipt.` : "you can print the receipt."}</p>
        {d.donor.email ? (
          <Segmented
            label="Email the donor?"
            options={[
              { value: "yes", label: "Send the email" },
              { value: "no", label: "Not now (I'll print it)" },
            ]}
            value={send ? "yes" : "no"}
            onChange={(v) => setSend(v === "yes")}
          />
        ) : (
          <p className="rounded-[14px] bg-cream p-3 text-[14px] text-body">There&rsquo;s no email address, so print the receipt and hand it over.</p>
        )}
      </div>
    </Sheet>
  );
}

type Line = { key: string; amount: string };

function AllocationSheet({ d, edgeId, pending, onClose, onRun }: SheetProps & { edgeId: string }) {
  const currency: Currency = d.amount?.currency ?? "USD";
  const total = d.amount?.amountMinor ?? 0;
  const initial: Line[] = d.allocations.length
    ? d.allocations.map((a) => ({ key: a.key, amount: String(fromMinor(a.amountMinor, currency)) }))
    : [{ key: d.options.find((o) => o.label === d.preferred)?.key ?? "general", amount: String(fromMinor(total, currency)) }];
  const [lines, setLines] = useState<Line[]>(initial);
  const placed = useMemo(() => lines.reduce((n, l) => n + (Number(l.amount) > 0 ? toMinor(Number(l.amount), currency) : 0), 0), [lines, currency]);
  const left = total - placed;
  const over = d.kind === "cash" && left < 0;
  const pct = total ? Math.min(100, Math.round((placed / total) * 100)) : 0;
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <Sheet
      open
      onClose={onClose}
      title="Put it towards"
      size="lg"
      footer={
        <Footer
          onClose={onClose}
          pending={pending}
          disabled={over || placed <= 0}
          label="Save where it goes"
          onGo={() =>
            onRun(
              edgeId,
              {
                allocations: lines
                  .filter((l) => Number(l.amount) > 0)
                  .map((l) => ({ target: d.options.find((o) => o.key === l.key)!.target, amountMinor: toMinor(Number(l.amount), currency) })),
              },
              left === 0 ? "All of it is placed" : "Saved. Some is still to place.",
            )
          }
        />
      }
    >
      <div className="grid gap-4">
        <p className="text-[15px] text-body">
          The donor chose <span className="font-bold text-ink">{d.preferred}</span>. Split it if it should go to more than one place.
        </p>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_140px_auto] items-end gap-2">
            <Field name={`target-${i}`} label={i === 0 ? "Where" : "And"}>
              <Select value={l.key} onChange={(e) => update(i, { key: e.currentTarget.value })} options={d.options.map((o) => ({ value: o.key, label: o.label }))} />
            </Field>
            <Field name={`amount-${i}`} label={`Amount (${currency})`}>
              <Input inputMode="decimal" value={l.amount} onChange={(e) => update(i, { amount: e.currentTarget.value.replace(/[^\d.]/g, "") })} />
            </Field>
            <button type="button" aria-label="Remove this line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="mb-1 grid size-11 place-items-center rounded-full text-body hover:bg-pebble disabled:opacity-30">
              <Trash2 aria-hidden className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="quiet" size="sm" icon="none" onClick={() => setLines((ls) => [...ls, { key: "general", amount: left > 0 ? String(fromMinor(left, currency)) : "" }])} className="justify-self-start">
          <span className="inline-flex items-center gap-1.5">
            <Plus aria-hidden className="size-4" /> Split across another
          </span>
        </Button>
        {d.kind === "cash" ? (
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-pebble">
              <div className={cn("h-full rounded-full transition-[width]", over ? "bg-coral-800" : left === 0 ? "bg-forest" : "bg-marigold")} style={{ width: `${pct}%` }} />
            </div>
            <p className={cn("mt-2 text-[14px] font-bold", over ? "text-coral-800" : left === 0 ? "text-forest" : "text-umber")}>
              {over ? `${formatMoney({ amountMinor: -left, currency })} more than the gift` : left === 0 ? "All of it is placed ✓" : `${formatMoney({ amountMinor: left, currency })} left to place`}
            </p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function CancelSheet({ d, edgeId, pending, onClose, onRun }: SheetProps & { edgeId: string }) {
  const [reason, setReason] = useState("pledge_withdrawn");
  const [amount, setAmount] = useState(d.amount ? String(fromMinor(d.amount.amountMinor, d.amount.currency)) : "");
  const [why, setWhy] = useState("");
  const currency = d.amount?.currency ?? "USD";
  return (
    <Sheet
      open
      onClose={onClose}
      title={edgeId === "refund" ? "Record a refund" : edgeId === "reopen" ? "Reopen" : "Cancel the pledge"}
      footer={
        <Footer
          onClose={onClose}
          pending={pending}
          label={edgeId === "refund" ? "Record the refund" : edgeId === "reopen" ? "Reopen" : "Cancel the pledge"}
          disabled={edgeId === "reopen" && why.trim().length < 10}
          onGo={() =>
            edgeId === "refund"
              ? onRun("refund", { refundMinor: toMinor(Number(amount) || 0, currency) }, "Refund recorded")
              : edgeId === "reopen"
                ? onRun("reopen", { reason: why }, "Reopened")
                : onRun("cancel_pledge", { cancelReason: reason }, "Pledge cancelled")
          }
        />
      }
    >
      {edgeId === "refund" ? (
        <Field name="refund" label={`Amount refunded (${currency})`} hint="Totals for the causes it was placed with are reduced.">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.currentTarget.value.replace(/[^\d.]/g, ""))} />
        </Field>
      ) : edgeId === "reopen" ? (
        <Field name="why" label="Why reopen it?">
          <Input value={why} onChange={(e) => setWhy(e.currentTarget.value)} maxLength={300} />
        </Field>
      ) : (
        <Field name="reason" label="Why?">
          <Select
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            options={[
              { value: "pledge_withdrawn", label: "They changed their mind" },
              { value: "duplicate", label: "A duplicate" },
              { value: "other", label: "Something else" },
            ]}
          />
        </Field>
      )}
    </Sheet>
  );
}
