import "server-only";

// Field encryption for sensitive free text (data-model §11.2, PLAN §7.5).
// AES-256-GCM with a random 12-byte IV. The additional authenticated data (AAD) is the document path
// plus the field name, so ciphertext copied into another record or field fails to open.
// Sealed: concern reporter identity, safe follow-up, child location, narrative, authority details,
// risk rationale, escalation reference; concern action details; every note body; support
// explanations; story-submission contacts; media-consent notes; outbox vars beyond ref/name/links.
//
// Keys: HAVEN_DATA_KEY (32 bytes, base64) with id HAVEN_DATA_KEY_ID ("k1"), required in Firestore mode.
// Local mode auto-creates .data/keys/data.key (id "local"). HAVEN_DATA_KEYS_OLD ({"k0":"…"}) opens
// older ciphertext during rotation. Losing the key makes sealed fields unrecoverable.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Sealed } from "@/lib/model/enums";
import { env, resolveBackend } from "@/lib/server/env";

export type { Sealed } from "@/lib/model/enums";

/** Sealing is not possible here (Firestore mode without HAVEN_DATA_KEY, or no data backend). */
export class SealingUnavailableError extends Error {
  constructor(message = "Protected fields can't be saved yet: the data key is not configured.") {
    super(message);
    this.name = "SealingUnavailableError";
  }
}

/** The ciphertext does not open under this key, path and field (tampered, moved or wrong key). */
export class SealOpenError extends Error {
  constructor(message = "This protected field could not be opened.") {
    super(message);
    this.name = "SealOpenError";
  }
}

const LOCAL_KEY_ID = "local";
const KEY_BYTES = 32;
const IV_BYTES = 12;

type KeyRing = { currentId: string; keys: Map<string, Buffer> };

const G = globalThis as typeof globalThis & { __havenSealKeys?: { backend: string; ring: KeyRing } };

function decodeKey(b64: string, label: string): Buffer {
  const key = Buffer.from(b64.trim(), "base64");
  if (key.length !== KEY_BYTES) throw new SealingUnavailableError(`${label} must be ${KEY_BYTES} bytes, base64-encoded.`);
  return key;
}

function localKeyFile(): string {
  return path.join(process.cwd(), ".data", "keys", "data.key");
}

/** Reads (or, the first time, creates) the practice-mode key file. */
function localKey(create: boolean): Buffer | null {
  const file = localKeyFile();
  try {
    return decodeKey(fs.readFileSync(file, "utf8"), ".data/keys/data.key");
  } catch (err) {
    if ((err as { code?: string }).code !== "ENOENT") throw err;
  }
  if (!create) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, randomBytes(KEY_BYTES).toString("base64"), { flag: "wx", mode: 0o600 });
  } catch (err) {
    if ((err as { code?: string }).code !== "EEXIST") throw err;
  }
  return decodeKey(fs.readFileSync(file, "utf8"), ".data/keys/data.key");
}

function keyRing(): KeyRing {
  const backend = resolveBackend();
  const memo = G.__havenSealKeys;
  if (memo && memo.backend === backend) return memo.ring;
  if (backend === "unavailable") throw new SealingUnavailableError();

  const keys = new Map<string, Buffer>();
  for (const [id, b64] of Object.entries(env.dataKey.old)) keys.set(id, decodeKey(b64, `HAVEN_DATA_KEYS_OLD.${id}`));
  let currentId: string;
  if (env.dataKey.key) {
    currentId = env.dataKey.id;
    keys.set(currentId, decodeKey(env.dataKey.key, "HAVEN_DATA_KEY"));
    if (backend === "local") {
      const existing = localKey(false);
      if (existing && !keys.has(LOCAL_KEY_ID)) keys.set(LOCAL_KEY_ID, existing);
    }
  } else if (backend === "local") {
    currentId = LOCAL_KEY_ID;
    keys.set(LOCAL_KEY_ID, localKey(true)!);
  } else {
    throw new SealingUnavailableError();
  }
  const ring = { currentId, keys };
  G.__havenSealKeys = { backend, ring };
  return ring;
}

/** True when fields can be sealed and opened in this process. Never throws. */
export function sealingAvailable(): boolean {
  try {
    keyRing();
    return true;
  } catch {
    return false;
  }
}

/** The AAD for a field of a document: "supportRequests/HVN-SR-2026-0001#explanation". */
export function sealAad(docPath: string, field: string): string {
  return `${docPath}#${field}`;
}

export function isSealed(value: unknown): value is Sealed {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.$sealed === 1 && typeof v.kid === "string" && typeof v.iv === "string" && typeof v.tag === "string" && typeof v.ct === "string";
}

/** Encrypts any JSON-serialisable value, bound to `aad`. */
export function seal(value: unknown, aad: string): Sealed {
  if (!aad) throw new Error("seal() needs the document path and field as AAD.");
  const ring = keyRing();
  const key = ring.keys.get(ring.currentId)!;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value ?? null), "utf8"), cipher.final()]);
  return { $sealed: 1, kid: ring.currentId, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ct: ct.toString("base64url") };
}

/** Decrypts a sealed value. Throws SealOpenError when the key, path, field or ciphertext doesn't match. */
export function open<T = unknown>(sealed: Sealed, aad: string): T {
  if (!isSealed(sealed)) throw new SealOpenError("This field is not a protected value.");
  const ring = keyRing();
  const key = ring.keys.get(sealed.kid);
  if (!key) throw new SealOpenError(`The key "${sealed.kid}" for this protected field is not configured.`);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64url"));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(sealed.ct, "base64url")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    throw new SealOpenError();
  }
}

/** seal() bound to a document field. */
export function sealField(docPath: string, field: string, value: unknown): Sealed {
  return seal(value, sealAad(docPath, field));
}

/** open() bound to a document field. */
export function openField<T = unknown>(docPath: string, field: string, sealed: Sealed): T {
  return open<T>(sealed, sealAad(docPath, field));
}

/** Like openField, but returns null instead of throwing (detail views show "Couldn't open this"). */
export function tryOpenField<T = unknown>(docPath: string, field: string, sealed: Sealed | null | undefined): T | null {
  if (!sealed) return null;
  try {
    return openField<T>(docPath, field, sealed);
  } catch {
    return null;
  }
}

/** Re-encrypts under the current key (rotation). Returns the input when it already uses it. */
export function reseal(sealed: Sealed, aad: string): Sealed {
  const ring = keyRing();
  if (sealed.kid === ring.currentId) return sealed;
  return seal(open(sealed, aad), aad);
}
