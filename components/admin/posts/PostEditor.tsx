"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, ShieldAlert, Sparkles, Users } from "lucide-react";
import { SchemaForm } from "@/components/admin/studio/SchemaForm";
import { SaveStatus } from "@/components/admin/studio/SectionSheet";
import { useAutosave } from "@/components/admin/studio/useAutosave";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { PostEditorDTO } from "@/lib/server/dal/posts";
import { cn } from "@/lib/cn";

type R<T = unknown> = Promise<ActionResult<T>>;
export type PostEditorActions = {
  save: (input: { id: string; baseVersion: number; data: unknown }) => R<{ id: string; version: number; at: Millis }>;
  saveLive: (input: { id: string; baseVersion: number; data: unknown }) => R<{ id: string; version: number; at: Millis }>;
  submit: (id: string, v: number) => R;
  approve: (id: string, v: number, checklist: Record<string, boolean>, publishAt?: number) => R;
  requestChanges: (id: string, v: number, notes: string) => R;
  unpublish: (id: string, v: number, to?: "draft" | "archived") => R;
  notThisMonth: (id: string, v: number, reason: string) => R;
  preview: () => Promise<{ total: number; subscribers: number; donors: number; unconfirmed: number }>;
  send: (id: string) => R<{ queued: number }>;
  assist: (kind: "tighten" | "warmer" | "shorter" | "title" | "excerpt", text: string) => Promise<{ kind: "ok"; text: string } | { kind: "off"; message: string }>;
};

const EDITABLE = ["title", "excerpt", "cover", "category", "programmeIds", "countries", "tags", "body", "author", "featured"] as const;
const when = (ms: number) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Banjul" }).format(ms);

function pick(v: Record<string, unknown>) {
  return Object.fromEntries(EDITABLE.map((k) => [k, v[k]]));
}

/**
 * The post editor (admin-ux §6.12): the words and pictures (autosaved as a draft), "Things to check"
 * with a tick for each, and the next step for this person and stage: Send for review, the reviewer's
 * checklist with Put live or Schedule, Ask for changes, Not this month (AI drafts), Take down, Archive
 * and Send to supporters.
 */
