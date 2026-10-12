import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { CodeForm } from "@/components/admin/auth/CodeForm";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { COPY } from "@/lib/admin/copy";
import { safeNextPath } from "@/lib/model/session";
import { resolveBackend } from "@/lib/server/env";

// /admin/login/code (admin-ux §6.1; PLAN D88): the second step for accounts with a sign-in code
// (required for super admins, safeguarding and finance officers in Firebase mode). Practice mode
// skips two-step verification, so it explains that and goes back.

export const metadata: Metadata = { title: "Sign-in code" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function CodePanel({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNextPath(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  const remember = (Array.isArray(sp.remember) ? sp.remember[0] : sp.remember) === "1";
  const justSetUp = (Array.isArray(sp.setup) ? sp.setup[0] : sp.setup) === "1";
  if (resolveBackend() !== "firestore") {
    return (
      <div className="grid gap-5">
        <p className="text-[16px] leading-relaxed text-body">{COPY["auth.practiceBadge"]}.</p>
        <Button href={`/admin/login?next=${encodeURIComponent(next)}`} variant="forest" icon="arrow-right">
          Back to sign in
        </Button>
      </div>
    );
  }
  return <CodeForm next={next} remember={remember} justSetUp={justSetUp} />;
}

export default function LoginCodePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthFrame>
      <AuthHeading eyebrow="One more step" title="Enter your sign-in code" lead="Open your authenticator app and type the 6-digit code for Haven." />
      <div className="mt-7">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <CodePanel searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthFrame>
  );
}
