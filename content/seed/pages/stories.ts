// pages.stories (public-pages §3.14). The lead is the landing's Stories intro; the consent line is
// [spec §15]; the rest is CLIENT [draft].

import "server-only";

import { para, type PageSeed } from "./_helpers";

export const storiesPage: PageSeed = {
  hero: {
    title: ["Stories of", "Hope"],
    intro: "Real change from families and communities across Africa, Asia and the Arab world, shared with consent and with every child’s privacy protected.",
  },
  seo: {
    title: "Stories of Hope",
    description: "Real change from families and communities, shared with consent and with every child's privacy protected.",
  },
  sections: {
    featured: {
      title: ["In Their", "Own Words"],
      body: [para("f1", "Parents, carers, volunteers and partners on what changed. Hover or tap a portrait to read their story.")],
      cta: { label: "All Stories", to: "stories" },
    },
    all: {
      eyebrow: "Every Story",
      title: ["Change, Told by the", "People Who Lived It"],
      body: [para("a1", "Families, volunteers and partners across the communities we serve. Choose a programme to read the stories behind it.")],
    },
    consent: {
      body: [para("c1", "Every story is shared with written permission. We never publish children's names or exact locations.")],
    },
    share: {
      title: ["Has Haven Made a", "Difference for You?"],
      body: [para("s1", "Your story could help another family find the courage to ask for help. We'll check every word with you before it's shared.")],
      cta: { label: "Tell Your Story", to: "tellStory" },
    },
  },
};
