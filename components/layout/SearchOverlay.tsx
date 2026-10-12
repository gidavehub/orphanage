"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  CornerDownLeft,
  FileText,
  HandHeart,
  HeartHandshake,
  Newspaper,
  Quote,
  Search,
  Sprout,
  X,
  type LucideIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import type { SearchHit, SearchHitType } from "@/lib/content/search";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { SEARCH_SUGGESTIONS, SEARCH_TYPE_LABEL, SEARCH_TYPE_SINGULAR } from "@/lib/nav";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

/* ── Shared with /search ───────────────────────────────────────────────── */

const TYPE_ICON: Record<SearchHitType, LucideIcon> = {
  programme: HeartHandshake,
  page: FileText,
  cause: HandHeart,
  resource: BookOpen,
  news: Newspaper,
  story: Quote,
  project: Sprout,
  faq: CircleHelp,
};

export function SearchHitIcon({ type, className }: { type: SearchHitType; className?: string }) {
  const Icon = TYPE_ICON[type];
  return <Icon aria-hidden strokeWidth={2.25} className={className} />;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps the query's words in <mark> (word starts only, case-insensitive). */
export function Highlight({ text, q, markClassName }: { text: string; q: string; markClassName?: string }) {
  const words = [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2))].slice(0, 8);
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escapeRe).join("|")})`, "giu");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={markClassName}>
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/* ── The overlay ───────────────────────────────────────────────────────── */

type Group = { type: SearchHitType; hits: SearchHit[] };
type Result = { q: string; total: number; groups: Group[] };
type Status = "idle" | "loading" | "done" | "error";

const DEBOUNCE_MS = 200;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Chips({ onPick }: { onPick: () => void }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label="Popular searches">
      {SEARCH_SUGGESTIONS.map((s) => (
        <li key={s.href}>
          <Link
            href={s.href}
            onClick={onPick}
            className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white/90 transition-colors hover:border-marigold hover:bg-marigold hover:text-night"
          >
            {s.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Full-screen site search (public-pages §3.22, D115). Typing waits 200ms, then asks
 * `GET /api/search?q=` for the top 8 public hits, grouped by type, each with its type icon, title and
 * a snippet. Arrow keys move between the input and the results; Enter opens the full `/search?q=`
 * page. The suggestion chips are links. Esc or the close button closes it and focus returns to
 * whatever opened it; the query is cleared on close (a shared phone should not keep it). It sits
 * below QuickExit (z-75) so the exit stays reachable.
 */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const lenis = useLenis();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const resultsId = useId();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const query = q.replace(/\s+/g, " ").trim();
  const searchable = query.length >= 2;

  // Open: lock the page, focus the field once the panel has faded in. Close: restore focus.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    lenis?.stop();
    const t = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 120);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog.current) return;
      const f = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!dialog.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      lenis?.start();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, onClose, lenis]);

  // Clear everything when the overlay closes.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setQ("");
      setResult(null);
      setStatus("idle");
    }
  }

  // Debounced fetch of the top hits.
  useEffect(() => {
    if (!open || !searchable) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Result;
        setResult({ q: query, total: json.total, groups: json.groups });
        setStatus("done");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [open, query, searchable]);

  const shown = searchable ? result : null;
  const noResults = searchable && status === "done" && shown?.total === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    router.push(routes.search(query));
    onClose();
  };

  // Arrow keys: input ↓ first result; ↑/↓ between results; ↑ from the first goes back to the input.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = [...(dialog.current?.querySelectorAll<HTMLElement>("[data-search-result]") ?? [])];
    if (!links.length) return;
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (document.activeElement === input.current) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        links[0].focus();
      }
      return;
    }
    if (i < 0) return;
    e.preventDefault();
    if (e.key === "ArrowDown") links[Math.min(links.length - 1, i + 1)].focus();
    else if (i === 0) input.current?.focus();
    else links[i - 1].focus();
  };

  let row = 0;
  const announce = !searchable
    ? ""
    : status === "loading"
      ? "Searching…"
      : status === "error"
        ? "Search is not available right now."
        : shown
          ? shown.total === 0
            ? `Nothing found for ${shown.q}.`
            : `${shown.total} ${shown.total === 1 ? "result" : "results"}. Use the arrow keys to move through them.`
          : "";

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      inert={!open}
      onKeyDown={onKeyDown}
      className={cn(
        "fixed inset-0 z-[74] bg-deep/95 backdrop-blur-md transition-[opacity,visibility] duration-500",
        open ? "visible opacity-100" : "invisible opacity-0",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        className="absolute right-4 top-4 z-10 grid size-12 place-items-center rounded-full bg-marigold text-night transition-transform duration-500 hover:rotate-90 md:right-6 md:top-6 md:size-14"
      >
        <X aria-hidden strokeWidth={2.5} />
      </button>

      <div data-lenis-prevent className="h-full overflow-y-auto overscroll-contain">
        <div
          className={cn(
            "mx-auto w-full max-w-3xl px-5 pb-16 pt-24 transition-[opacity,transform] duration-700 ease-out-expo md:pt-[15vh]",
            open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
          )}
        >
          <form role="search" onSubmit={submit} action={routes.search()}>
            <p className="mb-4 text-center font-script text-3xl font-bold text-marigold md:text-4xl">What are you looking for?</p>
            <label htmlFor={`${resultsId}-q`} className="sr-only">
              Search the Haven website
            </label>
            <div className="flex items-center gap-3 border-b-2 border-white/30 pb-4 transition-colors focus-within:border-marigold md:gap-4">
              <Search aria-hidden className="size-7 shrink-0 text-marigold md:size-8" />
              <input
                ref={input}
                id={`${resultsId}-q`}
                name="q"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-controls={resultsId}
                aria-describedby={`${resultsId}-hint`}
                placeholder="Search the site…"
                maxLength={120}
                className="w-full min-w-0 bg-transparent text-2xl font-bold text-white placeholder:text-white/45 focus:outline-none md:text-4xl [&::-webkit-search-cancel-button]:appearance-none"
              />
              {status === "loading" ? <Spinner size={24} label="" className="shrink-0 text-marigold" /> : null}
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    input.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X aria-hidden className="size-5" strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
            <p id={`${resultsId}-hint`} className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-white/60">
              <CornerDownLeft aria-hidden className="size-3.5" /> Press Enter to see every result
            </p>
          </form>

          <p role="status" aria-live="polite" className="sr-only">
            {announce}
          </p>

          <div id={resultsId} className="mt-8">
            {!searchable || noResults || status === "error" ? (
              <div className="animate-[vt-rise-in_0.45s_var(--ease-out-expo)_both]">
                {noResults && shown ? (
                  <div className="mb-6 text-center">
                    <p className="text-[20px] font-extrabold text-white">Nothing found for “{shown.q}”.</p>
                    <p className="mt-2 text-[15px] text-white/70">
                      Try another word, or{" "}
                      <Link href={routes.contact()} onClick={onClose} className="font-bold text-marigold underline-offset-4 hover:underline">
                        contact us
                      </Link>{" "}
                      and we&apos;ll help.
                    </p>
                  </div>
                ) : status === "error" && searchable ? (
                  <p className="mb-6 text-center text-[15px] text-white/75">Search is not available right now. These pages may help:</p>
                ) : null}
                <Chips onPick={onClose} />
              </div>
            ) : shown ? (
              <div key={shown.q} className="grid gap-7">
                {shown.groups.map((g) => (
                  <section key={g.type} aria-labelledby={`${resultsId}-${g.type}`}>
                    <h2 id={`${resultsId}-${g.type}`} className="px-4 font-grotesk text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">
                      {SEARCH_TYPE_LABEL[g.type]}
                    </h2>
                    <ul className="mt-2 grid gap-1">
                      {g.hits.map((h) => {
                        const i = row++;
                        return (
                          <li
                            key={`${h.href}|${h.title}`}
                            className="animate-[vt-rise-in_0.45s_var(--ease-out-expo)_both]"
                            style={{ animationDelay: `${i * 40}ms` }}
                          >
                            <Link
                              href={h.href}
                              onClick={onClose}
                              data-search-result=""
                              className="group flex items-start gap-4 rounded-2xl px-4 py-3.5 transition-colors duration-300 hover:bg-white/[0.07] focus-visible:bg-white/[0.09]"
                            >
                              <span aria-hidden className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-marigold transition-colors group-hover:bg-marigold group-hover:text-night">
                                <SearchHitIcon type={h.type} className="size-[18px]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="sr-only">{SEARCH_TYPE_SINGULAR[h.type]}: </span>
                                <span className="block text-[17px] font-bold leading-snug text-white transition-colors group-hover:text-marigold">
                                  <Highlight text={h.title} q={shown.q} markClassName="bg-transparent text-marigold" />
                                </span>
                                {h.snippet ? (
                                  <span className="mt-1 line-clamp-2 block text-[14px] leading-relaxed text-white/70">
                                    <Highlight text={h.snippet} q={shown.q} markClassName="bg-transparent font-bold text-white" />
                                  </span>
                                ) : null}
                              </span>
                              <ArrowUpRight
                                aria-hidden
                                strokeWidth={2.5}
                                className="mt-2.5 size-4 shrink-0 text-marigold opacity-0 transition-[opacity,transform] duration-300 group-hover:rotate-45 group-hover:opacity-100 group-focus-visible:opacity-100"
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
                <div className="border-t border-white/10 pt-5 text-center">
                  <Link
                    href={routes.search(shown.q)}
                    onClick={onClose}
                    className="group inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-bold text-marigold transition-colors hover:bg-white/10"
                  >
                    See every result for “{shown.q}”
                    <ArrowRight aria-hidden strokeWidth={2.5} className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
