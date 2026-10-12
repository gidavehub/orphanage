"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronRight, Clock, ShieldCheck, UserPlus } from "lucide-react";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "@/lib/admin/format";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { ROLE_LABEL } from "@/lib/model/labels";
import type { PendingInviteDTO } from "@/lib/server/auth/invitations";
import type { TeamMemberDTO } from "@/lib/server/dal/staff";
import { cn } from "@/lib/cn";

type InviteAct = (id: string) => Promise<ActionResult<{ id: string }>>;

const STATUS: Record<TeamMemberDTO["status"], { label: string; cls: string } | null> = {
  active: null,
  suspended: { label: "Paused", cls: "bg-marigold-100 text-umber" },
  deactivated: { label: "No longer here", cls: "bg-sand text-body" },
};

/** The team (admin-ux §6.14): people, what they do, when they last signed in, and invitations still waiting. */
export function TeamList({ members, invitations, now, resend, revoke }: { members: TeamMemberDTO[]; invitations: PendingInviteDTO[]; now: Millis; resend: InviteAct; revoke: InviteAct }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const active = members.filter((m) => m.status !== "deactivated");
  const gone = members.filter((m) => m.status === "deactivated");

  const run = (fn: InviteAct, id: string, done: string) =>
    start(async () => {
      const r = await fn(id);
      toast(r.ok ? { title: done, tone: "success" } : { title: r.error.kind === "validation" ? "Please check." : r.error.message, tone: "danger" });
    });

  return (
    <div className="grid gap-8">
      <div className="flex justify-end md:-mt-2">
        <Button type="button" variant="forest" size="sm" icon="none" onClick={() => openGlobalSheet(router, "invite")}>
          <UserPlus aria-hidden className="size-4" /> Invite someone
        </Button>
      </div>

      {invitations.length ? (
        <section aria-labelledby="pending-title">
          <h2 id="pending-title" className="text-[18px] font-extrabold text-ink">
            Waiting to join
          </h2>
          <ul className="mt-3 grid gap-2">
            {invitations.map((i) => (
              <li key={i.id} data-ref={i.email} className="flex flex-wrap items-center gap-3 rounded-[22px] bg-white p-4 shadow-soft">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marigold-100 text-umber">
                  <Clock aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-extrabold text-ink">{i.displayName}</p>
                  <p className="text-[13.5px] text-body">
                    {i.email} · {i.roles.map((r) => ROLE_LABEL[r]?.name ?? r).join(", ")} ·{" "}
                    <span className={cn(i.expired && "font-bold text-umber")}>{i.expired ? "The link has expired" : `Invited ${relativeTime(i.createdAt, now)}`}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={() => run(resend, i.id, "A fresh link is on its way")} className="inline-flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest disabled:opacity-50">
                    Send a new link
                  </button>
                  <button type="button" disabled={pending} onClick={() => run(revoke, i.id, "Invitation cancelled")} className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-bold text-danger hover:bg-danger/10 disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="team-title">
        <h2 id="team-title" className="text-[18px] font-extrabold text-ink">
          The team <span className="text-[15px] font-bold text-body">· {active.length}</span>
        </h2>
        <ul className="mt-3 grid gap-2">
          {active.map((m) => (
            <MemberRow key={m.uid} m={m} now={now} />
          ))}
        </ul>
      </section>

      {gone.length ? (
        <section aria-labelledby="gone-title">
          <h2 id="gone-title" className="text-[16px] font-extrabold text-body">
            No longer on the team
          </h2>
          <p className="mt-1 text-[14px] text-body">Their accounts are switched off. What they did stays in the activity log.</p>
          <ul className="mt-3 grid gap-2">
            {gone.map((m) => (
              <MemberRow key={m.uid} m={m} now={now} muted />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MemberRow({ m, now, muted }: { m: TeamMemberDTO; now: Millis; muted?: boolean }) {
  const status = STATUS[m.status];
  return (
    <li>
      <Link href={`/admin/team/${m.uid}`} data-ref={m.uid} className={cn("group flex min-h-16 items-center gap-3 rounded-[22px] p-3.5 transition-shadow", muted ? "bg-cream/70 hover:bg-cream" : "bg-white shadow-soft hover:shadow-card")}>
        <Avatar name={m.name} uid={m.uid} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[16px] font-extrabold text-ink">
            {m.name}
            {status ? <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", status.cls)}>{status.label}</span> : null}
            {m.sample ? <span className="rounded-full bg-sand px-2.5 py-0.5 text-[12px] font-bold text-body">Practice</span> : null}
          </p>
          <p className="truncate text-[13.5px] text-body">
            {m.roleNames.join(", ")} · {m.lastSignInAt ? `Last here ${relativeTime(m.lastSignInAt, now)}` : "Hasn’t signed in yet"}
          </p>
        </div>
        {m.mfa.required ? (
          <span title={m.mfa.enrolled ? "Uses a sign-in code" : "Sign-in code not set up yet"} className={cn("hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold sm:inline-flex", m.mfa.enrolled ? "bg-mint text-deep" : "bg-marigold-100 text-umber")}>
            <ShieldCheck aria-hidden className="size-3.5" /> {m.mfa.enrolled ? "Code on" : "Code needed"}
          </span>
        ) : null}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-body transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
