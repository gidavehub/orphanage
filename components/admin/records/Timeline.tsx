import { CircleDot, FileText, Mail, Phone, Share2, Sparkles, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatStaffDateTime } from "@/lib/admin/format";
import type { TimelineEntryDTO } from "@/lib/model/dto";
import { cn } from "@/lib/cn";

// A record's timeline (admin-ux §6.4): newest first. Notes are sticky-note cards (sand, a slight tilt
// on desktop, flat with reduced motion); stage changes and system lines are single muted rows.

function who(a: TimelineEntryDTO["actor"]): string {
  if ("name" in a) return a.name;
  if ("system" in a) return "Haven";
  if ("stripe" in a) return "Stripe";
  return "On the website";
}

const ICON: Partial<Record<TimelineEntryDTO["kind"], typeof CircleDot>> = {
  email: Mail,
  referral: Share2,
  submitted: Sparkles,
  assigned: UserRound,
  document: FileText,
};

export function Timeline({ entries, tz, className }: { entries: TimelineEntryDTO[]; tz: string; className?: string }) {
  if (!entries.length) return <p className="text-[15px] text-body">Nothing has happened here yet.</p>;
  return (
    <ol className={cn("grid gap-3", className)}>
      {entries.map((e) => {
        if (e.kind === "note") {
          const call = e.text?.startsWith("Call: ");
          return (
            <li key={e.id} className="rounded-[18px] bg-sand px-4 py-3.5 text-umber shadow-soft md:-rotate-[0.4deg] motion-reduce:rotate-0">
              <p className="flex items-center gap-2 font-grotesk text-[12.5px] font-semibold">
                {"name" in e.actor ? <Avatar name={e.actor.name} uid={e.actor.uid} tone={e.actor.tone} size={28} /> : null}
                {call ? <Phone aria-hidden className="size-3.5" /> : null}
                {call ? "Call" : "Note"} · {who(e.actor)} · {formatStaffDateTime(e.at, tz)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{call ? e.text!.slice(6) : e.text}</p>
            </li>
          );
        }
        const Icon = ICON[e.kind] ?? CircleDot;
        return (
          <li key={e.id} className="flex items-start gap-2.5 px-1 text-[14px] leading-snug text-body">
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-forest" strokeWidth={2.25} />
            <span className="min-w-0 flex-1">
              <span className="text-ink">{e.text}</span>
              <span className="block font-grotesk text-[12.5px]">{formatStaffDateTime(e.at, tz)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
