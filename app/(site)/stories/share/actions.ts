"use server";

import type { FormState } from "@/lib/forms/types";
import type { StoryField } from "@/lib/schemas/forms/story";
import { submitStory } from "@/lib/server/intake/story";

/** /stories/share (D58): the public story form's Server Action. All checks live in the intake pipeline. */
export async function shareStory(_prev: FormState<StoryField>, formData: FormData): Promise<FormState<StoryField>> {
  return submitStory(formData);
}
