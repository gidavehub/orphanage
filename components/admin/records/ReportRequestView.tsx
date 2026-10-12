"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Eye, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { FlagDisc } from "@/components/ui/flag";
import { Field } from "@/components/ui/form/Field";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { ReportRequestDTO } from "@/lib/server/dal/reportRequests";

type Move = (ref: string, edgeId: string, version: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;

const when = (ms: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Banjul" }).format(ms);

/**
 * One report request (admin-ux §6.8): who asked and why (email masked, Show is logged), then Approve
 * and send · Decline. While the email can't go (practice mode, or held), the link can be copied.
 */
export function ReportRequestView({ d, move, reveal }: { d: ReportRequestDTO; move: Move; reveal: (ref: string) => Promise<string | null> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState(d.resourceId ?? "");
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [copied, setCopied] = useState(false);
  const edge = (id: string) => d.edges.some((e) => e.id === id);

  const run = (id: string, input: Record<string, unknown>, ok: string) =>
    start(async () => {
      const r = await move(d.ref, id, d.version, input);
      if (r.ok) {
        toast({ title: ok, tone: "success" });
        setDeclining(false);
        router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.kind === "blocked" ? (e.reasons[0] ?? e.message) : e.message, tone: "danger" });
    });

  return (
    <article className="grid gap-5 rounded-[26px] bg-white p-5 shadow-soft md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-grotesk text-[13px] font-semibold text-body">{d.ref}</p>
          <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-ink">{d.title}</h2>
          {d.unlisted && d.requestedTitle ? <p className="mt-1 text-[14px] text-umber">Not in the library: they described “{d.requestedTitle}”.</p> : null}
        </div>
        <StatusPill workflow="reportRequest" status={d.status} />
      </header>

      <section aria-label="Who asked" className="grid gap-1 text-[15px]">
        <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
          {d.requester.name}
          {d.requester.organisation ? <span className="font-normal text-body">· {d.requester.organisation}</span> : null}
          <FlagDisc code={d.requester.country} className="size-5" label={d.requester.country.toUpperCase()} />
        </p>
        <p className="flex flex-wrap items-center gap-2 text-body">
          <Mail aria-hidden className="size-4" /> {email ?? d.requester.emailMasked}
          {!email && d.canManage ? (
            <button type="button" onClick={() => start(async () => setEmail(await reveal(d.ref)))} className="inline-flex items-center gap-1 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
              <Eye aria-hidden className="size-3.5" /> Show
            </button>
          ) : null}
        </p>
        <p className="text-[13.5px] text-body">Asked {when(d.createdAt)}</p>
      </section>

      <section aria-label="Why they asked" className="rounded-[18px] bg-sand/50 p-4">
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-body">Why they asked</p>
        <p className="mt-1 whitespace-pre-wrap text-[15px] text-ink">{d.reason}</p>
      </section>

      {d.delivery ? (
        <section aria-label="The download link" className="grid gap-2 rounded-[18px] border border-line p-4 text-[14.5px]">
          <p className="text-ink">
            {d.delivery.revoked ? "The link was stopped." : d.delivery.expired ? "The link has expired." : `The link works until ${when(d.delivery.expiresAt)}.`} Downloaded {d.delivery.downloads} time{d.delivery.downloads === 1 ? "" : "s"}.
          </p>
          {d.emailStatus === "held" || d.emailStatus === "queued" ? <p className="text-umber">The email is waiting in the Outbox, so it hasn’t reached them yet. You can send them the link yourself.</p> : null}
          {d.manualLink ? (
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard?.writeText(d.manualLink!).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
              }
              className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest"
            >
              {copied ? <Check aria-hidden className="size-4 text-forest" /> : <Copy aria-hidden className="size-4" />} {copied ? "Copied" : "Copy the download link"}
            </button>
          ) : null}
        </section>
      ) : null}

      {d.canManage ? (
        <section aria-label="Next step" className="grid gap-3">
          {edge("approve") ? (
            <div className="grid gap-3">
              {d.unlisted ? (
                <Field name="resourceId" label="Which report should they get?">
                  <Select value={resourceId} placeholder="Choose from the library" options={d.resourceOptions.map((o) => ({ value: o.id, label: o.title }))} onChange={(e) => setResourceId(e.target.value)} />
                </Field>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="forest" icon="send" disabled={pending || (d.unlisted && !resourceId)} onClick={() => run("approve", resourceId ? { resourceId } : {}, "Approved: the download link is on its way")}>
                  Approve and send
                </Button>
                {edge("decline") ? (
                  <Button type="button" variant="outline" icon="none" disabled={pending} onClick={() => setDeclining((x) => !x)}>
                    Decline
                  </Button>
                ) : null}
                {edge("start_review") ? (
                  <Button type="button" variant="ghost" icon="none" disabled={pending} onClick={() => run("start_review", {}, "Marked as under review")}>
                    I’m looking at it
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {declining ? (
            <div className="grid gap-2 rounded-[18px] bg-marigold-100/50 p-4">
              <Field name="note" label="A kind note for the team" hint="They receive a gentle decline email; this note stays with us." optional counter={{ max: 600 }}>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button type="button" variant="danger" size="sm" icon="none" className="w-fit" disabled={pending} onClick={() => run("decline", note.trim() ? { note } : {}, "Declined: they’ll get a kind email")}>
                Decline the request
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {edge("resend") ? (
              <Button type="button" variant="outline" size="sm" icon="none" disabled={pending} onClick={() => run("resend", {}, "A fresh link is on its way")}>
                Send a fresh link
              </Button>
            ) : null}
            {edge("revoke") && d.delivery && !d.delivery.revoked ? (
              <Button type="button" variant="ghost" size="sm" icon="none" disabled={pending} onClick={() => run("revoke", {}, "The link no longer works")}>
                Stop the link
              </Button>
            ) : null}
            {edge("close") ? (
              <Button type="button" variant="ghost" size="sm" icon="none" disabled={pending} onClick={() => run("close", {}, "Closed")}>
                Close
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {d.resourceId ? (
        <Link href={`/admin/library/${d.resourceId}`} className="text-[14px] font-bold text-forest underline-offset-4 hover:underline">
          Open the report in the library
        </Link>
      ) : null}

      {d.timeline.length ? (
        <section aria-label="What happened" className="border-t border-line pt-4">
          <ol className="grid gap-2">
            {d.timeline.map((t) => (
              <li key={t.id} className="text-[14px] text-ink">
                {t.text} <span className="text-[12.5px] text-body">· {when(t.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
