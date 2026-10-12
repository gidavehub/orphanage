import "server-only";

// Local account passwords (data-model §9.3, §9.5). scrypt N=16384, r=8, p=1, 16-byte salt, 64-byte key:
//   "scrypt$16384$8$1$<salt b64>$<key b64>"
// Verified in constant time; an unknown account still costs one scrypt run, so timing does not reveal
// which emails exist. Policy: 12–128 characters, not containing the email's local part or "haven",
// not a common password (a 200-entry denylist, also matched after stripping trailing digits and
// symbols, so "Password2026!" is refused). Firebase mode sets the same minimum in Identity Platform.

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

function scryptAsync(password: string, salt: Buffer, keyLen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFC"), salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** A fixed, valid hash used when the account is unknown (equal work either way). */
const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(SALT_LEN, 7).toString("base64")}$${Buffer.alloc(KEY_LEN, 9).toString("base64")}`;

/** Constant-time check. `stored` null/undefined → a dummy run, then false. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? DUMMY_HASH).split("$");
  const valid = parts.length === 6 && parts[0] === "scrypt";
  const [, nRaw, rRaw, pRaw, saltB64, keyB64] = valid ? parts : DUMMY_HASH.split("$");
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n < 1024 || n > 1 << 20) return false;
  const expected = Buffer.from(keyB64, "base64");
  const got = await scryptAsync(typeof password === "string" ? password : "", Buffer.from(saltB64, "base64"), expected.length || KEY_LEN, {
    N: n,
    r,
    p,
    maxmem: 128 * 1024 * 1024,
  });
  const same = got.length === expected.length && timingSafeEqual(got, expected);
  return Boolean(stored) && valid && same;
}

/** Common passwords (lowercase). Short ones also catch "<word><digits/symbols>" variants. */
const COMMON = new Set<string>([
  "123456", "123456789", "12345678", "1234567890", "12345", "1234567", "123123", "111111", "000000", "654321",
  "666666", "121212", "112233", "123321", "987654321", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "zaq12wsx", "qwerty",
  "qwerty123", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbnm", "zxcvbn", "qazwsx", "q1w2e3r4", "q1w2e3r4t5y6", "1234qwer",
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword", "pa55word", "passpass",
  "passwordpassword", "letmein", "letmein123", "welcome", "welcome1", "welcome123", "welcometohaven", "admin", "admin123", "administrator",
  "root", "toor", "login", "master", "masterkey", "secret", "secret123", "changeme", "changeme123", "default",
  "guest", "test", "test123", "testing", "testtest", "user", "username", "abc123", "abcd1234", "abcdef",
  "abcdefgh", "abcdefghijkl", "iloveyou", "iloveyou1", "iloveyou123", "loveyou", "lovely", "love", "lovelove", "princess",
  "sunshine", "shadow", "monkey", "dragon", "football", "baseball", "soccer", "basketball", "hockey", "superman",
  "batman", "spiderman", "pokemon", "starwars", "trustno1", "whatever", "freedom", "hello", "hello123", "helloworld",
  "computer", "internet", "michael", "jennifer", "jessica", "jordan", "jordan23", "charlie", "michelle", "daniel",
  "thomas", "hunter", "hunter2", "ranger", "buster", "tigger", "ginger", "pepper", "summer", "winter",
  "spring", "autumn", "flower", "cookie", "cheese", "chocolate", "banana", "orange", "purple", "silver",
  "golden", "diamond", "angel", "angels", "blessed", "blessing", "jesus", "jesus123", "godisgood", "allah",
  "bismillah", "alhamdulillah", "inshallah", "mashallah", "family", "familyfirst", "mother", "father", "children", "orphanage",
  "charity", "donation", "donate", "volunteer", "gambia", "thegambia", "banjul", "serrekunda", "africa", "senegal",
  "dakar", "lagos", "nigeria", "ghana", "accra", "london", "newyork", "america", "freetown", "monrovia",
  "january", "february", "december", "monday", "friday", "qwerty12345", "qwertyuiop123", "1qaz2wsx3edc", "asdfasdf", "asdf1234",
  "zxcv1234", "11111111", "00000000", "12341234", "123456123456", "123456789012", "0987654321", "9876543210", "aaaaaa", "aaaaaaaaaaaa",
  "letmeinplease", "mypassword", "mypassword123", "newpassword", "oldpassword", "yourpassword", "nopassword", "temp1234", "temporary", "access",
]);

/** Lowercase, then strip trailing digits and symbols ("Password2026!" → "password"). */
function baseWord(pw: string): string {
  return pw.toLowerCase().replace(/[\d\W_]+$/u, "");
}

/** A plain-English problem with the password, or null when it is acceptable. */
export function checkPasswordPolicy(password: string, ctx?: { email?: string | null; name?: string | null }): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) return `Please use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Please use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (lower.includes("haven")) return "Please choose a password that doesn't include the word Haven.";
  const local = ctx?.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && lower.includes(local)) return "Please choose a password that doesn't include your email address.";
  const firstName = ctx?.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 3 && lower.includes(firstName)) return "Please choose a password that doesn't include your name.";
  if (COMMON.has(lower) || COMMON.has(baseWord(password))) return "That password is too common. Please choose something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "Please don't use one character repeated.";
  return null;
}
