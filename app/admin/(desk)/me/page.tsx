import type { Metadata } from "next";
import { Suspense } from "react";
import { MeView } from "@/components/admin/me/MeView";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { getMe } from "@/lib/server/dal/staff";
import { changePasswordAction, saveMeAction, signOutDeviceAction, signOutOthersAction } from "./actions";

// Me (admin-ux §6.17): everyone's own page, reached from the avatar menu.

export const metadata: Metadata = { title: "Me" };

export default function MePage() {
  return (
    <>
      <PageHeader title="Me" description="Your details, the emails you get, and where you’re signed in." />
      <Suspense fallback={<RecordSkeleton />}>
        <Me />
      </Suspense>
    </>
  );
}

async function Me() {
  const me = await getMe();
  return <MeView key={me.version} me={me} save={saveMeAction} changePassword={changePasswordAction} signOutDevice={signOutDeviceAction} signOutOthers={signOutOthersAction} />;
}
