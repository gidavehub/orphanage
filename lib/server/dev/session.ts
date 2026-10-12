import "server-only";

// Practice sign-in (PLAN D90): the one-tap role chips on /admin/login and POST /api/dev/session both
// sign in as the seeded <role>@haven.test account through this one function. Guarded by devOnly():
// local backend and not on Vercel, so it is impossible in production (works under `next start` for QA).
// Server Actions and Route Handlers only (it sets the session cookie).

import { isRole, type Role } from "@/lib/model/permissions";
import { findLocalAccountByEmail } from "@/lib/server/auth/local";
import { startSession } from "@/lib/server/auth/session";
import { devOnly } from "./guard";
import { ensurePracticeSeed, practiceEmail } from "./seed";

/** Signs this browser in as the practice account for `role` (`n: 2` = its second account, when seeded). */
export async function devSignInAs(role: Role, opts: { authAgeMs?: number; n?: 1 | 2 } = {}): Promise<void> {
  devOnly();
  if (!isRole(role)) throw new Error("Unknown role.");
  await ensurePracticeSeed();
  const account = await findLocalAccountByEmail(practiceEmail(role, opts.n ?? 1));
  if (!account) throw new Error(`The practice account for ${role} is missing.`);
  // Tests may sign in "a while ago" to exercise the 30-minute step-up (D87).
  const age = Math.min(Math.max(0, opts.authAgeMs ?? 0), 12 * 3_600_000);
  await startSession(account.uid, { authTime: Date.now() - age, remember: false, device: "Practice sign-in" });
}
