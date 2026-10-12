import "server-only";

// Messages (contact form) and story submissions (admin-ux §6.19; PLAN D58). Edges come from FLOWS;
// this file adds the guards, the reply email through the outbox, and the timeline/audit wording.

import type { ContactMessage, StorySubmission } from "@/lib/model/domain/engagement";
import { enqueueEmailTx } from "@/lib/server/email/outbox";
import { canReadContactCategory } from "@/lib/server/auth/permissions";
import { defineMachine, type TransitionInput } from "./flow";

export type ContactInput = TransitionInput & { message?: string };

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

export const contactMachine = defineMachine<"contact", ContactMessage, ContactInput>({
  workflow: "contact",
  collection: "contactMessages",
  area: "engagement",
  authorize: ({ viewer, record }) => !viewer || canReadContactCategory(viewer, record.category),
  guards: {
    reply: ({ input }) => (input.message?.trim() && input.message.trim().length >= 5 ? null : "Write your reply first."),
  },
  patches: {
    reply: ({ record, viewer, now, ref }) => ({
      replies: [...(record.replies ?? []), { at: now, by: viewer?.uid ?? "system", byName: viewer?.displayName ?? "Haven", outboxId: `contact_reply~${ref}~${now}` }],
    }),
  },
  effects: {
    reply: async ({ tx, input, record, ref, path, now }) => {
      await enqueueEmailTx(tx, {
        template: "contact_reply",
        to: [record.email],
        vars: { reference: ref, firstName: firstName(record.fullName), message: input.message!.trim().slice(0, 3000) },
        related: { path, reference: ref },
        dedupeKey: `${ref}~${now}`,
      });
    },
  },
  summary: ({ edge, actorName, ref }) => (edge.id === "reply" ? `${actorName} replied to ${ref} by email` : `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`),
});

export type StoryInput = TransitionInput & { reason?: string };

export const storyMachine = defineMachine<"storySubmission", StorySubmission, StoryInput>({
  workflow: "storySubmission",
  collection: "storySubmissions",
  area: "content",
  guards: {
    decline: ({ input }) => (input.reason?.trim() ? null : "Say why, so the team knows later."),
  },
  patches: {
    decline: ({ input }) => ({ declineReason: input.reason!.trim().slice(0, 500) }),
  },
  summary: ({ edge, actorName, ref }) => `${actorName} moved ${ref} on: ${edge.verb.toLowerCase()}`,
});
