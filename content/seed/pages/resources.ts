// pages.resources (public-pages §3.9). Editable by content managers and report managers (D85).

import "server-only";

import { para, type PageSeed } from "./_helpers";

export const resourcesPage: PageSeed = {
  hero: {
    title: ["Resources &", "Reports"],
    intro:
      "Guides, policies and reports on child safeguarding, rights, parenting, wellbeing, education, health and the law, and our annual and programme reports.",
  },
  seo: {
    title: "Resources & Reports",
    description: "Guides, policies and reports from Haven on child safeguarding, rights, parenting, wellbeing, education, health and the law.",
  },
  sections: {
    featured: {
      eyebrow: "Latest Report",
    },
    notListed: {
      title: ["Looking for a Report", "That Isn't Listed?"],
      body: [para("n1", "Tell us what you need and our team will help.")],
      cta: { label: "Request a Report", to: "requestReport" },
    },
    empty: {
      body: [para("e1", "No resources match your search yet. Try another word, or ask us for a resource.")],
      cta: { label: "Ask Us", to: "contact" },
    },
  },
};
