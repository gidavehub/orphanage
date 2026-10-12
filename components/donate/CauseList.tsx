"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Chips } from "@/components/ui/form/Chips";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { FlagDisc } from "@/components/ui/flag";
import { money } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { WidgetCause } from "./model";

const TONE_TEXT = { flame: "text-coral-800", forest: "text-forest", clay: "text-clay-700" } as const;
const TONE_FILL = { flame: "bg-coral-800", forest: "bg-forest", clay: "bg-clay" } as const;

/**
 * "Choose a Cause" on /donate (public-pages §4.5, `id="causes"`): every live programme, appeal,
 * sponsorship and project as a card linking to its own shareable page, with filter pills
 * (Programmes · each appeal season · Projects).
 */
export function CauseList({
  causes,
  groups,
  eyebrow,
  title,
  intro,
}: {
  causes: WidgetCause[];
  groups: Array<{ id: string; label: string }>;
  eyebrow?: string;
  title: string[];
  intro?: string;
}) {
  const list = causes.filter((c) => c.kind !== "general" && c.live);
  const options = [
    { value: "all", label: "All" },
    ...(list.some((c) => c.kind === "programme") ? [{ value: "programmes", label: "Programmes" }] : []),
    ...groups.filter((g) => list.some((c) => c.groupId === g.id)).map((g) => ({ value: g.id, label: g.label })),
    ...(list.some((c) => c.kind === "project") ? [{ value: "projects", label: "Projects" }] : []),
  ];
  const [filter, setFilter] = useState("all");
  const shown = list.filter((c) =>
    filter === "all" ? true : filter === "programmes" ? c.kind === "programme" : filter === "projects" ? c.kind === "project" : c.groupId === filter,
  );

  return (
    <section id="causes" aria-labelledby="causes-title" className="scroll-mt-28">
      {eyebrow ? <p className="font-script text-[22px] font-bold leading-none text-marigold-ink md:text-[24px]">{eyebrow}</p> : null}
      <h2 id="causes-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[34px]">
        {title.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </h2>
      {intro ? <p className="mt-3 max-w-[560px] text-[16px] leading-relaxed text-body">{intro}</p> : null}
      <Chips className="mt-6" label="Filter causes" tone="clay" size="sm" scroll value={filter} onChange={setFilter} options={options} />
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {shown.map((c) => {
          const pct = c.showFigures && c.goal > 0 ? (c.raised / c.goal) * 100 : null;
          return (
            <li key={c.slug} className="animate-[hero-rise_0.5s_var(--ease-out-expo)_both] motion-reduce:animate-none">
              <Link
                href={c.href}
                scroll={false}
                className="group flex h-full flex-col overflow-hidden rounded-card bg-white shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="relative block aspect-[16/9] overflow-hidden">
                  <Image
                    src={c.image.src}
                    alt=""
                    fill
                    sizes="(min-width:1280px) 340px, (min-width:768px) 40vw, 92vw"
                    placeholder={c.image.blurDataURL ? "blur" : "empty"}
                    blurDataURL={c.image.blurDataURL}
                    style={c.image.focal ? { objectPosition: `${c.image.focal.x}% ${c.image.focal.y}%` } : undefined}
                    className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-110 motion-reduce:transition-none"
                  />
                  {c.place ? (
                    <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 py-1 pl-1 pr-3 text-[13px] font-bold text-ink backdrop-blur">
                      <FlagDisc code={c.place.code} className="size-6" />
                      {c.place.name}
                    </span>
                  ) : null}
                  {c.image.illustrative ? <ImageCredit position="bottom-left" /> : null}
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className={cn("text-[12.5px] font-extrabold uppercase tracking-[0.08em]", TONE_TEXT[c.tone])}>{c.kind === "programme" ? "Programme" : c.season}</span>
                  <span className="mt-1 flex items-start justify-between gap-3">
                    <span className="text-[19px] font-bold leading-snug text-ink">{c.title}</span>
                    <ArrowUpRight aria-hidden className="mt-1 size-5 shrink-0 text-ink/40 transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                  </span>
                  <span className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-body">{c.summary}</span>
                  {pct !== null ? (
                    <span className="mt-auto block pt-4">
                      <span aria-hidden className="block h-[5px] overflow-hidden rounded-full bg-track">
                        <span className={cn("block h-full rounded-full", TONE_FILL[c.tone])} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
                      </span>
                      <span className="mt-2 flex justify-between gap-2 font-grotesk text-[13px] text-body">
                        <span>
                          <strong className="font-semibold text-ink">{money(c.raised, c.currency)}</strong> raised
                        </span>
                        <span>of {money(c.goal, c.currency)}</span>
                      </span>
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
