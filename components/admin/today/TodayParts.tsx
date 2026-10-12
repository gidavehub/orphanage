import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Globe2, Lock, PenLine, PlugZap, Sparkles, Video } from "lucide-react";
import { HandsLineArt } from "@/components/art/Hands";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatStaffDate, relativeTime } from "@/lib/admin/format";
import type { ActivityItem, InboxItem } from "@/lib/model/dto";
import { adminHrefOfRef } from "@/lib/model/refs";
import type { ComingUpItem, TodayDTO } from "@/lib/server/dal/today";
import { cn } from "@/lib/cn";

// Today's cards (admin-ux §6.2). Server components: they only render what the DAL already filtered.

const NUMBER_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** The subline under the greeting, built from how many things need the person. */
export function needsSentence(total: number): string {
  if (total === 0) return "Nothing needs you right now. Thank you for everything you do.";
  if (total === 1) return "One thing needs you today.";
  if (total < 10) return `${NUMBER_WORDS[total]} things need you today.`;
  return `${total} things need you. Let's start with the urgent ones.`;
}

export function Card({ title, icon, children, action, tone = "white", className, id }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; tone?: "white" | "deep" | "cream"; className?: string; id?: string }) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "min-w-0 rounded-[26px] p-5 shadow-soft sm:p-6",
        tone === "white" && "bg-white text-ink",
        tone === "deep" && "bg-deep text-white",
        tone === "cream" && "bg-cream text-ink",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-[18px] font-extrabold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function shortRef(ref: string): string {
  // "HVN-SR-2026-0142" → "SR-0142"; random concern refs stay whole.
  const m = /^HVN-([A-Z]{2})-\d{4}-(\d+)$/.exec(ref);
  return m ? `${m[1]}-${m[2]}` : ref;
}

export function NeedsYou({ items, total, now, inboxHref }: { items: InboxItem[]; total: number; now: number; inboxHref: string }) {
  return (
    <Card
      id="needs-title"
      title="Needs you"
      action={
        total > items.length ? (
          <Link href={inboxHref} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
            See all {total} <ArrowRight aria-hidden className="size-4" strokeWidth={2.5} />
          </Link>
        ) : null
      }
      className="p-0 sm:p-0"
    >
      {items.length ? (
        <ul className="-mt-1 overflow-hidden rounded-b-[26px]">
          {items.map((it) => {
            const href = adminHrefOfRef(it.ref, it.kind);
            const waiting = now - it.createdAt > 48 * 3_600_000 && it.status === "new" ? `Waiting ${Math.round((now - it.createdAt) / 86_400_000)} days` : relativeTime(it.createdAt, now);
            return (
              <ListRow
                key={it.ref}
                href={href}
                kind={it.kind}
                reference={shortRef(it.ref)}
                title={it.restricted ? `New concern · ${it.risk ? `risk ${it.risk}` : "risk not set yet"}` : it.title}
                meta={it.restricted ? relativeTime(it.createdAt, now) : `${it.who} · ${waiting}`}
                preview={it.restricted ? undefined : it.preview || undefined}
                country={it.restricted ? null : (it.country ?? null)}
                urgency={it.urgency === "normal" ? undefined : it.urgency}
                assignee={it.assignee ?? null}
                unread={it.unread}
                restricted={it.restricted}
                action={
                  <Link href={href} className="inline-flex h-10 items-center rounded-full bg-forest px-4 text-[14px] font-bold text-white transition-colors hover:bg-deep">
                    {it.restricted ? "Open" : (it.nextStep?.label ?? "Open")}
                  </Link>
                }
              />
            );
          })}
        </ul>
      ) : (
        <EmptyState compact art="plane" title="All caught up. Lovely." body="New requests will appear here the moment they arrive." headingLevel={3} className="px-5" />
      )}
    </Card>
  );
}

