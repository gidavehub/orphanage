import "server-only";

// Volunteer applications (admin-ux §6.9; PLAN D83). Edges come from FLOWS; this file adds the guard
// (a reason to decline) and patches (the interview time, the decline reason, a fresh onboarding
// checklist). The acknowledgement email goes at intake.

import type { OnboardingStep, VolunteerApplication } from "@/lib/model/domain/engagement";
import type { Millis } from "@/lib/model/enums";
import { defineMachine, type TransitionInput } from "./flow";

export type PeopleInput = TransitionInput & { interviewAt?: Millis | null };

/** The default "Getting ready" checklist (admin-ux §6.9). */
export const ONBOARDING_DEFAULT: Array<Pick<OnboardingStep, "id" | "label">> = [
  { id: "policy", label: "Read the safeguarding policy" },
  { id: "references", label: "References checked" },
  { id: "interview", label: "Interview done" },
  { id: "conduct", label: "Code of conduct signed" },
  { id: "training", label: "Safeguarding training done" },
];

export const needReason = ({ input }: { input: PeopleInput }) => (input.reason?.trim() && input.reason.trim().length >= 3 ? null : "Say why, so the team knows later.");

export const volunteerMachine = defineMachine<"volunteer", VolunteerApplication, PeopleInput>({
  workflow: "volunteer",
  collection: "volunteerApplications",
  area: "engagement",
  guards: { decline: needReason },
  patches: {
    interview: ({ input, viewer }) => ({ interview: { at: typeof input.interviewAt === "number" ? input.interviewAt : null, by: viewer?.uid ?? null, outcomeNote: null } }),
    decline: ({ input }) => ({ declineReasonCode: input.reason!.trim().slice(0, 200) }),
    onboard: ({ record }) =>
      record.onboardingChecklist?.length ? {} : { onboardingChecklist: ONBOARDING_DEFAULT.map((s) => ({ ...s, doneAt: null, doneBy: null })) },
  },
  summary: ({ edge, actorName, ref }) => `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`,
});
