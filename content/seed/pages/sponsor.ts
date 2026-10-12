// pages.sponsor (public-pages §3.19, PLAN D55). The privacy rule is quoted from [spec §10]; the rest
// is CLIENT [draft].

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const sponsorPage: PageSeed = {
  hero: {
    title: ["Sponsor a", "Child's", "Future"],
    intro: "Give monthly to cover a child's assessed needs through our programmes, with regular programme updates and every child's privacy protected.",
  },
  seo: {
    title: "Sponsor a Child",
    description: "Give monthly to cover a child's assessed needs through Haven's programmes, with every child's privacy protected.",
  },
  sections: {
    how: {
      eyebrow: "How Sponsorship Works",
      title: ["Four Simple Steps"],
      items: items([
        ["Choose a profile"],
        ["Give monthly"],
        ["We deliver support through the programme"],
        ["You receive programme-level updates"],
      ]),
    },
    privacy: {
      eyebrow: "Our Privacy Promise",
      body: [
        para(
          "p1",
          "Public profiles show only an anonymous beneficiary reference, a general age range, a broad support category, the funding need and programme-level updates. There is no direct private contact between donors and children, and no names, precise locations or medical histories.",
        ),
        para("p2", "That's why our profiles have no photos."),
      ],
    },
    empty: {
      body: [para("e1", "Every current profile is fully sponsored. Thank you!")],
      cta: { label: "Give to the Fund", to: "donate" },
    },
    questions: {
      eyebrow: "Questions",
      items: items([
        [
          "Can I write to or visit the child?",
          "No. To keep children safe there is no direct contact between sponsors and children. You'll receive programme-level updates instead.",
        ],
      ]),
    },
  },
};
