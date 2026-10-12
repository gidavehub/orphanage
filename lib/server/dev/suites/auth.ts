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
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/server/auth/password";
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
    return t.cases;
  },
};
