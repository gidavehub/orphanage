"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Video } from "lucide-react";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill, TonePill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/form/Select";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { AgendaDTO, SessionCardDTO } from "@/lib/server/dal/appointments";
import { cn } from "@/lib/cn";

type Move = (ref: string, edgeId: string, version: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;

const timeIn = (ms: number, tz: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(ms);
const dayTitle = (ymd: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), 12));
const city = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");

function shift(ymd: string, days: number): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + days, 12));
  return d.toISOString().slice(0, 10);
}

/**
 * Sessions (admin-ux §6.7): the week strip with a dot per session, the chosen day's agenda, "how did
 * it go?" for sessions whose time has passed, and (for programme officers) "Waiting for a time".
 * Counsellors see only their own sessions and no counsellor filter.
 */
export function Agenda({ d, move }: { d: AgendaDTO; move: Move }) {
  const router = useRouter();
  const pathname = usePathname();
  const href = (q: { day?: string; counsellor?: string | null }) => {
    const p = new URLSearchParams();
    const day = q.day ?? d.day;
    if (day !== d.today) p.set("day", day);
    const c = q.counsellor === undefined ? d.counsellor : q.counsellor;
    if (c) p.set("counsellor", c);
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 content-start gap-5">
        <div className="rounded-[22px] bg-white p-3 shadow-soft">
          <div className="flex items-center gap-2">
            <Link href={href({ day: shift(d.week[0]!.ymd, -7) })} aria-label="The week before" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sand">
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <ol className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
              {d.week.map((w) => {
                const on = w.ymd === d.day;
                return (
                  <li key={w.ymd} className="min-w-[52px] flex-1">
                    <Link
                      href={href({ day: w.ymd })}
                      aria-current={on ? "date" : undefined}
                      className={cn("flex flex-col items-center rounded-[16px] px-1 py-2 text-center transition-colors", on ? "bg-forest text-white" : "hover:bg-sand", w.ymd === d.today && !on && "ring-1 ring-forest/40")}
                    >
                      <span className={cn("text-[12px] font-semibold", on ? "text-white" : "text-body")}>{w.weekday}</span>
                      <span className="font-grotesk text-[17px] font-semibold">{w.label}</span>
                      <span aria-label={`${w.count} session${w.count === 1 ? "" : "s"}`} className="mt-1 flex h-1.5 gap-0.5">
                        {Array.from({ length: Math.min(4, w.count) }, (_, i) => (
                          <span key={i} className={cn("size-1.5 rounded-full", on ? "bg-marigold" : "bg-clay")} />
                        ))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <Link href={href({ day: shift(d.week[0]!.ymd, 7) })} aria-label="The week after" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sand">
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </div>
          {d.counsellors ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <label htmlFor="counsellor-filter" className="text-[14px] font-bold text-ink">
                Counsellor
              </label>
              <Select
                id="counsellor-filter"
                density="admin"
                className="max-w-[260px]"
                value={d.counsellor ?? ""}
                options={[{ value: "", label: "Everyone" }, ...d.counsellors.map((c) => ({ value: c.uid, label: `${c.name} · ${c.thisWeek} this week` }))]}
                onChange={(e) => router.push(href({ counsellor: e.target.value || null }))}
              />
              {d.day !== d.today ? (
                <Link href={href({ day: d.today })} className="ml-auto text-[14px] font-bold text-forest underline-offset-4 hover:underline">
                  Back to today
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {d.waiting && d.waiting.length ? (
          <a href="#waiting" className="flex items-center justify-between rounded-[18px] bg-marigold-100 px-4 py-3 text-[15px] font-bold text-umber lg:hidden">
            Waiting for a time ({d.waiting.length}) <ChevronRight aria-hidden className="size-5" />
          </a>
        ) : null}

        <section aria-labelledby="day-title">
          <h2 id="day-title" className="mb-3 text-[20px] font-extrabold text-ink">
            {dayTitle(d.day, d.tz)}
          </h2>
          {d.sessions.length === 0 ? (
            <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">{d.ownOnly ? "No sessions for you this day." : "No sessions this day."}</p>
          ) : (
            <ul className="grid gap-3">
              {d.sessions.map((s) => (
                <SessionCard key={s.ref} s={s} tz={d.tz} showCounsellor={!d.ownOnly} />
              ))}
            </ul>
          )}
        </section>

        {d.attendanceDue.length ? (
          <section aria-labelledby="due-title">
            <h2 id="due-title" className="mb-3 text-[18px] font-extrabold text-ink">
              How did it go?
            </h2>
            <ul className="grid gap-3">
              {d.attendanceDue.map((s) => (
                <Attendance key={s.ref} s={s} tz={d.tz} move={move} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {d.waiting ? (
        <aside id="waiting" aria-labelledby="waiting-title" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[22px] bg-white p-4 shadow-soft">
            <h2 id="waiting-title" className="mb-3 text-[17px] font-extrabold text-ink">
              Waiting for a time ({d.waiting.length})
            </h2>
            {d.waiting.length === 0 ? (
              <p className="text-[14.5px] text-body">Everyone who asked for counselling has a session booked.</p>
            ) : (
              <ul className="grid gap-2.5">
                {d.waiting.map((w) => (
                  <li key={w.ref} className="rounded-[16px] border border-line p-3">
                    <p className="text-[15px] font-bold text-ink">
                      {w.firstName} <span className="font-grotesk text-[13px] font-semibold text-body">· {w.ref.replace(/^HVN-/, "")}</span>
                    </p>
                    <p className="mt-0.5 text-[13.5px] text-body">
                      {w.forWhom} · {w.format}
                      {w.language ? ` · ${w.language}` : ""}
                    </p>
                    <p className="text-[13.5px] text-body">
                      {w.preferences} · waiting {w.sinceDays === 0 ? "since today" : `${w.sinceDays} day${w.sinceDays === 1 ? "" : "s"}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => openGlobalSheet(router, "book-session", { ref: w.ref })}
                      className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-4 text-[14px] font-bold text-white hover:bg-deep"
                    >
                      <CalendarClock aria-hidden className="size-4" /> Find a time
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function SessionCard({ s, tz, showCounsellor }: { s: SessionCardDTO; tz: string; showCounsellor: boolean }) {
  const end = s.startsAt + s.durationMin * 60_000;
  const otherTz = s.clientTimezone !== tz;
  return (
    <li className={cn("rounded-[22px] bg-white p-4 shadow-soft", s.status === "cancelled" && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={`/admin/counselling/${s.ref}`} className="min-w-0 hover:underline">
          <p className="font-grotesk text-[16px] font-semibold tabular-nums text-ink">
            {timeIn(s.startsAt, tz)}–{timeIn(end, tz)} <span className="font-sans text-[15px] font-bold">· {s.firstName}</span>
          </p>
          <p className="text-[13px] text-body">
            {s.ref.replace(/^HVN-/, "")} · session {s.sessionNumber}
            {otherTz ? ` · ${timeIn(s.startsAt, s.clientTimezone)} in ${city(s.clientTimezone)}` : ""}
          </p>
        </Link>
        <StatusPill workflow="appointment" status={s.status} size="sm" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {showCounsellor ? (
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
            <Avatar name={s.counsellor.name} uid={s.counsellor.uid} size={28} /> {s.counsellor.name.split(" ")[0]}
          </span>
        ) : null}
        {s.status === "scheduled" ? (
          <>
            {s.mode === "zoom" ? (
              <TonePill tone={s.zoomReady ? "approved" : "waiting"} label={s.zoomReady ? "Zoom ready" : "No Zoom link yet"} size="sm" />
            ) : (
              <TonePill tone="active" label={s.mode === "phone" ? "Phone call" : "In person"} size="sm" />
            )}
            <TonePill tone={s.confirmed ? "done" : "new"} label={s.confirmed ? "Invitation sent" : "Not sent yet"} size="sm" icon={s.confirmed ? "check" : "dot"} />
          </>
        ) : null}
        <span className="ml-auto flex gap-2">
          {s.joinUrl ? (
            <a href={s.joinUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-4 text-[14px] font-bold text-white hover:bg-deep">
              <Video aria-hidden className="size-4" /> Join Zoom
            </a>
          ) : s.status === "scheduled" && s.mode === "zoom" && !s.zoomReady ? (
            <Link href={`/admin/counselling/${s.ref}#zoom`} className="inline-flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest">
              Add Zoom link
            </Link>
          ) : (
            <Link href={`/admin/counselling/${s.ref}`} className="inline-flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest">
              Open
            </Link>
          )}
        </span>
      </div>
    </li>
  );
}

function Attendance({ s, tz, move }: { s: SessionCardDTO; tz: string; move: Move }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(s.startsAt);
  const act = (edge: string, ok: string) =>
    start(async () => {
      const r = await move(s.ref, edge, s.version);
      if (r.ok) {
        setDone(ok);
        toast({ title: ok, tone: "success" });
      } else {
        if (r.error.kind === "conflict") router.refresh();
        toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please try again.") : r.error.message, tone: "danger" });
      }
    });
  return (
    <li className="rounded-[22px] bg-white p-4 shadow-soft">
      <p className="text-[15px] font-bold text-ink">
        <Link href={`/admin/counselling/${s.ref}`} className="hover:underline">
          {s.firstName} · {s.ref.replace(/^HVN-/, "")}
        </Link>
        <span className="font-normal text-body">
          {" "}
          · <Clock aria-hidden className="inline size-3.5" /> {day}, {timeIn(s.startsAt, tz)}
        </span>
      </p>
      {done ? (
        <p className="mt-2 text-[14px] font-semibold text-deep">{done}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button type="button" disabled={pending} onClick={() => act("attended", "Marked as attended")} className="h-11 rounded-full bg-mint px-4 text-[14px] font-bold text-deep hover:bg-forest hover:text-white disabled:opacity-50">
            They came
          </button>
          <button type="button" disabled={pending} onClick={() => act("no_show", "Marked as missed")} className="h-11 rounded-full bg-marigold-100 px-4 text-[14px] font-bold text-umber hover:bg-marigold hover:text-night disabled:opacity-50">
            They didn’t make it
          </button>
          <Link href={`/admin/counselling/${s.ref}#reschedule`} className="grid h-11 place-items-center rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest">
            Find a new time
          </Link>
        </div>
      )}
    </li>
  );
}
