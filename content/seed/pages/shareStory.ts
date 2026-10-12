// pages.shareStory (public-pages §3.14, PLAN D58). CLIENT [draft].

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const shareStoryPage: PageSeed = {
  hero: {
    eyebrow: "Stories of Hope",
    title: ["Share Your Story"],
    intro: "Tell us how Haven has made a difference. A member of our team will read your story and contact you before anything is published.",
  },
  seo: {
    title: "Share Your Story",
    description: "Has Haven made a difference for you? Share your story with us. Nothing is published without your permission.",
  },
  sections: {
    photos: {
      body: [
        para(
          "p1",
          "Please don't send photos of children. If your story involves a child, our team will arrange written consent before any photo is used.",
        ),
      ],
    },
    consents: {
      items: items([
        ["Permission to publish", "I give Haven permission to edit and publish my story, without children's names or exact locations."],
        ["Parent or guardian", "I am the child's parent or legal guardian."],
      ]),
    },
    success: {
      title: ["Thank You for Sharing"],
      body: [para("s1", "A member of our team will read your story and contact you before anything is published.")],
    },
    next: {
      title: ["How We Look After Your Story"],
      items: items([
        ["We read every story", "A member of our content team reads what you send, usually within a week."],
        ["We check it with you", "We contact you to agree the wording and how you would like to be credited."],
        ["Only then do we publish", "Never with children's names or exact places, and you can change your mind at any time."],
      ]),
    },
    safety: {
      title: ["Is a Child in Danger?"],
      body: [para("d1", "Please don't use this form. Tell our safeguarding team straight away, or call your local emergency number.")],
      cta: { label: "Report a Concern", to: "report" },
    },
    talk: {
      title: ["Prefer to Talk?"],
      body: [para("t1", "You can also tell us your story by email or phone. We'll write it down with you.")],
    },
  },
};
