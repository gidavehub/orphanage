// pages.faq (public-pages §3.20, PLAN D49). Questions live in the faqs collection; the group pills
// filter on placements (donations = "donate").

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const faqPage: PageSeed = {
  hero: {
    title: ["Have Any", "Questions", "For Us?"],
  },
  seo: {
    title: "Frequently Asked Questions",
    description: "Answers about getting support, safeguarding and privacy, donations, volunteering and partnerships, and Haven.",
  },
  sections: {
    groups: {
      items: items([
        ["Getting support", undefined, "support"],
        ["Safeguarding & privacy", undefined, "safeguarding"],
        ["Donations", undefined, "donate"],
        ["Volunteering & partnerships", undefined, "involved"],
        ["About Haven", undefined, "about"],
      ]),
    },
    stillQuestion: {
      title: ["Still Have a Question?"],
      cta: { label: "Contact Us", to: "contact" },
    },
    empty: {
      body: [para("e1", "No answers match your search. Ask us and we'll help.")],
      cta: { label: "Ask Us", to: "contact" },
    },
  },
};