export function PostEditor({ d, actions }: { d: PostEditorDTO; actions: PostEditorActions }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const full = d.value as unknown as Record<string, unknown>;
  const [value, setValue] = useState<Record<string, unknown>>(pick(full));
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [list, setList] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(d.review.labels).map((k) => [k, Boolean(d.review.checklist[k])])));
  const [readAll, setReadAll] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [notes, setNotes] = useState("");
  const [helper, setHelper] = useState<string | null>(null);
  const [audience, setAudience] = useState<{ total: number; subscribers: number; donors: number; unconfirmed: number } | null>(null);
  const [liveDirty, setLiveDirty] = useState(false);
  const live = d.status === "published";
  const [version, setVersion] = useState(d.version);
  const auto = useAutosave<Record<string, unknown>>(
    d.version,
    async (v, base) => {
      const r = await actions.save({ id: d.id, baseVersion: base, data: { ...full, ...v } });
      return r.ok ? { ok: true, data: { version: r.data.version } } : r;
    },
    setVersion,
  );
  const isAI = d.origin !== "human";
  const safetyDone = d.safety.every((_, i) => checked[i]);
  const listDone = Object.values(list).every(Boolean);

  const run = (p: () => R<unknown>, ok: string, after?: () => void) =>
    start(async () => {
      await auto.flush();
      const r = await p();
      if (r.ok) {
        toast({ title: ok, tone: "success" });
        after?.();
        router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted fields.") : e.kind === "blocked" ? (e.reasons[0] ?? e.message) : e.message, tone: "danger" });
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 content-start gap-5">
        <section className="rounded-[22px] bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill workflow="post" status={d.status} />
              <span className="rounded-full bg-sand px-2.5 py-1 text-[12px] font-bold text-umber">{d.value.format === "update" ? "Update" : "Article"}</span>
              {isAI ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-marigold-100 px-2.5 py-1 text-[12px] font-bold text-umber">
                  <Sparkles aria-hidden className="size-3.5" /> Drafted by the writing helper
                </span>
              ) : null}
            </div>
            {live ? <span className="text-[13.5px] text-body">{liveDirty ? "Changes not saved yet" : "This post is live."}</span> : <SaveStatus state={auto.state} />}
          </div>
          {d.review.notes && d.status === "draft" ? <p className="mb-4 rounded-[14px] bg-marigold-100 p-3 text-[14px] text-umber">Changes asked for: {d.review.notes}</p> : null}
          <SchemaForm
            schema={d.schema}
            value={value}
            media={d.media}
            errors={auto.state.kind === "invalid" ? auto.state.fields : {}}
            disabled={!d.can.edit || d.status === "scheduled" || auto.state.kind === "conflict"}
            onChange={(v) => {
              const next = v as Record<string, unknown>;
              setValue(next);
              if (live) setLiveDirty(true);
              else auto.change(next);
            }}
          />
          {live && d.can.edit ? (
            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                variant="forest"
                size="sm"
                icon="none"
                disabled={pending || !liveDirty}
                onClick={() => run(() => actions.saveLive({ id: d.id, baseVersion: version, data: { ...full, ...value } }), "The live post is updated", () => setLiveDirty(false))}
              >
                Save changes to the live post
              </Button>
            </div>
          ) : null}
        </section>

        <section className="rounded-[22px] bg-white p-5 shadow-soft">
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-[17px] font-extrabold text-ink">
            <Sparkles aria-hidden className="size-4 text-umber" /> Help me write
          </h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["shorter", "Make it shorter"],
                ["warmer", "Make it warmer"],
                ["tighten", "Fix spelling and grammar"],
                ["title", "Suggest 3 titles"],
                ["excerpt", "Write the summary"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const text = [String(value.title ?? ""), String(value.excerpt ?? ""), ...((value.body as Array<{ text?: string }>) ?? []).map((b) => b.text ?? "")].join("\n\n");
                    const r = await actions.assist(k, text);
                    setHelper(r.kind === "off" ? r.message : r.text);
                  })
                }
                className="h-9 rounded-full border border-line px-3.5 text-[13.5px] font-bold text-ink hover:border-forest disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
          {helper ? <p className="mt-3 rounded-[14px] bg-sand/60 p-3 text-[14px] text-ink">{helper}</p> : null}
        </section>
      </div>

      <aside className="grid content-start gap-5 xl:sticky xl:top-24 xl:self-start">
        <section aria-labelledby="checks" className={cn("rounded-[22px] bg-white p-5 shadow-soft", d.safety.length > 0 && "ring-1 ring-coral/30")}>
          <h2 id="checks" className="mb-2 inline-flex items-center gap-1.5 text-[16px] font-extrabold text-ink">
            <ShieldAlert aria-hidden className="size-4 text-coral-800" /> Things to check ({d.safety.length})
          </h2>
          {d.safety.length === 0 ? (
            <p className="text-[14px] text-body">Nothing found: no names, small places, health words or photos without consent.</p>
          ) : (
            <ul className="grid gap-2">
              {d.safety.map((s, i) => (
                <li key={i} className="rounded-[14px] bg-coral/5 p-2.5">
                  <p className="text-[13px] font-bold text-coral-800">{s.label}</p>
                  <p className="text-[13.5px] text-ink">{s.message}</p>
                  <Checkbox name={`check-${i}`} label="I’ve checked this" checked={Boolean(checked[i])} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} className="mt-1" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12.5px] text-body">The list updates when the draft is saved and the page reloads.</p>
        </section>

        <section aria-labelledby="next" className="grid gap-3 rounded-[22px] bg-white p-5 shadow-soft">
          <h2 id="next" className="text-[16px] font-extrabold text-ink">
            Next step
          </h2>
          {d.status === "draft" ? (
            <>
              <p className="text-[14px] text-body">When it’s ready, send it for review. A content manager checks it and puts it live.</p>
              <Button type="button" variant="forest" icon="send" disabled={pending} onClick={() => run(() => actions.submit(d.id, version), "Sent for review")}>
                Send for review
              </Button>
            </>
          ) : null}

          {d.status === "in_review" && d.can.publish ? (
            <>
              {d.review.submittedBy ? <p className="text-[13.5px] text-body">Sent by {d.review.submittedBy}{d.review.submittedAt ? `, ${when(d.review.submittedAt)}` : ""}.</p> : null}
              {isAI && d.sources.length ? (
                <div className="rounded-[14px] bg-sand/50 p-3">
                  <p className="text-[13px] font-bold text-ink">What the helper used</p>
                  <ul className="mt-1 grid gap-0.5 text-[13px] text-body">
                    {d.sources.slice(0, 12).map((s) => (
                      <li key={s}>✓ {s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-[14px] font-bold text-ink">Before it goes live</legend>
                {Object.entries(d.review.labels).map(([k, label]) => (
                  <Checkbox key={k} name={`rv-${k}`} label={label} checked={Boolean(list[k])} onChange={(e) => setList((l) => ({ ...l, [k]: e.target.checked }))} />
                ))}
                {isAI ? <Checkbox name="rv-readAll" label="I’ve read every line and checked the facts." checked={readAll} onChange={(e) => setReadAll(e.target.checked)} /> : null}
              </fieldset>
              {!safetyDone ? <p className="text-[13px] text-umber">Tick each item under Things to check first.</p> : null}
              <Button type="button" variant="forest" icon="none" disabled={pending || !listDone || !safetyDone || (isAI && !readAll)} onClick={() => run(() => actions.approve(d.id, version, list), "Live on the website")}>
                Approve and put live now
              </Button>
              <div className="flex items-end gap-2">
                <Field name="scheduleAt" label="Or schedule it" optional className="flex-1">
                  <Input type="datetime-local" density="admin" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon="none"
                  disabled={pending || !scheduleAt || !listDone || !safetyDone || (isAI && !readAll)}
                  onClick={() => run(() => actions.approve(d.id, version, list, Date.parse(scheduleAt)), "Scheduled")}
                >
                  Schedule
                </Button>
              </div>
              <Field name="notes" label="Ask for changes" optional hint="What should change? It goes back to the writer as a draft.">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" icon="none" disabled={pending || !notes.trim()} onClick={() => run(() => actions.requestChanges(d.id, version, notes), "Sent back with your notes", () => setNotes(""))}>
                  Ask for changes
                </Button>
                {d.origin === "ai_monthly" ? (
                  <Button type="button" variant="ghost" size="sm" icon="none" disabled={pending} onClick={() => run(() => actions.notThisMonth(d.id, version, notes), "Not this month: the draft is removed", () => router.push("/admin/posts"))}>
                    Not this month
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
          {d.status === "in_review" && !d.can.publish ? <p className="text-[14px] text-body">Waiting for a content manager to review it.</p> : null}

          {d.status === "scheduled" ? <p className="text-[14px] text-body">Goes live {d.value.publishAt ? when(d.value.publishAt) : "soon"}.</p> : null}

          {live && d.can.publish ? (
            <>
              <a href={d.publicHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
                See it on the website <ExternalLink aria-hidden className="size-3.5" />
              </a>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" icon="none" disabled={pending} onClick={() => run(() => actions.unpublish(d.id, version, "draft"), "Taken down to edit")}>
                  Take down to edit
                </Button>
                <Button type="button" variant="ghost" size="sm" icon="none" disabled={pending} onClick={() => run(() => actions.unpublish(d.id, version, "archived"), "Archived")}>
                  Archive
                </Button>
              </div>
            </>
          ) : null}
        </section>

        {live && d.can.send ? (
          <section aria-labelledby="send" className="grid gap-3 rounded-[22px] bg-white p-5 shadow-soft">
            <h2 id="send" className="inline-flex items-center gap-1.5 text-[16px] font-extrabold text-ink">
              <Users aria-hidden className="size-4" /> Send to supporters
            </h2>
            {audience ? (
              <>
                <p className="text-[14px] text-ink">
                  {audience.total} people: {audience.subscribers} confirmed subscribers and {audience.donors} donors who asked for updates. {audience.unconfirmed ? `${audience.unconfirmed} haven’t confirmed yet and won’t get it.` : ""}
                </p>
                <Button type="button" variant="forest" size="sm" icon="send" disabled={pending || audience.total === 0} onClick={() => run(() => actions.send(d.id), "Queued for supporters")}>
                  Send to {audience.total}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" icon="none" disabled={pending} onClick={() => start(async () => setAudience(await actions.preview()))}>
                See who would get it
              </Button>
            )}
          </section>
        ) : null}
      </aside>
    </div>
  );
}
