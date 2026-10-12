import "server-only";

// Selftest suite "rbac" (F5; PLAN §5.5 practice wiring). Three layers of the access model:
// 1. This request: requireStaff() with the real session cookie, against representative permissions
//    (allowed → returns the viewer; denied → notFound(), never a redirect or a 403).
// 2. Every seeded role: the practice account exists and is active, its permissions match the binding
//    matrix (data-model §6.1–6.2 + D47 + D85), and its places follow admin-ux §5.3.
// 3. The DAL's record check: concerns open only for safeguarding officers and super admins; support
//    requests for the roles that read them; other roles get exactly what a missing record gives.
//   node scripts/qa/rbac.mjs --base http://localhost:3001   (signs in as each role and runs this suite)

import { AREA_PERMS, placesFor } from "@/lib/admin/access";
import type { StaffProfile } from "@/lib/model/domain/staff";
import { ROLES, permsFor, type Permission, type Role } from "@/lib/model/permissions";
import type { Viewer } from "@/lib/model/viewer";
import { getViewer, requireStaff, toShellViewer } from "@/lib/server/auth/session";
import { readRecordFor } from "@/lib/server/dal/_shared";
import { getStore } from "@/lib/server/db";
import { C, docPath } from "@/lib/server/db/collections";
import { resolveBackend } from "@/lib/server/env";
import { caseRecorder } from "../selftest";
import { PRACTICE_STAFF, practiceUid } from "../seed";
import type { Suite } from "../types";

/** Representative permissions: which roles hold each (binding matrix; super admin holds all). */
const EXPECT: Record<string, Role[]> = {
  "concern.read": ["super_admin", "safeguarding_officer"],
  "concern.manage": ["super_admin", "safeguarding_officer"],
  "support.manage": ["super_admin", "programme_officer"],
  "support.read": ["super_admin", "programme_officer"],
  "donation.manage": ["super_admin", "finance_officer"],
  "settings.giving": ["super_admin", "finance_officer"],
  "appointment.manage": ["super_admin", "programme_officer"],
  "appointment.own": ["super_admin", "counsellor"],
  "reportRequest.manage": ["super_admin", "report_manager"],
  "storySubmission.manage": ["super_admin", "content_manager"],
  "referralPartner.manage": ["super_admin", "programme_officer"],
  "post.publish": ["super_admin", "content_manager"],
  "impact.verify": ["super_admin", "programme_officer", "finance_officer"],
  "staff.manage": ["super_admin"],
  "settings.manage": ["super_admin"],
  "privacy.manage": ["super_admin"],
  "dashboard.view": [...ROLES],
};

/** Which roles see the Safeguarding place (admin-ux §5.1: SA and SO only). */
const SAFEGUARDING_PLACE: Role[] = ["super_admin", "safeguarding_officer"];

function isNotFound(err: unknown): boolean {
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : "";
  return digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404") || digest === "NEXT_NOT_FOUND";
}

function isRedirect(err: unknown): boolean {
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : "";
  return digest.startsWith("NEXT_REDIRECT");
}

/** A Viewer for a seeded role, built from its staff document (no session involved). */
function viewerFor(role: Role, staff: StaffProfile): Viewer {
  return {
    uid: staff.uid,
    displayName: staff.displayName,
    email: staff.email,
    roles: [...staff.roles],
    perms: permsFor(staff.roles, staff.viewerScopes ?? []),
    viewerScopes: [...(staff.viewerScopes ?? [])],
    programmeScope: staff.programmeScope ?? "all",
    timezone: staff.timezone,
    textSize: staff.textSize,
    authTime: Date.now(),
    mfa: false,
    backend: "local",
  };
}

async function firstId(collection: string): Promise<string | null> {
  const page = await getStore().list<{ createdAt: number }>(collection, { orderBy: { field: "createdAt", dir: "desc" }, limit: 1 });
  return page.items[0]?.id ?? null;
}

