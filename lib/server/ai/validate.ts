import "server-only";

// The draft validator (integrations §5.7): SafetyCheck flags for anything the facts don't support.
// Hard flags block "Put live" until a person ticks "I've checked this". Heuristics only: a person
// always reviews every AI draft before it can go live.

import type { AiPostDraft } from "./schemas";
import type { Flag } from "./types";
import { numbersIn, type FactSheet } from "./facts";

const SPELLED = /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/i;
const DIAGNOSIS = /\b(diagnos\w*|disorder|depression|depressed|hiv|aids|trauma(tised|tized)?|ptsd|cancer|malaria|tuberculosis|disabilit\w*|guarantee\w*|100\s?%)\b/i;
const CONTACT = /([^\s@]+@[^\s@]+\.[a-z]{2,})|(\+?\d[\d\s-]{7,}\d)|\bHVN-[A-Z0-9-]{4,}\b/i;
const CHILD_WORDS = /\b(girl|boy|child|son|daughter|aged|orphan|pupil|student)\b/i;
const MONTHS = new Set(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
const DAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const COMMON = new Set(["The", "This", "That", "These", "Those", "We", "Our", "Your", "You", "It", "In", "At", "On", "For", "With", "And", "But", "A", "An", "Thank", "Thanks", "Together", "Every", "Each", "Many", "Some", "When", "As", "From", "By", "Through", "Read", "Give", "Donate", "Please", "Here", "With", "If", "After", "Before", "During", "Across", "Over", "More", "Most", "Families", "Children", "Haven", "I", "Help", "Support"]);

function textOf(b: AiPostDraft["body"][number]): string {
  if (b.type === "paragraph" || b.type === "heading") return b.text;
  if (b.type === "list") return b.items.join(". ");
  return "";
}

/** Numbers the facts allow (normalised), plus the period's year. */
function allowedNumbers(sheet: FactSheet): Set<string> {
  const out = new Set<string>([String(new Date(sheet.period.from).getUTCFullYear())]);
  for (const f of sheet.facts) {
    for (const n of f.numbers) out.add(n);
    if (f.date) for (const n of numbersIn(f.date)) out.add(n);
  }
  return out;
}

function capitalisedRuns(text: string): Array<{ words: string; index: number }> {
  const out: Array<{ words: string; index: number }> = [];
  const re = /\b([A-Z][a-z’'-]+(?:\s+[A-Z][a-z’'-]+)*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ words: m[1], index: m.index });
  return out;
}

/** SafetyCheck flags for a draft against its fact sheet. */
export function validateDraft(draft: AiPostDraft, sheet: FactSheet): Flag[] {
  const flags: Flag[] = [];
  const nums = allowedNumbers(sheet);
  const names = new Set(sheet.allowedNames.flatMap((n) => [n, ...n.split(/\s+/)]));
  const places = new Set(sheet.allowedPlaces.flatMap((p) => [p, ...p.split(/\s+/)]));
  const factIds = new Set(sheet.facts.map((f) => f.id));
  const cited = new Set(draft.citations.map((c) => c.block));
  let n = 0;
  const flag = (f: Omit<Flag, "id">) => flags.push({ ...f, id: `v${n++}` });

  const texts: Array<{ blockId?: string; text: string; index: number }> = [
    { text: draft.title, index: -1 },
    { text: draft.excerpt, index: -1 },
    ...draft.body.map((b, i) => ({ blockId: `b${i}`, text: textOf(b), index: i })),
  ];

  for (const t of texts) {
    if (!t.text) continue;
    for (const num of numbersIn(t.text)) {
      if (!nums.has(num) && !(Number(num) <= 10 && /^\d+$/.test(num))) flag({ severity: "hard", blockId: t.blockId, text: `The number ${num} isn't in the facts. Check it or remove it.`, rule: "number" });
    }
    if (SPELLED.test(t.text)) flag({ severity: "hard", blockId: t.blockId, text: `“${SPELLED.exec(t.text)![0]}” is a number written in words: use digits from the facts.`, rule: "spelled_number" });
    if (DIAGNOSIS.test(t.text)) flag({ severity: "hard", blockId: t.blockId, text: `“${DIAGNOSIS.exec(t.text)![0]}”: no diagnoses, guarantees or promises.`, rule: "diagnosis" });
    if (CONTACT.test(t.text)) flag({ severity: "hard", blockId: t.blockId, text: "Contact details or a case reference: remove them.", rule: "contact" });
    for (const run of capitalisedRuns(t.text)) {
      const words = run.words.split(/\s+/);
      if (words.every((w) => COMMON.has(w) || MONTHS.has(w) || DAYS.has(w) || names.has(w) || places.has(w))) continue;
      if (names.has(run.words) || places.has(run.words)) continue;
      // The first word of a sentence is capitalised anyway.
      const before = t.text.slice(Math.max(0, run.index - 2), run.index);
      if (words.length === 1 && (run.index === 0 || /[.!?:]\s$/.test(before))) continue;
      const near = t.text.slice(Math.max(0, run.index - 60), run.index + run.words.length + 60);
      const placeLike = /\b(in|from|at)\s+$/.test(t.text.slice(Math.max(0, run.index - 6), run.index));
      const hard = CHILD_WORDS.test(near) || placeLike;
      flag({ severity: hard ? "hard" : "soft", blockId: t.blockId, text: `“${run.words}” isn't a name or place from the facts. ${hard ? "It may identify someone or a small place." : "Check it."}`, rule: placeLike ? "place" : "name" });
    }
  }

  draft.body.forEach((b, i) => {
    if (b.type === "stat" && !sheet.verifiedStatIds.includes(b.statId)) flag({ severity: "hard", blockId: `b${i}`, text: "This figure isn't a verified impact number; it will be removed.", rule: "stat" });
    if ((b.type === "paragraph" || b.type === "list") && !cited.has(i)) flag({ severity: "soft", blockId: `b${i}`, text: "No fact is cited for this part. Check where it comes from.", rule: "citation" });
  });
  for (const c of draft.citations) {
    const unknown = c.facts.filter((f) => !factIds.has(f));
    if (unknown.length) flag({ severity: "soft", blockId: `b${c.block}`, text: `Cites facts that don't exist (${unknown.join(", ")}).`, rule: "citation" });
  }
  return flags;
}