export function ComingUp({ items, tz }: { items: ComingUpItem[]; tz: string }) {
  return (
    <Card id="coming-title" title="Coming up" icon={<CalendarClock aria-hidden className="size-5 text-marigold-ink" strokeWidth={2.25} />}>
      {items.length ? (
        <ul className="grid gap-3">
          {items.map((c) => (
            <li key={`${c.kind}-${c.id}`} className="flex items-start gap-3 rounded-[18px] bg-cream px-4 py-3">
              <span className="w-14 shrink-0 pt-0.5 font-grotesk text-[14px] font-semibold tabular-nums text-umber">{formatStaffDate(c.at, tz, "time")}</span>
              <span className="min-w-0 flex-1">
                <Link href={c.href} className="block truncate text-[15px] font-bold text-ink hover:text-forest">
                  {c.title}
                </Link>
                <span className="block font-grotesk text-[13px] text-body">{c.detail}</span>
              </span>
              {c.action ? (
                <a
                  href={c.action.href}
                  {...(c.action.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-forest px-3.5 text-[13px] font-bold text-white hover:bg-deep"
                >
                  {c.action.label === "Join Zoom" ? <Video aria-hidden className="size-4" /> : null}
                  {c.action.label}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-body">Nothing booked for today or tomorrow.</p>
      )}
    </Card>
  );
}

export function Glance({ tiles }: { tiles: Array<{ id: string; label: string; count: number; href: string; restricted?: true }> }) {
  if (!tiles.length) return null;
  return (
    <section aria-labelledby="glance-title" className="min-w-0">
      <h2 id="glance-title" className="mb-3 text-[18px] font-extrabold text-ink">
        At a glance
      </h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {tiles.map((t) => (
          <li key={t.id} className="shrink-0">
            <Link
              href={t.href}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-bold shadow-chip transition-colors focus-forest",
                t.restricted ? "bg-deep text-white hover:bg-night" : t.count ? "bg-white text-ink hover:bg-mint" : "bg-white/70 text-body hover:bg-white",
              )}
            >
              <span className="font-grotesk tabular-nums">{t.count}</span> {t.label}
              {t.restricted ? <Lock aria-hidden className="size-3.5" strokeWidth={2.75} /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EarthCard({ tone, label, children, note }: { tone: "clay" | "marigold" | "cocoa" | "forest"; label: string; children: React.ReactNode; note: string }) {
  const tones = {
    clay: "bg-clay text-white",
    marigold: "bg-marigold text-night",
    cocoa: "bg-cocoa text-white",
    forest: "bg-forest text-white",
  } as const;
  return (
    <div className={cn("flex min-h-[150px] flex-col justify-between rounded-[22px] p-5", tones[tone])}>
      <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      <div className="mt-3 font-display leading-[0.95] tracking-[0.01em]">{children}</div>
      <p className="mt-2 font-grotesk text-[13px] font-semibold">{note}</p>
    </div>
  );
}

export function ThisMonth({ m }: { m: TodayDTO["thisMonth"] }) {
  const cards: React.ReactNode[] = [];
  if (m.gifts) {
    cards.push(
      <EarthCard key="gifts" tone="clay" label="Gifts" note={m.gifts.length ? `${m.gifts.reduce((a, g) => a + g.count, 0)} received` : "None received yet"}>
        {m.gifts.length ? (
          m.gifts.slice(0, 3).map((g) => (
            <span key={g.currency} className="block text-[30px] sm:text-[34px]">
              {formatMoney({ amountMinor: g.amountMinor, currency: g.currency })}
            </span>
          ))
        ) : (
          <span className="text-[40px]">0</span>
        )}
      </EarthCard>,
    );
  }
  if (m.requestsHandled !== null)
    cards.push(
      <EarthCard key="req" tone="marigold" label="Requests" note="handled">
        <span className="text-[44px]">{m.requestsHandled}</span>
      </EarthCard>,
    );
  if (m.sessionsHeld !== null)
    cards.push(
      <EarthCard key="ses" tone="cocoa" label="Sessions" note="held">
        <span className="text-[44px]">{m.sessionsHeld}</span>
      </EarthCard>,
    );
  if (m.volunteersActive !== null)
    cards.push(
      <EarthCard key="vol" tone="forest" label="Volunteers" note="newly active">
        <span className="text-[44px]">{m.volunteersActive}</span>
      </EarthCard>,
    );
  if (!cards.length) return null;
  return (
    <section aria-labelledby="month-title">
      <h2 id="month-title" className="mb-3 text-[18px] font-extrabold text-ink">
        This month at Haven
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards}</div>
    </section>
  );
}

export function OnWebsite({ w, now }: { w: NonNullable<TodayDTO["website"]>; now: number }) {
  const days = w.impactCheckedAt ? Math.floor((now - w.impactCheckedAt) / 86_400_000) : null;
  const rows: Array<{ icon: React.ReactNode; text: string; href: string; cta: string; warn?: boolean }> = [];
  if (w.aiReady) rows.push({ icon: <Sparkles className="size-4" />, text: w.aiReady === 1 ? "The monthly draft is ready to review" : `${w.aiReady} AI drafts are ready to review`, href: "/admin/posts/review", cta: "Review" });
  if (w.inReview - w.aiReady > 0) rows.push({ icon: <PenLine className="size-4" />, text: `${w.inReview - w.aiReady} post${w.inReview - w.aiReady === 1 ? "" : "s"} waiting for review`, href: "/admin/posts/review", cta: "Review" });
  if (w.changesNotLive) rows.push({ icon: <Globe2 className="size-4" />, text: `${w.changesNotLive} change${w.changesNotLive === 1 ? "" : "s"} not live yet`, href: "/admin/website", cta: "Review" });
  if (w.scheduled) rows.push({ icon: <CalendarClock className="size-4" />, text: `${w.scheduled} post${w.scheduled === 1 ? "" : "s"} scheduled`, href: "/admin/posts?tab=scheduled", cta: "See" });
  rows.push(
    days === null
      ? { icon: <CheckCircle2 className="size-4" />, text: "Impact numbers haven't been checked yet", href: "/admin/website/launch", cta: "Check them", warn: true }
      : { icon: <CheckCircle2 className="size-4" />, text: `Impact numbers checked ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}`, href: "/admin/website/launch", cta: "Check them", warn: days > 90 },
  );
  return (
    <Card id="web-title" title="On the website" icon={<Globe2 aria-hidden className="size-5 text-forest" strokeWidth={2.25} />}>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.text} className={cn("flex items-center gap-3 rounded-[16px] px-3 py-2.5", r.warn ? "bg-marigold-100" : "bg-cream")}>
            <span aria-hidden className="text-forest">
              {r.icon}
            </span>
            <span className="min-w-0 flex-1 text-[15px] text-ink">{r.text}</span>
            <Link href={r.href} className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-[14px] font-bold text-forest hover:bg-white">
              {r.cta}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Recently({ items, now }: { items: ActivityItem[]; now: number }) {
  return (
    <Card
      id="recent-title"
      title="Recently"
      action={
        <Link href="/admin/activity" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
          See all <ArrowRight aria-hidden className="size-4" strokeWidth={2.5} />
        </Link>
      }
    >
      {items.length ? (
        <ul className="grid gap-1">
          {items.map((a) => (
            <li key={a.id} className="flex min-h-12 items-center gap-3">
              {a.actor ? (
                <Avatar name={a.actor.name} uid={a.actor.uid} tone={a.actor.tone} size={28} />
              ) : (
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-pebble font-grotesk text-[11px] text-body">
                  H
                </span>
              )}
              <p className="min-w-0 flex-1 text-[15px] leading-snug text-ink">{a.sentence}</p>
              <span className="shrink-0 font-grotesk text-[13px] tabular-nums text-body">{relativeTime(a.at, now)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-body">No activity yet in your areas.</p>
      )}
    </Card>
  );
}

export function Connections({ items }: { items: TodayDTO["connections"] }) {
  if (!items.length) return null;
  return (
    <Card id="conn-title" title="Not connected yet" tone="cream" icon={<PlugZap aria-hidden className="size-5 text-clay" strokeWidth={2.25} />} action={<Link href="/admin/settings/connections" className="inline-flex min-h-11 items-center text-[14px] font-bold text-forest hover:underline">Connections</Link>}>
      <ul className="grid gap-2">
        {items.map((c) => (
          <li key={c.id} className="text-[15px] leading-snug">
            <span className="font-bold text-ink">{c.headline}</span> <span className="text-body">{c.meaning}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function GreetingDoodle() {
  return <HandsLineArt className="hidden h-[120px] w-[140px] shrink-0 text-forest lg:block" />;
}
