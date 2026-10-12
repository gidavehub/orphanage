"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Check, ExternalLink, Phone, ShieldAlert, Video } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { AGE_BAND_LABEL } from "@/lib/model/labels";
import type { SessionDTO } from "@/lib/server/dal/appointments";
import { cn } from "@/lib/cn";

type R<T = { version: number }> = Promise<ActionResult<T>>;
type Actions = {
  move: (ref: string, edgeId: string, version: number, input?: Record<string, unknown>) => R<{ version: number; at: Millis; status: string }>;
  setZoom: (ref: string, version: number, url: string) => R;
  reassign: (ref: string, version: number, counsellorUid: string) => R;
  invite: (ref: string, version: number) => R;
  addNote: (ref: string, text: string) => R;
  /** Present only when the Zoom API is connected. */
  createZoom?: (ref: string, version: number) => R;
  startAsHost?: (ref: string) => Promise<{ url: string | null }>;
};

const fmt = (ms: number, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: tz }).format(ms);
const city = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");
const ymd = (ms: number, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
const hm = (ms: number, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);

function Card({ id, title, children, className }: { id?: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-label={title} className={cn("scroll-mt-24 rounded-[22px] bg-white p-5 shadow-soft", className)}>
      <h2 className="mb-3 text-[17px] font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/**
 * One counselling session (admin-ux §6.7): when (staff and client timezones), counsellor, Zoom link,
 * the invitation with reminders, attendance, and short sealed follow-up notes for the counsellor.
 */
export function SessionView({ d, actions }: { d: SessionDTO; actions: Actions }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [zoom, setZoom] = useState(d.joinUrl ?? "");
  const [date, setDate] = useState(ymd(d.startsAt, d.staffTimezone));
  const [time, setTime] = useState(hm(d.startsAt, d.staffTimezone));
  const [duration, setDuration] = useState(String(d.durationMin));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const edge = (id: string) => d.edges.some((e) => e.id === id);
  const [now] = useState(() => Date.now());
  const started = d.startsAt <= now;
  const ended = d.startsAt + d.durationMin * 60_000 <= now + 5 * 60_000;

  const run = (p: () => Promise<ActionResult<unknown>>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await p();
      if (r.ok) {
        setErrors({});
        toast({ title: ok, tone: "success" });
        after?.();
        router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "validation") setErrors(e.fields);
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });

  const staffWhen = `${fmt(d.startsAt, d.staffTimezone, { weekday: "long", day: "numeric", month: "long" })}, ${hm(d.startsAt, d.staffTimezone)}–${hm(d.startsAt + d.durationMin * 60_000, d.staffTimezone)}`;
  const otherTz = d.clientTimezone !== d.staffTimezone;

  return (
    <>
      <PageHeader title={`${d.client.firstName} · session ${d.sessionNumber}`} description={d.ref} back={{ label: "Sessions", href: "/admin/counselling" }} actions={<StatusPill workflow="appointment" status={d.status} />} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-5">
          <Card title="When">
            <p className="text-[17px] font-bold text-ink">{staffWhen}</p>
            <p className="mt-1 text-[14.5px] text-body">
              {hm(d.startsAt, d.staffTimezone)} in {city(d.staffTimezone)}
              {otherTz ? ` · ${hm(d.startsAt, d.clientTimezone)} in ${city(d.clientTimezone)} for ${d.client.firstName}` : ""} · {d.durationMin} minutes
            </p>
            {edge("reschedule") ? (
              <details id="reschedule" className="mt-4 rounded-[16px] border border-line p-4 [&[open]>summary]:mb-3">
                <summary className="cursor-pointer text-[15px] font-bold text-forest">Find a new time</summary>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field name="date" label="Date" error={errors.date}>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                  <Field name="time" label={`Time in ${city(d.staffTimezone)}`}>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </Field>
                  <Field name="duration" label="Length">
                    <Select value={duration} options={["30", "45", "60", "90"].map((m) => ({ value: m, label: `${m} minutes` }))} onChange={(e) => setDuration(e.target.value)} />
                  </Field>
                </div>
                <p className="mt-2 text-[13.5px] text-body">{d.confirmedAt ? "The old reminders are cancelled and a new invitation goes out with the new time." : "Send the invitation once the time is right."}</p>
                <Button type="button" variant="forest" size="sm" icon="none" className="mt-3" disabled={pending} onClick={() => run(() => actions.move(d.ref, "reschedule", d.version, { date, time, durationMin: Number(duration) }), "Moved to the new time")}>
                  Save the new time
                </Button>
              </details>
            ) : null}
          </Card>

          {d.status === "scheduled" ? (
            <Card id="zoom" title={d.mode === "zoom" ? "Zoom" : d.mode === "phone" ? "Phone call" : "In person"}>
              {d.mode === "zoom" ? (
                <>
                  <Field name="zoomUrl" label="Paste the Zoom link" hint="Starts with https:// and has zoom.us/j/ in it." error={errors.zoomUrl}>
                    <Input type="url" inputMode="url" value={zoom} placeholder="https://zoom.us/j/…" onChange={(e) => setZoom(e.target.value)} readOnly={!d.canManage} />
                  </Field>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {d.canManage ? (
                      <Button type="button" variant="outline" size="sm" icon="none" disabled={pending || zoom.trim() === (d.joinUrl ?? "")} onClick={() => run(() => actions.setZoom(d.ref, d.version, zoom), "Zoom link saved")}>
                        Save the link
                      </Button>
                    ) : null}
                    {d.joinUrl ? (
                      <a href={d.joinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
                        Open to test <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                  {actions.createZoom && d.canManage && !d.joinUrl ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button type="button" variant="forest" size="sm" icon="none" disabled={pending} onClick={() => run(() => actions.createZoom!(d.ref, d.version), "Zoom meeting made")}>
                        Make a Zoom meeting
                      </Button>
                      <span className="text-[13.5px] text-body">Or paste a link above.</span>
                    </div>
                  ) : null}
                  {actions.startAsHost && d.zoomFromApi && d.isMine ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon="none"
                      className="mt-3"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await actions.startAsHost!(d.ref);
                          if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
                          else toast({ title: "Zoom couldn't open the meeting as host just now. Use the link instead.", tone: "danger" });
                        })
                      }
                    >
                      Start as host
                    </Button>
                  ) : null}
                  {!actions.createZoom ? <p className="mt-3 text-[13.5px] text-body">Creating links automatically isn’t connected yet. Paste a link from Zoom for now.</p> : null}
                </>
              ) : d.mode === "phone" ? (
                <p className="inline-flex items-center gap-2 text-[15px] text-ink">
                  <Phone aria-hidden className="size-4" />
                  {d.client.phoneForCall ?? "The number shows here from 24 hours before the call."}
                </p>
              ) : (
                <p className="text-[15px] text-body">Meet at the Haven office. The invitation gives the time only.</p>
              )}
            </Card>
          ) : null}

          {d.status === "scheduled" && d.canManage ? (
            <Card title="Invitation and reminders">
              {d.confirmedAt ? (
                <p className="inline-flex items-start gap-2 text-[15px] text-deep">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Invitation sent {fmt(d.confirmedAt, d.staffTimezone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}. Reminders will go{" "}
                    {[d.reminders.reminder24hQueuedAt ? "24 h" : null, d.reminders.reminder1hQueuedAt ? "1 h" : null].filter(Boolean).join(" and ") || "no more (it’s too close)"} before.
                  </span>
                </p>
              ) : (
                <>
                  <p className="text-[15px] text-body">
                    {d.client.hasEmail ? `${d.client.firstName} gets an email with the time in their timezone, the link and a calendar file. Reminders go 24 hours and 1 hour before.` : "There’s no email address for this client, so let them know the time another way."}
                  </p>
                  {d.client.hasEmail ? (
                    <Button type="button" variant="forest" size="sm" icon="send" className="mt-3" disabled={pending || (d.mode === "zoom" && !d.joinUrl)} onClick={() => run(() => actions.invite(d.ref, d.version), "Invitation sent")}>
                      Send the invitation
                    </Button>
                  ) : null}
                  {d.mode === "zoom" && !d.joinUrl ? <p className="mt-2 text-[13.5px] text-umber">Add the Zoom link first.</p> : null}
                </>
              )}
            </Card>
          ) : null}

          {d.status === "scheduled" && (edge("attended") || edge("no_show")) && started ? (
            <Card title="How did it go?">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2 rounded-[16px] bg-mint/50 p-3">
                  <Field name="followUp" label="Suggest another session by" optional>
                    <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                  </Field>
                  <Button
                    type="button"
                    variant="forest"
                    size="sm"
                    icon="none"
                    disabled={pending || !ended}
                    onClick={() => run(() => actions.move(d.ref, "attended", d.version, followUp ? { followUpBy: Date.parse(`${followUp}T12:00:00Z`) } : {}), "Marked as attended")}
                  >
                    They came
                  </Button>
                  {!ended ? <p className="text-[13px] text-body">You can mark this once the session has ended.</p> : null}
                </div>
                <div className="grid content-end gap-2 rounded-[16px] bg-marigold-100/60 p-3">
                  <p className="text-[14px] text-umber">If they didn’t come, you can offer a new time from Find a new time.</p>
                  <Button type="button" variant="outline" size="sm" icon="none" disabled={pending} onClick={() => run(() => actions.move(d.ref, "no_show", d.version), "Marked as missed")}>
                    They didn’t make it
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {d.status === "scheduled" && (edge("cancel") || edge("client_cancelled")) ? (
            <Card title="Cancel">
              <Field name="reason" label="Why?" hint="A short line for the team. The client gets a kind cancellation email." error={errors.reason}>
                <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {edge("client_cancelled") ? (
                  <Button type="button" variant="outline" size="sm" icon="none" disabled={pending} onClick={() => run(() => actions.move(d.ref, "client_cancelled", d.version, { reason }), "Cancelled at the client’s request")}>
                    The client cancelled
                  </Button>
                ) : null}
                {edge("cancel") ? (
                  <Button type="button" variant="danger" size="sm" icon="none" disabled={pending || reason.trim().length < 3} onClick={() => run(() => actions.move(d.ref, "cancel", d.version, { reason }), "Session cancelled")}>
                    Cancel the session
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}

          {(d.status === "completed" || d.status === "no_show") && edge("correct") ? (
            <Card title="Attendance">
              <p className="text-[15px] text-body">Recorded as {d.status === "completed" ? "attended" : "missed"}. If that’s wrong, correct it.</p>
              <Field name="reason" label="What was wrong?" className="mt-3" error={errors.reason}>
                <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button type="button" variant="outline" size="sm" icon="none" className="mt-3" disabled={pending || reason.trim().length < 10} onClick={() => run(() => actions.move(d.ref, "correct", d.version, { reason }), "Attendance cleared")}>
                Correct attendance
              </Button>
            </Card>
          ) : null}

          {d.notes !== null ? (
            <Card title="Follow-up notes">
              <p className="text-[13.5px] text-body">Only the counsellor, safeguarding officers and super admins can read these.</p>
              {d.canNote ? (
                <div className="mt-3">
                  <Field name="note" label="Add a note" labelHidden hint="Short notes to plan the next step. No diagnoses here." counter={{ max: 1000 }} error={errors.note}>
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <Button type="button" variant="outline" size="sm" icon="none" className="mt-2" disabled={pending || !note.trim()} onClick={() => run(() => actions.addNote(d.ref, note), "Note saved", () => setNote(""))}>
                    Save the note
                  </Button>
                </div>
              ) : null}
              {d.notes.length ? (
                <ol className="mt-4 grid gap-3 border-t border-line pt-4">
                  {d.notes.map((n) => (
                    <li key={n.id} className="flex gap-3">
                      <Avatar name={n.author.name} uid={n.author.uid} size={28} />
                      <div className="min-w-0">
                        <p className="whitespace-pre-wrap text-[15px] text-ink">{n.text}</p>
                        <p className="text-[12.5px] text-body">
                          {n.author.name.split(" ")[0]} · {fmt(n.at, d.staffTimezone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
              <button
                type="button"
                onClick={() => openGlobalSheet(router, "log-concern")}
                className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-coral-800 underline-offset-4 hover:underline"
              >
                <ShieldAlert aria-hidden className="size-4" /> Something worrying? Raise a safeguarding concern
              </button>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-24 lg:self-start">
          <Card title="Client">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14.5px]">
              <dt className="text-body">Name</dt>
              <dd className="font-bold text-ink">{d.client.firstName}</dd>
              <dt className="text-body">For</dt>
              <dd className="text-ink">{d.client.forWhom}</dd>
              <dt className="text-body">Age</dt>
              <dd className="text-ink">{AGE_BAND_LABEL[d.client.ageBand as keyof typeof AGE_BAND_LABEL] ?? d.client.ageBand}</dd>
              {d.client.language ? (
                <>
                  <dt className="text-body">Language</dt>
                  <dd className="text-ink">{d.client.language}</dd>
                </>
              ) : null}
            </dl>
            <p className="mt-3 text-[14.5px] text-ink">{d.client.reasonSummary}</p>
            {d.supportRef ? (
              <Link href={`/admin/requests/${d.supportRef}`} className="mt-3 inline-flex text-[14px] font-bold text-forest underline-offset-4 hover:underline">
                The request: {d.supportRef.replace(/^HVN-/, "")}
              </Link>
            ) : (
              <p className="mt-3 text-[13.5px] text-body">Case on file.</p>
            )}
          </Card>
          <Card title="Counsellor">
            <p className="inline-flex items-center gap-2 text-[15px] font-bold text-ink">
              <Avatar name={d.counsellor.name} uid={d.counsellor.uid} size={36} /> {d.counsellor.name}
            </p>
            {d.counsellors && d.status === "scheduled" ? (
              <Field name="counsellor" label="Give it to someone else" className="mt-3">
                <Select
                  value={d.counsellor.uid}
                  options={d.counsellors.map((c) => ({ value: c.uid, label: c.name }))}
                  onChange={(e) => e.target.value !== d.counsellor.uid && run(() => actions.reassign(d.ref, d.version, e.target.value), "Counsellor changed")}
                />
              </Field>
            ) : null}
          </Card>
          {d.timeline.length ? (
            <Card title="What happened">
              <ol className="grid gap-2">
                {d.timeline.map((t) => (
                  <li key={t.id} className="text-[14px] text-ink">
                    {t.text}
                    <span className="block text-[12.5px] text-body">{fmt(t.at, d.staffTimezone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
          {d.status === "scheduled" && d.joinUrl && Math.abs(d.startsAt - now) < 86_400_000 ? (
            <a href={d.joinUrl} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-forest text-[15px] font-bold text-white hover:bg-deep">
              <Video aria-hidden className="size-5" /> Join Zoom
            </a>
          ) : null}
          {d.status === "cancelled" && d.cancelReason ? (
            <p className="inline-flex items-start gap-2 rounded-[16px] bg-pebble p-3 text-[14px] text-body">
              <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" /> Cancelled: {d.cancelReason}
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
