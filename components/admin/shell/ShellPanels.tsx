"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowRight, CircleHelp, Lock, Search, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/admin/auth/SignOutButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Sheet } from "@/components/ui/Sheet";
import { COPY } from "@/lib/admin/copy";
import { PLACE_DESCRIPTION, type Place } from "@/lib/admin/access";
import { relativeTime } from "@/lib/admin/format";
import { adminHrefOfRef, kindOfRef, normaliseRef } from "@/lib/model/refs";
import type { NotificationDTO } from "@/lib/server/dal/notifications";
import { cn } from "@/lib/cn";
import { PlaceIcon } from "./PlaceIcon";
import { useShell, type QuickAction } from "./ShellContext";
import { openGlobalSheet } from "./SheetHost";
import { usePlaceBadge } from "./TopBar";

/* ── Places (phone dock) ─────────────────────────────────────────────── */

function PlaceTile({ place, onPick }: { place: Place; onPick: () => void }) {
  const badge = usePlaceBadge(place);
  return (
    <li>
      <Link
        href={place.href}
        onClick={onPick}
        className="flex min-h-[88px] flex-col justify-between gap-3 rounded-control bg-white p-4 shadow-soft transition-transform duration-200 active:scale-[0.98]"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="grid size-10 place-items-center rounded-full bg-mint text-forest">
            <PlaceIcon name={place.icon} className="size-5" />
          </span>
          {badge ? (
            <span
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full px-2 font-grotesk text-[12px] font-semibold tabular-nums",
                badge.lock ? "bg-deep text-white" : "bg-marigold text-night",
              )}
            >
              {badge.lock ? <Lock aria-hidden className="size-3" strokeWidth={3} /> : null}
              {badge.count}
              <span className="sr-only">{badge.lock ? " new concerns" : " new"}</span>
            </span>
          ) : null}
        </span>
        <span className="text-[15px] font-extrabold text-ink">{place.label}</span>
      </Link>
    </li>
  );
}

export function PlacesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { places, signOutAction } = useShell();
  const all = [...places.pill, ...places.more];
  return (
    <Sheet open={open} onClose={onClose} title={COPY["shell.places"]} side="auto" size="sm">
      <ul className="grid grid-cols-2 gap-3">
        {all.map((p) => (
          <PlaceTile key={p.area} place={p} onPick={onClose} />
        ))}
      </ul>
      <ul className="mt-6 grid gap-1 border-t border-line pt-4">
        <li>
          <Link href="/admin/me" onClick={onClose} className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-bold text-ink hover:bg-white">
            <UserRound aria-hidden className="size-[18px] text-forest" strokeWidth={2.25} /> {COPY["shell.me"]}
          </Link>
        </li>
        <li>
          <Link href="/admin/help" onClick={onClose} className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-bold text-ink hover:bg-white">
            <CircleHelp aria-hidden className="size-[18px] text-forest" strokeWidth={2.25} /> {COPY["shell.help"]}
          </Link>
        </li>
        <li>
          <SignOutButton action={signOutAction} label={COPY["shell.signOut"]} />
        </li>
      </ul>
    </Sheet>
  );
}

/* ── Quick actions (＋ New) ─────────────────────────────────────────── */

