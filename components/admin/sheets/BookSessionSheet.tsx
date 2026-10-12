"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { CounsellorOption, WaitingDTO } from "@/lib/server/dal/appointments";
import { bookingOptionsAction, bookSessionAction } from "@/app/admin/(desk)/counselling/actions";

const ZONES = ["Africa/Banjul", "Africa/Dakar", "Africa/Lagos", "Africa/Nairobi", "Asia/Dhaka", "Asia/Kolkata", "Asia/Karachi", "Asia/Manila", "Asia/Jakarta", "Asia/Dubai", "Asia/Riyadh", "Europe/London", "America/New_York", "America/Los_Angeles"];
const city = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");

/**
 * Global sheet `?do=book-session` (admin-ux §6.7): book a counselling session for a request that is
 * waiting for a time. Times are entered in your own timezone; the client's time is shown beside it.
 * `?ref=HVN-SR-…` picks the request.
 */
export function BookSessionSheet({ open, onClose, params }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [opts, setOpts] = useState<{ requests: WaitingDTO[]; counsellors: CounsellorOption[]; tz: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [ref, setRef] = useState(params.ref ?? "");
  const [counsellor, setCounsellor] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("45");
  const [mode, setMode] = useState<"zoom" | "phone" | "in_person">("zoom");
  const [zoom, setZoom] = useState("");
  const [clientTz, setClientTz] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || opts) return;
    bookingOptionsAction()
      .then((o) => {
        setOpts(o);
        setCounsellor((c) => c || o.counsellors[0]?.uid || "");
        const r = o.requests.find((x) => x.ref === (params.ref ?? ""));
        if (r?.timezone) setClientTz(r.timezone);
      })
      .catch(() => setFailed(true));
  }, [open, opts, params.ref]);

  const chosen = opts?.requests.find((r) => r.ref === ref) ?? null;
  const tz = opts?.tz ?? "Africa/Banjul";
  const preview = (() => {
    if (!date || !/^\d{2}:\d{2}$/.test(time) || !clientTz || clientTz === tz) return null;
    // Wall time in my timezone → the same instant in the client's timezone (approximate offset by name).
    try {
      const guess = Date.parse(`${date}T${time}:00Z`);
      const off = (z: string) => {
        const p = new Intl.DateTimeFormat("en-US", { timeZone: z, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
        const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
        return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - guess) / 60_000;
      };
      const instant = guess - off(tz) * 60_000;
      return new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: clientTz }).format(instant);
    } catch {
      return null;
    }
  })();

  const submit = () =>
    start(async () => {
      const r = await bookSessionAction({
        supportRef: ref,
        counsellorUid: counsellor,
        date,
        time,
        durationMin: Number(duration),
        mode,
        zoomUrl: mode === "zoom" && zoom.trim() ? zoom.trim() : null,
        clientTimezone: clientTz || null,
        reasonSummary: reason.trim() || null,
      });
      if (r.ok) {
        toast({ title: `Session booked · ${r.data.ref.replace(/^HVN-/, "")}`, tone: "success" });
        onClose();
        router.push(`/admin/counselling/${r.data.ref}`);
        return;
      }
      const e = r.error;
      if (e.kind === "validation") setErrors(e.fields);
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted fields.") : e.message, tone: "danger" });
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Book a session"
      description="A counselling session for someone waiting for a time."
      dirty={Boolean(date || zoom || reason)}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || !ref || !counsellor || !date} onClick={submit}>
          Book the session
        </Button>
      }
    >
      {failed ? (
        <p className="text-[15px] text-body">The booking details didn’t load. Close this and try again.</p>
      ) : !opts ? (
        <p className="text-[15px] text-body">Loading…</p>
      ) : (
        <div className="grid gap-4">
          <Field name="supportRef" label="Who is it for?" error={errors.supportRef}>
            <Select
              value={ref}
              placeholder="Choose a request"
              options={[
                ...opts.requests.map((r) => ({ value: r.ref, label: `${r.firstName} · ${r.ref.replace(/^HVN-/, "")} · ${r.format}` })),
                ...(ref && !opts.requests.some((r) => r.ref === ref) ? [{ value: ref, label: ref.replace(/^HVN-/, "") }] : []),
              ]}
              onChange={(e) => {
                setRef(e.target.value);
                const r = opts.requests.find((x) => x.ref === e.target.value);
                if (r?.timezone) setClientTz(r.timezone);
              }}
            />
          </Field>
          {chosen ? (
            <p className="-mt-2 rounded-[14px] bg-sand/70 px-3 py-2 text-[13.5px] text-ink">
              {chosen.forWhom} · {chosen.language || "Language not given"} · {chosen.preferences}
            </p>
          ) : null}
          <Field name="counsellorUid" label="Counsellor" error={errors.counsellorUid}>
            <Select value={counsellor} options={opts.counsellors.map((c) => ({ value: c.uid, label: c.name }))} onChange={(e) => setCounsellor(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="date" label="Date" error={errors.date}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field name="time" label={`Time in ${city(tz)}`} error={errors.time}>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="clientTimezone" label="The client’s timezone" optional>
              <Select value={clientTz} options={[{ value: "", label: `Same as mine (${city(tz)})` }, ...[...new Set([...(clientTz ? [clientTz] : []), ...ZONES])].map((z) => ({ value: z, label: city(z) }))]} onChange={(e) => setClientTz(e.target.value)} />
            </Field>
            <Field name="durationMin" label="Length">
              <Select value={duration} options={["30", "45", "60", "90"].map((m) => ({ value: m, label: `${m} minutes` }))} onChange={(e) => setDuration(e.target.value)} />
            </Field>
          </div>
          {preview ? <p className="-mt-1 text-[14px] font-semibold text-deep">That’s {preview} for them.</p> : null}
          <Segmented
            label="How you’ll meet"
            density="admin"
            skin="donat"
            value={mode}
            options={[
              { value: "zoom", label: "Zoom" },
              { value: "phone", label: "Phone" },
              { value: "in_person", label: "In person" },
            ]}
            onChange={(v) => setMode(v)}
          />
          {mode === "zoom" ? (
            <Field name="zoomUrl" label="Zoom link" optional hint="You can add it later, before sending the invitation." error={errors.zoomUrl}>
              <Input type="url" inputMode="url" value={zoom} placeholder="https://zoom.us/j/…" onChange={(e) => setZoom(e.target.value)} />
            </Field>
          ) : null}
          <Field name="reasonSummary" label="A line for the counsellor" optional hint="What the session is about, without names, places or diagnoses." counter={{ max: 300 }} error={errors.reasonSummary}>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