export const suite: Suite = {
  name: "rbac",
  async run() {
    const t = caseRecorder();
    if (resolveBackend() !== "local") {
      await t.check("practice mode", () => {
        throw new Error("the rbac suite runs on the local practice backend only");
      });
      return t.cases;
    }

    /* 1. This request's session through requireStaff() ─────────────────── */
    const current = await getViewer();
    await t.check("requireStaff() with this request's session", async () => {
      if (!current) return "no session on this request (rbac.mjs signs in per role first); skipped";
      const v = await requireStaff();
      if (v.uid !== current.uid) throw new Error("requireStaff() returned a different person");
      const wrong: string[] = [];
      for (const p of Object.keys(EXPECT) as Permission[]) {
        const should = current.perms.has(p);
        let allowed = false;
        try {
          await requireStaff(p);
          allowed = true;
        } catch (err) {
          if (isRedirect(err)) throw new Error(`requireStaff("${p}") redirected instead of answering notFound`);
          if (!isNotFound(err)) throw err;
        }
        if (allowed !== should) wrong.push(`${p}: ${allowed ? "allowed" : "denied"}`);
      }
      if (wrong.length) throw new Error(`unexpected: ${wrong.join(", ")}`);
      return `roles = ${current.roles.join(", ")}; ${Object.keys(EXPECT).length} permission checks`;
    });

    await t.check("the shell view of this person carries no email", () => {
      if (!current) return "no session; skipped";
      return !("email" in toShellViewer(current));
    });

    /* 2. Every seeded role: account, permissions, places ─────────────────── */
    const staffDocs = await getStore().getMany<StaffProfile>(ROLES.map((r) => docPath("staff", practiceUid(r))));
    const viewers = new Map<Role, Viewer>();
    for (const [i, role] of ROLES.entries()) {
      const staff = staffDocs[i];
      await t.check(`${role}: seeded account is active with its role`, () => {
        if (!staff) throw new Error(`staff/${practiceUid(role)} is missing (run the practice seed)`);
        if (staff.status !== "active") throw new Error(`status is ${staff.status}`);
        if (!staff.roles.includes(role)) throw new Error(`roles are ${staff.roles.join(", ")}`);
        viewers.set(role, viewerFor(role, staff));
        return `${PRACTICE_STAFF[role].displayName}`;
      });
    }

    for (const role of ROLES) {
      const v = viewers.get(role);
      if (!v) continue;
      await t.check(`${role}: permissions follow the matrix`, () => {
        const wrong: string[] = [];
        for (const [p, holders] of Object.entries(EXPECT)) {
          const should = holders.includes(role);
          if (v.perms.has(p as Permission) !== should) wrong.push(`${p} ${should ? "missing" : "unexpected"}`);
        }
        if (role === "viewer") {
          for (const p of v.perms) if (/\.(manage|contact|publish|edit)$/.test(p)) wrong.push(`${p} must never reach a viewer`);
        }
        if (wrong.length) throw new Error(wrong.join("; "));
        return `${v.perms.size} permissions`;
      });

      await t.check(`${role}: places`, () => {
        const shell = toShellViewer(v);
        const { pill, more, dockPrimary } = placesFor(shell);
        const all = [...pill, ...more].map((p) => p.area);
        if (pill[0]?.area !== "today") throw new Error("Today must lead the pill");
        if (pill.length > 6) throw new Error(`the pill holds ${pill.length} places (max 6)`);
        const sees = all.includes("safeguarding");
        if (sees !== SAFEGUARDING_PLACE.includes(role)) throw new Error(`safeguarding place ${sees ? "shown" : "hidden"}`);
        for (const a of all) {
          if (!AREA_PERMS[a].read.some((p) => v.perms.has(p))) throw new Error(`${a} shown without a read permission`);
        }
        if (role === "counsellor" && !all.includes("counselling")) throw new Error("counsellor without My sessions");
        if (role === "counsellor" && [...pill, ...more].find((p) => p.area === "counselling")?.label !== "My sessions") throw new Error("counsellor label must be My sessions");
        return `pill: ${pill.map((p) => p.label).join(" · ")}; dock: ${dockPrimary.label}`;
      });
    }

    /* 3. The DAL record check (concern isolation, D84) ──────────────────── */
    const [concernRef, supportRef] = await Promise.all([firstId(C.safeguardingConcerns), firstId(C.supportRequests)]);
    await t.check("concerns open only for safeguarding officers and super admins", async () => {
      if (!concernRef) return "no seeded concern; skipped";
      const wrong: string[] = [];
      for (const role of ROLES) {
        const v = viewers.get(role);
        if (!v) continue;
        const opened = (await readRecordFor(v, concernRef)) !== null;
        if (opened !== SAFEGUARDING_PLACE.includes(role)) wrong.push(`${role}: ${opened ? "opened" : "refused"}`);
      }
      if (wrong.length) throw new Error(wrong.join("; "));
      return `checked ${concernRef.slice(0, 4)}… for ${viewers.size} roles`;
    });

    await t.check("support requests open only for roles that read them", async () => {
      if (!supportRef) return "no seeded support request; skipped";
      const wrong: string[] = [];
      for (const role of ROLES) {
        const v = viewers.get(role);
        if (!v) continue;
        const opened = (await readRecordFor(v, supportRef)) !== null;
        const should = ["support.read", "support.summary", "support.manage"].some((p) => v.perms.has(p as Permission));
        if (opened !== should) wrong.push(`${role}: ${opened ? "opened" : "refused"}`);
      }
      if (wrong.length) throw new Error(wrong.join("; "));
      return `checked ${supportRef} for ${viewers.size} roles`;
    });

    await t.check("a made-up reference reads exactly like a refused one", async () => {
      const sa = viewers.get("super_admin");
      if (!sa) return "no super admin; skipped";
      return (await readRecordFor(sa, "HVN-SR-1999-9999")) === null && (await readRecordFor(sa, "not a reference")) === null;
    });

    return t.cases;
  },
};
