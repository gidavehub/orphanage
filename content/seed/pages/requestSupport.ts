// pages.requestSupport (public-pages §3.6). Form labels and validation messages stay in the form
// code (interface microcopy); this doc holds the page copy and the success screen. CLIENT [draft].

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const requestSupportPage: PageSeed = {
  hero: {
    eyebrow: "Confidential request",
    title: ["Request Support"],
    intro: "It takes about five minutes. Every question needs an answer unless it says optional.",
  },
  seo: {
    title: "Request Support",
    description: "A confidential request for education, medical, counselling, legal, food or family support from Haven.",
  },
  sections: {
    explanationHint: {
      body: [para("h1", "Please don't include children's full names or exact home addresses. We'll ask for details we need later.")],
    },
    documentsHint: {
      body: [para("d1", "Only upload documents if they help explain your situation. Files are stored securely and only authorised staff can see them.")],
    },
    review: {
      body: [
        para("r1", "Every request is reviewed against policy, resources and safeguarding procedures. Submitting a request does not guarantee support."),
      ],
    },
    success: {
      title: ["Thank You.", "We've Received Your Request."],
      body: [para("s1", "Please keep this reference.")],
      items: items([
        ["We confirm we've received it", "We contact you your preferred way."],
        ["We review and verify"],
        ["We connect you with support or a referral"],
      ]),
      cta: { label: "Explore Resources", to: "resources" },
    },
  },
};
