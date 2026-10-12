// pages.notFound (public-pages §3.23, PLAN D8).

import "server-only";

import { para, type PageSeed } from "./_helpers";

export const notFoundPage: PageSeed = {
  hero: {
    eyebrow: "Let's get you somewhere safe",
    title: ["Page Not Found"],
  },
  seo: {
    title: "Page not found",
    noindex: true,
  },
  sections: {
    help: {
      body: [para("h1", "The page you were looking for has moved or no longer exists. Try a search, or choose where to go next.")],
    },
  },
};
