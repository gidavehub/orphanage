// pages.impact (public-pages §3.12). The heading is [spec §3]; the figures come from the stats
// registry, so this doc only holds the page copy.

import "server-only";

import { para, type PageSeed } from "./_helpers";

export const impactPage: PageSeed = {
  hero: {
    title: ["Together We Can", "Create Lasting", "Change"],
    intro: "Haven supports children, caregivers and communities through education, healthcare, counselling and protection.",
  },
  seo: {
    title: "Our Impact",
    description: "How Haven's work changes things for children and families, and where the money goes.",
  },
  sections: {
    numbers: {
      eyebrow: "Our Impact",
      title: ["The Numbers"],
      body: [para("n1", "Figures marked illustrative are placeholders pending verification by our finance team.")],
    },
    numbersEmpty: {
      body: [para("e1", "We're verifying our latest figures. Check back soon.")],
    },
    whereMoneyWent: {
      eyebrow: "Transparency",
      title: ["Where the Money Went"],
    },
    projects: {
      eyebrow: "On the Ground",
      title: ["Our Recent Projects"],
      cta: { label: "View All Projects", to: "projects" },
    },
    stories: {
      title: ["Stories of", "Hope"],
      cta: { label: "See All Stories", to: "stories" },
    },
    appeals: {
      eyebrow: "Let’s Start Giving",
      title: ["See Your Impact: Transparent", "Programme Appeals"],
    },
    reports: {
      eyebrow: "Reports",
      title: ["Annual and Programme Reports"],
      cta: { label: "All Reports", to: "resources" },
    },
  },
};
