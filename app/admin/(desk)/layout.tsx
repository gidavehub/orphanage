import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminShellSkeleton } from "@/components/admin/shell/AdminShellSkeleton";
import { placesFor, quickActionsFor } from "@/lib/admin/access";
import { getViewer, toShellViewer } from "@/lib/server/auth/session";
import { listNotifications, type NotificationDTO } from "@/lib/server/dal/notifications";
import { integrationStatuses, practiceRibbon } from "@/lib/server/integrations/status";
import { log } from "@/lib/server/log";
import { signOut } from "../login/actions";

// Every signed-in screen (PLAN D2–D3, D84, D125). The layout itself never awaits the session: the
// shell streams in through a small async child inside Suspense, with the shell skeleton meanwhile.
// This is navigation, not security: every page, action and route calls requireStaff itself.

async function ShellWithViewer({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/admin/login");
  const viewer = toShellViewer(v);
  let updates: NotificationDTO[] = [];
  try {
    updates = (await listNotifications({ limit: 10 })).items;
  } catch (err) {
    unstable_rethrow(err);
    log.warn("admin.shell.updates_failed", { err });
  }
  return (
    <AdminShell
      viewer={viewer}
      places={placesFor(viewer)}
      quickActions={quickActionsFor(viewer)}
      practice={practiceRibbon()}
      paymentsInTestMode={integrationStatuses().some((s) => s.id === "stripe" && s.state === "test")}
      updates={updates}
      signOutAction={signOut}
    >
      {children}
    </AdminShell>
  );
}

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <ShellWithViewer>{children}</ShellWithViewer>
    </Suspense>
  );
}
