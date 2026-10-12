import Link from "next/link";
import { ChevronLeft, Lock, Paperclip, ShieldCheck } from "lucide-react";
import { Masked } from "@/components/admin/ui/Masked";
import { Avatar } from "@/components/ui/Avatar";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { formatStaffDate, formatStaffDateTime } from "@/lib/admin/format";
import { countryName } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import type { TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import type { SupportDetailDTO } from "@/lib/server/dal/support";
import { cn } from "@/lib/cn";
import { NoteComposer, SeenOnOpen, SupportControls, TakeButton, TriagePanel } from "./support/SupportControls";
import { Timeline } from "./Timeline";

export type SupportViewActions = {
  move: (ref: string, edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;
  take: (ref: string) => Promise<ActionResult>;
  addNote: (ref: string, kind: "note" | "call", text: string) => Promise<ActionResult>;
  reveal: (ref: string, field: "phone" | "email") => Promise<string | null>;
  saveTriage: (
    ref: string,
    input: { eligibility: "eligible" | "ineligible" | "unclear" | null; verification: "not_started" | "in_progress" | "verified" | "failed"; method: string | null; expectedVersion: number },
  ) => Promise<ActionResult>;
  seen: (ref: string) => Promise<void>;
};

export type SupportViewProps = {
  /** The request, loaded and checked by the page (lib/server/dal/support). */
  d: SupportDetailDTO;
  timeline: TimelineEntryDTO[];
  /** The viewer's timezone and permissions. */
  tz: string;
  perms: Permission[];
  /** Where the view sits: beside the Inbox list, or in its own place. */
  context?: "inbox" | "place";
  /** Active People › Directory entries for the referral step. */
  referralOptions?: Array<{ id: string; name: string; type: string; approved: boolean }>;
  actions: SupportViewActions;
};

const URGENCY = { high: { label: "Urgent", cls: "bg-coral-800 text-white" }, medium: { label: "Soon", cls: "bg-marigold-100 text-umber" }, low: { label: "Normal", cls: "bg-pebble text-body" } } as const;

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[22px] bg-white p-5 shadow-soft", className)}>
      <h3 className="mb-3 text-[16px] font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-3 py-1.5 text-[14.5px]">
      <dt className="text-body">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

/**
 * The support request view (admin-ux §6.4): header with category and urgency, the stage stepper with
 * the next steps this person may take, who looks after it, the timeline with notes and the composer,
 * then the person (contact masked unless they look after it), the child (age range and needs only,
 * never a name), the checks needed before approval, referrals and the outcome.
 */
export function SupportView({ d, timeline, tz, perms, context = "place", referralOptions, actions }: SupportViewProps) {
  const v = { timezone: tz };
  const shell = { perms };
  const { move: moveSupport, take, addNote, reveal: revealContact, saveTriage, seen } = actions;
  const urgency = URGENCY[d.urgency];
  const backHref = context === "inbox" ? "/admin/inbox" : "/admin/requests";

  return (
    <article aria-label={`Support request ${d.ref}`} className="grid gap-5">
      <SeenOnOpen reference={d.ref} seen={seen} />
      <header className="rounded-[26px] bg-white p-5 shadow-soft md:p-6">
        <Link href={backHref} className="mb-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-forest lg:hidden">
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} /> {context === "inbox" ? "Inbox" : "Requests"}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-grotesk text-[13px] font-semibold tabular-nums text-umber">{d.ref}</p>
            <h2 className="mt-1 text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">{d.title}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
              <span className={cn("rounded-full px-2.5 py-1 font-bold", urgency.cls)}>{urgency.label}</span>
              {d.movedToSafeguarding ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-deep px-2.5 py-1 font-bold text-white">
                  <Lock aria-hidden className="size-3" /> Moved to safeguarding
                </span>
              ) : null}
              <span className="font-grotesk text-body">via the website · {formatStaffDateTime(d.createdAt, v.timezone)}</span>
            </p>
          </div>
          {d.canWrite && !d.assignee ? <TakeButton reference={d.ref} take={take} /> : null}
        </div>

        <div className="mt-6">
          <SupportControls
            reference={d.ref}
            status={d.status}
            version={d.version}
            perms={shell.perms}
            timezone={v.timezone}
            history={d.history}
            blocked={d.blocked}
            canWrite={d.canWrite}
            hasEmail={!!d.applicant.email}
            applicantFirstName={d.applicant.name.split(" ")[0] ?? "them"}
            people={d.people}
            assigneeUid={d.assignee?.uid ?? null}
            me={d.me}
            referralOptions={referralOptions}
            actions={{ move: moveSupport, take }}
          />
        </div>

        <p className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-[14px] text-body">
          Looking after this:
          {d.assignee ? (
            <span className="inline-flex items-center gap-2 font-bold text-ink">
              <Avatar name={d.assignee.name} uid={d.assignee.uid} tone={d.assignee.tone} size={28} /> {d.assignee.name}
            </span>
          ) : (
            <span className="font-bold text-ink">no one yet</span>
          )}
          {d.moreInfo ? (
            <span className="ml-auto rounded-full bg-marigold-100 px-3 py-1 text-[13px] font-bold text-umber">
              Waiting for {d.applicant.name.split(" ")[0]} since {formatStaffDate(d.moreInfo.requestedAt, v.timezone)} · reply by {formatStaffDate(d.moreInfo.dueAt, v.timezone)}
            </span>
          ) : null}
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-5">
          {d.canWrite ? (
            <Section title="Add to the record">
              <NoteComposer reference={d.ref} addNote={addNote} />
            </Section>
          ) : null}
          <Section title="Timeline">
            <Timeline entries={timeline} tz={v.timezone} />
            {d.explanation ? (
              <div className="mt-4 rounded-[18px] border border-line bg-cream p-4">
                <p className="font-grotesk text-[12.5px] font-semibold uppercase tracking-[0.08em] text-body">What they told us</p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{d.explanation}</p>
              </div>
            ) : null}
          </Section>
        </div>

        <div className="grid min-w-0 gap-5">
          <Section title="About the person asking">
            <dl>
              <Row label="Name">
                {d.applicant.name} · {d.applicant.relationship}
              </Row>
              <Row label="Where">
                <span className="inline-flex items-center gap-1.5">
                  {hasFlag(d.applicant.country) ? <FlagDisc code={d.applicant.country} className="size-4" /> : null}
                  {[d.applicant.locality, countryName(d.applicant.country)].filter(Boolean).join(", ")}
                </span>
              </Row>
              <Row label="Prefers">{d.applicant.preferredContact}</Row>
              <Row label="Safe to contact">{d.applicant.safeToContact ? "Yes" : `Be careful${d.applicant.bestTimes ? `: ${d.applicant.bestTimes}` : ""}`}</Row>
              {d.applicant.phone ? (
                <Row label="Phone">
                  {d.applicant.phone.masked ? <Masked masked={d.applicant.phone.value} kind="phone" label="phone number" canReveal={d.canReveal} onReveal={revealContact.bind(null, d.ref, "phone")} /> : <a href={`tel:${d.applicant.phone.value.replace(/[^\d+]/g, "")}`} className="font-bold text-forest">{d.applicant.phone.value}</a>}
                </Row>
              ) : null}
              {d.applicant.email ? (
                <Row label="Email">
                  {d.applicant.email.masked ? <Masked masked={d.applicant.email.value} kind="email" label="email address" canReveal={d.canReveal} onReveal={revealContact.bind(null, d.ref, "email")} /> : <a href={`mailto:${d.applicant.email.value}`} className="break-all font-bold text-forest">{d.applicant.email.value}</a>}
                </Row>
              ) : null}
              <Row label="Consent">{d.consent.contactAt ? `To be contacted ✓ ${formatStaffDate(d.consent.contactAt, v.timezone)}` : "Not recorded"}</Row>
            </dl>
          </Section>

          {d.child || d.details.length ? (
            <Section title="About the child and the need">
              <dl>
                {d.child ? <Row label="Age range">{d.child.ageBand}</Row> : null}
                {d.child?.numberOfChildren ? <Row label="Children">{d.child.numberOfChildren}</Row> : null}
                {d.details.map((x) => (
                  <Row key={x.label} label={x.label}>
                    {x.value}
                  </Row>
                ))}
              </dl>
            </Section>
          ) : null}

          <Section title="Checks before approval">
            <p className="mb-4 flex items-center gap-2 text-[14px] text-body">
              <ShieldCheck aria-hidden className="size-4 text-forest" />
              {d.triage.verification.status === "verified"
                ? `Verified${d.triage.verification.byName ? ` by ${d.triage.verification.byName}` : ""}${d.triage.verification.at ? ` on ${formatStaffDate(d.triage.verification.at, v.timezone)}` : ""}.`
                : "A request is approved only once it's been checked and verified."}
            </p>
            <TriagePanel reference={d.ref} version={d.version} eligibility={d.triage.eligibility} verification={d.triage.verification.status} method={d.triage.verification.method} canWrite={d.canWrite} save={saveTriage} />
          </Section>

          {d.referrals.length || d.outcome || d.decision ? (
            <Section title="Referrals and outcome">
              <ul className="grid gap-2 text-[14.5px]">
                {d.referrals.map((r) => (
                  <li key={r.id} className="rounded-[14px] bg-cream px-3 py-2">
                    <span className="font-bold text-ink">{r.toName}</span> <span className="text-body">· {r.toType} · {r.outcome} · {formatStaffDate(r.at, v.timezone)}</span>
                    {r.note ? <span className="block text-body">{r.note}</span> : null}
                  </li>
                ))}
                {d.decision ? <li className="text-ink">Decision: {d.decision.kind === "approved" ? "approved" : `declined (${d.decision.reasonCode?.replace(/_/g, " ") ?? "no reason"})`}</li> : null}
                {d.outcome ? <li className="text-ink">Outcome: {d.outcome}</li> : null}
              </ul>
            </Section>
          ) : null}

          {d.attachments ? (
            <Section title="Files (secure)">
              <p className="flex items-center gap-2 text-[14.5px] text-body">
                <Paperclip aria-hidden className="size-4" /> {d.attachments} file{d.attachments === 1 ? "" : "s"} sent with the request. Opening a file is recorded.
              </p>
            </Section>
          ) : null}
        </div>
      </div>
    </article>
  );
}
