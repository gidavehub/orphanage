// The signed-in staff member, as the server sees them (types only).
// Server code receives `Viewer` from getViewer()/requireStaff(); client components receive the
// serialisable `ShellViewer` (lib/model/dto.ts) built by toShellViewer().

import type { Millis, ProgrammeId, Uid } from "./enums";
import type { Permission, Role, ViewerScope } from "./permissions";

export type Viewer = {
  uid: Uid;
  displayName: string;
  email: string;
  roles: Role[];
  perms: ReadonlySet<Permission>;
  viewerScopes: ViewerScope[];
  /** Programme officer queue filter; default "all". */
  programmeScope: ProgrammeId[] | "all";
  /** IANA timezone for staff-facing dates. */
  timezone: string;
  textSize: "normal" | "large";
  /** Last real sign-in (epoch ms), used by the 30-minute step-up check. */
  authTime: Millis;
  /** True when this session was created with a second factor. */
  mfa: boolean;
  backend: "firestore" | "local";
};

/** A non-human actor for audit entries and transitions (cron jobs, webhooks, seeders). */
export type SystemActor = { kind: "system"; job: string };

export function systemActor(job: string): SystemActor {
  return { kind: "system", job };
}
