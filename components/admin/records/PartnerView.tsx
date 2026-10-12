"use client";

import Link from "next/link";
import { ChevronLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { StatusStepper } from "@/components/admin/ui/StatusStepper";
import { FlagDisc } from "@/components/ui/flag";
import { formatStaffDate } from "@/lib/admin/format";
import { countryName } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import type { TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import type { PartnerDetailDTO } from "@/lib/server/dal/partnerships";
import { NoteComposer, SeenOnOpen } from "./support/SupportControls";
import { Timeline } from "./Timeline";
import { FollowUp, Row, Section, StageMoves, useRecordActions } from "./VolunteerView";

type R<T = { version: number }> = Promise<ActionResult<T>>;
export type PartnerViewActions = {
  move: (ref: string, edgeId: string, version: number, input?: Record<string, unknown>) => R<{ version: number; at: Millis; status: string }>;
  followUp: (ref: string, version: number, uid: string | null, at: Millis | null) => R;
  addNote: (ref: string, kind: "note" | "call", text: string) => Promise<ActionResult>;
  seen: (ref: string) => Promise<void>;
};

const LABEL: Record<string, string> = { new: "New", under_review: "Under review", in_discussion: "Talking", agreed: "Agreement", active: "Active", closed: "Closed", declined: "Not this time" };

/** A partnership enquiry (admin-ux §6.9; PLAN D78): stage and next steps, the organisation, its contact and the proposal. */
export function PartnerView({ d, timeline, tz, actions }: { d: PartnerDetailDTO; timeline: TimelineEntryDTO[]; tz: string; actions: PartnerViewActions }) {
  const { pending, run } = useRecordActions();
  return (
    <article aria-label={`Partnership enquiry ${d.ref}`} className="grid gap-5">
      <SeenOnOpen reference={d.ref} seen={actions.seen} />
      <header className="rounded-[26px] bg-white p-5 shadow-soft md:p-6">
        <Link href="/admin/people/partners" className="mb-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-forest">
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} /> Partners
        </Link>
        <p className="font-grotesk text-[13px] font-semibold tabular-nums text-umber">{d.ref}</p>
        <h2 className="mt-1 flex flex-wrap items-center gap-2 text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">
          {d.organisation.name} <FlagDisc code={d.organisation.country} className="size-6" label={countryName(d.organisation.country)} />
        </h2>
        <p className="mt-1 text-[14px] text-body">
          {d.organisation.kind} · {d.type}
          {d.programme ? ` · ${d.programme}` : ""} · asked {formatStaffDate(d.createdAt, tz)}
        </p>
        <div className="mt-5">
          <StatusStepper workflow="partnership" status={d.status} perms={[]} compact />
        </div>
        {d.canManage ? (
          <div className="mt-5 border-t border-line pt-4">
            <StageMoves edges={d.edges} statusLabel={(s) => LABEL[s] ?? s} pending={pending} onMove={(id, input) => run(() => actions.move(d.ref, id, d.version, input), `${d.organisation.name} moved on`)} />
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-5">
          <Section title="What they propose">
            <p className="whitespace-pre-wrap text-[15px] text-ink">{d.message}</p>
          </Section>
          {d.canManage ? (
            <Section title="Add to the record">
              <NoteComposer reference={d.ref} addNote={actions.addNote} />
            </Section>
          ) : null}
          <Section title="What happened">
            <Timeline entries={timeline} tz={tz} />
          </Section>
        </div>
        <div className="grid min-w-0 gap-5">
          <Section title="Follow-up">
            <FollowUp person={d.followUp.person} at={d.followUp.at} people={d.people} tz={tz} canManage={d.canManage} pending={pending} save={(uid, at) => run(() => actions.followUp(d.ref, d.version, uid, at), "Follow-up saved")} />
          </Section>
          <Section title="Who to talk to">
            <dl>
              <Row label="Name">
                {d.contact.name}
                {d.contact.role ? <span className="text-body"> · {d.contact.role}</span> : null}
              </Row>
              <Row label="Email">
                <a href={`mailto:${d.contact.email}`} className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline">
                  <Mail aria-hidden className="size-4" /> {d.contact.email}
                </a>
              </Row>
              {d.contact.phone ? (
                <Row label="Phone">
                  <a href={`tel:${d.contact.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline">
                    <Phone aria-hidden className="size-4" /> {d.contact.phone}
                  </a>
                </Row>
              ) : null}
              {d.organisation.website ? (
                <Row label="Website">
                  <a href={d.organisation.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline">
                    {d.organisation.website.replace(/^https?:\/\//, "")} <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                </Row>
              ) : null}
              <Row label="Happy to be contacted">{d.consentToContact ? "Yes" : "No"}</Row>
              {d.heardFrom ? <Row label="Heard about us">{d.heardFrom}</Row> : null}
            </dl>
          </Section>
        </div>
      </div>
    </article>
  );
}
