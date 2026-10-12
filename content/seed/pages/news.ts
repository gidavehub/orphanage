// pages.news (public-pages §3.15). The lead is the landing's News intro. CLIENT [draft] elsewhere.

import "server-only";

import { para, type PageSeed } from "./_helpers";

export const newsPage: PageSeed = {
  hero: {
    title: ["News &", "Updates"],
    intro: "Fresh impact updates and stories of hope, published every month.",
  },
  seo: {
    title: "News & Updates",
    description: "Fresh impact updates and stories of hope from Haven, published every month.",
  },
  sections: {
    aiByline: {
      body: [para("a1", "This article was prepared with the help of AI tools, then reviewed and approved by the Haven team.")],
    },
    empty: {
      body: [para("e1", "No posts in this category yet.")],
      cta: { label: "All News", to: "news" },
    },
    newsletter: {
      title: ["Join the Haven Family"],
    },
  },
};
