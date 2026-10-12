import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Masked } from "@/components/admin/ui/Masked";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { formatStaffDateTime } from "@/lib/admin/format";
import { countryName } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import type { TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import type { MessageDetailDTO } from "@/lib/server/dal/engagement";
import { MessageControls } from "./engagement/EngagementControls";
import { NoteComposer, SeenOnOpen, TakeButton } from "./support/SupportControls";
import { Timeline } from "./Timeline";

export type MessageViewProps = {
  d: MessageDetailDTO;
  timeline: TimelineEntryDTO[];
  tz: string;
  perms: Permission[];
  /** The viewer may create support requests ("Turn into a support request"). */
  canMakeRequest: boolean;
  context?: "inbox" | "place";
  actions: {
    move: (ref: string, edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;
    take: (ref: string) => Promise<ActionResult>;
    addNote: (ref: string, kind: "note" | "call", text: string) => Promise<ActionResult>;
    reveal: (ref: string, field: "phone" | "email") => Promise<string | null>;
    toRequest: (ref: string, category: never) => Promise<ActionResult<{ ref: string }>>;
    seen: (ref: string) => Promise<void>;
  };
};

/**
 * A contact-form message (admin-ux §6.19): the message, its category and the sender (contact masked
 * unless it's yours), Reply by email, Mark as done, Turn into a support request, notes.
 */
export function MessageView({ d, timeline, tz, perms, canMakeRequest, actions }: MessageViewProps) {
  const v = { timezone: tz };
  const shell = { perms };
  const { move: moveMessage, take, addNote, reveal: revealMessage, toRequest: turnIntoRequest, seen } = actions;
  return (
    <article aria-label={`Message ${d.ref}`} className="grid gap-5">
      <SeenOnOpen reference={d.ref} seen={seen} />
      <header className="rounded-[26px] bg-white p-5 shadow-soft md:p-6">
        <Link href="/admin/inbox" className="mb-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-forest lg:hidden">
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} /> Inbox
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-grotesk text-[13px] font-semibold tabular-nums text-umber">
              {d.ref} · {d.category}
            </p>
            <h2 className="mt-1 text-[24px] font-extrabold leading-tight text-ink">{d.subject}</h2>
            <p className="mt-1 font-grotesk text-[13px] text-body">
              From {d.name} · {formatStaffDateTime(d.createdAt, v.timezone)}
            </p>
          </div>
          {d.canWrite && !d.assignee ? <TakeButton reference={d.ref} take={take} /> : null}
        </div>
        <div className="mt-5">
          <MessageControls
            reference={d.ref}
            status={d.status}
            version={d.version}
            perms={d.canWrite ? shell.perms : []}
            timezone={v.timezone}
            history={d.history}
            firstName={d.name.split(" ")[0] ?? "them"}
            canTurnIntoRequest={d.canWrite && canMakeRequest}
            actions={{ move: moveMessage, toRequest: turnIntoRequest }}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-5">
          <section className="rounded-[22px] bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-[16px] font-extrabold text-ink">The message</h3>
            <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-ink">{d.message}</p>
          </section>
          {d.canWrite ? (
            <section className="rounded-[22px] bg-white p-5 shadow-soft">
              <h3 className="mb-3 text-[16px] font-extrabold text-ink">Add a note</h3>
              <NoteComposer reference={d.ref} addNote={addNote} />
            </section>
          ) : null}
          <section className="rounded-[22px] bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-[16px] font-extrabold text-ink">Timeline</h3>
            <Timeline entries={timeline} tz={v.timezone} />
          </section>
        </div>
        <section className="min-w-0 rounded-[22px] bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-[16px] font-extrabold text-ink">From</h3>
          <dl className="grid gap-2 text-[14.5px]">
            <div>
              <dt className="text-body">Name</dt>
              <dd className="text-ink">{d.name}</dd>
            </div>
            <div>
              <dt className="text-body">Country</dt>
              <dd className="inline-flex items-center gap-1.5 text-ink">
                {hasFlag(d.country) ? <FlagDisc code={d.country} className="size-4" /> : null} {countryName(d.country)}
              </dd>
            </div>
            <div>
              <dt className="text-body">Email</dt>
              <dd>{d.email.masked ? <Masked masked={d.email.value} kind="email" label="email address" canReveal={d.canReveal} onReveal={revealMessage.bind(null, d.ref, "email")} /> : <a className="break-all font-bold text-forest" href={`mailto:${d.email.value}`}>{d.email.value}</a>}</dd>
            </div>
            {d.phone ? (
              <div>
                <dt className="text-body">Phone</dt>
                <dd>{d.phone.masked ? <Masked masked={d.phone.value} kind="phone" label="phone number" canReveal={d.canReveal} onReveal={revealMessage.bind(null, d.ref, "phone")} /> : <a className="font-bold text-forest" href={`tel:${d.phone.value.replace(/[^\d+]/g, "")}`}>{d.phone.value}</a>}</dd>
              </div>
            ) : null}
            {d.replies.length ? (
              <div>
                <dt className="text-body">Replies</dt>
                <dd className="text-ink">
                  {d.replies.map((r) => (
                    <span key={r.at} className="block">
                      {r.byName} · {formatStaffDateTime(r.at, v.timezone)}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </article>
  );
}
