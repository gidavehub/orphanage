import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { Timeline } from "@/components/admin/records/Timeline";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { formatStaffDate, formatStaffDateTime } from "@/lib/admin/format";
import { countryName } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import type { TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import { STATUS_LABEL } from "@/lib/model/labels";
import type { ConcernDetailDTO } from "@/lib/server/dal/concerns";
import { ConcernControls } from "./ConcernControls";

const KIND: Record<string, string> = {
  contacted_authority: "Authority contacted",
  contacted_service: "Service contacted",
  home_visit: "Home visit",
  call: "Call",
  meeting: "Meeting",
  follow_up_due: "Follow-up planned",
  follow_up_done: "Follow-up done",
  other: "Note",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] bg-white p-5 shadow-soft">
      <h3 className="mb-3 text-[15px] font-extrabold text-deep">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-3 py-1.5 text-[14.5px]">
      <dt className="text-body">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap text-ink">{children}</dd>
    </div>
  );
}

/**
 * One concern (admin-ux §6.5): serious and quiet. The §7 steps, the concern as reported, safe
 * follow-up, the actions log, the restricted timeline and who has opened it.
 */
export function ConcernView({
  d,
  timeline,
  tz,
  emergencyNotice,
  actions,
}: {
  d: ConcernDetailDTO;
  timeline: TimelineEntryDTO[];
  tz: string;
  emergencyNotice: string;
  actions: {
    move: (ref: string, edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;
    addAction: Parameters<typeof ConcernControls>[0]["actions"]["addAction"];
    requestClose: (ref: string, reason: string, note: string) => Promise<ActionResult>;
  };
}) {
  return (
    <article aria-label={`Concern ${d.ref}`} className="grid gap-4">
      <header className="rounded-[20px] bg-deep p-5 text-white md:p-6">
        <Link href="/admin/safeguarding" className="mb-2 inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-marigold lg:hidden">
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} /> Safeguarding
        </Link>
        <p className="flex items-center gap-2 font-grotesk text-[13px] font-semibold tabular-nums text-white/90">
          <Lock aria-hidden className="size-4 text-marigold" /> {d.ref} · Safeguarding concern
        </p>
        <h2 className="mt-1 text-[22px] font-extrabold">{STATUS_LABEL.concern[d.status]}</h2>
        <p className="mt-1 font-grotesk text-[13px] text-white/85">
          Received {formatStaffDateTime(d.createdAt, tz)} · {d.source} · Reporter: {d.reporter.anonymous ? "anonymous" : (d.reporter.name ?? "named")}
          {d.suspectedSpam ? " · flagged as possible spam" : ""}
        </p>
      </header>

      {d.canWrite ? (
        <section className="rounded-[18px] bg-white p-5 shadow-soft">
          <ConcernControls
            reference={d.ref}
            version={d.version}
            status={d.status}
            risk={d.risk}
            edges={d.edges}
            twoPerson={d.twoPerson}
            closure={d.closure}
            emergencyNotice={emergencyNotice}
            actions={actions}
          />
        </section>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <Block title="The concern">
            <dl>
              <Row label="What happened">{d.narrative ?? "This couldn't be opened."}</Row>
              {d.concernTypes.length ? <Row label="Kind">{d.concernTypes.join(", ")}</Row> : null}
              <Row label="Child's age">{d.child.ageBand || "Not given"}</Row>
              <Row label="Where">
                <span className="inline-flex items-center gap-1.5">
                  {hasFlag(d.child.country) ? <FlagDisc code={d.child.country} className="size-4" /> : null}
                  {[d.child.area, countryName(d.child.country)].filter(Boolean).join(", ")}
                </span>
              </Row>
              {d.child.details ? <Row label="Location details">{d.child.details}</Row> : null}
              <Row label="In danger now">{d.inDangerNow}</Row>
              <Row label="Authorities contacted">{d.authoritiesContacted}</Row>
              {d.authorityDetails ? <Row label="Authority details">{d.authorityDetails}</Row> : null}
              {d.risk ? (
                <Row label="Risk">
                  {d.risk} {d.riskBy ? `(${d.riskBy})` : ""}
                  {d.riskRationale ? `\n${d.riskRationale}` : ""}
                </Row>
              ) : null}
              {d.escalation ? (
                <Row label="Escalated">
                  To {d.escalation.to} on {formatStaffDate(d.escalation.at, tz)}
                  {d.escalation.externalRef ? ` · their ref ${d.escalation.externalRef}` : ""}
                </Row>
              ) : null}
            </dl>
          </Block>
          <Block title="What we've done">
            {d.actions.length ? (
              <ol className="grid gap-2.5">
                {d.actions.map((a) => (
                  <li key={a.id} className="rounded-[14px] bg-[#f2f6f4] px-4 py-3">
                    <p className="font-grotesk text-[12.5px] font-semibold text-deep">
                      {KIND[a.kind] ?? a.kind} · {a.byName} · {formatStaffDateTime(a.at, tz)}
                      {a.dueAt ? ` · due ${formatStaffDateTime(a.dueAt, tz)}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[14.5px] text-ink">{a.detail}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[14.5px] text-body">No actions recorded yet.</p>
            )}
          </Block>
          <Block title="Timeline (restricted)">
            <Timeline entries={timeline} tz={tz} />
          </Block>
        </div>
        <div className="grid min-w-0 gap-4">
          <Block title="Safe follow-up">
            <dl>
              <Row label="Relationship">{d.reporter.relationship}</Row>
              {d.reporter.followUp ? (
                <>
                  <Row label="Method">{d.reporter.followUp.method ?? "Not given"}</Row>
                  {d.reporter.followUp.times ? <Row label="Best times">{d.reporter.followUp.times}</Row> : null}
                  {d.reporter.followUp.notes ? <Row label="Notes">{d.reporter.followUp.notes}</Row> : null}
                </>
              ) : null}
              {!d.reporter.anonymous ? (
                <>
                  {d.reporter.phone ? <Row label="Phone">{d.reporter.phone}</Row> : null}
                  {d.reporter.email ? <Row label="Email">{d.reporter.email}</Row> : null}
                </>
              ) : (
                <Row label="Contact">The reporter stayed anonymous.</Row>
              )}
            </dl>
          </Block>
          <Block title="Who has opened this">
            {d.openedBy.length ? (
              <ul className="grid gap-1 text-[14px]">
                {d.openedBy.map((o) => (
                  <li key={o.name} className="text-ink">
                    {o.name} <span className="text-body">· {formatStaffDateTime(o.at, tz)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-body">Only you so far.</p>
            )}
          </Block>
        </div>
      </div>
    </article>
  );
}
