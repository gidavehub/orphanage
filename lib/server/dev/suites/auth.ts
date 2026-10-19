import "server-only";

// Selftest suite "auth" (F2): who is signed in on this request (getViewer), password hashing and
// policy, role permissions, session lifetimes and, in practice mode, the local session store and the
// 5-failure lockout (on a throwaway account that is removed afterwards).
//   curl -s -X POST "http://localhost:3001/api/dev/session?role=finance_officer" -c jar
//   curl -s -b jar "http://localhost:3001/api/dev/selftest?suite=auth"   → roles = ["finance_officer"]

import { randomBytes } from "node:crypto";
import { permsFor, type Role } from "@/lib/model/permissions";
import type { Viewer } from "@/lib/model/viewer";
import { sessionLifetimeFor, SESSION_LIFETIME_MS } from "@/lib/model/session";
import { auditAreasFor, contactCategoriesFor } from "@/lib/server/auth/permissions";
import {
  createLocalAccount,
  createLocalSession,
  localSignIn,
  readLocalSession,
  refreshLocalSessionAuth,
  removeLocalAccount,
  revokeLocalSession,
} from "@/lib/server/auth/local";
import { checkSignInCode, CODE_MAX_TRIES, emailHint, sendSignInCode } from "@/lib/server/auth/email-code";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { getStore } from "@/lib/server/db";
import { docPath } from "@/lib/server/db/collections";
import { deliverOutboxItem, outboxId, outboxPath } from "@/lib/server/email/outbox";
import { readMailboxFile, removeMailboxFile } from "@/lib/server/email/transports/mailbox";
import { getViewer, toShellViewer } from "@/lib/server/auth/session";
import { resolveBackend } from "@/lib/server/env";
import { caseRecorder } from "../selftest";
import type { Suite } from "../types";

