// Safety heuristics for public words about children and families (ToR §15; admin-ux §6.12
// "Things to check"; PLAN D55). Client-safe: the editors highlight flags as people type, and the
// server runs the same check before anything goes live. Heuristics flag for a person to check;
// for sponsorship profiles every flag blocks publishing.

import { countries } from "@/content/world";

export type SafetyFlagKind = "name" | "place" | "health";

export type SafetyFlag = {
  kind: SafetyFlagKind;
  /** The words that triggered it. */
  text: string;
  /** Character offset in the checked text. */
  index: number;
  /** One plain sentence: what to check. */
  message: string;
};

export const SAFETY_FLAG_LABEL: Record<SafetyFlagKind, string> = {
  name: "Possible name",
  place: "Place smaller than a country",
  health: "Health or medical detail",
};

const COUNTRY_WORDS = new Set(
  countries.flatMap((c) => [c.name.toLowerCase(), ...c.name.toLowerCase().split(/[\s,]+/)]).concat(["gambia", "the gambia", "africa", "west africa", "asia", "europe", "uk", "usa"]),
);

/** Capitalised words that are not names: sentence starters, calendar words, programmes, Haven words. */
const COMMON = new Set(
  (
    "a an the this that these those it its he she they we you i our your their his her him them my me us one each every some many most all both " +
    "there here when where while after before because since if but and or so then also however today now last next once " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december " +
    "ramadan eid christmas easter thanksgiving new year term " +
    "haven education medical counselling legal protection family community programme programmes school support sponsors sponsor sponsorship children child " +
    "fees uniform uniforms books meals food rent transport training course vocational secondary primary university college grade class year years age aged " +
    "mother father parent parents grandmother grandfather aunt uncle sister brother daughter son girl boy teenager baby infant orphan " +
    "usd gbp eur gmd english arabic french muslim christian thanks thank please dear god allah"
  ).split(/\s+/),
);

/** First names common where Haven works (West Africa, South and Southeast Asia, the Arab world). */
const FIRST_NAMES = new Set(
  (
    "awa fatou fatoumata mariama isatou aminata binta kaddy haddy jainaba ndey oumie rohey sainabou adama ebrima lamin modou ousman omar musa alieu momodou " +
    "bakary babucarr sulayman yusupha abdoulie pa ida nyima maimuna kumba hawa salimatu ibrahim ismaila kebba muhammed mohammed muhammad ahmed ahmad ali hassan " +
    "hussein fatima aisha amina khadija zainab maryam mariam leila layla noor nour yasmin rania hana salma omar khalid yusuf youssef karim tariq " +
    "priya ananya aarav arjun rohan rahul ravi sanjay amit anjali kavya diya ishaan vikram nisha pooja meera sita lakshmi raj " +
    "siti nur putri dewi agus budi rizal arif fauzi wati ayu " +
    "chinedu ngozi emeka chioma amara kwame kofi ama akosua abena yaw kojo nana tunde bola femi ade sade"
  ).split(/\s+/),
);

const HEALTH =
  /\b(diagnos\w*|disorders?|depress\w*|hiv|aids|trauma\w*|ptsd|adhd|autis\w*|epilep\w*|seizures?|cancer|tumou?rs?|leukaemia|leukemia|tuberculosis|malaria|sickle[- ]cell|asthma|diabet\w*|mental illness|psychiatric|disabilit\w*|disabled|surgery|operation|syndrome|hepatitis|malnourish\w*|anaemi\w*|anemi\w*|pregnan\w*|abuse[ds]?|assault\w*|rape[ds]?)\b/gi;

const isCountry = (phrase: string) => COUNTRY_WORDS.has(phrase.toLowerCase().replace(/^the\s+/, "")) || COUNTRY_WORDS.has(phrase.toLowerCase());

/** Every flag in `text`, in order of appearance (one per word). */
export function safetyFlags(text: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const seen = new Set<number>();
  const push = (f: SafetyFlag) => {
    if (seen.has(f.index)) return;
    seen.add(f.index);
    flags.push(f);
  };

  // Places: "in Serrekunda", "from Brikama Ba", "at Kanifing" that are not countries.
  for (const m of text.matchAll(/\b(?:in|from|at|near|outside|around|village of|town of|city of)\s+((?:the\s+)?[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})/gu)) {
    const phrase = m[1]!;
    if (isCountry(phrase) || COMMON.has(phrase.toLowerCase())) continue;
    const index = (m.index ?? 0) + m[0].indexOf(phrase);
    push({ kind: "place", text: phrase, index, message: `“${phrase}” looks like a town, village or area. Name the country only.` });
  }

  // Names: known first names anywhere; other capitalised words that are not at the start of a sentence.
  for (const m of text.matchAll(/\p{Lu}[\p{Ll}'-]+/gu)) {
    const word = m[0];
    const index = m.index ?? 0;
    const lower = word.toLowerCase();
    if (seen.has(index) || COMMON.has(lower) || isCountry(word)) continue;
    const before = text.slice(0, index).trimEnd();
    const sentenceStart = before === "" || /[.!?:;\n"“(]$/.test(before);
    if (FIRST_NAMES.has(lower) || !sentenceStart) {
      push({ kind: "name", text: word, index, message: `“${word}” may be a name. Profiles never name a child or family member.` });
    }
  }

  for (const m of text.matchAll(HEALTH)) {
    push({ kind: "health", text: m[0], index: m.index ?? 0, message: `“${m[0]}” is health or personal history. Describe the need, not the condition.` });
  }

  return flags.sort((a, b) => a.index - b.index);
}
