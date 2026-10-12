// Alt text and display hints for pipeline media (content-model §3.7). Values verbatim from the alts
// hard-coded in About, Founder, Restoring and Faq today. Every other pipeline id is decorative
// (alt ""), matching today; team and testimonial portraits keep the computed alt "{name}, {role}"
// in their components. Staff edit alt text later through the media library (an override record).

import "server-only";

import type { MediaMeta } from "@/lib/media/pipeline";

export const mediaMeta: MediaMeta = {
  about: { alt: "A joyful schoolboy running home with a friend at golden hour" },
  founder: { alt: "A boy reading outdoors with friends" },
  "restoring-bw": { alt: "A brother and sister sitting close together" },
  "faq-main": { alt: "Two boys smiling with a football" },
  "faq-bw": { alt: "A calm young girl smiling gently" },
};
