import type { Metadata } from "next";
import { Suspense } from "react";
import { DataRequests } from "@/components/admin/settings/DataRequests";
import { RetentionEditor } from "@/components/admin/settings/RetentionEditor";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { requireStaff } from "@/lib/server/auth/session";
import { getRetention, listDataRequests } from "@/lib/server/dal/settings";
import { resolveBackend } from "@/lib/server/env";
import { moveDataRequestAction, saveRetentionAction } from "../actions";

// Settings › Data & privacy (admin-ux §6.16; PLAN D104, D105), super admins only: privacy requests
// (30 days to answer), how long each kind of record is kept, and backups.

export const metadata: Metadata = { title: "Data & privacy" };

export default function DataPage() {
  return (
    <>
      <PageHeader title="Data & privacy" description="Privacy requests, how long Haven keeps records, and backups." back={{ label: "Settings", href: "/admin/settings" }} />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Data />
      </Suspense>
    </>
  );
}

async function Data() {
  await requireStaff("privacy.manage", "settings.manage");
  const [requests, retention] = await Promise.all([listDataRequests(), getRetention()]);
  const local = resolveBackend() === "local";
  return (
    <div className="grid gap-10">
      <section aria-labelledby="dr-title">
        <h2 id="dr-title" className="mb-1 text-[20px] font-extrabold text-ink">
          Privacy requests
        </h2>
        <p className="mb-4 text-[14.5px] text-body">People can ask for a copy of their information, a correction, or for it to be deleted. The law gives us 30 days to answer.</p>
        <DataRequests open={requests.open} closed={requests.closed} now={requests.now} tz={requests.tz} move={moveDataRequestAction} />
      </section>

      <section aria-labelledby="ret-title">
        <h2 id="ret-title" className="mb-1 text-[20px] font-extrabold text-ink">
          How long we keep things
        </h2>
        <p className="mb-4 text-[14.5px] text-body">Counted from when a request closes or a gift’s financial year ends. Safeguarding records are always reviewed by a person and kept at least 7 years.</p>
        <RetentionEditor key={retention.updatedAt ?? 0} rows={retention.rows} updatedAt={retention.updatedAt} save={saveRetentionAction} />
      </section>

      <section aria-labelledby="bk-title">
        <h2 id="bk-title" className="mb-3 text-[20px] font-extrabold text-ink">
          Backups
        </h2>
        {local ? (
          <Notice tone="info" compact title="Practice mode">
            Everything is saved on this computer only. Backups start when Haven is connected to Firebase.
          </Notice>
        ) : (
          <Notice tone="success" compact title="Backed up every night">
            Firebase keeps a daily copy of every record for 30 days. Ask your developer to restore one if something goes wrong.
          </Notice>
        )}
      </section>
    </div>
  );
}