export const suite: Suite = {
  name: "auth",
  async run() {
    const t = caseRecorder();

    await t.check("getViewer() for this request", async () => {
      const v = await getViewer();
      if (!v) return "no session on this request (sign in with POST /api/dev/session?role=…)";
      const shell = toShellViewer(v);
      if ("email" in shell) throw new Error("ShellViewer must not carry the email");
      return `roles = ${JSON.stringify(v.roles)}; uid = ${v.uid}; backend = ${v.backend}; perms = ${v.perms.size}`;
    });

    await t.check("scrypt hash verifies the right password only", async () => {
      const h = await hashPassword("correct horse battery staple");
      return h.startsWith("scrypt$16384$8$1$") && (await verifyPassword("correct horse battery staple", h)) && !(await verifyPassword("wrong horse battery staple", h)) && !(await verifyPassword("x", null));
    });
    await t.check("password policy", () => {
      const bad = [
        checkPasswordPolicy("short") === null,
        checkPasswordPolicy("my haven password 1") === null,
        checkPasswordPolicy("Password2026!") === null,
        checkPasswordPolicy("amina.jallow.2026", { email: "amina.jallow@example.org" }) === null,
        checkPasswordPolicy("x".repeat(129)) === null,
        checkPasswordPolicy("mango river lantern 42") !== null,
      ];
      if (bad.some(Boolean)) throw new Error(`unexpected results: ${bad.map((b) => (b ? "✗" : "✓")).join("")}`);
      return true;
    });

    await t.check("role permissions (data-model §6.1, D85)", () => {
      const cm = permsFor(["content_manager"], []);
      const so = permsFor(["safeguarding_officer"], []);
      const sa = permsFor(["super_admin"], []);
      const viewer = permsFor(["viewer"], ["audit"]);
      return (
        !cm.has("concern.read") &&
        so.has("concern.read") &&
        sa.has("concern.manage") &&
        sa.has("audit.read.safeguarding") &&
        viewer.has("audit.read") &&
        !viewer.has("audit.read.safeguarding") &&
        !viewer.has("support.manage")
      );
    });
    await t.check("contact routing and activity areas per role", () => {
      const fake = (roles: Role[]): Viewer => ({
        uid: "x",
        displayName: "X",
        email: "x@example.org",
        roles,
        perms: permsFor(roles, []),
        viewerScopes: [],
        programmeScope: "all" as const,
        timezone: "Africa/Banjul",
        textSize: "normal" as const,
        authTime: 0,
        mfa: false,
        backend: "local" as const,
      });
      const fo = fake(["finance_officer"]);
      const cm = fake(["content_manager"]);
      return (
        JSON.stringify(contactCategoriesFor(fo)) === '["donation"]' &&
        !auditAreasFor(cm).includes("safeguarding") &&
        auditAreasFor(fake(["safeguarding_officer"])).includes("safeguarding")
      );
    });
    await t.check("session lifetimes: 12 h privileged, 7 days others (D86)", () => {
      return (
        sessionLifetimeFor(["finance_officer"]) === SESSION_LIFETIME_MS.privileged &&
        sessionLifetimeFor(["super_admin"]) === 43_200_000 &&
        sessionLifetimeFor(["counsellor"]) === SESSION_LIFETIME_MS.standard &&
        sessionLifetimeFor(["content_manager", "safeguarding_officer"]) === SESSION_LIFETIME_MS.privileged
      );
    });

    if (resolveBackend() === "local") {
      const run = randomBytes(4).toString("hex");
      const email = `selftest-${run}@haven.test`;
      const password = `river lantern mango ${run}`;
      let uid: string | null = null;
      try {
        uid = await createLocalAccount({ email, password, displayName: "Selftest Person", roles: ["viewer"] });
        const id = uid;

        await t.check("local session: create → read → refresh → revoke", async () => {
          const s = await createLocalSession(id, { authTime: 1000, lifetimeMs: 60_000, remember: false, device: "Selftest" });
          const read1 = await readLocalSession(s.cookieValue);
          const refreshed = await refreshLocalSessionAuth(s.cookieValue, 2000);
          const read2 = await readLocalSession(s.cookieValue);
          await revokeLocalSession(s.cookieValue);
          const read3 = await readLocalSession(s.cookieValue);
          return s.cookieValue.startsWith("loc.") && read1?.uid === id && refreshed && read2?.authTime === 2000 && read3 === null;
        });
        await t.check("an unknown cookie is rejected", async () => (await readLocalSession(`loc.${randomBytes(32).toString("base64url")}`)) === null);

        await t.check("sign-in with the right password", async () => {
          const r = await localSignIn(email, password, { seed: false, ip: `selftest-${run}-a` });
          return r.ok && r.uid === id;
        });
        await t.check("5 wrong passwords lock the account for 15 minutes", async () => {
          const ip = `selftest-${run}-b`;
          const results: string[] = [];
          for (let i = 0; i < 5; i++) {
            const r = await localSignIn(email, "definitely wrong password", { seed: false, ip });
            results.push(r.ok ? "ok" : r.reason);
          }
          const after = await localSignIn(email, password, { seed: false, ip });
          if (results[4] !== "locked" || after.ok || after.reason !== "locked") throw new Error(`results=${results.join(",")} after=${after.ok ? "ok" : after.reason}`);
          return true;
        });
        await t.check("an unknown email is refused like a wrong password", async () => {
          const r = await localSignIn(`nobody-${run}@haven.test`, password, { seed: false, ip: `selftest-${run}-c` });
          return !r.ok && r.reason === "invalid";
        });
      } finally {
        if (uid) await removeLocalAccount(uid).catch(() => undefined);
      }
    }

    // The emailed sign-in code (lib/server/auth/email-code.ts; no authenticator app since 2026-10-19).
    // Practice mode only: the email lands in .data/mailbox, where the code is read back.
    if (resolveBackend() === "local") {
      const run = randomBytes(4).toString("hex");
      const uid = `selftest-code-${run}`;
      const email = `code-${run}@haven.test`;
      const outboxIds: string[] = [];
      const codeFrom = async (challengeId: string): Promise<string> => {
        const id = outboxId("staff_sign_in_code", `code~${challengeId}`);
        outboxIds.push(id);
        for (let i = 0; i < 10; i++) {
          await deliverOutboxItem(id).catch(() => null);
          const html = await readMailboxFile(id);
          const m = html?.match(/Your code[\s\S]{0,600}?\b(\d{6})\b/);
          if (m) return m[1];
          await new Promise((r) => setTimeout(r, 300));
        }
        throw new Error("the code email never reached the practice mailbox");
      };
      try {
        await t.check("the code email names the code, and the hint hides the address", async () => {
          const a = await sendSignInCode(uid, email, "Selftest");
          const code = await codeFrom(a.challengeId);
          return /^\d{6}$/.test(code) && a.emailHint === emailHint(email) && a.emailHint.includes("•••") && !a.emailHint.includes(run);
        });
        await t.check("a wrong code is refused; the right one works once", async () => {
          const a = await sendSignInCode(uid, email, "Selftest");
          const code = await codeFrom(a.challengeId);
          const wrong = code === "000000" ? "111111" : "000000";
          const r1 = await checkSignInCode(uid, a.challengeId, wrong);
          const r2 = await checkSignInCode(uid, a.challengeId, code);
          const r3 = await checkSignInCode(uid, a.challengeId, code);
          if (r1 !== "wrong" || r2 !== "ok" || r3 !== "expired") throw new Error(`wrong=${r1} right=${r2} again=${r3}`);
          return true;
        });
        await t.check("a new code replaces the last; someone else's challenge never works", async () => {
          const a = await sendSignInCode(uid, email, "Selftest");
          const oldCode = await codeFrom(a.challengeId);
          const b = await sendSignInCode(uid, email, "Selftest");
          const newCode = await codeFrom(b.challengeId);
          const old = await checkSignInCode(uid, a.challengeId, oldCode);
          const other = await checkSignInCode(`${uid}-other`, b.challengeId, newCode);
          const ok = await checkSignInCode(uid, b.challengeId, newCode);
          if (old !== "expired" || other !== "expired" || ok !== "ok") throw new Error(`old=${old} other=${other} new=${ok}`);
          return true;
        });
        await t.check(`${CODE_MAX_TRIES} wrong tries use the code up`, async () => {
          const a = await sendSignInCode(uid, email, "Selftest");
          const code = await codeFrom(a.challengeId);
          const wrong = code === "000000" ? "111111" : "000000";
          const results: string[] = [];
          for (let i = 0; i < CODE_MAX_TRIES; i++) results.push(await checkSignInCode(uid, a.challengeId, wrong));
          const after = await checkSignInCode(uid, a.challengeId, code);
          if (results[CODE_MAX_TRIES - 1] !== "too_many" || after !== "too_many") throw new Error(`results=${results.join(",")} after=${after}`);
          return true;
        });
      } finally {
        const store = getStore();
        await store.delete(docPath("staffSignInCodes", uid)).catch(() => undefined);
        for (const id of outboxIds) {
          await store.delete(outboxPath(id)).catch(() => undefined);
          await removeMailboxFile(id).catch(() => undefined);
        }
      }
    }

    return t.cases;
  },
};
