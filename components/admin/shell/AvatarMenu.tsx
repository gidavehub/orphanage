"use client";

import Link from "next/link";
import { CircleHelp, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/admin/auth/SignOutButton";
import { Avatar } from "@/components/ui/Avatar";
import { COPY } from "@/lib/admin/copy";
import { ROLE_LABEL } from "@/lib/model/labels";
import { Popover } from "./Popover";
import { useShell } from "./ShellContext";

/**
 * The avatar menu (admin-ux §3.1): who is signed in, Me, Help, and Sign out (a full reload, D86).
 * Text size, the tour and "Sign out on all devices" live on the Me page.
 */
export function AvatarMenu({ size = 44 }: { size?: 36 | 44 }) {
  const { viewer, signOutAction } = useShell();
  const roleNames = viewer.roles.map((r) => ROLE_LABEL[r]?.name ?? r).join(", ");
  return (
    <Popover
      label={`${viewer.displayName}: your account`}
      triggerClassName="grid place-items-center rounded-full ring-2 ring-white transition-transform duration-200 hover:scale-105"
      trigger={<Avatar name={viewer.displayName} uid={viewer.uid} tone={viewer.tone} size={size} />}
      panelClassName="w-[280px]"
    >
      {(close) => (
        <div className="grid gap-1">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <Avatar name={viewer.displayName} uid={viewer.uid} tone={viewer.tone} size={44} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold text-ink">{viewer.displayName}</p>
              <p className="truncate font-grotesk text-[13px] text-body">{roleNames}</p>
            </div>
          </div>
          <div className="h-px bg-line" />
          <Link href="/admin/me" onClick={close} className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-bold text-ink transition-colors hover:bg-cream">
            <UserRound aria-hidden className="size-[18px] text-forest" strokeWidth={2.25} />
            {COPY["shell.me"]}
          </Link>
          <Link href="/admin/help" onClick={close} className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-bold text-ink transition-colors hover:bg-cream">
            <CircleHelp aria-hidden className="size-[18px] text-forest" strokeWidth={2.25} />
            {COPY["shell.help"]}
          </Link>
          <div className="h-px bg-line" />
          <SignOutButton action={signOutAction} label={COPY["shell.signOut"]} />
        </div>
      )}
    </Popover>
  );
}
