import type { Metadata } from "next";
import { Suspense } from "react";
import { Bot, CreditCard, Database, Mail, Video } from "lucide-react";
import { TestEmailButton } from "@/components/admin/settings/TestEmailButton";
import { ListSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import type { IntegrationStatus } from "@/lib/model/dto";
import { requireStaff } from "@/lib/server/auth/session";
import { integrationStatuses } from "@/lib/server/integrations/status";
import { cn } from "@/lib/cn";
import { sendTestEmailAction } from "../actions";

// Settings › Connections (admin-ux §6.16; integrations §2.2), super admins: what each outside
// service does for Haven, whether it's on, and the setting names to give the developer. Never values.

export const metadata: Metadata = { title: "Connections" };

const ICON = { firebase: Database, stripe: CreditCard, email: Mail, ai: Bot, zoom: Video } as const;
const NAME = { firebase: "Records and sign-in", stripe: "Card payments", email: "Email", ai: "Writing helper", zoom: "Zoom" } as const;
const STATE: Record<IntegrationStatus["state"], { label: string; cls: string }> = {
  connected: { label: "Connected", cls: "bg-mint text-deep" },
  test: { label: "Test mode", cls: "bg-marigold-100 text-umber" },
  off: { label: "Not connected yet", cls: "bg-sand text-body" },
  problem: { label: "Needs attention", cls: "bg-danger/10 text-danger" },
};

export default function ConnectionsPage() {
  return (
    <>
      <PageHeader title="Connections" description="The outside services Haven uses, and what changes when each one is on." back={{ label: "Settings", href: "/admin/settings" }} />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Cards />
      </Suspense>
    </>
  );
}

async function Cards() {
  await requireStaff("settings.manage");
  const list = integrationStatuses();
  return (
    <ul className="grid gap-3">
      {list.map((s) => {
        const Icon = ICON[s.id];
        return (
          <li key={s.id} data-ref={s.id} className="rounded-[22px] bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream text-forest">
                <Icon aria-hidden className="size-6" strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1 basis-60">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-body">{NAME[s.id]}</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", STATE[s.state].cls)}>{STATE[s.state].label}</span>
                </p>
                <p className="mt-1 text-[17px] font-extrabold text-ink">{s.headline}</p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-body">{s.meaning}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13.5px] font-bold text-forest">For the developer</summary>
                  <p className="mt-1.5 text-[13px] text-body">Settings involved:</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {s.envNames.map((n) => (
                      <li key={n} className="rounded-md bg-cream px-2 py-0.5 font-mono text-[12px] text-ink">
                        {n}
                      </li>
                    ))}
                  </ul>
                </details>
                {s.id === "email" ? (
                  <div className="mt-4">
                    <TestEmailButton send={sendTestEmailAction} />
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