export function QuickActionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { quickActions } = useShell();
  const router = useRouter();
  const start = (a: QuickAction) => {
    onClose();
    openGlobalSheet(router, a.id);
  };
  return (
    <Sheet open={open} onClose={onClose} title={COPY["shell.newTitle"]} side="auto" size="sm">
      <ul className="grid grid-cols-2 gap-3">
        {quickActions.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => start(a)}
              className="flex min-h-[96px] w-full flex-col items-start justify-between gap-3 rounded-control bg-white p-4 text-left shadow-soft transition-transform duration-200 hover:shadow-card-hover active:scale-[0.98]"
            >
              <span className="grid size-10 place-items-center rounded-full bg-marigold-100 text-umber">
                <PlaceIcon name={a.icon} className="size-5" />
              </span>
              <span className="text-[15px] font-extrabold leading-snug text-ink">{a.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/* ── Find (Ctrl/Cmd+K) ───────────────────────────────────────────────── */

type FindResult = { key: string; group: "Records" | "Do" | "Go to"; label: string; hint?: string; run: () => void };
type SearchHit = { ref: string; title: string; who?: string; href: string; restricted: boolean };

/**
 * Find (admin-ux §3.5), first version: a typed reference ("sr 2026 1", "HVN-K7Q2-M9XD") opens that
 * record; words match your places and quick actions. A1 replaces it with the full cmdk palette
 * (people, website slots, help) backed by /api/admin/search. The server always decides whether a
 * record may be opened: a reference you may not open shows the friendly NoAccess page.
 */
export function FindDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { places, quickActions } = useShell();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const inputId = useId();

  // showModal() focuses the first control (the close button); Find should start in the search box.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => (document.getElementById(inputId) as HTMLInputElement | null)?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, inputId]);

  // Records from the server (names, emails, phone tails, references), 250 ms after typing pauses.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: controller.signal, headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((body: { hits?: SearchHit[] }) => setHits(Array.isArray(body.hits) ? body.hits : []))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  const results = useMemo<FindResult[]>(() => {
    const query = q.trim().toLowerCase();
    const out: FindResult[] = [];
    const ref = query ? normaliseRef(query) : null;
    // Server hits only count for the text they were fetched for (a short query shows none).
    for (const h of query.length >= 2 ? hits : []) {
      out.push({
        key: `rec:${h.ref}`,
        group: "Records",
        label: h.who ? `${h.who} · ${h.ref}` : h.ref,
        hint: h.title,
        run: () => router.push(h.href),
      });
    }
    if (ref && !hits.some((h) => h.ref === ref)) {
      const restricted = kindOfRef(ref) === "concern";
      out.push({
        key: `ref:${ref}`,
        group: "Records",
        label: ref,
        hint: restricted ? "Safeguarding concern" : "Open this record",
        run: () => router.push(adminHrefOfRef(ref)),
      });
    }
    for (const a of quickActions) {
      if (!query || a.label.toLowerCase().includes(query)) out.push({ key: `do:${a.id}`, group: "Do", label: a.label, run: () => openGlobalSheet(router, a.id) });
    }
    for (const p of [...places.pill, ...places.more]) {
      const text = `${p.label} ${PLACE_DESCRIPTION[p.area]}`.toLowerCase();
      if (!query || text.includes(query)) out.push({ key: `go:${p.area}`, group: "Go to", label: p.label, hint: PLACE_DESCRIPTION[p.area], run: () => router.push(p.href) });
    }
    return out.slice(0, 14);
  }, [q, hits, places, quickActions, router]);

  const close = () => {
    setQ("");
    setHits([]);
    onClose();
  };
  const pick = (r: FindResult) => {
    close();
    r.run();
  };

  return (
    <Modal open={open} onClose={close} title={COPY["shell.find"]} size="md">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (results[0]) pick(results[0]);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {COPY["shell.findPlaceholder"]}
        </label>
        <div className="flex h-[52px] items-center gap-3 rounded-full border-[1.5px] border-edge bg-white px-5 focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/15">
          <Search aria-hidden className="size-5 shrink-0 text-body" strokeWidth={2.25} />
          <input
            id={inputId}
            type="search"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={COPY["shell.findPlaceholder"]}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-body/80 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
      </form>
      {results.length ? (
        <div className="mt-5 grid gap-4">
          {(["Records", "Do", "Go to"] as const).map((group) => {
            const items = results.filter((r) => r.group === group);
            if (!items.length) return null;
            return (
              <section key={group} aria-label={group}>
                <h3 className="px-1 font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-body">{group}</h3>
                <ul className="mt-1.5 grid gap-1">
                  {items.map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        onClick={() => pick(r)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-cream focus-visible:bg-cream"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold text-ink">{r.label}</span>
                          {r.hint ? <span className="block truncate text-[13px] text-body">{r.hint}</span> : null}
                        </span>
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-forest" strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 text-[15px] text-body">Nothing matches “{q.trim()}”. Try a name, an email, the last digits of a phone number, a reference such as HVN-SR-2026-0001, or the name of a place.</p>
      )}
    </Modal>
  );
}

/* ── Updates (the bell) ───────────────────────────────────────────────── */

export function UpdatesSheet({ open, onClose, updates, now }: { open: boolean; onClose: () => void; updates: NotificationDTO[]; now: number }) {
  return (
    <Sheet open={open} onClose={onClose} title={COPY["shell.updates"]} side="auto" size="sm">
      {updates.length ? (
        <ul className="grid gap-2">
          {updates.map((u) => (
            <li key={u.id}>
              <Link
                href={u.href}
                onClick={onClose}
                className={cn(
                  "flex items-start gap-3 rounded-control bg-white p-4 shadow-soft transition-colors hover:bg-cream-2",
                  u.priority === "urgent" && "ring-1 ring-coral-800/30",
                )}
              >
                <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", u.read ? "bg-transparent" : "bg-marigold")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] leading-snug text-ink", u.read ? "font-semibold" : "font-extrabold")}>{u.title}</span>
                  <span className="mt-1 block font-grotesk text-[13px] text-body">
                    {now ? relativeTime(u.createdAt, now) : null}
                    {u.read ? null : <span className="sr-only"> · unread</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState art="plane" compact title="You're all caught up" body="When something needs you, it shows up here." />
      )}
    </Sheet>
  );
}
