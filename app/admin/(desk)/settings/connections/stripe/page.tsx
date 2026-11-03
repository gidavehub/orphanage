import type { Metadata } from "next";
import { Suspense } from "react";
import { CreditCard, KeyRound, ShieldCheck } from "lucide-react";
import { RemoveStripeKeys, StripeKeyLinks, StripeKeysForm } from "@/components/admin/settings/StripeKeys";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { formatStaffDate } from "@/lib/admin/format";
import { requireRecentAuth, requireStaff } from "@/lib/server/auth/session";
import { getStripeKeysView, LINK_TTL_MS, listKeyLinks, listKeyRecipients } from "@/lib/server/dal/stripeKeys";
import { env } from "@/lib/server/env";
import { cn } from "@/lib/cn";
import { cancelKeyLinkAction, removeStripeKeysAction, saveStripeKeysAction, sendKeyLinksAction } from "./actions";

// Settings › Connections › Card payments (owner, 2026-11-03), super admins: the Stripe keys Haven
// uses, pasted here and kept encrypted by Haven, or pasted by another super admin through a secure
// link we email them. Changing them redirects donations, so the page asks for a sign-in in the last
// 30 minutes (D87) and every change is emailed to every super admin.

export const metadata: Metadata = { title: "Card payments" };

const PATH = "/admin/settings/connections/stripe";

export default function StripeKeysPage() {
  return (
    <>
      <PageHeader title="Card payments" description="The Stripe keys Haven uses to take card gifts. Paste them here, or ask another super admin to." back={{ label: "Connections", href: "/admin/settings/connections" }} />
      <Suspense fallback={<RecordSkeleton />}>
        <Panel />
      </Suspense>
    </>
  );
}

const MODE = {
  live: { label: "Live", cls: "bg-mint text-deep", line: "Real cards are charged." },
  test: { label: "Test mode", cls: "bg-marigold-100 text-umber", line: "Only Stripe's test cards work. Test gifts are not counted in totals." },
  off: { label: "Not connected yet", cls: "bg-sand text-body", line: "Donors see bank and mobile-money details until the keys are added." },
} as const;

function Card({ id, icon: Icon, title, intro, children }: { id: string; icon: typeof KeyRound; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[22px] bg-white p-5 shadow-soft md:p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream text-forest">
          <Icon aria-hidden className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-[18px] font-extrabold text-ink">
            {title}
          </h2>
          {intro ? <div className="mt-1 text-[14.5px] leading-relaxed text-body">{intro}</div> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

async function Panel() {
  const v = await requireStaff("settings.manage");
  await requireRecentAuth(v, PATH);
  const [view, recipients, links] = await Promise.all([getStripeKeysView(), listKeyRecipients(), listKeyLinks()]);
  const m = MODE[view.mode];
  // [label, masked key or null, what to say when there's none]
  const rows: Array<[string, string | null, string]> = [
    ["Secret key", view.hints.secretKey ? `••••${view.hints.secretKey}` : null, "Not added"],
    ["Publishable key", view.hints.publishableKey ? `••••${view.hints.publishableKey}` : null, "Not added"],
    ["Webhook signing secret", view.hints.webhookSecret ? `••••${view.hints.webhookSecret}` : null, "Not set"],
  ];
  const days = Math.round(LINK_TTL_MS / 86_400_000);

  return (
    <div className="grid gap-5">
      <Card
        id="now"
        icon={CreditCard}
        title="Right now"
        intro={
          <p className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", m.cls)}>{m.label}</span>
            <span>{m.line}</span>
          </p>
        }
      >
        <dl className="grid gap-x-6 gap-y-3 text-[14.5px] sm:grid-cols-2">
          {view.account ? (
            <div className="sm:col-span-2">
              <dt className="text-[13px] font-bold uppercase tracking-[0.04em] text-body">Stripe account</dt>
              <dd className="mt-0.5 font-bold text-ink">
                {view.account.name ?? "Name not shown"} <span className="font-mono text-[13px] font-normal text-body">{view.account.id}</span>
              </dd>
            </div>
          ) : null}
          {rows.map(([k, masked, none]) => (
            <div key={k}>
              <dt className="text-[13px] font-bold uppercase tracking-[0.04em] text-body">{k}</dt>
              <dd className="mt-0.5 text-ink">
                {masked ? <span className="font-mono text-[14px]">{masked}</span> : <span className="text-body">{none}</span>}
                {masked && k === "Webhook signing secret" && view.webhookMadeByHaven ? <span className="text-body"> (set up by Haven)</span> : null}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-[13px] font-bold uppercase tracking-[0.04em] text-body">Currencies</dt>
            <dd className="mt-0.5 text-ink">{view.currencies.join(", ") || "None"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13.5px] text-body">
          {view.source === "saved" && view.updatedAt
            ? `Saved by ${view.updatedByName ?? "a super admin"} on ${formatStaffDate(view.updatedAt, v.timezone, "long")}.`
            : view.source === "env"
              ? "These come from the server settings. Keys saved here take their place."
              : "Nothing is saved yet."}
        </p>
        {view.source === "saved" ? (
          <div className="mt-4">
            <RemoveStripeKeys remove={removeStripeKeysAction} fallback={Boolean(env.stripe.secretKey)} />
          </div>
        ) : null}
      </Card>

      <Card
        id="paste"
        icon={KeyRound}
        title={view.source === "saved" ? "Change the keys" : "Add the keys"}
        intro="Sign in to Stripe (dashboard.stripe.com), open Developers › API keys, and copy each key into its box. Use live keys to take real gifts."
      >
        <StripeKeysForm key={view.baseUpdatedAt} view={view} save={saveStripeKeysAction} />
      </Card>

      <Card
        id="ask"
        icon={ShieldCheck}
        title="Ask another super admin to add them"
        intro={`Haven emails them a secure link. They sign in (password and emailed code), then paste the keys. The link works for ${days} days, as many times as they need, and you can cancel it here.`}
      >
        <StripeKeyLinks recipients={recipients} links={links} send={sendKeyLinksAction} cancel={cancelKeyLinkAction} />
      </Card>
    </div>
  );
}
