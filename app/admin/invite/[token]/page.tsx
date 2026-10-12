import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { PasswordSetForm } from "@/components/admin/auth/PasswordSetForm";
import { Notice } from "@/components/ui/Notice";
import { ROLE_LABEL } from "@/lib/model/labels";
import { peekInvitation } from "@/lib/server/auth/invitations";
import { acceptInviteAction } from "./actions";

// /admin/invite/<token> (admin-ux §6.14): the link in "You're invited to join the Haven team".

export const metadata: Metadata = { title: "Join the team", robots: { index: false } };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <AuthFrame>
      <Suspense fallback={<p className="text-[15px] text-body">Checking your invitation…</p>}>
        <Invite params={params} />
      </Suspense>
    </AuthFrame>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  let token = "";
  try {
    token = decodeURIComponent(raw);
  } catch {
    token = "";
  }
  const inv = await peekInvitation(token);
  if (!inv) {
    return (
      <>
        <AuthHeading title="This invitation has expired" />
        <Notice tone="info" compact title="Ask for a new link">
          Invitations work for 72 hours and only once. Ask your super admin to send a fresh one.
        </Notice>
        <Link href="/admin/login" className="mt-5 inline-flex text-[15px] font-bold text-forest underline-offset-4 hover:underline">
          Go to sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <AuthHeading
        eyebrow="Welcome to the team"
        title={`Hello, ${inv.displayName.split(" ")[0]}`}
        lead={
          <>
            You’re joining Haven as {inv.roles.map((r) => ROLE_LABEL[r]?.name ?? r).join(" and ")}. Choose a password for <strong>{inv.email}</strong> to get started.
          </>
        }
      />
      <PasswordSetForm action={acceptInviteAction} token={token} submitLabel="Join the team" pendingLabel="Setting up your account…" />
    </>
  );
}
