import type { Metadata } from "next";
import { connection } from "next/server";
import { QuickRow } from "@/components/admin/today/QuickRow";
import { DuePosts } from "@/components/admin/today/DuePosts";
import { FirstDayTour } from "@/components/admin/today/FirstDayTour";
import { ComingUp, Connections, Glance, GreetingDoodle, NeedsYou, OnWebsite, Recently, ThisMonth, needsSentence } from "@/components/admin/today/TodayParts";
import { COPY } from "@/lib/admin/copy";
import { firstNameOf, formatStaffDate, greetingFor } from "@/lib/admin/format";
import { requireStaff } from "@/lib/server/auth/session";
import { listActivity } from "@/lib/server/dal/activity";
import { getDashboard } from "@/lib/server/dal/dashboard";
import { getToday } from "@/lib/server/dal/today";
import { tourPending } from "@/lib/server/dal/tour";
import { finishTour, publishDueNow } from "./actions";

// Today (admin-ux §6.2, §5.4; PLAN D83, D110, D125): the greeting with a sentence of what needs the
// person, their quick actions, Needs you (urgency then age), Coming up, At a glance chips, This month
// (each currency on its own line), On the website, Recently and, for super admins, connection
// notices. The order follows the role (§5.4). Due scheduled posts publish from a client effect.

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const v = await requireStaff("dashboard.view");
  await connection();
  const [today, dashboard, activity, showTour] = await Promise.all([getToday(), getDashboard(), listActivity({ limit: 5 }), tourPending()]);
  const now = today.at;
  const roles = v.roles;
  const viewerOnly = roles.length === 1 && roles[0] === "viewer";
  const isCounsellorOnly = roles.length === 1 && roles[0] === "counsellor";
  const leadMoney = roles.includes("finance_officer") && !roles.includes("super_admin");
  const leadWebsite = roles.includes("content_manager") && !roles.includes("super_admin");
  const dateLine = formatStaffDate(now, v.timezone, "long").replace(/ at .*$/, "").replace(/ \d{4}$/, "");

  const needs = !viewerOnly ? <NeedsYou items={today.needsYou.items} total={today.needsYou.total} now={now} inboxHref="/admin/inbox" /> : null;
  const coming = today.comingUp ? <ComingUp items={today.comingUp} tz={v.timezone} /> : null;
  const month = <ThisMonth m={today.thisMonth} />;
  const web = today.website ? <OnWebsite w={today.website} now={now} /> : null;

  return (
    <>
      {today.website && today.website.scheduled ? <DuePosts action={publishDueNow} /> : null}
      {showTour ? <FirstDayTour onDone={finishTour} /> : null}
      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-script text-[34px] font-bold leading-[1.05] text-forest md:text-[44px]">
            {greetingFor(now, v.timezone)}, {firstNameOf(v.displayName)}
          </h1>
          <p className="mt-2 text-[16px] font-semibold text-body md:text-[18px]">
            {dateLine} · {viewerOnly ? COPY["access.viewerToday"] : needsSentence(today.needsYou.total)}
          </p>
        </div>
        <GreetingDoodle />
      </header>

      {!viewerOnly ? <QuickRow className="mb-8" /> : null}

      <div className="grid min-w-0 grid-cols-1 gap-6">
        {leadMoney ? month : null}
        {leadWebsite ? web : null}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {isCounsellorOnly ? (
            <>
              {coming}
              {needs}
            </>
          ) : (
            <>
              {needs ?? <div />}
              <div className="grid min-w-0 grid-cols-1 gap-6">
                {coming}
                <Connections items={today.connections} />
              </div>
            </>
          )}
        </div>
        <Glance tiles={dashboard.tiles} />
        {leadMoney ? null : month}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {leadWebsite ? null : web}
          <Recently items={activity.items} now={now} />
        </div>
      </div>
    </>
  );
}
