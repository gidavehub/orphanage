"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, SearchX } from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { Chips } from "@/components/ui/form/Chips";
import { SearchField } from "@/components/ui/SearchField";
import { cn } from "@/lib/cn";

export type FaqExplorerItem = {
  id: string;
  q: string;
  /** The answer as plain text, for searching. */
  plain: string;
  /** The answer rendered on the server (InlineText with links). */
  answer: React.ReactNode;
};

export type FaqExplorerGroup = { id: string; label: string; items: FaqExplorerItem[] };

const ALL = "all";

/** Lower-case, accents and punctuation folded, so "safeguarding" finds "Safeguarding," and "cafe" finds "café". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The /faq explorer (public-pages §3.20; PLAN D49): group pills (Getting support · Safeguarding &
 * privacy · Donations · Volunteering & partnerships · About Haven) and a search over questions and
 * answers, both on the client. Each group is an accordion under its own <h2>. Under "All" a question
 * shows once, in the first group it belongs to; a pill shows every question placed in that group.
 * The pill follows the URL hash (#donations…) so a group can be shared.
 */
export function FaqExplorer({ groups, contactHref, emptyText }: { groups: FaqExplorerGroup[]; contactHref: string; emptyText: string }) {
  const [group, setGroup] = useState<string>(ALL);
  const [q, setQ] = useState("");

  // Open the group named in the hash (a shared link), and follow later hash changes.
  useEffect(() => {
    const read = () => {
      const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (groups.some((g) => g.id === h)) setGroup(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [groups]);

  const choose = (id: string) => {
    setGroup(id);
    const url = id === ALL ? window.location.pathname + window.location.search : `#${id}`;
    window.history.replaceState(window.history.state, "", url);
  };

  const shown = useMemo(() => {
    const words = fold(q).split(" ").filter(Boolean);
    const seen = new Set<string>();
    return groups
      .filter((g) => group === ALL || g.id === group)
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          if (group === ALL) {
            if (seen.has(it.id)) return false;
            seen.add(it.id);
          }
          if (!words.length) return true;
          const hay = fold(`${it.q} ${it.plain}`);
          return words.every((w) => hay.includes(w));
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, group, q]);

  const total = shown.reduce((n, g) => n + g.items.length, 0);
  const query = q.trim();
  const askHref = query ? `${contactHref}${contactHref.includes("?") ? "&" : "?"}subject=${encodeURIComponent(query.slice(0, 120))}` : contactHref;

  return (
    <div>
      <div className="mx-auto max-w-[860px]">
        <SearchField label="Search the questions" placeholder="Search, e.g. receipt, anonymous, volunteer" size="lg" onSearch={setQ} debounce={150} />
        <div className="mt-6">
          <Chips
            label="Show questions about"
            tone="clay"
            align="center"
            scroll
            value={group}
            onChange={(v) => choose(v || ALL)}
            options={[{ value: ALL, label: "All questions" }, ...groups.map((g) => ({ value: g.id, label: g.label, count: g.items.length }))]}
          />
        </div>
        <p aria-live="polite" className="sr-only">
          {query ? `${total} ${total === 1 ? "answer" : "answers"} for ${query}` : `${total} questions shown`}
        </p>
      </div>

      {total === 0 ? (
        <div role="status" className="mx-auto mt-14 max-w-[620px] rounded-card-lg bg-white px-6 py-12 text-center shadow-soft md:px-12">
          <span aria-hidden className="mx-auto grid size-16 place-items-center rounded-full bg-sand text-umber">
            <SearchX className="size-7" strokeWidth={2.25} />
          </span>
          <p className="mt-5 text-[22px] font-extrabold leading-snug text-ink">No answers match &lsquo;{query}&rsquo;.</p>
          <p className="mx-auto mt-2 max-w-[420px] text-[16px] leading-relaxed text-body">{emptyText}</p>
          <Link
            href={askHref}
            className="group mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-7 text-[15px] font-bold text-white transition-colors duration-300 hover:bg-marigold hover:text-night"
          >
            Ask us
            <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:rotate-45" strokeWidth={2.5} />
          </Link>
        </div>
      ) : (
        <div className="mx-auto mt-12 grid max-w-[980px] gap-14 md:mt-16 md:gap-16">
          {shown.map((g, gi) => (
            <section key={g.id} aria-labelledby={`faq-group-${g.id}`} className={cn("scroll-mt-28", gi > 0 && "border-t border-line pt-12 md:pt-14")}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`faq-group-${g.id}`} className="text-[26px] font-extrabold leading-tight text-ink md:text-[32px]">
                  {g.label}
                </h2>
                <span className="shrink-0 font-grotesk text-[13px] font-semibold text-body">
                  {g.items.length} {g.items.length === 1 ? "question" : "questions"}
                </span>
              </div>
              <Accordion
                key={`${group}-${query}`}
                className="mt-6"
                headingLevel={3}
                defaultOpen={query && g.items[0] ? [g.items[0].id] : []}
                items={g.items.map((it) => ({ id: it.id, title: it.q, content: it.answer }))}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
