import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { SignOutButton } from "@/components/admin/auth/SignOutButton";
import { StripeKeysForm } from "@/components/admin/settings/StripeKeys";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatStaffDate } from "@/lib/admin/format";
import { getViewer, requireRecentAuth } from "@/lib/server/auth/session";
import { getStripeKeysView, noteKeyLinkOpened, peekKeyLink } from "@/lib/server/dal/stripeKeys";
import { signOut } from "../../login/actions";
import { saveKeysViaLinkAction } from "./actions";

// /admin/keys/<token> (owner, 2026-11-03): the link in "Please add Haven's Stripe keys". It works for
// 7 days and as often as needed, for the one super admin it was sent to: they sign in first (password
// and emailed code, like any sign-in) and come straight back here to paste the keys.

export const metadata: Metadata = { title: "Add the Stripe keys", robots: { index: false } };

export default function KeysLinkPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <AuthFrame plain footer={false}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Panel params={params} />
      </Suspense>
    </AuthFrame>
  );
}

function Stopped() {
  return (
    <>
      <AuthHeading title="This link has stopped working" />
      <Notice tone="info" compact title="Ask for a new link">
        Links to add the Stripe keys work for 7 days, until they’re cancelled. Ask the super admin who sent it for a fresh one.
      </Notice>
      <Link href="/admin" className="mt-5 inline-flex min-h-11 items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
        Go to Haven
      </Link>
    </>
  );
}

async function Panel({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  let token = "";
  try {
    token = decodeURIComponent(raw);
  } catch {
    token = "";
  }
  const link = await peekKeyLink(token);
  if (!link) return <Stopped />;

  const here = `/admin/keys/${token}`;
  const v = await getViewer();
  if (!v) redirect(`/admin/login?next=${encodeURIComponent(here)}`);
  if (v.uid !== link.recipientUid) {
    return (
      <>
        <AuthHeading title={`This link is for ${link.recipientName}`} lead={<>You’re signed in as {v.displayName}. Sign out, then open the link again and sign in as {link.recipientName}.</>} />
        <div className="mt-6">
          <SignOutButton action={signOut} variant="button" />
        </div>
      </>
    );
  }
  await requireRecentAuth(v, here);
  if (!v.perms.has("settings.manage")) {
    return (
      <>
        <AuthHeading title="You can't change the Stripe keys" lead="Only super admins can add them. Ask a super admin to check your access." />
        <Link href="/admin" className="mt-5 inline-flex min-h-11 items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
          Go to Haven
        </Link>
      </>
    );
  }
  await noteKeyLinkOpened(link);
  const view = await getStripeKeysView();
  const save = saveKeysViaLinkAction.bind(null, token);

  return (
    <>
      <AuthHeading
        eyebrow="Card payments"
        title="Add the Stripe keys"
        lead={
          <>
            {link.sentByName} asked you to add Haven’s Stripe keys. Sign in to Stripe (dashboard.stripe.com), open Developers › API keys, and copy each key into its box.
          </>
        }
      />
      <p className="mt-5 flex items-center gap-2 rounded-2xl bg-mint px-4 py-3 text-[14px] font-semibold text-forest-700">
        <ShieldCheck aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
        Signed in as {v.displayName}. This link works until {formatStaffDate(link.expiresAt, v.timezone, "short")}.
      </p>
      <div className="mt-6">
        <StripeKeysForm key={view.baseUpdatedAt} view={view} save={save} compact />
      </div>
      <Link href="/admin" className="mt-6 inline-flex min-h-11 items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
        Done, go to Haven
      </Link>
    </>
  );
}
