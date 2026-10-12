import { redirect } from "next/navigation";
import { MessageView } from "@/components/admin/records/MessageView";
import { StoryView } from "@/components/admin/records/StoryView";
import { SupportView } from "@/components/admin/records/SupportView";
import { adminHrefOfRef, kindOfRef, normaliseRef } from "@/lib/model/refs";
import { has } from "@/lib/server/auth/permissions";
import { requireStaff, toShellViewer } from "@/lib/server/auth/session";
import { getEngagementTimeline, getMessageDetail, getStoryDetail } from "@/lib/server/dal/engagement";
import { referralOptions } from "@/lib/server/dal/referralPartners";
import { getSupportDetail, getSupportTimeline } from "@/lib/server/dal/support";
import { addNote, moveMessage, moveStory, moveSupport, revealContact, revealMessage, saveTriage, seen, take, turnIntoRequest, turnIntoTestimonial } from "../inbox/actions";

// Server panels for the record views (admin-ux §3.8): each one checks the person, loads the record's
// DTO through the DAL and hands it, with the Server Actions, to the client-safe view component.

export async function SupportPanel({ reference, context }: { reference: string; context: "inbox" | "place" }) {
  const v = await requireStaff("support.read", "support.summary", "support.manage");
  const [d, timeline, referrals] = await Promise.all([getSupportDetail(reference), getSupportTimeline(reference), has(v, "support.manage") ? referralOptions() : Promise.resolve([])]);
  return (
    <SupportView
      d={d}
      timeline={timeline}
      referralOptions={referrals}
      tz={v.timezone}
      perms={toShellViewer(v).perms}
      context={context}
      actions={{ move: moveSupport, take, addNote, reveal: revealContact, saveTriage, seen }}
    />
  );
}

export async function MessagePanel({ reference }: { reference: string }) {
  const v = await requireStaff("contact.read", "contact.manage");
  const [d, timeline] = await Promise.all([getMessageDetail(reference), getEngagementTimeline(reference)]);
  return (
    <MessageView
      d={d}
      timeline={timeline}
      tz={v.timezone}
      perms={toShellViewer(v).perms}
      canMakeRequest={has(v, "support.manage")}
      actions={{ move: moveMessage, take, addNote, reveal: revealMessage, toRequest: turnIntoRequest as never, seen }}
    />
  );
}

export async function StoryPanel({ reference }: { reference: string }) {
  const v = await requireStaff("storySubmission.manage");
  const [d, timeline] = await Promise.all([getStoryDetail(reference), getEngagementTimeline(reference)]);
  return (
    <StoryView
      d={d}
      timeline={timeline}
      tz={v.timezone}
      perms={toShellViewer(v).perms}
      canEditWebsite={has(v, "content.edit")}
      actions={{ move: moveStory, addNote, toTestimonial: turnIntoTestimonial, seen }}
    />
  );
}

/** The record beside the Inbox list: requests, messages and stories open here; other kinds go home. */
export async function RecordPanel({ reference, context }: { reference: string; context: "inbox" | "place" }) {
  const ref = normaliseRef(decodeURIComponent(reference)) ?? reference;
  const kind = kindOfRef(ref);
  if (kind === "support") return <SupportPanel reference={ref} context={context} />;
  if (kind === "message") return <MessagePanel reference={ref} />;
  if (kind === "story") return <StoryPanel reference={ref} />;
  redirect(adminHrefOfRef(ref, kind ?? undefined));
}
