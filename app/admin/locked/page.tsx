import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { ConfirmForm } from "@/components/admin/auth/ConfirmForm";
import { SignOutButton } from "@/components/admin/auth/SignOutButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { COPY } from "@/lib/admin/copy";
import { firstNameOf } from "@/lib/admin/format";
import { safeNextPath } from "@/lib/model/session";
import { getViewer } from "@/lib/server/auth/session";
import { confirmIdentity } from "../confirm/actions";
import { signOut } from "../login/actions";

// /admin/locked?next= (PLAN D86; admin-ux §6.1): the shell sends people here after 30 minutes without
// activity. Unlocking re-checks the password (or a fresh Firebase sign-in) and refreshes authTime;
// the screens underneath stay as they were. "Not you?" signs out with a full reload.

export const metadata: Metadata = { title: "Locked" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function LockedPanel({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNextPath(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  const viewer = await getViewer();
  if (!viewer) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  return (
    <>
      <AuthHeading
        title={`Still there, ${firstNameOf(viewer.displayName)}?`}
        lead="We locked Haven to keep things private. Your work underneath is kept."
      />
      <div className="mt-7">
        <ConfirmForm
          action={confirmIdentity}
          mode={viewer.backend === "firestore" ? "firebase" : "local"}
          email={viewer.email}
          next={next}
          submitLabel={COPY["auth.unlock"]}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-2 text-[15px] text-body">
        Not {firstNameOf(viewer.displayName)}?
        <SignOutButton action={signOut} variant="link" label="Sign out" />
      </div>
    </>
  );
}

export default function LockedPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthFrame plain>
      <Suspense
        fallback={
          <div className="grid gap-4">
            <AuthHeading title={COPY["auth.lockedTitle"]} lead={COPY["auth.lockedBody"]} />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <LockedPanel searchParams={searchParams} />
      </Suspense>
    </AuthFrame>
  );
}
