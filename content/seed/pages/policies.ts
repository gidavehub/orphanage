// pages.policies (public-pages §3.21). CLIENT [draft].

import "server-only";

import { para, type PageSeed } from "./_helpers";

export const policiesPage: PageSeed = {
  hero: {
    title: ["Our Policies"],
    intro: "How we keep children safe, protect your information and run this website.",
  },
  seo: {
    title: "Policies",
    description: "Haven's Child Safeguarding Policy, Privacy Policy and Terms of Use.",
  },
  sections: {
    draftBanner: {
      body: [para("d1", "Draft, pending professional review.")],
    },
    partnerPolicies: {
      body: [para("p1", "Looking for policies for partner institutions? You'll find them in our [resources library](/resources?category=organisational_policies).")],
    },
    questions: {
      body: [para("q1", "Questions about this policy? Email our team.")],
    },
  },
};
