import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { PasswordSetForm } from "@/components/admin/auth/PasswordSetForm";
import { Notice } from "@/components/ui/Notice";
import { peekLocalResetToken } from "@/lib/server/auth/local";
import { resetAction } from "./actions";

// /admin/reset/<token> (PLAN D88): the link in "Reset your Haven team password".

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <AuthFrame>
      <Suspense fallback={<p className="text-[15px] text-body">Checking your link…</p>}>
        <Reset params={params} />
      </Suspense>
    </AuthFrame>
  );
}

async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  let token = "";
  try {
    token = decodeURIComponent(raw);
  } catch {
    token = "";
  }
  if (!(await peekLocalResetToken(token))) {
    return (
      <>
        <AuthHeading title="This link has expired" />
        <Notice tone="info" compact title="Ask for a new one">
          Reset links work for 1 hour and only once.
        </Notice>
        <Link href="/admin/forgot" className="mt-5 inline-flex text-[15px] font-bold text-forest underline-offset-4 hover:underline">
          Send me a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <AuthHeading title="Choose a new password" lead="You’ll be signed out everywhere, then you can sign in with the new one." />
      <PasswordSetForm action={resetAction} token={token} submitLabel="Save my new password" pendingLabel="Saving…" />
    </>
  );
}
