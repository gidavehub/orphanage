import "server-only";

// The common case-record envelope every public intake writes (CaseDoc in lib/model/enums.ts): the
// reference, the first status, an unassigned owner, empty queues state, search tokens and retention.
// Intake modules spread this first and then set their own fields, field by field.

import type { CaseDoc, Millis, RetentionPolicyId } from "@/lib/model/enums";
import { buildSearchTokens, type SearchTokenInput } from "@/lib/server/db/search-tokens";

export function caseBase<S extends string>(
  reference: string,
  status: S,
  now: Millis,
  policy: RetentionPolicyId,
  tokens: Omit<SearchTokenInput, "reference"> = {},
): CaseDoc<S> {
  return {
    reference,
    status,
    statusChangedAt: now,
    assignedTo: null,
    assignedName: null,
    assignedAt: null,
    followUpAt: null,
    snoozedUntil: null,
    seenBy: [],
    lastActivityAt: now,
    closedAt: null,
    archived: false,
    archivedAt: null,
    tags: [],
    searchTokens: buildSearchTokens({ reference, ...tokens }),
    retention: { policy, retainUntil: null, legalHold: false },
    source: "web_form",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/** "Amina Sowe" → "Amina" (email greetings; never more than the first word). */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";
}
