import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { FirebaseSignInForm } from "@/components/admin/auth/FirebaseSignInForm";
import { FirstAdminForm } from "@/components/admin/auth/FirstAdminForm";
import { LocalSignInForm } from "@/components/admin/auth/LocalSignInForm";
import { PracticeChips, type PracticeChip } from "@/components/admin/auth/PracticeChips";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { COPY } from "@/lib/admin/copy";
import { ROLE_LABEL } from "@/lib/model/labels";
import { ROLES } from "@/lib/model/permissions";
import { safeNextPath } from "@/lib/model/session";
import { firebaseAuthAvailable } from "@/lib/server/auth/firebase";
import { needsFirstAdmin } from "@/lib/server/auth/local";
import { getViewer } from "@/lib/server/auth/session";
import { devAllowed } from "@/lib/server/dev/guard";
import { PRACTICE_STAFF } from "@/lib/server/dev/seed";
import { resolveBackend } from "@/lib/server/env";
import { createFirstAdmin, signIn, signInAsRole } from "./actions";

// /admin/login (admin-ux §6.1; PLAN D86, D88–D90). A static frame; the form that depends on the data
// mode (practice or Firebase), the `next` parameter and an existing session streams in behind Suspense.

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function FormSkeleton() {
  return (
    <div aria-hidden className="grid gap-5">
      <Skeleton shape="text" className="h-4 w-16" />
      <Skeleton className="h-[52px] w-full rounded-full" />
      <Skeleton shape="text" className="h-4 w-24" />
      <Skeleton className="h-[52px] w-full rounded-full" />
      <Skeleton className="h-[52px] w-full rounded-full" />
    </div>
  );
}

async function SignInPanel({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next));
  // Already signed in (for example, a second tab): carry on.
  if (await getViewer()) redirect(next);

  const backend = resolveBackend();
  if (backend === "unavailable" || (backend === "firestore" && !firebaseAuthAvailable())) {
    return (
      <Notice tone="info" title="Sign-in isn't switched on yet" compact>
        Haven&rsquo;s team space is being set up. If you&rsquo;re on the team and need something now, please ask the person setting up Haven.
      </Notice>
    );
  }

  if (backend === "firestore") {
    return (
      <div className="grid gap-6">
        {first(sp.welcome) === "1" ? (
          <Notice tone="success" title="Your account is ready" compact>
            Sign in with your email and the password you just chose.
          </Notice>
        ) : first(sp.reset) === "1" ? (
          <Notice tone="success" title="Password changed" compact>
            Your new password is saved. Sign in with it below.
          </Notice>
        ) : null}
        <FirebaseSignInForm next={next} />
      </div>
    );
  }

  if (await needsFirstAdmin()) {
    return (
      <div className="grid gap-6">
        <Notice tone="info" title="Welcome to Haven" compact>
          There are no team accounts on this computer yet. Create the first super admin to get started.
        </Notice>
        <FirstAdminForm action={createFirstAdmin} />
      </div>
    );
  }

  const chips: PracticeChip[] = devAllowed()
    ? ROLES.map((role) => ({ role, name: PRACTICE_STAFF[role].displayName.split(" ")[0], roleLabel: ROLE_LABEL[role].name }))
    : [];

  return (
    <div className="grid gap-6">
      {first(sp.reset) === "1" ? (
        <Notice tone="success" title="Password changed" compact>
          Your new password is saved. Sign in with it below.
        </Notice>
      ) : null}
      <LocalSignInForm action={signIn} next={next} />
      <p className="flex items-start gap-2 rounded-2xl bg-sand px-4 py-3 text-[14px] font-semibold leading-snug text-umber">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
        {COPY["auth.practiceBadge"]}
      </p>
      {chips.length ? <PracticeChips chips={chips} action={signInAsRole} /> : null}
    </div>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthFrame>
      <AuthHeading eyebrow={COPY["auth.welcome"]} title="Sign in to Haven" lead="The team space for Haven staff." />
      <div className="mt-7">
        <Suspense fallback={<FormSkeleton />}>
          <SignInPanel searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthFrame>
  );
}
