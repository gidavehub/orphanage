import "server-only";

// Partnership enquiries (admin-ux §6.9; PLAN D78: New · Under review · Talking · Agreement · Active,
// with Closed and Declined resting). Edges come from FLOWS; declining or closing needs a reason.

import type { PartnershipEnquiry } from "@/lib/model/domain/engagement";
import { defineMachine } from "./flow";
import { needReason, type PeopleInput } from "./volunteer";

export const partnershipMachine = defineMachine<"partnership", PartnershipEnquiry, PeopleInput>({
  workflow: "partnership",
  collection: "partnershipEnquiries",
  area: "engagement",
  guards: { decline: needReason, close: needReason },
  summary: ({ edge, actorName, ref }) => `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`,
});
