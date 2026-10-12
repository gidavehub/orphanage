import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { ConfirmForm } from "@/components/admin/auth/ConfirmForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { COPY } from "@/lib/admin/copy";
import { safeNextPath } from "@/lib/model/session";
import { getViewer } from "@/lib/server/auth/session";
import { confirmIdentity } from "./actions";

// /admin/confirm?next= (PLAN D87): "Confirm it's you" before entering Safeguarding, personal-data
// exports, role and sign-in-code changes, staff deactivation and completing a data request.
// requireRecentAuth() sends people here when their last real sign-in is older than 30 minutes.

export const metadata: Metadata = { title: "Confirm it's you" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ConfirmPanel({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNextPath(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  const viewer = await getViewer();
  if (!viewer) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  return (
    <>
      <p className="mb-6 flex items-center gap-2 rounded-2xl bg-mint px-4 py-3 text-[14px] font-semibold text-forest-700">
        <ShieldCheck aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
        Signed in as {viewer.displayName}
      </p>
      <ConfirmForm
        action={confirmIdentity}
        mode={viewer.backend === "firestore" ? "firebase" : "local"}
        email={viewer.email}
        next={next}
        submitLabel="Confirm and continue"
      />
      <Link href="/admin" className="mt-5 inline-flex min-h-11 items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
        Not now, go back to Today
      </Link>
    </>
  );
}

export default function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthFrame plain>
      <AuthHeading title={COPY["auth.confirmTitle"]} lead={COPY["auth.confirmBody"]} />
      <div className="mt-7">
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <ConfirmPanel searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthFrame>
  );
}
