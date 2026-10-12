import "server-only";

// Search tokens for staff Find (data-model §8.5). Built on write and stored as `searchTokens`:
// - the reference, and the reference without the "HVN-" prefix;
// - the lowercase email, and the part before the "@";
// - each lowercase name word of at least 2 characters (accents folded);
// - the last 6 digits of a phone number.
// At most 20 tokens. Never tokenise sealed or narrative text. Concerns store [reference] only.

export const MAX_SEARCH_TOKENS = 20;

export type SearchTokenInput = {
  reference?: string | null;
  email?: string | null;
  /** Person or organisation names (full names are split into words). */
  names?: Array<string | null | undefined>;
  phone?: string | null;
  /** Extra exact tokens (e.g. a receipt number), lowercased as given. */
  extra?: Array<string | null | undefined>;
};

/** Lowercase, NFC, accents folded, letters and digits only. */
function foldWord(word: string): string {
  return word
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function nameWords(name: string): string[] {
  return name
    .split(/[\s,.'’()/-]+/)
    .map(foldWord)
    .filter((w) => w.length >= 2);
}

function phoneTail(phone: string): string | null {
  const digits = phone.replace(/\D+/g, "");
  return digits.length >= 6 ? digits.slice(-6) : null;
}

/** The stored token list for a record. */
export function buildSearchTokens(input: SearchTokenInput): string[] {
  const out: string[] = [];
  const add = (t: string | null | undefined) => {
    if (!t) return;
    const v = t.trim().toLowerCase();
    if (v && !out.includes(v)) out.push(v);
  };
  if (input.reference) {
    add(input.reference);
    add(input.reference.replace(/^hvn-/i, ""));
  }
  if (input.email) {
    const e = input.email.trim().toLowerCase();
    add(e);
    const local = e.split("@")[0];
    if (local && local.length >= 2) add(local);
  }
  for (const name of input.names ?? []) if (name) for (const w of nameWords(name)) add(w);
  if (input.phone) add(phoneTail(input.phone));
  for (const x of input.extra ?? []) add(x);
  return out.slice(0, MAX_SEARCH_TOKENS);
}

/**
 * The tokens to look up for what staff typed in Find (each is matched with `array-contains`; callers
 * usually take the first, most specific one). References are normalised by the caller first.
 */
export function queryTokens(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: string[] = [];
  if (q.includes("@")) out.push(q);
  const digits = q.replace(/\D+/g, "");
  if (digits.length >= 6 && /^[\d\s+()-]+$/.test(q)) out.push(digits.slice(-6));
  for (const w of nameWords(q)) if (!out.includes(w)) out.push(w);
  return out.slice(0, 5);
}
