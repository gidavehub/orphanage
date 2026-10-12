// pages.search (public-pages §3.22). The suggestion chips' destinations stay in code; their labels
// and the empty-state words are editable here.

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const searchPage: PageSeed = {
  hero: {
    title: ["Search"],
    intro: "Find programmes, pages, resources, news, stories and answers.",
  },
  seo: {
    title: "Search",
    noindex: true,
  },
  sections: {
    suggestions: {
      eyebrow: "Popular",
      items: items([["Request support"], ["School-fee assistance"], ["Counselling"], ["Report a concern"], ["Volunteer"], ["Annual report"]]),
    },
    empty: {
      body: [para("e1", "Try another word or a shorter phrase, or contact us and we'll help you find it.")],
      cta: { label: "Contact Us", to: "contact" },
    },
  },
};
