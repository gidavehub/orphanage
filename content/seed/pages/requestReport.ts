// pages.requestReport (public-pages §3.11). CLIENT [draft].

import "server-only";

import { items, para, type PageSeed } from "./_helpers";

export const requestReportPage: PageSeed = {
  hero: {
    title: ["Request a Report"],
    intro: "Some reports are shared on request. Tell us what you need and why, and our team will review your request.",
  },
  seo: {
    title: "Request a Report",
    description: "Ask Haven for a report that is shared on request. Our team reviews every request.",
  },
  sections: {
    steps: {
      eyebrow: "How It Works",
      items: items([["Request"], ["Review"], ["Approval"], ["Emailed to you"]]),
    },
    freeDownload: {
      body: [para("f1", "Good news: this one is free to download.")],
    },
  },
};
