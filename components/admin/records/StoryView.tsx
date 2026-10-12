import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { formatStaffDateTime } from "@/lib/admin/format";
import { countryName } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import type { TimelineEntryDTO } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import type { StoryDetailDTO } from "@/lib/server/dal/engagement";
import { StoryControls } from "./engagement/EngagementControls";
import { NoteComposer, SeenOnOpen } from "./support/SupportControls";
import { Timeline } from "./Timeline";

export type StoryViewProps = {
  d: StoryDetailDTO;
  timeline: TimelineEntryDTO[];
  tz: string;
  perms: Permission[];
  /** The viewer may edit the website (needed for the draft testimonial). */
  canEditWebsite: boolean;
  actions: {
    move: (ref: string, edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;
    addNote: (ref: string, kind: "note" | "call", text: string) => Promise<ActionResult>;
    toTestimonial: (ref: string, quote: string) => Promise<ActionResult<{ id: string }>>;
    seen: (ref: string) => Promise<void>;
  };
};

/**
 * A story submission (PLAN D58): the story, who shared it and how they'd like to be named, the
 * contact details for checking it with them, the stages, and "Turn into a testimonial" (a draft with
 * consent missing, so nothing goes live before consent is recorded).
 */
export function StoryView({ d, timeline, tz, perms, canEditWebsite, actions }: StoryViewProps) {
  const v = { timezone: tz };
  const shell = { perms };
  const { move: moveStory, addNote, toTestimonial: turnIntoTestimonial, seen } = actions;
  return (
    <article aria-label={`Story ${d.ref}`} className="grid gap-5">
      <SeenOnOpen reference={d.ref} seen={seen} />
      <header className="rounded-[26px] bg-white p-5 shadow-soft md:p-6">
        <Link href="/admin/inbox" className="mb-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-forest lg:hidden">
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} /> Inbox
        </Link>
        <p className="font-grotesk text-[13px] font-semibold tabular-nums text-umber">{d.ref}</p>
        <h2 className="mt-1 text-[24px] font-extrabold leading-tight text-ink">Story from {d.role.toLowerCase()}</h2>
        <p className="mt-1 font-grotesk text-[13px] text-body">
          {d.publishWithoutName ? "Wants to be published without a name" : d.displayName ? `Published as “${d.displayName}”` : "No name given"} · {formatStaffDateTime(d.createdAt, v.timezone)}
        </p>
        <div className="mt-5">
          <StoryControls
            reference={d.ref}
            status={d.status}
            version={d.version}
            perms={shell.perms}
            timezone={v.timezone}
            history={d.history}
            story={d.story}
            canMakeDraft={!d.createdItem && canEditWebsite && d.status !== "declined" && d.status !== "closed"}
            actions={{ move: moveStory, toTestimonial: turnIntoTestimonial }}
          />
          {d.createdItem ? <p className="mt-3 rounded-[14px] bg-mint px-3 py-2 text-[14px] text-ink">A draft {d.createdItem.collection === "testimonials" ? "testimonial" : "story"} was made from this. Record consent on it before it can go live.</p> : null}
        </div>
      </header>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-5">
          <section className="rounded-[22px] bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-[16px] font-extrabold text-ink">Their story</h3>
            <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-ink">{d.story}</p>
            {d.parentOrGuardian ? (
              <p className="mt-4 flex gap-2 rounded-[14px] bg-marigold-100 p-3 text-[14px] text-ink">
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-umber" /> It&rsquo;s about their own child. Arrange written consent before anything is published.
              </p>
            ) : null}
          </section>
          <section className="rounded-[22px] bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-[16px] font-extrabold text-ink">Add a note</h3>
            <NoteComposer reference={d.ref} addNote={addNote} />
          </section>
          <section className="rounded-[22px] bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-[16px] font-extrabold text-ink">Timeline</h3>
            <Timeline entries={timeline} tz={v.timezone} />
          </section>
        </div>
        <section className="min-w-0 rounded-[22px] bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-[16px] font-extrabold text-ink">To check it with them</h3>
          <dl className="grid gap-2 text-[14.5px]">
            <div>
              <dt className="text-body">Country</dt>
              <dd className="inline-flex items-center gap-1.5 text-ink">
                {hasFlag(d.country) ? <FlagDisc code={d.country} className="size-4" /> : null} {countryName(d.country)}
              </dd>
            </div>
            {d.contact?.name ? (
              <div>
                <dt className="text-body">Name</dt>
                <dd className="text-ink">{d.contact.name}</dd>
              </div>
            ) : null}
            {d.contact?.email ? (
              <div>
                <dt className="text-body">Email</dt>
                <dd>
                  <a className="break-all font-bold text-forest" href={`mailto:${d.contact.email}`}>
                    {d.contact.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {d.contact?.phone ? (
              <div>
                <dt className="text-body">Phone</dt>
                <dd>
                  <a className="font-bold text-forest" href={`tel:${d.contact.phone.replace(/[^\d+]/g, "")}`}>
                    {d.contact.phone}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 text-[13px] text-body">These details are only for checking the story with them. They&rsquo;re never published.</p>
        </section>
      </div>
    </article>
  );
}
