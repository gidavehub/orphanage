import "server-only";

// The fact sheet (integrations §5.5): the ONLY material the monthly writer sees. Public-safe sources
// through the public content readers: published posts of the period, verified stats, live causes,
// the month's editorial topics, programme titles and the countries Haven works in. Never support
// requests, concerns, appointments, donors, gifts, notes, staff or email (an ESLint rule on
// lib/server/ai/** enforces it).

import type { Millis, ProgrammeId } from "@/lib/model/enums";
import { PROGRAMME_LABEL } from "@/lib/model/labels";
import { getCauses, getCollection, getEditorialSettings, getProgrammes } from "@/lib/content/public";
import { countries as worldCountries } from "@/content/world";

export type Fact = {
  id: string;
  kind: "update" | "stat" | "cause" | "topic" | "programme" | "org";
  text: string;
  numbers: string[];
  source: string;
  date?: string;
};

export type FactSheet = {
  period: { key: string; label: string; from: Millis; to: Millis };
  facts: Fact[];
  allowedNames: string[];
  allowedPlaces: string[];
  voice: string;
  mustAvoid: string[];
  programmes: Array<{ id: ProgrammeId; title: string }>;
  verifiedStatIds: string[];
  liveCauses: string[];
  /** How much real material there is (updates + topics + stat changes). */
  substance: number;
};

const NUMBER = /\d[\d,.]*/g;

export function numbersIn(text: string): string[] {
  return [...text.matchAll(NUMBER)].map((m) => m[0].replace(/[,.]$/, "").replace(/,/g, "")).filter(Boolean);
}

/** "2026-10" → its UTC bounds and "October 2026". */
export function periodOf(key: string): FactSheet["period"] {
  const [y, m] = key.split("-").map(Number);
  const from = Date.UTC(y, m - 1, 1);
  const to = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);
  return { key, label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(from), from, to };
}

function plain(text: string): string {
  return text.replace(/\*\*|__|\[(.*?)\]\((.*?)\)/g, "$1").replace(/\s+/g, " ").trim();
}

export async function buildFactSheet(periodKey: string): Promise<FactSheet> {
  const period = periodOf(periodKey);
  const [posts, stats, causes, programmes, editorial] = await Promise.all([
    getCollection("posts"),
    getCollection("stats"),
    getCauses({ liveOnly: true }).catch(() => []),
    getProgrammes().catch(() => []),
    getEditorialSettings(),
  ]);
  const facts: Fact[] = [];
  let n = 1;
  const add = (f: Omit<Fact, "id" | "numbers">) => facts.push({ ...f, id: `F${n++}`, numbers: numbersIn(f.text) });
  const allowedNames = new Set<string>(["Haven"]);
  const allowedPlaces = new Set<string>(worldCountries.map((c) => c.name));

  let updates = 0;
  for (const p of posts) {
    if (p.status !== "published" || !p.publishedAt || p.publishedAt < period.from || p.publishedAt >= period.to) continue;
    const paras = (p.body ?? []).filter((b): b is Extract<typeof b, { type: "paragraph" }> => b.type === "paragraph").map((b) => plain(b.text).slice(0, 600));
    add({ kind: "update", text: `${p.title}. ${plain(p.excerpt)} ${paras.join(" ")}`.slice(0, 1400), source: `post:${p.slug}`, date: new Date(p.publishedAt).toISOString().slice(0, 10) });
    if (p.author?.displayName) allowedNames.add(p.author.displayName);
    updates++;
  }

  const verifiedStatIds: string[] = [];
  for (const s of stats) {
    if (s.verification?.status !== "verified") continue;
    verifiedStatIds.push(s.id);
    const when = s.verification.verifiedAt ? new Date(s.verification.verifiedAt).toISOString().slice(0, 10) : "";
    add({ kind: "stat", text: `${s.label}: ${s.value}${s.suffix ?? ""}${s.asOf ? ` (counted ${s.asOf})` : ""}`, source: `stat:${s.id}`, date: when });
  }

  for (const c of causes) {
    allowedNames.add(c.title);
    const figures = c.showFigures && c.verified && c.goal ? ` Goal ${c.goal} ${c.currency ?? ""}, raised ${c.raised ?? 0}.` : "";
    add({ kind: "cause", text: `Cause: ${c.title}.${figures}`, source: `cause:${c.slug}` });
  }

  let topics = 0;
  for (const t of editorial.topics ?? []) {
    if (t.month !== periodKey && t.used) continue;
    add({ kind: "topic", text: `Topic to cover: ${t.topic}${t.notes ? `. ${t.notes}` : ""}`, source: `topic:${t.id}` });
    topics++;
  }

  for (const p of programmes) {
    allowedNames.add(p.title);
    add({ kind: "programme", text: `Programme: ${p.title}.`, source: `programme:${p.id}` });
  }
  add({ kind: "org", text: `Haven works with children and families in ${worldCountries.length} countries.`, source: "org" });

  return {
    period,
    facts,
    allowedNames: [...allowedNames],
    allowedPlaces: [...allowedPlaces],
    voice: editorial.voice ?? "",
    mustAvoid: editorial.mustAvoid ?? [],
    programmes: programmes.map((p) => ({ id: p.id as ProgrammeId, title: p.title || PROGRAMME_LABEL[p.id as ProgrammeId] })),
    verifiedStatIds,
    liveCauses: causes.map((c) => c.slug),
    substance: updates + topics,
  };
}

/** One line per fact for the prompt: `F12 [stat, 2026-10-03] Children supported: 1214`. */
export function factLines(sheet: FactSheet): string {
  return sheet.facts.map((f) => `${f.id} [${f.kind}${f.date ? `, ${f.date}` : ""}] ${f.text}`).join("\n");
}
