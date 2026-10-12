import "server-only";

// Selftest suite "seal" (F2): field encryption and signed tokens (data-model §11.2, integrations §2.4).
// Pure: no records are written.

import { emailHash, ipHash, signToken, verifyToken } from "@/lib/server/security/hmac";
import { SealOpenError, isSealed, open, openField, seal, sealField } from "@/lib/server/security/seal";
import { caseRecorder } from "../selftest";
import type { Suite } from "../types";

const SECRET_TEXT = "Selftest sentence: this text must never be readable at rest.";

export const suite: Suite = {
  name: "seal",
  async run() {
    const t = caseRecorder();
    const path = "supportRequests/HVN-SR-2026-9999";

    await t.check("seal → open round trip (string and object)", () => {
      const s = sealField(path, "explanation", SECRET_TEXT);
      const o = seal({ name: "A", n: 3 }, `${path}#reporter.identity`);
      const back = open<{ name: string; n: number }>(o, `${path}#reporter.identity`);
      return isSealed(s) && openField<string>(path, "explanation", s) === SECRET_TEXT && back.name === "A" && back.n === 3;
    });
    await t.check("ciphertext does not contain the plaintext", () => {
      const s = sealField(path, "explanation", SECRET_TEXT);
      const raw = JSON.stringify(s);
      return !raw.includes("never be readable") && !raw.includes(Buffer.from(SECRET_TEXT).toString("base64").slice(0, 16));
    });
    await t.check("each seal uses a fresh IV", () => {
      const a = sealField(path, "explanation", SECRET_TEXT);
      const b = sealField(path, "explanation", SECRET_TEXT);
      return a.iv !== b.iv && a.ct !== b.ct;
    });
    await t.throws("opening with the wrong AAD (another record) fails", SealOpenError, () =>
      openField("supportRequests/HVN-SR-2026-0001", "explanation", sealField(path, "explanation", SECRET_TEXT)),
    );
    await t.throws("opening with the wrong AAD (another field) fails", SealOpenError, () => openField(path, "narrative", sealField(path, "explanation", SECRET_TEXT)));
    await t.throws("tampered ciphertext fails", SealOpenError, () => {
      const s = sealField(path, "explanation", SECRET_TEXT);
      const ct = Buffer.from(s.ct, "base64url");
      ct[0] ^= 0xff;
      return openField(path, "explanation", { ...s, ct: ct.toString("base64url") });
    });
    await t.throws("an unknown key id fails", SealOpenError, () => openField(path, "explanation", { ...sealField(path, "explanation", "x"), kid: "nope" }));

    await t.check("signed token verifies for its purpose", () => {
      const tok = signToken({ p: "thanks", sub: "HVN-DN-2026-0001", exp: Date.now() + 60_000 });
      return verifyToken(tok, "thanks")?.sub === "HVN-DN-2026-0001";
    });
    await t.check("wrong purpose, tampering and expiry are rejected", () => {
      const tok = signToken({ p: "thanks", sub: "HVN-DN-2026-0001", exp: Date.now() + 60_000 });
      const [body, sig] = tok.split(".");
      const forged = Buffer.from(JSON.stringify({ p: "thanks", sub: "HVN-DN-2026-0002", exp: Date.now() + 60_000 })).toString("base64url");
      const expired = signToken({ p: "thanks", sub: "x", exp: Date.now() - 1 });
      return (
        verifyToken(tok, "receipt") === null &&
        verifyToken(`${forged}.${sig}`, "thanks") === null &&
        verifyToken(`${body}.${sig.slice(0, -2)}AA`, "thanks") === null &&
        verifyToken(expired, "thanks") === null &&
        verifyToken("garbage", "thanks") === null
      );
    });
    await t.check("tokens carry data and may have no expiry", () => {
      const tok = signToken({ p: "upload", sub: "u1", exp: null, d: { mime: "application/pdf", size: 10 } });
      const v = verifyToken(tok, "upload");
      return v?.exp === null && v.d?.mime === "application/pdf" && v.d?.size === 10;
    });
    await t.check("emailHash is stable and case-insensitive; ipHash changes daily", () => {
      const day = Date.UTC(2026, 9, 10, 12);
      return (
        emailHash("Amina@Example.org ") === emailHash("amina@example.org") &&
        emailHash("a@example.org") !== emailHash("b@example.org") &&
        ipHash("203.0.113.5", day) === ipHash("203.0.113.5", day + 3_600_000) &&
        ipHash("203.0.113.5", day) !== ipHash("203.0.113.5", day + 86_400_000)
      );
    });
    return t.cases;
  },
};
