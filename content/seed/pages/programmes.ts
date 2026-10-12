// pages.programmes (public-pages §3.3). Each programme's own page copy lives in the programmes
// collection; this doc holds the index page's hero and section copy.

import "server-only";

import { ref } from "@/lib/media/pipeline";
import { para, type PageSeed } from "./_helpers";

export const programmesPage: PageSeed = {
  hero: {
    eyebrow: "Our Programmes",
    title: ["Care That Reaches Every Need"],
    intro:
      "Protecting, assisting and supporting vulnerable children, families and other verifiable charitable organisations, through education, healthcare, psychosocial assistance, legal support and community-based interventions.",
    media: ref("journey-needs"),
  },
  seo: {
    title: "Our Programmes",
    description:
      "Child protection, education, medical, counselling, legal and family support: how Haven helps vulnerable children and families.",
  },
  sections: {
    grid: {
      eyebrow: "Our Programmes",
      title: ["We Do It For Every Child"],
      cta: { label: "Request Support", to: "support" },
    },
    howWeDecide: {
      eyebrow: "How We Decide Who We Help",
      title: ["Fair, Careful and Confidential"],
      body: [
        para("d1", "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support."),
        para("d2", "Because of fraud, all information is checked and verified."),
      ],
    },
    fund: {
      eyebrow: "Fund a Programme",
      title: ["Give to a Programme"],
      cta: { label: "Donate Now", to: "donate" },
    },
  },
};
